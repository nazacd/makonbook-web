// The Desmos calculator's work (its expressions, graph and settings) for a
// test in progress, kept in this browser so it survives closing the panel,
// leaving the test, a reload or a resize. The calculator's frame
// (src/calculator-frame.ts) saves and restores it under the same key; it is
// forgotten when the run ends or is discarded.

/** The storage key for a run's calculator; the frame builds the same one. */
export const calculatorStateKey = (runId: string) => `mb.calc.${runId}`;

export function forgetCalculator(runId: string) {
  try {
    localStorage.removeItem(calculatorStateKey(runId));
  } catch {
    // No storage: nothing kept.
  }
}
