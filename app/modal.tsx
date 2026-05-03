import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Device History</ThemedText>
      <ThemedView style={styles.separator} />
      <ThemedText>Detailed breakdown of your device's market value over time.</ThemedText>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  separator: { marginVertical: 30, height: 1, width: '80%', backgroundColor: '#eee' },
});