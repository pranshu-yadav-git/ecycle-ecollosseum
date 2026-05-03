import { useAuth } from '@/app/_layout';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalStore } from '../../lib/global-store';

const { width } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Device {
  id: string;
  name: string;
  brand: string;
  category: string;
  priceINR: number;
  originalPriceINR: number;
  condition: 'Excellent' | 'Good' | 'Fair';
  trend: string;
  trendUp: boolean;
  specs: string;
  batteryHealth: number;
  warranty: string;
  recycleValueINR: number;
  emoji: string;
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({
  visible,
  onClose,
  price,
  isDark,
  onOrderSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  price: number;
  isDark: boolean;
  onOrderSuccess: () => void;
}) {
  const [step, setStep] = useState<'address' | 'method'>('address');
  const [method, setMethod] = useState<'upi' | 'card' | 'cod' | null>(null);

  const [addrDetails, setAddrDetails] = useState({ street: '', city: '', state: '', zip: '' });
  const [upiId, setUpiId] = useState('');
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '', name: '' });

  const formatExpiry = (text: string) => {
    let cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    return cleaned;
  };

  const handleNext = () => {
    if (step === 'address') {
      const isZipValid = /^\d{6}$/.test(addrDetails.zip);
      if (!addrDetails.street || !addrDetails.city || !addrDetails.state)
        return Alert.alert('Missing Info', 'Please fill in all address details.');
      if (!isZipValid)
        return Alert.alert('Invalid Pincode', 'Pincode must be exactly 6 digits.');
      setStep('method');
    } else {
      if (!method) return Alert.alert('Selection Required', 'Please select a payment method.');
      if (method === 'upi') {
        const upiLower = upiId.toLowerCase();
        if (!upiLower.endsWith('@upi') && !upiLower.endsWith('@ybl'))
          return Alert.alert('Invalid UPI ID', 'UPI ID must end with @upi or @ybl');
      }
      if (method === 'card') {
        if (cardDetails.number.length < 16) return Alert.alert('Invalid Card', 'Card number must be 16 digits.');
        if (cardDetails.expiry.length < 5) return Alert.alert('Invalid Expiry', 'Enter expiry as MM/YY.');
        if (cardDetails.cvv.length < 3) return Alert.alert('Invalid CVV', 'CVV must be 3 digits.');
      }
      onOrderSuccess();
      onClose();
    }
  };

  const codDisabled = price > 15000;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.content, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
          <View style={modalStyles.header}>
            <ThemedText style={modalStyles.title}>
              {step === 'address' ? 'Delivery Address' : 'Payment Method'}
            </ThemedText>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {step === 'address' ? (
              <View style={modalStyles.form}>
                <TextInput
                  style={[modalStyles.input, { color: isDark ? '#fff' : '#000' }]}
                  placeholder="Street Address"
                  placeholderTextColor="#88a08b"
                  value={addrDetails.street}
                  onChangeText={(t) => setAddrDetails({ ...addrDetails, street: t })}
                />
                <TextInput
                  style={[modalStyles.input, { color: isDark ? '#fff' : '#000' }]}
                  placeholder="City"
                  placeholderTextColor="#88a08b"
                  value={addrDetails.city}
                  onChangeText={(t) => setAddrDetails({ ...addrDetails, city: t })}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={[modalStyles.input, { flex: 1, color: isDark ? '#fff' : '#000' }]}
                    placeholder="State"
                    placeholderTextColor="#88a08b"
                    value={addrDetails.state}
                    onChangeText={(t) => setAddrDetails({ ...addrDetails, state: t })}
                  />
                  <TextInput
                    style={[modalStyles.input, { flex: 1, color: isDark ? '#fff' : '#000' }]}
                    placeholder="Postal Code"
                    placeholderTextColor="#88a08b"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={addrDetails.zip}
                    onChangeText={(t) => setAddrDetails({ ...addrDetails, zip: t })}
                  />
                </View>
              </View>
            ) : (
              <View style={modalStyles.optionsContainer}>
                {/* UPI */}
                <TouchableOpacity
                  style={[modalStyles.option, method === 'upi' && modalStyles.optionActive]}
                  onPress={() => setMethod('upi')}
                >
                  <ThemedText style={modalStyles.optionText}>1. UPI</ThemedText>
                  {method === 'upi' && (
                    <TextInput
                      style={[modalStyles.innerInput, { flex: 1, color: isDark ? '#fff' : '#000' }]}
                      placeholder="Enter UPI ID"
                      placeholderTextColor="#88a08b"
                      autoCapitalize="none"
                      value={upiId}
                      onChangeText={setUpiId}
                    />
                  )}
                </TouchableOpacity>

                {/* Card */}
                <TouchableOpacity
                  style={[modalStyles.option, method === 'card' && modalStyles.optionActive]}
                  onPress={() => setMethod('card')}
                >
                  <ThemedText style={modalStyles.optionText}>2. Credit / Debit Card</ThemedText>
                  {method === 'card' && (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <TextInput
                        style={[modalStyles.innerInput, { color: isDark ? '#fff' : '#000' }]}
                        placeholder="Card Number (16 digits)"
                        placeholderTextColor="#88a08b"
                        keyboardType="number-pad"
                        maxLength={16}
                        value={cardDetails.number}
                        onChangeText={(t) => setCardDetails({ ...cardDetails, number: t })}
                      />
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          style={[modalStyles.innerInput, { flex: 1, color: isDark ? '#fff' : '#000' }]}
                          placeholder="MM/YY"
                          placeholderTextColor="#88a08b"
                          keyboardType="number-pad"
                          maxLength={5}
                          value={cardDetails.expiry}
                          onChangeText={(t) => setCardDetails({ ...cardDetails, expiry: formatExpiry(t) })}
                        />
                        <TextInput
                          style={[modalStyles.innerInput, { flex: 1, color: isDark ? '#fff' : '#000' }]}
                          placeholder="CVV"
                          placeholderTextColor="#88a08b"
                          keyboardType="number-pad"
                          maxLength={3}
                          secureTextEntry
                          value={cardDetails.cvv}
                          onChangeText={(t) => setCardDetails({ ...cardDetails, cvv: t })}
                        />
                      </View>
                      <TextInput
                        style={[modalStyles.innerInput, { color: isDark ? '#fff' : '#000' }]}
                        placeholder="Name on Card"
                        placeholderTextColor="#88a08b"
                        value={cardDetails.name}
                        onChangeText={(t) => setCardDetails({ ...cardDetails, name: t })}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* COD */}
                <TouchableOpacity
                  style={[
                    modalStyles.option,
                    method === 'cod' && modalStyles.optionActive,
                    codDisabled && modalStyles.optionDisabled,
                  ]}
                  onPress={() => !codDisabled && setMethod('cod')}
                  disabled={codDisabled}
                >
                  <ThemedText style={[modalStyles.optionText, codDisabled && { color: '#888' }]}>
                    3. Cash on Delivery {codDisabled ? '(unavailable above ₹15,000)' : ''}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <ThemedText style={modalStyles.cancelText}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.nextBtn} onPress={handleNext}>
              <ThemedText style={modalStyles.nextText}>
                {step === 'address' ? 'Next →' : '✓ Place Order'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '900' },
  form: { gap: 12 },
  input: { borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: 'rgba(46,204,113,0.04)' },
  optionsContainer: { gap: 10 },
  option: { borderWidth: 1, borderColor: '#ddd', borderRadius: 14, padding: 14 },
  optionActive: { borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.06)' },
  optionDisabled: { opacity: 0.4 },
  optionText: { fontWeight: '700', fontSize: 15 },
  innerInput: { borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)', borderRadius: 10, padding: 10, fontSize: 14, marginTop: 4, backgroundColor: 'rgba(46,204,113,0.04)' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelText: { fontWeight: '700', fontSize: 15 },
  nextBtn: { flex: 2, padding: 15, borderRadius: 14, backgroundColor: '#2ecc71', alignItems: 'center' },
  nextText: { fontWeight: '900', fontSize: 15, color: '#000' },
});

