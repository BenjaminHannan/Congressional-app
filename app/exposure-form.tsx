/**
 * Trace — Exposure Assessment Form
 *
 * Captures the user's exposure context. Even if they never saw a tick,
 * this data helps build the clinical picture.
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
import { saveExposure, saveProfile, getProfile } from '@/lib/storage';
import { ExposureData, TickFoundStatus, RashStatus, LocationRisk } from '@/lib/types';
import { NH_COUNTIES } from '@/lib/nh-data';
import { T } from '@/lib/theme';

type OptionItem<V> = { value: V; label: string };

function OptionGroup<V extends string>({
  options,
  selected,
  onSelect,
}: {
  options: OptionItem<V>[];
  selected: V | null;
  onSelect: (v: V) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.optionChip,
            selected === opt.value && styles.optionChipSelected,
          ]}
          onPress={() => onSelect(opt.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.optionText,
              selected === opt.value && styles.optionTextSelected,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ExposureFormScreen() {
  const router = useRouter();

  const [dateFirstSymptoms, setDateFirstSymptoms] = useState('');
  const [outdoorActivity, setOutdoorActivity] = useState<boolean | null>(null);
  const [activityDetails, setActivityDetails] = useState('');
  const [locationRisk, setLocationRisk] = useState<LocationRisk>('nh');
  const [county, setCounty] = useState('Grafton'); // Default for Hanover
  const [foundTick, setFoundTick] = useState<TickFoundStatus | null>(null);
  const [rashStatus, setRashStatus] = useState<RashStatus | null>(null);
  const [nearWoods, setNearWoods] = useState<boolean | null>(null);
  const [petsOutdoor, setPetsOutdoor] = useState<boolean | null>(null);

  async function handleFinish() {
    const exposure: ExposureData = {
      dateFirstSymptoms: dateFirstSymptoms || new Date().toISOString().slice(0, 10),
      outdoorActivity: outdoorActivity ?? false,
      activityDetails,
      locationRisk,
      county,
      foundTick: foundTick ?? 'unsure',
      rashStatus: rashStatus ?? 'no',
      recentFluLike: false,
      petsOutdoor: petsOutdoor ?? false,
      nearWoods: nearWoods ?? false,
    };

    await saveExposure(exposure);

    // Mark onboarding complete
    const profile = await getProfile();
    if (profile) {
      await saveProfile({ ...profile, onboardingComplete: true });
    }

    router.replace('/(tabs)');
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
          <Text style={styles.title}>Exposure Assessment</Text>
          <Text style={styles.subtitle}>
            Even if you never saw a tick, this information helps build your clinical picture.
            Answer as best you can — you can update these later.
          </Text>

          {/* When did symptoms start */}
          <View style={styles.field}>
            <Text style={styles.label}>When did you first notice something wrong?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2 weeks ago, June 15"
              placeholderTextColor={T.textMuted}
              value={dateFirstSymptoms}
              onChangeText={setDateFirstSymptoms}
            />
          </View>

          {/* Outdoor activity */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Any outdoor activity in the last 60 days?
            </Text>
            <Text style={styles.hint}>
              Hiking, gardening, camping, sports on grass, walking in woods
            </Text>
            <OptionGroup
              options={[
                { value: 'yes' as string, label: 'Yes' },
                { value: 'no' as string, label: 'No' },
              ]}
              selected={outdoorActivity === null ? null : outdoorActivity ? 'yes' : 'no'}
              onSelect={(v) => setOutdoorActivity(v === 'yes')}
            />
            {outdoorActivity && (
              <TextInput
                style={[styles.input, { marginTop: T.sm }]}
                placeholder="What and where? (e.g., hiking in White Mountains)"
                placeholderTextColor={T.textMuted}
                value={activityDetails}
                onChangeText={setActivityDetails}
              />
            )}
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Where do you live?</Text>
            <OptionGroup
              options={[
                { value: 'nh' as LocationRisk, label: 'New Hampshire' },
                { value: 'other_endemic' as LocationRisk, label: 'Other Northeast/Midwest' },
                { value: 'non_endemic' as LocationRisk, label: 'Other US region' },
              ]}
              selected={locationRisk}
              onSelect={setLocationRisk}
            />
            {locationRisk === 'nh' && (
              <View style={styles.countyPicker}>
                <Text style={[styles.hint, { marginBottom: T.sm }]}>NH County:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {NH_COUNTIES.map((c) => (
                    <TouchableOpacity
                      key={c.name}
                      style={[
                        styles.countyChip,
                        county === c.name && styles.countyChipSelected,
                      ]}
                      onPress={() => setCounty(c.name)}
                    >
                      <Text
                        style={[
                          styles.countyText,
                          county === c.name && styles.countyTextSelected,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Tick found */}
          <View style={styles.field}>
            <Text style={styles.label}>Did you find a tick on you?</Text>
            <OptionGroup
              options={[
                { value: 'no' as TickFoundStatus, label: 'No' },
                { value: 'yes_removed' as TickFoundStatus, label: 'Yes, removed it' },
                { value: 'yes_attached' as TickFoundStatus, label: 'Yes, still attached' },
                { value: 'unsure' as TickFoundStatus, label: 'Not sure' },
              ]}
              selected={foundTick}
              onSelect={setFoundTick}
            />
          </View>

          {/* Rash */}
          <View style={styles.field}>
            <Text style={styles.label}>Have you noticed any unusual rash?</Text>
            <OptionGroup
              options={[
                { value: 'no' as RashStatus, label: 'No rash' },
                { value: 'circular' as RashStatus, label: 'Circular / bullseye' },
                { value: 'other' as RashStatus, label: 'Other rash' },
                { value: 'unsure' as RashStatus, label: 'Not sure' },
              ]}
              selected={rashStatus}
              onSelect={setRashStatus}
            />
          </View>

          {/* Environment */}
          <View style={styles.field}>
            <Text style={styles.label}>Do you live or spend time near woods or tall grass?</Text>
            <OptionGroup
              options={[
                { value: 'yes' as string, label: 'Yes' },
                { value: 'no' as string, label: 'No' },
              ]}
              selected={nearWoods === null ? null : nearWoods ? 'yes' : 'no'}
              onSelect={(v) => setNearWoods(v === 'yes')}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Do you have pets that go outside?</Text>
            <OptionGroup
              options={[
                { value: 'yes' as string, label: 'Yes' },
                { value: 'no' as string, label: 'No' },
              ]}
              selected={petsOutdoor === null ? null : petsOutdoor ? 'yes' : 'no'}
              onSelect={(v) => setPetsOutdoor(v === 'yes')}
            />
          </View>

          {/* Finish */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleFinish}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Start Tracking</Text>
          </TouchableOpacity>

          <Text style={styles.editLater}>
            You can update these answers anytime from the Report tab.
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
    paddingTop: T.xl,
    paddingBottom: T.xxl,
  },
  title: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.xs,
  },
  subtitle: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.lg,
    lineHeight: 20,
  },
  field: {
    marginBottom: T.lg,
  },
  label: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
    marginBottom: T.sm,
  },
  hint: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.xs,
  },
  input: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusSm,
    padding: T.md,
    fontSize: T.fontMd,
    color: T.text,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.sm,
  },
  optionChip: {
    paddingHorizontal: T.md,
    paddingVertical: 10,
    borderRadius: T.radiusFull,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.card,
  },
  optionChipSelected: {
    borderColor: T.primary,
    backgroundColor: T.primaryFaint,
  },
  optionText: {
    fontSize: T.fontSm,
    fontWeight: '500',
    color: T.textSecondary,
  },
  optionTextSelected: {
    color: T.primaryDark,
    fontWeight: '600',
  },
  countyPicker: {
    marginTop: T.sm,
  },
  countyChip: {
    paddingHorizontal: T.md,
    paddingVertical: T.sm,
    borderRadius: T.radiusFull,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    marginRight: T.sm,
  },
  countyChipSelected: {
    borderColor: T.primary,
    backgroundColor: T.primaryLight,
  },
  countyText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
  },
  countyTextSelected: {
    color: T.primaryDark,
    fontWeight: '600',
  },
  button: {
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    alignItems: 'center',
    marginTop: T.sm,
  },
  buttonText: {
    color: T.white,
    fontSize: T.fontLg,
    fontWeight: '600',
  },
  editLater: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.md,
  },
});
