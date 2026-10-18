import { useEffect, useState } from 'react'
import { getRunContract } from './api/jobs.js'

// Fetched once per page load: it is a fact about the server, not about a job.
let cached = null

/**
 * The run contract (what every run receives), for the parameter dropdowns.
 * Empty until it arrives, and empty when the server has none to give — the
 * rows then offer only a fixed value.
 */
export function useRunContract() {
  const [contract, setContract] = useState(cached || [])
  useEffect(() => {
    if (cached) return
    let live = true
    getRunContract()
      .then((c) => { cached = c; if (live) setContract(c) })
      .catch(() => { if (live) setContract([]) })
    return () => { live = false }
  }, [])
  return contract
}
