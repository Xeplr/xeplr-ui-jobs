// "After this job" — the text a person types, turned into the rules the
// workflow API takes, and back. Wrong here means a chain that silently runs
// the wrong job, or a typo that is saved as a rule that never matches.
import {
  rulesToRows, rowsToRules, blankRow, sameRules, describeRule, acceptableFields, toggleAccepted,
  rulesToWorkflow, workflowToRules, shortcutKey
} from '../src/lib/jobChainModel.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }

console.log('\nrows → rules')
{
  const { rules, problems } = rowsToRules([
    { when: '{ "field": "status", "op": "=", "value": "success" }', run: 'j2', inputs: '{ "region": "{output.region}" }', carry: '' },
    { when: '', run: 'j3', inputs: '', carry: '{ "why": "{error.message}" }' }
  ], 'j1')
  check('no problems', problems.length === 0)
  check('condition parsed', rules[0].when.field === 'status' && rules[0].when.value === 'success')
  check('job kept', rules[0].run === 'j2' && rules[1].run === 'j3')
  check('inputs parsed, carry empty object', rules[0].inputs.region === '{output.region}' && Object.keys(rules[0].carry).length === 0)
  check('empty condition is otherwise (null)', rules[1].when === null)
  check('carry parsed', rules[1].carry.why === '{error.message}')
}

