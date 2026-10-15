import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon, BracesIcon, CodeIcon, Notification01Icon, PaintBoardIcon, PencilEdit01Icon, PlayIcon, StopIcon, ViewIcon,
} from '@hugeicons/core-free-icons'
import * as G from 'genuine-react'
import 'genuine-react/styles.css'
import { Accordion, Segmented, Toasts } from './arc.jsx'
import { EXAMPLES, GALLERY, INSTALL, TRAIN } from './examples.js'
import './demo.css'

const WEIGHTS = Object.values(import.meta.glob('../../model/genuine-model.json', { eager: true, import: 'default' }))[0]
G.setModel(WEIGHTS)

const SWATCHES = {
  mono: '#ffffff', blue: 'hsl(221 83% 53%)', violet: 'hsl(262 83% 58%)', green: 'hsl(142 71% 38%)', orange: 'hsl(24 95% 50%)', rose: 'hsl(347 77% 50%)',
}

const themeProps = (theme) =>
  theme.custom ? { style: G.colorTheme(theme.custom) } : theme.preset !== 'mono' ? { className: `gn-${theme.preset}` } : {}

const themeJsx = (theme) =>
  theme.custom ? `style={colorTheme('${theme.custom}')}` : theme.preset !== 'mono' ? `className="gn-${theme.preset}"` : ''

const escapeTemplate = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const codeFor = (text, theme) => `import { Genuine${theme.custom ? ', colorTheme' : ''} } from './genuine'
import './genuine/genuine.css'

const reply = \`${escapeTemplate(text)}\`

export function Message() {
  return (
    <Genuine
      text={reply}${themeJsx(theme) ? `\n      ${themeJsx(theme)}` : ''}
      onAction={(e) => console.log(e)}
    />
  )
}`

function Snippet({ lang, code }) {
  return <div className="gn-root"><G.Code lang={lang} code={code} /></div>
}

function Direct({ type, text, theme }) {
  const Comp = G[type.charAt(0).toUpperCase() + type.slice(1)]
  const { className, style } = themeProps(theme)
  return (
    <div className={['gn-root', className].filter(Boolean).join(' ')} style={style}>
      <Comp text={text} {...G.parseSegment({ type, text }).props} />
    </div>
  )
}

function useStream() {
  const [state, setState] = useState({ text: null, streaming: false })
  const timer = useRef()
  const stop = useCallback(() => {
    clearInterval(timer.current)
    setState({ text: null, streaming: false })
  }, [])
  const start = useCallback((full) => {
    clearInterval(timer.current)
    let i = 0
    setState({ text: '', streaming: true })
    timer.current = setInterval(() => {
      const next = full.indexOf(' ', i + 1 + Math.floor(Math.random() * 14))
      i = next < 0 ? full.length : next
      setState({ text: full.slice(0, i), streaming: i < full.length })
      if (i >= full.length) clearInterval(timer.current)
    }, 45)
  }, [])
  useEffect(() => () => clearInterval(timer.current), [])
  return { ...state, start, stop }
}

let toastId = 0

function useActions() {
  const [log, setLog] = useState([])
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const onAction = useCallback((e) => {
    setLog((l) => [e, ...l].slice(0, 20))
    setToasts((ts) => [...ts, {
      id: ++toastId,
      title: e.type === 'submit' ? 'Form submitted' : 'Button clicked',
      body: e.type === 'submit' ? Object.values(e.values).filter(Boolean).join(', ') || 'Empty form' : e.value,
    }].slice(-3))
  }, [])
  return { log, toasts, dismiss, onAction }
}

function Hero() {
  return (
    <section className="sec hero" id="overview">
      <h1>Zero-token generative UI.</h1>
      <p className="lede">Plain replies become UI in the browser. No extra tokens or latency.</p>
      {!WEIGHTS && <p className="lede muted">No trained model found so replies render as plain text. <a href="#train">Train one</a> and reload.</p>}
      <div className="hero-cta">
        <a className="btn btn-primary" href="#playground">Try it<HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} /></a>
        <a className="btn btn-secondary" href="#install">Install</a>
      </div>
    </section>
  )
}

