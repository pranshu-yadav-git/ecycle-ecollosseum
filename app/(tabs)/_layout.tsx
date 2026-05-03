import { MaterialIcons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

export default function TabLayout() {
  const { isNavbarVisible } = useAuth(); 
  const scrollAnim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const TAB_BAR_WIDTH = width - 40;

  useEffect(() => {
    Animated.spring(scrollAnim, {
      toValue: isNavbarVisible ? 0 : 150,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isNavbarVisible]);

  // Premium Dark Theme Palette
  const activeColor = '#2ecc71'; 
  const inactiveColor = '#94a3b8'; // Slightly brighter slate for better readability on dark
  const activeFill = 'rgba(46, 204, 113, 0.15)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: true,
        tabBarLabelStyle: { 
          fontSize: 11, 
          fontWeight: '600',
          marginTop: -2, // Pulls text closer to icon for better grouping
        },
        tabBarItemStyle: {
          height: 65,
          paddingVertical: 8, // Ensures content doesn't hit the edges
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
      tabBar={(props) => (
        <Animated.View
          style={[
            styles.container,
            {
              width: TAB_BAR_WIDTH,
              bottom: 20 + insets.bottom, // Lifted slightly for a more floating feel
              left: '50%',
              transform: [
                { translateX: -TAB_BAR_WIDTH / 2 },
                { translateY: scrollAnim },
              ],
            },
          ]}
        >
          {/* Enhanced Dark Glassmorphism */}
          <BlurView
            intensity={80}
            tint="dark" 
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0f172a', opacity: 0.85 }]} />

          <BottomTabBar
            {...props}
            style={{
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
              height: 65,
            }}
          />
        </Animated.View>
      )}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: activeFill }]}>
              <MaterialIcons name="home" size={24} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="chatbot"
        options={{
          title: 'AI Chat',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: activeFill }]}>
              <MaterialIcons name="chat" size={24} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: activeFill }]}>
              <MaterialCommunityIcons name="cart" size={24} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="community"
        options={{
          title: 'Pickup',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: activeFill }]}>
              <MaterialCommunityIcons name="truck" size={24} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="drop-off"
        options={{
          title: 'Centres',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: activeFill }]}>
              <MaterialIcons name="map" size={24} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
    
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    height: 65,
    left: 200,
    right: 20,
    borderRadius: 32,
    overflow: 'hidden',
    // Stronger border for differentiation on dark backgrounds
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)', 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2, // Spacing between icon background and label
  }
});