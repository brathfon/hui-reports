/**
 * Shared Google OAuth2 authentication for hui-reports scripts.
 *
 * Provides access to Google Drive (downloading nutrient data Excel files)
 * and Google Sheets (exporting shared data sheets).
 *
 * ── SETUP (one-time, done by project maintainer) ────────────────────────────
 *
 *  1. Go to https://console.cloud.google.com
 *  2. Create a project (e.g. "hui-reports")
 *  3. APIs & Services → Library:
 *       - Enable "Google Drive API"
 *       - Enable "Google Sheets API"
 *  4. APIs & Services → OAuth consent screen:
 *       - Audience: External
 *       - Fill in app name, support email — no need for homepage or privacy policy URL
 *       - Add scopes: drive.readonly, spreadsheets.readonly
 *       - Leave in Testing mode (do NOT publish)
 *       - Add authorized test users (see below)
 *  5. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
 *       - Application type: Desktop app
 *       - Copy the client_id and client_secret into CLIENT_ID / CLIENT_SECRET below
 *
 * ── ADDING A NEW USER ───────────────────────────────────────────────────────
 *
 *  When someone new needs to run these scripts, their Google account must be
 *  added as a test user:
 *
 *  1. Go to https://console.cloud.google.com → select the "hui-reports" project
 *  2. APIs & Services → OAuth consent screen → Test users → Add users
 *  3. Enter their Google account email and save
 *
 *  The user will then see an "unverified app" warning on first login — they
 *  should click "Advanced" → "Go to hui-reports (unsafe)" to proceed.
 *  This warning is normal for internal tools in Testing mode.
 *
 *  If someone can't authenticate, have them email the project maintainer to be
 *  added. If the maintainer is unavailable, anyone with access to
 *  https://console.cloud.google.com and the "hui-reports" project can add users.
 *
 * ── TOKEN STORAGE ───────────────────────────────────────────────────────────
 *
 *  After first login, a token is cached at ~/.config/hui-reports/token.json.
 *  This is per-user and per-machine. Delete that file to force re-authentication.
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';

// ── OAuth2 credentials (Desktop app) ────────────────────────────────────────
// Paste values from: console.cloud.google.com → APIs & Services → Credentials
const CLIENT_ID     = '812820386704-4ca921736t8her42s80reok1runv2584.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
// ────────────────────────────────────────────────────────────────────────────

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];
const TOKEN_PATH = path.join(os.homedir(), '.config', 'hui-reports', 'token.json');

export type AuthClient = ReturnType<typeof google.auth.OAuth2.prototype.constructor> & {
  getAccessToken(): Promise<any>;
};

/**
 * Returns an authenticated OAuth2 client.
 *
 * On first run, opens a browser window for Google sign-in and saves a token
 * to ~/.config/hui-reports/token.json. Subsequent runs use the cached token,
 * refreshing it automatically when it expires.
 */
export async function authenticate(): Promise<InstanceType<typeof google.auth.OAuth2>> {
  if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    console.error('Error: OAuth2 credentials not configured.');
    console.error('Edit scripts/google-auth.ts and fill in CLIENT_ID and CLIENT_SECRET.');
    console.error('See the setup instructions at the top of that file.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(token);
    // googleapis automatically refreshes the access token using the refresh_token
    return oauth2Client;
  }

  // First run: open browser for OAuth consent
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('\nOpening browser for Google sign-in...');
  openBrowser(authUrl);

  let code: string;
  try {
    code = await waitForAuthCode();
  } catch (err: any) {
    if (err.message?.includes('access_denied')) {
      console.error('\nAccess denied. Your Google account may not be authorized to use this app.');
      console.error('Contact the project maintainer to have your email added as a test user.');
      console.error('See the instructions at the top of scripts/google-auth.ts for details.');
    } else {
      console.error(`\nAuthentication failed: ${err.message}`);
    }
    process.exit(1);
  }

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`Token saved to ${TOKEN_PATH}`);

  return oauth2Client;
}

function openBrowser(url: string): void {
  const { execSync } = require('child_process');
  try {
    const platform = process.platform;
    if (platform === 'darwin')      execSync(`open "${url}"`);
    else if (platform === 'win32')  execSync(`start "" "${url}"`);
    else                            execSync(`xdg-open "${url}"`);
  } catch {
    console.log(`Could not open browser automatically. Visit this URL:\n${url}`);
  }
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) return;
      const params = new URL(req.url, REDIRECT_URI).searchParams;
      const code  = params.get('code');
      const error = params.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code) {
        res.end('<h2>Authenticated successfully. You can close this tab.</h2>');
        server.close();
        resolve(code);
      } else {
        res.end(`<h2>Authentication failed: ${error ?? 'unknown error'}</h2>`);
        server.close();
        reject(new Error(error ?? 'unknown error'));
      }
    });

    server.listen(3000, () => console.log('Waiting for browser authentication...'));
    server.on('error', err => reject(new Error(`Could not start local server on port 3000: ${err.message}`)));
  });
}
