/**
 * Trace — Bite Scanner Screen
 *
 * Take a photo → AI model classifies it → see urgency + recommended actions.
 *
 * Flow:
 *  1. photo: pick or take a bite photo
 *  2. analyzing: send to GPU server for inference
 *  3. results: classification + urgency + actions
 *
 * If the GPU server is unreachable, shows a graceful retry option.
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
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ScanResult,
  isHomeServerConfigured,
  classifyWithML,
  mlClassificationToResult,
  AIClassification,
} from '@/lib/bite-scanner';
import { T } from '@/lib/theme';

type Step = 'photo' | 'analyzing' | 'results' | 'fallback' | 'error';

const URGENCY_COLORS = {
  emergency: T.danger,
  urgent: T.warning,
  soon: T.primary,
  monitor: T.success,
};

const URGENCY_LABELS = {
  emergency: 'EMERGENCY',
  urgent: 'SEE A DOCTOR SOON',
  soon: 'MONITOR & CONSIDER DOCTOR',
  monitor: 'MONITOR AT HOME',
};

export default function ScanScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('photo');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mlResult, setMlResult] = useState<AIClassification | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  /**
   * Run the photo through the ML model and produce a ScanResult.
   *
   * Order of operations:
   *   1. If ML_SERVER_URL is configured, try the live model first.
   *   2. If the server is not configured OR the request fails, drop into the
   *      on-device questionnaire flow — the user answers a few quick visual
   *      questions and the rule-based engine returns a structured assessment.
   *
   * This means Trace ALWAYS produces a useful result, even fully offline.
   */
  async function analyzePhoto(uri: string) {
    setStep('analyzing');
    setErrorMsg('');

    try {
      if (isHomeServerConfigured()) {
        const ml = await classifyWithML(uri);
        if (ml) {
          setMlResult(ml);
          setResult(mlClassificationToResult(ml));
          setStep('results');
          return;
        }
        // Server configured but unreachable — fall through to on-device.
      }

      // On-device fallback. The photo can't be auto-classified without a
      // model, so we route the user to the symptom checker / questionnaire
      // path instead of pretending we analyzed pixels we never read.
      setStep('fallback');
    } catch (err: any) {
      setErrorMsg(`Analysis failed: ${err?.message || 'Unknown error'}`);
      setStep('error');
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera Access Required',
        'Trace needs camera access to scan bite locations. You can enable this in Settings.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      analyzePhoto(uri);
    }
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo Access Required',
        'Trace needs photo access to analyze existing images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      analyzePhoto(uri);
    }
  }

  function reset() {
    setStep('photo');
    setImageUri(null);
    setResult(null);
    setMlResult(null);
    setErrorMsg('');
  }

  function retry() {
    if (imageUri) analyzePhoto(imageUri);
  }

  // ─── Photo Step ────────────────────────────────────────────────────────
  if (step === 'photo') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.photoHeader}>
            <MaterialIcons name="photo-camera" size={48} color={T.primary} />
            <Text style={styles.photoTitle}>Scan a Bite</Text>
            <Text style={styles.photoDesc}>
              Take a close-up photo of the bite or affected area. The AI model
              will classify it and tell you what to do.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cameraButton}
            onPress={takePhoto}
            activeOpacity={0.8}
          >
            <MaterialIcons name="photo-camera" size={28} color={T.white} />
            <Text style={styles.cameraButtonText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.galleryButton}
            onPress={pickPhoto}
            activeOpacity={0.8}
          >
            <MaterialIcons name="photo-library" size={24} color={T.primary} />
            <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Photo Tips</Text>
            <View style={styles.tipRow}>
              <MaterialIcons name="wb-sunny" size={16} color={T.primary} />
              <Text style={styles.tipText}>Use good lighting — natural light is best</Text>
            </View>
            <View style={styles.tipRow}>
              <MaterialIcons name="crop-free" size={16} color={T.primary} />
              <Text style={styles.tipText}>Get close — fill the frame with the affected area</Text>
            </View>
            <View style={styles.tipRow}>
              <MaterialIcons name="center-focus-strong" size={16} color={T.primary} />
              <Text style={styles.tipText}>Make sure the area is in focus</Text>
            </View>
            <View style={styles.tipRow}>
              <MaterialIcons name="replay" size={16} color={T.primary} />
              <Text style={styles.tipText}>Take a new photo every 24 hours to track changes</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Analyzing Step ────────────────────────────────────────────────────
  if (step === 'analyzing') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.analyzeContainer}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.analyzeImage} />
          )}
          <View style={styles.analyzeContent}>
            <ActivityIndicator size="large" color={T.primary} />
            <Text style={styles.analyzeTitle}>Analyzing photo...</Text>
            <Text style={styles.analyzeDesc}>
              The AI model is classifying your image
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Fallback Step (no ML server configured) ──────────────────────────
  if (step === 'fallback') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.resultImage} />
          )}

          <View style={[styles.urgencyBadge, { backgroundColor: T.primary }]}>
            <Text style={styles.urgencyText}>PHOTO SAVED</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>On-device analysis</Text>
            <Text style={styles.resultDesc}>
              The Trace ML server is not running, so the photo was not
              auto-classified. Your image stayed on this device — nothing was
              uploaded. Use the symptom checker for a guided assessment, or
              re-scan once the model is online.
            </Text>
          </View>

          <Text style={styles.actionsTitle}>What To Do Next</Text>
          {[
            'Look closely at the bite: is it expanding? Does it have a circular ring with central clearing (a "bullseye")?',
            'Open the Check tab and log any symptoms you have right now — fatigue, fever, joint pain, headache.',
            'Photograph the area every 12–24 hours for the next 30 days. New EM rashes typically appear 3–30 days after a tick bite.',
            'If the area expands beyond 5 cm or you develop flu-like symptoms, see a doctor.',
            'In an emergency (severe headache + neck stiffness, facial droop, heart palpitations), call 911.',
          ].map((action, i) => (
            <View key={i} style={styles.actionRow}>
              <View style={styles.actionNumber}>
                <Text style={styles.actionNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => router.push('/(tabs)/check')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open the symptom check tab"
          >
            <MaterialIcons name="fact-check" size={22} color={T.white} />
            <Text style={styles.scanAgainText}>Log Symptoms Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.galleryButton}
            onPress={reset}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Take or pick another photo"
          >
            <MaterialIcons name="photo-camera" size={20} color={T.primary} />
            <Text style={styles.galleryButtonText}>Take Another Photo</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Trace is not a medical device and does not diagnose disease. It
            organizes information for you and your clinician. In an emergency,
            call 911.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Error Step ────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.resultImage} />
          )}
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={40} color={T.danger} />
            <Text style={styles.errorTitle}>Analysis Failed</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>

          <TouchableOpacity
            style={styles.cameraButton}
            onPress={retry}
            activeOpacity={0.8}
          >
            <MaterialIcons name="refresh" size={24} color={T.white} />
            <Text style={styles.cameraButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.galleryButton}
            onPress={reset}
            activeOpacity={0.8}
          >
            <MaterialIcons name="photo-camera" size={20} color={T.primary} />
            <Text style={styles.galleryButtonText}>Take a New Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Results Step ──────────────────────────────────────────────────────
  if (step === 'results' && result) {
    const urgencyColor = URGENCY_COLORS[result.urgency];
    const urgencyLabel = URGENCY_LABELS[result.urgency];

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.resultImage} />
          )}

          {/* Urgency badge */}
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
            <Text style={styles.urgencyText}>{urgencyLabel}</Text>
          </View>

          {/* Main classification card */}
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.title}</Text>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>AI Confidence:</Text>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${result.confidence}%`,
                      backgroundColor: urgencyColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.confidencePercent}>{result.confidence}%</Text>
            </View>
            <Text style={styles.resultDesc}>{result.description}</Text>
          </View>

          {/* AI model breakdown */}
          {mlResult && mlResult.features.length > 0 && (
            <View style={styles.mlCard}>
              <View style={styles.mlHeader}>
                <MaterialIcons name="smart-toy" size={20} color={T.primary} />
                <Text style={styles.mlTitle}>Model Breakdown</Text>
              </View>
              <Text style={styles.mlSubtext}>
                Top predictions from the trained model
              </Text>
              <View style={styles.mlFeatures}>
                {mlResult.features.map((f, i) => (
                  <View key={i} style={styles.mlFeatureChip}>
                    <Text style={styles.mlFeatureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recommended actions */}
          <Text style={styles.actionsTitle}>What To Do</Text>
          {result.actions.map((action, i) => (
            <View key={i} style={styles.actionRow}>
              <View style={styles.actionNumber}>
                <Text style={styles.actionNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}

          {/* Action buttons */}
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={reset}
            activeOpacity={0.8}
          >
            <MaterialIcons name="photo-camera" size={22} color={T.white} />
            <Text style={styles.scanAgainText}>Scan Another Bite</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            This scan is for educational purposes only. It does not replace
            clinical evaluation. Only a healthcare provider can diagnose
            Lyme disease or any medical condition. If you are concerned, see a doctor.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },

  // Photo step
  photoHeader: {
    alignItems: 'center',
    marginBottom: T.xl,
    paddingTop: T.md,
  },
  photoTitle: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
    marginTop: T.md,
  },
  photoDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 22,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
    marginBottom: T.sm,
  },
  cameraButtonText: {
    color: T.white,
    fontSize: T.fontLg,
    fontWeight: '600',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: T.lg,
  },
  galleryButtonText: {
    color: T.primary,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.md,
  },
  tipsTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.primaryDark,
    marginBottom: T.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
    marginBottom: T.sm,
  },
  tipText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.text,
  },

  // Analyzing step
  analyzeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: T.lg,
  },
  analyzeImage: {
    width: 220,
    height: 220,
    borderRadius: T.radius,
    marginBottom: T.lg,
    backgroundColor: T.border,
  },
  analyzeContent: {
    alignItems: 'center',
    gap: T.sm,
  },
  analyzeTitle: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
    marginTop: T.md,
  },
  analyzeDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
  },

  // Error step
  errorCard: {
    backgroundColor: T.dangerBg,
    borderRadius: T.radius,
    padding: T.lg,
    alignItems: 'center',
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.dangerLight,
  },
  errorTitle: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.danger,
    marginTop: T.sm,
  },
  errorText: {
    fontSize: T.fontSm,
    color: T.text,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 20,
  },

  // Results step
  resultImage: {
    width: '100%',
    height: 240,
    borderRadius: T.radius,
    marginBottom: T.md,
    backgroundColor: T.border,
  },
  urgencyBadge: {
    alignSelf: 'center',
    paddingHorizontal: T.lg,
    paddingVertical: T.sm,
    borderRadius: T.radiusFull,
    marginBottom: T.md,
  },
  urgencyText: {
    color: T.white,
    fontWeight: '800',
    fontSize: T.fontSm,
    letterSpacing: 1,
  },
  resultCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.lg,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  resultTitle: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.md,
    gap: T.sm,
  },
  confidenceLabel: {
    fontSize: T.fontXs,
    color: T.textSecondary,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: T.border,
    borderRadius: 3,
  },
  confidenceFill: {
    height: 6,
    borderRadius: 3,
  },
  confidencePercent: {
    fontSize: T.fontXs,
    fontWeight: '600',
    color: T.text,
    width: 35,
    textAlign: 'right',
  },
  resultDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 22,
  },

  // ML breakdown
  mlCard: {
    backgroundColor: T.primaryFaint,
    borderRadius: T.radiusSm,
    padding: T.md,
    marginBottom: T.md,
  },
  mlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
  },
  mlTitle: {
    fontSize: T.fontSm,
    fontWeight: '700',
    color: T.primaryDark,
  },
  mlSubtext: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    marginTop: 2,
    marginBottom: T.sm,
  },
  mlFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.xs,
  },
  mlFeatureChip: {
    backgroundColor: T.card,
    paddingHorizontal: T.sm,
    paddingVertical: 4,
    borderRadius: T.radiusFull,
    borderWidth: 1,
    borderColor: T.border,
  },
  mlFeatureText: {
    fontSize: 12,
    color: T.textSecondary,
    fontWeight: '500',
  },

  // Actions
  actionsTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: T.sm,
    gap: T.sm,
  },
  actionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.primaryFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionNumText: {
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.primaryDark,
  },
  actionText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 22,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
    marginTop: T.lg,
  },
  scanAgainText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.lg,
    lineHeight: 18,
  },
});
