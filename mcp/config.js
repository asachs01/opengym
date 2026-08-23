// Shared config + token storage for the openGym MCP server and its `npm run auth` login helper.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const OPENGYM_URL = (process.env.OPENGYM_URL || 'http://localhost:8080').replace(/\/+$/, '');
export const CLIENT_ID = process.env.OPENGYM_CLIENT_ID || 'opengym-mcp';
export const REDIRECT_URI = process.env.OPENGYM_REDIRECT_URI || 'http://localhost:8765/callback';

const CONFIG_DIR = process.env.OPENGYM_MCP_CONFIG_DIR || path.join(os.homedir(), '.opengym-mcp');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');

export function loadToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { return null; }
}
export function saveToken(tok) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tok, null, 2), { mode: 0o600 });
}
export function tokenFilePath() { return TOKEN_FILE; }
