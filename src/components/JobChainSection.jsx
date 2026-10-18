import { CHAIN_FIELDS, EXAMPLE_WHEN } from '../lib/jobChainModel.js'
import './JobChainSection.css'

/**
 * "After this job" — which job runs next, depending on how this one ended.
 *
 * Presentation only: everything comes from useJobChainController. Conditions
 * and values are JSON on purpose (the free product has no workflow designer);
 * the server checks what they mean and names the rule when one is wrong.
 *
 * @param {object} props.chain   useJobChainController()
 * @param {object[]} props.jobs  every job, for the "run" picker
 * @param {string} [props.jobId] this job, left out of the picker
 */
export default function JobChainSection({ chain, jobs, jobId }) {
  if (chain.loading) return <p className="muted">Loading the rules…</p>
  if (chain.loadError) {
    return <p className="jb-help jb-warn">Could not load this job's rules, so they cannot be changed here: {chain.loadError}</p>
  }

  const others = (jobs || []).filter((j) => j.id !== jobId)

  return (
    <div className="jb-chain">
      <label className="jb-chain-toggle">
        <input type="checkbox" checked={chain.on} onChange={(e) => chain.setOn(e.target.checked)} />
        Run another job when this one finishes
      </label>

      {!chain.on && (
        <p className="jb-help">Nothing runs after this job. Tick the box to choose what should, and when.</p>
      )}

      {chain.on && (
        <>
          <p className="jb-help">
            Rules are checked top to bottom and the first that matches runs its job. A rule with no
            condition means “otherwise”. The period this job ran for passes to the next job by itself.
          </p>

          <ol className="jb-chain-rules">
            {chain.rows.map((row, i) => (
              <li key={i} className="jb-chain-rule">
                <div className="jb-chain-head">
                  <span className="jb-chain-n">Rule {i + 1}</span>
                  <span className="jb-chain-tools">
                    <button type="button" onClick={() => chain.moveUp(i)} disabled={i === 0} title="Check this rule earlier">↑</button>
                    <button type="button" className="jb-danger" onClick={() => chain.removeRow(i)}>Remove</button>
                  </span>
                </div>

                <div className="jb-field">
                  <label htmlFor={`jb-chain-when-${i}`}>If <span className="jb-type">· JSON, empty = otherwise</span></label>
                  <textarea id={`jb-chain-when-${i}`} className="jb-chain-json" rows={3}
                    placeholder={EXAMPLE_WHEN} value={row.when}
                    onChange={(e) => chain.updateRow(i, { when: e.target.value })} />
                </div>

                <div className="jb-field">
                  <label htmlFor={`jb-chain-run-${i}`}>Run</label>
                  <select id={`jb-chain-run-${i}`} value={row.run}
                    onChange={(e) => chain.updateRow(i, { run: e.target.value })}>
                    <option value="">Choose a job…</option>
                    {others.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>

                <details className="jb-advanced" open={Boolean(row.inputs || row.carry)}>
                  <summary>Pass values on <span className="jb-dim">— optional</span></summary>
                  <div className="jb-field">
                    <label htmlFor={`jb-chain-inputs-${i}`}>Inputs of the next job <span className="jb-type">· JSON</span></label>
                    <textarea id={`jb-chain-inputs-${i}`} className="jb-chain-json" rows={3}
                      placeholder={'{ "region": "{output.region}" }'} value={row.inputs}
                      onChange={(e) => chain.updateRow(i, { inputs: e.target.value })} />
                    <span className="jb-help">
                      Only inputs the next job accepts (its Inputs step lists them). Leave out
                      <code className="jb-code">window</code> to pass this job's period on unchanged.
                    </span>
                  </div>
                  <div className="jb-field">
                    <label htmlFor={`jb-chain-carry-${i}`}>Carry for later jobs <span className="jb-type">· JSON</span></label>
                    <textarea id={`jb-chain-carry-${i}`} className="jb-chain-json" rows={3}
                      placeholder={'{ "loadedRows": "{output.totalRows}" }'} value={row.carry}
                      onChange={(e) => chain.updateRow(i, { carry: e.target.value })} />
                    <span className="jb-help">Read later as <code className="jb-code">carry.loadedRows</code>, in a condition or a value.</span>
                  </div>
                </details>
              </li>
            ))}
          </ol>

          <button type="button" className="jb-chain-add" onClick={chain.addRow}>+ Add rule</button>

          <details className="jb-advanced">
            <summary>What a condition can read</summary>
            <ul className="jb-chain-fields">
              {CHAIN_FIELDS.map((f) => (
                <li key={f.field}><code className="jb-code">{f.field}</code> — {f.about}</li>
              ))}
            </ul>
            <p className="jb-help">
              Comparisons: <code className="jb-code">=</code> <code className="jb-code">!=</code>{' '}
              <code className="jb-code">&gt;</code> <code className="jb-code">&gt;=</code>{' '}
              <code className="jb-code">&lt;</code> <code className="jb-code">&lt;=</code>{' '}
              <code className="jb-code">in</code> <code className="jb-code">contains</code>{' '}
              <code className="jb-code">isEmpty</code> and more. Combine with
              <code className="jb-code">{'{ "all": [ … ] }'}</code> or <code className="jb-code">{'{ "any": [ … ] }'}</code>.
              Values bind with <code className="jb-code">{'{output.name}'}</code>, <code className="jb-code">{'{carry.name}'}</code>, <code className="jb-code">{'{window.to}'}</code>.
            </p>
          </details>
        </>
      )}
    </div>
  )
}
