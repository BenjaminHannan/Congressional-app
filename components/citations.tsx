/**
 * Trace — Citations component
 *
 * Compact, tappable source line that expands to full citations.
 * Used on the advocacy modal and the check-result card so users
 * (and CAC judges) can see exactly what every clinical claim is
 * grounded in.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { T } from '@/lib/theme';

type Reference = {
  label: string;
  url: string;
};

const REFERENCES: Reference[] = [
  {
    label:
      'Lantos PM, et al. Clinical Practice Guidelines by the IDSA, AAN, and ACR: ' +
      '2020 Guidelines for the Prevention, Diagnosis, and Treatment of Lyme Disease. ' +
      'Clinical Infectious Diseases, 2021;72(1):e1–e48.',
    url: 'https://www.idsociety.org/practice-guideline/lyme-disease/',
  },
  {
    label:
      'CDC. Lyme Disease Surveillance Data, 2019–2023. National Notifiable Diseases ' +
      'Surveillance System. Atlanta: U.S. Department of Health and Human Services.',
    url: 'https://www.cdc.gov/lyme/data-research/facts-stats/',
  },
];

const SHORT_LINE =
  'Sources: IDSA 2020 Lyme Disease Clinical Practice Guidelines · CDC Lyme Surveillance Data 2019–2023.';

export function Citations() {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide full citations' : 'Show full citations'}
      >
        <View style={styles.line}>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={16}
            color={T.textSecondary}
          />
          <Text style={styles.shortText}>{SHORT_LINE}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expanded}>
          {REFERENCES.map((ref, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => Linking.openURL(ref.url)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel={`Open citation ${i + 1}`}
            >
              <Text style={styles.refText}>
                [{i + 1}] {ref.label}
              </Text>
              <Text style={styles.refUrl}>{ref.url}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: T.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  shortText: {
    flex: 1,
    fontSize: T.fontXs,
    color: T.textSecondary,
    lineHeight: 18,
  },
  expanded: {
    marginTop: T.sm,
    padding: T.sm,
    backgroundColor: T.card,
    borderRadius: T.radiusSm,
    borderWidth: 1,
    borderColor: T.border,
    gap: T.sm,
  },
  refText: {
    fontSize: T.fontXs,
    color: T.text,
    lineHeight: 18,
  },
  refUrl: {
    fontSize: 11,
    color: T.primary,
    marginTop: 2,
    textDecorationLine: 'underline',
  },
});
