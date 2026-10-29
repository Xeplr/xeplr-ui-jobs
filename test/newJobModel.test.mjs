// A new job opened already filled in from a link. Wrong here means a job for
// the wrong movement, or an action the server does not have.
import { newJobFrom, newJobQuery } from '../src/lib/newJobModel.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }
const ACTIONS = [{ name: 'move-run' }, { name: 'email-send' }]
const q = (s) => new URLSearchParams(s)

console.log('\nfrom the link')
{
  const link = newJobQuery({ action: 'move-run', inputs: { moveId: 'm1' }, name: 'Nightly orders' })
  const job = newJobFrom(q(link), ACTIONS)
  check('the action, its inputs and the name come back as written',
    job.actionName === 'move-run' && job.inputs.moveId === 'm1' && job.name === 'Nightly orders')
  check('the link opens a NEW job', q(link).get('edit') === 'new')
}

console.log('\nnot trusted')
{
  check('an action this server does not offer: a blank job', JSON.stringify(newJobFrom(q('action=drop-db&inputs={"x":1}'), ACTIONS)) === '{}')
  check('inputs that are not JSON: the action, no inputs', JSON.stringify(newJobFrom(q('action=move-run&inputs=nope'), ACTIONS)) === '{"actionName":"move-run"}')
  check('inputs that are a list: dropped', newJobFrom(q('action=move-run&inputs=[1]'), ACTIONS).inputs === undefined)
  check('nothing in the URL: a blank job', JSON.stringify(newJobFrom(q(''), ACTIONS)) === '{}')
}

const failed = results.filter(([, c]) => !c).length
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed')
process.exit(failed ? 1 : 0)
