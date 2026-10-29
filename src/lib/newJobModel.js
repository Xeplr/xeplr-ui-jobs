// A NEW JOB, STARTED FROM SOMEWHERE ELSE — the host opens the editor already
// filled in, so "+ New job" on a movement does not make somebody pick the
// action and the movement again:
//
//   ?edit=new&action=move-run&inputs={"moveId":"abc"}&name=Nightly%20orders
//
// What arrives in a URL is not trusted: the action must be one this server
// offers, and inputs must be a JSON object. Anything else starts a blank job.
//
// Pure: no React.

/** The new job's starting values from the URL's action / inputs / name. */
export function newJobFrom(params, actions) {
  const get = (k) => (params && typeof params.get === 'function' ? params.get(k) : params && params[k]) || null
  const action = get('action')
  const known = action && (actions || []).some((a) => a && a.name === action)
  const out = {}
  if (known) out.actionName = action
  const text = get('inputs')
  if (known && text) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) out.inputs = parsed
    } catch (e) { /* not JSON: no inputs */ }
  }
  const name = get('name')
  if (name) out.name = String(name).slice(0, 200)
  return out
}

/** The URL keys this reads, cleared when the editor closes. */
export const NEW_JOB_KEYS = ['action', 'inputs', 'name']

/** The link a host builds: the jobs page's path plus these. */
export function newJobQuery({ action, inputs, name }) {
  const q = new URLSearchParams({ edit: 'new' })
  if (action) q.set('action', action)
  if (inputs) q.set('inputs', JSON.stringify(inputs))
  if (name) q.set('name', name)
  return '?' + q.toString()
}
