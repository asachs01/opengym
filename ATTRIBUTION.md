# Attribution

**openGym** was created by Duarte Santos. The upstream project is actively maintained at
[gitlab.com/DuarteSantos8/opengym](https://gitlab.com/DuarteSantos8/opengym) (it moved GitHub →
gitea.com → GitLab over August 2026; GitLab is current as of this writing). All original design,
feature work, and the exercise tracking/progression engine are his — see the upstream repo for
the canonical, actively-developed version with CI/CD, official Docker images, Android APK builds,
and a much larger contributor/language base than this fork.

This repository — **asachs01/opengym** — is a working fork that adds network-facing OAuth2 API
auth and a write-capable MCP server, built before upstream's own (different-shaped) MCP server
was discovered. We're working to upstream what's genuinely additive; see the open items below.

## What's in this fork that isn't upstream (yet)

- **OAuth 2.0 (Authorization Code + PKCE)** support on the API, alongside the original
  passkey/WebAuthn login — lets third-party tools (like an MCP server) get scoped, revocable
  access without sharing a session cookie. Upstream's own MCP README lists "long-lived token
  auth + write tools" as planned-but-unshipped roadmap; this fills that gap. **Proposed upstream
  as an extension of their MCP roadmap — not yet merged.**
- **Equipment profiles** (Home/Gym/etc.) — a persisted "what I own" list that filters the
  Library, exercise picker, and flags routine entries needing gear outside the active profile.
  Upstream has equipment *filtering* (issue #6) but not persisted profiles. **Proposed upstream —
  not yet merged.**
- An MCP server (`mcp/`) built as a network/HTTP, OAuth-authenticated, write-capable design.
  Upstream shipped their own MCP server (v1.2.5) with a different architecture: local stdio
  process, read-only, no auth, reading `data/db.json` directly — appropriate for a single
  self-hoster running the LLM client on the same box. Ours targets the "someone else hosts it
  for me" / remote-access case. We've proposed it to upstream as an optional "remote mode"
  alongside their local one rather than a replacement.

Everything else — the exercise library, progression logic, UI, and data model — is unmodified
upstream work.

## Exercise data

Exercise images/GIFs and metadata are pulled from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), per the
original project's [NOTICE.md](NOTICE.md).


If Duarte Santos would rather this repository be archived, credited differently, or not exist at
all, please open an issue — this fork exists to run our own instance and contribute improvements
back, not to compete with or fragment the upstream project.
