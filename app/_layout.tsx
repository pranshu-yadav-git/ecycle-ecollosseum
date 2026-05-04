import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { auth } from '../lib/firebase';

interface User {
  uid: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  isDark: boolean;
  setIsDark: React.Dispatch<React.SetStateAction<boolean>>;
  isNavbarVisible: boolean;
  setNavbarVisible: (v: boolean) => void;
  logout: () => Promise<void>;
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType>({} as any);
export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [isNavbarVisible, setNavbarVisible] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const loadTheme = async () => {
      const storedTheme = await AsyncStorage.getItem('theme');
      if (storedTheme) setIsDark(storedTheme === 'dark');
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firebaseUser.displayName || 'Explorer',
        };
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      router.replace('/auth');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      await AsyncStorage.removeItem('user');
      router.replace('/auth');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#fff' }}>
          <ActivityIndicator size="large" color="#2ecc71" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider
        value={{
          user,
          setUser,
          loading,
          isDark,
          setIsDark,
          isNavbarVisible,
          setNavbarVisible,
          logout,
          toggleTheme,
        }}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}