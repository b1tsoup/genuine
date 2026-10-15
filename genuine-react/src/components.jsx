import { useEffect, useState } from 'react'

const cx = (...c) => c.filter(Boolean).join(' ')

export function Inline({ text }) {
  const parts = []
  const re = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*([^*\s][^*]*)\*|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])|([\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,})/gi
  let last = 0
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(last, m.index))
    const k = m.index
    if (m[1] || m[2]) parts.push(<strong key={k}>{m[1] || m[2]}</strong>)
    else if (m[3]) parts.push(<code key={k} className="gn-code">{m[3]}</code>)
    else if (m[4]) parts.push(<a key={k} className="gn-link" href={m[5]} target="_blank" rel="noreferrer">{m[4]}</a>)
    else if (m[7]) parts.push(<a key={k} className="gn-link" href={m[7]} target="_blank" rel="noreferrer">{m[7].replace(/^https?:\/\/(www\.)?/, '')}</a>)
    else if (m[8]) parts.push(<a key={k} className="gn-link" href={`mailto:${m[8]}`}>{m[8]}</a>)
    else parts.push(<em key={k}>{m[6]}</em>)
    last = k + m[0].length
  }
  parts.push(text.slice(last))
  return parts
}

export function Text({ text }) {
  const h = text.match(/^(#{1,6})\s+(.+)$/)
  if (h) return <h3 className="gn-heading"><Inline text={h[2]} /></h3>
  return text.split(/\n{2,}/).map((p, i) => (
    <p key={i} className="gn-text">
      {p.split('\n').map((l, j) => <span key={j}>{j > 0 && <br />}<Inline text={l} /></span>)}
    </p>
  ))
}

export function List({ title, ordered, items }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <div className="gn-list-wrap">
      {title && <p className="gn-text"><Inline text={title} /></p>}
      <Tag className={cx('gn-list', ordered && 'gn-list-ordered')}>
        {items.map((it, i) => <li key={i}><Inline text={it} /></li>)}
      </Tag>
    </div>
  )
}

export function Table({ title, columns, rows }) {
  return (
    <div className="gn-card gn-table-card">
      {title && <div className="gn-card-header"><h4 className="gn-card-title">{title}</h4></div>}
      <div className="gn-table-scroll">
        <table className="gn-table">
          <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

const fmt = (v, unit) => {
  const n = Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e4 ? `${+(v / 1e3).toFixed(1)}k` : `${+v.toFixed(2)}`
  return unit === '%' ? `${n}%` : `${unit}${n}`
}
const color = (i) => `hsl(var(--gn-chart-${(i % 5) + 1}))`

function Bars({ points, unit }) {
  const max = Math.max(...points.map((p) => p.value), 0) || 1
  return (
    <div className="gn-bars" role="img">
      {points.map((p, i) => (
        <div key={i} className="gn-bar-row">
          <span className="gn-bar-label">{p.label}</span>
          <div className="gn-bar-track">
            <div className="gn-bar" style={{ width: `${(Math.max(p.value, 0) / max) * 100}%` }} />
          </div>
          <span className="gn-bar-value">{fmt(p.value, unit)}</span>
        </div>
      ))}
    </div>
  )
}

function Line({ points, unit }) {
  const W = 400, H = 160, P = 8
  const vals = points.map((p) => p.value)
  const lo = Math.min(...vals, 0), hi = Math.max(...vals) || 1
  const xy = points.map((p, i) => [P + (i * (W - 2 * P)) / (points.length - 1), H - P - ((p.value - lo) / (hi - lo || 1)) * (H - 2 * P)])
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')
  return (
    <div>
      <svg className="gn-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <path d={`${d}L${xy.at(-1)[0]},${H - P}L${P},${H - P}Z`} className="gn-line-area" />
        <path d={d} className="gn-line-path" vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" className="gn-line-dot"><title>{`${points[i].label}: ${fmt(points[i].value, unit)}`}</title></circle>)}
      </svg>
      <div className="gn-line-labels">{points.map((p, i) => <span key={i}>{p.label}</span>)}</div>
    </div>
  )
}

function Pie({ points, unit }) {
  const total = points.reduce((a, p) => a + p.value, 0) || 1
  let acc = 0
  const stops = points.map((p, i) => {
    const from = (acc / total) * 360
    acc += p.value
    return `${color(i)} ${from}deg ${(acc / total) * 360}deg`
  })
  return (
    <div className="gn-pie-wrap">
      <div className="gn-pie" role="img" style={{ background: `conic-gradient(${stops.join(',')})` }} />
      <ul className="gn-legend">
        {points.map((p, i) => (
          <li key={i}><span className="gn-swatch" style={{ background: color(i) }} />{p.label}<span className="gn-legend-value">{fmt(p.value, unit)}</span></li>
        ))}
      </ul>
    </div>
  )
}

export function Chart({ title, kind, unit, points }) {
  const C = { bar: Bars, line: Line, pie: Pie }[kind]
  return (
    <div className="gn-card gn-chart">
      {title && <div className="gn-card-header"><h4 className="gn-card-title">{title}</h4></div>}
      <div className="gn-card-content"><C points={points} unit={unit} /></div>
    </div>
  )
}

export function Form({ title, fields, onAction }) {
  const [sent, setSent] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    setSent(true)
    onAction?.({ type: 'submit', values: Object.fromEntries(new FormData(e.currentTarget)) })
  }
  return (
    <form className="gn-card gn-form" onSubmit={submit}>
      {title && <div className="gn-card-header"><p className="gn-card-description"><Inline text={title} /></p></div>}
      <div className="gn-card-content gn-fields">
        {fields.map((f) => (
          <label key={f.name} className="gn-field">
            <span className="gn-label">{f.label}{f.optional && <span className="gn-optional"> (optional)</span>}</span>
            {f.type === 'textarea'
              ? <textarea name={f.name} className="gn-input gn-textarea" placeholder={f.placeholder} required={!f.optional} disabled={sent} />
              : <input name={f.name} type={f.type} className="gn-input" placeholder={f.placeholder} required={!f.optional} disabled={sent} />}
          </label>
        ))}
      </div>
      <div className="gn-card-footer">
        <button type="submit" className="gn-button" disabled={sent}>{sent ? 'Submitted' : 'Submit'}</button>
      </div>
    </form>
  )
}

export function Buttons({ prompt, options, onAction }) {
  const [picked, setPicked] = useState(null)
  return (
    <div className="gn-buttons">
      {prompt && <p className="gn-text"><Inline text={prompt} /></p>}
      <div className="gn-button-group">
        {options.map((o) => (
          <button key={o} type="button" disabled={picked !== null}
            className={cx('gn-button', picked === o ? 'gn-button-selected' : 'gn-button-outline')}
            onClick={() => { setPicked(o); onAction?.({ type: 'button', value: o }) }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Card({ title, pairs }) {
  return (
    <div className="gn-card">
      {title && <div className="gn-card-header"><h4 className="gn-card-title">{title}</h4></div>}
      <dl className="gn-card-content gn-pairs">
        {pairs.map((p, i) => <div key={i} className="gn-pair"><dt>{p.key}</dt><dd><Inline text={p.value} /></dd></div>)}
      </dl>
    </div>
  )
}

const ICONS = {
  warning: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  error: 'M12 8v4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  success: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  external: 'M7 17 17 7M7 7h10v10',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  check: 'M20 6 9 17l-5-5',
}

const Icon = ({ name, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
)

export function Image({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <figure className="gn-image">
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      {alt && <figcaption>{alt}</figcaption>}
    </figure>
  )
}

function Tile({ href, icon, title, sub, external }) {
  return (
    <a className="gn-card gn-tile" href={href} {...(external && { target: '_blank', rel: 'noreferrer' })}>
      <span className="gn-tile-icon"><Icon name={icon} /></span>
      <span className="gn-tile-text">
        <span className="gn-tile-title">{title}</span>
        <span className="gn-tile-sub">{sub}</span>
      </span>
      <Icon name="external" className="gn-tile-arrow" />
    </a>
  )
}

export function Link({ url, host, title }) {
  return <Tile href={url} icon="link" title={title || host} sub={url.replace(/^https?:\/\/(www\.)?/, '')} external />
}

export function Email({ address, label }) {
  return <Tile href={`mailto:${address}`} icon="email" title={label || 'Send an email'} sub={address} />
}

export function Social({ links }) {
  return (
    <div className="gn-social">
      {links.map((l) => (
        <a key={l.url} className="gn-social-link" href={l.url} target="_blank" rel="noreferrer">
          <span className="gn-social-platform">{l.platform}</span>
          <span className="gn-social-handle">{l.handle}</span>
        </a>
      ))}
    </div>
  )
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button type="button" className="gn-copy" onClick={() => navigator.clipboard?.writeText(text).then(() => setDone(true))}>
      <Icon name={done ? 'check' : 'copy'} />{done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Panel({ label, copy, children }) {
  return (
    <div className="gn-card gn-panel">
      <div className="gn-panel-head"><span>{label}</span><CopyButton text={copy} /></div>
      {children}
    </div>
  )
}

export function Code({ lang, code }) {
  return (
    <Panel label={lang || 'code'} copy={code}>
      <pre className="gn-pre"><code>{code}</code></pre>
    </Panel>
  )
}

function JsonNode({ name, value, depth }) {
  const key = name != null && <span className="gn-json-key">{JSON.stringify(name)}: </span>
  if (value === null || typeof value !== 'object') {
    return <div className="gn-json-row">{key}<span className={`gn-json-${value === null ? 'null' : typeof value}`}>{JSON.stringify(value)}</span></div>
  }
  const isArr = Array.isArray(value)
  const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value)
  return (
    <details className="gn-json-node" open={depth < 2}>
      <summary data-close={isArr ? ']' : '}'}>
        {key}{isArr ? '[' : '{'}<span className="gn-json-count">{entries.length} {isArr ? 'items' : 'keys'}</span>
      </summary>
      <div className="gn-json-children">
        {entries.map(([k, v]) => <JsonNode key={k} name={isArr ? null : k} value={v} depth={depth + 1} />)}
      </div>
      <div>{isArr ? ']' : '}'}</div>
    </details>
  )
}

export function Json({ value }) {
  return (
    <Panel label="json" copy={JSON.stringify(value, null, 2)}>
      <div className="gn-pre gn-json"><JsonNode value={value} depth={0} /></div>
    </Panel>
  )
}

export function Alert({ title, body, variant }) {
  return (
    <div className={cx('gn-alert', `gn-alert-${variant}`)} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon name={variant} className="gn-alert-icon" />
      <div>
        {title && <div className="gn-alert-title">{title}</div>}
        <div className="gn-alert-body"><Inline text={body} /></div>
      </div>
    </div>
  )
}
