#!/usr/bin/env tsx
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const REPORTS_DIR = path.resolve(__dirname, '../reports/web-export-quarterly-reports');

// Number formats per column name
const NUMBER_FORMATS: Record<string, string> = {
  Lat:        '0.000000',
  Long:       '0.000000',
  DO:         '0.00',
  pH:         '0.00',
  Turbidity:  '0.00',
  TotalN:     '0.00',
  TotalP:     '0.00',
  Phosphate:  '0.00',
  Silicate:   '0.00',
  NNN:        '0.00',
  NH4:        '0.00',
  Temp:       '0.0',
  Salinity:   '0.0',
  DO_sat:     '0.0',
  Date:       'mm/dd/yy',
};

// Columns that should be stored as numbers, not strings
const NUMERIC_COLUMNS = new Set(Object.keys(NUMBER_FORMATS).concat(['', 'Session'])); // '' = the row-number column

// Columns that should be stored as Date objects (parsed from MM/DD/YY)
const DATE_COLUMNS = new Set(['Date']);

// Minimum column widths (characters) for columns that tend to be too narrow
const COLUMN_WIDTHS: Record<string, number> = {
  SampleID: 12,
  SiteName: 28,
  Lat:      13,
  Long:     13,
};

function parseBasename(basename: string): { region: string; yearQuarter: string; version: string } {
  // e.g. "2025-4th-quarter.0.south-maui"
  const parts = basename.split('.');
  if (parts.length !== 3) {
    throw new Error(`Expected basename like "2025-4th-quarter.0.south-maui", got: ${basename}`);
  }
  return {
    yearQuarter: parts[0], // "2025-4th-quarter"
    version:     parts[1], // "0"
    region:      parts[2], // "south-maui"
  };
}

function regionToTemplateFile(region: string): string {
  const mapping: Record<string, string> = {
    'south-maui': 'South-Maui',
    'west-maui':  'West-Maui',
    'lanai':      'Lanai',
  };
  const key = mapping[region];
  if (!key) throw new Error(`Unknown region "${region}". Expected: south-maui, west-maui, or lanai`);
  return path.join(REPORTS_DIR, `web-export-starting-file-${key}.xlsx`);
}

function outputFilename(region: string, yearQuarter: string, version: string): string {
  return `hui-${region}-thru-${yearQuarter}.${version}.xlsx`;
}

// Parse MM/DD/YY date strings (as used in the TSV) into Date objects
function parseDateStr(val: string): Date | string {
  const parts = val.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day   = parseInt(parts[1], 10);
    const yr    = parseInt(parts[2], 10);
    // Use UTC to avoid timezone offset shifting the stored serial number
    return new Date(Date.UTC(yr < 100 ? 2000 + yr : yr, month, day));
  }
  return val;
}

function parseTsv(filepath: string): { headers: string[]; rows: (string | number | Date)[][] } {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split('\t');

  const rows = dataLines.map((line: string) => {
    const cols = line.split('\t');
    return cols.map((val: string, i: number) => {
      const header = headers[i] ?? '';
      if (val === '') return val;
      if (DATE_COLUMNS.has(header)) return parseDateStr(val);
      if (NUMERIC_COLUMNS.has(header)) {
        const num = parseFloat(val);
        return isNaN(num) ? val : num;
      }
      return val;
    });
  });

  return { headers, rows };
}

async function main() {
  const basename = process.argv[2];
  if (!basename) {
    console.error('Usage: create-spreadsheet <basename>');
    console.error('Example: create-spreadsheet 2025-4th-quarter.0.south-maui');
    process.exit(1);
  }

  const { region, yearQuarter, version } = parseBasename(basename);

  const tsvPath = path.join(REPORTS_DIR, `${basename}.tsv`);
  if (!fs.existsSync(tsvPath)) {
    throw new Error(`TSV file not found: ${tsvPath}`);
  }

  const templatePath = regionToTemplateFile(region);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  console.log(`Reading template: ${path.basename(templatePath)}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  console.log(`Reading TSV: ${basename}.tsv`);
  const { headers, rows } = parseTsv(tsvPath);

  // Remove existing "data" sheet if present
  const existing = workbook.getWorksheet('data');
  if (existing) workbook.removeWorksheet(existing.id);

  // Add the data sheet
  const dataSheet = workbook.addWorksheet('data');

  // Write header row
  dataSheet.addRow(headers);

  // Write data rows
  for (const row of rows) {
    const addedRow = dataSheet.addRow(row);
    addedRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1] ?? '';
      const fmt = NUMBER_FORMATS[header];
      if (fmt) cell.numFmt = fmt;
    });
  }

  // Apply number format and width to columns
  headers.forEach((header, i) => {
    const col = dataSheet.getColumn(i + 1);
    const fmt = NUMBER_FORMATS[header];
    if (fmt) col.numFmt = fmt;
    const width = COLUMN_WIDTHS[header];
    if (width) col.width = width;
  });

  // Reorder sheets so "data" is first, "meta data" second via orderNo
  (dataSheet as any).orderNo = 0;
  workbook.worksheets.forEach(ws => {
    if (ws.name !== 'data') (ws as any).orderNo = 1;
  });

  // Update "Last Updated" date in the meta data sheet (label at A3, value at B3)
  const metaSheet = workbook.getWorksheet('meta data');
  if (metaSheet) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    metaSheet.getCell('B3').value = today;
  } else {
    console.warn('Warning: could not find "meta data" sheet to update Last Updated');
  }

  // Set active sheet to "data" (index 0 after reorder) at cell A1
  dataSheet.views = [{ state: 'normal', activeCell: 'A1' }];
  workbook.views = [{ activeTab: 0, x: 0, y: 0, width: 17142, height: 10260, firstSheet: 0, visibility: 'visible' }];

  const outName = outputFilename(region, yearQuarter, version);
  const outPath = path.join(REPORTS_DIR, outName);
  console.log(`Saving: ${outName}`);
  await workbook.xlsx.writeFile(outPath);
  console.log('Done.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
