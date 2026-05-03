import { useAuth } from '@/app/_layout';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Use the OpenRouter API Key from .env
const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY!;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// ─── Quick Prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: '♻️ How to recycle?', text: 'How do I properly recycle my old electronics?' },
  { label: '☠️ Toxic materials', text: 'What toxic materials are found in e-waste and why are they dangerous?' },
  { label: '💰 Get best price', text: 'How can I get the best price when selling my old devices?' },
  { label: '📦 Schedule pickup', text: 'How does the E-Cycle pickup process work?' },
  { label: '🌍 Environmental impact', text: 'What is the environmental impact of improper e-waste disposal?' },
  { label: '🔋 Battery disposal', text: 'How should I safely dispose of old batteries and power banks?' },
];

// ─── Predefined Responses ──────────────────────────────────────────────────────
function getPredefinedResponse(input: string): string | null {
  const msg = input.toLowerCase();
  if (msg === 'hi' || msg === 'hello' || msg === 'hey') return "👋 Hey! I'm Recyclo 🌱 — your smart assistant for eco-friendly and budget-friendly tech!";
  if (msg.includes('how are you')) return "😊 I'm great! Ready to help you save money and the environment together!";
  if (msg.includes('who are you')) return "🤖 I'm Recyclo — your AI assistant for recycling and buying refurbished tech at the best prices.";
  if (msg.includes('recycle') && msg.includes('how')) return "♻️ To recycle, simply use our 'AI Appraisal' scanner to evaluate your device, then schedule a verified agent pickup right from the app!";
  return null;
}

