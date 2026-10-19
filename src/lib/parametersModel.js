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
 * Saved text → rows. A job with no parameters yet has none: the person adds
 * them, picking each name from the procedure's own (see ParametersField).
 */
export function rowsFromText(text, contract) {
  let list = []
  try { list = text ? JSON.parse(text) : [] } catch (e) { list = null }
  if (!Array.isArray(list)) return null
  return list.map((p) => (p && typeof p === 'object' && !Array.isArray(p)
    ? { name: p.name == null ? '' : String(p.name), value: p.value == null ? '' : p.value }
    : { name: '', value: p == null ? '' : p, bare: true }))
}

/**
 * Rows → the text the form saves. A row with no name is kept as a bare
 * (positional) value; a row with neither name nor value is left out.
 */
export function rowsToText(rows) {
  const list = (rows || [])
    .filter((r) => String(r.name || '').trim() || (r.value !== '' && r.value != null))
    .map((r) => (String(r.name || '').trim() ? { name: String(r.name).trim(), value: r.value } : r.value))
  return list.length ? JSON.stringify(list, null, 2) : ''
}

/** Suggested names not already used by another row. */
export function unusedNames(names, rows, index) {
  const taken = new Set((rows || []).filter((_, i) => i !== index).map((r) => String(r.name || '').trim()).filter(Boolean))
  return (names || []).filter((n) => !taken.has(n))
}

/** A row's value when its source changes: a binding, or empty fixed text. */
export function valueForSource(source, current, contract) {
  if (source === FIXED) return sourceOf(current, contract) === FIXED ? current : ''
  return bindingFor(source)
}
