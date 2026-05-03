import { useAuth } from '@/app/_layout';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalStore } from '../../lib/global-store';

// ── Types ─────────────────────────────────────────────────────────────────────
type DeviceType = 'phone' | 'laptop' | 'tv' | 'appliance' | 'accessory' | 'generic';

interface DeviceResult {
  name: string;
  type: DeviceType;
  isEwaste: boolean;
}

interface PickupDetails {
  address: string;
  date: string;
  time: string;
  extraImages: string[];
}

// Local pickup display entry (read from global store)
type Mode = 'idle' | 'camera' | 'result' | 'details' | 'pickup-details';

// ── Condition questions ───────────────────────────────────────────────────────
const QUESTIONS: Record<DeviceType, string[]> = {
  phone: [
    'Screen condition? (cracked / scratched / fine)',
    'Battery life? (drains fast / normal)',
    'Any water damage? (yes / no)',
    'Charging port working? (yes / no)',
    'Any missing or broken buttons? (yes / no)',
  ],
  laptop: [
    'Keyboard fully working? (yes / no)',
    'Battery health? (dead / holds charge / good)',
    'Any overheating or fan noise? (yes / no)',
    'Screen condition? (dead pixels / cracked / fine)',
    'Physical damage to body or chassis? (yes / no)',
  ],
  tv: [
    'Display working? (lines / dead pixels / fine)',
    'Remote control included? (yes / no)',
    'Any cracks on the screen? (yes / no)',
    'HDMI / USB ports functional? (yes / no)',
    'Any power-on issues? (yes / no)',
  ],
  appliance: [
    'Is it still functional? (yes / no)',
    'Any physical dents or damage? (yes / no)',
    'Original cables or accessories included? (yes / no)',
    'Approximate age / year of manufacture?',
  ],
  accessory: [
    'Overall condition? (mint / worn / broken)',
    'Cables or charger included? (yes / no)',
    'Any physical damage? (yes / no)',
  ],
  generic: [
    'Overall condition?',
    'Is it still functional? (yes / no)',
    'Any physical or water damage? (yes / no)',
  ],
};

const TYPE_ICONS: Record<DeviceType, string> = {
  phone: '📱',
  laptop: '💻',
  tv: '📺',
  appliance: '🔌',
  accessory: '🎧',
  generic: '⚡',
};

const CURRENT_YEAR = new Date().getFullYear();

// ── Toast helper ──────────────────────────────────────────────────────────────
const showToast = (msg: string) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert(msg);
};

// ── Rename Modal ──────────────────────────────────────────────────────────────
interface RenameModalProps { visible: boolean; currentName: string; onConfirm: (name: string) => void; onCancel: () => void; }

const RenameModal: React.FC<RenameModalProps> = ({ visible, currentName, onConfirm, onCancel }) => {
  const [name, setName] = useState(currentName);
  React.useEffect(() => { if (visible) setName(currentName); }, [visible, currentName]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Rename Device</Text>
          <Text style={styles.modalSubtitle}>Couldn't identify it? Give it a name manually.</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Old Samsung Galaxy S8"
            placeholderTextColor="#555"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onConfirm(name.trim())}
          />
          <View style={styles.modalRow}>
            <TouchableOpacity style={styles.modalSecondary} onPress={onCancel}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalPrimary, !name.trim() && styles.disabled]}
              onPress={() => name.trim() && onConfirm(name.trim())}
            >
              <Text style={styles.modalPrimaryText}>Save Name</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Pickup Card ───────────────────────────────────────────────────────────────
