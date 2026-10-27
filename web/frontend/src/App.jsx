import { useEffect, useState } from 'react'
import { getSummary } from './api.js'
import { monthLabel, MONTHS_FULL } from './format.js'
import { Header, Footer } from './components/Layout.jsx'
import Overview from './pages/Overview.jsx'
import FareEstimate from './pages/FareEstimate.jsx'
import AboutData from './pages/AboutData.jsx'

const PAGES = {
  '/': { component: Overview, title: 'Hailwise — Know before you hail' },
  '/fare': { component: FareEstimate, title: 'Fare estimate · Hailwise' },
  '/about': { component: AboutData, title: 'About the data · Hailwise' },
}

// Tiny hash router: #/fare, #/about. No server config needed.
function useRoute() {
  const read = () => (window.location.hash.replace(/^#/, '') || '/')
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => { setRoute(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return PAGES[route] ? route : '/'
}

export default function App() {
  const route = useRoute()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { getSummary().then(setData).catch((e) => setError(e.message)) }, [])
  useEffect(() => { document.title = PAGES[route].title }, [route])

  // Play the entrance animation only when it can actually run, then switch it off so
  // nothing can stay half-faded if the browser pauses animations.
  useEffect(() => {
    if (!data || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    root.classList.add('motion')
    const t = setTimeout(() => root.classList.remove('motion'), 1100)
    return () => { clearTimeout(t); root.classList.remove('motion') }
  }, [route, data])

  const last = data?.monthly.at(-1)
  const through = last ? `${MONTHS_FULL[last.month - 1]} ${last.year}` : null
  const period = data ? `${monthLabel(data.monthly[0])} – ${monthLabel(last)}` : null
  const Page = PAGES[route].component

  return (
    <>
      <a className="sr-only" href="#main">Skip to content</a>
      <Header route={route} through={through} />
      <main id="main" key={route}>
        {error ? (
          <div className="state">
            <div>
              <h1 className="h2-serif">We couldn't load the latest numbers.</h1>
              <p className="muted">{error}. Please refresh in a moment.</p>
            </div>
          </div>
        ) : !data ? (
          <div className="state" role="status">
            <div><div className="checker" /><p className="mono muted">Loading the city…</p></div>
          </div>
        ) : (
          <Page data={data} period={period} />
        )}
      </main>
      <Footer />
    </>
  )
}
