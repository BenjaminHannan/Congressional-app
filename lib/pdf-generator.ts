/**
 * Trace — Doctor-Ready PDF Generator
 *
 * Generates a clean, professional one-page PDF that patients can
 * bring to their doctor. Includes symptom timeline, exposure context,
 * risk assessment, and suggested questions.
 *
 * The goal: make it easy for a dismissive doctor to take you seriously.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SymptomLog, ExposureData, RiskAssessment } from './types';
import { SYMPTOMS } from './symptoms';
import { getCountyRiskMessage } from './nh-data';

// Wrapped requires so a missing metrics asset can't break PDF generation —
// the report will still produce, just without the ML provenance line.
let FUSION_METRICS: any = null;
let TEMPORAL_METRICS: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FUSION_METRICS = require('../assets/ml-metrics/fusion_metrics.json');
} catch {}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TEMPORAL_METRICS = require('../assets/ml-metrics/temporal_metrics.json');
} catch {}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Single-line provenance for the trained ML models used to compute the
 * risk assessment on the front page. Lets a clinician evaluate whether the
 * underlying model is calibrated and how it was validated, without leaving
 * the PDF. Hidden gracefully when the metrics assets aren't bundled.
 */
function mlProvenanceHtml(): string {
  if (!FUSION_METRICS && !TEMPORAL_METRICS) return '';

  const parts: string[] = [];
  if (FUSION_METRICS) {
    parts.push(
      `Fusion risk model (gradient-boosted trees, ${FUSION_METRICS.n_train.toLocaleString()} ` +
      `synthetic training rows): accuracy ` +
      `${(FUSION_METRICS.accuracy * 100).toFixed(1)}%, ` +
      `AUC ${FUSION_METRICS.auc_macro.toFixed(3)}, ` +
      `Brier ${FUSION_METRICS.brier_mean.toFixed(3)}`
    );
  }
  if (TEMPORAL_METRICS) {
    parts.push(
      `Temporal model (GRU, ${TEMPORAL_METRICS.n_params.toLocaleString()} parameters): ` +
      `AUC ${TEMPORAL_METRICS.auc.toFixed(3)}, ` +
      `Brier ${TEMPORAL_METRICS.brier.toFixed(3)}`
    );
  }

  return `
    <p style="font-size:10px;color:#64748b;">
      <strong>ML provenance:</strong> ${parts.join('. ')}.
      Models trained on synthetic cohorts grounded in IDSA 2020 + CDC NNDSS
      priors. Held-out metrics reflect recovery of those priors, NOT
      real-world clinical performance. Full model card at
      <em>docs/ML.md</em> in the project repository.
    </p>
  `;
}

function getActiveSymptomLabels(log: SymptomLog): string[] {
  return SYMPTOMS
    .filter((s) => log.symptoms[s.key])
    .map((s) => s.label);
}

/**
 * Generate the HTML for the doctor-ready PDF
 */
