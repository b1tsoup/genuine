const BULLET = /^\s*(?:[-*+•]|\d+[.)]|[a-z][.)]|step \d+:)\s+/i
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)
const unbullet = (s) => s.replace(BULLET, '')
export const stripMd = (s) => s.replace(/\*\*|__|`/g, '').replace(/^#+\s*/, '').trim()
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const trimEnd = (s) => s.replace(/[\s.!?;:,]+$/, '')
const splitItems = (s) =>
  s.split(/,\s+(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+/i).map((x) => trimEnd(x.trim())).filter(Boolean)

function list(text) {
  const ls = lines(text)
  const bulleted = ls.filter((l) => BULLET.test(l))
  if (bulleted.length >= 1 && ls.length > 1) {
    const title = BULLET.test(ls[0]) ? null : ls[0]
    return { title, ordered: /^\s*(\d+[.)]|step)/i.test(bulleted[0]), items: bulleted.map(unbullet) }
  }
  const i = text.indexOf(':')
  const items = splitItems(i >= 0 ? text.slice(i + 1) : text)
  return items.length > 1 ? { title: i >= 0 ? text.slice(0, i) : null, ordered: false, items } : null
}

function table(text) {
  const ls = lines(text).filter((l) => l.includes('|') || l.includes('\t'))
  const rows = ls
    .filter((l) => !/^[\s|:\-+]+$/.test(l))
    .map((l) => l.replace(/^\||\|$/g, '').split(l.includes('|') ? '|' : '\t').map((c) => stripMd(c.trim())))
  if (rows.length < 2) return null
  const title = lines(text).find((l) => !l.includes('|') && !l.includes('\t'))
  return { title: title ? stripMd(title) : null, columns: rows[0], rows: rows.slice(1) }
}

const NUM = /([$€£]?)\s?(-?\d[\d,]*(?:\.\d+)?)\s*([kKmMbB](?![a-z])|%)?/
const TIME_LABEL = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun|q[1-4]|week|day|\d{4}$)/i

function chart(text) {
  const ls = lines(text)
  const chunks = ls.length > 1 ? ls : text.split(/[,;]\s+(?:and\s+)?|\s+and\s+/)
  let title = null
  let unit = ''
  const points = []
  for (const raw of chunks) {
    const c = stripMd(unbullet(raw))
    const m = c.match(NUM)
    if (!m) {
      title ??= trimEnd(c)
      continue
    }
    const after = c.slice(m.index + m[0].length).match(/\b(?:in|for|during|on|at)\s+(.+)$/i)
    const parts = c.slice(0, m.index).split(':').map((x) => x.replace(/[\s\-–—~=]+$/, '').trim()).filter(Boolean)
    let label = after ? trimEnd(after[1]) : parts.pop()
    if (!after && parts.length) title ??= parts.join(': ')
    if (!label) continue
    label = label.replace(/\s+(?:was|were|is|reached|came in at|had)$/i, '')
    let value = parseFloat(m[2].replace(/,/g, ''))
    const suf = (m[3] || '').toLowerCase()
    value *= { k: 1e3, m: 1e6, b: 1e9 }[suf] || 1
    unit ||= m[1] || (suf === '%' ? '%' : '')
    points.push({ label, value })
  }
  if (points.length < 2) return null
  const sum = points.reduce((a, p) => a + p.value, 0)
  const kind = unit === '%' && sum > 90 && sum < 110 ? 'pie' : points.every((p) => TIME_LABEL.test(p.label)) ? 'line' : 'bar'
  return { title, kind, unit, points }
}

function fieldType(label) {
  const l = label.toLowerCase()
  if (/e-?mail/.test(l)) return 'email'
  if (/phone|mobile/.test(l)) return 'tel'
  if (/date|birthday|\bdob\b/.test(l)) return 'date'
  if (/time\b/.test(l) && !/best time/.test(l)) return 'time'
  if (/\burl\b|website/.test(l)) return 'url'
  if (/number of|quantity|guests|\bage\b|amount|budget/.test(l)) return 'number'
  if (/description|message|details|issue|comment|reason|notes?\b/.test(l)) return 'textarea'
  return 'text'
}

function makeField(raw) {
  let label = stripMd(raw).replace(/:\s*(_+|\[.*\])?\s*$/, '')
  const optional = /\(optional\)/i.test(label)
  const ex = label.match(/\((?:e\.g\.?|eg|ex\.?)\s*([^)]*)\)/i)
  label = cap(trimEnd(label.replace(/\(.*?\)/g, '').replace(/^(?:your|the|my)\s+/i, '').trim()))
  const name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return { name, label, type: fieldType(label), optional, placeholder: ex ? ex[1] : '' }
}

function form(text) {
  const ls = lines(text)
  let title = null
  let raws
  if (ls.length > 1) {
    title = !BULLET.test(ls[0]) && !/:\s*(_+|\[.*\])?$/.test(ls[0]) ? ls[0] : null
    raws = (title ? ls.slice(1) : ls).map(unbullet)
  } else {
    title = text
    const m = text.match(/\b(?:share|provide|send(?: me)?|tell me|confirm|enter|give me|need|have|get|include)\s+(?:me\s+)?(?:with\s+)?(.+)/i)
    if (!m) return null
    const body = m[1].split(/\s+(?:so that|so|to verify|to help|in order|and i'll|and we'll|for)\s+|[?.!]/i)[0]
    raws = splitItems(body)
  }
  const fields = raws.map(makeField).filter((f) => f.name)
  return fields.length ? { title, fields } : null
}

function buttons(text) {
  const ls = lines(text)
  if (ls.length > 1 && ls.slice(1).some((l) => BULLET.test(l))) {
    return { prompt: BULLET.test(ls[0]) ? null : ls[0], options: ls.filter((l) => BULLET.test(l)).map((l) => stripMd(unbullet(l))) }
  }
  const t = stripMd(text)
  const m =
    t.match(/(?:like (?:me )?to|want (?:me )?to|prefer to|should i|shall i(?: go ahead and)?|can i|i can|you'd like (?:me )?to)\s+(.+?)(?:\s+[—–-]\s+.*)?[?.!]*$/i) ||
    t.match(/:\s*(.+?)[?.!]*$/) ||
    t.match(/\b(?:like|want|prefer|need|choose|pick)\s+(.+\bor\b.+?)[?.!]*$/i)
  const options = m ? splitItems(m[1].replace(/\s+for you$/i, '')).map((o) => cap(o.replace(/^(?:a|an|the)\s+/i, ''))) : []
  return { prompt: t, options: options.length > 1 ? options : ['Yes', 'No'] }
}

const PAIR = /^([^:]{1,40}?)\s*:\s*(.+)$/

function card(text) {
  const ls = lines(text)
  let title = null
  let pairs = []
  if (ls.length > 1) {
    for (const l of ls) {
      const m = stripMd(unbullet(l)).match(PAIR)
      if (m) pairs.push({ key: m[1], value: m[2] })
      else title ??= stripMd(l)
    }
  } else {
    const [head, rest] = stripMd(text).split(/\s+[—–-]\s+|:\s+(?=[A-Z][\w ]{0,30}:)/, 2)
    const body = rest ?? head
    if (rest) title = head
    pairs = body.split(/,\s+(?=[A-Z][\w ]{0,30}:)/).map((c) => c.match(PAIR)).filter(Boolean)
      .map((m) => ({ key: m[1], value: trimEnd(m[2]) }))
  }
  return pairs.length ? { title, pairs } : null
}

function alert(text) {
  const t = stripMd(text)
  const m = t.match(/^([A-Za-z ]{2,20}?)(?::|!)\s+(.+)$/s)
  const title = m && m[1].split(' ').length <= 3 ? m[1] : null
  const body = title ? m[2] : t
  const variant = /error|fail|declin|couldn't|could not|unable|invalid|expired/i.test(t) ? 'error'
    : /^(tip|fyi|info)/i.test(t) ? 'info'
    : /success|done|confirmed|processed|all set|has been|completed/i.test(t) ? 'success'
    : 'warning'
  return { title, body, variant }
}

const URL_RE = /^https?:\/\/[^\s<>]+$/i
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const SOCIAL = {
  'x.com': 'X', 'twitter.com': 'X', 'github.com': 'GitHub', 'linkedin.com': 'LinkedIn', 'instagram.com': 'Instagram',
  'youtube.com': 'YouTube', 'tiktok.com': 'TikTok', 'facebook.com': 'Facebook', 'threads.net': 'Threads', 'bsky.app': 'Bluesky',
}
const FENCE = /^[ \t]*```([\w+#.-]*)[^\n]*\n([\s\S]*?)\n?[ \t]*```[ \t]*$/gm
const MAX_JSON_LINES = 400

function media(line) {
  const l = unbullet(line.trim()).replace(/\*\*/g, '')
  const img = l.match(/^!\[([^\]]*)\]\((https?:\/\/\S+?)\)$/)
  if (img) return { type: 'image', props: { src: img[2], alt: img[1] } }
  const m = l.match(/^(?:(.{1,30}?):\s+)?(?:\[([^\]]+)\]\((\S+?)\)|<?(\S+?)>?)$/)
  if (!m) return null
  const label = m[2] || m[1] || null
  const target = m[3] || m[4]
  const address = target.replace(/^mailto:/i, '')
  if (EMAIL_RE.test(address)) return { type: 'email', props: { address, label } }
  if (!URL_RE.test(target)) return null
  if (IMG_EXT.test(target)) return { type: 'image', props: { src: target, alt: label || '' } }
  const { hostname, pathname } = new URL(target)
  const host = hostname.replace(/^www\./, '')
  const platform = SOCIAL[host]
  if (platform) return { type: 'social', props: { links: [{ platform, url: target, handle: pathname.replace(/^\/|\/$/g, '') || host }] } }
  return { type: 'link', props: { url: target, host, title: label } }
}

export function splitMedia(seg) {
  if (seg.type !== 'text') return [seg]
  const out = []
  let buf = []
  const flush = () => {
    const text = buf.join('\n').trim()
    if (text) out.push({ type: 'text', text, props: {} })
    buf = []
  }
  for (const line of seg.text.split('\n')) {
    const m = media(line)
    if (!m) { buf.push(line); continue }
    flush()
    const last = out[out.length - 1]
    if (m.type === 'social' && last?.type === 'social') {
      last.props.links.push(...m.props.links)
      last.text += '\n' + line.trim()
    } else out.push({ ...m, text: line.trim() })
  }
  flush()
  return out
}

function parseJson(s) {
  if (!/^\s*[{[]/.test(s)) return undefined
  try { return JSON.parse(s) } catch { return undefined }
}

function fenced(lang, body) {
  const value = /^(json\w*)?$/i.test(lang) ? parseJson(body) : undefined
  return value !== undefined ? { type: 'json', props: { value } } : { type: 'code', props: { lang: lang || null, code: body } }
}

function splitJson(text) {
  const lines = text.split('\n')
  const out = []
  let buf = []
  const flush = () => {
    out.push(...splitMedia({ type: 'text', text: buf.join('\n') }))
    buf = []
  }
  for (let i = 0; i < lines.length; i++) {
    let end = -1
    if (/^\s*[{[]/.test(lines[i])) {
      for (let j = i; j < Math.min(lines.length, i + MAX_JSON_LINES); j++) {
        if (parseJson(lines.slice(i, j + 1).join('\n')) !== undefined) { end = j; break }
      }
    }
    if (end < 0) { buf.push(lines[i]); continue }
    flush()
    const body = lines.slice(i, end + 1).join('\n').trim()
    out.push({ type: 'json', text: body, props: { value: JSON.parse(body) } })
    i = end
  }
  flush()
  return out
}

export function splitBlocks(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(FENCE)) {
    out.push(...splitJson(text.slice(last, m.index)))
    out.push({ ...fenced(m[1], m[2]), text: m[0].trim() })
    last = m.index + m[0].length
  }
  const rest = text.slice(last)
  const open = rest.match(/^[ \t]*```([\w+#.-]*)[^\n]*(?:\n([\s\S]*))?$/m)
  out.push(...splitJson(open ? rest.slice(0, open.index) : rest))
  if (open) out.push({ type: 'code', text: open[0].trim(), props: { lang: open[1] || null, code: open[2] ?? '' } })
  return out
}

const blockParser = (type) => (text) => splitBlocks(text).find((s) => s.type === type)?.props ?? null

const PARSERS = {
  list, table, chart, form, buttons, card, alert,
  ...Object.fromEntries(['image', 'link', 'email', 'social', 'code', 'json'].map((t) => [t, blockParser(t)])),
}

export function parseSegment(seg) {
  const props = PARSERS[seg.type]?.(seg.text)
  return props ? { ...seg, props } : { type: 'text', text: seg.text, props: {} }
}
