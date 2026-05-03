import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../app/_layout';
import { ThemedText } from './themed-text';

const { width } = Dimensions.get('window');

export function ProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    user,
    isDark,
    setIsDark,
    logout,
  } = useAuth();

  const [name, setName] = useState(user?.name || '');

  const hashedEmail = user?.email?.replace(
    /^(.)(.*)(?=@)/,
    (match: string, first: string, middle: string) =>
      first + '*'.repeat(middle.length)
  );

  const handleUpdateName = async () => {
    if (!name.trim()) return;
    const updatedUser = { ...user, name };
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      onClose(); // Close modal first[cite: 11]
      await logout(); // Trigger layout logout logic[cite: 11]
      setName(''); // Reset local state[cite: 11]
    } catch (e) {
      console.log("Logout error:", e);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.centeredView}>
        <BlurView
          intensity={90}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.modalView,
            {
              backgroundColor: isDark ? 'rgba(20,20,20,0.6)' : 'rgba(255,255,255,0.7)',
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>Profile Settings</ThemedText>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <ThemedText style={styles.closeText}>Close</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.avatarLarge}>
            <ThemedText style={styles.avatarTextLarge}>
              {user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'EC'}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.label}>DISPLAY NAME</ThemedText>
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#000' }]}
              value={name}
              onChangeText={setName}
              onBlur={handleUpdateName}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.label}>ACCOUNT EMAIL</ThemedText>
            <ThemedText style={styles.emailText}>{hashedEmail}</ThemedText>
          </View>

          {/* <TouchableOpacity style={styles.settingRow} onPress={toggleTheme}>
            <View style={styles.rowLeft}>
              <IconSymbol name={isDark ? 'moon.fill' : 'sun.max.fill'} size={20} color="#2ecc71" />
              <ThemedText style={styles.settingLabel}>Dark Mode</ThemedText>
            </View>
            <View style={[styles.toggleBackground, { backgroundColor: isDark ? '#2ecc71' : '#ccc' }]}>
              <View style={[styles.toggleCircle, { alignSelf: isDark ? 'flex-end' : 'flex-start' }]} />
            </View>
          </TouchableOpacity> */}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <ThemedText style={styles.logoutText}>Logout</ThemedText>
          </TouchableOpacity>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: width * 0.85, borderRadius: 35, padding: 25, borderWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900' },
  avatarLarge: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#2ecc71', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  avatarTextLarge: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  section: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#2ecc71', marginBottom: 8 },
  input: { fontSize: 18, fontWeight: '600', borderBottomWidth: 1, paddingBottom: 5 },
  emailText: { fontSize: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  toggleBackground: { width: 44, height: 24, borderRadius: 12, padding: 2 },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  closeBtn: { marginTop: 10, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.1)' },
  closeText: { fontWeight: '700', opacity: 0.7 },
  logoutBtn: { marginTop: 25, alignItems: 'center', padding: 15, borderRadius: 15, backgroundColor: 'rgba(255,0,0,0.08)' },
  logoutText: { color: '#ff4d4d', fontWeight: '800' },
});