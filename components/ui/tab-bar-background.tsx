import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { ThemedView } from '../themed-view';

export default function TabBarBackground() {
  // If you are on Web, BlurView might not behave the same, 
  // so we provide a fallback for a consistent look.
  if (Platform.OS === 'web') {
    return <ThemedView style={[StyleSheet.absoluteFill, styles.webFallback]} />;
  }

  return (
    <BlurView
      tint="dark"
      intensity={80}
      style={StyleSheet.absoluteFill}
    />
  );
}

const styles = StyleSheet.create({
  webFallback: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
});