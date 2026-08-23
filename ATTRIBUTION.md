# Attribution

**openGym** was originally created by Duarte Santos, published at
[gitea.com/DuarteSantos/openGym](https://gitea.com/DuarteSantos/openGym) and mirrored at
`github.com/DuarteSantos8/openGym`. All original design, feature work, and the exercise
tracking/progression engine are his.

As of **August 2026**, the upstream Gitea repository is suspended/unavailable and the original
author could not be reached. This repository — **asachs01/opengym** — is a continuation fork
maintained under the same [AGPL-3.0](LICENSE) license the project always used, per the terms of
that license.

## What's changed in this fork

- Fixed a broken `docker-compose.yml` (incorrect Dockerfile path for the `web` service, missing
  `.env` requirement) that prevented the published image set from deploying as documented.
- Added OAuth 2.0 (Authorization Code + PKCE) support to the API, alongside the original
  passkey/WebAuthn login, so third-party tools (e.g. an MCP server) can get scoped, revocable
  access without sharing a session cookie.
- Added an MCP (Model Context Protocol) server (`mcp/`) exposing workout logging, bodyweight
  logging, and history/routine queries as tools for AI agents.

Everything else — the exercise library, progression logic, UI, and data model — is unmodified
upstream work.

## Exercise data

Exercise images/GIFs and metadata are pulled from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), per the
original project's [NOTICE.md](NOTICE.md).

If the original author (Duarte Santos) resurfaces and wants this repository transferred, merged
back, archived, or credited differently, please open an issue — this fork exists to keep the
project alive, not to claim it.
