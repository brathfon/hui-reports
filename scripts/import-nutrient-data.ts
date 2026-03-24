#!/usr/bin/env tsx
/**
 * Import nutrient data Excel files from Google Drive, converting them to CSV
 * in data/nutrient-data/.
 *
 * Usage: ./scripts/run-import-nutrient-data.sh [--dry-run]
 *
 *   --dry-run   List what would be downloaded/renamed without writing any files
 *
 * See scripts/google-auth.ts for authentication setup instructions.
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { authenticate } from './google-auth';

const DRIVE_ROOT_FOLDER_ID = '1fRet0BLqgGUCOfobYOWzoYCxd-wxowM0';

const LOCAL_NUTRIENT_DATA_DIR = path.resolve(__dirname, '../data/nutrient-data');

// Maps Drive top-level folder names to local subdirectory names
const REGION_MAP: Record<string, string> = {
  'Lanai':      'lanai',
  'South-Maui': 'south-maui',
  'West-Maui':  'west-maui',
};

interface DriveFile {
  id: string;
  name: string;
  region: string;      // local subdir, e.g. 'south-maui'
  folderYear: number;  // year from the containing folder name, e.g. 2024
}

interface FileAction {
  driveFile: DriveFile;
  localName: string;   // normalized .csv filename
  localPath: string;
  status: 'exists' | 'download';
  dateNote?: string;   // set if a MMDDYY → YYMMDD conversion was applied
  replacesBase?: string; // set when downloading a .fixed that supersedes a local base file
}

// ── Drive traversal ──────────────────────────────────────────────────────────

const DRIVE_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
};

// Drive filenames that represent superseded or known-bad versions to skip
const SKIP_PATTERNS = [
  /\.bad\./i,
  /\.orig\./i,
  /_original\.xls$/i,
  /\.needs-redone/i,
  /\.has-bad-sample/i,
  /\.IDs-fixed-but/i,
  /\.bad-site-name/i,
];

function shouldSkip(name: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(name));
}

/**
 * Given a list of .xls files in one folder, filters out base versions when a
 * .fixed counterpart exists. E.g. if both MNMRC_X.xls and MNMRC_X.fixed.xls
 * are present, only the .fixed one is kept.
 */
function preferFixed(files: { id: string; name: string }[]): { id: string; name: string }[] {
  const fixedBases = new Set(
    files
      .filter(f => /\.fixed\.xls$/i.test(f.name))
      .map(f => f.name.replace(/\.fixed\.xls$/i, '.xls'))
  );
  return files.filter(f => !fixedBases.has(f.name));
}

async function listFolders(drive: any, parentId: string): Promise<{ id: string; name: string }[]> {
  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 200,
  });
  return res.data.files ?? [];
}

async function listXlsFiles(drive: any, parentId: string): Promise<{ id: string; name: string }[]> {
  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${parentId}' in parents and trashed = false and (name contains '.xls')`,
    fields: 'files(id, name)',
    pageSize: 200,
  });
  const all = (res.data.files ?? []).filter((f: any) => /\.xls$/i.test(f.name) && !shouldSkip(f.name));
  return preferFixed(all);
}

async function collectDriveFiles(drive: any): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  const regionFolders = await listFolders(drive, DRIVE_ROOT_FOLDER_ID);

  for (const regionFolder of regionFolders) {
    const localRegion = REGION_MAP[regionFolder.name];
    if (!localRegion) {
      console.warn(`  Skipping unknown region folder: ${regionFolder.name}`);
      continue;
    }

    const yearFolders = await listFolders(drive, regionFolder.id);
    for (const yearFolder of yearFolders) {
      const folderYear = parseInt(yearFolder.name, 10);
      if (isNaN(folderYear)) {
        console.warn(`  Skipping non-year folder: ${regionFolder.name}/${yearFolder.name}`);
        continue;
      }

      const xlsFiles = await listXlsFiles(drive, yearFolder.id);
      for (const f of xlsFiles) {
        files.push({ id: f.id, name: f.name, region: localRegion, folderYear });
      }
    }
  }

  return files;
}

// ── Date normalization ───────────────────────────────────────────────────────

/**
 * Given the 6-digit date string from a filename and the year of the containing
 * folder, returns { normalized: 'YYMMDD', wasConverted: boolean }.
 *
 * Drive files sometimes use MMDDYY instead of YYMMDD. We use the folder year
 * to disambiguate: whichever interpretation produces a year matching the folder
 * wins. If both match or neither matches, we default to YYMMDD and flag it.
 */
function normalizeDatePart(datePart: string, folderYear: number): { normalized: string; wasConverted: boolean; ambiguous: boolean } {
  const yy = folderYear % 100;

  const firstTwo = parseInt(datePart.slice(0, 2), 10);
  const lastTwo  = parseInt(datePart.slice(4, 6), 10);

  const firstIsYear = firstTwo === yy;
  const lastIsYear  = lastTwo  === yy;

  if (firstIsYear && !lastIsYear) {
    // Clearly YYMMDD
    return { normalized: datePart, wasConverted: false, ambiguous: false };
  }

  if (lastIsYear && !firstIsYear) {
    // Clearly MMDDYY → convert to YYMMDD
    const mm = datePart.slice(0, 2);
    const dd = datePart.slice(2, 4);
    const yStr = datePart.slice(4, 6);
    return { normalized: `${yStr}${mm}${dd}`, wasConverted: true, ambiguous: false };
  }

  // Ambiguous or neither matched — keep as-is, flag it
  return { normalized: datePart, wasConverted: false, ambiguous: true };
}

// ── Filename parsing ─────────────────────────────────────────────────────────

