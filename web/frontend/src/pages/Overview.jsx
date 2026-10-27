import { Checker, SectionHead, ArrowIcon } from '../components/Layout.jsx'
import { Heatmap, SpeedChart, MonthBars } from '../components/Charts.jsx'
import { DAY_FULL, MONTHS, bigMoney, hourName, int, millions, money, pct, thousands } from '../format.js'

const AIRPORT_NAMES = {
  'Newark Airport': 'Newark (EWR)', 'JFK Airport': 'JFK', 'LaGuardia Airport': 'LaGuardia', 'Non-airport': 'Everywhere else',
}
const BOROUGH_NAMES = { EWR: 'Newark Airport' }

export default function Overview({ data, period }) {
  const { kpis, monthly, hourly, heatmap, top_zones, boroughs, payments, airports } = data

  // ----- "When" insights, all computed from the data -----
  const byHour = (dow, h) => heatmap.find((c) => c.day_of_week === dow && c.hour === h)?.trips ?? 0
  const peak = heatmap.reduce((a, b) => (b.trips > a.trips ? b : a))
  const quiet = heatmap.reduce((a, b) => (b.trips < a.trips ? b : a))
  const weekday1am = [2, 3, 4, 5].reduce((s, d) => s + byHour(d, 1), 0) / 4
  const nightRatio = Math.round(byHour(7, 1) / weekday1am)

  const fastest = hourly.reduce((a, b) => (b.avg_speed_mph > a.avg_speed_mph ? b : a))
  const slowest = hourly.reduce((a, b) => (b.avg_speed_mph < a.avg_speed_mph ? b : a))
  const busiestMonth = monthly.reduce((a, b) => (b.trips > a.trips ? b : a))

  // ----- "Where" insights -----
  const totalPickups = boroughs.reduce((s, b) => s + b.trips, 0)
  const manhattan = boroughs.find((b) => b.borough === 'Manhattan')
  const manhattanShare = (manhattan.trips / totalPickups) * 100
  const bigBoroughs = boroughs.filter((b) => b.trips >= 100000)
  const mostTips = bigBoroughs.reduce((a, b) => (b.avg_tip_pct > a.avg_tip_pct ? b : a))
  const leastTips = bigBoroughs.reduce((a, b) => (b.avg_tip_pct < a.avg_tip_pct ? b : a))
  const totalPaid = payments.reduce((s, p) => s + p.trips, 0)
  const share = (method) => ((payments.find((p) => p.method === method)?.trips ?? 0) / totalPaid) * 100
  const zones = top_zones.slice(0, 10)
  const maxZone = zones[0].trips

  const stats = [
    { label: 'Taxi rides', value: millions(kpis.total_trips), note: `in ${monthly.length} months` },
    { label: 'Spent on rides', value: bigMoney(kpis.total_revenue), note: 'fares, tips and fees' },
    { label: 'Average fare', value: money(kpis.avg_fare), note: 'before tip and tolls' },
    { label: 'Average distance', value: `${kpis.avg_distance.toFixed(1)} mi`, note: 'per trip' },
    { label: 'Average ride', value: `${Math.round(kpis.avg_duration)} min`, note: 'pickup to drop-off' },
    { label: 'Card tip', value: pct(kpis.avg_tip_pct_card), note: 'of the fare, on average' },
  ]

  return (
    <>
      <section className="wrap hero">
        <p className="kicker reveal">New York City · Yellow taxis · {period}</p>
        <h1 className="display reveal d1">{millions(kpis.total_trips)} rides. <em>One city, decoded.</em></h1>
        <p className="dek reveal d2">
          Every yellow-taxi trip in New York over {monthly.length} months — when people ride, where they go,
          what they pay, and how fast the city really moves.
        </p>
      </section>

      <section className="wrap reveal d3" style={{ paddingBottom: 56 }} aria-label="Key numbers">
        <div className="kpis">
          {stats.map((s) => (
            <div className="kpi" key={s.label}>
              <div className="label">{s.label}</div>
              <div className="kpi-value">{s.value}</div>
              <div className="kpi-note">{s.note}</div>
            </div>
          ))}
        </div>
      </section>

      <Checker />

      <section className="wrap section">
        <SectionHead num="01" title="When the city moves">
          Pickups for every hour of the week, added up across {monthly.length} months. Darker means busier.
        </SectionHead>
        <div className="row">
          <div className="card grow heat-card"><Heatmap cells={heatmap} max={peak.trips} min={quiet.trips} /></div>
          <aside className="card night side insight">
            <div>
              <div className="label">Peak hour</div>
              <div className="insight-big">{DAY_FULL[peak.day_of_week - 1]}, <span>{hourName(peak.hour)}</span></div>
              <p>{thousands(peak.trips)} pickups in that single hour slot — the busiest of all 168 in the week.</p>
            </div>
            <div className="split">
              <div className="label">Quietest</div>
              <p>
                {DAY_FULL[quiet.day_of_week - 1]}, {hourName(quiet.hour)} — just {thousands(quiet.trips)} pickups.
                {nightRatio >= 2 && ` Weekend nights stay alive: 1 am on a Saturday is ${nightRatio}× busier than on a weekday.`}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 72, paddingTop: 24 }}>
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title">Average speed by hour</h3>
            <p className="card-dek">
              At {hourName(fastest.hour)} cabs hit {fastest.avg_speed_mph.toFixed(1)} mph.
              By {hourName(slowest.hour)} they crawl at {slowest.avg_speed_mph.toFixed(1)}.
            </p>
            <SpeedChart hourly={hourly} fastest={fastest} slowest={slowest} />
          </div>
          <div className="card">
            <h3 className="card-title">Trips per month</h3>
            <p className="card-dek">
              The busiest month was {MONTHS[busiestMonth.month - 1]} {busiestMonth.year}, with {millions(busiestMonth.trips, 2)} trips.
            </p>
            <MonthBars monthly={monthly} top={busiestMonth} />
          </div>
        </div>
      </section>

      <Checker />

      <section className="wrap section" style={{ paddingBottom: 40 }}>
        <SectionHead num="02" title="Where people ride">
          {Math.round(manhattanShare / 10)} in 10 pickups happen in Manhattan — but the airports are where the money is.
        </SectionHead>
        <div className="row">
          <div className="card grow">
            <h3 className="card-title" style={{ marginBottom: 18 }}>Busiest pickup zones</h3>
            <ol className="ranked">
              {zones.map((z, i) => (
                <li key={z.zone}>
                  <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="top-line"><span className="name">{z.zone}</span><span className="boro">{z.borough}</span></div>
                    <div className="track">
                      <div className={`fill ${z.zone.includes('Airport') ? 'alt' : ''}`}
                        style={{ width: `${(z.trips / maxZone) * 100}%`, animationDelay: `${i * 40}ms` }} />
                    </div>
                  </div>
                  <span className="val">{millions(z.trips, 2)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="side stack">
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Airport vs. city</h3>
              <div className="stack" style={{ gap: 14 }}>
                {[...airports].sort((a, b) => b.avg_fare - a.avg_fare).map((a) => (
                  <div className="airport" key={a.trip_type}>
                    <span style={{ fontWeight: 500 }}>{AIRPORT_NAMES[a.trip_type] ?? a.trip_type}</span>
                    <span className="fare">{money(a.avg_fare)}</span>
                    <small>{a.trips >= 1e6 ? millions(a.trips, 2) : thousands(a.trips)} trips · {a.avg_distance.toFixed(1)} mi</small>
                    <small className="mono" style={{ fontSize: 11, textAlign: 'right' }}>avg fare</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="card yellow">
              <div className="label" style={{ color: 'var(--ink)' }}>Tipping</div>
              <div className="serif" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 8 }}>
                {mostTips.borough} tips {Math.round(mostTips.avg_tip_pct)}%. {leastTips.borough === 'Bronx' ? 'The Bronx' : leastTips.borough} tips {leastTips.avg_tip_pct.toFixed(1)}%.
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 14 }}>
                Card payments only. {Math.round(share('Credit card'))}% of riders now pay by card; cash is down to {Math.round(share('Cash'))}%.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>By borough</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Borough</th><th>Pickups</th><th>Share</th><th>Avg fare</th><th>Avg miles</th><th>Card tip</th></tr>
              </thead>
              <tbody>
                {boroughs.map((b) => {
                  const s = (b.trips / totalPickups) * 100
                  return (
                    <tr key={b.borough}>
                      <td>{BOROUGH_NAMES[b.borough] ?? b.borough}</td>
                      <td>{int(b.trips)}</td>
                      <td>{s < 0.1 ? '<0.1%' : pct(s)}</td>
                      <td>{money(b.avg_fare)}</td>
                      <td>{b.avg_distance.toFixed(1)}</td>
                      <td>{pct(b.avg_tip_pct)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap">
          <div>
            <h2>What will your ride cost?</h2>
            <p>Estimates based on millions of real rides, typically within about ${Math.round(data.model.models['Gradient-Boosted Trees'].mae)}.</p>
          </div>
          <a className="btn on-dark" href="#/fare">Estimate a fare <ArrowIcon /></a>
        </div>
      </section>
    </>
  )
}
