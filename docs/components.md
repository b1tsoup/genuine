# Developer guide

## How it works

```
reply text -> tokenize -> CNN tags each token (BIO) -> segments -> parser per type -> React component
```

1. **Tokenize** (`model.js`): splits text into words and numbers and punctuation and newlines. The regex must stay identical to `model/datagen.py`.
2. **Tag** (`model.js`): each token is hashed (FNV-1a) into an embedding bucket and joined with a shape embedding (number / Capitalized / UPPER / lower / symbol). The result runs through dilated 1D convolutions with residuals. Output is one tag per token: `label * 2 + (0 = begin, 1 = inside)`.
3. **Segment** (`model.js`): tokens are grouped into units at line and sentence boundaries. Bullet and table and key/value lines stay together. Each unit takes the label its tokens vote for. Adjacent units with the same label merge.
4. **Parse** (`parse.js`): each segment type has a parser that turns raw text into props. If the parser can't extract anything useful the segment falls back to `text`. A wrong guess never renders a broken component.
5. **Render** (`components.jsx`): the props go to the component for that type.

Code and JSON and media aren't model labels. Before inference `splitBlocks` (`parse.js`) lifts them out:

- fenced code blocks (a ```` ```json ```` fence becomes `json`)
- bare JSON objects or arrays that parse
- every line that is only a URL or email or markdown image

URLs and emails inside sentences are masked as a single word of the same length so they don't confuse the model. `Inline` linkifies them afterwards.

Everything runs synchronously in the browser. No extra LLM tokens and no prompt changes. The only network requests are for images a reply links to.

## Loading the model

No weights ship with the library. Train them (`model/train.py` writes `model/genuine-model.json`) and load them once at startup:

```jsx
import { setModel } from './genuine'
import weights from './genuine/genuine-model.json'

setModel(weights)
```

- Before `setModel` runs steps 1 to 3 are skipped and every non-block segment renders as `text`. Block detection still works since it's rule-based.
- `setModel(null)` unloads the model.
- In the Next.js App Router call `setModel` and render `Genuine` inside a `'use client'` file. A server component can't call `setModel`.
- The model is module-level state shared by every `Genuine` on the page. Call `setModel` before the first render or the first replies render as plain text.

## Streaming

LLM output arrives in chunks. Append each chunk to your text and pass `streaming` while the reply is still being written:

```jsx
const [text, setText] = useState('')
const [streaming, setStreaming] = useState(false)

async function ask(prompt) {
  setText('')
  setStreaming(true)
  const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ prompt }) })
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  for (let r = await reader.read(); !r.done; r = await reader.read()) setText((t) => t + r.value)
  setStreaming(false)
}

