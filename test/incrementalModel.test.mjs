// Which rows each run takes, as the job editor offers and saves it. Wrong here
// means a job handed a mode its action cannot run, or a re-read silently lost.
import { windowField, incrementalChoices, incrementalDraft, incrementalBody } from '../src/lib/incrementalModel.js'

const results = []
const check = (name, cond) => { results.push([name, cond]); console.log((cond ? '  ok   ' : '  FAIL ') + name) }
const MOVE = { name: 'move-run', inputSchema: [{ name: 'moveId' }, { name: 'window', system: true, watermark: true }] }
const RANGE_ONLY = { name: 'export', inputSchema: [{ name: 'window' }] }
const PLAIN = { name: 'email-send', inputSchema: [{ name: 'to' }] }

console.log('\nwhat is offered')
{
  check('an action without a window field: nothing to choose', incrementalChoices(PLAIN).length === 0 && windowField(PLAIN) === null)
  check('a window field: everything, or since the last successful run',
    incrementalChoices(RANGE_ONLY).map((c) => c.value).join() === ',period')
  check('a window that says watermark: continue from what is loaded too',
    incrementalChoices(MOVE).map((c) => c.value).join() === ',period,watermark')
}

console.log('\na saved job, in the form')
{
  const d = incrementalDraft({ incrementalMode: 'watermark', reloadDays: 7 })
  check('mode and days as the form holds them', d.incrementalMode === 'watermark' && d.reloadDays === '7')
  check('a new job: everything, no days', JSON.stringify(incrementalDraft(null)) === JSON.stringify({ incrementalMode: '', reloadDays: '' }))
}

console.log('\nwhat is saved')
{
  check('everything → null mode', JSON.stringify(incrementalBody({ incrementalMode: '', reloadDays: '' }, MOVE).body) === '{"incrementalMode":null,"reloadDays":null}')
  check('period never keeps re-read days', incrementalBody({ incrementalMode: 'period', reloadDays: '5' }, MOVE).body.reloadDays === null)
  check('watermark with 7 days', JSON.stringify(incrementalBody({ incrementalMode: 'watermark', reloadDays: ' 7 ' }, MOVE).body) === '{"incrementalMode":"watermark","reloadDays":7}')
  check('watermark with no days: none', incrementalBody({ incrementalMode: 'watermark', reloadDays: '' }, MOVE).body.reloadDays === null)
  check('0, 1.5 or words: refused in words', ['0', '1.5', 'week'].every((v) => /whole number/.test(incrementalBody({ incrementalMode: 'watermark', reloadDays: v }, MOVE).problem || '')))
  check('a mode the action no longer allows is cleared', incrementalBody({ incrementalMode: 'watermark', reloadDays: '3' }, RANGE_ONLY).body.incrementalMode === null)
  check('an action with no window: never incremental', incrementalBody({ incrementalMode: 'period' }, PLAIN).body.incrementalMode === null)
}

const failed = results.filter(([, c]) => !c).length
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed')
process.exit(failed ? 1 : 0)
