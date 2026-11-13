// A LIST INPUT CHOSEN FROM A HOST'S OPTIONS — an action's field of type
// 'array' with `optionsFrom` (several databases for one backup job) is a set
// of ticks, not JSON to type. Pure: what is ticked, and ticking one.

/** What is ticked: the saved list, the form's JSON text of it, or nothing. */
export function pickedOf(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const v = JSON.parse(value)
    return Array.isArray(v) ? v.map(String) : []
  } catch (e) {
    return []
  }
}

/** Tick or untick one, keeping the options' order. */
export function toggled(picked, value, options) {
  const on = picked.includes(value) ? picked.filter((v) => v !== value) : picked.concat([value])
  const order = (options || []).map((o) => String(o.value))
  return on.slice().sort((a, b) => (order.indexOf(a) + 1 || Infinity) - (order.indexOf(b) + 1 || Infinity))
}
