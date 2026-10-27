import { useEffect, useState } from 'react'
import { getZones } from '../api.js'
import { Checker } from '../components/Layout.jsx'
import { int, millions, money } from '../format.js'

const FEATURE_NAMES = {
  trip_distance: 'Trip distance', DOLocationID: 'Drop-off area', pickup_hour: 'Time of day', PULocationID: 'Pickup area',
  day_of_week: 'Day of week', month: 'Month', is_weekend: 'Weekend',
}

export default function AboutData({ data, period }) {
  const { cleaning, model, monthly, routes_count } = data
  const [zoneCount, setZoneCount] = useState(null)
  useEffect(() => { getZones().then((z) => setZoneCount(z.length)).catch(() => {}) }, [])

  const best = model.models['Gradient-Boosted Trees']
  const simple = model.models['Linear Regression']
  const better = Math.round(((simple.mae - best.mae) / simple.mae) * 100)
  const keptPct = (cleaning.clean_rows / cleaning.raw_rows) * 100
  const features = Object.entries(model.feature_importance).map(([k, v]) => [FEATURE_NAMES[k] ?? k, v * 100])

  const steps = [
    { title: 'Collected', body: 'Official trip records from the NYC Taxi & Limousine Commission, published monthly.', stat: `${monthly.length} months · ${period}`, tone: 'dark' },
    { title: 'Checked', body: 'Impossible or broken records are set aside so they never skew an average.', stat: `${millions(cleaning.removed_rows, 2)} records set aside` },
    { title: 'Summarised', body: 'Rides are grouped by hour, day, zone and route to reveal how the city moves.', stat: `${int(routes_count)} routes compared` },
    { title: 'Estimated', body: 'Fare estimates learn from millions of past rides on the same routes and times.', stat: `Typically within $${Math.round(best.mae)}`, tone: 'lit' },
  ]

  return (
    <>
      <section className="wrap hero">
        <p className="kicker reveal">About the data</p>
        <h1 className="display sm reveal d1">Real rides, <em>carefully checked.</em></h1>
        <p className="dek reveal d2">
          Every number on Hailwise comes from official trip records published by New York City. Here is where they
          come from, how we check them, and how far you can trust our fare estimates.
        </p>
      </section>

      <section className="wrap">
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title} className={`step reveal d${Math.min(i, 3)} ${s.tone ?? ''}`}>
              <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="stat">{s.stat}</div>
            </li>
          ))}
        </ol>
      </section>

      <Checker />

      <section className="wrap" style={{ paddingBlock: '64px 32px' }}>
        <div className="grid-2">
          <div className="card pad-lg">
            <h2 className="h2-serif">Only trips that make sense</h2>
            <p className="card-dek" style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 24 }}>
              Meters glitch and records get mistyped. We set aside trips with negative fares, zero distance, rides longer
              than three hours, impossible speeds or the wrong date.
            </p>
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <div className="bar-row"><span>Trips recorded by the city</span><b>{int(cleaning.raw_rows)}</b></div>
                <div className="big-bar" />
              </div>
              <div>
                <div className="bar-row"><span>Trips used on Hailwise</span><b>{int(cleaning.clean_rows)}</b></div>
                <div className="split-bar">
                  <div className="kept" style={{ width: `${keptPct}%` }} />
                  <div className="gone" style={{ width: `${100 - keptPct}%` }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>Set aside as unreliable</span>
                <span className="serif" style={{ fontSize: 34 }}>
                  {millions(cleaning.removed_rows, 2)} <span className="muted" style={{ fontSize: 20 }}>· {cleaning.removed_pct.toFixed(1)}%</span>
                </span>
              </div>
            </div>
          </div>

          <div className="card pad-lg">
            <h2 className="h2-serif">What we cover</h2>
            <p className="card-dek" style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 24 }}>
              Yellow taxis only — the cabs you hail on the street. App rides and green cabs are not included yet.
            </p>
            <div className="tiles">
              {[
                [millions(cleaning.clean_rows), 'rides analysed'],
                [zoneCount ?? '—', 'taxi zones'],
                ['5', 'boroughs plus Newark'],
                [monthly.length, 'months of trips'],
              ].map(([v, l]) => (
                <div key={l}><div className="tile-v">{v}</div><div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6 }}>{l}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ paddingBlock: '32px 88px' }}>
        <div className="row">
          <div className="card hard pad-lg grow" style={{ flexBasis: 560 }}>
            <h2 className="h2-serif">How accurate are fare estimates?</h2>
            <p className="card-dek" style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 24 }}>
              We tested our estimates on {int(model.test_rows)} real rides they had never seen, then compared them with
              what the meter actually charged.
            </p>
            <div className="score-grid">
              <div className="score lit"><div className="v">{money(best.mae)}</div><p>Average difference from the real fare</p></div>
              <div className="score"><div className="v">{Math.round(best.r2 * 100)}%</div><p className="muted">Of the variation in fares explained</p></div>
              <div className="score"><div className="v">{better}%</div><p className="muted">Closer to the real fare than a simpler formula</p></div>
            </div>
            <p style={{ margin: '20px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>
              Estimates cover the base fare only. Tips, tolls, taxes and surcharges are added on top by the meter.
            </p>
          </div>

          <div className="card pad-lg side">
            <h2 className="h2-serif">What sets your fare</h2>
            <p className="card-dek" style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 22 }}>How much each factor matters to the estimate.</p>
            <div className="stack" style={{ gap: 12 }}>
              {features.map(([name, v], i) => (
                <div key={name}>
                  <div className="bar-row" style={{ marginBottom: 4 }}><span>{name}</span><span className="mono">{v.toFixed(1)}%</span></div>
                  <div className="track thin"><div className={`fill ${i ? 'amber' : ''}`} style={{ width: `${Math.max(v, 0.6)}%`, animationDelay: `${i * 50}ms` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
