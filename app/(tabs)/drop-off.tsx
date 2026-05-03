import { ThemedText } from '@/components/themed-text';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
type CentreType = 'individual' | 'organisational';

interface Centre {
  id: string;
  name: string;
  type: CentreType;
  address: string;
  lat: number;
  lon: number;
  distanceKm: number;
  phone?: string;
  openingHours?: string;
  operator?: string;
  tags: Record<string, string>;
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyCentre(tags: Record<string, string>): CentreType {
  const org = tags.operator || tags.brand || tags.network || '';
  const name = (tags.name || '').toLowerCase();
  const amenity = tags.amenity || '';

  // Heuristics: large chains, recycling depots, waste facilities → organisational
  if (
    amenity === 'recycling' && tags['recycling_type'] === 'centre' ||
    org.length > 0 ||
    name.includes('corporation') || name.includes('pvt') || name.includes('ltd') ||
    name.includes('municipal') || name.includes('govt') || name.includes('government') ||
    name.includes('facility') || name.includes('depot') || name.includes('management') ||
    tags['operator:type'] === 'government' || tags['operator:type'] === 'private'
  ) {
    return 'organisational';
  }
  return 'individual';
}

function buildAddress(tags: Record<string, string>): string {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:city'],
    tags['addr:state'],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : tags.description || 'Address not listed';
}

/* ─────────────────────────────────────────
   OVERPASS QUERY
───────────────────────────────────────── */
async function fetchCentres(lat: number, lon: number, radiusM = 15000): Promise<Centre[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="recycling"](around:${radiusM},${lat},${lon});
      way["amenity"="recycling"](around:${radiusM},${lat},${lon});
      node["recycling:electronics"="yes"](around:${radiusM},${lat},${lon});
      node["recycling:computers"="yes"](around:${radiusM},${lat},${lon});
      node["recycling:small_appliances"="yes"](around:${radiusM},${lat},${lon});
      node["waste"="electronics"](around:${radiusM},${lat},${lon});
      node["shop"="electronics"]["second_hand"="yes"](around:${radiusM},${lat},${lon});
    );
    out body center 60;
  `;

  // const url = `https://overpass.kumi.systems/api/interpreter`;

  const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      data: query.trim(),
    }).toString(),
  });
  // const res = await fetch('https://overpass.openstreetmap.ru/api/interpreter', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: `data=${encodeURIComponent(query)}`,
  // });

  const json = await res.json();
  console.log("OVERPASS RESPONSE:", json);


  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Overpass failed: ${res.status} ${errText}`);
  }
  const centres: Centre[] = (json.elements as any[])
    .filter((el) => el.tags?.name || el.tags?.operator)
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat ?? 0;
      const elLon = el.lon ?? el.center?.lon ?? 0;
      const tags: Record<string, string> = el.tags || {};
      return {
        id: String(el.id),
        name: tags.name || tags.operator || 'E-Waste Centre',
        type: classifyCentre(tags),
        address: buildAddress(tags),
        lat: elLat,
        lon: elLon,
        distanceKm: haversineKm(lat, lon, elLat, elLon),
        phone: tags.phone || tags['contact:phone'],
        openingHours: tags.opening_hours,
        operator: tags.operator,
        tags,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return centres;
}

/* ─────────────────────────────────────────
   CENTRE CARD
───────────────────────────────────────── */
function CentreCard({ centre, index }: { centre: Centre; index: number }) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const openMaps = () => {
    const label = encodeURIComponent(centre.name);
    const url = `https://www.google.com/maps/search/?api=1&query=${label}&query_place_id=${centre.lat},${centre.lon}`;
    Linking.openURL(url);
  };

  const callCentre = () => {
    if (centre.phone) Linking.openURL(`tel:${centre.phone}`);
  };

  const pressIn = () =>
    Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  const isOrg = centre.type === 'organisational';
  const accent = isOrg ? '#60a5fa' : '#34d399';
  const distLabel =
    centre.distanceKm < 1
      ? `${Math.round(centre.distanceKm * 1000)} m`
      : `${centre.distanceKm.toFixed(1)} km`;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={openMaps}
        style={[styles.card, { borderColor: accent + '22' }]}
      >
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: accent }]} />

        <View style={styles.cardBody}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBox, { backgroundColor: accent + '15' }]}>
              <MaterialIcons
                name={isOrg ? 'business' : 'person-pin'}
                size={18}
                color={accent}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={styles.cardName} numberOfLines={1}>
                {centre.name}
              </ThemedText>
              {centre.operator && centre.operator !== centre.name && (
                <ThemedText style={styles.cardOperator} numberOfLines={1}>
                  {centre.operator}
                </ThemedText>
              )}
            </View>
            <View style={[styles.distBadge, { backgroundColor: accent + '18' }]}>
              <MaterialIcons name="near-me" size={10} color={accent} />
              <ThemedText style={[styles.distText, { color: accent }]}>{distLabel}</ThemedText>
            </View>
          </View>

          {/* Address */}
          <View style={styles.cardRow}>
            <MaterialIcons name="location-on" size={12} color="rgba(255,255,255,0.3)" />
            <ThemedText style={styles.cardMeta} numberOfLines={2}>
              {centre.address}
            </ThemedText>
          </View>

          {/* Opening hours */}
          {centre.openingHours && (
            <View style={styles.cardRow}>
              <MaterialIcons name="access-time" size={12} color="rgba(255,255,255,0.3)" />
              <ThemedText style={styles.cardMeta} numberOfLines={1}>
                {centre.openingHours}
              </ThemedText>
            </View>
          )}

          {/* Accepted tags */}
          <View style={styles.tagRow}>
            {centre.tags['recycling:electronics'] === 'yes' && (
              <ChipTag label="Electronics" color={accent} />
            )}
            {centre.tags['recycling:computers'] === 'yes' && (
              <ChipTag label="Computers" color={accent} />
            )}
            {centre.tags['recycling:small_appliances'] === 'yes' && (
              <ChipTag label="Appliances" color={accent} />
            )}
          </View>

          {/* Actions */}
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={openMaps}>
              <MaterialIcons name="map" size={13} color="rgba(255,255,255,0.5)" />
              <ThemedText style={styles.actionText}>Directions</ThemedText>
            </TouchableOpacity>
            {centre.phone && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: accent + '40', backgroundColor: accent + '10' }]}
                onPress={callCentre}
              >
                <MaterialIcons name="phone" size={13} color={accent} />
                <ThemedText style={[styles.actionText, { color: accent }]}>Call</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ChipTag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <ThemedText style={[styles.chipText, { color }]}>{label}</ThemedText>
    </View>
  );
}

