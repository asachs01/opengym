#!/usr/bin/env node
// openGym MCP server (stdio transport). Wraps openGym's REST API — auth'd via the OAuth
// bearer token from `npm run auth` — as tools an MCP client (Claude, etc.) can call directly:
// log a workout, log bodyweight, check history, see what's on today's plan.
//
// Deliberately thin: openGym owns the domain logic (progression rules, PR detection, 1RM),
// this just reads/writes the same `state` document the web app itself reads/writes via
// GET/PUT /api/data. That means anything logged through the MCP shows up in the app exactly
// like it was logged by hand, and vice versa — same source of truth, two front doors.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OPENGYM_URL, loadToken } from './config.js';

const token = loadToken();
if (!token?.access_token) {
  console.error('Not signed in. Run `npm run auth` (or `npx opengym-mcp auth`) first.');
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(new URL(path, OPENGYM_URL), {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.access_token}`, ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) throw new Error('openGym session expired or was revoked — run `npm run auth` again.');
    throw new Error(data.error || `openGym API error (HTTP ${res.status})`);
  }
  return data;
}
async function getState() {
  const { state } = await api('/api/data');
  return state || { routines: [], workouts: [], bodyweight: [], week: {}, dayPlan: {} };
}
async function putState(state) {
  await api('/api/data', { method: 'PUT', body: JSON.stringify({ state }) });
}
const isoOf = d => { const x = new Date(d); return x.toISOString().slice(0, 10); };
const uid = () => Math.random().toString(36).slice(2, 10);

const server = new McpServer({ name: 'opengym', version: '0.1.0' });

server.registerTool('opengym_whoami', {
  title: 'Who am I in openGym',
  description: 'Returns the currently authenticated openGym profile (name, id, admin status).',
  inputSchema: {}
}, async () => {
  const { user } = await api('/api/me');
  return { content: [{ type: 'text', text: JSON.stringify(user, null, 2) }] };
});

server.registerTool('opengym_list_routines', {
  title: 'List routines',
  description: "List the user's saved workout routines (id, name, exercise count).",
  inputSchema: {}
}, async () => {
  const S = await getState();
  const routines = (S.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, exercises: (r.ex || []).length }));
  return { content: [{ type: 'text', text: JSON.stringify(routines, null, 2) }] };
});

server.registerTool('opengym_today_plan', {
  title: "Today's plan",
  description: 'What routine (if any) is scheduled for today, accounting for reschedules and rest days.',
  inputSchema: {}
}, async () => {
  const S = await getState();
  const today = isoOf(new Date());
  const ov = S.dayPlan?.[today];
  let routineId = null;
  if (ov === 'rest') routineId = null;
  else if (ov && S.routines?.some(r => r.id === ov)) routineId = ov;
  else { const wd = new Date(today + 'T12:00:00').getDay(); routineId = S.week?.[wd] || null; }
  const routine = routineId ? (S.routines || []).find(r => r.id === routineId) : null;
  const alreadyLogged = (S.workouts || []).some(w => w.d === today);
  return { content: [{ type: 'text', text: JSON.stringify({
    date: today, rest_day: !routineId, routine: routine ? { id: routine.id, name: routine.name } : null,
    already_logged_today: alreadyLogged
  }, null, 2) }] };
});

server.registerTool('opengym_workout_history', {
  title: 'Workout history',
  description: 'List recent logged workouts (date, routine, duration, volume, PRs). Newest first.',
  inputSchema: { limit: z.number().int().min(1).max(200).default(20).describe('Max workouts to return') }
}, async ({ limit }) => {
  const S = await getState();
  const workouts = (S.workouts || []).slice().reverse().slice(0, limit).map(w => ({
    id: w.id, date: w.d, routine: w.name, bodyweight: w.bw,
    duration_min: w.end && w.start ? Math.round((w.end - w.start) / 60000) : null,
    volume: w.vol || null, prs: w.prs || [],
    exercises: (w.entries || []).map(e => ({ exerciseId: e.id, sets: (e.sets || []).length, topWeight: e.topW }))
  }));
  return { content: [{ type: 'text', text: JSON.stringify(workouts, null, 2) }] };
});

server.registerTool('opengym_bodyweight_history', {
  title: 'Bodyweight history',
  description: "List the user's logged bodyweight entries over time, plus their goal weight if set.",
  inputSchema: { limit: z.number().int().min(1).max(500).default(30).describe('Max entries to return, most recent first') }
}, async ({ limit }) => {
  const S = await getState();
  const entries = (S.bodyweight || []).slice().reverse().slice(0, limit);
  return { content: [{ type: 'text', text: JSON.stringify({ target: S.targetW || null, entries }, null, 2) }] };
});

server.registerTool('opengym_log_bodyweight', {
  title: 'Log bodyweight',
  description: "Add a bodyweight entry. Defaults to today's date if not given.",
  inputSchema: {
    weight: z.number().positive().describe('Body weight, in whatever unit the profile is set to (kg or lb)'),
    date: z.string().optional().describe('ISO date YYYY-MM-DD; defaults to today')
  }
}, async ({ weight, date }) => {
  const S = await getState();
  const iso = date || isoOf(new Date());
  S.bodyweight = S.bodyweight || [];
  S.bodyweight = S.bodyweight.filter(e => e.d !== iso); // one entry per day — a re-log for today replaces, doesn't duplicate
  S.bodyweight.push({ d: iso, w: weight, t: Date.now() });
  S.bodyweight.sort((a, b) => a.d.localeCompare(b.d));
  await putState(S);
  return { content: [{ type: 'text', text: `Logged bodyweight ${weight} on ${iso}.` }] };
});

server.registerTool('opengym_log_workout', {
  title: 'Log a completed workout',
  description: 'Record a full workout session: routine, date, and the sets performed per exercise. ' +
    'Exercise IDs must match openGym\'s exercise library (use opengym_list_routines to find IDs already in a saved routine, ' +
    'or ask the user which exercise they mean if unsure — this tool does not search the exercise library.).',
  inputSchema: {
    routineId: z.string().optional().describe('Routine id this session was based on, if any'),
    routineName: z.string().optional().describe("Session name if not tied to a saved routine (e.g. 'Push Day')"),
    date: z.string().optional().describe('ISO date YYYY-MM-DD; defaults to today'),
    bodyweight: z.number().positive().optional().describe("Body weight logged for this session, if the user gave one"),
    exercises: z.array(z.object({
      exerciseId: z.string().describe("openGym exercise id"),
      sets: z.array(z.object({
        weight: z.number().min(0).describe('Weight used for this set (0 for bodyweight-only exercises)'),
        reps: z.number().min(0).describe('Reps completed'),
      })).min(1)
    })).min(1)
  }
}, async ({ routineId, routineName, date, bodyweight, exercises }) => {
  const S = await getState();
  const iso = date || isoOf(new Date());
  const routine = routineId ? (S.routines || []).find(r => r.id === routineId) : null;
  const startMs = new Date(iso + 'T12:00:00').getTime();
  const entries = exercises.map(e => ({
    id: e.exerciseId,
    sets: e.sets.map(s => ({ w: s.weight, r: s.reps, done: true })),
    topW: Math.max(0, ...e.sets.map(s => s.weight)) || null
  }));
  const workout = {
    id: uid(), d: iso, start: startMs, end: startMs + 45 * 60000, // duration is a guess (MCP has no live session) — the app's own timer is authoritative when logged through the UI
    routineId: routine ? routine.id : null,
    name: routine ? routine.name : (routineName || 'Workout'),
    bw: bodyweight ?? (S.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1].w : null),
    entries, prs: []
  };
  workout.vol = entries.reduce((v, e) => v + e.sets.reduce((n, s) => n + s.w * s.r, 0), 0);
  S.workouts = S.workouts || [];
  S.workouts.push(workout);
  S.workouts.sort((a, b) => a.d.localeCompare(b.d));
  await putState(S);
  return { content: [{ type: 'text', text: `Logged "${workout.name}" on ${iso}: ${exercises.length} exercise(s), ${entries.reduce((n, e) => n + e.sets.length, 0)} total sets.` }] };
});

server.registerTool('opengym_set_today_plan', {
  title: "Override today's / a specific day's plan",
  description: 'Assign a routine (or "rest") to a specific date, overriding the weekly schedule for just that day.',
  inputSchema: {
    date: z.string().optional().describe('ISO date YYYY-MM-DD; defaults to today'),
    routineId: z.string().nullable().describe('Routine id to schedule, or null/omit for a rest day'),
  }
}, async ({ date, routineId }) => {
  const S = await getState();
  const iso = date || isoOf(new Date());
  S.dayPlan = S.dayPlan || {};
  if (routineId) {
    if (!(S.routines || []).some(r => r.id === routineId)) throw new Error(`No routine with id "${routineId}" — check opengym_list_routines.`);
    S.dayPlan[iso] = routineId;
  } else {
    S.dayPlan[iso] = 'rest';
  }
  await putState(S);
  return { content: [{ type: 'text', text: `Set ${iso} to ${routineId ? `routine ${routineId}` : 'rest day'}.` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('openGym MCP server running (stdio) — connected as', OPENGYM_URL);
