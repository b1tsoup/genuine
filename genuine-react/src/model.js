const TOKEN_RE = /\n|[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+(?:[.,:][0-9]+)*|[^\sA-Za-z0-9]/gu
const enc = new TextEncoder()

function fnv1a(s) {
  let h = 0x811c9dc5
  for (const b of enc.encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0
  return h
}

function shape(t) {
  if (t === '\n') return 0
  if (/^[0-9]/.test(t)) return 1
  if (/^[A-Z]/.test(t)) return t.length > 1 && /^[A-Z]+$/.test(t) ? 3 : 2
  if (/^[a-z]/.test(t)) return 4
  return 5
}

export function tokenize(text) {
  return [...text.matchAll(TOKEN_RE)].map((m) => ({ t: m[0], start: m.index, end: m.index + m[0].length }))
}

function decode(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

export function loadModel(json) {
  const w = {}
  for (const [k, v] of Object.entries(json.tensors)) w[k] = { shape: v.shape, data: decode(v.data) }
  return { ...json, w }
}

function conv1d(x, T, C, { shape: [O, , K], data: W }, bias, dil) {
  const out = new Float32Array(T * O)
  const half = (K - 1) >> 1
  for (let t = 0; t < T; t++) {
    for (let o = 0; o < O; o++) {
      let s = bias[o]
      for (let k = 0; k < K; k++) {
        const src = t + (k - half) * dil
        if (src < 0 || src >= T) continue
        const xo = src * C, wo = o * C * K + k
        for (let c = 0; c < C; c++) s += W[wo + c * K] * x[xo + c]
      }
      out[t * O + o] = s
    }
  }
  return out
}

export function predictLogits(model, toks) {
  const T = toks.length
  const { w, buckets, dilations } = model
  const E = w['emb.weight'].shape[1], S = w['semb.weight'].shape[1]
  let C = E + S
  let x = new Float32Array(T * C)
  toks.forEach(({ t }, i) => {
    const id = fnv1a(t.toLowerCase()) % buckets, sh = shape(t)
    x.set(w['emb.weight'].data.subarray(id * E, id * E + E), i * C)
    x.set(w['semb.weight'].data.subarray(sh * S, sh * S + S), i * C + E)
  })
  dilations.forEach((d, i) => {
    const h = conv1d(x, T, C, w[`convs.${i}.weight`], w[`convs.${i}.bias`].data, d)
    for (let j = 0; j < h.length; j++) h[j] = Math.max(0, h[j])
    if (i > 0) for (let j = 0; j < h.length; j++) h[j] += x[j]
    x = h
    C = h.length / T
  })
  const logits = conv1d(x, T, C, w['out.weight'], w['out.bias'].data, 1)
  return { N: logits.length / T || 2 * model.labels.length, logits }
}

export function predictTags(model, toks) {
  const { N, logits } = predictLogits(model, toks)
  return toks.map((_, t) => {
    let best = 0
    for (let n = 1; n < N; n++) if (logits[t * N + n] > logits[t * N + best]) best = n
    return best
  })
}

const SENTENCE_END = new Set(['.', '!', '?'])
const STRUCTURED = /^\s*(?:[-*+•]\s|\d+[.)]\s|\||[^:\n]{1,30}:\s*\S[^\n]{0,60}$|[^:\n]{1,30}:\s*$)/

function lineAt(text, pos) {
  const a = text.lastIndexOf('\n', pos - 1) + 1
  const b = text.indexOf('\n', pos)
  return text.slice(a, b < 0 ? text.length : b)
}

export function segment(model, text, source = text) {
  const toks = tokenize(text)
  if (!toks.length) return []
  const { N, logits } = predictLogits(model, toks)
  const L = N / 2
  const probs = (t) => {
    const row = logits.subarray(t * N, t * N + N)
    const m = Math.max(...row)
    const e = row.map((v) => Math.exp(v - m))
    const z = e.reduce((a, b) => a + b, 0)
    return e.map((v) => v / z)
  }

  const units = []
  toks.forEach((tok, i) => {
    if (tok.t === '\n') return
    const prev = toks[i - 1]
    const structured = STRUCTURED.test(lineAt(text, tok.start))
    const newLine = prev?.t === '\n'
    const sameBlock = newLine && toks[i - 2]?.t !== '\n' && structured && STRUCTURED.test(lineAt(text, toks[i - 2]?.start ?? 0))
    const sentence = !newLine && !structured && SENTENCE_END.has(prev?.t) && tok.start > prev.end
    if (!units.length || (newLine && !sameBlock) || sentence) units.push([])
    units[units.length - 1].push(i)
  })

  const segs = []
  for (const idx of units) {
    const votes = new Float64Array(L)
    for (const i of idx) probs(i).forEach((p, n) => (votes[n >> 1] += p))
    const label = votes.indexOf(Math.max(...votes))
    const first = probs(idx[0])
    const last = segs[segs.length - 1]
    const start = toks[idx[0]].start, end = toks[idx[idx.length - 1]].end
    const textRun = model.labels[label] === 'text' && last?.label === label
    if (last && last.label === label && (textRun || first[2 * label] <= first[2 * label + 1])) last.end = end
    else segs.push({ label, start, end })
  }
  return segs.map((s) => ({ type: model.labels[s.label], text: source.slice(s.start, s.end).trim() }))
}
