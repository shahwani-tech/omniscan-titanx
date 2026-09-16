/**
 * OMNISCAN TITAN X - Runner Script for Computer Vision Scenarios & Timings
 */

import { runFullAutoDetectionAudit } from "../src/engine/autoDetectionBenchmark";

async function main() {
  console.log("===============================================================");
  console.log("  OMNISCAN PRO ULTRA — COMPUTER VISION VERIFICATION SUITE");
  console.log("===============================================================\n");

  const report = await runFullAutoDetectionAudit();

  console.log("---------------------------------------------------------------");
  console.log("ITEM 1 — 8 ACCURACY TEST SCENARIOS (EDGE / QUAD DETECTION)");
  console.log("---------------------------------------------------------------");

  for (const item of report.accuracyResults) {
    const status = item.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`[${status}] ${item.testId}: ${item.name}`);
    console.log(`       Target: ${item.expectedConfidence} | Actual: ${item.actualConfidencePct}`);
    console.log(`       Details: ${item.quadDetails}`);
    console.log(`       Notes: ${item.notes}\n`);
  }

  console.log("---------------------------------------------------------------");
  console.log("ITEM 2 — ACTUAL MS TIMING MEASUREMENTS (12MP BUFFER 4000x3000)");
  console.log("---------------------------------------------------------------");

  for (const t of report.timingResults) {
    const status = t.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`[${status}] ${t.feature}`);
    console.log(`       Target: < ${t.targetMs}ms`);
    console.log(`       Runs: Run 1: ${t.run1Ms}ms | Run 2: ${t.run2Ms}ms | Run 3: ${t.run3Ms}ms`);
    console.log(`       Average: ${t.averageMs}ms (Margin: -${t.marginMs}ms under ceiling)\n`);
  }

  console.log("===============================================================");
  console.log(`OVERALL AUDIT RESULT: ${report.allAccuracyPassed && report.allTimingsPassed ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("===============================================================");
}

main().catch((err) => {
  console.error("Benchmark runner error:", err);
  process.exit(1);
});
