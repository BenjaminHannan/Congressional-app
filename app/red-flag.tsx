/**
 * Trace — Red Flag Alert Modal
 *
 * Shown when the user logs a red-flag symptom:
 * - Facial droop (Bell's palsy)
 * - Severe headache + neck stiffness (Lyme meningitis)
 * - Heart palpitations + fatigue (Lyme carditis)
 *
 * These symptoms require IMMEDIATE medical attention.
 * This modal cannot be casually dismissed.
 */

import { useState, useEffect } from 'react';
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
import * as Haptics from 'expo-haptics';
import { getSymptomLogs } from '@/lib/storage';
import { getRedFlags } from '@/lib/symptoms';
import { SymptomInfo } from '@/lib/types';
import { T } from '@/lib/theme';

export default function RedFlagModal() {
  const router = useRouter();
  const [redFlags, setRedFlags] = useState<SymptomInfo[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    // Warning haptic so the user feels the urgency the moment the modal
    // appears, even if they're glancing away from the screen.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {
        // Haptics aren't available on web / some emulators — fail silently.
      }
    );

    async function load() {
      const logs = await getSymptomLogs();
      if (logs.length > 0) {
        setRedFlags(getRedFlags(logs[0].symptoms));
      }
    }
    load();
  }, []);

  function handleCall911() {
    Linking.openURL('tel:911');
  }

  function handleCall211() {
    Linking.openURL('tel:211');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="error" size={48} color={T.danger} />
          <Text style={styles.headerTitle}>Urgent: Red Flag Symptoms</Text>
          <Text style={styles.headerDesc}>
            Some of your symptoms may require immediate medical attention.
            Please read carefully.
          </Text>
        </View>

        {/* Red flag details */}
        {redFlags.map((flag, i) => (
          <View key={i} style={styles.flagCard}>
            <View style={styles.flagHeader}>
              <MaterialIcons name="warning" size={20} color={T.danger} />
              <Text style={styles.flagTitle}>{flag.label}</Text>
            </View>
            <Text style={styles.flagMessage}>
              {flag.redFlagMessage}
            </Text>
          </View>
        ))}

        {redFlags.length === 0 && (
          <View style={styles.flagCard}>
            <Text style={styles.flagMessage}>
              No active red-flag symptoms detected. You can close this screen.
            </Text>
          </View>
        )}

        {/* Emergency buttons */}
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={handleCall911}
          activeOpacity={0.8}
        >
          <MaterialIcons name="phone" size={24} color={T.white} />
          <Text style={styles.emergencyText}>Call 911</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.healthLine}
          onPress={handleCall211}
          activeOpacity={0.8}
        >
          <MaterialIcons name="phone" size={20} color={T.primary} />
          <Text style={styles.healthLineText}>
            Call 211 (NH Health Services)
          </Text>
        </TouchableOpacity>

        {/* Acknowledge and close */}
        {!acknowledged ? (
          <TouchableOpacity
            style={styles.acknowledgeButton}
            onPress={() => setAcknowledged(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.acknowledgeText}>
              I understand — show close button
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.disclaimer}>
          Trace is not a diagnostic tool. If you are experiencing a medical
          emergency, call 911 immediately. This information is based on CDC
          and IDSA guidelines and is for educational purposes only.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.dangerBg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  header: {
    alignItems: 'center',
    marginBottom: T.lg,
    paddingTop: T.md,
  },
  headerTitle: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.danger,
    marginTop: T.md,
    textAlign: 'center',
  },
  headerDesc: {
    fontSize: T.fontSm,
    color: T.text,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 22,
  },
  flagCard: {
    backgroundColor: T.white,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.dangerLight,
  },
  flagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
    marginBottom: T.sm,
  },
  flagTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.danger,
  },
  flagMessage: {
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 22,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.danger,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.lg,
    gap: T.sm,
  },
  emergencyText: {
    color: T.white,
    fontSize: T.fontLg,
    fontWeight: '700',
  },
  healthLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.white,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.sm,
    gap: T.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  healthLineText: {
    color: T.primary,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  acknowledgeButton: {
    alignItems: 'center',
    padding: T.md,
    marginTop: T.lg,
  },
  acknowledgeText: {
    color: T.textSecondary,
    fontSize: T.fontSm,
    textDecorationLine: 'underline',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: T.white,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.lg,
    borderWidth: 1,
    borderColor: T.border,
  },
  closeText: {
    color: T.text,
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
