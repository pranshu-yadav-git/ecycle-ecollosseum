import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function RecycleDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['#2ecc71', '#1b5e20']} style={styles.header}>
          <ThemedText style={styles.headerLabel}>VERIFIED PICKUP</ThemedText>
          <ThemedText style={styles.payout}>₹{params.cashValueINR}</ThemedText>
          <ThemedText style={styles.deviceName}>{params.name}</ThemedText>
        </LinearGradient>

        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>The Process</ThemedText>
          
          <ProcessStep 
            icon="person.badge.shield.check.fill"
            title="Verified Agent Arrival"
            desc="A background-checked agent will visit your location in Gurugram within 24 hours."
          />
          <ProcessStep 
            icon="magnifyingglass.circle.fill"
            title="Smart Inspection"
            desc="The agent will use AI tools to inspect internal circuits and component health."
          />
          <ProcessStep 
            icon="banknote.fill"
            title="Instant Cash"
            desc="Receive the final AI-calculated value instantly via your preferred method."
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)')}>
          <ThemedText style={styles.btnText}>Confirm & Dispatch Agent</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

function ProcessStep({ icon, title, desc }: any) {
  return (
    <View style={styles.step}>
      <IconSymbol name={icon} size={30} color="#2ecc71" />
      <View style={{ flex: 1, marginLeft: 15 }}>
        <ThemedText style={styles.stepTitle}>{title}</ThemedText>
        <ThemedText style={styles.stepDesc}>{desc}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  header: { padding: 40, alignItems: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: 2 },
  payout: { color: '#fff', fontSize: 55, fontWeight: '900', marginVertical: 10 },
  deviceName: { color: '#fff', fontSize: 18, opacity: 0.9 },
  content: { padding: 25 },
  sectionTitle: { marginBottom: 25, color: '#2ecc71' },
  step: { flexDirection: 'row', marginBottom: 30, alignItems: 'flex-start' },
  stepTitle: { fontSize: 18, fontWeight: '800', marginBottom: 5 },
  stepDesc: { fontSize: 14, color: '#88a08b', lineHeight: 20 },
  btn: { marginHorizontal: 25, backgroundColor: '#1b5e20', padding: 22, borderRadius: 20, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 }
});