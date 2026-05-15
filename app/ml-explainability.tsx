/**
 * Trace — ML Explainability Screen
 *
 * "How the AI works" panel reachable from About. Shows the held-out metrics
 * for the fusion risk model and temporal GRU, the confusion matrix, a
 * reliability diagram, an example trajectory rollout, and a plain-language
 * model card with known limitations.
 *
 * Everything rendered here loads from JSON assets bundled at build time
 * (assets/ml-metrics/). No runtime computation, no external dependencies.
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
import { T } from '@/lib/theme';

// Wrapped so that a missing/corrupt metrics asset shows a graceful empty
// state instead of crashing the whole screen on mount.
let FUSION: any = null;
let TEMPORAL: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FUSION = require('../assets/ml-metrics/fusion_metrics.json');
} catch {}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TEMPORAL = require('../assets/ml-metrics/temporal_metrics.json');
} catch {}

interface FusionMetrics {
  accuracy: number;
  log_loss: number;
  brier_mean: number;
  brier_early_lyme: number;
  brier_disseminated_lyme: number;
  auc_macro: number;
  n_train: number;
  n_test: number;
  classes: string[];
  confusion_matrix: number[][];
  reliability_diagram_early_lyme: {
    bins: { p_pred: number; p_emp: number; n: number }[];
  };
  classification_report: Record<string, { precision: number; recall: number; 'f1-score': number }>;
  feature_names: string[];
  feature_importances: number[];
}

interface TemporalMetrics {
  auc: number;
  brier: number;
  val_loss: number;
  n_train: number;
  n_test: number;
  n_params: number;
  seq_len: number;
  example_input: number[][];
  example_per_step_prob: number[];
}

const fusion: FusionMetrics | null = FUSION;
const temporal: TemporalMetrics | null = TEMPORAL;

function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export default function MLExplainabilityScreen() {
  const router = useRouter();

  if (!fusion || !temporal) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity
            style={styles.closeRow}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close explainability screen"
          >
            <MaterialIcons name="close" size={24} color={T.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.h1}>How the AI works</Text>
          <Text style={styles.p}>
            ML metrics assets could not be loaded. Run the training pipeline
            (see docs/ML.md → Reproducibility) to regenerate them.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Top-5 feature importances for the fusion model
  const topFeatures = fusion.feature_names
    .map((name, i) => ({ name, importance: fusion.feature_importances[i] }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8);
  const maxImp = topFeatures[0]?.importance || 1;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.closeRow}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close explainability screen"
        >
          <MaterialIcons name="close" size={24} color={T.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.h1}>How the AI works</Text>
        <Text style={styles.subtitle}>
          Trace runs three models. All inference happens on this device.
        </Text>

        {/* ─── Section: CV head ─────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTag}><Text style={styles.sectionTagText}>1</Text></View>
            <Text style={styles.h2}>Bite Photo Classifier</Text>
          </View>
          <Text style={styles.p}>
            <Text style={styles.bold}>MobileNetV3-Large</Text> fine-tuned on
            ~14k images from the Kaggle Bug Bite Images dataset across 8
            classes (ants, bed bugs, chiggers, fleas, mosquitos, no-bite,
            spiders, ticks). Hosted on a self-hosted FastAPI server (optional;
            scan still works offline via the on-device questionnaire).
          </Text>
          <Text style={styles.p}>
            On the result screen, you can toggle a{' '}
            <Text style={styles.bold}>Grad-CAM</Text> overlay to see which
            pixels of the photo the model used to make its decision. Grad-CAM
            is computed by back-propagating the predicted class score through
            the last conv layer and weighting the activations.
          </Text>
        </View>

        {/* ─── Section: Fusion model ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTag}><Text style={styles.sectionTagText}>2</Text></View>
            <Text style={styles.h2}>Fusion Risk Model</Text>
          </View>
          <Text style={styles.p}>
            <Text style={styles.bold}>Gradient-boosted decision trees</Text>{' '}
            (80 stages, depth 3, sklearn 1.7). Takes 32 features — 14 binary
            symptoms, exposure flags, NH county incidence rate, log count —
            and produces a calibrated probability over three classes.
          </Text>

          {/* Headline metrics */}
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{pct(fusion.accuracy)}</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{fusion.auc_macro.toFixed(3)}</Text>
              <Text style={styles.statLabel}>AUC (macro)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{fusion.brier_mean.toFixed(3)}</Text>
              <Text style={styles.statLabel}>Brier (mean)</Text>
            </View>
          </View>
          <Text style={styles.helpText}>
            Held out on {fusion.n_test.toLocaleString()} synthetic patients
            (train n={fusion.n_train.toLocaleString()}). Brier is calibration
            error — lower is better. AUC is rank quality.
          </Text>

          {/* Confusion matrix */}
          <Text style={styles.h3}>Confusion matrix</Text>
          <ConfusionMatrix
            matrix={fusion.confusion_matrix}
            labels={fusion.classes}
          />

          {/* Reliability diagram */}
          <Text style={styles.h3}>Calibration (early-Lyme)</Text>
          <ReliabilityDiagram
            bins={fusion.reliability_diagram_early_lyme.bins}
          />
          <Text style={styles.helpText}>
            Each dot is a bin of predictions. A perfectly calibrated model
            lies on the diagonal — "when I say 60%, it's right 60% of the time".
          </Text>

          {/* Feature importances */}
          <Text style={styles.h3}>What the model uses</Text>
          {topFeatures.map((f) => (
            <View key={f.name} style={styles.impRow}>
              <Text style={styles.impLabel}>{f.name}</Text>
              <View style={styles.impBar}>
                <View
                  style={[
                    styles.impFill,
                    {
                      width: `${Math.max(2, Math.round((f.importance / maxImp) * 100))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.impPct}>{(f.importance * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>

        {/* ─── Section: Temporal model ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTag}><Text style={styles.sectionTagText}>3</Text></View>
            <Text style={styles.h2}>Temporal Trajectory Model</Text>
          </View>
          <Text style={styles.p}>
            <Text style={styles.bold}>Tiny GRU</Text> (1 layer, hidden=16, ~1.5k
            parameters). Given a sequence of daily symptom logs, it produces
            one probability per day — visualized as the sparkline on the
            Timeline tab.
          </Text>
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{temporal.auc.toFixed(3)}</Text>
              <Text style={styles.statLabel}>AUC</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{temporal.brier.toFixed(3)}</Text>
              <Text style={styles.statLabel}>Brier</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{temporal.n_params.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Params</Text>
            </View>
          </View>

          {temporal.example_per_step_prob.length > 0 && (
            <>
              <Text style={styles.h3}>Example positive trajectory</Text>
              <ExampleRollout per_step={temporal.example_per_step_prob} />
              <Text style={styles.helpText}>
                A representative Lyme trajectory from the held-out set. The
                curve climbs as the model accumulates evidence — exactly what
                we want a trajectory model to do.
              </Text>
            </>
          )}
        </View>

        {/* ─── Section: Model card ───────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTag, { backgroundColor: T.warning }]}>
              <Text style={styles.sectionTagText}>i</Text>
            </View>
            <Text style={styles.h2}>Limitations</Text>
          </View>
          <Text style={styles.p}>
            <Text style={styles.bold}>Synthetic data.</Text> The fusion and
            temporal models are trained on synthetic cohorts grounded in IDSA
            2020 and CDC surveillance priors — not real patient records. The
            published metrics describe how well the models recover the
            published priors, not how well they would perform on real-world
            clinical data, which would require an IRB-approved study.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.bold}>Demographic skew.</Text> The CV model's
            EM-rash training data is dominated by light-skinned subjects.
            Erythema migrans appears differently on darker skin, and the model
            should be retrained with a balanced dataset before deployment to a
            general population.
          </Text>
          <Text style={styles.p}>
            <Text style={styles.bold}>Not a diagnostic device.</Text> Trace
            organizes information for a clinician — it does not replace one.
            The fusion model's headline probability is a screening signal,
            not a diagnosis.
          </Text>
        </View>

        <Text style={styles.footer}>
          Full model card at docs/ML.md in the project repository.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Inline visualizations ──────────────────────────────────────────────────

function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const max = Math.max(...matrix.flat());
  return (
    <View style={cmStyles.wrap}>
      <View style={cmStyles.headerRow}>
        <View style={cmStyles.corner} />
        {labels.map((l) => (
          <View key={l} style={cmStyles.headerCell}>
            <Text style={cmStyles.headerText}>{l.replace('_', ' ')}</Text>
          </View>
        ))}
      </View>
      {matrix.map((row, i) => (
        <View key={i} style={cmStyles.row}>
          <View style={cmStyles.rowLabel}>
            <Text style={cmStyles.headerText}>{labels[i].replace('_', ' ')}</Text>
          </View>
          {row.map((v, j) => {
            const intensity = max > 0 ? v / max : 0;
            return (
              <View
                key={j}
                style={[
                  cmStyles.cell,
                  {
                    backgroundColor: `rgba(13, 148, 136, ${0.1 + intensity * 0.8})`,
                  },
                ]}
              >
                <Text
                  style={[
                    cmStyles.cellText,
                    { color: intensity > 0.5 ? T.white : T.text },
                  ]}
                >
                  {v}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const cmStyles = StyleSheet.create({
  wrap: {
    marginVertical: T.sm,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusSm,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row' },
  corner: { width: 90 },
  headerCell: {
    flex: 1,
    padding: 6,
    backgroundColor: T.primaryFaint,
    alignItems: 'center',
  },
  headerText: { fontSize: 10, fontWeight: '700', color: T.text },
  row: { flexDirection: 'row' },
  rowLabel: {
    width: 90,
    padding: 6,
    backgroundColor: T.primaryFaint,
    justifyContent: 'center',
  },
  cell: { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: T.fontSm, fontWeight: '700' },
});

function ReliabilityDiagram({
  bins,
}: {
  bins: { p_pred: number; p_emp: number; n: number }[];
}) {
  const size = 160;
  return (
    <View style={[reliStyles.canvas, { height: size, width: size }]}>
      {/* Diagonal */}
      <View style={[reliStyles.diagonal, { width: Math.SQRT2 * size }]} />
      {bins.map((b, i) => {
        const x = b.p_pred * size;
        const y = (1 - b.p_emp) * size; // invert y so 0 is bottom
        const r = Math.max(6, Math.min(18, Math.log10(b.n + 10) * 6));
        return (
          <View
            key={i}
            style={[
              reliStyles.dot,
              {
                left: x - r / 2,
                top: y - r / 2,
                width: r,
                height: r,
                borderRadius: r / 2,
              },
            ]}
          />
        );
      })}
      <Text style={reliStyles.xLabel}>Predicted →</Text>
      <Text style={reliStyles.yLabel}>Empirical ↑</Text>
    </View>
  );
}

const reliStyles = StyleSheet.create({
  canvas: {
    backgroundColor: T.bg,
    borderRadius: T.radiusSm,
    marginVertical: T.sm,
    borderWidth: 1,
    borderColor: T.border,
    position: 'relative',
    alignSelf: 'center',
  },
  diagonal: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 1,
    backgroundColor: T.textMuted,
    opacity: 0.45,
    transform: [{ rotate: '-45deg' }, { translateX: 0 }],
    transformOrigin: 'left bottom',
  },
  dot: {
    position: 'absolute',
    backgroundColor: T.primary,
    opacity: 0.7,
  },
  xLabel: {
    position: 'absolute',
    bottom: -16,
    right: 4,
    fontSize: 10,
    color: T.textMuted,
  },
  yLabel: {
    position: 'absolute',
    top: 4,
    left: -2,
    fontSize: 10,
    color: T.textMuted,
  },
});

function ExampleRollout({ per_step }: { per_step: number[] }) {
  return (
    <View style={exStyles.row}>
      {per_step.map((p, i) => {
        const color = p >= 0.7 ? T.danger : p >= 0.4 ? T.warning : T.success;
        return (
          <View
            key={i}
            style={[
              exStyles.bar,
              { height: Math.max(4, Math.round(p * 60)), backgroundColor: color },
            ]}
          />
        );
      })}
    </View>
  );
}

const exStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 3,
    marginVertical: T.sm,
  },
  bar: { flex: 1, borderRadius: 2, minWidth: 4 },
});

// ─── Page styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  closeRow: { alignSelf: 'flex-end', padding: T.sm },
  h1: {
    fontSize: T.fontXxl,
    fontWeight: '800',
    color: T.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.lg,
  },
  section: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
    marginBottom: T.sm,
  },
  sectionTag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTagText: { color: T.white, fontWeight: '800', fontSize: T.fontXs },
  h2: { fontSize: T.fontLg, fontWeight: '700', color: T.text },
  h3: {
    fontSize: T.fontSm,
    fontWeight: '700',
    color: T.text,
    marginTop: T.md,
    marginBottom: T.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  p: { fontSize: T.fontSm, color: T.text, lineHeight: 20, marginBottom: T.sm },
  bold: { fontWeight: '700' },
  helpText: {
    fontSize: T.fontXs,
    color: T.textMuted,
    lineHeight: 16,
    marginBottom: T.sm,
    fontStyle: 'italic',
  },
  statRow: {
    flexDirection: 'row',
    gap: T.sm,
    marginVertical: T.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: T.primaryFaint,
    borderRadius: T.radiusSm,
    padding: T.sm,
    alignItems: 'center',
  },
  statNum: {
    fontSize: T.fontLg,
    fontWeight: '800',
    color: T.primaryDark,
  },
  statLabel: { fontSize: T.fontXs, color: T.textSecondary, marginTop: 2 },
  impRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
    marginVertical: 3,
  },
  impLabel: {
    width: 130,
    fontSize: T.fontXs,
    color: T.text,
  },
  impBar: {
    flex: 1,
    height: 6,
    backgroundColor: T.border,
    borderRadius: 3,
  },
  impFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: T.primary,
  },
  impPct: {
    width: 38,
    textAlign: 'right',
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.text,
  },
  footer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.lg,
    lineHeight: 16,
  },
});
