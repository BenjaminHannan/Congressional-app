/**
 * Trace — Lyme Antibiotic Drug-Interaction Database
 *
 * A curated, source-cited list of major drug-drug interactions and
 * food/condition cautions for the first-line antibiotics IDSA 2020
 * recommends for Lyme disease.
 *
 * Sources (all open, all clinical):
 *   - DailyMed (US National Library of Medicine) prescribing labels
 *   - Lexicomp / Micromedex drug-interaction summaries (paywalled but
 *     interactions are individually citable to FDA labels in DailyMed)
 *   - IDSA/AAN/ACR 2020 Lyme Disease Clinical Practice Guidelines
 *   - CDC Lyme Disease Treatment Information
 *
 * This is NOT a replacement for a pharmacist's review. The interactions
 * below are the most clinically significant ones for the four Lyme
 * antibiotics — there are many other less-severe interactions a pharmacist
 * would catch that we deliberately omit to keep the surface scannable.
 *
 * Severity scale follows the FDA convention:
 *   - 'contraindicated': absolute do-not-combine (rare)
 *   - 'major':           potentially serious; avoid combination if possible
 *   - 'moderate':        clinically relevant; monitor / adjust dose
 *   - 'minor':           usually inconsequential; awareness only
 */

export type InteractionSeverity =
  | 'contraindicated'
  | 'major'
  | 'moderate'
  | 'minor';

export interface LymeAntibiotic {
  id: string;
  name: string;
  rxNames: string[];                 // brand / generic synonyms
  idsaRole: string;                  // "first-line oral", etc.
  notes: string;
}

export interface DrugInteraction {
  /** Lyme antibiotic id this interaction concerns (matches LYME_ANTIBIOTICS[].id) */
  antibioticId: string;
  /** Common name(s) of the other drug or class — what the user might type */
  otherDrug: string;
  otherDrugAliases: string[];
  severity: InteractionSeverity;
  mechanism: string;
  recommendation: string;
  source: string;       // e.g. "DailyMed: Doxycycline Hyclate label, 2024-02"
}

export const LYME_ANTIBIOTICS: LymeAntibiotic[] = [
  {
    id: 'doxycycline',
    name: 'Doxycycline',
    rxNames: ['doxycycline', 'doxy', 'vibramycin', 'monodox', 'oracea'],
    idsaRole: 'First-line oral for adults and children ≥ 8',
    notes:
      'IDSA 2020 supports empirical doxycycline in endemic areas before serology in patients with classic presentations.',
  },
  {
    id: 'amoxicillin',
    name: 'Amoxicillin',
    rxNames: ['amoxicillin', 'amox', 'amoxil', 'augmentin (with clavulanate)'],
    idsaRole: 'First-line oral for children < 8 and pregnant patients',
    notes:
      'Used when doxycycline is contraindicated (pregnancy, young children, allergy).',
  },
  {
    id: 'cefuroxime',
    name: 'Cefuroxime axetil',
    rxNames: ['cefuroxime', 'cefuroxime axetil', 'ceftin'],
    idsaRole: 'Alternative oral when doxycycline and amoxicillin are contraindicated',
    notes: 'Second-generation cephalosporin; used for penicillin allergy in some cases.',
  },
  {
    id: 'ceftriaxone',
    name: 'Ceftriaxone',
    rxNames: ['ceftriaxone', 'rocephin'],
    idsaRole: 'IV therapy for neurologic, cardiac, or late disseminated Lyme',
    notes: 'Reserved for hospital-managed disease; not a primary outpatient drug.',
  },
];

