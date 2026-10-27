// Hand-built charts (plain divs + SVG) so they match the Hailwise design exactly.
import { DAYS, MONTHS, hourName, millions, thousands } from '../format.js'

const DISPLAY_ORDER = [2, 3, 4, 5, 6, 7, 1] // Mon..Sun in Spark's day_of_week numbering

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`
}
const shade = (t) => (t < 0.55 ? mix('#F1ECDD', '#FFC72C', t / 0.55) : mix('#FFC72C', '#6B3F00', (t - 0.55) / 0.45))

export function Heatmap({ cells, max, min }) {
  const lookup = new Map(cells.map((c) => [`${c.day_of_week}-${c.hour}`, c.trips]))
  const hours = Array.from({ length: 24 }, (_, h) => h)
  return (
    <div className="heat-scroll">
      <div className="heat" role="table" aria-label="Pickups by day of week and hour">
        <div className="heat-row" role="row" aria-hidden="true">
          <span />
          {hours.map((h) => <span className="hr" key={h}>{h % 3 === 0 ? h : ''}</span>)}
        </div>
        {DISPLAY_ORDER.map((dow) => (
          <div className="heat-row" role="row" key={dow}>
            <span className="day" role="rowheader">{DAYS[dow - 1]}</span>
            {hours.map((h) => {
              const v = lookup.get(`${dow}-${h}`) ?? 0
              const label = `${DAYS[dow - 1]} ${hourName(h)}: ${thousands(v)} pickups`
              return <span className="heat-cell" role="cell" key={h} title={label} aria-label={label}
                style={{ background: shade(v / max) }} />
            })}
          </div>
        ))}
        <div className="legend">
          <span>{thousands(min)}</span><span className="legend-bar" aria-hidden="true" /><span>{thousands(max)} pickups per hour slot</span>
        </div>
      </div>
    </div>
  )
}

export function SpeedChart({ hourly, fastest, slowest }) {
  const top = Math.ceil(fastest.avg_speed_mph / 5) * 5
  const bottom = Math.floor(slowest.avg_speed_mph / 5) * 5 - 2
  const x = (h) => 32 + h * (440 / 23)
  const y = (v) => 20 + (top - v) * (170 / (top - bottom))
  const line = hourly.map((r) => `${x(r.hour).toFixed(1)},${y(r.avg_speed_mph).toFixed(1)}`).join(' ')
  const area = `${line} ${x(23)},190 ${x(0)},190`
  const ticks = []
  for (let v = top; v > bottom; v -= 5) ticks.push(v)
  // Keep a ~85px wide label inside the plot area
  const labelX = (px) => Math.min(Math.max(px, 34), 472 - 85)

  return (
    <svg viewBox="0 0 480 220" role="img" className="speed-chart" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      aria-label={`Average taxi speed by hour: fastest ${fastest.avg_speed_mph.toFixed(1)} mph at ${hourName(fastest.hour)}, slowest ${slowest.avg_speed_mph.toFixed(1)} mph at ${hourName(slowest.hour)}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1="32" x2="472" y1={y(v)} y2={y(v)} stroke="#ECE8DC" />
          <text x="0" y={y(v) + 4} fontFamily="Geist Mono, monospace" fontSize="11" fill="#5A574F">{v}</text>
        </g>
      ))}
      <line x1="32" x2="472" y1="190" y2="190" stroke="#CFCABD" />
      <polygon points={area} fill="#FFC72C" fillOpacity="0.35" />
      <polyline points={line} fill="none" stroke="#141414" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={x(fastest.hour)} cy={y(fastest.avg_speed_mph)} r="5" fill="#FFC72C" stroke="#141414" strokeWidth="2" />
      <circle cx={x(slowest.hour)} cy={y(slowest.avg_speed_mph)} r="5" fill="#fff" stroke="#141414" strokeWidth="2" />
      <text x={labelX(x(fastest.hour) + 10)} y={y(fastest.avg_speed_mph) + 4} fontFamily="Geist Mono, monospace" fontSize="12" fontWeight="600">
        {hourName(fastest.hour)} · {fastest.avg_speed_mph.toFixed(1)}
      </text>
      <text x={labelX(x(slowest.hour) - 40)} y={y(slowest.avg_speed_mph) - 12} fontFamily="Geist Mono, monospace" fontSize="12" fontWeight="600">
        {hourName(slowest.hour)} · {slowest.avg_speed_mph.toFixed(1)}
      </text>
      {[[0, '12am'], [6, '6am'], [12, '12pm'], [18, '6pm'], [23, '11pm']].map(([h, t]) => (
        <text key={h} x={h === 23 ? 446 : x(h) - (h ? 12 : 0)} y="212" fontFamily="Geist Mono, monospace" fontSize="11" fill="#5A574F">{t}</text>
      ))}
    </svg>
  )
}

export function MonthBars({ monthly, top }) {
  const max = top.trips * 1.02
  const years = [...new Set(monthly.map((m) => m.year))]
  return (
    <>
      <div className="month-bars" role="list" aria-label="Trips per month">
        {monthly.map((m) => (
          <div key={`${m.year}-${m.month}`} role="listitem"
            className={`month-bar ${m === top ? 'top' : ''}`}
            style={{ height: `${(m.trips / max) * 100}%` }}
            title={`${MONTHS[m.month - 1]} ${m.year}: ${millions(m.trips, 2)} trips`}
            aria-label={`${MONTHS[m.month - 1]} ${m.year}: ${millions(m.trips, 2)} trips`} />
        ))}
      </div>
      <div className="month-labels" aria-hidden="true">
        {monthly.map((m) => <span key={`${m.year}-${m.month}`}>{MONTHS[m.month - 1][0]}</span>)}
      </div>
      <div className="years" aria-hidden="true">
        <span>{years[0]}</span>{years.length > 1 && <span>{years.at(-1)} →</span>}
      </div>
    </>
  )
}
