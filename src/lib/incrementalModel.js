// WHICH ROWS EACH RUN TAKES — the job's decision (@xeplr/jobs'
// incrementalMode and reloadDays), not the action's.
//
// Offered only for an action that takes a date range: one whose inputSchema
// has a `window` field. "Continue from what is already loaded" needs the
// action to read its own target, so it is offered only when that field says
// it can (`watermark: true`, as BI's move-run does). An action that never
// declared it would be handed a word it does not know.
//
// Pure: no React.

export const NONE = ''

/** The `window` field of an action, or null when it takes no range. */
export function windowField(action) {
  return ((action && action.inputSchema) || []).find((f) => f && f.name === 'window') || null
}

/** The choices this action allows, in the order they are shown. */
export function incrementalChoices(action) {
  const field = windowField(action)
  if (!field) return []
  const out = [
    { value: NONE, label: 'Everything, each run', help: 'No range is worked out: each run takes what its inputs say.' },
    { value: 'period', label: 'Since the last successful run', help: 'Each run covers from where the last successful one stopped, up to now. A failed run is picked up by the next.' }
  ]
  if (field.watermark) {
    out.push({ value: 'watermark', label: 'Continue from what is already loaded', help: 'Each run reads the highest value the target already holds and takes everything after it.' })
  }
  return out
}

/** The two fields as the form holds them: mode, and days as text. */
export function incrementalDraft(job) {
  return {
    incrementalMode: (job && job.incrementalMode) || NONE,
    reloadDays: job && job.reloadDays ? String(job.reloadDays) : ''
  }
}

/**
 * What is saved. A mode the action no longer allows (the action was changed)
 * is cleared rather than kept; reloadDays belongs to 'watermark' only.
 * Returns { body } or { problem } in words.
 */
export function incrementalBody(draft, action) {
  const allowed = incrementalChoices(action).map((c) => c.value)
  const mode = allowed.includes(draft.incrementalMode) ? draft.incrementalMode : NONE
  if (mode !== 'watermark') return { body: { incrementalMode: mode || null, reloadDays: null } }
  const text = String(draft.reloadDays == null ? '' : draft.reloadDays).trim()
  if (text === '') return { body: { incrementalMode: mode, reloadDays: null } }
  const days = Number(text)
  if (!Number.isInteger(days) || days < 1) {
    return { problem: 'Re-read the last … days takes a whole number of days, 1 or more — or leave it empty.' }
  }
  return { body: { incrementalMode: mode, reloadDays: days } }
}
