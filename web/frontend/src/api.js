// Thin wrappers around the Python API (web/api.py).
async function request(path, options) {
  let res
  try {
    res = await fetch(path, options)
  } catch {
    throw new Error("Can't reach Hailwise right now. Check your connection and try again")
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // FastAPI sends either a sentence or a list of field errors
    const detail = Array.isArray(body.detail) ? 'Some trip details are not valid' : body.detail
    throw new Error(detail || `Something went wrong (${res.status})`)
  }
  return body
}

export const getSummary = () => request('/api/summary')
export const getZones = () => request('/api/zones')
export const getRoute = (pickup, dropoff) => request(`/api/route?pickup=${pickup}&dropoff=${dropoff}`)
export const estimateFare = (trip) =>
  request('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  })
