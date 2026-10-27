import { useEffect, useMemo, useRef, useState } from 'react'
import { estimateFare, getRoute, getZones } from '../api.js'
import { DAYS, DAY_FULL, hourName, int, money } from '../format.js'

const JFK = 132
const DEFAULT_PICKUP = 230 // Times Sq / Theatre District
const DEFAULT_DROPOFF = JFK

// Animate the meter from 0 up to the fare, like a real taxi meter ticking.
function useCountUp(target) {
  const [value, setValue] = useState(null)
  const frame = useRef()
  useEffect(() => {
    if (target == null) { setValue(null); return }
    // No animation for reduced-motion users or background tabs (where frames never run)
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return }
    setValue(0)
    const start = performance.now()
    const done = setTimeout(() => setValue(target), 1200) // safety net if frames are throttled
    const tick = (now) => {
      const t = Math.min((now - start) / 900, 1)
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame.current); clearTimeout(done) }
  }, [target])
  return value
}

export default function FareEstimate({ data }) {
  const now = new Date()
  const [zones, setZones] = useState([])
  const [pickup, setPickup] = useState(DEFAULT_PICKUP)
  const [dropoff, setDropoff] = useState(DEFAULT_DROPOFF)
  const [day, setDay] = useState(now.getDay() + 1) // JS: 0=Sun, Spark: 1=Sun
  const [hour, setHour] = useState(now.getHours())
  const [route, setRoute] = useState(null)
  const [distance, setDistance] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const shown = useCountUp(result?.fare ?? null)

  useEffect(() => { getZones().then(setZones).catch((e) => setError(e.message)) }, [])

  // Look up past rides on this route and pre-fill the typical distance.
  useEffect(() => {
    let live = true
    setResult(null)
    setRoute(null)
    getRoute(pickup, dropoff).then(({ route }) => {
      if (!live) return
      setRoute(route)
      setDistance(route ? String(route.median_distance) : '')
    }).catch(() => {})
    return () => { live = false }
  }, [pickup, dropoff])

  const byBorough = useMemo(() => {
    const groups = {}
    zones.forEach((z) => { (groups[z.borough === 'EWR' ? 'Newark Airport (NJ)' : z.borough] ??= []).push(z) })
    return Object.entries(groups)
  }, [zones])
  const zone = (id) => zones.find((z) => z.id === id)

  // Any change to the trip invalidates the shown estimate (and any request still in flight).
  const requestId = useRef(0)
  const reset = (fn) => (v) => { fn(v); requestId.current++; setResult(null); setError(null); setBusy(false) }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const text = distance.trim()
    const miles = /^\d*\.?\d+$/.test(text) ? Number(text) : NaN
    if (!text || !(miles >= 0.1 && miles <= 100)) {
      setError(!distance.trim() && !route
        ? 'Not many rides on this route yet — enter the distance in miles.'
        : 'Enter a distance between 0.1 and 100 miles.')
      return
    }
    const id = ++requestId.current
    setBusy(true)
    try {
      const res = await estimateFare({ pickup, dropoff, hour, day, month: now.getMonth() + 1, distance: miles })
      if (id === requestId.current) setResult(res)
    } catch (err) {
      if (id === requestId.current) setError(err.message.replace(/\.?$/, '.'))
    } finally {
      if (id === requestId.current) setBusy(false)
    }
  }

  // ----- "Why this price", from the data -----
  const mae = data.model.models['Gradient-Boosted Trees'].mae
  const hourly = data.hourly.find((h) => h.hour === hour)
  const ranked = [...data.hourly].sort((a, b) => b.trips - a.trips).map((h) => h.hour)
  const rank = ranked.indexOf(hour)
  const busyNote = rank < 4 ? ' — one of the busiest times of day.' : rank > 19 ? ' — one of the quietest times of day.' : '.'
  const pu = zone(pickup), dz = zone(dropoff)
  const flat = pu && dz && ((pu.borough === 'Manhattan' && dropoff === JFK) || (dz.borough === 'Manhattan' && pickup === JFK))
  const reasons = result && [
    flat && { title: 'Flat airport fare', body: 'Rides between Manhattan and JFK are charged a fixed $70 base fare, whatever the traffic.' },
    {
      title: `${result.distance} miles door to door`,
      body: `${route && Number(distance) === route.median_distance ? 'The typical distance for this route. ' : ''}Distance is the biggest factor in almost every fare.`,
    },
    hourly && { title: `${hourName(hour)} on a ${DAY_FULL[day - 1]}`, body: `Taxis average ${hourly.avg_speed_mph.toFixed(1)} mph at this hour${busyNote}` },
    route && Math.abs(result.fare - route.avg_fare) / route.avg_fare > 0.35 && {
      title: 'Prices here vary a lot',
      body: `Riders on this route paid ${money(route.avg_fare)} on average, far from a typical meter fare. Treat this estimate as a rough guide.`,
    },
  ].filter(Boolean)

  return (
    <>
      <section className="wrap hero" style={{ paddingBottom: 32 }}>
        <p className="kicker reveal">Fare estimate</p>
        <h1 className="display sm reveal d1">Know the fare <em>before</em> you hail.</h1>
        <p className="dek reveal d2">
          Pick a route and a time. We estimate the base fare from millions of real rides — and show what riders
          actually paid on the same route.
        </p>
      </section>

      <section className="wrap">
        <div className="fare-layout">
          <form className="card hard pad-lg trip-form reveal d2" onSubmit={submit} noValidate>
            <div className="label">Your trip</div>

            <div className="field">
              <label htmlFor="pickup">Pickup</label>
              <select id="pickup" className="select" value={pickup} onChange={(e) => reset(setPickup)(Number(e.target.value))}>
                {byBorough.map(([b, list]) => (
                  <optgroup key={b} label={b}>{list.map((z) => <option key={z.id} value={z.id}>{z.zone}</option>)}</optgroup>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="dropoff">Drop-off</label>
              <select id="dropoff" className="select" value={dropoff} onChange={(e) => reset(setDropoff)(Number(e.target.value))}>
                {byBorough.map(([b, list]) => (
                  <optgroup key={b} label={b}>{list.map((z) => <option key={z.id} value={z.id}>{z.zone}</option>)}</optgroup>
                ))}
              </select>
            </div>

            <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>Day</legend>
              <div className="pills">
                {DAYS.map((d, i) => (
                  <button type="button" key={d} className="pill" aria-pressed={day === i + 1}
                    aria-label={DAY_FULL[i]} onClick={() => reset(setDay)(i + 1)}>{d}</button>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="hour">Pickup time</label>
                <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{hourName(hour).replace(' ', ':00 ')}</span>
              </div>
              <input id="hour" className="range" type="range" min="0" max="23" value={hour}
                onChange={(e) => reset(setHour)(Number(e.target.value))} aria-valuetext={hourName(hour)} />
              <div className="range-scale" aria-hidden="true"><span>12 am</span><span>12 pm</span><span>11 pm</span></div>
            </div>

            <div className="distance">
              <label htmlFor="distance" style={{ fontSize: 14 }}>
                Distance <span className="muted">· {route ? 'typical for this route' : 'enter miles'}</span>
              </label>
              <input id="distance" className="input" inputMode="decimal" value={distance}
                onChange={(e) => reset(setDistance)(e.target.value)} placeholder="mi" aria-describedby="distance-unit" />
              <span id="distance-unit" className="sr-only">miles</span>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="btn block" type="submit" disabled={busy}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M9 2h6" /></svg>
              {busy ? 'Estimating…' : 'Estimate fare'}
            </button>
          </form>

          <div className="meter-col reveal d3">
            <div className="meter">
              <div className="meter-top">
                <div className="label">Estimated base fare</div>
                <div className={`lamp ${result ? 'on' : ''}`}>{result ? 'Hired' : 'For hire'}</div>
              </div>
              <div className={`meter-value ${shown == null ? 'idle' : ''}`} aria-live="polite">
                {shown == null ? '$ --.--' : money(shown)}
              </div>
              <div className="meter-note">Excludes tip, tolls, taxes and surcharges.</div>
              <div className="meter-stats">
                <div>
                  <div className="label">Riders paid</div>
                  <div className="v">{route ? money(route.avg_fare) : '—'}</div>
                  <small>{route ? `avg · ${int(route.trips)} trips` : 'not enough rides yet'}</small>
                </div>
                <div>
                  <div className="label">Typical time</div>
                  <div className="v">{route ? `${Math.round(route.avg_duration)} min` : '—'}</div>
                  <small>avg on this route</small>
                </div>
                <div>
                  <div className="label">Accuracy</div>
                  <div className="v">±${Math.round(mae)}</div>
                  <small>typical difference</small>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="label" style={{ marginBottom: 14 }}>Why this price</div>
              {reasons ? (
                <ul className="reasons">
                  {reasons.map((r, i) => (
                    <li key={r.title}><span className="n" aria-hidden="true">{i + 1}</span><div><strong>{r.title}</strong><span>{r.body}</span></div></li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>Choose your trip and press <b>Estimate fare</b> to see what shapes the price.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
