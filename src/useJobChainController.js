import { useEffect, useState } from 'react'
import { chainsEnabled, getChain, putChain } from './api/jobChains.js'
import { blankRow, rowsToRules, rulesToRows, sameRules } from './lib/jobChainModel.js'

/**
 * State and handlers for a job's "After this job" rules — no JSX.
 *
 * Loaded when an existing job is opened; saved by the editor's own Save,
 * after the job itself (a new job has no id to hang rules on until then).
 * `enabled` is false when the host has no workflow API, and the section is
 * then not shown at all.
 */
export function useJobChainController(jobId) {
  const enabled = chainsEnabled()
  const [rows, setRows] = useState([])
  const [saved, setSaved] = useState([])
  const [on, setOn] = useState(false)
  const [loading, setLoading] = useState(Boolean(enabled && jobId))
  const [loadError, setLoadError] = useState(null)
  // Reshaped outside this form: its rules are not shown or saved from here.
  const [editedElsewhere, setEditedElsewhere] = useState(false)
  // The other workflows this job's finish starts, made elsewhere.
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (!enabled || !jobId) return
    let live = true
    setLoading(true)
    getChain(jobId)
      .then((res) => {
        if (!live) return
        const rules = (res && res.rules) || []
        setSaved(rules)
        setRows(rulesToRows(rules))
        setOn(rules.length > 0)
        setEditedElsewhere(Boolean(res && res.editedElsewhere))
        setOthers((res && res.others) || [])
        setLoadError(null)
      })
      .catch((err) => { if (live) setLoadError(err.message || 'Could not load the rules') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [enabled, jobId])

  function setTurnedOn(value) {
    setOn(value)
    if (value && !rows.length) setRows([blankRow()])
  }

  function updateRow(index, patch) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() { setRows((rs) => [...rs, blankRow()]) }

  function removeRow(index) { setRows((rs) => rs.filter((_, i) => i !== index)) }

  // First match wins, so order is meaning.
  function moveUp(index) {
    if (index < 1) return
    setRows((rs) => {
      const next = rs.slice()
      const [row] = next.splice(index, 1)
      next.splice(index - 1, 0, row)
      return next
    })
  }

  /** The rules this form would save, and anything wrong with them. */
  function check(ownJobId) {
    if (!on || editedElsewhere) return { rules: [], problems: [] }
    return rowsToRules(rows, ownJobId)
  }

  /**
   * Save the rules for a job that now has an id. Skipped when nothing
   * changed, so saving a job's schedule does not rewrite its chain.
   */
  async function save(savedJobId, jobName) {
    if (!enabled || !savedJobId || loadError || editedElsewhere) return
    const { rules, problems } = check(savedJobId)
    if (problems.length) throw new Error(problems.join(' '))
    if (sameRules(rules, saved)) return
    const res = await putChain(savedJobId, rules, jobName)
    setSaved((res && res.rules) || rules)
  }

  return { enabled, on, setOn: setTurnedOn, rows, updateRow, addRow, removeRow, moveUp, loading, loadError, editedElsewhere, others, check, save }
}
