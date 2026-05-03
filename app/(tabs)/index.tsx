import { useAuth } from '@/app/_layout';
import { ProfileModal } from '@/components/ProfileModal';
import { ThemedText } from '@/components/themed-text';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalStore } from '../../lib/global-store';

const { width, height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.78;

interface ExtendedUser {
  name?: string;
  ecoPoints?: number;
  stats?: {
    discardedCount?: number;
    refurbishedBought?: number;
    co2Saved?: number;
    pickupsInitiated?: number;
    communityEvents?: number;
    devicesRegistered?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const isOld = (d: any) =>
  d.yearManufactured ? CURRENT_YEAR - d.yearManufactured >= 5 : false;

/* ─── BOTTOM SHEET ─── */
function EcoStatsSheet({
  visible,
  onClose,
  ecoPoints,
  deviceCount,
  user,
  pointHistory,
}: {
  visible: boolean;
  onClose: () => void;
  ecoPoints: number;
  deviceCount: number;
  user: ExtendedUser;
  pointHistory: { id: string; reason: string; points: number; at: number }[];
}) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 0,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  const s = user?.stats;
  const tier =
    ecoPoints >= 5000 ? { label: 'Platinum', color: '#a78bfa', bg: '#2d1b69' }
    : ecoPoints >= 2000 ? { label: 'Gold', color: '#fbbf24', bg: '#451a03' }
    : ecoPoints >= 500  ? { label: 'Silver', color: '#94a3b8', bg: '#1e293b' }
    :                     { label: 'Bronze', color: '#c07c4a', bg: '#1c1410' };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View {...panResponder.panHandlers} style={styles.sheetDragArea}>
          <View style={styles.sheetHandle} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll} bounces={false}>
          <View style={styles.sheetHeader}>
            <View>
              <ThemedText style={styles.sheetTitle}>Eco Profile</ThemedText>
              <ThemedText style={styles.sheetSub}>{user?.name?.split(' ')[0] || 'User'}'s sustainability journey</ThemedText>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
              <ThemedText style={[styles.tierText, { color: tier.color }]}>{tier.label}</ThemedText>
            </View>
          </View>

          <LinearGradient
            colors={['#064e3b', '#059669', '#34d399']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pointsHero}
          >
            <ThemedText style={styles.pointsHeroLabel}>TOTAL ECO-POINTS</ThemedText>
            <ThemedText style={styles.pointsHeroValue}>{ecoPoints.toLocaleString()}</ThemedText>
            <ThemedText style={styles.pointsHeroSub}>
              {5000 - ecoPoints > 0 ? `${(5000 - ecoPoints).toLocaleString()} pts to Platinum` : 'Max tier reached!'}
            </ThemedText>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.min((ecoPoints / 5000) * 100, 100)}%` }]} />
            </View>
          </LinearGradient>

          <View style={styles.statsGrid}>
            <StatCard icon="devices" iconLib="material" value={deviceCount} label="Devices Registered" accent="#34d399" />
            <StatCard icon="local-shipping" iconLib="material" value={s?.pickupsInitiated || 0} label="Pickups Initiated" accent="#60a5fa" />
            <StatCard icon="delete-sweep" iconLib="material" value={s?.discardedCount || 0} label="Devices Discarded" accent="#f87171" />
            <StatCard icon="refresh" iconLib="material" value={s?.refurbishedBought || 0} label="Refurbished Bought" accent="#a78bfa" />
          </View>

          <View style={styles.wideRow}>
            <View style={[styles.wideCard, { marginRight: 6 }]}>
              <View style={[styles.wideIconBox, { backgroundColor: '#fbbf2420' }]}>
                <MaterialIcons name="people" size={20} color="#fbbf24" />
              </View>
              <ThemedText style={styles.wideValue}>{s?.communityEvents || 0}</ThemedText>
              <ThemedText style={styles.wideLabel}>Community Events</ThemedText>
            </View>
            <View style={[styles.wideCard, { marginLeft: 6 }]}>
              <View style={[styles.wideIconBox, { backgroundColor: '#34d39920' }]}>
                <MaterialCommunityIcons name="leaf" size={20} color="#34d399" />
              </View>
              <ThemedText style={styles.wideValue}>{s?.co2Saved || 0} kg</ThemedText>
              <ThemedText style={styles.wideLabel}>CO₂ Saved</ThemedText>
            </View>
          </View>

          {/* Points History */}
          {pointHistory.length > 0 && (
            <>
              <ThemedText style={[styles.sheetSectionTitle, { marginTop: 16, marginBottom: 10 }]}>
                Recent Points
              </ThemedText>
              {pointHistory.slice(0, 6).map((evt) => (
                <View key={evt.id} style={styles.pointHistoryRow}>
                  <ThemedText style={styles.pointHistoryReason} numberOfLines={1}>{evt.reason}</ThemedText>
                  <ThemedText style={styles.pointHistoryPts}>+{evt.points} pts</ThemedText>
                </View>
              ))}
            </>
          )}

          <View style={styles.tipCard}>
            <MaterialIcons name="tips-and-updates" size={16} color="#fbbf24" />
            <ThemedText style={styles.tipText}>
              Scan a device to earn +50 pts. Schedule a pickup for e-waste to earn up to +350 pts!
            </ThemedText>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function StatCard({ icon, iconLib, value, label, accent }: { icon: string; iconLib: 'material' | 'community'; value: number | string; label: string; accent: string }) {
  const IconComp = iconLib === 'community' ? MaterialCommunityIcons : MaterialIcons;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: accent + '20' }]}>
        <IconComp name={icon as any} size={18} color={accent} />
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function FeatureTile({ label, icon, subText, accent, onPress }: { label: string; icon: string; subText: string; accent: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }], width: (width - 56) / 2 }}>
      <TouchableOpacity activeOpacity={1} onPress={press} style={styles.featureTile}>
        <View style={[styles.featureIconRing, { borderColor: accent + '40', backgroundColor: accent + '12' }]}>
          <MaterialIcons name={icon as any} size={22} color={accent} />
        </View>
        <ThemedText style={styles.featureTileLabel}>{label}</ThemedText>
        <ThemedText style={styles.featureTileSub}>{subText}</ThemedText>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ─── DEVICE ROW ─── */
function DeviceRow({ d, onSchedulePickup }: { d: any; onSchedulePickup: (id: string) => void }) {
  const old = isOld(d);
  const hasPickup = d.pickupScheduled;
  const isMarket = d.source === 'market';

  const verdictColor =
    d.verdict === 'KEEP' ? '#34d399'
    : d.verdict === 'REPAIR' ? '#fbbf24'
    : '#f87171';

  const typeEmoji =
    d.emoji ?? (d.type === 'phone' ? '📱' : d.type === 'laptop' ? '💻' : d.type === 'tv' ? '📺' : d.type === 'appliance' ? '🔌' : '⚡');

  return (
    <View style={[styles.deviceCard, old && styles.deviceCardOld]}>
      {/* Old device badge — top right */}
      {old && (
        <View style={styles.eWasteBadge}>
          <MaterialIcons name="warning" size={9} color="#fff" />
          <ThemedText style={styles.eWasteBadgeText}>Potential E-Waste</ThemedText>
        </View>
      )}

      <View style={styles.deviceCardInner}>
        {/* Left dot / emoji */}
        <View style={[styles.deviceIconBox, { backgroundColor: verdictColor + '20' }]}>
          <ThemedText style={styles.deviceEmoji}>{typeEmoji}</ThemedText>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <ThemedText style={styles.deviceCardName}>{d.name}</ThemedText>
          <View style={styles.deviceTagRow}>
            {isMarket && (
              <View style={styles.marketTag}>
                <ThemedText style={styles.marketTagText}>Refurbished</ThemedText>
              </View>
            )}
            {hasPickup && (
              <View style={styles.pickupTag}>
                <MaterialIcons name="local-shipping" size={9} color="#60a5fa" />
                <ThemedText style={styles.pickupTagText}>Pickup {d.pickupDate ? `· ${d.pickupDate}` : 'Scheduled'}</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.deviceCardMeta}>
            {d.condition}{d.aiScore ? ` · Score ${d.aiScore}` : ''}
          </ThemedText>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.deviceVerdict, { borderColor: verdictColor + '60', backgroundColor: verdictColor + '15' }]}>
            <ThemedText style={[styles.deviceVerdictText, { color: verdictColor }]}>{d.verdict || 'KEEP'}</ThemedText>
          </View>
          {old && !hasPickup && (
            <TouchableOpacity style={styles.schedulePickupBtn} onPress={() => onSchedulePickup(d.id)}>
              <MaterialIcons name="local-shipping" size={10} color="#fbbf24" />
              <ThemedText style={styles.schedulePickupText}>Schedule</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── QUICK STAT ─── */
function QuickStat({ value, unit, label, color }: any) {
  return (
    <View style={styles.quickStatItem}>
      <ThemedText style={[styles.quickStatValue, { color }]}>
        {value}{unit ? <ThemedText style={[styles.quickStatUnit, { color }]}>{unit}</ThemedText> : null}
      </ThemedText>
      <ThemedText style={styles.quickStatLabel}>{label}</ThemedText>
    </View>
  );
}

/* ─── MAIN SCREEN ─── */
export default function HomeScreen() {
  const { user: rawUser, isDark, setNavbarVisible } = useAuth();
  const user = rawUser as ExtendedUser;
  const router = useRouter();

  // ── Global store
  const { devices, pickups, ecoPoints, pointHistory, addDevice, addPickup } = useGlobalStore();

  const [isProfileVisible, setProfileVisible] = useState(false);
  const [isSheetVisible, setSheetVisible] = useState(false);

  React.useEffect(() => {
    setNavbarVisible(!isSheetVisible);
  }, [isSheetVisible]);

  const walletScale = useRef(new Animated.Value(1)).current;

  const bgGradient: [string, string] = isDark ? ['#030a05', '#071210'] : ['#f0faf4', '#e2f5ea'];

  const handleWalletPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(walletScale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(walletScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setSheetVisible(true);
  }, []);

  const handleSchedulePickup = (deviceId: string) => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return;

    Alert.alert(
      '📦 Schedule Pickup',
      `Schedule a pickup for "${device.name}"?\n\nThis old device may contain hazardous materials — proper recycling earns you bonus eco points!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Schedule',
          onPress: () => {
            addPickup({
              deviceId: device.id,
              deviceName: device.name,
              deviceType: device.type,
              isEwaste: device.isEwaste || isOld(device),
              address: 'To be confirmed',
              date: 'TBD',
              time: 'TBD',
              extraImages: [],
            });
            Alert.alert('✅ Pickup Requested', 'Go to the RecycleAI tab to fill in your address and time slot.');
          },
        },
      ]
    );
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'EC';

  const points = ecoPoints;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  // Stats derived from global store
  const pickupCount = pickups.length;
  const co2Saved = Math.round(pickups.length * 4.2 + devices.filter((d) => d.source === 'market').length * 2.1);

  return (
    <LinearGradient colors={bgGradient} style={styles.bg}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16}
        >
          {/* ── TOP BAR ── */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.greetingLabel}>{greeting}</ThemedText>
              <ThemedText style={styles.greetingName}>{user?.name?.split(' ')[0] || 'User'} 👋</ThemedText>
            </View>
            <TouchableOpacity onPress={() => setProfileVisible(true)} style={styles.avatarWrap}>
              <LinearGradient colors={['#059669', '#34d399']} style={styles.avatar}>
                <ThemedText style={styles.avatarText}>{initials}</ThemedText>
              </LinearGradient>
              <View style={styles.avatarOnline} />
            </TouchableOpacity>
          </View>

          {/* ── ECO-POINTS CARD ── */}
          <Animated.View style={{ transform: [{ scale: walletScale }] }}>
            <Pressable onPress={handleWalletPress}>
              <LinearGradient
                colors={['#052e16', '#065f46', '#059669']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.pointsCard}
              >
                <View style={styles.decorCircle1} />
                <View style={styles.decorCircle2} />

                <View style={styles.pointsCardTop}>
                  <View style={styles.pointsCardLabel}>
                    <MaterialCommunityIcons name="leaf" size={12} color="rgba(255,255,255,0.65)" />
                    <ThemedText style={styles.pointsCardLabelText}>ECO-POINTS BALANCE</ThemedText>
                  </View>
                  <View style={styles.pointsCardBadge}>
                    <ThemedText style={styles.pointsCardBadgeText}>
                      {points >= 5000 ? 'Platinum' : points >= 2000 ? 'Gold' : points >= 500 ? 'Silver' : 'Bronze'}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.pointsValue}>
                  {points.toLocaleString()}<ThemedText style={styles.pointsUnit}> pts</ThemedText>
                </ThemedText>

                <View style={styles.miniProgressBg}>
                  <View style={[styles.miniProgressFill, { width: `${Math.min((points / 5000) * 100, 100)}%` }]} />
                </View>

                <View style={styles.pointsCardBottom}>
                  <ThemedText style={styles.pointsCardHint}>Tap to view full eco profile</ThemedText>
                  <MaterialIcons name="arrow-forward-ios" size={11} color="rgba(255,255,255,0.4)" />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── QUICK STATS ROW ── */}
          <View style={styles.quickStats}>
            <QuickStat value={co2Saved} unit="kg" label="CO₂ Saved" color="#34d399" />
            <View style={styles.quickStatDivider} />
            <QuickStat value={devices.length} unit="" label="Devices" color="#60a5fa" />
            <View style={styles.quickStatDivider} />
            <QuickStat value={pickupCount} unit="" label="Pickups" color="#a78bfa" />
          </View>

          {/* ── SECTION: E-CYCLE HUB ── */}
          <View style={styles.sectionRow}>
            <ThemedText style={styles.sectionTitle}>E-Cycle Hub</ThemedText>
            <ThemedText style={styles.sectionSub}>What would you like to do?</ThemedText>
          </View>

          <View style={styles.featureGrid}>
            <FeatureTile label="AI Appraisal" icon="auto-awesome" accent="#a78bfa" subText="Value your tech" onPress={() => router.push('/chatbot')} />
            <FeatureTile label="Marketplace" icon="store" accent="#60a5fa" subText="Buy refurbished" onPress={() => router.push('/market')} />
            <FeatureTile label="Drop-off" icon="location-on" accent="#f87171" subText="Find centers" onPress={() => router.push('/drop-off')} />
            <FeatureTile label="Pick-up" icon="local-shipping" accent="#fbbf24" subText="Instant disposal" onPress={() => router.push('/scan-device')} />
          </View>

          {/* ── YOUR DEVICES SECTION ── */}
          <View style={[styles.sectionRow, { marginTop: 28 }]}>
            <View>
              <ThemedText style={styles.sectionTitle}>Your Devices</ThemedText>
              <ThemedText style={styles.sectionSub}>All registered & purchased devices</ThemedText>
            </View>
            <View style={styles.sectionCountBadge}>
              <ThemedText style={styles.sectionCount}>{devices.length} tracked</ThemedText>
            </View>
          </View>

          {/* Devices list */}
          {devices.map((d) => (
            <DeviceRow key={d.id} d={d} onSchedulePickup={handleSchedulePickup} />
          ))}

          {/* Scan a Device button — inside the section */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/scan-device')}
            style={styles.scanCTA}
          >
            <View style={styles.scanCTALeft}>
              <View style={styles.scanIconBox}>
                <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />
              </View>
              <View>
                <ThemedText style={styles.scanCTATitle}>Scan a Device</ThemedText>
                <ThemedText style={styles.scanCTASub}>Detect & analyze lifecycle with AI · +50 pts</ThemedText>
              </View>
            </View>
            <View style={styles.scanCTAArrow}>
              <MaterialIcons name="chevron-right" size={20} color="#059669" />
            </View>
          </TouchableOpacity>

        </ScrollView>

        {/* ── ECO STATS BOTTOM SHEET ── */}
        <EcoStatsSheet
          visible={isSheetVisible}
          onClose={() => setSheetVisible(false)}
          ecoPoints={ecoPoints}
          deviceCount={devices.length}
          user={user}
          pointHistory={pointHistory}
        />

        <ProfileModal visible={isProfileVisible} onClose={() => setProfileVisible(false)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ─── STYLES ─── */
const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 150 },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  greetingLabel: { fontSize: 11, opacity: 0.45, fontWeight: '700', letterSpacing: 1 },
  greetingName: { fontSize: 26, fontWeight: '900', marginTop: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  avatarOnline: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#34d399', borderWidth: 2, borderColor: '#030a05' },

  // Points card
  pointsCard: { borderRadius: 28, padding: 22, marginBottom: 18, overflow: 'hidden', position: 'relative' },
  decorCircle1: { position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(52,211,153,0.12)' },
  decorCircle2: { position: 'absolute', bottom: -30, right: 60, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(52,211,153,0.08)' },
  pointsCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointsCardLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pointsCardLabelText: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  pointsCardBadge: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  pointsCardBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '800' },
  pointsValue: { color: '#fff', fontSize: 42, fontWeight: '900', marginTop: 12, letterSpacing: -1 },
  pointsUnit: { fontSize: 18, fontWeight: '700', opacity: 0.6 },
  miniProgressBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, marginTop: 14, marginBottom: 12 },
  miniProgressFill: { height: 4, backgroundColor: '#34d399', borderRadius: 2 },
  pointsCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointsCardHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },

  // Quick stats
  quickStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingVertical: 16, marginBottom: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontSize: 20, fontWeight: '900' },
  quickStatUnit: { fontSize: 13, fontWeight: '700' },
  quickStatLabel: { fontSize: 11, opacity: 0.45, fontWeight: '700', marginTop: 2 },
  quickStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Section
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  sectionSub: { fontSize: 11, opacity: 0.4, fontWeight: '600' },
  sectionCountBadge: {},
  sectionCount: { fontSize: 11, fontWeight: '700', color: '#34d399', backgroundColor: 'rgba(52,211,153,0.12)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },

  // Feature grid
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  featureTile: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  featureIconRing: { width: 46, height: 46, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1 },
  featureTileLabel: { fontWeight: '800', fontSize: 14 },
  featureTileSub: { fontSize: 11, opacity: 0.45, marginTop: 2 },

  // Scan CTA
  scanCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)', marginTop: 14 },
  scanCTALeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scanIconBox: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
  scanCTATitle: { fontWeight: '800', fontSize: 15 },
  scanCTASub: { fontSize: 12, opacity: 0.5, marginTop: 1 },
  scanCTAArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(52,211,153,0.12)', justifyContent: 'center', alignItems: 'center' },

  // Device card
  deviceCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' },
  deviceCardOld: { borderColor: 'rgba(248,113,113,0.35)', backgroundColor: 'rgba(248,113,113,0.04)' },
  deviceCardInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  deviceIconBox: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deviceEmoji: { fontSize: 20 },
  deviceCardName: { fontWeight: '800', fontSize: 14 },
  deviceCardMeta: { fontSize: 11, opacity: 0.5, marginTop: 2 },
  deviceTagRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  marketTag: { backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' },
  marketTagText: { fontSize: 9, fontWeight: '800', color: '#a78bfa' },
  pickupTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(96,165,250,0.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)' },
  pickupTagText: { fontSize: 9, fontWeight: '700', color: '#60a5fa' },
  deviceVerdict: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  deviceVerdictText: { fontSize: 10, fontWeight: '800' },
  schedulePickupBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  schedulePickupText: { fontSize: 9, fontWeight: '800', color: '#fbbf24' },

  // E-waste badge (top-right of old device card)
  eWasteBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, zIndex: 10 },
  eWasteBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

  // Bottom sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT, backgroundColor: '#0d1f14', borderTopLeftRadius: 32, borderTopRightRadius: 32, zIndex: 51, borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)', borderBottomWidth: 0 },
  sheetDragArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  sheetScroll: { paddingHorizontal: 22, paddingBottom: 50 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  sheetSub: { fontSize: 12, opacity: 0.4, marginTop: 2 },
  sheetSectionTitle: { fontSize: 14, fontWeight: '800', opacity: 0.7 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  tierText: { fontWeight: '800', fontSize: 12 },

  // Points hero (inside sheet)
  pointsHero: { borderRadius: 22, padding: 20, marginBottom: 18, overflow: 'hidden' },
  pointsHeroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  pointsHeroValue: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 6, letterSpacing: -1 },
  pointsHeroSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2, marginBottom: 12 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#fff', borderRadius: 3 },

  // Stats grid (in sheet)
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  statCard: { width: (width - 64) / 2, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontWeight: '900', fontSize: 22 },
  statLabel: { fontSize: 11, opacity: 0.45, marginTop: 3 },

  // Wide row (in sheet)
  wideRow: { flexDirection: 'row', marginBottom: 16 },
  wideCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  wideIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  wideValue: { fontWeight: '900', fontSize: 20 },
  wideLabel: { fontSize: 11, opacity: 0.45, marginTop: 3 },

  // Point history
  pointHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  pointHistoryReason: { flex: 1, fontSize: 12, opacity: 0.65, marginRight: 10 },
  pointHistoryPts: { fontSize: 13, fontWeight: '800', color: '#34d399' },

  // Tip
  tipCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)', marginTop: 16 },
  tipText: { flex: 1, fontSize: 12, opacity: 0.7, lineHeight: 18 },
});