function PickupCard({ pickup, onCancel }: { pickup: any; onCancel: (id: string) => void }) {
  return (
    <View style={styles.pickupCard}>
      <View style={styles.pickupCardTop}>
        <Text style={styles.pickupIcon}>{TYPE_ICONS[pickup.deviceType as DeviceType] || '⚡'}</Text>
        <View style={styles.pickupInfo}>
          <Text style={styles.pickupName}>{pickup.deviceName}</Text>
          <View style={styles.pickupMeta}>
            <View style={styles.pickupTypePill}>
              <Text style={styles.pickupTypePillText}>{pickup.deviceType?.toUpperCase()}</Text>
            </View>
            {pickup.date && pickup.date !== 'TBD' && (
              <Text style={styles.pickupDate}>📅 {pickup.date}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.cancelPickupBtn} onPress={() => onCancel(pickup.id)}>
          <Text style={styles.cancelPickupIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pickupCardDivider} />
      <View style={styles.pickupCardBottom}>
        <Text style={styles.pickupDetailText}>
          📍 {pickup.address && pickup.address !== 'To be confirmed' ? pickup.address : 'Address pending'}
        </Text>
        {pickup.time && pickup.time !== 'TBD' && (
          <Text style={styles.pickupDetailText}>🕐 {pickup.time}</Text>
        )}
        {pickup.isEwaste && (
          <Text style={[styles.pickupDetailText, { color: '#f87171' }]}>⚠️ Flagged as e-waste</Text>
        )}
        {pickup.extraImages?.length > 0 && (
          <Text style={styles.pickupDetailText}>📷 {pickup.extraImages.length} extra photo{pickup.extraImages.length > 1 ? 's' : ''}</Text>
        )}
      </View>
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const { devices, pickups, addDevice, addPickup, cancelPickup } = useGlobalStore();
  const { setNavbarVisible } = useAuth();

  // Handle navigation from scan-device — jump straight to condition assessment
  const params = useLocalSearchParams<{ fromScan?: string; deviceName?: string; deviceType?: string; isEwaste?: string }>();

  const [mode, setMode] = useState<Mode>(() =>
    params.fromScan === '1' ? 'details' : 'idle'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeviceResult | null>(() =>
    params.fromScan === '1' && params.deviceName
      ? { name: params.deviceName, type: (params.deviceType as DeviceType) || 'generic', isEwaste: params.isEwaste === '1' }
      : null
  );
  const [condition, setCondition] = useState<Record<string, string>>({});
  const [scannedDeviceId, setScannedDeviceId] = useState<string | null>(null); // id of device added to global store from this scan
  const [pickupDetails, setPickupDetails] = useState<PickupDetails>({ address: '', date: '', time: '', extraImages: [] });
  const [schedulePickupForScanned, setSchedulePickupForScanned] = useState(false);
  const insets = useSafeAreaInsets();

  const [renameVisible, setRenameVisible] = useState(false);

  // When navigated from scan-device, link scannedDeviceId to the last added device
  React.useEffect(() => {
    if (params.fromScan === '1' && devices.length > 0) {
      setScannedDeviceId(devices[devices.length - 1].id);
    }
  }, []);

  // Hide navbar during scanning and assessment flows
  React.useEffect(() => {
    const shouldHide = mode === 'camera' || mode === 'result' || mode === 'details' || mode === 'pickup-details';
    setNavbarVisible(!shouldHide);
    return () => setNavbarVisible(true); // restore on unmount
  }, [mode]);

  const API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const safeParse = (text: string): DeviceResult | null => {
    try {
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(json || '{}');
      if (!parsed?.name) return null;
      return { name: parsed.name, type: (parsed.type?.toLowerCase() as DeviceType) || 'generic', isEwaste: parsed.isEwaste ?? true };
    } catch { return null; }
  };

  const getQuestions = (): string[] => QUESTIONS[(result?.type as DeviceType) || 'generic'] ?? QUESTIONS.generic;

  const isUnknown = (name: string) =>
    name.toLowerCase().includes('unknown') || name.toLowerCase().includes('unidentified');

  // ── AI call ────────────────────────────────────────────────────────────────
  const analyzeImage = async (base64: string) => {
    setLoading(true);
    setResult(null);
    setCondition({});
    setScannedDeviceId(null);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ecycle.app',
          'X-Title': 'E-Cycle App',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          temperature: 0.2,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Identify the electronic device in the image. Return ONLY valid JSON, no explanation:
{
  "name": "specific device name",
  "type": "phone | laptop | tv | appliance | accessory | generic",
  "isEwaste": true
}`,
              },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          }],
        }),
      });

      const data = await res.json();
      const parsed = safeParse(data?.choices?.[0]?.message?.content ?? '');
      const identified = parsed ?? { name: 'Unknown Electronic Device', type: 'generic' as DeviceType, isEwaste: true };
      setResult(identified);
      setMode('result');
    } catch {
      showToast('AI failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) { showToast('Camera permission denied.'); return; }
    }
    setMode('camera');
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true });
    setMode('idle');
    analyzeImage(photo.base64);
  };

  // ── Gallery ────────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
    if (!res.canceled && res.assets[0]?.base64) analyzeImage(res.assets[0].base64);
  };

  // ── Extra images ───────────────────────────────────────────────────────────
  const addExtraImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 0.7 });
    if (!res.canceled && res.assets[0]?.uri) {
      setPickupDetails(prev => ({ ...prev, extraImages: [...prev.extraImages, res.assets[0].uri] }));
    }
  };

  const removeExtraImage = (uri: string) => {
    setPickupDetails(prev => ({ ...prev, extraImages: prev.extraImages.filter(i => i !== uri) }));
  };

  // ── Continue from result: register device in global store (only when NOT from scan-device) ──
  const continueToDetails = () => {
    if (!result) return;
    if (params.fromScan === '1') {
      // Device already added by scan-device — skip addDevice to avoid duplicates
      const lastDevice = devices[devices.length - 1];
      if (lastDevice) setScannedDeviceId(lastDevice.id);
      setMode('details');
      return;
    }
    // Community's own scan flow: register device now
    const id = addDevice({
      name: result.name,
      type: result.type,
      condition: 'Pending assessment',
      isEwaste: result.isEwaste,
      source: 'scan',
      verdict: result.isEwaste ? 'RECYCLE' : 'KEEP',
      aiScore: result.isEwaste ? 45 : 78,
      emoji: TYPE_ICONS[result.type],
      pickupScheduled: false,
    });
    setScannedDeviceId(id);
    showToast(`✅ ${result.name} added to Your Devices (+50 pts)`);
    setMode('details');
  };

  // ── Pickup flow ───────────────────────────────────────────────────────────
  const goToPickupDetails = () => {
    setPickupDetails({ address: '', date: '', time: '', extraImages: [] });
    setSchedulePickupForScanned(true);
    setMode('pickup-details');
  };

  const confirmPickup = () => {
    if (!result || !scannedDeviceId) return;
    if (!pickupDetails.address.trim() || !pickupDetails.date.trim() || !pickupDetails.time.trim()) {
      showToast('Please fill in address, date and time.');
      return;
    }

    addPickup({
      deviceId: scannedDeviceId,
      deviceName: result.name,
      deviceType: result.type,
      isEwaste: result.isEwaste,
      address: pickupDetails.address,
      date: pickupDetails.date,
      time: pickupDetails.time,
      extraImages: pickupDetails.extraImages,
    });

    const pts = result.isEwaste ? 200 : 100;
    showToast(`✅ Pickup confirmed for ${result.name} · +${pts} pts earned!`);
    setResult(null);
    setCondition({});
    setScannedDeviceId(null);
    setMode('idle');
  };

  const handleCancelPickup = (id: string) => {
    Alert.alert('Cancel Pickup', 'Are you sure you want to cancel this scheduled pickup?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Pickup', style: 'destructive', onPress: () => { cancelPickup(id); showToast('Pickup cancelled'); } },
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── CAMERA ── */}
        {mode === 'camera' && (
          <View style={styles.cameraWrapper}>
            <CameraView ref={cameraRef} style={styles.camera}>
              <View style={styles.cameraOverlay}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setMode('idle')}>
                  <Text style={styles.backBtnText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <Text style={styles.scanHint}>Point at any e-waste device</Text>
                </View>
                <TouchableOpacity style={styles.capture} onPress={capturePhoto}>
                  <View style={styles.captureInner} />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        )}

        {/* ── NON-CAMERA MODES ── */}
        {mode !== 'camera' && (
          <>
            {/* HEADER */}
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
              <View>
                <Text style={styles.headerEyebrow}>E-WASTE</Text>
                <Text style={styles.headerTitle}>RecycleAI</Text>
              </View>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>♻️ {pickups.length} scheduled</Text>
              </View>
            </View>

            {/* ── RESULT ── */}
            {mode === 'result' && result && (
              <ScrollView contentContainerStyle={styles.scrollPad}>
                <View style={styles.resultHero}>
                  <Text style={styles.heroIcon}>{TYPE_ICONS[result.type] || '⚡'}</Text>
                  <Text style={styles.heroEyebrow}>DEVICE IDENTIFIED</Text>
                  <Text style={styles.heroTitle}>{result.name}</Text>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>{result.type.toUpperCase()}</Text>
                  </View>

                  {/* Points preview */}
                  <View style={styles.pointsPreview}>
                    <Text style={styles.pointsPreviewText}>
                      🌿 Register = +50 pts  ·  Schedule pickup = +{result.isEwaste ? '200' : '100'} pts
                    </Text>
                  </View>
                </View>

                {isUnknown(result.name) && (
                  <View style={styles.renamePrompt}>
                    <Text style={styles.renamePromptText}>🔍 Couldn't identify your device clearly.</Text>
                    <TouchableOpacity style={styles.renameBtn} onPress={() => setRenameVisible(true)}>
                      <Text style={styles.renameBtnText}>✏️  Rename Device</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => setMode('idle')}>
                    <Text style={styles.outlineBtnText}>↩ Rescan</Text>
                  </TouchableOpacity>
                  {!isUnknown(result.name) && (
                    <TouchableOpacity style={styles.outlineBtn} onPress={() => setRenameVisible(true)}>
                      <Text style={styles.outlineBtnText}>✏️ Rename</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.greenBtn} onPress={continueToDetails}>
                    <Text style={styles.greenBtnText}>Add Device →</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ── CONDITION DETAILS ── */}
            {mode === 'details' && result && (
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent} keyboardShouldPersistTaps="handled">
                  <TouchableOpacity style={styles.backRow} onPress={() => setMode('result')}>
                    <Text style={styles.backLink}>← Back</Text>
                  </TouchableOpacity>

                  <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepActive]}><Text style={styles.stepText}>1</Text></View>
                    <View style={styles.stepLine} />
                    <View style={styles.step}><Text style={styles.stepText}>2</Text></View>
                  </View>
                  <Text style={styles.stepLabel}>Step 1 of 2 — Condition Assessment</Text>

                  <Text style={styles.sectionTitle}>{TYPE_ICONS[result.type]} {result.name}</Text>
                  <Text style={styles.sectionSubtitle}>Tell us about the device's current state</Text>

                  {getQuestions().map((q, i) => (
                    <View key={i} style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>{q}</Text>
                      <TextInput
                        placeholder="Type your answer…"
                        placeholderTextColor="#454545"
                        style={styles.input}
                        value={condition[q] ?? ''}
                        onChangeText={t => setCondition(prev => ({ ...prev, [q]: t }))}
                      />
                    </View>
                  ))}

                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.outlineBtn} onPress={() => { setResult(null); setMode('idle'); }}>
                      <Text style={styles.outlineBtnText}>Skip for now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.greenBtn} onPress={goToPickupDetails}>
                      <Text style={styles.greenBtnText}>Next →</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 40 }} />
                </ScrollView>
              </KeyboardAvoidingView>
            )}

            {/* ── PICKUP DETAILS ── */}
            {mode === 'pickup-details' && result && (
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent} keyboardShouldPersistTaps="handled">
                  <TouchableOpacity style={styles.backRow} onPress={() => setMode('details')}>
                    <Text style={styles.backLink}>← Back</Text>
                  </TouchableOpacity>

                  <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepDone]}><Text style={styles.stepText}>✓</Text></View>
                    <View style={[styles.stepLine, styles.stepLineDone]} />
                    <View style={[styles.step, styles.stepActive]}><Text style={styles.stepText}>2</Text></View>
                  </View>
                  <Text style={styles.stepLabel}>Step 2 of 2 — Pickup Details</Text>

                  {/* Points reward preview */}
                  <View style={styles.pointsRewardCard}>
                    <Text style={styles.pointsRewardTitle}>
                      🌿 Completing pickup earns you +{result.isEwaste ? '200' : '100'} eco points
                    </Text>
                  </View>

                  <Text style={styles.sectionTitle}>📍 Schedule Your Pickup</Text>
                  <Text style={styles.sectionSubtitle}>We'll send a recycling agent to your address</Text>

                  {/* Address */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>📌 Pickup Address *</Text>
                    <TextInput
                      placeholder="House / Street / City / PIN"
                      placeholderTextColor="#454545"
                      style={[styles.input, styles.inputMulti]}
                      value={pickupDetails.address}
                      onChangeText={t => setPickupDetails(p => ({ ...p, address: t }))}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>📅 Preferred Pickup Date *</Text>
                    <TextInput
                      placeholder="e.g. 10 May 2026 or DD/MM/YYYY"
                      placeholderTextColor="#454545"
                      style={styles.input}
                      value={pickupDetails.date}
                      onChangeText={t => setPickupDetails(p => ({ ...p, date: t }))}
                    />
                  </View>

                  {/* Time */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>🕐 Preferred Time Slot *</Text>
                    <View style={styles.timeSlots}>
                      {['9 AM–12 PM', '12 PM–3 PM', '3 PM–6 PM', '6 PM–9 PM'].map(slot => (
                        <TouchableOpacity
                          key={slot}
                          style={[styles.timeChip, pickupDetails.time === slot && styles.timeChipActive]}
                          onPress={() => setPickupDetails(p => ({ ...p, time: slot }))}
                        >
                          <Text style={[styles.timeChipText, pickupDetails.time === slot && styles.timeChipTextActive]}>{slot}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      placeholder="Or type a custom time…"
                      placeholderTextColor="#454545"
                      style={[styles.input, { marginTop: 8 }]}
                      value={['9 AM–12 PM', '12 PM–3 PM', '3 PM–6 PM', '6 PM–9 PM'].includes(pickupDetails.time) ? '' : pickupDetails.time}
                      onChangeText={t => setPickupDetails(p => ({ ...p, time: t }))}
                    />
                  </View>

                  {/* Extra Images */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>📷 Additional Photos (Optional)</Text>
                    <Text style={styles.inputHint}>Help our team assess the device better.</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
                      <TouchableOpacity style={styles.addImageBtn} onPress={addExtraImage}>
                        <Text style={styles.addImageIcon}>＋</Text>
                        <Text style={styles.addImageText}>Add Photo</Text>
                      </TouchableOpacity>
                      {pickupDetails.extraImages.map((uri, i) => (
                        <View key={i} style={styles.thumbWrapper}>
                          <Image source={{ uri }} style={styles.thumb} />
                          <TouchableOpacity style={styles.removeThumb} onPress={() => removeExtraImage(uri)}>
                            <Text style={styles.removeThumbText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Summary */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Pickup Summary</Text>
                    <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Device: </Text>{result.name}</Text>
                    <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Type: </Text>{result.type.toUpperCase()}</Text>
                    {pickupDetails.address ? <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Address: </Text>{pickupDetails.address}</Text> : null}
                    {pickupDetails.date ? <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Date: </Text>{pickupDetails.date}</Text> : null}
                    {pickupDetails.time ? <Text style={styles.summaryLine}><Text style={styles.summaryKey}>Time: </Text>{pickupDetails.time}</Text> : null}
                  </View>

                  <View style={[styles.actionRow, { marginBottom: 70 }]}>
                    <TouchableOpacity style={styles.outlineBtn} onPress={() => { setResult(null); setMode('idle'); }}>
                      <Text style={styles.outlineBtnText}>Skip Pickup</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.greenBtn} onPress={confirmPickup}>
                      <Text style={styles.greenBtnText}>✓ Confirm Pickup</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 40 }} />
                </ScrollView>
              </KeyboardAvoidingView>
            )}

            {/* ── IDLE — Scheduled Pickups List ── */}
            {mode === 'idle' && (
              <View style={styles.idleWrapper}>
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  {pickups.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyHeroIcon}>♻️</Text>
                      <Text style={styles.emptyTitle}>No pickups scheduled</Text>
                      <Text style={styles.emptySubtitle}>
                        Scan any electronic device and we'll arrange a free recycling pickup from your doorstep.
                      </Text>
                      <View style={styles.emptySteps}>
                        {[
                          { icon: '📸', label: 'Scan device' },
                          { icon: '🔍', label: 'AI identifies it' },
                          { icon: '📍', label: 'Schedule pickup' },
                          { icon: '♻️', label: 'We collect it' },
                        ].map((s, i) => (
                          <View key={i} style={styles.emptyStep}>
                            <Text style={styles.emptyStepIcon}>{s.icon}</Text>
                            <Text style={styles.emptyStepLabel}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.listHeader}>SCHEDULED PICKUPS</Text>
                      {pickups.map(p => (
                        <PickupCard key={p.id} pickup={p} onCancel={handleCancelPickup} />
                      ))}
                    </>
                  )}
                  <View style={{ height: 160 }} />
                </ScrollView>

                <View style={[styles.bottom, { paddingBottom: 100 + insets.bottom }]}>
                  <TouchableOpacity style={styles.greenBtnFull} onPress={openCamera}>
                    <Text style={styles.greenBtnText}>📸  Scan a Device</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineBtnFull} onPress={pickImage}>
                    <Text style={styles.outlineBtnText}>🖼  Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* Loading overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#2ecc71" />
              <Text style={styles.loadingTitle}>Analysing device…</Text>
              <Text style={styles.loadingSubtitle}>Our AI is identifying your e-waste</Text>
            </View>
          </View>
        )}

        {/* Rename Modal */}
        <RenameModal
          visible={renameVisible}
          currentName={result?.name ?? ''}
          onConfirm={(name) => { if (result) setResult({ ...result, name }); setRenameVisible(false); }}
          onCancel={() => setRenameVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const G = '#2ecc71';
const BG = '#080808';
const CARD = '#111111';
const BORDER = '#1e1e1e';
const MUTED = '#555';
const DIM = '#888';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerEyebrow: { fontSize: 9, fontWeight: '800', color: G, letterSpacing: 2, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerBadge: { backgroundColor: 'rgba(46,204,113,0.12)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  headerBadgeText: { color: G, fontSize: 12, fontWeight: '700' },

  cameraWrapper: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 260, height: 260, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: G, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 30, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 30, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  capture: { position: 'absolute', bottom: 120, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },

  scrollPad: { padding: 20 },
  resultHero: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroIcon: { fontSize: 52, marginBottom: 12 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', color: G, letterSpacing: 2, marginBottom: 6 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 10 },
  typePill: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 14 },
  typePillText: { color: DIM, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },

  pointsPreview: { backgroundColor: 'rgba(46,204,113,0.08)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  pointsPreviewText: { color: G, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  pointsRewardCard: { backgroundColor: 'rgba(46,204,113,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  pointsRewardTitle: { color: G, fontSize: 13, fontWeight: '700', textAlign: 'center' },

  renamePrompt: { backgroundColor: 'rgba(255,193,7,0.08)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center' },
  renamePromptText: { color: '#ccc', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  renameBtn: { backgroundColor: 'rgba(255,193,7,0.15)', borderWidth: 1, borderColor: 'rgba(255,193,7,0.4)', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  renameBtnText: { color: '#ffc107', fontWeight: '700', fontSize: 14 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  greenBtn: { flex: 1, backgroundColor: G, padding: 15, borderRadius: 14, alignItems: 'center' },
  greenBtnFull: { backgroundColor: G, padding: 16, borderRadius: 14, alignItems: 'center' },
  greenBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },
  outlineBtn: { flex: 1, backgroundColor: '#131313', padding: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  outlineBtnFull: { backgroundColor: '#131313', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  outlineBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  stepActive: { borderColor: G, backgroundColor: 'rgba(46,204,113,0.15)' },
  stepDone: { borderColor: G, backgroundColor: G },
  stepText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#222', marginHorizontal: 6 },
  stepLineDone: { backgroundColor: G },
  stepLabel: { color: MUTED, fontSize: 12, marginBottom: 16 },

  detailsScroll: { flex: 1 },
  detailsContent: { padding: 20 },
  backRow: { marginBottom: 16 },
  backLink: { color: G, fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: MUTED, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputHint: { color: MUTED, fontSize: 11, marginBottom: 8, lineHeight: 16 },
  input: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#252525', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  inputMulti: { height: 80, textAlignVertical: 'top' },

  timeSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a' },
  timeChipActive: { backgroundColor: 'rgba(46,204,113,0.15)', borderColor: G },
  timeChipText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  timeChipTextActive: { color: G },

  imageRow: { marginTop: 4 },
  addImageBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#2a2a2a', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: '#141414' },
  addImageIcon: { fontSize: 22, color: MUTED, marginBottom: 2 },
  addImageText: { color: MUTED, fontSize: 10, fontWeight: '600' },
  thumbWrapper: { position: 'relative', marginRight: 10 },
  thumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#1a1a1a' },
  removeThumb: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ff4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  removeThumbText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  summaryCard: { backgroundColor: 'rgba(46,204,113,0.06)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.15)', borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 20 },
  summaryTitle: { color: G, fontWeight: '800', fontSize: 13, letterSpacing: 1, marginBottom: 10 },
  summaryLine: { color: '#aaa', fontSize: 13, marginBottom: 4, lineHeight: 18 },
  summaryKey: { color: '#fff', fontWeight: '700' },

  idleWrapper: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16 },
  listHeader: { fontSize: 10, fontWeight: '800', color: G, letterSpacing: 2, marginBottom: 12, marginTop: 4 },

  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyHeroIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptySteps: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16 },
  emptyStep: { alignItems: 'center', flex: 1 },
  emptyStepIcon: { fontSize: 24, marginBottom: 6 },
  emptyStepLabel: { color: DIM, fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 14 },

  pickupCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 12, overflow: 'hidden' },
  pickupCardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  pickupIcon: { fontSize: 28 },
  pickupInfo: { flex: 1 },
  pickupName: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 5 },
  pickupMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pickupTypePill: { backgroundColor: '#1a1a1a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  pickupTypePillText: { color: G, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  pickupDate: { color: MUTED, fontSize: 12 },
  cancelPickupBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.25)', alignItems: 'center', justifyContent: 'center' },
  cancelPickupIcon: { color: '#ff4444', fontSize: 12, fontWeight: '900' },
  pickupCardDivider: { height: 1, backgroundColor: BORDER },
  pickupCardBottom: { padding: 14, gap: 4 },
  pickupDetailText: { color: MUTED, fontSize: 12, lineHeight: 18 },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 10 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' },
  loadingCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 32, alignItems: 'center', gap: 12, width: 220 },
  loadingTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4 },
  loadingSubtitle: { color: MUTED, fontSize: 12, textAlign: 'center', lineHeight: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#141414', borderRadius: 20, borderWidth: 1, borderColor: '#252525', padding: 24, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 18 },
  modalInput: { backgroundColor: '#0e0e0e', borderWidth: 1, borderColor: '#2a2a2a', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 18 },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalSecondary: { flex: 1, backgroundColor: '#1a1a1a', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  modalSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalPrimary: { flex: 1, backgroundColor: G, padding: 14, borderRadius: 12, alignItems: 'center' },
  modalPrimaryText: { color: '#000', fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.4 },
});