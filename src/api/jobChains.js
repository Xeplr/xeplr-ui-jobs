import { authFetch } from '@xeplr/ui-account'
import { rulesToWorkflow, shortcutKey, workflowToRules } from '../lib/jobChainModel.js'

// "AFTER THIS JOB" — kept as an ORDINARY WORKFLOW in the workflow API, not by
// jobs: a workflow triggered by this job finishing (see lib/jobChainModel.js
// for its shape). Jobs never start each other; the workflow engine does every
// hand-off. These are the workflow API's ordinary routes:
//
//   GET  <workflow>/workflows/by-key/after-job-<jobId>   this job's shortcut
//   GET  <workflow>/workflows/by-trigger?kind=job&jobId= every workflow it starts
//   POST <workflow>/workflows/save                       save the shortcut
//
// So this is where that API is mounted, set by the host — and null when there
// is no workflow on the install, which hides the section rather than showing
// one that cannot save. Over HTTP only: this package does not import
// workflow's code, so each can be installed on its own.
let CHAINS_BASE = null

export function configureChainsApi(base) {
  CHAINS_BASE = typeof base === 'string' ? base.replace(/\/+$/, '') : null
}

export function chainsEnabled() {
  return CHAINS_BASE !== null
}

async function shortcut(jobId) {
  try {
    const res = await authFetch(`${CHAINS_BASE}/workflows/by-key/${encodeURIComponent(shortcutKey(jobId))}`)
    return (res && res.dataArray && res.dataArray[0]) || null
  } catch (err) {
    if (err && (err.status === 404 || err.statusCode === 404)) return null
    throw err
  }
}

/**
 * { jobId, workflowId, rules, editedElsewhere, others } — an empty list for a
 * job with none. `editedElsewhere`: the shortcut was reshaped outside this
 * form, so its rules are not shown (open it in the workflow screens).
 * `others`: the other workflows this job's finish starts, by name.
 */
export async function getChain(jobId) {
  const [own, all] = await Promise.all([
    shortcut(jobId),
    authFetch(`${CHAINS_BASE}/workflows/by-trigger?kind=job&jobId=${encodeURIComponent(jobId)}`)
  ])
  const read = workflowToRules(own)
  const others = ((all && all.dataArray) || [])
    .filter((w) => w.key !== shortcutKey(jobId) && w.status === 'published')
    .map((w) => ({ id: w.id, name: w.name }))
  return { jobId, workflowId: own ? own.id : null, rules: read.rules, editedElsewhere: Boolean(read.editedElsewhere), others }
}

/** Replace a job's rules. An empty list keeps the workflow as a draft, so it no longer runs. */
export async function putChain(jobId, rules, jobName) {
  const own = await shortcut(jobId)
  const entry = rulesToWorkflow(jobId, jobName, rules, own)
  await authFetch(`${CHAINS_BASE}/workflows/save`, { method: 'POST', body: JSON.stringify([entry]) })
  return { jobId, rules }
}
