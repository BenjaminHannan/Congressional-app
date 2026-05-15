/**
 * Trace — Jest configuration
 *
 * Scope is intentionally narrow: we only unit-test pure-TS modules in lib/
 * (heuristic risk engine, fusion GBM tree walker, temporal GRU forward pass,
 * symptom helpers, NH data). The fusion and temporal tests `require()` the
 * trained model JSON from `assets/models/` — ts-jest handles the JSON import
 * out of the box.
 *
 * React Native components are NOT exercised here — testing them would
 * require jest-expo and a full RN runtime, which is overkill for the current
 * submission and adds a heavy dependency tree. The submission readiness
 * checklist calls out that a follow-up should layer in component tests via
 * jest-expo.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/lib/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
};
