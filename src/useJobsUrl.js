import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// WHERE YOU ARE ON THE JOBS SCREEN LIVES IN THE URL, so a refresh or a shared
// link lands on exactly this screen:
//
//   ?edit=<jobId> | ?edit=new   the editor, open on that job (or a new one)
//   &step=job|inputs|schedule|after   its step
//   ?runs=<jobId>               that job's run history, expanded
//   &log=<occurrenceId>         one run's log, open
//   ?q=…&sort=…                 the search and the sort
//
// Opening and closing things adds a history entry, so Back closes them;
// typing and switching steps replaces it, so Back is not a keystroke undo.
const KEYS = ['edit', 'step', 'runs', 'log', 'q', 'sort']

export function useJobsUrl() {
  const [params, setParams] = useSearchParams()
  const read = (k) => params.get(k) || null

  const set = useCallback((patch, opts) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.keys(patch).forEach((k) => {
        const v = patch[k]
        if (v === null || v === undefined || v === '') next.delete(k)
        else next.set(k, String(v))
      })
      return next
    }, { replace: Boolean(opts && opts.replace) })
  }, [setParams])

  return {
    edit: read('edit'),
    step: read('step'),
    runs: read('runs'),
    log: read('log'),
    q: read('q') || '',
    sort: read('sort') || 'name',
    set: set,
    KEYS: KEYS
  }
}
