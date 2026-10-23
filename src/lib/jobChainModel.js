// "AFTER THIS JOB" — the rules a job's screen writes, as pure logic.
//
// The rules are an ORDINARY WORKFLOW, triggered by this job finishing
// ({ kind: 'job', jobId, when: 'finished' } — @xeplr/workflow-engine's
// triggers). This screen is a shortcut for one shape of it:
//
//   decide       one arrow per rule, written as `when` (the engine compiles
//                it), first match wins; no match ends the run
//   run steps    one per rule: job-run, which starts that job and waits
//
// kept under the key `after-job-<jobId>`, so this job's own shortcut is told
// apart from any other workflow the same job triggers. Reshape it somewhere
// else (another step, another trigger) and it no longer fits this form: the
// screen then says so and points there, rather than showing rules that are
// not what runs. Everything here is pure, so it can be tested with plain node.
//
// A rule as this form writes it — fields and bindings relative to the job
// that finished (`status`, `output.x`, `{output.region}`); stored, they read
// the workflow's trigger (`trigger.status`, `{trigger.output.region}`):
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

// ── the rules ⇄ the workflow they are ───────────────────────────────────

/** The workflow key this job's "After this job" shortcut keeps its rules under. */
export function shortcutKey(jobId) {
  return 'after-job-' + jobId
}

// What a rule's fields and bindings start with — the finished job's values,
// which the workflow reads from its trigger.
const ROOTS = ['status', 'error', 'output', 'carry', 'window', 'jobId', 'given', 'used']
const ROOT_FIELD = new RegExp('^(' + ROOTS.join('|') + ')(\\.|$)')

function mapWhen(when, fn) {
  if (!when || typeof when !== 'object') return when
  if (Array.isArray(when.all)) return { all: when.all.map((w) => mapWhen(w, fn)) }
  if (Array.isArray(when.any)) return { any: when.any.map((w) => mapWhen(w, fn)) }
  return { ...when, field: fn(String(when.field || '')) }
}

function mapBindings(value, fn) {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map((v) => mapBindings(v, fn))
  if (value && typeof value === 'object') {
    const out = {}
    Object.keys(value).forEach((k) => { out[k] = mapBindings(value[k], fn) })
    return out
  }
  return value
}

const toTriggerField = (f) => (ROOT_FIELD.test(f) ? 'trigger.' + f : f)
const fromTriggerField = (f) => (f.startsWith('trigger.') ? f.slice('trigger.'.length) : f)
const BINDING_ROOT = new RegExp('\\{\\s*(' + ROOTS.join('|') + ')\\b', 'g')
const toTriggerBindings = (text) => text.replace(BINDING_ROOT, '{trigger.$1')
const fromTriggerBindings = (text) => text.replace(/\{\s*trigger\./g, '{')

function freshKey() {
  return 'run_' + Math.random().toString(36).slice(2, 8)
}

/**
 * The workflow changeset for a job's rules — one entry for POST
 * /workflows/save. `existing` is the shortcut's workflow as GET returned it
 * (with `steps`), or null for a job that has none yet. Steps are reused by
 * position and removed ones sent as deleted, so a save never collides with a
 * step key it used before. No rules: kept as a draft, so it no longer runs.
 */
export function rulesToWorkflow(jobId, jobName, rules, existing) {
  const list = Array.isArray(rules) ? rules : []
  const steps = existing && Array.isArray(existing.steps) ? existing.steps : []
  const oldDecide = steps.find((s) => s.stepKey === 'decide')
  const oldRuns = steps.filter((s) => s.stepKey !== 'decide').sort((a, b) => (a.position || 0) - (b.position || 0))

  const runs = list.map((rule, i) => {
    const reuse = oldRuns[i]
    return {
      ...(reuse ? { id: reuse.id } : {}),
      stepKey: reuse ? reuse.stepKey : freshKey(),
      name: 'Run job ' + rule.run,
      actionName: 'job-run',
      kind: 'wait',
      onError: 'stop',
      position: i + 1,
      values: {
        jobId: rule.run,
        inputs: mapBindings(rule.inputs || {}, toTriggerBindings),
        carry: mapBindings(rule.carry || {}, toTriggerBindings),
        callbackUrl: '{resumeUrl}'
      },
      transitions: [{ when: null, mode: 'single', target: 'end_success' }]
    }
  })
  const arrows = list.map((rule, i) => ({ when: mapWhen(rule.when || null, toTriggerField), mode: 'single', target: runs[i].stepKey }))
  // Nothing matching ends the run: "if this, run that" is not a failure when
  // neither applies.
  if (!list.length || list[list.length - 1].when) arrows.push({ when: null, mode: 'single', target: 'end_success' })

  const decide = {
    ...(oldDecide ? { id: oldDecide.id } : {}),
    stepKey: 'decide', name: 'Decide what runs next', actionName: 'decide',
    kind: 'auto', onError: 'stop', position: 0, values: {}, transitions: arrows
  }
  const removed = oldRuns.slice(list.length).map((s) => ({ id: s.id, deleted: true }))

  return {
    ...(existing && existing.id ? { id: existing.id } : {}),
    name: ('After ' + (String(jobName || '').trim() || 'job ' + jobId)).slice(0, 255),
    description: 'Made by the "After this job" setting of job ' + jobId + '.',
    kind: 'workflow',
    key: shortcutKey(jobId),
    status: list.length ? 'published' : 'draft',
    trigger: { kind: 'job', jobId: jobId, when: 'finished' },
    steps: [decide, ...runs, ...removed]
  }
}

/**
 * The rules a shortcut workflow says, or `{ editedElsewhere: true }` when it
 * has been reshaped so that this form can no longer say it truthfully.
 * A draft (rules removed) reads as no rules.
 */
export function workflowToRules(workflow) {
  if (!workflow) return { rules: [] }
  const t = workflow.trigger || {}
  const steps = Array.isArray(workflow.steps) ? workflow.steps : []
  const decide = steps.find((s) => s.stepKey === 'decide')
  const others = steps.filter((s) => s.stepKey !== 'decide')
  const fits = t.kind === 'job' && t.when === 'finished' && decide && decide.actionName === 'decide' &&
    others.every((s) => s.actionName === 'job-run' && s.values && s.values.jobId)
  if (!fits) return { editedElsewhere: true, rules: [] }
  if (workflow.status !== 'published') return { rules: [] }
  const byKey = Object.fromEntries(others.map((s) => [s.stepKey, s]))
  const arrows = Array.isArray(decide.transitions) ? decide.transitions : []
  const rules = []
  for (const a of arrows) {
    // An arrow with no condition at all is "otherwise", however it was written.
    const when = a.when !== undefined ? a.when : (a.condition == null ? null : undefined)
    if (a.target === 'end_success' && !when) continue
    const step = byKey[a.target]
    if (!step || when === undefined) return { editedElsewhere: true, rules: [] }
    rules.push({
      when: mapWhen(when, fromTriggerField),
      run: step.values.jobId,
      inputs: mapBindings(step.values.inputs || {}, fromTriggerBindings),
      carry: mapBindings(step.values.carry || {}, fromTriggerBindings)
    })
  }
  if (rules.length !== others.length) return { editedElsewhere: true, rules: [] }
  return { rules }
}
