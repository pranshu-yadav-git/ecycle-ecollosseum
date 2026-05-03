import { ThemedText } from '@/components/themed-text';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalStore } from '../lib/global-store';

const { width, height } = Dimensions.get('window');
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DeviceResult {
  deviceName: string;
  brand: string;
  category: 'Smartphone' | 'Laptop' | 'Tablet' | 'TV' | 'Camera' | 'Gaming Console' | 'Desktop' | 'Printer' | 'Audio' | 'Other';
  estimatedYear: number;
  summary: string;
  recycleValueINR: number;
  toxicComponents: string[];
}

interface ConditionAnswer {
  question: string;
  answer: 'Yes' | 'No' | 'Unsure' | null;
}

interface SavedPickup {
  id: string;
  device: DeviceResult;
  imageUri: string;
  conditions: ConditionAnswer[];
  scheduledAt: Date;
  status: 'Confirmed' | 'Cancelled';
  address: string;
}

// ─── Condition Questions by category ──────────────────────────────────────────
const CONDITION_QUESTIONS: Record<string, string[]> = {
  Smartphone: [
    'Does the screen have cracks or dead pixels?',
    'Is there any water damage (check SIM tray for red indicator)?',
    'Is the battery draining unusually fast (< 4 hrs screen-on time)?',
    'Is the charging port loose or non-functional?',
    'Are there significant scratches or dents on the body?',
  ],
  Tablet: [
    'Does the screen have cracks or dead pixels?',
    'Is there any water or liquid damage?',
    'Is the battery health below 80% or swollen?',
    'Are the speakers or buttons non-functional?',
    'Is there physical damage to the body or ports?',
  ],
  Laptop: [
    'Does the screen flicker, have cracks, or dead zones?',
    'Are there any keys missing or not responding on the keyboard?',
    'Does the battery hold less than 2 hours of charge?',
    'Does the laptop overheat or shut down unexpectedly?',
    'Are there significant scratches, dents, or broken hinges?',
  ],
  TV: [
    'Are there dead pixels, burn-in, or screen damage?',
    'Is the remote control included and functional?',
    'Does the TV have power-on issues or random shutdowns?',
    'Are any input ports (HDMI, USB) broken or missing?',
    'Is the screen glass cracked or the bezel damaged?',
  ],
  Camera: [
    'Is the lens scratched or does it have fungus/dust inside?',
    'Is the sensor damaged or does it produce blurry images?',
    'Are any buttons, dials, or the shutter not working?',
    'Is the battery grip or door damaged?',
    'Is there any water or impact damage to the body?',
  ],
  'Gaming Console': [
    'Are the disc drive or game cartridge slots functional?',
    'Do the controllers have stick drift or broken buttons?',
    'Does the console overheat or shut down during use?',
    'Are the HDMI or USB ports damaged?',
    'Is there physical damage to the body or power supply?',
  ],
  Default: [
    'Is the device physically damaged (cracks, dents, breaks)?',
    'Does the device power on and function normally?',
    'Are there any signs of liquid or heat damage?',
    'Are all original parts/components present?',
    'Is the device more than 5 years old?',
  ],
};

const CATEGORY_ICONS: Record<string, string> = {
  Smartphone: '📱', Laptop: '💻', Tablet: '📟', TV: '📺',
  Camera: '📷', 'Gaming Console': '🎮', Desktop: '🖥️',
  Printer: '🖨️', Audio: '🎧', Other: '♻️',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const showToast = (msg: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(msg, ToastAndroid.LONG, ToastAndroid.BOTTOM);
  } else {
    Alert.alert('✅ E-Cycle', msg);
  }
};

const currentYear = new Date().getFullYear();
const isOldDevice = (year: number) => currentYear - year >= 5;

// ─── Scan Line Animation ────────────────────────────────────────────────────────
function ScanLine() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });
  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <LinearGradient
        colors={['transparent', 'rgba(46,204,113,0.7)', 'transparent']}
        style={{ height: 3, width: '100%', borderRadius: 2 }}
      />
    </Animated.View>
  );
}

// ─── Pulsing Ring ──────────────────────────────────────────────────────────────
function PulseRing() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
  );
}

