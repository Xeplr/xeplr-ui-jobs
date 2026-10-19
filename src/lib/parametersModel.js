// A PROCEDURE'S PARAMETERS AS ROWS — the form's half, as pure logic.
//
// What a job saves is the list the procedure step takes, [{ name, value }]
// (or bare values, positional). A value is either fixed text or BOUND to the
// run's window: "{window.from}" / "{window.to}", which @xeplr/jobs fills in
// with this run's dates (its run contract, GET /jobs/run-contract). This file
// turns that list into rows a person edits — a name, and where its value
// comes from — and back.

export const FIXED = 'fixed'

export function bindingFor(key) {
  return '{' + key + '}'
}

/** The contract key a value is bound to, or FIXED. */
export function sourceOf(value, contract) {
  const hit = (contract || []).find((c) => value === bindingFor(c.key))
  return hit ? hit.key : FIXED
}

/**
 * The contract grouped for a dropdown, in its own order:
 * [{ group, options: [{ key, label }] }].
 */
export function groupedChoices(contract) {
  const groups = []
  ;(contract || []).forEach((c) => {
    const name = c.group || ''
    let g = groups.find((x) => x.group === name)
    if (!g) { g = { group: name, options: [] }; groups.push(g) }
    g.options.push(c)
  })
  return groups
}

/**
 * Saved text → rows. A job with no parameters yet starts with one row for
 * this run's window start and one for its end, named by the person — the
 * period is what nearly every scheduled procedure takes. The job before's
 * ranges are in every row's dropdown, but not rows of their own.
 */
export function rowsFromText(text, contract) {
  let list = []
  try { list = text ? JSON.parse(text) : [] } catch (e) { list = null }
  if (!Array.isArray(list)) return null
  if (!list.length) {
    return (contract || []).filter((c) => /^window\./.test(c.key))
      .map((c) => ({ name: '', value: bindingFor(c.key), starter: true }))
  }
  return list.map((p) => (p && typeof p === 'object' && !Array.isArray(p)
    ? { name: p.name == null ? '' : String(p.name), value: p.value == null ? '' : p.value }
    : { name: '', value: p == null ? '' : p, bare: true }))
}

/**
 * Rows → the text the form saves. A starter row nobody named is left out, so
 * a procedure with no date parameters gets none. A row with no name is kept
 * as a bare (positional) value.
 */
export function rowsToText(rows) {
  const list = (rows || [])
    .filter((r) => !(r.starter && !String(r.name || '').trim()))
    .map((r) => (String(r.name || '').trim() ? { name: String(r.name).trim(), value: r.value } : r.value))
  return list.length ? JSON.stringify(list, null, 2) : ''
}

/** A row's value when its source changes: a binding, or empty fixed text. */
export function valueForSource(source, current, contract) {
  if (source === FIXED) return sourceOf(current, contract) === FIXED ? current : ''
  return bindingFor(source)
}
