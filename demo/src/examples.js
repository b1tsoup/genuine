export const EXAMPLES = [
  {
    id: 'tracking',
    label: 'Order tracking',
    text: `Good news, your order is on its way.

**Order #48213**
Status: In transit
Carrier: UPS
Items: 2 x Wireless Earbuds
Total: $89.98
Estimated delivery: Thursday, March 14

Would you like me to track the package, change the delivery address, or cancel the order?`,
  },
  {
    id: 'refund',
    label: 'Refund request',
    text: `I'm sorry your blender arrived cracked. That's not the experience we want for you.

To start the refund, could you share your full name, the email on your order, your order number and a short description of the damage?

Note: refunds go back to the original payment method and can take up to 7 business days to appear.`,
  },
  {
    id: 'metrics',
    label: 'Weekly metrics',
    text: `Here's your weekly summary. Signups grew every month this quarter:

- January: 1,240
- February: 1,610
- March: 2,050
- April: 2,380
- May: 2,900

Revenue by plan: Starter $12.4k, Team $38.9k, Enterprise $61.2k.

Traffic by channel: Organic 42%, Paid ads 23%, Referral 20%, Social 15%.

Tip: paid ads converted twice as well on weekends, so it may be worth shifting budget there.`,
  },
  {
    id: 'api',
    label: 'API debugging',
    text: `The 401 means the request is missing the Authorization header. Add your key like this:

\`\`\`js
const res = await fetch('https://api.example.com/v1/orders/48213', {
  headers: { Authorization: \`Bearer \${process.env.API_KEY}\` },
})
const order = await res.json()
\`\`\`

A successful response looks like this:

\`\`\`json
{
  "id": "ord_48213",
  "status": "in_transit",
  "total": 89.98,
  "items": [{ "sku": "EB-200", "qty": 2 }],
  "customer": { "name": "Ada Lovelace", "email": "ada@example.com" }
}
\`\`\`

You can find every field in the reference:
Orders API: https://docs.example.com/api/orders`,
  },
  {
    id: 'travel',
    label: 'Trip planning',
    text: `Here's the hotel I'd recommend for your Lisbon trip:

![Rooftop terrace overlooking the city](https://picsum.photos/id/1040/960/540.jpg)

**Casa do Rio**
Neighborhood: Alfama
Price: $184 / night
Rating: 4.8 (1,920 reviews)
Check-in: June 3

Heads up: rooms with a river view sell out quickly in June.

Should I book it, show similar hotels, or compare prices across dates?`,
  },
  {
    id: 'plans',
    label: 'Plan comparison',
    text: `Here's how the plans compare:

| Plan | Price | Seats | Storage | Support |
| --- | --- | --- | --- | --- |
| Starter | $9/mo | 1 | 10 GB | Email |
| Team | $29/mo | 10 | 100 GB | Priority |
| Enterprise | Custom | Unlimited | 1 TB | Dedicated |

The Team plan also includes: SSO, audit logs, and usage analytics.

Which plan would you like: Starter, Team, or Enterprise?`,
  },
  {
    id: 'wifi',
    label: 'Troubleshooting',
    text: `Sorry you're having trouble connecting. Let's try these steps in order:

1. Restart your router and wait 60 seconds
2. Forget the network on your device and reconnect
3. Update your device's operating system
4. Move closer to the router to rule out a weak signal

Warning: a factory reset erases your network name and password, so only do it as a last resort.

Did that fix it, or should I open a support ticket?`,
  },
  {
    id: 'contact',
    label: 'Contact',
    text: `Happy to help! You can reach the right team directly:

Sales: sales@example.com
Support: support@example.com

The full setup guide is here:
Setup guide: https://docs.example.com/setup

Follow us for product updates:
https://x.com/example
https://github.com/example
https://www.linkedin.com/company/example`,
  },
]