/* ─────────────────────────────────────────
   TAB BAR
───────────────────────────────────────── */
function TabBar({
  active,
  onChange,
  indCount,
  orgCount,
}: {
  active: CentreType;
  onChange: (t: CentreType) => void;
  indCount: number;
  orgCount: number;
}) {
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideX, {
      toValue: active === 'individual' ? 0 : 1,
      useNativeDriver: false,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [active]);

  const tabW = (width - 40) / 2;

  return (
    <View style={styles.tabBar}>
      {/* Sliding pill */}
      <Animated.View
        style={[
          styles.tabPill,
          {
            width: tabW,
            transform: [
              {
                translateX: slideX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, tabW],
                }),
              },
            ],
          },
        ]}
      />
      {(
        [
          { key: 'individual', label: 'Individual', icon: 'person', count: indCount, color: '#34d399' },
          { key: 'organisational', label: 'Organisational', icon: 'business', count: orgCount, color: '#60a5fa' },
        ] as const
      ).map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabItem, { width: tabW }]}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={tab.icon}
            size={15}
            color={active === tab.key ? tab.color : 'rgba(255,255,255,0.35)'}
          />
          <ThemedText
            style={[
              styles.tabLabel,
              active === tab.key && { color: tab.color, opacity: 1 },
            ]}
          >
            {tab.label}
          </ThemedText>
          <View
            style={[
              styles.tabCount,
              {
                backgroundColor:
                  active === tab.key ? tab.color + '22' : 'rgba(255,255,255,0.06)',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.tabCountText,
                active === tab.key && { color: tab.color },
              ]}
            >
              {tab.count}
            </ThemedText>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────── */
function EmptyState({ type }: { type: CentreType }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons
          name={type === 'individual' ? 'map-marker-off' : 'office-building'}
          size={32}
          color="rgba(255,255,255,0.15)"
        />
      </View>
      <ThemedText style={styles.emptyTitle}>
        No {type === 'individual' ? 'individual drop-off' : 'organisational'} centres found nearby
      </ThemedText>
      <ThemedText style={styles.emptySub}>
        Try expanding the search radius or check back later.
      </ThemedText>
    </View>
  );
}