function ColorPicker({ theme, setTheme }) {
  const snippet = theme.custom
    ? `.gn-root {\n${Object.entries(G.colorTheme(theme.custom)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
    : `<Genuine text={reply}${themeJsx(theme) ? ' ' + themeJsx(theme) : ''} />`
  return (
    <div className="colors">
      <div className="swatches">
        {G.PRESETS.map((p) => (
          <button key={p} className="swatch" aria-pressed={!theme.custom && theme.preset === p} onClick={() => setTheme({ preset: p })}>
            <span className="swatch-color" style={{ background: SWATCHES[p] }} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <label className="swatch" aria-pressed={!!theme.custom}>
          <input type="color" value={theme.custom || '#0070f3'} onChange={(e) => setTheme({ custom: e.target.value })} />
          Custom
        </label>
      </div>
      <Snippet lang={theme.custom ? 'css' : 'jsx'} code={snippet} />
    </div>
  )
}

function Playground({ theme, setTheme }) {
  const [text, setText] = useState(EXAMPLES[0].text)
  const [left, setLeft] = useState('reply')
  const [right, setRight] = useState('preview')
  const stream = useStream()
  const { log, toasts, dismiss, onAction } = useActions()
  const shown = stream.text ?? text
  const parts = useMemo(() => G.analyze(shown), [shown])

  const pick = (id) => {
    stream.stop()
    setText(EXAMPLES.find((e) => e.id === id).text)
  }

  return (
    <section className="sec" id="playground">
      <h2>Playground</h2>
      <div className="toolbar">
        <div className="scroll-x">
          <Segmented label="Example replies" value={EXAMPLES.find((e) => e.text === text)?.id ?? null}
            onChange={pick} options={EXAMPLES.map((e) => ({ value: e.id, label: e.label }))} />
        </div>
        {stream.streaming
          ? <button className="btn btn-secondary" onClick={stream.stop}><HugeiconsIcon icon={StopIcon} size={16} strokeWidth={1.5} />Stop</button>
          : <button className="btn btn-primary" onClick={() => stream.start(text)}><HugeiconsIcon icon={PlayIcon} size={16} strokeWidth={1.5} />Stream</button>}
      </div>
      <div className="split">
        <div>
          <Segmented label="Input" value={left} onChange={setLeft} options={[
            { value: 'reply', label: 'Reply', icon: PencilEdit01Icon },
            { value: 'colors', label: 'Colors', icon: PaintBoardIcon },
            { value: 'code', label: 'Code', icon: CodeIcon },
          ]} />
          <div className="tab-body">
            {left === 'reply' && (
              <textarea value={text} spellCheck={false} aria-label="LLM reply"
                onChange={(e) => { stream.stop(); setText(e.target.value) }} />
            )}
            {left === 'colors' && <ColorPicker theme={theme} setTheme={setTheme} />}
            {left === 'code' && <Snippet lang="jsx" code={codeFor(text, theme)} />}
          </div>
        </div>
        <div>
          <Segmented label="Output" value={right} onChange={setRight} options={[
            { value: 'preview', label: 'Preview', icon: ViewIcon },
            { value: 'json', label: `Segments (${parts.length})`, icon: BracesIcon },
            { value: 'events', label: `Events (${log.length})`, icon: Notification01Icon },
          ]} />
          <div className="tab-body">
            {right === 'preview' && <div className="surface"><G.Genuine text={shown} streaming={stream.streaming} onAction={onAction} {...themeProps(theme)} /></div>}
            {right === 'json' && <div className="gn-root" {...themeProps(theme)}><G.Json value={parts} /></div>}
            {right === 'events' && (log.length
              ? <div className="gn-root" {...themeProps(theme)}><G.Json value={log} /></div>
              : <p className="muted empty">Click a button or submit a form.</p>)}
          </div>
        </div>
      </div>
      <Toasts items={toasts} onDismiss={dismiss} />
    </section>
  )
}

function Components({ theme }) {
  return (
    <section className="sec" id="components">
      <h2>{GALLERY.length} components</h2>
      {GALLERY.map((c) => (
        <article key={c.type} className="item">
          <h3>{c.type === 'json' ? 'JSON' : c.type.charAt(0).toUpperCase() + c.type.slice(1)}</h3>
          <div className="surface"><Direct type={c.type} text={c.text} theme={theme} /></div>
          <Accordion title="Source text"><Snippet lang="text" code={c.text} /></Accordion>
        </article>
      ))}
    </section>
  )
}

function Install() {
  return (
    <section className="sec" id="install">
      <h2>Install</h2>
      <p className="lede">Not on npm. Copy the source into your app and load a model you <a href="#train">trained</a>. Needs React 18+. In the Next.js App Router put this in a <code>'use client'</code> file.</p>
      {INSTALL.map((s) => <Snippet key={s.lang} lang={s.lang} code={s.code} />)}
    </section>
  )
}

function Train() {
  return (
    <section className="sec" id="train">
      <h2>Train the model</h2>
      <p className="lede">No weights ship with Genuine. Train your own in about 15 minutes with Claude-generated data or your own examples.</p>
      {TRAIN.map((s) => (
        <div key={s.title} className="step">
          <h3>{s.title}</h3>
          <p className="muted">{s.desc}</p>
          <Snippet lang={s.lang} code={s.code} />
        </div>
      ))}
    </section>
  )
}

function App() {
  const [theme, setTheme] = useState({ preset: 'mono' })
  return (
    <div className="app dark">
      <header className="nav">
        <a className="logo" href="#overview">Genuine</a>
        <a className="btn btn-primary btn-sm" href="#install">Install</a>
      </header>
      <main>
        <Hero />
        <Playground theme={theme} setTheme={setTheme} />
        <Components theme={theme} />
        <Install />
        <Train />
      </main>
      <footer className="footer muted">Genuine 1.0.0 / MIT</footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