export const GALLERY = [
  { type: 'form', text: `To start a refund, could you share your full name, email address and order number?` },
  { type: 'buttons', text: `Would you like me to track the package, change the delivery address, or cancel the order?` },
  { type: 'chart', text: `Traffic by channel: Organic 42%, Paid ads 23%, Referral 20%, Social 15%.` },
  { type: 'table', text: `| Plan | Price | Seats |\n| --- | --- | --- |\n| Starter | $9/mo | 1 |\n| Team | $29/mo | 10 |` },
  { type: 'card', text: `**Casa do Rio**\nNeighborhood: Alfama\nPrice: $184 / night\nCheck-in: June 3` },
  { type: 'list', text: `Try these steps:\n\n1. Restart your router\n2. Forget the network and reconnect\n3. Update your device's OS` },
  { type: 'alert', text: `Note: refunds can take up to 7 business days to appear on your statement.` },
  { type: 'code', text: '```js\nconst res = await fetch(url, {\n  headers: { Authorization: `Bearer ${key}` },\n})\n```' },
  { type: 'json', text: '```json\n{ "id": "ord_48213", "status": "in_transit", "items": [{ "sku": "EB-200", "qty": 2 }] }\n```' },
  { type: 'image', text: `![Mountain lake at dawn](https://picsum.photos/id/1036/960/540.jpg)` },
  { type: 'link', text: `Setup guide: https://docs.example.com/setup` },
  { type: 'email', text: `Billing: billing@example.com` },
  { type: 'social', text: `https://x.com/example\nhttps://github.com/example\nhttps://www.linkedin.com/company/example\nhttps://www.youtube.com/@example` },
  { type: 'text', text: `Thanks for your patience! Your order **shipped today**. Questions? Write to help@example.com.` },
]

export const INSTALL = [
  { lang: 'bash', code: `cp -r genuine/genuine-react/src src/genuine
cp genuine/model/genuine-model.json src/genuine/` },
  {
    lang: 'jsx',
    code: `import { Genuine, setModel } from './genuine'
import './genuine/genuine.css'
import weights from './genuine/genuine-model.json'

setModel(weights)

export function Message({ reply }) {
  return <Genuine text={reply} onAction={(e) => send(e)} />
}`,
  },
]

export const TRAIN = [
  {
    title: '1. Set up Python',
    desc: 'Python 3.10+. Training runs on CPU. No GPU needed.',
    lang: 'bash',
    code: `cd genuine/model
python -m venv .venv               # python3 on macOS/Linux
source .venv/bin/activate          # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt`,
  },
  {
    title: '2. Generate training data with Claude',
    desc: 'Claude lists domains and writes user messages for each. Then it writes labeled replies. It uses the Message Batches API (half price and usually done within an hour). Each stage is cached in data/raw/ so a rerun resumes. Defaults produce about 3000 replies in examples/claude_generated.txt. Options: --model --domains --scenarios --per-request.',
    lang: 'bash',
    code: `export ANTHROPIC_API_KEY=sk-ant-...
python datagen.py generate`,
  },
  {
    title: 'Or write examples by hand',
    desc: 'Any .txt file in model/examples/ is training data. @label starts a segment. An optional line or inline says how it attaches to the previous one (default is a blank line). === separates replies. Labels: text list table chart form buttons card alert. Mix hand-written files with generated ones freely.',
    lang: 'text',
    code: `@text
I'm sorry the blender arrived damaged.
@form inline
Could you share your full name and order number?
@alert inline
Note: refunds can take up to 7 business days.
===
@buttons
Would you like a refund or a replacement?`,
  },
  {
    title: '3. Build and train',
    desc: 'build holds out 10% of replies for validation and expands the rest into 100k samples by recombining real segments. train takes about 10 minutes on a laptop CPU and writes model/genuine-model.json.',
    lang: 'bash',
    code: `python datagen.py build
python train.py`,
  },
  {
    title: '4. Check it',
    desc: 'test.mjs checks the browser inference matches PyTorch exactly. eval.mjs scores segmentation on the held-out replies and lists the most common confusions. When a reply is misread add it and a few variations to model/examples/. Then rebuild and retrain.',
    lang: 'bash',
    code: `cd ../genuine-react
node test.mjs
node eval.mjs`,
  },
  {
    title: '5. Use it',
    desc: 'Copy the weights next to the library and call setModel once at startup (see Install). This demo picks up model/genuine-model.json automatically. Just reload the page.',
    lang: 'bash',
    code: `cp genuine/model/genuine-model.json src/genuine/`,
  },
]
