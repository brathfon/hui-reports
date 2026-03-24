#!/usr/bin/env tsx
/**
 * Import data from the Hui O Ka Wai Ola Google Sheet into
 * data/google-drive-downloads/ as TSV files, replacing them each run.
 *
 * Usage:
 *   ./scripts/run-import-sheet-data.sh [--cutoff YYYY-MM-DD]
 *                                       [--include YYYY-MM-DD]
 *                                       [--exclude YYYY-MM-DD]
 *
 *   --cutoff   Last date to include (inclusive). Defaults to the last day of
 *              the most recently completed calendar quarter.
 *   --include  Force-include a specific date even if after the cutoff.
 *              May be repeated for multiple dates.
 *   --exclude  Force-exclude a specific date even if before the cutoff.
 *              May be repeated for multiple dates.
 *
 * For Team tabs, column A ("Downloaded for distribution") is computed locally
 * rather than relying on what's in the sheet:
 *   - "yes" if the row's date (col P) falls within the included range
 *            AND col B ("Checked by QA") is "yes"
 *   - ""    otherwise
 *
 * Warnings are printed for rows in the date range that lack QA approval.
 * Errors are printed (and the script exits 1) if the sheet has col A = "yes"
 * for any row whose date is outside the included range.
 *
 * See scripts/google-auth.ts for authentication setup instructions.
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate } from './google-auth';

const SHEET_ID       = '1oc2q8ruhDahtzmrHJk97WeNqTCVc6mqU6jtZoD3cBu0';
const OUTPUT_DIR     = path.resolve(__dirname, '../data/google-drive-downloads');
const SHEET_PREFIX   = 'Hui O Ka Wai Ola Data Entry';

// Team tabs: col A is recomputed from date + QA status
const TEAM_TABS = [
  'Team R2RS',
  'Team Polanui',
  'Team R2RN',
  'Team Kamaole',
  'Team Lahaina Fire Response',
  'Team Wailea-Makena',
  'Team North Kihei',
  "Team Lana'i",
  'Team Olowalu',
  'Team Wailea',
];

// Non-team tabs: downloaded verbatim with no transformation
const VERBATIM_TABS = [
  'Site Codes',
  'Report Constants',
  'Report QA Comments',
];

// Column indices (0-based) for Team tabs
const COL_DOWNLOADED = 0;  // A: "Downloaded for distribution"
const COL_QA         = 1;  // B: "Checked by QA"
const COL_SAMPLE_ID  = 12; // M: "SampleID" (for readable warning messages)
const COL_DATE       = 15; // P: "Date" (YYYY-MM-DD)

// Number of header rows at the top of each Team tab (skipped by downstream code)
const TEAM_HEADER_ROWS = 3;

// ── Date / cutoff helpers ────────────────────────────────────────────────────

/** Last day of the most recently completed calendar quarter. */
function defaultCutoff(): string {
  const now   = new Date();
  const month = now.getMonth() + 1; // 1–12
  const year  = now.getFullYear();
  if (month <= 3)  return `${year - 1}-12-31`;
  if (month <= 6)  return `${year}-03-31`;
  if (month <= 9)  return `${year}-06-30`;
  return `${year}-09-30`;
}

function isIncluded(date: string, cutoff: string, forceIn: Set<string>, forceOut: Set<string>): boolean {
  if (forceOut.has(date)) return false;
  if (forceIn.has(date))  return true;
  return date <= cutoff; // YYYY-MM-DD strings compare correctly as strings
}

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(): { cutoff: string; forceIn: Set<string>; forceOut: Set<string> } {
  const args    = process.argv.slice(2);
  let cutoff    = defaultCutoff();
  const forceIn : Set<string> = new Set();
  const forceOut: Set<string> = new Set();

  for (let i = 0; i < args.length; i++) {
    if      (args[i] === '--cutoff'  && args[i + 1]) cutoff = args[++i];
    else if (args[i] === '--include' && args[i + 1]) forceIn.add(args[++i]);
    else if (args[i] === '--exclude' && args[i + 1]) forceOut.add(args[++i]);
  }
  return { cutoff, forceIn, forceOut };
}

// ── Sheets API helpers ───────────────────────────────────────────────────────

