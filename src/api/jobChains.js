import { authFetch } from '@xeplr/ui-account'

// "AFTER THIS JOB" RULES — served by the WORKFLOW API, not by jobs.
//
// Jobs never start each other; the workflow engine does every hand-off, and a
// job's rules are a workflow it keeps (GET/PUT <workflow>/job-chains/:jobId).
// So this is where that API is mounted, set by the host — and null when there
// is no workflow on the install, which hides the section rather than showing
// one that cannot save.
//
// Over HTTP only: this package does not import workflow's code, so each can be
// installed on its own.
let CHAINS_BASE = null

export function configureChainsApi(base) {
  CHAINS_BASE = typeof base === 'string' ? base.replace(/\/+$/, '') : null
}

export function chainsEnabled() {
  return CHAINS_BASE !== null
}

const url = (jobId) => `${CHAINS_BASE}/job-chains/${encodeURIComponent(jobId)}`

/** { jobId, workflowId, rules } — an empty list for a job with none. */
export async function getChain(jobId) {
  return authFetch(url(jobId))
}

/** Replace a job's rules. An empty list removes them. */
export async function putChain(jobId, rules, jobName) {
  return authFetch(url(jobId), {
    method: 'PUT',
    body: JSON.stringify({ rules: rules, jobName: jobName })
  })
}
