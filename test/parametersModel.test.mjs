// A procedure's parameters as rows, and back. Wrong here means a job that
// passes a date to the wrong parameter, or drops a value somebody saved.
import { FIXED, bindingFor, sourceOf, rowsFromText, rowsToText, valueForSource } from '../src/lib/parametersModel.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }
const CONTRACT = [{ key: 'window.from', label: 'Start of the window' }, { key: 'window.to', label: 'End of the window' }]

console.log('\na new job starts with the window\'s start and end')
{
  const rows = rowsFromText('', CONTRACT)
  check('two starter rows, bound to the window', rows.length === 2 && rows[0].value === '{window.from}' && rows[1].value === '{window.to}' && rows.every((r) => r.starter))
  check('starter rows nobody named are not saved', rowsToText(rows) === '')
  check('an empty saved list starts the same way', rowsFromText('[]', CONTRACT).length === 2)
  check('with no contract, no starter rows', rowsFromText('', []).length === 0)
}

console.log('\nrows → what the procedure step takes')
{
  const rows = rowsFromText('', CONTRACT)
  rows[0].name = 'startDate'; rows[1].name = 'endDate'
  rows.push({ name: 'region', value: 'north' })
  const saved = JSON.parse(rowsToText(rows))
  check('named rows are { name, value }, in order', JSON.stringify(saved) === JSON.stringify([
    { name: 'startDate', value: '{window.from}' }, { name: 'endDate', value: '{window.to}' }, { name: 'region', value: 'north' }]))
  check('a row with no name is a bare (positional) value', JSON.stringify(JSON.parse(rowsToText([{ name: '', value: 5 }]))) === '[5]')
  check('names are trimmed', JSON.parse(rowsToText([{ name: '  a ', value: 1 }]))[0].name === 'a')
}

console.log('\nsaved text → rows')
{
  const rows = rowsFromText(JSON.stringify([{ name: 'startDate', value: '{window.from}' }, 7, null]), CONTRACT)
  check('named entries keep name and value', rows[0].name === 'startDate' && rows[0].value === '{window.from}')
  check('bare values stay bare', rows[1].bare && rows[1].value === 7 && rows[2].value === '')
  check('what is not a list is not guessed at', rowsFromText('{"a":1}', CONTRACT) === null && rowsFromText('not json', CONTRACT) === null)
}

console.log('\nwhere a value comes from')
{
  check('a binding is its contract key', sourceOf('{window.to}', CONTRACT) === 'window.to' && bindingFor('window.from') === '{window.from}')
  check('anything else is fixed', sourceOf('north', CONTRACT) === FIXED && sourceOf('{window.other}', CONTRACT) === FIXED)
  check('switching to the window binds it', valueForSource('window.from', 'north', CONTRACT) === '{window.from}')
  check('switching to fixed keeps fixed text, clears a binding', valueForSource(FIXED, 'north', CONTRACT) === 'north' && valueForSource(FIXED, '{window.to}', CONTRACT) === '')
}

const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
