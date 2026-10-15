import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { loadModel, tokenize, predictTags } from './src/model.js'
import { parseSegment, splitMedia, splitBlocks } from './src/parse.js'

const weights = new URL('../model/genuine-model.json', import.meta.url)
const parityFile = new URL('../model/parity.json', import.meta.url)
if (existsSync(weights) && existsSync(parityFile)) {
  const model = loadModel(JSON.parse(readFileSync(weights)))
  const rows = JSON.parse(readFileSync(parityFile))
  for (const { text, tags } of rows) assert.deepEqual(predictTags(model, tokenize(text)), tags, text)
  console.log(`parity: ${rows.length} texts match torch`)
}

const p = (type, text) => parseSegment({ type, text })

assert.deepEqual(p('buttons', 'Would you like me to cancel the order, issue a refund, or send a replacement?').props.options,
  ['Cancel the order', 'Issue a refund', 'Send a replacement'])
assert.deepEqual(p('buttons', 'Shall I go ahead and cancel it?').props.options, ['Yes', 'No'])
assert.deepEqual(p('buttons', 'Would you like a refund or a replacement?').props.options, ['Refund', 'Replacement'])
assert.deepEqual(p('buttons', 'I can resend the code or call you — which would you prefer?').props.options, ['Resend the code', 'Call you'])
assert.deepEqual(p('list', '• Tents\n• Stoves').props.items, ['Tents', 'Stoves'])
assert.deepEqual(p('chart', 'Paris: €1,200\nRome: €950').props.unit, '€')
assert.deepEqual(p('card', 'Order #9 — Status: Shipped, Total: $5.').props, { title: 'Order #9', pairs: [{ key: 'Status', value: 'Shipped' }, { key: 'Total', value: '$5' }] })
assert.deepEqual(p('form', 'Could you share your full name, email address and order number?').props.fields.map((f) => [f.label, f.type]),
  [['Full name', 'text'], ['Email address', 'email'], ['Order number', 'text']])
assert.deepEqual(p('form', '- Email\n- Preferred date (optional)').props.fields.map((f) => [f.type, f.optional]), [['email', false], ['date', true]])
const c = p('chart', '- January: $12,400\n- February: $15.2k\n- March: $18,000').props
assert.equal(c.kind, 'line')
assert.deepEqual(c.points.map((x) => x.value), [12400, 15200, 18000])
assert.equal(p('chart', 'Traffic by channel: Organic 42%, Paid ads 23%, Referral 20%, Social 15%.').props.kind, 'pie')
assert.deepEqual(p('card', '**Order #1**\nStatus: Shipped\n- **Total:** $5').props, { title: 'Order #1', pairs: [{ key: 'Status', value: 'Shipped' }, { key: 'Total', value: '$5' }] })
assert.deepEqual(p('table', '| A | B |\n|---|---|\n| 1 | 2 |').props.rows, [['1', '2']])
assert.equal(p('alert', 'Error: your card was declined.').props.variant, 'error')
assert.deepEqual(p('list', '1. Restart\n2. Update').props, { title: null, ordered: true, items: ['Restart', 'Update'] })
assert.equal(p('chart', 'no numbers here').type, 'text')
const media = splitMedia({ type: 'text', text: 'Reach us at:\nsupport@example.com\n- Docs: https://docs.example.com/setup\nhttps://x.com/acme\nhttps://github.com/acme\n![Logo](https://example.com/logo.png)\nThanks!' })
assert.deepEqual(media.map((s) => s.type), ['text', 'email', 'link', 'social', 'image', 'text'])
assert.deepEqual(media[2].props, { url: 'https://docs.example.com/setup', host: 'docs.example.com', title: 'Docs' })
assert.deepEqual(media[3].props.links.map((l) => [l.platform, l.handle]), [['X', 'acme'], ['GitHub', 'acme']])
assert.equal(splitMedia({ type: 'text', text: 'See https://a.com for more.' }).length, 1)
assert.equal(p('link', '[x](javascript:alert(1))').type, 'text')
const blocks = splitBlocks('Run this:\n```bash\nnpm i genuine-react\n```\nConfig:\n```json\n{"a": 1}\n```\nResponse:\n{\n  "ok": true,\n  "items": [1, 2]\n}\nSee [the docs] for more.')
assert.deepEqual(blocks.map((s) => s.type), ['text', 'code', 'text', 'json', 'text', 'json', 'text'])
assert.deepEqual(blocks[1].props, { lang: 'bash', code: 'npm i genuine-react' })
assert.deepEqual(blocks[5].props.value, { ok: true, items: [1, 2] })
assert.equal(p('json', '```\n[1, 2]\n```').props.value.length, 2)
assert.deepEqual(splitBlocks('Try:\n```py\nprint(1)\nprint(').at(-1).props, { lang: 'py', code: 'print(1)\nprint(' })
console.log('parsers ok')
