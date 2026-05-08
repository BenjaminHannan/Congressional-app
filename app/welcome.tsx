/**
 * Trace — Welcome / Onboarding Screen
 *
 * First thing users see. Three entry paths:
 * 1. "I just got bitten" — exposure-first flow
 * 2. "Something doesn't feel right" — symptom-first flow
 * 3. "I'm tracking after diagnosis" — monitoring flow
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { saveProfile } from '@/lib/storage';
import { EntryPath } from '@/lib/types';
import { T } from '@/lib/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedPath, setSelectedPath] = useState<EntryPath | null>(null);

  const paths: { key: EntryPath; emoji: string; title: string; desc: string }[] = [
    {
      key: 'bitten',
      emoji: '🔍',
      title: 'I found a tick on me',
      desc: 'Log the exposure and start tracking symptoms',
    },
    {
      key: 'not_feeling_right',
      emoji: '🤒',
      title: "Something doesn't feel right",
      desc: "I have symptoms and I'm not sure what's going on",
    },
    {
      key: 'tracking',
      emoji: '📋',
      title: "I'm already diagnosed",
      desc: 'Track my recovery and symptoms over time',
    },
  ];

  async function handleContinue() {
    if (!selectedPath) return;

    await saveProfile({
      onboardingComplete: false, // will set true after exposure form
      entryPath: selectedPath,
      name: name.trim(),
      startDate: new Date().toISOString(),
    });

    router.push('/exposure-form');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo area */}
          <View style={styles.logoArea}>
            <Text style={styles.logoIcon}>🔬</Text>
            <Text style={styles.logoText}>Trace</Text>
            <Text style={styles.tagline}>
              Track symptoms. Build your case.{'\n'}Get the diagnosis you deserve.
            </Text>
          </View>

          {/* Name input */}
          <View style={styles.section}>
            <Text style={styles.label}>Your first name</Text>
            <TextInput
              style={styles.input}
              placeholder="First name (optional)"
              placeholderTextColor={T.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          {/* Entry path selection */}
          <View style={styles.section}>
            <Text style={styles.label}>What brings you here?</Text>
            {paths.map((path) => (
              <TouchableOpacity
                key={path.key}
                style={[
                  styles.pathCard,
                  selectedPath === path.key && styles.pathCardSelected,
                ]}
                onPress={() => setSelectedPath(path.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.pathEmoji}>{path.emoji}</Text>
                <View style={styles.pathTextArea}>
                  <Text
                    style={[
                      styles.pathTitle,
                      selectedPath === path.key && styles.pathTitleSelected,
                    ]}
                  >
                    {path.title}
                  </Text>
                  <Text style={styles.pathDesc}>{path.desc}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    selectedPath === path.key && styles.radioSelected,
                  ]}
                >
                  {selectedPath === path.key && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Continue button */}
          <TouchableOpacity
            style={[styles.button, !selectedPath && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!selectedPath}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          {/* Privacy note */}
          <Text style={styles.privacy}>
            🔒 Your data stays on your device. No accounts, no cloud,{'\n'}
            no tracking. Privacy is a feature.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  flex: { flex: 1 },
  scroll: {
    padding: T.lg,
    paddingTop: T.xxl,
    paddingBottom: T.xxl,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: T.xl,
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: T.sm,
  },
  logoText: {
    fontSize: T.fontHero,
    fontWeight: '700',
    color: T.primaryDark,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 20,
  },
  section: {
    marginBottom: T.lg,
  },
  label: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
    marginBottom: T.sm,
  },
  input: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    fontSize: T.fontMd,
    color: T.text,
  },
  pathCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderWidth: 1.5,
    borderColor: T.border,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
  },
  pathCardSelected: {
    borderColor: T.primary,
    backgroundColor: T.primaryFaint,
  },
  pathEmoji: {
    fontSize: 28,
    marginRight: T.md,
  },
  pathTextArea: {
    flex: 1,
  },
  pathTitle: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
  },
  pathTitleSelected: {
    color: T.primaryDark,
  },
  pathDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: T.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: T.sm,
  },
  radioSelected: {
    borderColor: T.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.primary,
  },
  button: {
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    alignItems: 'center',
    marginTop: T.sm,
  },
  buttonDisabled: {
    backgroundColor: T.textMuted,
  },
  buttonText: {
    color: T.white,
    fontSize: T.fontLg,
    fontWeight: '600',
  },
  privacy: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.lg,
    lineHeight: 18,
  },
});
