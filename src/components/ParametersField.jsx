import { useState } from 'react'
import { FIXED, groupedChoices, rowsFromText, rowsToText, sourceOf, valueForSource } from '../lib/parametersModel.js'
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
 */
export default function ParametersField({ field, value, onChange, contract }) {
  const [rows, setRows] = useState(() => rowsFromText(value, contract))
  const id = `jb-in-${field.name}`

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
              <input aria-label={`Parameter ${i + 1} name`} className="jb-param-name" value={r.name}
                placeholder={source === FIXED ? 'name' : 'e.g. startDate'}
                onChange={(e) => patchRow(i, { name: e.target.value })} />
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
        The name is the procedure's own parameter name. On MySQL, parameters go by position, so keep
        them in the order the procedure declares them.
      </span>
    </div>
  )
}
