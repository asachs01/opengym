// Equipment profiles ("Home", "Gym", ...) — what you actually have access to, so the Library,
// exercise picker, and your saved routines can be filtered/flagged against it instead of
// showing 1,300+ exercises assuming a fully-stocked commercial gym every time.
import { EXDB } from './exercises-data.js'
import { exOr } from './exercises.js'

// Every equipment tag in the dataset, most common first — same ordering rule as equipmentOf()
// in exercises.js, so the picker UI reads the same way everywhere it appears.
export const ALL_EQUIPMENT = (() => {
  const c = {}
  EXDB.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
})()

// Body weight needs no equipment at all, so it's always available regardless of what a
// profile lists — nobody should have to remember to add it, and there's no home or gym
// where you can't do a push-up.
export const ALWAYS_AVAILABLE_EQ = 'body weight'

export const activeProfile = S => (S.equipProfiles || []).find(p => p.id === S.activeEquip) || null

// No active profile = no filtering anywhere (today's behavior, unchanged). An active profile
// with an empty equipment list still allows bodyweight work — it's "I have nothing", not
// "hide everything including exercises that need nothing".
export const exAvailable = (ex, profile) =>
  !profile || ex.eq === ALWAYS_AVAILABLE_EQ || (profile.eq || []).includes(ex.eq)

// Coverage of a routine against a profile — used by RoutineEdit to flag entries that need
// equipment outside the active profile, and to summarize how many are affected. Returns the
// index set (not exercise objects) so callers can key off r.ex[i] directly, same as the rest
// of RoutineEdit already does.
export function routineCoverage(routine, profile) {
  const missing = new Set()
  if (!profile) return { missing, missingCount: 0 }
  ;(routine.ex || []).forEach((e, i) => {
    const ex = exOr(e.id)
    if (ex && !ex.missing && !exAvailable(ex, profile)) missing.add(i)
  })
  return { missing, missingCount: missing.size }
}
