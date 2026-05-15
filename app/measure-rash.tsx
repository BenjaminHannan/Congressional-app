/**
 * Trace — Coin-Reference Rash Diameter Measurement
 *
 * Photo-based ruler that lets a patient measure a bite or rash without any
 * AR/native modules. Workflow:
 *
 *   1. Take or pick a photo with a US quarter beside the bite
 *   2. Tap opposite edges of the quarter to set the mm-per-pixel scale
 *   3. Tap opposite edges of the rash to measure its diameter
 *   4. Result: rash diameter in mm + cm, with the IDSA-2020 5cm
 *      erythema-migrans threshold called out
 *
 * Why coin reference and not ARKit/ARCore:
 *   - Works in Expo Go (no native module, no EAS dev build required)
 *   - Works on any phone; no LiDAR / depth-camera requirements
 *   - User keeps full control over the measurement — every tap is visible
 *   - Honest about its limits: the photo must be flat-on (no perspective)
 *     and the coin must lie in the same plane as the rash
 *
 * A US quarter is 24.26 mm in diameter (US Mint specification).
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Pressable,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { T } from '@/lib/theme';

const QUARTER_DIAMETER_MM = 24.26;
const EM_THRESHOLD_CM = 5.0;   // IDSA-2020 erythema migrans diameter threshold

type StepKey =
  | 'photo'
  | 'tap_coin_1' | 'tap_coin_2'
  | 'tap_rash_1' | 'tap_rash_2'
  | 'result';

interface Point { x: number; y: number }

const STEP_INSTRUCTIONS: Record<StepKey, string> = {
  photo:        'Take a photo of the bite with a US quarter for scale.',
  tap_coin_1:   'Tap ONE edge of the quarter (left or top).',
  tap_coin_2:   'Tap the OPPOSITE edge of the quarter.',
  tap_rash_1:   'Tap ONE edge of the rash.',
  tap_rash_2:   'Tap the OPPOSITE edge of the rash.',
  result:       'Done — review your measurement below.',
};

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function MeasureRashScreen() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>('photo');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [coinPoints, setCoinPoints] = useState<Point[]>([]);
  const [rashPoints, setRashPoints] = useState<Point[]>([]);
  const [layoutSize, setLayoutSize] = useState<{ w: number; h: number } | null>(null);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access required', 'Enable camera access in Settings to take a photo.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
    if (!r.canceled && r.assets[0]) {
      setImageUri(r.assets[0].uri);
      setStep('tap_coin_1');
    }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access required', 'Enable photo access in Settings.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true });
    if (!r.canceled && r.assets[0]) {
      setImageUri(r.assets[0].uri);
      setStep('tap_coin_1');
    }
  }

  function reset() {
    setStep('photo');
    setImageUri(null);
    setCoinPoints([]);
    setRashPoints([]);
    setLayoutSize(null);
  }

  function onImageLayout(e: LayoutChangeEvent) {
    setLayoutSize({
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    });
  }

  function onImageTap(e: GestureResponderEvent) {
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    const pt: Point = { x, y };

    if (step === 'tap_coin_1') {
      setCoinPoints([pt]);
      setStep('tap_coin_2');
    } else if (step === 'tap_coin_2') {
      setCoinPoints((cur) => [...cur, pt]);
      setStep('tap_rash_1');
    } else if (step === 'tap_rash_1') {
      setRashPoints([pt]);
      setStep('tap_rash_2');
    } else if (step === 'tap_rash_2') {
      setRashPoints((cur) => [...cur, pt]);
      setStep('result');
    }
  }

  // Compute measurement when we have all four taps
  let resultMm: number | null = null;
  let mmPerPixel: number | null = null;
  if (coinPoints.length === 2 && rashPoints.length === 2) {
    const coinPx = distance(coinPoints[0], coinPoints[1]);
    if (coinPx > 0) {
      mmPerPixel = QUARTER_DIAMETER_MM / coinPx;
      const rashPx = distance(rashPoints[0], rashPoints[1]);
      resultMm = rashPx * mmPerPixel;
    }
  }
  const resultCm = resultMm !== null ? resultMm / 10 : null;
  const crossesEM = resultCm !== null && resultCm >= EM_THRESHOLD_CM;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.closeRow}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close rash measurement"
        >
          <MaterialIcons name="close" size={24} color={T.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.h1}>Measure rash diameter</Text>
        <Text style={styles.subtitle}>
          Photo-based ruler using a US quarter (24.26 mm) as a scale reference.
          The IDSA-2020 clinical threshold for erythema migrans is{' '}
          <Text style={{ fontWeight: '700' }}>{EM_THRESHOLD_CM} cm</Text>.
        </Text>

        {/* Step indicator */}
        <View style={styles.stepCard}>
          <Text style={styles.stepText}>{STEP_INSTRUCTIONS[step]}</Text>
        </View>

        {/* Photo step */}
        {step === 'photo' && (
          <View>
            <TouchableOpacity style={styles.bigButton} onPress={takePhoto} activeOpacity={0.85}>
              <MaterialIcons name="photo-camera" size={26} color={T.white} />
              <Text style={styles.bigButtonText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bigButtonAlt} onPress={pickPhoto} activeOpacity={0.85}>
              <MaterialIcons name="photo-library" size={22} color={T.primary} />
              <Text style={styles.bigButtonAltText}>Choose from gallery</Text>
            </TouchableOpacity>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for an accurate measurement</Text>
              {[
                'Place a US quarter directly next to the rash, in the same plane (flat on the skin)',
                'Shoot from directly above — no tilt; perspective skew breaks the math',
                'Make sure both the coin and the rash are fully visible and in focus',
                'Crop the photo so both fit comfortably (the editor opens automatically)',
              ].map((t, i) => (
                <View key={i} style={styles.tipRow}>
                  <MaterialIcons name="check-circle" size={14} color={T.primary} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Image + tap overlay */}
        {imageUri && step !== 'photo' && (
          <Pressable onPress={onImageTap} style={styles.imageWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onLayout={onImageLayout}
            />

            {/* Markers */}
            {coinPoints.map((p, i) => (
              <View
                key={`c-${i}`}
                pointerEvents="none"
                style={[styles.marker, { left: p.x - 10, top: p.y - 10, borderColor: T.warning }]}
              >
                <Text style={[styles.markerLabel, { color: T.warning }]}>Q{i + 1}</Text>
              </View>
            ))}
            {rashPoints.map((p, i) => (
              <View
                key={`r-${i}`}
                pointerEvents="none"
                style={[styles.marker, { left: p.x - 10, top: p.y - 10, borderColor: T.danger }]}
              >
                <Text style={[styles.markerLabel, { color: T.danger }]}>R{i + 1}</Text>
              </View>
            ))}

            {/* Connecting lines */}
            {coinPoints.length === 2 && (
              <Line a={coinPoints[0]} b={coinPoints[1]} color={T.warning} />
            )}
            {rashPoints.length === 2 && (
              <Line a={rashPoints[0]} b={rashPoints[1]} color={T.danger} />
            )}
          </Pressable>
        )}

        {/* Result */}
        {step === 'result' && resultMm !== null && resultCm !== null && (
          <View style={[
            styles.resultCard,
            crossesEM ? styles.resultCardCritical : null,
          ]}>
            <Text style={styles.resultLabel}>Estimated rash diameter</Text>
            <Text style={styles.resultBig}>
              {resultCm.toFixed(1)} <Text style={{ fontSize: 18 }}>cm</Text>
              {'  '}
              <Text style={{ fontSize: 16, color: T.textSecondary, fontWeight: '500' }}>
                ({resultMm.toFixed(1)} mm)
              </Text>
            </Text>

            <View style={styles.thresholdRow}>
              <MaterialIcons
                name={crossesEM ? 'warning' : 'info'}
                size={18}
                color={crossesEM ? T.danger : T.primary}
              />
              <Text style={[styles.thresholdText, crossesEM ? { color: T.danger, fontWeight: '700' } : null]}>
                {crossesEM
                  ? `Crosses the ${EM_THRESHOLD_CM} cm erythema migrans threshold — see a doctor today.`
                  : `Below the ${EM_THRESHOLD_CM} cm erythema migrans threshold. Continue monitoring and re-measure if it expands.`}
              </Text>
            </View>

            <Text style={styles.scaleNote}>
              Scale: 1 px ≈ {mmPerPixel?.toFixed(3)} mm  ·  reference: US quarter (24.26 mm)
            </Text>

            <TouchableOpacity style={styles.bigButton} onPress={reset} activeOpacity={0.85}>
              <MaterialIcons name="refresh" size={22} color={T.white} />
              <Text style={styles.bigButtonText}>Measure another</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reset hint while in tap mode */}
        {(step.startsWith('tap_')) && (
          <TouchableOpacity style={styles.resetLink} onPress={reset}>
            <MaterialIcons name="restart-alt" size={16} color={T.textSecondary} />
            <Text style={styles.resetLinkText}>Start over</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.disclaimer}>
          Photo-based measurement, not AR. Accuracy depends on shooting flat-on
          with the coin in the same plane as the rash. Use the result as a
          *trend tracker* (is the rash growing day-over-day?) rather than an
          absolute diagnostic measurement.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * A diagonal line between two points, drawn with a 1-px-tall rotated View.
 * Avoids pulling in react-native-svg.
 */
function Line({ a, b, color }: { a: Point; b: Point; color: string }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: a.x,
        top: a.y,
        width: len,
        height: 2,
        backgroundColor: color,
        opacity: 0.85,
        transform: [{ translateY: -1 }, { rotate: `${angle}deg` }],
        transformOrigin: 'left top' as any,
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  closeRow: { alignSelf: 'flex-end', padding: T.sm },
  h1: { fontSize: T.fontXxl, fontWeight: '800', color: T.text, marginBottom: 4 },
  subtitle: { fontSize: T.fontSm, color: T.textSecondary, lineHeight: 20, marginBottom: T.md },

  stepCard: {
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderLeftWidth: 4,
    borderLeftColor: T.primary,
  },
  stepText: { fontSize: T.fontMd, fontWeight: '600', color: T.primaryDark },

  bigButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: T.sm,
    backgroundColor: T.primary,
    paddingVertical: T.md,
    borderRadius: T.radius,
    marginBottom: T.sm,
  },
  bigButtonText: { color: T.white, fontWeight: '700', fontSize: T.fontMd },
  bigButtonAlt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: T.sm,
    backgroundColor: T.card,
    paddingVertical: T.md,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: T.md,
  },
  bigButtonAltText: { color: T.primary, fontWeight: '700', fontSize: T.fontMd },

  tipsCard: { backgroundColor: T.primaryFaint, borderRadius: T.radius, padding: T.md },
  tipsTitle: { fontSize: T.fontSm, fontWeight: '700', color: T.primaryDark, marginBottom: T.sm },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  tipText: { flex: 1, fontSize: T.fontSm, color: T.text },

  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: T.border,
    borderRadius: T.radius,
    marginBottom: T.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },

  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  markerLabel: { fontSize: 10, fontWeight: '800' },

  resultCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.lg,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: T.md,
  },
  resultCardCritical: {
    borderColor: T.danger,
    backgroundColor: T.dangerBg,
    borderWidth: 2,
  },
  resultLabel: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultBig: {
    fontSize: 40,
    fontWeight: '800',
    color: T.text,
    marginVertical: 6,
  },
  thresholdRow: { flexDirection: 'row', gap: T.sm, alignItems: 'flex-start', marginVertical: T.sm },
  thresholdText: { flex: 1, fontSize: T.fontSm, color: T.text, lineHeight: 20 },
  scaleNote: { fontSize: 10, color: T.textMuted, fontStyle: 'italic', marginBottom: T.sm },

  resetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: T.sm,
  },
  resetLinkText: { fontSize: T.fontXs, color: T.textSecondary, fontWeight: '600' },

  disclaimer: {
    fontSize: 11,
    color: T.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: T.lg,
    lineHeight: 16,
  },
});
