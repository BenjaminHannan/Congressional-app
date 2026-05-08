/**
 * Trace — Entry Router
 *
 * Checks if the user has completed onboarding.
 * If yes → go to tabs. If no → go to welcome screen.
 */

import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getProfile } from '@/lib/storage';
import { T } from '@/lib/theme';

export default function EntryRouter() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const profile = await getProfile();
        if (profile?.onboardingComplete) {
          router.replace('/(tabs)');
        } else {
          router.replace('/welcome');
        }
      } catch {
        router.replace('/welcome');
      } finally {
        setLoading(false);
      }
    }
    checkOnboarding();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={T.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: T.bg,
  },
});
