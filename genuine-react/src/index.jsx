import { useDeferredValue, useMemo } from 'react'
import { loadModel, segment } from './model.js'
import { parseSegment, splitMedia, splitBlocks } from './parse.js'
import * as C from './components.jsx'

let model = null

export function setModel(json) {
  model = json ? loadModel(json) : null
}

const DEFAULTS = {
  text: C.Text, list: C.List, table: C.Table, chart: C.Chart, form: C.Form, buttons: C.Buttons, card: C.Card, alert: C.Alert,
  image: C.Image, link: C.Link, email: C.Email, social: C.Social, code: C.Code, json: C.Json,
}

const MASK = /https?:\/\/\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const infer = (text) => model
  ? segment(model, text.replace(MASK, (m) => 'link'.padEnd(m.length)), text).map(parseSegment)
  : [parseSegment({ type: 'text', text })]

export function analyze(text) {
  return splitBlocks(text).flatMap((s) => (s.type === 'text' ? infer(s.text) : [s]))
}

export const PRESETS = ['mono', 'blue', 'violet', 'green', 'orange', 'rose']

const clamp = (n) => Math.min(92, Math.max(12, n))

export function colorTheme(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  const H = Math.round((h * 60 + 360) % 360), S = Math.round(s * 100), L = Math.round(l * 100)
  const c = (dl) => `${H} ${S}% ${clamp(L + dl)}%`
  return {
    '--gn-primary': c(0),
    '--gn-primary-foreground': L > 65 ? '0 0% 0%' : '0 0% 100%',
    '--gn-ring': c(0),
    '--gn-chart-1': c(0), '--gn-chart-2': c(16), '--gn-chart-3': c(-14), '--gn-chart-4': c(30), '--gn-chart-5': c(-26),
    '--gn-destructive': '0 72% 55%', '--gn-success': '142 64% 42%', '--gn-warning': '38 92% 50%', '--gn-info': c(0),
  }
}

const STREAMS_IN_PLACE = new Set(['text', 'code'])

export function Genuine({ text, streaming = false, onAction, components, className, style }) {
  const deferred = useDeferredValue(text || '')
  const parts = useMemo(() => analyze(deferred), [deferred])
  const map = { ...DEFAULTS, ...components }
  return (
    <div className={['gn-root', className].filter(Boolean).join(' ')} style={style} aria-busy={streaming || undefined}>
      {parts.map((p, i) => {
        const pending = streaming && i === parts.length - 1
        const type = pending && !STREAMS_IN_PLACE.has(p.type) ? 'text' : p.type
        const Comp = map[type]
        return (
          <div key={i} className={['gn-block', `gn-block-${type}`, pending && 'gn-pending'].filter(Boolean).join(' ')}>
            <Comp text={p.text} {...(type === p.type ? p.props : {})} onAction={onAction && ((e) => onAction({ ...e, component: p.type, text: p.text }))} />
          </div>
        )
      })}
      {streaming && !parts.length && <div className="gn-block gn-pending"><p className="gn-text" /></div>}
    </div>
  )
}

export function genuine(text, props) {
  return <Genuine text={text} {...props} />
}

export * from './components.jsx'
export { parseSegment, splitMedia, splitBlocks }