// ─── Devices data ─────────────────────────────────────────────────────────────
const ALL_DEVICES: Device[] = [
  { id: '1', name: 'iPhone 13 Pro', brand: 'Apple', category: 'Smartphone', priceINR: 52000, originalPriceINR: 119900, condition: 'Excellent', trend: '+2.1%', trendUp: true, specs: 'A15 Bionic · 256GB · 6.1" ProMotion', batteryHealth: 92, warranty: '6 months', recycleValueINR: 18000, emoji: '📱' },
  { id: '2', name: 'MacBook Air M1', brand: 'Apple', category: 'Laptop', priceINR: 61000, originalPriceINR: 114900, condition: 'Good', trend: '-0.8%', trendUp: false, specs: 'M1 · 8GB RAM · 256GB SSD', batteryHealth: 87, warranty: '3 months', recycleValueINR: 22000, emoji: '💻' },
  { id: '3', name: 'Samsung Galaxy S21', brand: 'Samsung', category: 'Smartphone', priceINR: 28500, originalPriceINR: 69999, condition: 'Good', trend: '+1.5%', trendUp: true, specs: 'Exynos 2100 · 128GB · 6.2" AMOLED', batteryHealth: 84, warranty: '6 months', recycleValueINR: 9000, emoji: '📱' },
  { id: '4', name: 'iPad Air 4', brand: 'Apple', category: 'Tablet', priceINR: 39000, originalPriceINR: 64900, condition: 'Excellent', trend: '+3.2%', trendUp: true, specs: 'A14 Bionic · 64GB · 10.9" Liquid Retina', batteryHealth: 95, warranty: '6 months', recycleValueINR: 14000, emoji: '📱' },
  { id: '5', name: 'Sony WH-1000XM4', brand: 'Sony', category: 'Audio', priceINR: 12000, originalPriceINR: 29990, condition: 'Excellent', trend: '+0.5%', trendUp: true, specs: 'ANC · 30hr battery · LDAC', batteryHealth: 98, warranty: '3 months', recycleValueINR: 3500, emoji: '🎧' },
  { id: '6', name: 'OnePlus 9 Pro', brand: 'OnePlus', category: 'Smartphone', priceINR: 24000, originalPriceINR: 64999, condition: 'Good', trend: '-1.2%', trendUp: false, specs: 'SD888 · 256GB · 6.7" 120Hz AMOLED', batteryHealth: 81, warranty: '3 months', recycleValueINR: 8000, emoji: '📱' },
  { id: '7', name: 'Dell XPS 15', brand: 'Dell', category: 'Laptop', priceINR: 72000, originalPriceINR: 159990, condition: 'Good', trend: '+1.8%', trendUp: true, specs: 'i7-11th · 16GB · 512GB NVMe · 4K OLED', batteryHealth: 79, warranty: '3 months', recycleValueINR: 28000, emoji: '💻' },
  { id: '8', name: 'Apple Watch Series 7', brand: 'Apple', category: 'Wearable', priceINR: 18500, originalPriceINR: 41900, condition: 'Excellent', trend: '+0.9%', trendUp: true, specs: '45mm · GPS + Cellular · Retina Always-On', batteryHealth: 93, warranty: '6 months', recycleValueINR: 6500, emoji: '⌚' },
  { id: '9', name: 'Canon EOS M50 II', brand: 'Canon', category: 'Camera', priceINR: 31000, originalPriceINR: 59990, condition: 'Good', trend: '-0.3%', trendUp: false, specs: '24MP APS-C · 4K · Eye AF · Flip Screen', batteryHealth: 88, warranty: '6 months', recycleValueINR: 11000, emoji: '📷' },
  { id: '10', name: 'Nintendo Switch OLED', brand: 'Nintendo', category: 'Gaming', priceINR: 22000, originalPriceINR: 34999, condition: 'Fair', trend: '+4.1%', trendUp: true, specs: '7" OLED · 64GB · Joy-Con included', batteryHealth: 76, warranty: '1 month', recycleValueINR: 7000, emoji: '🎮' },
  { id: '11', name: 'Google Pixel 6a', brand: 'Google', category: 'Smartphone', priceINR: 18000, originalPriceINR: 43999, condition: 'Excellent', trend: '+2.7%', trendUp: true, specs: 'Tensor · 128GB · 6.1" OLED', batteryHealth: 94, warranty: '6 months', recycleValueINR: 7000, emoji: '📱' },
  { id: '12', name: 'Smart LED TV 43"', brand: 'Mi', category: 'Smart Home', priceINR: 17500, originalPriceINR: 35999, condition: 'Good', trend: '-2.1%', trendUp: false, specs: '4K UHD · Android TV · Dolby Audio', batteryHealth: 100, warranty: '3 months', recycleValueINR: 4500, emoji: '📺' },
];

