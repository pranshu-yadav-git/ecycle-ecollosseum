import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const genAI = new GoogleGenerativeAI("AIzaSyDRjR9bOohMjZFDCjs1SILvCu69thrBbjY");

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const cameraRef = useRef<any>(null);
  const router = useRouter();

  const posX = useSharedValue(0);
  const posY = useSharedValue(0);

  useEffect(() => {
    const sub = DeviceMotion.addListener((measurement: DeviceMotionMeasurement) => {
      if (measurement.rotation) {
        posX.value = withSpring(measurement.rotation.gamma * 300);
        posY.value = withSpring(measurement.rotation.beta * 300);
      }
    });
    DeviceMotion.setUpdateInterval(16);
    return () => sub.remove();
  }, []);

  const arStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.value }, { translateY: posY.value }],
  }));

  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>
            Grant Camera Access
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  const analyzeEwaste = async () => {
    if (!cameraRef.current || loading) return;
    setLoading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });

      const model = genAI.getGenerativeModel({
        model: "gemini-1.0-pro-vision-latest",
      });


      const prompt = `
Identify this electronic device from the image.

Return ONLY valid JSON:
{
  "name": "Full Device Name",
  "toxicity": number (1-10),
  "impact": "Short environmental impact",
  "cashValueINR": number
}
`;

      const aiResult = await model.generateContent({
            contents: [{
                role: 'user',
                },
                {
                parts: [
                    { text: prompt },
                    {
                    inlineData: {
                        data: photo.base64,
                        mimeType: "image/jpeg",
                    },
                    },
                ],
                } as any,
            ],
            });


      const responseText = await aiResult.response.text();

      // 🧠 SAFE JSON CLEANING
      const cleaned = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsed;

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.log("Raw AI response:", responseText);

        // fallback if AI messes up JSON
        parsed = {
          name: "Unknown Device",
          toxicity: 5,
          impact: "Could not properly analyze. Try again.",
          cashValueINR: 0,
        };
      }

      setResult(parsed);
    } catch (error) {
      console.error("AI Error:", error);
      Alert.alert(
        "Error",
        "Identification failed. Check API key, internet, or billing."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} />

      {result && (
        <Animated.View style={[styles.arOverlay, arStyle]}>
          <BlurView intensity={90} tint="dark" style={styles.arCard}>
            <ThemedText style={styles.arTitle}>{result.name}</ThemedText>

            <View style={styles.toxicRow}>
              <ThemedText style={styles.toxicScore}>
                Nature Toxicity: {result.toxicity}/10
              </ThemedText>
              <View
                style={[
                  styles.bar,
                  {
                    width: result.toxicity * 20,
                    backgroundColor:
                      result.toxicity > 7 ? '#ff4757' : '#ffa502',
                  },
                ]}
              />
            </View>

            <ThemedText style={styles.arImpact}>
              {result.impact}
            </ThemedText>
          </BlurView>

          <View style={styles.guide}>
            <IconSymbol
              name="arrow.left.and.right.circle.fill"
              size={20}
              color="#2ecc71"
            />
            <ThemedText style={styles.guideText}>
              Tilt device to view full report
            </ThemedText>
          </View>
        </Animated.View>
      )}

      <View style={styles.footer}>
        {!result ? (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={analyzeEwaste}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <IconSymbol
                name="viewfinder.circle.fill"
                size={65}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.recycleBtn}
            onPress={() =>
              router.push({
                pathname: '/recycle-details' as any,
                params: result,
              })
            }
          >
            <ThemedText style={styles.recycleText}>
              Schedule Pickup for ₹{result.cashValueINR}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0f0a',
  },
  permBtn: {
    backgroundColor: '#2ecc71',
    padding: 20,
    borderRadius: 15,
  },
  arOverlay: {
    position: 'absolute',
    top: height / 4,
    left: width / 10,
    width: width * 0.8,
  },
  arCard: {
    padding: 20,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  arTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  toxicRow: { marginVertical: 12 },
  toxicScore: {
    color: '#ff4757',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  bar: {
    height: 5,
    borderRadius: 3,
  },
  arImpact: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    gap: 8,
  },
  guideText: {
    color: '#2ecc71',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
  },
  scanBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(46, 204, 113, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recycleBtn: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 45,
    paddingVertical: 22,
    borderRadius: 50,
    elevation: 10,
  },
  recycleText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
});
