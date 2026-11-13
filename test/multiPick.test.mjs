// A list input chosen from a host's options: what is ticked, and ticking one.
import { pickedOf, toggled } from '../src/pages/multiPick.js'

const results = []
const check = (name, cond, detail) => { results.push(cond); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')) }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

check('a saved list', same(pickedOf(['a', 'b']), ['a', 'b']))
check('the form\'s JSON text of it', same(pickedOf('[\n  "a"\n]'), ['a']))
check('nothing, or text that is not a list: none ticked', same([pickedOf(''), pickedOf(undefined), pickedOf('{"a":1}'), pickedOf('[oops')], [[], [], [], []]))
const opts = [{ value: 'x' }, { value: 'y' }, { value: 'z' }]
check('ticking keeps the options\' order', same(toggled(['z'], 'x', opts), ['x', 'z']))
check('unticking', same(toggled(['x', 'z'], 'x', opts), ['z']))
check('a ticked value no longer offered stays, last', same(toggled(['gone'], 'y', opts), ['y', 'gone']))

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