console.log('\nwhat is refused before it reaches the server')
{
  const bad = rowsToRules([{ when: '{ field: status }', run: 'j2' }], 'j1').problems
  check('broken JSON names the rule', bad.length === 1 && /Rule 1's condition is not valid JSON/.test(bad[0]))
  check('a list is not a condition', /must be a JSON object/.test(rowsToRules([{ when: '[1]', run: 'j2' }]).problems[0]))
  check('a rule needs a job', /Rule 1: choose the job/.test(rowsToRules([{ when: '', run: '' }]).problems[0]))
  check('a job cannot run itself', /cannot run itself/.test(rowsToRules([{ when: '', run: 'j1' }], 'j1').problems[0]))
  const order = rowsToRules([{ when: '', run: 'j2' }, { when: '{"field":"status","op":"=","value":"failed"}', run: 'j3' }]).problems
  check('otherwise must be last', order.some((p) => /Rule 1 has no condition/.test(p)))
}

console.log('\nrules → rows → rules is stable')
{
  const rules = [
    { when: { field: 'output.totalRows', op: '>', value: 0 }, run: 'j2', inputs: {}, carry: { n: '{output.totalRows}' } },
    { when: null, run: 'j3', inputs: {}, carry: {} }
  ]
  const rows = rulesToRows(rules)
  check('empty objects show as empty text', rows[0].inputs === '' && rows[1].when === '')
  check('round trip', sameRules(rowsToRules(rows).rules, rules))
  check('a blank row is blank', JSON.stringify(blankRow()) === JSON.stringify({ when: '', run: '', inputs: '', carry: '' }))
}

console.log('\ndescribing a rule')
{
  const name = (id) => ({ j2: 'Load sales' })[id]
  check('a comparison', describeRule({ when: { field: 'status', op: '=', value: 'success' }, run: 'j2' }, name) === 'If status = "success", run Load sales')
  check('otherwise', describeRule({ when: null, run: 'j9' }, name) === 'Otherwise, run j9')
  check('a group', describeRule({ when: { all: [{}, {}] }, run: 'j2' }, name) === 'If all of 2 conditions match, run Load sales')
}

console.log('\nwhat the job before may fill')
{
  const fields = [{ name: 'window' }, { name: 'region' }, { name: 'connectionInfoId' }, { name: 'sourceConnectionInfoId' }, { name: 'sql' }]
  const names = acceptableFields(fields).map((f) => f.name)
  check('window is not offered (it always passes)', !names.includes('window'))
  check('no connection is offered', !names.some((n) => /connection/i.test(n)))
  check('other fields are', names.includes('region') && names.includes('sql'))
  check('tick adds once', JSON.stringify(toggleAccepted(['a'], 'a', true)) === '["a"]')
  check('untick removes', JSON.stringify(toggleAccepted(['a', 'b'], 'a', false)) === '["b"]')
}

console.log('\nrules ⇄ the ordinary workflow they are')
{
  const rules = [
    { when: { all: [{ field: 'status', op: '=', value: 'success' }, { field: 'output.totalRows', op: '>', value: 0 }] }, run: 'jB', inputs: { region: '{output.region}' }, carry: { rows: '{output.totalRows}' } },
    { when: null, run: 'jC', inputs: {}, carry: {} }
  ]
  const w = rulesToWorkflow('jA', 'Load sales', rules, null)
  check('an ordinary workflow, triggered by this job finishing', w.kind === 'workflow' && w.trigger.kind === 'job' && w.trigger.jobId === 'jA' && w.trigger.when === 'finished')
  check('kept under this job\'s shortcut key, published, named for it', w.key === shortcutKey('jA') && w.key === 'after-job-jA' && w.status === 'published' && w.name === 'After Load sales')
  const [decide, b, c] = w.steps
  check('a decide step with one `when` arrow per rule, reading the trigger', decide.actionName === 'decide' && decide.transitions.length === 2 &&
    decide.transitions[0].when.all[0].field === 'trigger.status' && decide.transitions[0].when.all[1].field === 'trigger.output.totalRows' && decide.transitions[0].target === b.stepKey)
  check('"otherwise" last: no extra end arrow', decide.transitions[1].when === null && decide.transitions[1].target === c.stepKey)
  check('job-run steps with bindings on the trigger', b.actionName === 'job-run' && b.kind === 'wait' && b.values.jobId === 'jB' &&
    b.values.inputs.region === '{trigger.output.region}' && b.values.carry.rows === '{trigger.output.totalRows}' && b.values.callbackUrl === '{resumeUrl}')
  const ended = rulesToWorkflow('jA', 'x', [rules[0]], null)
  check('no "otherwise": no match ends the run', ended.steps[0].transitions[1].when === null && ended.steps[0].transitions[1].target === 'end_success')

  const stored = { ...w, id: 'w1', steps: w.steps.map((s, i) => ({ ...s, id: 's' + i })) }
  check('read back as written', JSON.stringify(workflowToRules(stored).rules) === JSON.stringify(rules))
  const again = rulesToWorkflow('jA', 'Load sales', [rules[1]], stored)
  check('saving fewer rules reuses the first step and deletes the rest', again.id === 'w1' && again.steps[0].id === 's0' && again.steps[1].id === 's1' &&
    again.steps[1].values.jobId === 'jC' && again.steps.some((s) => s.id === 's2' && s.deleted === true))
  const more = rulesToWorkflow('jA', 'x', [...rules, { when: null, run: 'jD' }], stored)
  check('a new rule gets a fresh step key, never one used before', more.steps[3].id === undefined && !['decide', b.stepKey, c.stepKey].includes(more.steps[3].stepKey))
  const none = rulesToWorkflow('jA', 'x', [], stored)
  check('no rules: kept as a draft, every run step deleted', none.status === 'draft' && none.steps.filter((s) => s.deleted).length === 2)
  check('a draft reads as no rules', workflowToRules({ ...stored, status: 'draft' }).rules.length === 0 && !workflowToRules({ ...stored, status: 'draft' }).editedElsewhere)
  check('no workflow: no rules', workflowToRules(null).rules.length === 0)

  const extraStep = { ...stored, steps: [...stored.steps, { id: 'sx', stepKey: 'mail', actionName: 'send-email', values: {} }] }
  check('another kind of step: edited elsewhere', workflowToRules(extraStep).editedElsewhere === true)
  check('another trigger: edited elsewhere', workflowToRules({ ...stored, trigger: { kind: 'schedule', cron: '0 9 * * 1' } }).editedElsewhere === true)
  const plainCondition = { ...stored, steps: stored.steps.map((s) => (s.stepKey === 'decide' ? { ...s, transitions: [{ condition: { left: { field: 'trigger.status' }, op: 'eq', right: { value: 'x' } }, target: b.stepKey }] } : s)) }
  check('an arrow written without `when`: edited elsewhere', workflowToRules(plainCondition).editedElsewhere === true)
  const bare = { ...stored, steps: stored.steps.map((s) => (s.stepKey === 'decide' ? { ...s, transitions: [{ condition: null, target: c.stepKey }] } : s)).filter((s) => s.stepKey !== b.stepKey) }
  check('an arrow with no condition and no `when` is "otherwise"', JSON.stringify(workflowToRules(bare).rules) === JSON.stringify([{ when: null, run: 'jC', inputs: {}, carry: {} }]), workflowToRules(bare))
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
