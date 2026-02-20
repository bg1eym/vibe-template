#!/usr/bin/env npx tsx
/**
 * Unit test for getBuildFingerprint — used by RG-ATLAS-002 regression.
 * Asserts: non-empty sha + ledger version tag in format "build: <sha> <ledger> <basename>"
 */
import { getBuildFingerprint } from "./index.ts";

const fp = getBuildFingerprint();
// Format: "build: <sha> <ledger> <basename>"
const parts = fp.split(/\s+/);
const ok =
  fp.startsWith("build:") &&
  parts.length >= 4 &&
  /^PCK-\w+-\d+$/.test(parts[2] ?? "") &&
  (parts[1]?.length ?? 0) > 0;

if (!ok) {
  console.error("RG-ATLAS-002 FAIL: getBuildFingerprint() returned invalid format:", fp);
  process.exit(1);
}
console.log("RG-ATLAS-002 PASS: build fingerprint format OK:", fp);
process.exit(0);