/**
 * Converts a Drive .xls filename to the local .csv filename.
 * Returns null if the filename doesn't match the expected MNMRC/TNC pattern.
 */
function toLocalName(driveFile: DriveFile): { localName: string; dateNote?: string } | null {
  const base = driveFile.name.replace(/\.xls$/i, '');

  // Match: PREFIX_DDDDDD[_rest]  where PREFIX is MNMRC or TNC
  const m = base.match(/^(MNMRC|TNC)_(\d{6})(_.+)?$/);
  if (!m) return null;

  const prefix   = m[1];
  const datePart = m[2];
  const rest     = m[3] ?? ''; // e.g. '_141_S.Maui' or '_S.Maui'

  const { normalized, wasConverted, ambiguous } = normalizeDatePart(datePart, driveFile.folderYear);

  const localName = `${prefix}_${normalized}${rest}.csv`;
  let dateNote: string | undefined;
  if (wasConverted) dateNote = `date converted MMDDYY→YYMMDD (was ${datePart})`;
  if (ambiguous)    dateNote = `date format ambiguous (${datePart}), kept as-is`;

  return { localName, dateNote };
}

// ── Download and convert ─────────────────────────────────────────────────────

async function downloadAndConvert(drive: any, action: FileAction): Promise<void> {
  // Download raw file bytes from Drive
  const res = await drive.files.get(
    { fileId: action.driveFile.id, alt: 'media', ...DRIVE_OPTS },
    { responseType: 'arraybuffer' }
  );

  const buffer = Buffer.from(res.data as ArrayBuffer);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in workbook');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });

  fs.mkdirSync(path.dirname(action.localPath), { recursive: true });
  fs.writeFileSync(action.localPath, csv, 'utf-8');

  // Remove the superseded base file if we just downloaded a .fixed replacement
  if (action.replacesBase) {
    const basePath = path.join(path.dirname(action.localPath), action.replacesBase);
    fs.unlinkSync(basePath);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Authenticating with Google...');
  const auth = await authenticate();
  const drive = google.drive({ version: 'v3', auth });

  console.log('Listing Drive files...\n');
  const driveFiles = await collectDriveFiles(drive);
  console.log(`Found ${driveFiles.length} .xls files on Drive.\n`);

  const actions: FileAction[] = [];
  const unparseable: DriveFile[] = [];

  for (const df of driveFiles) {
    const parsed = toLocalName(df);
    if (!parsed) {
      unparseable.push(df);
      continue;
    }
    const { localName, dateNote } = parsed;
    const localPath = path.join(LOCAL_NUTRIENT_DATA_DIR, df.region, localName);

    // Consider the session covered if ANY local file shares the same PREFIX_YYMMDD
    // prefix — e.g. a .fixed, a rerun-by-soest.fixed, or the plain base all count.
    const sessionPrefix = localName.match(/^((?:MNMRC|TNC)_\d{6})/)?.[1];
    const localDir = path.dirname(localPath);
    const existingForSession = sessionPrefix
      ? (fs.readdirSync(localDir).some(f => f.startsWith(sessionPrefix) && f.endsWith('.csv')))
      : fs.existsSync(localPath);
    const status = existingForSession ? 'exists' : 'download';

    actions.push({ driveFile: df, localName, localPath, status, dateNote });
  }

  // Report
  const toDownload = actions.filter(a => a.status === 'download');
  const existing   = actions.filter(a => a.status === 'exists');
  const converted  = actions.filter(a => a.dateNote?.includes('converted'));
  const ambiguous  = actions.filter(a => a.dateNote?.includes('ambiguous'));

  console.log(`Already have locally:  ${existing.length}`);
  console.log(`To download:           ${toDownload.length}`);
  if (converted.length)  console.log(`Date format converted: ${converted.length}`);
  if (ambiguous.length)  console.log(`Date format ambiguous: ${ambiguous.length}`);
  if (unparseable.length) console.log(`Unrecognized names:    ${unparseable.length}`);

  if (toDownload.length) {
    console.log('\n── Files to download ────────────────────────────────────────');
    for (const a of toDownload) {
      const notes = [a.dateNote, a.replacesBase ? `replaces ${a.replacesBase}` : undefined]
        .filter(Boolean).join('; ');
      console.log(`  ${a.driveFile.region}/${a.localName}${notes ? `  [${notes}]` : ''}`);
    }
  }

  if (ambiguous.length) {
    console.log('\n── Ambiguous date formats (review manually) ─────────────────');
    for (const a of ambiguous) {
      console.log(`  ${a.driveFile.region}/${a.driveFile.name}  →  ${a.localName}  [${a.dateNote}]`);
    }
  }

  if (unparseable.length) {
    console.log('\n── Unrecognized filenames (skipped) ─────────────────────────');
    for (const df of unparseable) {
      console.log(`  ${df.region}/${df.name}`);
    }
  }

  if (dryRun || toDownload.length === 0) {
    if (toDownload.length === 0) console.log('\nNothing to download.');
    else console.log('\n(dry run — no files written)');
    return;
  }

  console.log('\nDownloading and converting...');
  let downloaded = 0;
  let failed = 0;
  for (const action of toDownload) {
    try {
      await downloadAndConvert(drive, action);
      console.log(`  ✓ ${action.driveFile.region}/${action.localName}`);
      downloaded++;
    } catch (err: any) {
      console.error(`  ✗ ${action.driveFile.region}/${action.localName}: ${err.message}`);
      failed++;
    }
  }
  console.log(`\nDone. Downloaded: ${downloaded}${failed ? `  Failed: ${failed}` : ''}.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