/* ─────────────────────────────────────────
   MAIN SCREEN
───────────────────────────────────────── */
export default function DropOffScreen() {
  const router = useRouter();
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CentreType>('individual');
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState(15);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable it in settings.');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude: lat, longitude: lon } = loc.coords;
      setLocation({ lat, lon });

      // Reverse geocode for city name
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geo[0]) {
          setCityName(geo[0].city || geo[0].region || '');
        }
      } catch (_) {}

      const data = await fetchCentres(lat, lon, radiusKm * 1000);
      setCentres(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load centres. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [radiusKm]);

  useEffect(() => {
    startPulse();
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const individual = centres.filter((c) => c.type === 'individual');
  const organisational = centres.filter((c) => c.type === 'organisational');
  const displayed = activeTab === 'individual' ? individual : organisational;

  const expandRadius = () => {
    const next = radiusKm === 15 ? 30 : radiusKm === 30 ? 50 : 15;
    setRadiusKm(next);
    setLoading(true);
    setTimeout(() => load(), 100);
  };

  return (
    <LinearGradient colors={['#030a05', '#071210']} style={styles.bg}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── HEADER ── */}
        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.headerTitle}>Drop-off Centres</ThemedText>
            {cityName ? (
              <View style={styles.locationRow}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View style={styles.locationDot} />
                </Animated.View>
                <ThemedText style={styles.locationText}>{cityName}</ThemedText>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={expandRadius} style={styles.radiusBtn}>
            <MaterialIcons name="radar" size={16} color="#34d399" />
            <ThemedText style={styles.radiusBtnText}>{radiusKm} km</ThemedText>
          </TouchableOpacity>
        </Animated.View>

        {/* ── LOADING ── */}
        {loading && (
          <View style={styles.loadingWrap}>
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#34d399" size="large" />
              <ThemedText style={styles.loadingText}>Finding centres near you…</ThemedText>
              <ThemedText style={styles.loadingSub}>Querying OpenStreetMap</ThemedText>
            </View>
          </View>
        )}

        {/* ── ERROR ── */}
        {!loading && error && (
          <View style={styles.loadingWrap}>
            <View style={styles.errorCard}>
              <MaterialIcons name="wifi-off" size={36} color="#f87171" />
              <ThemedText style={styles.errorTitle}>Something went wrong</ThemedText>
              <ThemedText style={styles.errorSub}>{error}</ThemedText>
              <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
                <ThemedText style={styles.retryText}>Try Again</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── CONTENT ── */}
        {!loading && !error && (
          <>
            {/* Summary strip */}
            <View style={styles.summaryStrip}>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryValue}>{centres.length}</ThemedText>
                <ThemedText style={styles.summaryLabel}>Total Found</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryValue, { color: '#34d399' }]}>
                  {individual.length}
                </ThemedText>
                <ThemedText style={styles.summaryLabel}>Individual</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryValue, { color: '#60a5fa' }]}>
                  {organisational.length}
                </ThemedText>
                <ThemedText style={styles.summaryLabel}>Organisational</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryValue}>{radiusKm} km</ThemedText>
                <ThemedText style={styles.summaryLabel}>Radius</ThemedText>
              </View>
            </View>

            {/* Tab bar */}
            <TabBar
              active={activeTab}
              onChange={setActiveTab}
              indCount={individual.length}
              orgCount={organisational.length}
            />

            {/* Cards list */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#34d399"
                  colors={['#34d399']}
                />
              }
            >
              {displayed.length === 0 ? (
                <EmptyState type={activeTab} />
              ) : (
                displayed.map((c, i) => (
                  <CentreCard key={c.id} centre={c} index={i} />
                ))
              )}

              {/* OSM attribution */}
              <View style={styles.attribution}>
                <MaterialCommunityIcons name="map" size={11} color="rgba(255,255,255,0.2)" />
                <ThemedText style={styles.attributionText}>
                  Data © OpenStreetMap contributors
                </ThemedText>
              </View>
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingRight: -30,
    paddingLeft: 7,
  },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  locationDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#34d399',
  },
  locationText: { fontSize: 11, color: '#34d399', fontWeight: '700' },
  radiusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
  },
  radiusBtnText: { color: '#34d399', fontSize: 12, fontWeight: '800' },

  // Loading / Error
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingCard: {
    alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  loadingText: { fontWeight: '800', fontSize: 16, marginTop: 8 },
  loadingSub: { fontSize: 12, opacity: 0.4 },
  errorCard: {
    alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(248,113,113,0.06)',
    borderRadius: 24, padding: 32,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.15)',
  },
  errorTitle: { fontWeight: '900', fontSize: 17, color: '#f87171' },
  errorSub: { fontSize: 13, opacity: 0.5, textAlign: 'center', lineHeight: 18 },
  retryBtn: {
    marginTop: 8, backgroundColor: '#f87171',
    paddingHorizontal: 28, paddingVertical: 10,
    borderRadius: 14,
  },
  retryText: { color: '#fff', fontWeight: '800' },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 10, opacity: 0.4, fontWeight: '700', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
    overflow: 'hidden',
  },
  tabPill: {
    position: 'absolute',
    top: 4, bottom: 4, left: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
  },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, zIndex: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '800', opacity: 0.4 },
  tabCount: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10,
  },
  tabCountText: { fontSize: 11, fontWeight: '800', opacity: 0.45 },

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 130 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardAccent: { width: 3 },
  cardBody: { flex: 1, padding: 15 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardIconBox: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  cardName: { fontWeight: '800', fontSize: 14, flex: 1 },
  cardOperator: { fontSize: 11, opacity: 0.4, marginTop: 1 },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  distText: { fontSize: 11, fontWeight: '800' },
  cardRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 5,
  },
  cardMeta: { fontSize: 11, opacity: 0.45, flex: 1, lineHeight: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 10 },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: '800' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionText: { fontSize: 11, fontWeight: '700', opacity: 0.55 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { fontWeight: '800', fontSize: 16, textAlign: 'center', marginBottom: 8 },
  emptySub: { fontSize: 13, opacity: 0.4, textAlign: 'center', lineHeight: 18 },

  // Attribution
  attribution: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    justifyContent: 'center', marginTop: 10,
  },
  attributionText: { fontSize: 10, opacity: 0.2 },
});