#!/usr/bin/env npx tsx
/**
 * ATLAS-007: Simulate /atlas today execution for human-simulation validation.
 * Calls runAtlasToday and outputs JSON result.
 */
import { runAtlasToday } from "./atlas-adapter.js";

const atlasRoot = process.env.ATLAS_ROOT?.trim() || "";
const dashboardUrlBase = process.env.ATLAS_DASHBOARD_URL_BASE?.trim() || "https://example.com/dash";
const coverUrlBase = process.env.ATLAS_COVER_URL_BASE?.trim() || "https://example.com/cover";

const result = await runAtlasToday({
  atlasRoot,
  dashboardUrlBase,
  coverUrlBase,
});
console.log(JSON.stringify(result));