/** Escapes a sheet tab name for use in an A1 range string. */
function sheetRange(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

async function fetchTab(sheets: any, tabName: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: sheetRange(tabName),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return (res.data.values ?? []).map((row: any[]) => row.map(v => String(v).replace(/\r\n|\r|\n/g, ' ')));
}

// ── Team tab transformation ──────────────────────────────────────────────────

interface TransformResult {
  rows:     string[][];
  warnings: string[];
  errors:   string[];
  included: number;
}

function transformTeamTab(
  rawRows:  string[][],
  tabName:  string,
  cutoff:   string,
  forceIn:  Set<string>,
  forceOut: Set<string>,
): TransformResult {
  const warnings: string[] = [];
  const errors:   string[] = [];
  let   included  = 0;

  // Pad every row to at least the width of the first header row so that
  // downstream code accessing fixed column indices always gets a value.
  const headerWidth = rawRows[0]?.length ?? 0;
  const pad = (row: string[]) => {
    const r = [...row];
    while (r.length < headerWidth) r.push('');
    return r;
  };

  const rows = rawRows.map((rawRow, i) => {
    const row = pad(rawRow);

    // Header rows — pass through unchanged
    if (i < TEAM_HEADER_ROWS) return row;

    const date     = row[COL_DATE]?.trim() ?? '';
    const qa       = row[COL_QA]?.trim().toLowerCase() ?? '';
    const sheetA   = row[COL_DOWNLOADED]?.trim().toLowerCase() ?? '';
    const sampleId = row[COL_SAMPLE_ID]?.trim() || `row ${i + 1}`;

    // Skip blank rows (no date)
    if (!date) return row;

    const inRange = isIncluded(date, cutoff, forceIn, forceOut);

    if (inRange) {
      if (qa !== 'yes') {
        warnings.push(
          `  [${tabName}] ${sampleId} (${date}): within range but col B "Checked by QA" is not "yes" — row will NOT be included. Approve QA before processing.`
        );
        row[COL_DOWNLOADED] = '';
      } else {
        row[COL_DOWNLOADED] = 'yes';
        included++;
      }
    } else {
      if (sheetA === 'yes') {
        errors.push(
          `  [${tabName}] ${sampleId} (${date}): outside the cutoff (${cutoff}) but sheet has col A = "yes". The sheet's "Downloaded for distribution" column should not be manually maintained — this script computes it.`
        );
      }
      row[COL_DOWNLOADED] = '';
    }

    return row;
  });

  return { rows, warnings, errors, included };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { cutoff, forceIn, forceOut } = parseArgs();

  console.log('Authenticating with Google...');
  const auth   = await authenticate();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`Cutoff date:   ${cutoff} (default: end of most recent completed quarter)`);
  if (forceIn.size)  console.log(`Force-include: ${[...forceIn].join(', ')}`);
  if (forceOut.size) console.log(`Force-exclude: ${[...forceOut].join(', ')}`);
  console.log('');

  const allWarnings: string[] = [];
  const allErrors:   string[] = [];

  for (const tabName of [...TEAM_TABS, ...VERBATIM_TABS]) {
    process.stdout.write(`  "${tabName}"... `);

    const rawRows = await fetchTab(sheets, tabName);
    let   rows    = rawRows;

    if (TEAM_TABS.includes(tabName)) {
      const result = transformTeamTab(rawRows, tabName, cutoff, forceIn, forceOut);
      rows = result.rows;
      allWarnings.push(...result.warnings);
      allErrors.push(...result.errors);
      console.log(`${result.included} rows included`);
    } else {
      console.log('done');
    }

    const tsv     = rows.map(row => row.join('\t')).join('\n');
    const outPath = path.join(OUTPUT_DIR, `${SHEET_PREFIX} - ${tabName}.tsv`);
    fs.writeFileSync(outPath, tsv, 'utf-8');
  }

  if (allWarnings.length) {
    console.error(`\n${'─'.repeat(70)}`);
    console.error('⚠  WARNING: rows within the date range are not yet QA-approved');
    console.error(`${'─'.repeat(70)}`);
    for (const w of allWarnings) console.error(w);
    console.error('');
  }

  if (allErrors.length) {
    console.error(`\n${'─'.repeat(70)}`);
    console.error('✗  ERROR: sheet has col A = "yes" for rows outside the cutoff');
    console.error(`${'─'.repeat(70)}`);
    for (const e of allErrors) console.error(e);
    console.error('\n  The "Downloaded for distribution" column in the sheet should not be');
    console.error('  manually maintained. This script computes it from the cutoff date.');
    console.error('');
  }

  const status = allErrors.length ? 'Done (with errors).' : 'Done.';
  console.log(status);

  if (allErrors.length) process.exit(1);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
