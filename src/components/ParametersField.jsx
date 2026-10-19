import { useEffect, useState } from 'react'
import { fetchSuggestions } from '../api/jobs.js'
import { FIXED, groupedChoices, rowsFromText, rowsToText, sourceOf, unusedNames, valueForSource } from '../lib/parametersModel.js'
import './ParametersField.css'

/**
 * Parameters as rows: a name, and where its value comes from — the start or
 * end of the run's window, or a fixed value. Presentation and row editing only;
 * the conversion is lib/parametersModel.js.
 *
 * `value` / `onChange` carry the saved text ([{ name, value }] as JSON), so
 * the editor saves this field like any other list.
 *
 * @param {object} props.field     the action's input ({ name, label, description })
 * @param {string} props.value     saved JSON text
 * @param {Function} props.onChange
 * @param {object[]} props.contract  what every run receives (useRunContract)
 * @param {object} props.inputs      the job's other inputs — what the name
 *   suggestions are asked with (field.suggestWith)
 */
// What each input the suggestions depend on is called, for "choose the … above".
const WHAT = { connectionInfoId: 'connection', dbInfoId: 'database', procedure: 'procedure' }

/**
 * A name box whose list OPENS ON CLICK — the procedure's parameter names,
 * narrowed by what is typed — and says why when it has none. A plain
 * <datalist> shows nothing until something is typed in several browsers.
 */
function NameBox({ label, value, names, emptyNote, onChange }) {
  const [open, setOpen] = useState(false)
  const typed = String(value || '').trim().toLowerCase()
  const shown = names.filter((n) => !typed || n.toLowerCase().includes(typed))
  return (
    <div className="jb-namebox">
      <input aria-label={label} className="jb-param-name" value={value} placeholder="name" autoComplete="off"
        role="combobox" aria-expanded={open}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }} />
      {open && (
        <ul className="jb-namebox-list" role="listbox">
          {shown.length ? shown.map((n) => (
            <li key={n} role="option" aria-selected={n === value}
              onMouseDown={(e) => { e.preventDefault(); onChange(n); setOpen(false) }}>{n}</li>
          )) : (
            <li className="jb-namebox-note">{names.length ? 'No parameter matches what is typed.' : (emptyNote || 'Type the name.')}</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function ParametersField({ field, value, onChange, contract, inputs }) {
  const [rows, setRows] = useState(() => rowsFromText(value, contract))
  const id = `jb-in-${field.name}`

  // THE PROCEDURE'S OWN PARAMETER NAMES, offered when a name box is clicked —
  // asked again whenever the connection, database or procedure changes.
  const query = Object.fromEntries(Object.entries(field.suggestWith || {}).map(([k, from]) => [k, inputs?.[from]]))
  const queryKey = JSON.stringify(query)
  // What the name list says when it has nothing: which choice above is still
  // missing, that it is looking, or that the procedure has none.
  const missing = Object.entries(field.suggestWith || {}).filter(([k]) => !query[k]).map(([, from]) => WHAT[from] || from)
  const [names, setNames] = useState([])
  const [state, setState] = useState('idle')
  useEffect(() => {
    if (!field.suggestFrom) return undefined
    const q = JSON.parse(queryKey)
    if (Object.values(q).some((v) => v === undefined || v === null || v === '')) { setNames([]); setState('idle'); return undefined }
    let live = true
    setState('loading')
    fetchSuggestions(field.suggestFrom, q)
      .then((n) => { if (live) { setNames(n); setState('ready') } })
      .catch(() => { if (live) { setNames([]); setState('failed') } })
    return () => { live = false }
  }, [field.suggestFrom, queryKey])
  const emptyNote = !field.suggestFrom ? null
    : missing.length ? `Choose the ${missing.join(', ')} above to see this procedure's parameters.`
    : state === 'loading' ? 'Reading the procedure\'s parameters…'
    : state === 'failed' ? 'Could not read the procedure\'s parameters. Type the name.'
    : 'This procedure has no parameters to fill, or it was not found. Type the name.'

  // Saved text that is not a list (typed by hand before this control
  // existed) is shown as it is rather than guessed at.
  if (rows === null) {
    return (
      <div className="jb-field jb-field--wide">
        <label htmlFor={id}>{field.label || field.name}</label>
        <textarea id={id} rows={4} spellCheck="false" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="jb-help jb-warn">This is not a list of parameters, so it is shown as it was saved.</span>
      </div>
    )
  }

  function update(next) {
    setRows(next)
    onChange(rowsToText(next))
  }
  const patchRow = (i, p) => update(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))

  return (
    <div className="jb-field jb-field--wide">
      <label>{field.label || field.name}</label>
      {contract.length > 0 && (
        <span className="jb-help">
          Pick each value from what every run receives: this run's window (from its schedule or the job
          before it), and, when another job started it, the range that job was given and the range it
          actually used. Anything else is a fixed value.
        </span>
      )}
      <div className="jb-params">
        {rows.map((r, i) => {
          const source = sourceOf(r.value, contract)
          return (
            <div key={i} className="jb-param">
              <NameBox label={`Parameter ${i + 1} name`} value={r.name}
                names={unusedNames(names, rows, i)} emptyNote={emptyNote}
                onChange={(name) => patchRow(i, { name })} />
              <span className="jb-param-arrow" aria-hidden="true">←</span>
              <select aria-label={`Parameter ${i + 1} value`} value={source}
                onChange={(e) => patchRow(i, { value: valueForSource(e.target.value, r.value, contract) })}>
                {groupedChoices(contract).map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((c) => <option key={c.key} value={c.key} title={c.description}>{c.label}</option>)}
                  </optgroup>
                ))}
                <option value={FIXED}>Fixed value</option>
              </select>
              {source === FIXED ? (
                <input aria-label={`Parameter ${i + 1} fixed value`} className="jb-param-value" value={r.value == null ? '' : String(r.value)}
                  placeholder="value" onChange={(e) => patchRow(i, { value: e.target.value })} />
              ) : <span className="jb-param-gap" />}
              <button type="button" className="jb-param-remove" title="Remove this parameter"
                onClick={() => update(rows.filter((_, j) => j !== i))}>✕</button>
            </div>
          )
        })}
      </div>
      <button type="button" className="jb-param-add" onClick={() => update([...rows, { name: '', value: '' }])}>+ Add parameter</button>
      <span className="jb-help">
        Click a name box to pick one of the procedure's parameters, or type your own.
        {' '}On MySQL, parameters go by position, so keep them in the order the procedure declares them.
      </span>
    </div>
  )
}
