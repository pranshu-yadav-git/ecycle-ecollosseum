import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth } from '@/lib/firebase';
import * as NavigationBar from 'expo-navigation-bar';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  ToastAndroid,
  TouchableOpacity
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from './_layout';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { setUser, isDark } = useAuth();

  // 🔥 FIX: Force Android nav bar color
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(
        isDark ? '#050805' : '#e8f5e9'
      );
      NavigationBar.setButtonStyleAsync(
        isDark ? 'light' : 'dark'
      );
    }
  }, [isDark]);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }

    setLoading(true);
    try {
      let userCredential;

      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }

      if (userCredential.user) {
        setUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email!,
          name: userCredential.user.displayName || name || 'Explorer',
        });

        if (Platform.OS === 'android') {
          ToastAndroid.show('Welcome to E-Cycle! 🌱', ToastAndroid.SHORT);
        }

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      let errorMessage = "Something went wrong.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "Email already registered.";
      if (error.code === 'auth/invalid-credential') errorMessage = "Invalid email or password.";
      Alert.alert("Auth Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const bgColor = isDark ? '#050805' : '#e8f5e9';

  const dynamicStyles = {
    container: { backgroundColor: bgColor },
    formCard: { backgroundColor: isDark ? '#121c12' : '#fff' },
    input: {
      backgroundColor: isDark ? '#1a261a' : '#f1f8f1',
      color: isDark ? '#fff' : '#1b5e20'
    },
    greeting: { color: isDark ? '#2ecc71' : '#1b5e20' },
    subGreeting: { color: '#4caf50' },
    toggleText: { color: isDark ? '#aaa' : '#666' }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: bgColor }}
    >
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={bgColor}
      />

      <ThemedView style={[styles.container, dynamicStyles.container]}>
        <ScrollView
          style={{ flex: 1, backgroundColor: bgColor }}
          contentContainerStyle={[
            styles.scrollContent,
            { flexGrow: 1, backgroundColor: bgColor }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.delay(200)} style={styles.headerArea}>
            <ThemedText style={styles.treeEmoji}>🌳</ThemedText>
            <ThemedText type="title" style={[styles.greeting, dynamicStyles.greeting]}>
              Welcome to E-Cycle
            </ThemedText>
            <ThemedText style={[styles.subGreeting, dynamicStyles.subGreeting]}>
              {isLogin ? 'Good to see you again!' : 'Start your green journey today.'}
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600)} style={[styles.formCard, dynamicStyles.formCard]}>
            {!isLogin && (
              <TextInput
                placeholder="Full Name"
                style={[styles.input, dynamicStyles.input]}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                placeholderTextColor={isDark ? '#4a5e4a' : '#99bc9f'}
              />
            )}

            <TextInput
              placeholder="Email"
              style={[styles.input, dynamicStyles.input]}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={isDark ? '#4a5e4a' : '#99bc9f'}
            />

            <TextInput
              placeholder="Password"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              style={[styles.input, dynamicStyles.input]}
              placeholderTextColor={isDark ? '#4a5e4a' : '#99bc9f'}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>
                  {isLogin ? 'Login' : 'Sign Up'}
                </ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleArea}>
              <ThemedText style={[styles.toggleText, dynamicStyles.toggleText]}>
                {isLogin ? "Don't have an account? " : "Already a member? "}
                <ThemedText style={styles.toggleAction}>
                  {isLogin ? 'Sign Up' : 'Login'}
                </ThemedText>
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    justifyContent: 'center',
    padding: 25,
    paddingTop: 60,
    paddingBottom: 40
  },
  headerArea: { alignItems: 'center', marginBottom: 40 },
  treeEmoji: { fontSize: 90, marginBottom: 10, lineHeight: 110, textAlign: 'center' },
  greeting: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subGreeting: { fontSize: 16, marginTop: 5, textAlign: 'center' },
  formCard: {
    padding: 25,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  input: {
    height: 60,
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    fontSize: 16
  },
  primaryButton: {
    backgroundColor: '#2ecc71',
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  toggleArea: { marginTop: 20, alignItems: 'center' },
  toggleText: { fontSize: 14 },
  toggleAction: { color: '#2ecc71', fontWeight: 'bold' }
});
