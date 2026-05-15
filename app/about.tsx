/**
 * Trace — About Screen
 *
 * Reachable from the small info icon in the home tab header.
 * States app identity, author, and the medical disclaimer.
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { T } from '@/lib/theme';

// Pulls the app version from app.json at build time.
const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.closeRow}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close about screen"
        >
          <MaterialIcons name="close" size={24} color={T.textSecondary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>🔬</Text>
          <Text style={styles.appName}>Trace</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Built by</Text>
          <Text style={styles.value}>Benjamin Hannan</Text>
          <Text style={styles.subValue}>Hanover, NH</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Submission</Text>
          <Text style={styles.value}>Congressional App Challenge</Text>
          <Text style={styles.subValue}>NH-02 · 2026</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Source</Text>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL('https://github.com/BenjaminHannan/Congressional-app')
            }
            accessibilityRole="link"
            accessibilityLabel="Open project repository on GitHub"
          >
            <Text style={styles.link}>
              github.com/BenjaminHannan/Congressional-app
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.mlLink}
          onPress={() => router.push('/ml-explainability' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open ML model details"
          activeOpacity={0.7}
        >
          <MaterialIcons name="psychology" size={22} color={T.primary} />
          <View style={styles.mlLinkText}>
            <Text style={styles.mlLinkTitle}>How the AI works</Text>
            <Text style={styles.mlLinkDesc}>
              Metrics, calibration, feature importances, model card
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={T.textMuted} />
        </TouchableOpacity>

        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>Medical disclaimer</Text>
          <Text style={styles.disclaimerText}>
            Trace is not a medical device and does not diagnose disease.
            It organizes information for you and your clinician.
            In an emergency, call 911.
          </Text>
        </View>

        <Text style={styles.privacy}>
          🔒 All data stays on this device. No accounts, no cloud,
          no analytics, no telemetry. The doctor-report PDF is generated
          locally and only leaves the phone if you share it.
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
    marginBottom: T.xl,
  },
  logo: {
    fontSize: 48,
    marginBottom: T.sm,
  },
  appName: {
    fontSize: T.fontHero,
    fontWeight: '700',
    color: T.primaryDark,
    letterSpacing: 1,
  },
  version: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginTop: T.xs,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  label: {
    fontSize: T.fontXs,
    color: T.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
  },
  subValue: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginTop: 2,
  },
  link: {
    fontSize: T.fontSm,
    color: T.primary,
    textDecorationLine: 'underline',
  },
  mlLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.md,
    borderWidth: 1,
    borderColor: T.primaryLight,
    gap: T.sm,
  },
  mlLinkText: { flex: 1 },
  mlLinkTitle: { fontSize: T.fontMd, fontWeight: '700', color: T.primaryDark },
  mlLinkDesc: { fontSize: T.fontXs, color: T.textSecondary, marginTop: 2 },
  disclaimerCard: {
    backgroundColor: T.warningBg,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.md,
    marginBottom: T.md,
    borderLeftWidth: 4,
    borderLeftColor: T.warning,
  },
  disclaimerTitle: {
    fontSize: T.fontSm,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.xs,
  },
  disclaimerText: {
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 20,
  },
  privacy: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.md,
    lineHeight: 18,
  },
});