function generateHTML(
  logs: SymptomLog[],
  exposure: ExposureData | null,
  risk: RiskAssessment,
  patientName: string
): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Build symptom timeline rows (last 14 days max)
  const recentLogs = logs.slice(0, 14);
  const timelineRows = recentLogs
    .map((log) => {
      const symptoms = getActiveSymptomLabels(log);
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;">
            ${formatDate(log.date)}
          </td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;">
            ${symptoms.join(', ') || 'None logged'}
          </td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;">
            ${log.severity}/10
          </td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;">
            ${log.notes || '—'}
          </td>
        </tr>
      `;
    })
    .join('');

  // Exposure summary
  let exposureSection = '<p style="color:#64748b;">No exposure data recorded.</p>';
  if (exposure) {
    const items: string[] = [];
    if (exposure.dateFirstSymptoms) {
      items.push(`Symptoms first noticed: ${formatDate(exposure.dateFirstSymptoms)}`);
    }
    if (exposure.outdoorActivity) {
      items.push(`Recent outdoor activity: ${exposure.activityDetails || 'Yes'}`);
    }
    if (exposure.locationRisk === 'nh' && exposure.county) {
      items.push(getCountyRiskMessage(exposure.county));
    }
    if (exposure.foundTick !== 'no') {
      const tickLabels: Record<string, string> = {
        yes_removed: 'Tick found and removed',
        yes_attached: 'Tick found still attached',
        unsure: 'Uncertain about tick exposure',
      };
      items.push(tickLabels[exposure.foundTick] || '');
    }
    if (exposure.rashStatus !== 'no') {
      const rashLabels: Record<string, string> = {
        circular: 'Circular/bullseye rash observed',
        other: 'Non-circular rash observed',
        unsure: 'Uncertain about rash',
      };
      items.push(rashLabels[exposure.rashStatus] || '');
    }
    if (exposure.nearWoods) items.push('Lives/works near wooded or grassy areas');

    exposureSection = `<ul style="margin:0;padding-left:20px;">
      ${items.map((i) => `<li style="margin-bottom:4px;font-size:13px;">${i}</li>`).join('')}
    </ul>`;
  }

  // Risk level color
  const riskColors: Record<string, string> = {
    low: '#059669',
    moderate: '#d97706',
    high: '#dc2626',
    critical: '#dc2626',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 24px;
          font-size: 14px;
          line-height: 1.5;
        }
        .header {
          border-bottom: 3px solid #0d9488;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          color: #0d9488;
        }
        .header p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
        }
        .section {
          margin-bottom: 20px;
        }
        .section h2 {
          font-size: 15px;
          color: #0f766e;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .risk-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 14px;
          color: white;
          background: ${riskColors[risk.level]};
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          text-align: left;
          padding: 8px;
          background: #f1f5f9;
          font-size: 12px;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          color: #94a3b8;
        }
        .questions {
          background: #f0fdfa;
          border: 1px solid #99f6e4;
          border-radius: 8px;
          padding: 12px 16px;
        }
        .questions li {
          margin-bottom: 6px;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Trace — Patient Symptom Report</h1>
        <p>Prepared for: ${patientName || 'Patient'} | Date: ${today}</p>
        <p>This report was generated by Trace, a Lyme disease symptom tracking application.</p>
        <p style="margin-top:8px;padding:8px 12px;background:#fef3c7;border-left:3px solid #d97706;font-size:12px;color:#78350f;">
          <strong>Important:</strong> Trace is not a medical device and does not diagnose disease.
          It organizes information for you and your clinician. In an emergency, call 911.
        </p>
      </div>

      <div class="section">
        <h2>Risk Assessment</h2>
        <p>
          Current risk level: <span class="risk-badge">${risk.level.toUpperCase()}</span>
          &nbsp; (score: ${risk.score}/100)
        </p>
        <p style="font-size:13px;">${risk.recommendation}</p>
        ${risk.redFlags.length > 0
          ? `<p style="color:#dc2626;font-weight:600;font-size:13px;">
              Active red flags: ${risk.redFlags.join('; ')}
            </p>`
          : ''
        }
      </div>

      <div class="section">
        <h2>Exposure Context</h2>
        ${exposureSection}
      </div>

      <div class="section">
        <h2>Symptom Timeline (Last ${recentLogs.length} Entries)</h2>
        ${recentLogs.length > 0
          ? `<table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symptoms</th>
                  <th>Severity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>${timelineRows}</tbody>
            </table>`
          : '<p style="color:#64748b;">No symptoms logged yet.</p>'
        }
      </div>

      <div class="section">
        <h2>Suggested Questions for Your Doctor</h2>
        <div class="questions">
          <ol>
            <li>Given my symptoms and location in a Lyme-endemic area, should we test for Lyme disease?</li>
            <li>If testing, are you aware that the two-tier test can be negative in the first 2-4 weeks of infection?</li>
            <li>Should we consider empirical doxycycline treatment based on clinical suspicion, per IDSA 2020 guidelines?</li>
            <li>If not Lyme, what is the differential diagnosis and what follow-up should we plan?</li>
          </ol>
        </div>
      </div>

      <div class="section">
        <h2>Contributing Factors</h2>
        <ul style="font-size:13px;">
          ${risk.factors.map((f) => `<li>${f}</li>`).join('')}
        </ul>
      </div>

      <div class="footer">
        <p>
          <strong>Disclaimer:</strong> This report is for educational purposes only and does not
          constitute medical advice. Trace is a symptom-tracking tool, not a diagnostic device.
          Clinical decisions should be made by qualified healthcare providers.
        </p>
        <p>
          References: CDC Lyme Disease Guidance | IDSA/AAN/ACR 2020 Lyme Disease Guidelines |
          NH DHHS Bureau of Infectious Disease Control
        </p>
        ${mlProvenanceHtml()}
        <p>Generated by Trace v1.1 | Data stored locally on patient's device only</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate and share the doctor-ready PDF
 */
export async function generateAndSharePDF(
  logs: SymptomLog[],
  exposure: ExposureData | null,
  risk: RiskAssessment,
  patientName: string
): Promise<void> {
  const html = generateHTML(logs, exposure, risk, patientName);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Trace Report',
      UTI: 'com.adobe.pdf',
    });
  }
}
