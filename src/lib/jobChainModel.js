// "AFTER THIS JOB" — the rules a job's screen writes, as pure logic.
//
// The rules are kept by the workflow engine, not by jobs: each becomes a branch
// of one hidden workflow that runs when the job finishes (see
// @xeplr-workflow/engine's lib/jobChains.js). This file is only the form's
// half — the text a person types, turned into the rules the server takes,
// and back — so it can be tested with plain node.
//
// A rule as the server takes it:
//
//   { when: { field, op, value } | { all: [...] } | { any: [...] } | null,
//     run: '<jobId>', inputs: { … }, carry: { … } }
//
// `when` null is "otherwise". The window the job ran for passes to the next
// job by itself; `inputs` and `carry` are only for anything more.

/** The fields a condition can read, for the help text. */
export const CHAIN_FIELDS = [
  { field: 'status', about: '"success" or "failed" — did this job\'s work happen' },
  { field: 'output.<name>', about: 'what this job\'s action returned, e.g. output.totalRows' },
  { field: 'window.from / window.to', about: 'the period this job ran for' },
  { field: 'carry.<name>', about: 'values carried from earlier jobs in the chain' },
  { field: 'error.message', about: 'why it failed' }
]

export const EXAMPLE_WHEN = '{ "field": "status", "op": "=", "value": "success" }'

function pretty(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length) return ''
  return JSON.stringify(value, null, 2)
}

/** Server rules → the rows the form edits (JSON as text). */
export function rulesToRows(rules) {
  return (Array.isArray(rules) ? rules : []).map((r) => ({
    when: pretty(r.when),
    run: r.run || '',
    inputs: pretty(r.inputs),
    carry: pretty(r.carry)
  }))
}

export function blankRow() {
  return { when: '', run: '', inputs: '', carry: '' }
}

function parseObject(text, label, problems) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      problems.push(`${label} must be a JSON object, in { }.`)
      return null
    }
    return value
  } catch (err) {
    problems.push(`${label} is not valid JSON: ${err.message}`)
    return null
  }
}

/**
 * The form's rows → { rules, problems }. Every problem names its rule, so the
 * form can say all of them at once rather than one per save.
 *
 * The meaning of a condition (which fields, which comparisons) is the
 * server's to check — it answers with the rule and the reason. This only
 * catches what would never reach it: text that is not JSON, a rule with no job.
 */
export function rowsToRules(rows, ownJobId) {
  const problems = []
  const rules = (rows || []).map((row, i) => {
    const n = i + 1
    if (!row.run) problems.push(`Rule ${n}: choose the job to run.`)
    else if (ownJobId && row.run === ownJobId) problems.push(`Rule ${n}: a job cannot run itself when it finishes.`)
    const when = parseObject(row.when, `Rule ${n}'s condition`, problems)
    const inputs = parseObject(row.inputs, `Rule ${n}'s inputs`, problems)
    const carry = parseObject(row.carry, `Rule ${n}'s carry`, problems)
    return { when: when, run: row.run, inputs: inputs || {}, carry: carry || {} }
  })
  // First match wins, so nothing can follow an "otherwise".
  const otherwiseAt = rules.findIndex((r) => !r.when)
  if (otherwiseAt > -1 && otherwiseAt < rules.length - 1) {
    problems.push(`Rule ${otherwiseAt + 1} has no condition, so it always matches — move it last, or give it one.`)
  }
  return { rules: rules, problems: problems }
}

/** Whether two sets of server rules say the same thing. */
export function sameRules(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || [])
}

/** One line describing a rule, for a summary. */
export function describeRule(rule, jobName) {
  const target = jobName(rule.run) || rule.run || 'a job'
  const w = rule.when
  if (!w) return `Otherwise, run ${target}`
  if (w.field) return `If ${w.field} ${w.op} ${JSON.stringify(w.value ?? '')}, run ${target}`
  return `If ${w.all ? 'all' : 'any'} of ${(w.all || w.any || []).length} conditions match, run ${target}`
}

// ── what a job accepts from the job before it ───────────────────────────
//
// @xeplr/jobs lets a trigger fill only `window` and the inputs a job lists in
// acceptsInputs. A connection is never offered: it decides where the job
// reads and writes, and only whoever saves the job chooses that.
const NEVER_ACCEPTED = /connection/i

/** The action's fields another job could fill, by name. */
export function acceptableFields(fields) {
  return (fields || []).filter((f) => f && f.name && f.name !== 'window' && !NEVER_ACCEPTED.test(f.name))
}

export function toggleAccepted(list, name, on) {
  const set = new Set(Array.isArray(list) ? list : [])
  if (on) set.add(name)
  else set.delete(name)
  return Array.from(set)
}
