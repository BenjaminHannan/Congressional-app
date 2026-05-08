/**
 * Trace — Bite Scanner Screen
 *
 * Take a photo of a bite → guided visual assessment → risk classification.
 *
 * Flow:
 * 1. Take or select a photo
 * 2. Answer guided questions about what you see
 * 3. Get a classification + recommended actions
 * 4. Save the scan to your symptom log
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  analyzeBite,
  ScanAnswers,
  ScanResult,
  EMPTY_SCAN_ANSWERS,
  isMLModelConfigured,
  classifyWithML,
} from '@/lib/bite-scanner';
import { T } from '@/lib/theme';

type Step = 'photo' | 'questions' | 'results';

// Question definitions for the guided assessment
const QUESTIONS: {
  key: keyof ScanAnswers;
  question: string;
  hint: string;
  options: { value: any; label: string }[];
}[] = [
  {
    key: 'shape',
    question: 'What shape is the affected area?',
    hint: 'Look at the overall outline of the redness or mark',
    options: [
      { value: 'circular', label: 'Circular / round' },
      { value: 'oval', label: 'Oval' },
      { value: 'irregular', label: 'Irregular / no clear shape' },
      { value: 'none', label: 'No visible mark' },
    ],
  },
  {
    key: 'redness',
    question: 'How red is the area?',
    hint: 'Compare to the surrounding normal skin',
    options: [
      { value: 'none', label: 'No redness' },
      { value: 'mild', label: 'Slightly pink' },
      { value: 'significant', label: 'Clearly red' },
      { value: 'spreading', label: 'Red and spreading outward' },
    ],
  },
  {
    key: 'centerClearing',
    question: 'Is there clearing in the center?',
    hint: 'A "bullseye" has a red outer ring with normal/clear skin in the middle',
    options: [
      { value: true, label: 'Yes — lighter in the center' },
      { value: false, label: 'No — evenly colored' },
    ],
  },
  {
    key: 'expanding',
    question: 'Has the area been growing or expanding?',
    hint: 'Tip: draw a pen circle around the edge to track over 24 hours',
    options: [
      { value: true, label: 'Yes, it\'s getting bigger' },
      { value: false, label: 'No, same size' },
    ],
  },
  {
    key: 'size',
    question: 'How large is the affected area?',
    hint: 'Estimate using a coin for reference',
    options: [
      { value: 'small', label: 'Small (< 2 cm / dime)' },
      { value: 'medium', label: 'Medium (2-5 cm / quarter to half dollar)' },
      { value: 'large', label: 'Large (> 5 cm / bigger than a half dollar)' },
    ],
  },
  {
    key: 'warmToTouch',
    question: 'Is the area warm to the touch?',
    hint: 'Feel it with the back of your hand and compare to nearby skin',
    options: [
      { value: true, label: 'Yes, noticeably warm' },
      { value: false, label: 'No, normal temperature' },
    ],
  },
  {
    key: 'tickVisible',
    question: 'Can you see a tick in or near the area?',
    hint: 'Ticks can be as small as a poppy seed (nymphs)',
    options: [
      { value: true, label: 'Yes, I can see a tick' },
      { value: false, label: 'No tick visible' },
    ],
  },
  {
    key: 'duration',
    question: 'When did you first notice this?',
    hint: 'Lyme rash (EM) typically appears 3-30 days after a bite',
    options: [
      { value: 'new', label: 'Just now / today' },
      { value: 'days', label: 'A few days ago' },
      { value: 'week_plus', label: 'A week or more ago' },
    ],
  },
];

const URGENCY_COLORS = {
  emergency: T.danger,
  urgent: T.warning,
  soon: T.primary,
  monitor: T.success,
};

const URGENCY_LABELS = {
  emergency: 'EMERGENCY',
  urgent: 'SEE A DOCTOR SOON',
  soon: 'SCHEDULE AN APPOINTMENT',
  monitor: 'MONITOR AT HOME',
};

export default function ScanScreen() {
  const [step, setStep] = useState<Step>('photo');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ScanAnswers>({ ...EMPTY_SCAN_ANSWERS });
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mlResult, setMlResult] = useState<{ label: string; confidence: number } | null>(null);

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
      setImageUri(result.assets[0].uri);
      setStep('questions');
      setCurrentQ(0);
      setAnswers({ ...EMPTY_SCAN_ANSWERS });

      // If ML model is configured, run it in parallel
      if (isMLModelConfigured()) {
        const ml = await classifyWithML(result.assets[0].uri);
        setMlResult(ml);
      }
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
      setImageUri(result.assets[0].uri);
      setStep('questions');
      setCurrentQ(0);
      setAnswers({ ...EMPTY_SCAN_ANSWERS });

      if (isMLModelConfigured()) {
        const ml = await classifyWithML(result.assets[0].uri);
        setMlResult(ml);
      }
    }
  }

  function answerQuestion(value: any) {
    const q = QUESTIONS[currentQ];
    setAnswers((prev) => ({ ...prev, [q.key]: value }));

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // All questions answered — calculate result
      const updatedAnswers = { ...answers, [q.key]: value };
      const analysis = analyzeBite(updatedAnswers);
      setResult(analysis);
      setStep('results');
    }
  }

  function reset() {
    setStep('photo');
    setImageUri(null);
    setAnswers({ ...EMPTY_SCAN_ANSWERS });
    setCurrentQ(0);
    setResult(null);
    setMlResult(null);
  }

  // ─── Photo Step ────────────────────────────────────────────────────────
  if (step === 'photo') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.photoHeader}>
            <MaterialIcons name="photo-camera" size={48} color={T.primary} />
            <Text style={styles.photoTitle}>Scan a Bite or Rash</Text>
            <Text style={styles.photoDesc}>
              Take a close-up photo of the affected area. Place a coin next
              to it for scale if possible. Then answer a few questions about
              what you see.
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
              <MaterialIcons name="monetization-on" size={16} color={T.primary} />
              <Text style={styles.tipText}>Place a coin next to the area for size reference</Text>
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

  // ─── Questions Step ────────────────────────────────────────────────────
  if (step === 'questions') {
    const q = QUESTIONS[currentQ];
    const progress = ((currentQ + 1) / QUESTIONS.length) * 100;

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Photo preview */}
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          )}

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Question {currentQ + 1} of {QUESTIONS.length}
          </Text>

          {/* Question */}
          <Text style={styles.question}>{q.question}</Text>
          <Text style={styles.questionHint}>{q.hint}</Text>

          {/* Options */}
          {q.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={styles.answerOption}
              onPress={() => answerQuestion(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.answerText}>{opt.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color={T.textMuted} />
            </TouchableOpacity>
          ))}

          {/* Back button */}
          {currentQ > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCurrentQ(currentQ - 1)}
            >
              <MaterialIcons name="arrow-back" size={18} color={T.textSecondary} />
              <Text style={styles.backText}>Previous question</Text>
            </TouchableOpacity>
          )}
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
          {/* Photo */}
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.resultImage} />
          )}

          {/* Classification badge */}
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
            <Text style={styles.urgencyText}>{urgencyLabel}</Text>
          </View>

          {/* Result card */}
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.title}</Text>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence:</Text>
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

          {/* ML Model result (if configured) */}
          {mlResult && (
            <View style={styles.mlCard}>
              <MaterialIcons name="smart-toy" size={20} color={T.primary} />
              <View style={{ flex: 1, marginLeft: T.sm }}>
                <Text style={styles.mlTitle}>AI Model Classification</Text>
                <Text style={styles.mlText}>
                  {mlResult.label} ({mlResult.confidence}% confidence)
                </Text>
              </View>
            </View>
          )}

          {/* Recommended actions */}
          <Text style={styles.actionsTitle}>Recommended Actions</Text>
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
            <Text style={styles.scanAgainText}>Scan Another Area</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.resetText}>Done</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            This scan is for educational purposes only. It does not replace
            clinical evaluation. A visual assessment cannot diagnose Lyme
            disease — only a healthcare provider can make a diagnosis.
            If you are concerned, see a doctor.
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

  // Questions step
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: T.radius,
    marginBottom: T.md,
    backgroundColor: T.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    marginBottom: T.xs,
  },
  progressFill: {
    height: 4,
    backgroundColor: T.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: T.fontXs,
    color: T.textMuted,
    marginBottom: T.lg,
  },
  question: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.xs,
  },
  questionHint: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.md,
    lineHeight: 20,
  },
  answerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.card,
    borderRadius: T.radiusSm,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  answerText: {
    fontSize: T.fontMd,
    color: T.text,
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.xs,
    marginTop: T.md,
    padding: T.sm,
  },
  backText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
  },

  // Results step
  resultImage: {
    width: '100%',
    height: 220,
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
  mlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.primaryFaint,
    borderRadius: T.radiusSm,
    padding: T.md,
    marginBottom: T.md,
  },
  mlTitle: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.primaryDark,
  },
  mlText: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    marginTop: 2,
  },
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
  resetButton: {
    alignItems: 'center',
    padding: T.md,
    marginTop: T.sm,
  },
  resetText: {
    color: T.textSecondary,
    fontSize: T.fontMd,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.lg,
    lineHeight: 18,
  },
});
