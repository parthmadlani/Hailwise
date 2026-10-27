const NAV = [
  ['/', 'Overview'],
  ['/fare', 'Fare estimate'],
  ['/about', 'About the data'],
]

export function Header({ route, through }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href="#/" aria-label="Hailwise home">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span className="brand-name">Hailwise</span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map(([path, label]) => (
            <a key={path} href={`#${path}`} aria-current={route === path ? 'page' : undefined}>{label}</a>
          ))}
        </nav>
        {through && <span className="chip">Data through {through}</span>}
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span><span className="brand-name">Hailwise</span> · Know before you hail.</span>
        <nav aria-label="Footer">
          <a href="#/about">About the data</a>
          <a href="#/fare">Fare estimate</a>
          <span>Source: NYC Taxi &amp; Limousine Commission</span>
        </nav>
      </div>
    </footer>
  )
}

export function Checker() {
  return <div className="checker" aria-hidden="true" />
}

export function SectionHead({ num, title, children }) {
  return (
    <>
      <div className="section-head">
        <span className="num">{num}</span>
        <h2>{title}</h2>
      </div>
      {children && <p className="section-dek">{children}</p>}
    </>
  )
}

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
  )
}