const CATEGORIES = ['All', 'Smartphone', 'Laptop', 'Tablet', 'Wearable', 'Audio', 'Camera', 'Gaming', 'Smart Home'];

function ConditionBadge({ condition }: { condition: string }) {
  const colors: Record<string, [string, string]> = {
    'Excellent': ['#1b5e20', '#2ecc71'],
    'Good': ['#e65100', '#ff9800'],
    'Fair': ['#b71c1c', '#ef5350'],
  };
  const [from, to] = colors[condition] || ['#333', '#666'];
  return (
    <LinearGradient colors={[from, to]} style={badgeStyle.badge}>
      <ThemedText style={badgeStyle.text}>{condition}</ThemedText>
    </LinearGradient>
  );
}
const badgeStyle = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  text: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

function DeviceCard({
  device, isDark, onBuy, onRecycle,
}: {
  device: Device; isDark: boolean; onBuy: () => void; onRecycle: () => void;
}) {
  const discount = Math.round(((device.originalPriceINR - device.priceINR) / device.originalPriceINR) * 100);
  const cardBg = isDark ? 'rgba(46,204,113,0.06)' : '#fff';
  const cardBorder = isDark ? 'rgba(46,204,113,0.15)' : '#e8f5e9';

  return (
    <View style={[cardStyle.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={cardStyle.topRow}>
        <View style={cardStyle.emojiWrap}>
          <ThemedText style={cardStyle.emoji}>{device.emoji}</ThemedText>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText style={[cardStyle.name, { color: isDark ? '#fff' : '#1b3a20' }]} numberOfLines={1}>{device.name}</ThemedText>
          <ThemedText style={cardStyle.brand}>{device.brand} · {device.category}</ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ConditionBadge condition={device.condition} />
          <ThemedText style={[cardStyle.trend, { color: device.trendUp ? '#2ecc71' : '#ef5350' }]}>
            {device.trendUp ? '▲' : '▼'} {device.trend}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={cardStyle.specs}>{device.specs}</ThemedText>
      <View style={cardStyle.statsRow}>
        <View style={cardStyle.stat}>
          <ThemedText style={cardStyle.statLabel}>Battery</ThemedText>
          <View style={cardStyle.batteryBar}>
            <View style={[cardStyle.batteryFill, { width: `${device.batteryHealth}%` as any, backgroundColor: device.batteryHealth > 90 ? '#2ecc71' : device.batteryHealth > 80 ? '#ff9800' : '#ef5350' }]} />
          </View>
          <ThemedText style={[cardStyle.statValue, { color: '#2ecc71' }]}>{device.batteryHealth}%</ThemedText>
        </View>
        <View style={cardStyle.stat}>
          <ThemedText style={cardStyle.statLabel}>Warranty</ThemedText>
          <ThemedText style={cardStyle.statValue}>{device.warranty}</ThemedText>
        </View>
        <View style={cardStyle.stat}>
          <ThemedText style={cardStyle.statLabel}>Recycle ₹</ThemedText>
          <ThemedText style={[cardStyle.statValue, { color: '#2ecc71' }]}>₹{device.recycleValueINR.toLocaleString('en-IN')}</ThemedText>
        </View>
      </View>
      <View style={cardStyle.priceRow}>
        <View>
          <ThemedText style={cardStyle.price}>₹{device.priceINR.toLocaleString('en-IN')}</ThemedText>
          <ThemedText style={cardStyle.originalPrice}>MRP ₹{device.originalPriceINR.toLocaleString('en-IN')}</ThemedText>
        </View>
        <View style={cardStyle.discountBadge}>
          <ThemedText style={cardStyle.discountText}>{discount}% OFF</ThemedText>
        </View>
        <View style={cardStyle.actions}>
          <TouchableOpacity style={cardStyle.recycleBtn} onPress={onRecycle}>
            <ThemedText style={cardStyle.recycleBtnText}>♻️</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={cardStyle.buyBtn} onPress={onBuy}>
            <ThemedText style={cardStyle.buyBtnText}>BUY</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
      {/* Eco points badge */}
      <View style={cardStyle.ecoPointsBadge}>
        <ThemedText style={cardStyle.ecoPointsText}>🌿 +120 eco pts on purchase</ThemedText>
      </View>
    </View>
  );
}

const cardStyle = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12, elevation: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  emojiWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(46,204,113,0.12)', justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 24 },
  name: { fontSize: 15, fontWeight: '800' },
  brand: { fontSize: 11, color: '#88a08b' },
  trend: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  specs: { fontSize: 12, color: '#88a08b', marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: '#88a08b', fontWeight: '700' },
  statValue: { fontSize: 12, fontWeight: '800' },
  batteryBar: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2 },
  batteryFill: { height: 4, borderRadius: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 20, fontWeight: '900', color: '#2ecc71' },
  originalPrice: { fontSize: 11, color: '#88a08b', textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: 'rgba(46,204,113,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  discountText: { color: '#2ecc71', fontSize: 11, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  recycleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(46,204,113,0.12)', justifyContent: 'center', alignItems: 'center' },
  recycleBtnText: { fontSize: 16 },
  buyBtn: { backgroundColor: '#2ecc71', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  buyBtnText: { color: '#fff', fontWeight: '900' },
  ecoPointsBadge: { marginTop: 10, backgroundColor: 'rgba(46,204,113,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  ecoPointsText: { fontSize: 11, color: '#2ecc71', fontWeight: '700' },
});

// ─── Market Screen ────────────────────────────────────────────────────────────
export default function MarketScreen() {
  const { isDark } = useAuth();
  const { purchaseDevice, ecoPoints } = useGlobalStore();

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Device | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = useMemo(() => {
    let data = ALL_DEVICES;
    if (selectedCat !== 'All') data = data.filter((d) => d.category === selectedCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((d) => d.name.toLowerCase().includes(q) || d.brand.toLowerCase().includes(q) || d.specs.toLowerCase().includes(q));
    }
    return data;
  }, [search, selectedCat]);

  const handleOrderSuccess = () => {
    if (!selectedProduct) return;
    purchaseDevice({
      name: selectedProduct.name,
      emoji: selectedProduct.emoji,
      priceINR: selectedProduct.priceINR,
      category: selectedProduct.category,
    });
    Alert.alert(
      '✅ Order Placed!',
      `${selectedProduct.name} has been added to Your Devices on the home screen.\n\n🌿 +120 eco points earned!`,
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0a0f0a' : '#f8fffe' }} edges={['top']}>
      <LinearGradient colors={isDark ? ['#0d1f0d', '#0a160a'] : ['#e8f5e9', '#f1fdf2']} style={styles.header}>
        <View style={styles.headerRow}>
          <ThemedText style={[styles.headerTitle, { color: isDark ? '#fff' : '#1b5e20' }]}>Market Index</ThemedText>
          {/* Live eco points badge */}
          <View style={styles.pointsBadge}>
            <ThemedText style={styles.pointsBadgeText}>🌿 {ecoPoints.toLocaleString()} pts</ThemedText>
          </View>
        </View>
        <View style={[styles.promoBox, { backgroundColor: isDark ? 'rgba(46,204,113,0.1)' : '#fff' }]}>
          <ThemedText style={[styles.promoText, { color: isDark ? '#2ecc71' : '#1b5e20' }]}>
            We offer exceptionally affordable refurbished devices at prices up to 10x lower than retail. Every purchase earns +120 eco points!
          </ThemedText>
        </View>
        <View style={styles.searchWrap}>
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#fff' : '#000' }]}
            placeholder="Search devices..."
            placeholderTextColor="#88a08b"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
              onPress={() => setSelectedCat(cat)}
            >
              <ThemedText style={[styles.catText, selectedCat === cat && styles.catTextActive]}>{cat}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            isDark={isDark}
            onBuy={() => { setSelectedProduct(item); setModalVisible(true); }}
            onRecycle={() => Alert.alert('♻️ Recycle', `Schedule pickup for ₹${item.recycleValueINR.toLocaleString('en-IN')}\n\nGo to the RecycleAI tab to schedule a pickup for this device.`)}
          />
        )}
      />

      {selectedProduct && (
        <PaymentModal
          visible={modalVisible}
          onClose={() => { setModalVisible(false); setSelectedProduct(null); }}
          price={selectedProduct.priceINR}
          isDark={isDark}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '900' },
  pointsBadge: { backgroundColor: 'rgba(46,204,113,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(46,204,113,0.3)' },
  pointsBadgeText: { fontSize: 12, fontWeight: '800', color: '#2ecc71' },
  promoBox: { padding: 12, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)' },
  promoText: { fontSize: 13, fontWeight: '600' },
  searchWrap: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { height: 45, fontSize: 14 },
  catScroll: { marginBottom: 0 },
  catContent: { paddingBottom: 14, gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.06)', borderWidth: 1, borderColor: 'transparent' },
  catChipActive: { backgroundColor: 'rgba(46,204,113,0.15)', borderColor: '#2ecc71' },
  catText: { fontSize: 12, fontWeight: '700', color: '#88a08b' },
  catTextActive: { color: '#2ecc71' },
  list: { padding: 16 },
});