// ─── OpenRouter API Call ───────────────────────────────────────────────────────
async function callOpenRouter(messages: { role: string; content: string }[]): Promise<string> {
  const systemPrompt = `You are Recyclo, the AI assistant for E-Cycle — India's premier e-waste recycling app based in Gurugram. 
You are friendly, knowledgeable, and passionate about environmental sustainability.
Expertise: E-waste procedures, toxic materials, Indian regulations (2022 Rules), and device refurbishment.
Keep responses concise (2-4 paragraphs), use emojis naturally, and focus on Gurugram/India context.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://e-cycle.app", 
        "X-Title": "E-Cycle App",
      },
      body: JSON.stringify({
        "model": "google/gemini-2.0-flash-001",
        "messages": [
          { "role": "system", "content": systemPrompt },
          ...messages
        ],
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "OpenRouter API Error");
    return data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter Fetch Error:", error);
    throw error;
  }
}

// ─── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, isDark }: { message: Message; isDark: boolean }) {
  const isUser = message.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const time = message.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View style={[styles.row, isUser ? styles.rowRight : null, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      {!isUser && (
        <LinearGradient colors={['#1b5e20', '#2ecc71']} style={styles.botAvatar}>
          <ThemedText style={{ fontSize: 14 }}>🌿</ThemedText>
        </LinearGradient>
      )}
      <View style={{ flex: isUser ? 0 : 1 }}>
        <View style={isUser ? styles.userBubble : [styles.botBubble, { backgroundColor: isDark ? 'rgba(46,204,113,0.12)' : '#f0fdf4', borderColor: isDark ? 'rgba(46,204,113,0.2)' : '#d1fae5' }]}>
          {isUser && <LinearGradient colors={['#2ecc71', '#1b8a3e']} style={StyleSheet.absoluteFill} />}
          <ThemedText style={[isUser ? styles.userText : styles.botText, { color: isUser ? '#fff' : (isDark ? '#e2f5e6' : '#1b5e20') }]}>
            {message.text}
          </ThemedText>
        </View>
        <ThemedText style={[styles.timeText, isUser && { textAlign: 'right' }]}>{time} {isUser ? '' : '· Recyclo'}</ThemedText>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatbotScreen() {
  const { user, isDark } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: `👋 Hi ${user?.name?.split(' ')[0] || 'there'}! I'm **Recyclo**, your E-Waste expert. How can I help you today? 🌱`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const flatRef = useRef<FlatList>(null);

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || loading) return;

    setInput('');
    setShowQuick(false);
    setLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: msgText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const predefined = getPredefinedResponse(msgText);
      if (predefined) {
        await new Promise(resolve => setTimeout(resolve, 600));
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: predefined, timestamp: new Date() }]);
      } else {
        const apiHistory = messages.map(m => ({ role: m.role, content: m.text }));
        const reply = await callOpenRouter([...apiHistory, { role: 'user', content: msgText }]);
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: reply, timestamp: new Date() }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', text: '⚠️ Connection error. Please check your OpenRouter key.', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, loading]);

  const bg = isDark ? '#0a0f0a' : '#f8fffe';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <LinearGradient colors={isDark ? ['#0d1f0d', '#0a160a'] : ['#e8f5e9', '#f1fdf2']} style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={['#1b5e20', '#2ecc71']} style={styles.headerAvatar}><ThemedText style={{ fontSize: 20 }}>🌿</ThemedText></LinearGradient>
            <View>
              <ThemedText style={[styles.headerTitle, { color: isDark ? '#fff' : '#1b5e20' }]}>Recyclo</ThemedText>
              <View style={styles.onlineRow}><View style={styles.onlineDot} /><ThemedText style={styles.onlineText}>E-Waste Expert · Online</ThemedText></View>
            </View>
          </View>
        </LinearGradient>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <MessageBubble message={item} isDark={isDark} />}
          ListFooterComponent={loading ? <View style={{ padding: 16 }}><ActivityIndicator color="#2ecc71" /></View> : null}
        />

        {/* Suggested Questions */}
        {showQuick && (
          <View style={styles.quickWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
              {QUICK_PROMPTS.map((q) => (
                <TouchableOpacity 
                  key={q.label} 
                  style={[styles.quickChip, { backgroundColor: isDark ? 'rgba(46,204,113,0.15)' : '#e8f5e9', borderColor: isDark ? 'rgba(46,204,113,0.3)' : '#a5d6a7' }]} 
                  onPress={() => sendMessage(q.text)}
                >
                  <ThemedText style={[styles.quickChipText, { color: isDark ? '#2ecc71' : '#1b5e20' }]}>{q.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Floating Input Box */}
        <View style={styles.inputContainer}>
          <BlurView intensity={isDark ? 60 : 40} tint={isDark ? 'dark' : 'light'} style={styles.inputBar}>
            <View style={[styles.inputWrap, { backgroundColor: isDark ? 'rgba(46,204,113,0.08)' : '#e8f5e9', borderColor: isDark ? 'rgba(46,204,113,0.2)' : '#c8e6c9' }]}>
              <TextInput
                style={[styles.input, { color: isDark ? '#fff' : '#1b5e20' }]}
                placeholder="Ask about e-waste..."
                placeholderTextColor={isDark ? '#4a7a4e' : '#81c784'}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => sendMessage()}
              />
              <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim() || loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#2ecc71" />
                ) : (
                  <IconSymbol name="arrow.up.circle.fill" size={36} color="#2ecc71" />
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(46,204,113,0.2)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2ecc71' },
  onlineText: { fontSize: 11, color: '#2ecc71' },
  
  messageList: { paddingTop: 16, paddingBottom: 200 }, // Increased to avoid content hiding behind input
  
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14, paddingHorizontal: 16, gap: 8 },
  rowRight: { justifyContent: 'flex-end' },
  botAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  botBubble: { borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, padding: 14, maxWidth: '90%' },
  botText: { fontSize: 14.5, lineHeight: 22 },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 280, overflow: 'hidden' },
  userText: { fontSize: 14.5, lineHeight: 21 },
  timeText: { fontSize: 10, color: '#88a08b', marginTop: 4, marginHorizontal: 4 },
  
  quickWrap: { paddingTop: 8, paddingBottom: 8 },
  quickScroll: { paddingHorizontal: 16, gap: 8 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  quickChipText: { fontSize: 12.5, fontWeight: '700' },
  
  inputContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10, // Gives it a floating look without pushing it off-screen
    marginBottom: 78,     // Slight lift above the bottom safe area/navbar
  },
  inputBar: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.15)',
  },
  inputWrap: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 18, 
    paddingRight: 6, 
    paddingVertical: 6, 
    minHeight: 52 
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
});