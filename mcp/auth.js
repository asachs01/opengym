#!/usr/bin/env node
// One-time login: `npm run auth` (or `npx opengym-mcp auth`). Opens the openGym authorize page
// in your default browser, catches the redirect on a local port, exchanges the code (PKCE) for
// an access token, and saves it to ~/.opengym-mcp/token.json. Re-run any time to switch accounts
// or after revoking access from within openGym.
import crypto from 'node:crypto';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { OPENGYM_URL, CLIENT_ID, REDIRECT_URI, saveToken, tokenFilePath } from './config.js';

const b64u = buf => buf.toString('base64url');
const verifier = b64u(crypto.randomBytes(32));
const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
const state = b64u(crypto.randomBytes(16));

const redirect = new URL(REDIRECT_URI);
const port = +(redirect.port || 80);

const authorizeUrl = new URL('/oauth/authorize', OPENGYM_URL);
authorizeUrl.searchParams.set('client_id', CLIENT_ID);
authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('code_challenge', challenge);
authorizeUrl.searchParams.set('code_challenge_method', 'S256');
authorizeUrl.searchParams.set('state', state);

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try { execSync(`${cmd} "${url}"`); } catch { /* fall through to printing it */ }
}

console.log('\nOpen this URL if your browser did not open automatically:\n');
console.log('  ' + authorizeUrl.toString() + '\n');
console.log('(You must already be signed in to openGym with your passkey in that browser.)\n');
openBrowser(authorizeUrl.toString());

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname !== redirect.pathname) { res.writeHead(404); return res.end(); }

  const gotState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization denied</h1><p>${error}</p>`);
    console.error('Authorization denied:', error);
    server.close(); process.exit(1);
  }
  if (gotState !== state || !code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>Invalid response — state mismatch</h1>');
    return;
  }

  try {
    const tokenResp = await fetch(new URL('/oauth/token', OPENGYM_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI, code_verifier: verifier
      })
    });
    const tok = await tokenResp.json();
    if (!tokenResp.ok) throw new Error(tok.error_description || tok.error || 'token exchange failed');

    saveToken({
      access_token: tok.access_token,
      obtained_at: new Date().toISOString(),
      expires_at: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
      opengym_url: OPENGYM_URL
    });

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>✅ Signed in to openGym</h1><p>You can close this tab and return to your MCP client.</p>');
    console.log('Saved token to', tokenFilePath());
    console.log('Done — the MCP server is ready to use.');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><p>${e.message}</p>`);
    console.error('Token exchange failed:', e.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 250);
  }
});

server.listen(port, () => console.log(`Waiting for the browser redirect on ${REDIRECT_URI} ...`));