export const INTERACTIONS: DrugInteraction[] = [
  // ── Doxycycline ──────────────────────────────────────────────────────────
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Antacids (calcium, magnesium, aluminum)',
    otherDrugAliases: ['tums', 'rolaids', 'maalox', 'mylanta', 'milk of magnesia', 'antacid'],
    severity: 'major',
    mechanism:
      'Multivalent cations chelate doxycycline in the gut and dramatically reduce its absorption.',
    recommendation:
      'Take doxycycline at least 2 hours before or 6 hours after antacids, calcium supplements, or magnesium-containing laxatives.',
    source: 'DailyMed: Doxycycline Hyclate label, drug-interactions section',
  },
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Iron supplements',
    otherDrugAliases: ['ferrous sulfate', 'iron pill', 'iron tablet', 'iron supplement'],
    severity: 'major',
    mechanism: 'Iron chelates doxycycline, reducing its absorption.',
    recommendation:
      'Separate dosing by at least 2 hours (doxycycline first, iron after).',
    source: 'DailyMed: Doxycycline label',
  },
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Warfarin',
    otherDrugAliases: ['coumadin', 'jantoven', 'warfarin'],
    severity: 'major',
    mechanism:
      'Doxycycline can potentiate warfarin by altering vitamin-K-producing gut flora — risk of elevated INR and bleeding.',
    recommendation:
      'Tell your prescriber. Closer INR monitoring is required during and shortly after the doxycycline course.',
    source: 'Lexicomp drug interaction database; multiple case reports',
  },
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Oral contraceptives',
    otherDrugAliases: ['birth control', 'the pill', 'oral contraceptive', 'ocp'],
    severity: 'moderate',
    mechanism:
      'Older labels warn of reduced contraceptive efficacy; the mechanism is unclear and the magnitude is small, but a non-trivial number of pregnancies have been reported.',
    recommendation:
      'Use a backup non-hormonal contraceptive method (e.g. condoms) during the doxycycline course and for one cycle afterward.',
    source: 'DailyMed: Doxycycline label; ACOG 2020 guidance',
  },
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Isotretinoin',
    otherDrugAliases: ['accutane', 'isotretinoin', 'absorica', 'claravis'],
    severity: 'contraindicated',
    mechanism:
      'Both drugs cause pseudotumor cerebri (raised intracranial pressure). Combined use sharply increases the risk.',
    recommendation:
      'Do not combine. Pause isotretinoin during the Lyme treatment course or ask about an alternative antibiotic.',
    source: 'DailyMed: Isotretinoin and Doxycycline labels — black-box-adjacent warning',
  },
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Penicillin',
    otherDrugAliases: ['penicillin', 'amoxicillin', 'amox'],
    severity: 'minor',
    mechanism:
      'Doxycycline is bacteriostatic; penicillins are bactericidal. In theory bacteriostatic agents may blunt the activity of bactericidal ones in some infections, but this is rarely clinically meaningful for Lyme.',
    recommendation:
      'No action needed for routine Lyme treatment — IDSA picks one or the other.',
    source: 'Pharmacology textbook; mechanistic only',
  },
  {
    antibioticId: 'doxycycline',
    otherDrug: 'Sun (photosensitivity)',
    otherDrugAliases: ['sun', 'sunlight', 'tanning bed', 'sunburn', 'uv'],
    severity: 'moderate',
    mechanism:
      'Doxycycline is one of the most photosensitizing common antibiotics — can cause severe sunburn within an hour of moderate exposure.',
    recommendation:
      'Wear sunscreen (SPF 30+), long sleeves, and a hat whenever outdoors. Avoid tanning beds entirely.',
    source: 'DailyMed: Doxycycline label, adverse reactions',
  },

  // ── Amoxicillin ──────────────────────────────────────────────────────────
  {
    antibioticId: 'amoxicillin',
    otherDrug: 'Methotrexate',
    otherDrugAliases: ['methotrexate', 'mtx', 'trexall', 'otrexup'],
    severity: 'major',
    mechanism:
      'Penicillins reduce renal clearance of methotrexate, raising its serum levels and toxicity risk.',
    recommendation:
      'Avoid combination when possible. If unavoidable, monitor methotrexate levels.',
    source: 'DailyMed: Amoxicillin label',
  },
  {
    antibioticId: 'amoxicillin',
    otherDrug: 'Allopurinol',
    otherDrugAliases: ['allopurinol', 'zyloprim'],
    severity: 'moderate',
    mechanism:
      'Increased frequency of amoxicillin-associated rash when taken with allopurinol.',
    recommendation:
      'Watch for rash. If a non-urticarial rash develops, it is usually safe to complete the course but flag it to your prescriber.',
    source: 'DailyMed: Amoxicillin label',
  },
  {
    antibioticId: 'amoxicillin',
    otherDrug: 'Oral contraceptives',
    otherDrugAliases: ['birth control', 'the pill', 'oral contraceptive'],
    severity: 'minor',
    mechanism:
      'Rare reports of reduced contraceptive efficacy. Modern evidence is weak; mechanism debated.',
    recommendation:
      'Most professional bodies no longer recommend backup contraception for amoxicillin specifically, but discuss with your prescriber if concerned.',
    source: 'ACOG 2020; CDC contraceptive guidance',
  },

  // ── Cefuroxime ───────────────────────────────────────────────────────────
  {
    antibioticId: 'cefuroxime',
    otherDrug: 'Probenecid',
    otherDrugAliases: ['probenecid', 'benemid'],
    severity: 'moderate',
    mechanism:
      'Probenecid reduces renal clearance of cephalosporins — increases cefuroxime levels.',
    recommendation:
      'Usually unintentional combinations are not problematic, but tell your prescriber.',
    source: 'DailyMed: Cefuroxime label',
  },
  {
    antibioticId: 'cefuroxime',
    otherDrug: 'H2 blockers / PPIs',
    otherDrugAliases: ['famotidine', 'pepcid', 'ranitidine', 'omeprazole', 'prilosec', 'nexium'],
    severity: 'moderate',
    mechanism:
      'Reduced stomach acid lowers cefuroxime axetil absorption.',
    recommendation:
      'Take cefuroxime with food and separated from acid-suppressing meds when possible.',
    source: 'DailyMed: Cefuroxime axetil label',
  },

  // ── Ceftriaxone ──────────────────────────────────────────────────────────
  {
    antibioticId: 'ceftriaxone',
    otherDrug: 'Calcium-containing IV solutions',
    otherDrugAliases: ['iv calcium', 'lactated ringers', 'calcium gluconate iv'],
    severity: 'contraindicated',
    mechanism:
      'Ceftriaxone-calcium precipitates in the lung and kidneys of neonates — has caused fatal precipitates.',
    recommendation:
      'Do not co-administer ceftriaxone and IV calcium-containing solutions in neonates or via the same line in any patient.',
    source: 'FDA black-box warning; DailyMed: Ceftriaxone label',
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Find the Lyme antibiotic the user is on, if recognizable from free text. */
export function matchAntibiotic(userInput: string): LymeAntibiotic | null {
  const q = normalize(userInput);
  for (const ab of LYME_ANTIBIOTICS) {
    if (ab.rxNames.some((n) => q.includes(normalize(n)))) return ab;
  }
  return null;
}

/**
 * Find interactions for `antibioticId` that mention `otherMedQuery` (free
 * text — e.g. "vitamins", "tums", "warfarin"). Returns matches sorted by
 * severity (most-severe first).
 */
export function findInteractions(
  antibioticId: string,
  otherMedQuery: string
): DrugInteraction[] {
  const q = normalize(otherMedQuery);
  if (!q) return [];
  const matches = INTERACTIONS.filter((it) => {
    if (it.antibioticId !== antibioticId) return false;
    if (normalize(it.otherDrug).includes(q)) return true;
    return it.otherDrugAliases.some((a) => normalize(a).includes(q));
  });
  return matches.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  );
}

function severityRank(s: InteractionSeverity): number {
  return { contraindicated: 4, major: 3, moderate: 2, minor: 1 }[s];
}

/** All known interactions for an antibiotic — used to seed a "common
 *  interactions" view when the user has not entered a specific other med. */
export function commonInteractionsFor(antibioticId: string): DrugInteraction[] {
  return INTERACTIONS.filter((it) => it.antibioticId === antibioticId).sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  );
}
