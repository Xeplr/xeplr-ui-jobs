// "After this job" — the text a person types, turned into the rules the
// workflow API takes, and back. Wrong here means a chain that silently runs
// the wrong job, or a typo that is saved as a rule that never matches.
import {
  rulesToRows, rowsToRules, blankRow, sameRules, describeRule, acceptableFields, toggleAccepted
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

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
