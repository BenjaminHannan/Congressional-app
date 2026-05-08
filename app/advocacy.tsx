/**
 * Trace — "I Was Told It's a Virus" Advocacy Modal
 *
 * Evidence-based language patients can bring to their doctor.
 * Every tip is grounded in CDC/IDSA guidance.
 *
 * This feature exists because Benjamin was told "they had no idea
 * what I had" and lost three weeks to an undiagnosed Lyme infection.
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getAdvocacyTips } from '@/lib/risk-engine';
import { T } from '@/lib/theme';

export default function AdvocacyModal() {
  const router = useRouter();
  const tips = getAdvocacyTips();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <TouchableOpacity
          style={styles.closeRow}
          onPress={() => router.back()}
        >
          <MaterialIcons name="close" size={24} color={T.textSecondary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <MaterialIcons
            name="record-voice-over"
            size={40}
            color={T.primaryDark}
          />
          <Text style={styles.headerTitle}>
            "I was told it's a virus"
          </Text>
          <Text style={styles.headerDesc}>
            If your doctor is dismissing your symptoms, here's how to advocate
            for yourself — with evidence, not argument.
          </Text>
        </View>

        {/* Tips */}
        {tips.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <View style={styles.tipNumber}>
              <Text style={styles.tipNumberText}>{i + 1}</Text>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          </View>
        ))}

        {/* Key facts */}
        <View style={styles.factsSection}>
          <Text style={styles.factsTitle}>Key Facts to Know</Text>

          <View style={styles.factItem}>
            <MaterialIcons name="info" size={16} color={T.primary} />
            <Text style={styles.factText}>
              ~20-30% of Lyme patients never develop the classic bullseye rash.
              Absence of rash does NOT rule out Lyme.
            </Text>
          </View>

          <View style={styles.factItem}>
            <MaterialIcons name="info" size={16} color={T.primary} />
            <Text style={styles.factText}>
              The two-tier blood test can be negative for 2-4 weeks after
              infection because antibodies need time to develop.
            </Text>
          </View>

          <View style={styles.factItem}>
            <MaterialIcons name="info" size={16} color={T.primary} />
            <Text style={styles.factText}>
              IDSA 2020 guidelines support empirical doxycycline treatment in
              endemic areas based on clinical suspicion alone.
            </Text>
          </View>

          <View style={styles.factItem}>
            <MaterialIcons name="info" size={16} color={T.primary} />
            <Text style={styles.factText}>
              New Hampshire has one of the highest Lyme disease incidence rates
              in the country — approximately 14x the national average.
            </Text>
          </View>
        </View>

        {/* Generate report CTA */}
        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>
            Bring data, not just words
          </Text>
          <Text style={styles.ctaDesc}>
            The Doctor Report PDF includes your dated symptom timeline,
            exposure context, and clinical references. Doctors take documented
            data more seriously than verbal descriptions.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/(tabs)/report'), 100);
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="description" size={20} color={T.white} />
            <Text style={styles.ctaButtonText}>Go to Report</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          These tips are based on publicly available CDC and IDSA clinical
          guidance. They are educational and do not constitute medical or legal
          advice. Your doctor has clinical context that this app does not.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  closeRow: {
    alignSelf: 'flex-end',
    padding: T.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: T.lg,
  },
  headerTitle: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
    marginTop: T.md,
    textAlign: 'center',
  },
  headerDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 22,
  },
  // Tips
  tipCard: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.primaryFaint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: T.md,
    marginTop: 2,
  },
  tipNumberText: {
    fontSize: T.fontSm,
    fontWeight: '700',
    color: T.primaryDark,
  },
  tipContent: { flex: 1 },
  tipTitle: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
    marginBottom: T.xs,
  },
  tipText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 22,
  },
  // Facts
  factsSection: {
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.md,
    marginBottom: T.lg,
  },
  factsTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.primaryDark,
    marginBottom: T.sm,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.sm,
    marginBottom: T.sm,
  },
  factText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 20,
  },
  // CTA
  ctaCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.lg,
    marginBottom: T.lg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  ctaDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: T.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radiusSm,
    paddingHorizontal: T.lg,
    paddingVertical: T.sm,
    gap: T.sm,
  },
  ctaButtonText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  // Disclaimer
  disclaimer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
