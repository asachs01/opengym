# openGym MCP server

Lets any MCP-capable AI client (Claude Desktop, Claude Code, etc.) log workouts and bodyweight,
check what's on today's plan, and read your training history directly from a conversation —
authenticated via OAuth 2.0 + PKCE against your own openGym instance. No passwords or session
cookies are ever shared with the AI client; the token it gets is scoped to your account and
revocable at any time from openGym.

## Setup

```bash
cd mcp
npm install
OPENGYM_URL=https://your-opengym-domain.example npm run auth
```

This opens your browser to your openGym instance's authorize page (you must already be signed
in there with your passkey), asks you to approve access, and saves an access token to
`~/.opengym-mcp/token.json`. Re-run `npm run auth` any time to re-authenticate or switch accounts.

## Using it

Point your MCP client at this server. For Claude Desktop / Claude Code, add to your MCP config:

```json
{
  "mcpServers": {
    "opengym": {
      "command": "node",
      "args": ["/absolute/path/to/opengym/mcp/index.js"],
      "env": { "OPENGYM_URL": "https://your-opengym-domain.example" }
    }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `opengym_whoami` | Confirms which profile you're authenticated as |
| `opengym_list_routines` | Lists your saved routines |
| `opengym_today_plan` | What's scheduled today (or that it's a rest day) |
| `opengym_workout_history` | Recent logged workouts, sets, PRs |
| `opengym_bodyweight_history` | Bodyweight log + goal weight |
| `opengym_log_bodyweight` | Log a bodyweight entry |
| `opengym_log_workout` | Log a full workout (exercises, sets, reps, weight) |
| `opengym_set_today_plan` | Override a day's scheduled routine, or mark it a rest day |

## Revoking access

In-app: **Settings → Connected apps** (uses `GET /api/oauth/tokens` / `POST /oauth/revoke`
under the hood). Or delete `~/.opengym-mcp/token.json` locally and re-run `npm run auth` to
issue a fresh token — the old one stays valid server-side until explicitly revoked.

## How auth works

openGym's API implements a minimal OAuth 2.0 Authorization Code + PKCE flow (no client secret —
this is a public client, same model native/CLI apps use per RFC 8252). The MCP server's `auth.js`
runs the flow once, interactively, and stores only the resulting bearer token — never your
passkey, never a copy of your browser session. See the API's `/oauth/*` routes in
`../api/server.js` for the implementation.
