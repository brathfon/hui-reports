/**
  Collects errors, warnings and informational notes found while reading and
  processing data so they can be summarized at the end of a run instead of
  being scattered through the log.

  Each issue is printed to stdout (the log) as soon as it is reported, so it
  still appears next to the surrounding progress messages. printSummary()
  then lists the errors and warnings again, sorted by sample date so the most
  recent (and most likely new) issues are at the bottom.
*/

import * as fs from 'fs';

export type Severity = 'error' | 'warning' | 'info';

export interface IssueDetails {
  sampleId?: string;
  // the date of the sample in YYYY-MM-DD form. If not given, it is derived from sampleId when possible.
  date?: string;
  // where the problem was found, ex: a file name and line number
  source?: string;
}

export interface Issue extends IssueDetails {
  severity: Severity;
  category: string;  // short, stable tag such as 'nutrient-invalid-id' that groups similar issues
  message: string;
}

/**
 * Pulls a YYYY-MM-DD date out of a sample ID like RHL260402, RHL260402-N-1 or even
 * malformed IDs like TOO-OLD-NKP210311-N-1. Returns undefined if no plausible date is found.
 */
export function dateFromSampleId(sampleId: string): string | undefined {
  const match = sampleId.match(/(\d\d)(\d\d)(\d\d)/);
  if (!match) {
    return undefined;
  }
  const [, yy, mm, dd] = match;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }
  return `20${yy}-${mm}-${dd}`;
}

/** Converts M/D/YY or MM/DD/YY to YYYY-MM-DD. Returns undefined if the format is not recognized. */
export function isoDateFromShortDate(shortDate: string): string | undefined {
  const match = shortDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d\d)$/);
  if (!match) {
    return undefined;
  }
  const [, m, d, yy] = match;
  return `20${yy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  error:   'ERROR',
  warning: 'WARNING',
  info:    'INFO',
};

export class IssueLog {
  private readonly issues: Issue[] = [];

  /**
   * @param echoToStderr also print each issue to stderr as it is reported. Used by scripts
   *                     that do not print a summary at the end.
   */
  constructor(private readonly echoToStderr = false) {}

  error(category: string, message: string, details: IssueDetails = {}): void {
    this.add('error', category, message, details);
  }

  warning(category: string, message: string, details: IssueDetails = {}): void {
    this.add('warning', category, message, details);
  }

  info(category: string, message: string, details: IssueDetails = {}): void {
    this.add('info', category, message, details);
  }

  count(severity: Severity): number {
    return this.issues.filter(issue => issue.severity === severity).length;
  }

  private add(severity: Severity, category: string, message: string, details: IssueDetails): void {
    const date = details.date ?? (details.sampleId ? dateFromSampleId(details.sampleId) : undefined);
    const issue: Issue = { severity, category, message, ...details, date };
    this.issues.push(issue);

    const line = `-- ${SEVERITY_LABEL[severity]}: ${formatIssue(issue)}`;
    console.log(line);
    if (this.echoToStderr) {
      console.error(line);
    }
  }

  /**
   * Returns the summary of errors and warnings as a string. Issues that are not tied to a date are
   * listed first, then the rest in ascending date order so the newest are at the bottom.
   * Info messages are only counted, since they are expected and are in the log if needed.
   */
  formatSummary(): string {
    const out: string[] = [];
    const rule = '='.repeat(100);

    out.push('');
    out.push(rule);
    out.push(`ISSUE SUMMARY: ${this.count('error')} errors, ${this.count('warning')} warnings, ${this.count('info')} info (info is in the log only)`);
    out.push(rule);

    for (const severity of ['error', 'warning'] as const) {
      const issues = sortIssuesByDate(this.issues.filter(issue => issue.severity === severity));
      if (issues.length === 0) {
        continue;
      }
      out.push('');
      out.push(`${SEVERITY_LABEL[severity]}S (${issues.length}), oldest first:`);
      out.push('');
      for (const issue of issues) {
        out.push(`  ${(issue.date ?? '(no date)').padEnd(10)}  ${formatIssue(issue)}`);
      }
    }

    out.push('');
    out.push('Counts by category:');
    for (const [key, count] of countByCategory(this.issues)) {
      out.push(`  ${String(count).padStart(5)}  ${key}`);
    }
    out.push(rule);
    return out.join('\n');
  }
}

function formatIssue(issue: Issue): string {
  let line = `[${issue.category}]`;
  if (issue.sampleId) {
    line += ` ${issue.sampleId}:`;
  }
  line += ` ${issue.message}`;
  if (issue.source) {
    line += `  (${issue.source})`;
  }
  return line;
}

// Undated issues first, then by date. Array.prototype.sort is stable, so issues on the
// same date stay in the order they were found.
function sortIssuesByDate(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    if (a.date === b.date) return 0;
    if (a.date === undefined) return -1;
    if (b.date === undefined) return 1;
    return a.date < b.date ? -1 : 1;
  });
}

const SEVERITY_ORDER: Severity[] = ['error', 'warning', 'info'];

// errors first, then warnings, then info; most frequent category first within each
function countByCategory(issues: Issue[]): [string, number][] {
  const counts = new Map<string, { severity: Severity; count: number }>();
  for (const issue of issues) {
    const key = `${SEVERITY_LABEL[issue.severity].padEnd(7)}  ${issue.category}`;
    const entry = counts.get(key) ?? { severity: issue.severity, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => (SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)) || (b.count - a.count))
    .map(([key, { count }]) => [key, count]);
}

// Thrown for problems that mean the script can not continue. Caught by runWithIssueSummary, which
// prints the issue summary and exits with a non-zero status.
export class FatalError extends Error {}

export const fatal = function (message: string): never {
  throw new FatalError(message);
};

// True if stdout and stderr go to the same place, such as both to the terminal
const stdoutIsStderr = function (): boolean {
  try {
    const out = fs.fstatSync(1);
    const err = fs.fstatSync(2);
    return out.dev === err.dev && out.ino === err.ino;
  }
  catch {
    return false;
  }
};

/**
 * Runs a script's main function, then prints the issue summary and exits. The summary goes to stderr so
 * it shows up in the terminal, and also to stdout when that is redirected to a log file. If main throws
 * a FatalError, it is added to the summary and the exit status is 1.
 *
 * @param stoppedMessage what to tell the user about the state of the output files after a fatal error
 */
export const runWithIssueSummary = function (issues: IssueLog, main: () => void, stoppedMessage: string): never {
  let fatalMessage: string | undefined;
  try {
    main();
  }
  catch (err) {
    if (! (err instanceof FatalError)) {
      throw err;
    }
    fatalMessage = err.message;
    issues.error('fatal', err.message);
  }

  const summary = issues.formatSummary();
  if (! stdoutIsStderr()) {
    console.log(summary);
  }
  console.error(summary);
  if (fatalMessage) {
    console.error(`\nFATAL: ${fatalMessage}\n${stoppedMessage}`);
  }
  process.exit(fatalMessage ? 1 : 0);
};

/**
 * Used by the readers when the caller does not pass in its own IssueLog. It echoes every
 * issue to stderr, which matches how the readers reported problems before IssueLog existed.
 */
export const defaultIssueLog = new IssueLog(true);