// ─── Condition Questionnaire Modal ─────────────────────────────────────────────
function ConditionModal({
  visible,
  device,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  device: DeviceResult | null;
  onConfirm: (answers: ConditionAnswer[], address: string) => void;
  onCancel: () => void;
}) {
  const questions = device
    ? CONDITION_QUESTIONS[device.category] || CONDITION_QUESTIONS.Default
    : [];

  const [answers, setAnswers] = useState<ConditionAnswer[]>([]);
  const [address, setAddress] = useState('');
  const [step, setStep] = useState(0); // 0 = questions, 1 = address

  useEffect(() => {
    if (visible && device) {
      setAnswers(questions.map((q) => ({ question: q, answer: null })));
      setStep(0);
      setAddress('');
    }
  }, [visible]);

  const setAnswer = (idx: number, val: 'Yes' | 'No' | 'Unsure') => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? { ...a, answer: val } : a)));
  };

  const allAnswered = answers.every((a) => a.answer !== null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: step === 1 ? 1 : 0, useNativeDriver: true }).start();
  }, [step]);

  if (!device) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>

          {/* Header */}
          <LinearGradient colors={['#1b5e20', '#2ecc71']} style={modalStyles.header}>
            <ThemedText style={modalStyles.headerEmoji}>
              {CATEGORY_ICONS[device.category] || '♻️'}
            </ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText style={modalStyles.headerTitle}>
                {step === 0 ? 'Device Condition' : 'Pickup Address'}
              </ThemedText>
              <ThemedText style={modalStyles.headerSub}>
                {device.brand} {device.deviceName}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onCancel} style={modalStyles.closeBtn}>
              <MaterialIcons name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </LinearGradient>

          {step === 0 ? (
            <ScrollView contentContainerStyle={modalStyles.body} showsVerticalScrollIndicator={false}>
              <ThemedText style={modalStyles.instruction}>
                📋 Please answer honestly — this helps us give you the most accurate recycling value.
              </ThemedText>

              {answers.map((item, idx) => (
                <View key={idx} style={modalStyles.qBlock}>
                  <ThemedText style={modalStyles.question}>
                    {idx + 1}. {item.question}
                  </ThemedText>
                  <View style={modalStyles.optionsRow}>
                    {(['Yes', 'No', 'Unsure'] as const).map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          modalStyles.optBtn,
                          item.answer === opt && modalStyles.optBtnActive,
                          opt === 'Yes' && item.answer === 'Yes' && { backgroundColor: '#ef5350' },
                          opt === 'No' && item.answer === 'No' && { backgroundColor: '#2ecc71' },
                          opt === 'Unsure' && item.answer === 'Unsure' && { backgroundColor: '#ff9800' },
                        ]}
                        onPress={() => setAnswer(idx, opt)}
                      >
                        <ThemedText style={[
                          modalStyles.optText,
                          item.answer === opt && { color: '#fff', fontWeight: '800' },
                        ]}>
                          {opt === 'Yes' ? '⚠️ Yes' : opt === 'No' ? '✅ No' : '🤔 Unsure'}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[modalStyles.nextBtn, !allAnswered && { opacity: 0.4 }]}
                onPress={() => setStep(1)}
                disabled={!allAnswered}
              >
                <LinearGradient colors={['#1b5e20', '#2ecc71']} style={modalStyles.nextBtnGrad}>
                  <ThemedText style={modalStyles.nextBtnText}>Next → Pickup Address</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={modalStyles.body} showsVerticalScrollIndicator={false}>
              <ThemedText style={modalStyles.instruction}>
                📍 Where should we pick up the device?
              </ThemedText>

              <TextInput
                style={modalStyles.addressInput}
                placeholder="e.g. 42, Sector 15, Gurugram, Haryana - 122001"
                placeholderTextColor="#88a08b"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
              />

              <View style={modalStyles.summaryBox}>
                <ThemedText style={modalStyles.summaryTitle}>📦 Pickup Summary</ThemedText>
                {answers.map((a, i) => (
                  <View key={i} style={modalStyles.summaryRow}>
                    <ThemedText style={modalStyles.summaryQ} numberOfLines={1}>{a.question}</ThemedText>
                    <ThemedText style={[
                      modalStyles.summaryA,
                      a.answer === 'Yes' ? { color: '#ef5350' } : a.answer === 'No' ? { color: '#2ecc71' } : { color: '#ff9800' },
                    ]}>{a.answer}</ThemedText>
                  </View>
                ))}
                <View style={[modalStyles.summaryRow, { borderTopWidth: 1, borderTopColor: 'rgba(46,204,113,0.2)', marginTop: 8, paddingTop: 10 }]}>
                  <ThemedText style={modalStyles.summaryQ}>Estimated Recycle Value</ThemedText>
                  <ThemedText style={[modalStyles.summaryA, { color: '#2ecc71', fontSize: 16, fontWeight: '900' }]}>
                    ₹{device.recycleValueINR.toLocaleString('en-IN')}
                  </ThemedText>
                </View>
              </View>

              <View style={modalStyles.actionRow}>
                <TouchableOpacity style={modalStyles.backBtn} onPress={() => setStep(0)}>
                  <ThemedText style={modalStyles.backBtnText}>← Back</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalStyles.confirmBtn, !address.trim() && { opacity: 0.4 }]}
                  onPress={() => onConfirm(answers, address.trim())}
                  disabled={!address.trim()}
                >
                  <LinearGradient colors={['#1b5e20', '#2ecc71']} style={modalStyles.confirmBtnGrad}>
                    <MaterialIcons name="check-circle" size={18} color="#fff" />
                    <ThemedText style={modalStyles.confirmBtnText}>Confirm Pickup</ThemedText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d1a0d',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.92,
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.2)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, paddingTop: 24,
  },
  headerEmoji: { fontSize: 32 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 6 },
  body: { padding: 20, paddingBottom: 40 },
  instruction: {
    color: '#88a08b', fontSize: 13, lineHeight: 20,
    marginBottom: 20, fontWeight: '600',
  },
  qBlock: {
    marginBottom: 22,
    backgroundColor: 'rgba(46,204,113,0.05)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.1)',
  },
  question: { color: '#e2f5e6', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 12 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  optBtnActive: { borderColor: 'transparent' },
  optText: { color: '#88a08b', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  nextBtn: { marginTop: 10, borderRadius: 18, overflow: 'hidden' },
  nextBtnGrad: { padding: 18, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  addressInput: {
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)',
    borderRadius: 16, padding: 16,
    color: '#e2f5e6', fontSize: 14, lineHeight: 22,
    minHeight: 90, textAlignVertical: 'top',
    marginBottom: 20,
  },
  summaryBox: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.15)',
    marginBottom: 24,
  },
  summaryTitle: { color: '#2ecc71', fontWeight: '900', fontSize: 14, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryQ: { color: '#88a08b', fontSize: 11, flex: 1, marginRight: 8 },
  summaryA: { fontSize: 12, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1, padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  backBtnText: { color: '#88a08b', fontWeight: '800', fontSize: 15 },
  confirmBtn: { flex: 2, borderRadius: 16, overflow: 'hidden' },
  confirmBtnGrad: {
    flexDirection: 'row', gap: 8, padding: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

// ─── Saved Pickup Card ─────────────────────────────────────────────────────────
function PickupCard({ pickup, onCancel }: { pickup: SavedPickup; onCancel: () => void }) {
  const isCancelled = pickup.status === 'Cancelled';
  const deviceAge = currentYear - pickup.device.estimatedYear;

  return (
    <View style={[pcStyles.card, isCancelled && pcStyles.cardCancelled]}>
      <View style={pcStyles.topRow}>
        <Image source={{ uri: pickup.imageUri }} style={pcStyles.thumb} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText style={pcStyles.deviceName} numberOfLines={1}>
            {CATEGORY_ICONS[pickup.device.category]} {pickup.device.brand} {pickup.device.deviceName}
          </ThemedText>
          <ThemedText style={pcStyles.deviceMeta}>
            ~{pickup.device.estimatedYear} • {deviceAge}yr old • {pickup.device.category}
          </ThemedText>
          <View style={[pcStyles.statusBadge, isCancelled ? pcStyles.statusCancelled : pcStyles.statusConfirmed]}>
            <ThemedText style={pcStyles.statusText}>
              {isCancelled ? '❌ Cancelled' : '✅ Pickup Confirmed'}
            </ThemedText>
          </View>
        </View>
      </View>

      {!isCancelled && (
        <View style={pcStyles.detailsRow}>
          <View style={pcStyles.detail}>
            <ThemedText style={pcStyles.detailLabel}>💰 Recycle Value</ThemedText>
            <ThemedText style={pcStyles.detailValue}>₹{pickup.device.recycleValueINR.toLocaleString('en-IN')}</ThemedText>
          </View>
          <View style={pcStyles.detail}>
            <ThemedText style={pcStyles.detailLabel}>📍 Address</ThemedText>
            <ThemedText style={pcStyles.detailValue} numberOfLines={1}>{pickup.address}</ThemedText>
          </View>
          <View style={pcStyles.detail}>
            <ThemedText style={pcStyles.detailLabel}>📅 Scheduled</ThemedText>
            <ThemedText style={pcStyles.detailValue}>
              {pickup.scheduledAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · 24hr window
            </ThemedText>
          </View>
        </View>
      )}

      {!isCancelled && (
        <TouchableOpacity
          style={pcStyles.cancelBtn}
          onPress={() =>
            Alert.alert(
              'Cancel Pickup',
              `Are you sure you want to cancel the pickup for your ${pickup.device.brand} ${pickup.device.deviceName}?`,
              [
                { text: 'Keep it', style: 'cancel' },
                { text: 'Yes, Cancel', style: 'destructive', onPress: onCancel },
              ]
            )
          }
        >
          <MaterialIcons name="cancel" size={14} color="#ef5350" />
          <ThemedText style={pcStyles.cancelBtnText}>Cancel Pickup</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const pcStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
  },
  cardCancelled: {
    opacity: 0.5,
    borderColor: 'rgba(239,83,80,0.2)',
    backgroundColor: 'rgba(239,83,80,0.04)',
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#1a2a1a' },
  deviceName: { color: '#e2f5e6', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  deviceMeta: { color: '#88a08b', fontSize: 11, fontWeight: '600', marginBottom: 8 },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10,
  },
  statusConfirmed: { backgroundColor: 'rgba(46,204,113,0.2)' },
  statusCancelled: { backgroundColor: 'rgba(239,83,80,0.2)' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  detailsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  detail: {
    flex: 1, backgroundColor: 'rgba(46,204,113,0.05)',
    borderRadius: 10, padding: 8,
  },
  detailLabel: { color: '#4caf50', fontSize: 9, fontWeight: '700', marginBottom: 3, letterSpacing: 0.3 },
  detailValue: { color: '#e2f5e6', fontSize: 11, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,83,80,0.3)',
    backgroundColor: 'rgba(239,83,80,0.08)',
  },
  cancelBtnText: { color: '#ef5350', fontSize: 12, fontWeight: '800' },
});

// ─── Main Scanner Screen ───────────────────────────────────────────────────────
export default function ScanScreen() {
  const router = useRouter();
  const { addDevice } = useGlobalStore();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // UI State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Scan result
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [result, setResult] = useState<DeviceResult | null>(null);

  // Animations
  const resultAnim = useRef(new Animated.Value(0)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (result) {
      Animated.parallel([
        Animated.spring(resultAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.timing(buttonsAnim, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
      ]).start();
    } else {
      resultAnim.setValue(0);
      buttonsAnim.setValue(0);
    }
  }, [result]);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan devices.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
    setCameraOpen(false);
    setScannedImage(photo.uri);
    await analyzeImage(photo.base64!);
  };

  // ── Gallery ──────────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) {
      setScannedImage(res.assets[0].uri);
      await analyzeImage(res.assets[0].base64!);
    }
  };

  // ── AI Analysis ───────────────────────────────────────────────────────────────
  const analyzeImage = async (base64: string) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ecycle.app',
          'X-Title': 'E-Cycle App',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are an expert e-waste analyst. Analyze this image of an electronic device.

Return ONLY valid JSON, no markdown, no explanation:
{
  "deviceName": "specific model name e.g. iPhone 11, ThinkPad T440",
  "brand": "brand name e.g. Apple, Lenovo, Samsung",
  "category": "one of: Smartphone, Laptop, Tablet, TV, Camera, Gaming Console, Desktop, Printer, Audio, Other",
  "estimatedYear": year as number (e.g. 2018),
  "summary": "2-sentence description of device and its e-waste significance",
  "recycleValueINR": estimated cash value in Indian Rupees as integer (e.g. 2500),
  "toxicComponents": ["list", "of", "3-5", "toxic", "materials", "in", "this", "device"]
}

If the image doesn't show an electronic device, still return valid JSON but set deviceName to "Unknown Device", estimatedYear to 2015, and recycleValueINR to 500.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      const raw = data?.choices?.[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json|```/g, '').trim();

      let parsed: DeviceResult;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {
          deviceName: 'Unknown Device',
          brand: 'Unknown',
          category: 'Other',
          estimatedYear: 2015,
          summary: 'Could not fully analyze the device. It may still contain recyclable components.',
          recycleValueINR: 300,
          toxicComponents: ['Lead', 'Mercury', 'Cadmium'],
        };
      }

      setResult(parsed);
    } catch (err) {
      Alert.alert('Scan Failed', 'Could not analyze the image. Check your internet connection and API key.');
      setScannedImage(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const resetScan = () => {
    setResult(null);
    setScannedImage(null);
  };

  // ── Add device to global store once, then navigate to community for condition assessment ──
  const addDeviceAndAssess = useCallback(() => {
    if (!result) return;

    const categoryToType = (cat: DeviceResult['category']): string => {
      const map: Record<string, string> = {
        Smartphone: 'phone', Laptop: 'laptop', Tablet: 'phone',
        TV: 'tv', Camera: 'accessory', 'Gaming Console': 'accessory',
        Desktop: 'laptop', Printer: 'appliance', Audio: 'accessory', Other: 'generic',
      };
      return map[cat] ?? 'generic';
    };

    addDevice({
      name: `${result.brand} ${result.deviceName}`.trim(),
      type: categoryToType(result.category) as any,
      condition: 'Pending assessment',
      isEwaste: isOldDevice(result.estimatedYear),
      source: 'scan',
      verdict: isOldDevice(result.estimatedYear) ? 'RECYCLE' : 'KEEP',
      yearManufactured: result.estimatedYear,
      aiScore: isOldDevice(result.estimatedYear) ? 45 : 78,
      pickupScheduled: false,
    });

    showToast(`✅ ${result.brand} ${result.deviceName} added! Complete the condition assessment next.`);
    const deviceName = `${result.brand} ${result.deviceName}`.trim();
    const deviceType = categoryToType(result.category);
    resetScan();
    router.push({ pathname: '/community', params: { fromScan: '1', deviceName, deviceType, isEwaste: isOldDevice(result.estimatedYear) ? '1' : '0' } });
  }, [result, addDevice, router]);

  const deviceAge = result ? currentYear - result.estimatedYear : 0;
  const old = result ? isOldDevice(result.estimatedYear) : false;

  // ── Camera View ───────────────────────────────────────────────────────────────
  if (cameraOpen) {
    return (
      <View style={styles.fullBlack}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* Viewfinder overlay */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <ScanLine />
          </View>
          <ThemedText style={styles.viewfinderHint}>
            Point at any electronic device
          </ThemedText>
        </View>

        {/* Controls */}
        <SafeAreaView style={styles.camControls} edges={['bottom']}>
          <TouchableOpacity style={styles.camClose} onPress={() => setCameraOpen(false)}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={capture}>
            <PulseRing />
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.camGallery} onPress={() => { setCameraOpen(false); pickFromGallery(); }}>
            <MaterialIcons name="photo-library" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.fullBlack}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>E-Waste Scanner</ThemedText>
            <ThemedText style={styles.pageSubtitle}>AI-powered device identification & recycling</ThemedText>
          </View>

          {/* ── Result Card (shown after scan) ── */}
          {(loading || result) && (
            <Animated.View
              style={[
                styles.resultCard,
                {
                  opacity: loading ? 1 : resultAnim,
                  transform: [{ translateY: loading ? 0 : resultAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
                },
              ]}
            >
              {/* Image */}
              {scannedImage && (
                <View style={styles.resultImageWrap}>
                  <Image source={{ uri: scannedImage }} style={styles.resultImage} />
                  <LinearGradient
                    colors={['transparent', 'rgba(10,20,10,0.95)']}
                    style={StyleSheet.absoluteFill}
                  />
                  {!loading && result && (
                    <View style={styles.resultImageOverlay}>
                      <ThemedText style={styles.resultDeviceName}>
                        {CATEGORY_ICONS[result.category] || '♻️'} {result.brand} {result.deviceName}
                      </ThemedText>
                      <ThemedText style={styles.resultYear}>
                        ~{result.estimatedYear} · {deviceAge} years old
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#2ecc71" />
                  <ThemedText style={styles.loadingText}>Analyzing device with AI...</ThemedText>
                  <ThemedText style={styles.loadingSubText}>Identifying brand, model & recyclability</ThemedText>
                </View>
              ) : result ? (
                <View style={styles.resultBody}>

                  {/* Age Warning or OK badge */}
                  {old ? (
                    <LinearGradient colors={['rgba(239,83,80,0.15)', 'rgba(239,83,80,0.05)']} style={styles.ageBanner}>
                      <MaterialIcons name="warning" size={20} color="#ef5350" />
                      <ThemedText style={styles.ageBannerText}>
                        This device is <ThemedText style={{ color: '#ef5350', fontWeight: '900' }}>{deviceAge} years old</ThemedText> — it qualifies for immediate recycling pickup!
                      </ThemedText>
                    </LinearGradient>
                  ) : (
                    <View style={styles.ageBannerGood}>
                      <MaterialIcons name="check-circle" size={20} color="#2ecc71" />
                      <ThemedText style={styles.ageBannerGoodText}>
                        Device is {deviceAge} year{deviceAge !== 1 ? 's' : ''} old — relatively recent but still recyclable.
                      </ThemedText>
                    </View>
                  )}

                  {/* Summary */}
                  <ThemedText style={styles.resultSummary}>{result.summary}</ThemedText>

                  {/* Stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statVal}>₹{result.recycleValueINR.toLocaleString('en-IN')}</ThemedText>
                      <ThemedText style={styles.statLbl}>Recycle Value</ThemedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statVal}>{result.category}</ThemedText>
                      <ThemedText style={styles.statLbl}>Category</ThemedText>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <ThemedText style={styles.statVal}>{deviceAge}yr</ThemedText>
                      <ThemedText style={styles.statLbl}>Age</ThemedText>
                    </View>
                  </View>

                  {/* Toxic Components */}
                  <View style={styles.toxicSection}>
                    <ThemedText style={styles.toxicTitle}>⚠️ Toxic Components</ThemedText>
                    <View style={styles.toxicChips}>
                      {result.toxicComponents.map((t, i) => (
                        <View key={i} style={styles.toxicChip}>
                          <ThemedText style={styles.toxicChipText}>{t}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.resultActions}>
                    {old && (
                      <TouchableOpacity
                        style={styles.scheduleBtn}
                        onPress={addDeviceAndAssess}
                      >
                        <LinearGradient colors={['#1b5e20', '#2ecc71']} style={styles.scheduleBtnGrad}>
                          <MaterialIcons name="local-shipping" size={20} color="#fff" />
                          <ThemedText style={styles.scheduleBtnText}>Schedule Free Pickup</ThemedText>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    {!old && (
                      <TouchableOpacity
                        style={styles.scheduleBtn}
                        onPress={addDeviceAndAssess}
                      >
                        <LinearGradient colors={['#1b5e20', '#2ecc71']} style={styles.scheduleBtnGrad}>
                          <MaterialIcons name="local-shipping" size={20} color="#fff" />
                          <ThemedText style={styles.scheduleBtnText}>Schedule Pickup Anyway</ThemedText>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.rescanBtn} onPress={resetScan}>
                      <MaterialIcons name="refresh" size={18} color="#88a08b" />
                      <ThemedText style={styles.rescanBtnText}>Scan Another</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          )}

          {/* ── Scan Buttons (always visible, move below result after scan) ── */}
          <Animated.View style={styles.scanButtonsWrap}>
            {!loading && (
              <>
                {!result && (
                  <ThemedText style={styles.scanPrompt}>
                    📸 Point your camera or select a photo to identify any electronic device
                  </ThemedText>
                )}
                <View style={styles.scanButtonsRow}>
                  <TouchableOpacity style={styles.mainScanBtn} onPress={openCamera}>
                    <LinearGradient colors={['#1b5e20', '#2ecc71']} style={styles.mainScanBtnGrad}>
                      <MaterialIcons name="camera-alt" size={28} color="#fff" />
                      <ThemedText style={styles.mainScanBtnText}>Camera</ThemedText>
                      <ThemedText style={styles.mainScanBtnSub}>Scan live</ThemedText>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
                    <MaterialIcons name="photo-library" size={28} color="#2ecc71" />
                    <ThemedText style={styles.galleryBtnText}>Gallery</ThemedText>
                    <ThemedText style={styles.galleryBtnSub}>Pick photo</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fullBlack: { flex: 1, backgroundColor: '#060d06' },
  scroll: { paddingHorizontal: 18, paddingTop: 16 },

  // Header
  pageHeader: { marginBottom: 24 },
  pageTitle: { fontSize: 30, fontWeight: '900', color: '#e2f5e6', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: '#4caf50', fontWeight: '600', marginTop: 4 },

  // Camera
  viewfinderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewfinder: {
    width: width * 0.75, height: width * 0.75,
    position: 'relative', overflow: 'hidden',
  },
  corner: {
    position: 'absolute', width: 32, height: 32,
    borderColor: '#2ecc71', borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  viewfinderHint: { color: '#2ecc71', fontWeight: '700', marginTop: 20, fontSize: 14 },
  camControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 40, paddingBottom: 20,
  },
  camClose: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  camGallery: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  captureButton: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: '#2ecc71',
  },
  captureInner: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: '#2ecc71',
    shadowColor: '#2ecc71', shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
  },

  // Scan prompt & buttons
  scanPrompt: {
    color: '#88a08b', fontSize: 13, fontWeight: '600', lineHeight: 20,
    textAlign: 'center', marginBottom: 20,
  },
  scanButtonsWrap: { marginBottom: 24 },
  scanButtonsRow: { flexDirection: 'row', gap: 14 },
  mainScanBtn: { flex: 2, borderRadius: 22, overflow: 'hidden' },
  mainScanBtnGrad: {
    padding: 22, alignItems: 'center', gap: 4,
    shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  mainScanBtnText: { color: '#fff', fontWeight: '900', fontSize: 17, marginTop: 4 },
  mainScanBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  galleryBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: 22, padding: 22,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(46,204,113,0.3)',
  },
  galleryBtnText: { color: '#2ecc71', fontWeight: '900', fontSize: 15 },
  galleryBtnSub: { color: '#4caf50', fontSize: 11, fontWeight: '600' },

  // Result Card
  resultCard: {
    backgroundColor: '#0d1a0d',
    borderRadius: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
    marginBottom: 20,
  },
  resultImageWrap: { height: 180, position: 'relative' },
  resultImage: { width: '100%', height: 180, resizeMode: 'cover' },
  resultImageOverlay: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  resultDeviceName: { color: '#fff', fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  resultYear: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', marginTop: 3 },
  loadingBox: { padding: 40, alignItems: 'center', gap: 12 },
  loadingText: { color: '#2ecc71', fontSize: 16, fontWeight: '800' },
  loadingSubText: { color: '#88a08b', fontSize: 12, fontWeight: '600' },
  resultBody: { padding: 18 },

  // Age banner
  ageBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(239,83,80,0.25)',
  },
  ageBannerText: { flex: 1, color: '#ffcdd2', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  ageBannerGood: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderRadius: 14, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
  },
  ageBannerGoodText: { flex: 1, color: '#a5d6a7', fontSize: 13, fontWeight: '600' },

  resultSummary: { color: '#9ca8a0', fontSize: 13, lineHeight: 21, marginBottom: 16 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(46,204,113,0.06)',
    borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.12)',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: '#2ecc71', fontSize: 16, fontWeight: '900' },
  statLbl: { color: '#88a08b', fontSize: 10, fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: 'rgba(46,204,113,0.15)' },

  // Toxic
  toxicSection: { marginBottom: 18 },
  toxicTitle: { color: '#ef9a9a', fontSize: 12, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  toxicChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  toxicChip: {
    backgroundColor: 'rgba(239,83,80,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,83,80,0.25)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  toxicChipText: { color: '#ef9a9a', fontSize: 11, fontWeight: '700' },

  // Result actions
  resultActions: { gap: 10 },
  scheduleBtn: { borderRadius: 18, overflow: 'hidden' },
  scheduleBtnGrad: {
    flexDirection: 'row', gap: 10, padding: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2ecc71', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  scheduleBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  rescanBtn: {
    flexDirection: 'row', gap: 8, padding: 14,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rescanBtnText: { color: '#88a08b', fontWeight: '700', fontSize: 14 },

  // Pickups Section
  pickupsSection: { marginBottom: 20 },
  pickupsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  pickupsTitle: { color: '#e2f5e6', fontSize: 20, fontWeight: '900' },
  pickupCountBadge: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.3)',
  },
  pickupCountText: { color: '#2ecc71', fontSize: 11, fontWeight: '800' },
});