return <Genuine text={text} streaming={streaming} />
```

While `streaming` is true:

- Every segment except the last renders as its component as soon as it exists.
- The last segment is still being written so it renders as text with a cursor. A half-written form or button group is never clickable.
- Code blocks are the exception. An unclosed fence renders as a `Code` block and fills in live.
- Analysis runs through `useDeferredValue` so fast streams don't block input.
- The root gets `aria-busy="true"`.

When `streaming` turns false, the last segment renders as its real component.

## Colors

The default theme is black and white. Three ways to add color:

```jsx
<Genuine text={reply} className="gn-blue" />
<Genuine text={reply} style={colorTheme('#0070f3')} />
```

```css
.gn-root { --gn-primary: 221 83% 53%; --gn-chart-1: 221 83% 53%; }
```

- **Presets:** `gn-blue` `gn-violet` `gn-green` `gn-orange` `gn-rose`. They are exported as `PRESETS` along with `mono` for the default. Presets also give alerts their status colors.
- **`colorTheme(hex)`:** builds a style object from one hex color. It covers the primary and ring tokens plus five chart shades and the status colors.
- **Tokens:** set any `--gn-*` variable yourself (see Theming).

## API

| Export | Signature | Use |
| --- | --- | --- |
| `genuine` | `genuine(text, props?) => ReactElement` | Shorthand for `<Genuine text={text} {...props} />` |
| `Genuine` | `<Genuine text streaming? onAction? components? className? style? />` | Main component |
| `setModel` | `setModel(json \| null)` | Load trained weights, or unload them |
| `analyze` | `analyze(text) => [{ type, text, props }]` | Segments + parsed props, no rendering |
| `parseSegment` | `parseSegment({ type, text }) => { type, text, props }` | Parse text as a known type, skipping the model |
| `splitBlocks` | `splitBlocks(text) => segments` | Lift code / JSON / image / link / email / social blocks out of text |
| `splitMedia` | `splitMedia({ type: 'text', text }) => segments` | Lift image/link/email/social lines out of text |
| `colorTheme` | `colorTheme(hex) => style` | Palette from one color to pass as `style` |
| `PRESETS` | `string[]` | Names of the built-in color classes |
| `Text` `List` `Table` `Chart` `Form` `Buttons` `Card` `Alert` `Image` `Link` `Email` `Social` `Code` `Json` `Inline` | React components | Use directly or wrap in your own overrides |

### `onAction`

Called when the user interacts with a form or button group:

```js
{ type: 'button', value: 'Track the package', component: 'buttons', text: '<segment source>' }
{ type: 'submit', values: { full_name: 'Ada', order_number: '48213' }, component: 'form', text: '<segment source>' }
```

Forms and button groups lock after one use so a reply can't be submitted twice.

### Overriding a component

```jsx
<Genuine text={reply} components={{ chart: MyChart }} />
```

Your component receives the same props as the default one (below), plus `text` (the raw segment) and `onAction`.

## Components

Each row shows what text the model tags as that type and the props the parser produces.

### `text`
Plain paragraphs. Supports `**bold**` and `*italic*` and `` `code` `` plus `[links](https://...)` and `#` headings.
Props: `{ text }`

### `list`
> Try these steps:
> 1. Restart your router
> 2. Forget the network and reconnect

Also inline: `The Team plan includes: SSO, priority support, and audit logs.`
Props: `{ title: string | null, ordered: boolean, items: string[] }`

### `table`
Markdown pipe tables or tab-separated rows. The first row is the header.
Props: `{ title: string | null, columns: string[], rows: string[][] }`

### `chart`
> Organic 42%, Paid ads 23%, Referral 20%, Social 15%.

Kind is picked automatically:
- `pie`: values are percentages summing to ~100
- `line`: every label is a time (month, weekday, quarter, year)
- `bar`: anything else

Suffixes `k`/`M`/`B` and `$ € £ %` units are understood.
Props: `{ title: string | null, kind: 'bar' | 'line' | 'pie', unit: string, points: { label, value }[] }`

### `form`
> Could you share your full name, email address and order number?

Input type is inferred from the label (email / tel / date / time / url / number / textarea) and falls back to text. `(optional)` marks a field optional. `(e.g. ...)` becomes the placeholder.
Props: `{ title: string | null, fields: { name, label, type, optional, placeholder }[] }`

### `buttons`
> Would you like me to track the package, change the delivery address, or cancel the order?

Options are split from the question. A yes/no question with no options gets `Yes` / `No`.
Props: `{ prompt: string | null, options: string[] }`

### `card`
> Hotel: The Harbor Inn
> Check-in: June 3
> Guests: 2

Key/value pairs. A line without a colon becomes the title.
Props: `{ title: string | null, pairs: { key, value }[] }`

### `alert`
> Note: refunds take up to 7 business days.

The variant comes from keywords. `error` matches words like failed or declined. `info` matches tip or fyi. `success` matches done or confirmed. Anything else is `warning`. A short `Label:` prefix becomes the title.
Props: `{ title: string | null, body: string, variant: 'warning' | 'error' | 'success' | 'info' }`

### `image`
> ![The new dashboard](https://example.com/dashboard.png)

A markdown image or a bare image URL on its own line. Alt text becomes the caption. It hides itself if the image fails to load. Note that the browser fetches the URL.
Props: `{ src: string, alt: string }`

### `link`
> Setup guide: https://docs.example.com/setup

A URL on its own line (bare or `<url>` or `[label](url)`). A leading `Label:` becomes the title. Without one the host is used.
Props: `{ url: string, host: string, title: string | null }`

### `email`
> Billing: billing@example.com

An address (or `mailto:` link) on its own line.
Props: `{ address: string, label: string | null }`

### `social`
> https://x.com/example
> https://github.com/example

Profile URLs for X / GitHub / LinkedIn / Instagram / YouTube / TikTok / Facebook / Threads / Bluesky. Consecutive lines merge into one group.
Props: `{ links: { platform, url, handle }[] }`

Only `http(s)` and `mailto:` targets are ever rendered as links.

### `code`
> ```` ```js ````
> `const res = await fetch(url)`
> ```` ``` ````

A fenced code block. Renders with the language label and a copy button. An unclosed fence still renders and that is what makes code stream in place.
Props: `{ lang: string | null, code: string }`

### `json`
A ```` ```json ```` fence (or an unlabeled fence) whose body parses. A bare `{...}` / `[...]` block at the start of a line works too. Renders as a collapsible tree open two levels deep with a copy button.
Props: `{ value: any }`

## Theming

All styles live in `genuine.css` and use shadcn/ui-style tokens as HSL channels on `.gn-root`:

```css
.gn-root {
  --gn-primary: 197 100% 56%;
  --gn-radius: 1rem;
}
```

Dark mode: add `.dark` (or `data-theme="dark"`) on any ancestor. Every element has a `.gn-*` class. Each block is wrapped in `.gn-block.gn-block-<type>` for per-type spacing.

## Working on the library

| File | Responsibility |
| --- | --- |
| `genuine-react/src/model.js` | Tokenizer and weight loading. CNN forward pass and segmentation |
| `genuine-react/src/parse.js` | One parser per component type with a text fallback |
| `genuine-react/src/components.jsx` | Default renderers |
| `genuine-react/src/genuine.css` | Tokens and styles |
| `model/genuine-model.json` | Trained weights written by `model/train.py`. Gitignored and never committed |
| `genuine-react/test.mjs` | Parser checks, plus JS vs torch parity when weights exist: `node test.mjs` |
| `genuine-react/eval.mjs` | Accuracy on held-out replies (needs weights and `model/data/val.jsonl`) |
| `model/examples/*.txt` | Labeled replies, hand-written or from `datagen.py generate` (gitignored) |
| `model/datagen.py` | `generate` writes training replies via the Claude API. `build` makes train/val samples |
| `model/train.py` | Trains the CNN and exports `model/genuine-model.json` |

Changing the tokenizer or the label set means changing `datagen.py` and `model.js` together. Then retrain.
