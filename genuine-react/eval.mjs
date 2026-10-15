import { readFileSync } from 'node:fs'
import { loadModel, segment } from './src/model.js'

const model = loadModel(JSON.parse(readFileSync(new URL('../model/genuine-model.json', import.meta.url))))
const rows = readFileSync(new URL('../model/data/val.jsonl', import.meta.url), 'utf8').trim().split('\n').map(JSON.parse)

const types = (segs) => segs.map((s) => s.type).filter((t, i, a) => !(t === 'text' && a[i - 1] === 'text')).join()

let charOk = 0, charN = 0, exact = 0
const confusion = {}
for (const { text, spans } of rows) {
  const gold = spans.map(([a, b, type]) => ({ type, text: text.slice(a, b).trim() }))
  const pred = segment(model, text)
  const labelAt = (segs) => {
    const out = new Array(text.length).fill(null)
    let from = 0
    for (const s of segs) {
      const at = text.indexOf(s.text, from)
      out.fill(s.type, at, at + s.text.length)
      from = at + s.text.length
    }
    return out
  }
  const g = labelAt(gold), p = labelAt(pred)
  let wrong = 0
  for (let i = 0; i < text.length; i++) {
    if (!g[i] || /\s/.test(text[i])) continue
    charN++
    if (g[i] === p[i]) charOk++
    else wrong++
    if (g[i] !== p[i]) confusion[`${g[i]} -> ${p[i]}`] = (confusion[`${g[i]} -> ${p[i]}`] || 0) + 1
  }
  if (!wrong && types(gold) === types(pred)) exact++
}
console.log(`${rows.length} held-out replies: char accuracy ${(charOk / charN * 100).toFixed(1)}%, exact segmentation ${exact}/${rows.length}`)
console.log('top confusions (gold -> predicted, chars):', Object.entries(confusion).sort((a, b) => b[1] - a[1]).slice(0, 6))
