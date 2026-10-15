import argparse
import json
import random
import re
import time
from pathlib import Path

LABELS = ["text", "list", "table", "chart", "form", "buttons", "card", "alert"]
N_BUCKETS = 4096
TOKEN_RE = re.compile(r"\n|[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+(?:[.,:][0-9]+)*|[^\sA-Za-z0-9]")

ROOT = Path(__file__).parent
EXAMPLES = ROOT / "examples"
DATA = ROOT / "data"
RAW = DATA / "raw"
GENERATED = EXAMPLES / "claude_generated.txt"
JOINS = {"paragraph": "\n\n", "line": "\n", "inline": " "}
SEGMENT_RE = re.compile(r"^@(\w+)(?:[ \t]+(line|inline))?[ \t]*\n(.*?)(?=^@\w+(?:[ \t]+(?:line|inline))?[ \t]*$|\Z)",
                        re.M | re.S)


def fnv1a(s):
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h


def shape(t):
    c = t[0]
    if t == "\n":
        return 0
    if "0" <= c <= "9":
        return 1
    if "A" <= c <= "Z":
        return 3 if len(t) > 1 and all("A" <= ch <= "Z" for ch in t) else 2
    if "a" <= c <= "z":
        return 4
    return 5


def tokenize(text):
    return [(m.group(), m.start(), m.end()) for m in TOKEN_RE.finditer(text)]


def featurize(toks):
    return [fnv1a(t.lower()) % N_BUCKETS for t, _, _ in toks], [shape(t) for t, _, _ in toks]


def load_examples():
    replies = []
    for f in sorted(EXAMPLES.glob("*.txt")):
        for block in re.split(r"^===[ \t]*$", f.read_text(encoding="utf-8"), flags=re.M):
            segs = []
            for label, join, text in SEGMENT_RE.findall(block):
                if label not in LABELS:
                    raise SystemExit(f"{f.name}: unknown label @{label}")
                text = text.strip()
                if not text:
                    continue
                if join == "inline" and ("\n" in text or (segs and "\n" in segs[-1]["text"])):
                    join = "line"
                segs.append({"label": label, "join": (join if segs else "") or "paragraph", "text": text})
            if segs:
                replies.append(segs)
    return replies


def assemble(segs):
    text, spans = "", []
    for i, s in enumerate(segs):
        if i:
            text += JOINS[s["join"]]
        spans.append([len(text), len(text) + len(s["text"]), s["label"]])
        text += s["text"]
    return {"text": text, "spans": spans}


def recombine(pool):
    segs = []
    for rep in random.sample(pool, random.choice([1, 2, 2, 3])):
        a = random.randrange(len(rep))
        segs += [dict(s) for s in rep[a:a + random.randint(1, 4)]]
    for i, s in enumerate(segs):
        inline_ok = i and "\n" not in s["text"] and "\n" not in segs[i - 1]["text"]
        s["join"] = random.choice(["paragraph", "paragraph", "line"] + (["inline"] if inline_ok else []))
    return segs


LABEL_SPEC = """Component labels (the UI library renders each one as a widget):
- text: ordinary prose. Greetings, explanations, sign-offs, headings, and intro lines such as "Here are your options:" are text. A sentence that merely mentions a number or a choice in passing is still text.
- list: an enumeration of items, steps, features or tips (bulleted, numbered, or an inline "includes: a, b, and c").
- table: tabular data, normally a markdown pipe table with a header row.
- chart: a numeric series a chart could plot: several comparable labels each with a value (sales per month, share per category), as lines or inline prose.
- form: a request for the user to supply information (name, email, order number, dates, description), either as a sentence or as a list of fields.
- buttons: the assistant offers a choice of next actions or options, or asks a yes/no confirmation ("Would you like me to refund or replace it?", "Should I send it now?"). Bulleted options after such a question belong to the same buttons segment.
- card: a single record shown as key/value details (an order, booking, account, ticket, flight, invoice), optionally with a title line.
- alert: a short notice that stands out: warning, error, success, tip or disclaimer ("Note: this cannot be undone.", "Your payment failed.")."""

DOMAINS_PROMPT = """List {n} distinct domains where companies deploy AI chat assistants (customer support, internal tools, sales, personal assistants, education, finance, healthcare admin, travel, developer tools, government services, and so on). Be specific and varied: "regional airline rebooking desk" is better than "travel". Cover consumer and B2B, large and niche."""

SCENARIOS_PROMPT = """Domain: {domain}

Write {n} realistic, varied messages that users send to an AI assistant in this domain. Mix short and long, casual and formal, simple questions and multi-part requests. Include requests whose ideal answer needs data (numbers, records, comparisons), needs information from the user, offers choices, gives step-by-step help, or is just a plain conversational answer."""

REPLIES_PROMPT = """You are generating training data for a model that splits assistant replies into UI components.

{spec}

For each user message below, write the reply a capable assistant would give, then return it as an ordered list of segments. Concatenating the segments with their joins must reproduce the reply exactly.

Rules:
- Each segment has one label and the exact text of that part of the reply. Split wherever the component type changes, even mid-paragraph (e.g. a text sentence followed by a buttons question on the same line). Only split at sentence or line boundaries.
- "join" is how the segment attaches to the previous one: "paragraph" (blank line), "line" (single newline) or "inline" (same line, one space). The first segment's join is ignored. Inline segments must not contain newlines.
- Write like a real assistant: markdown is fine (bold, bullets, numbered lists, pipe tables, headings). Invent concrete plausible details (names, IDs, prices, dates, metrics). Never use emojis.
- Vary length and structure: some replies are a single text segment, some use one component, some combine three to six. Vary formatting styles (bullet characters, "Key: value" vs "**Key:** value", inline vs block).
- Include hard cases: text mentioning numbers or options that is still text, lists that are not forms, several components packed into one paragraph, two adjacent components of different types.

User messages:
{messages}"""


def obj(props):
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


def str_list(key):
    return obj({key: {"type": "array", "items": {"type": "string"}}})


REPLIES_SCHEMA = obj({"replies": {"type": "array", "items": obj({
    "segments": {"type": "array", "items": obj({
        "label": {"type": "string", "enum": LABELS},
        "join": {"type": "string", "enum": list(JOINS)},
        "text": {"type": "string"},
    })},
})}})


def run_batch(client, model, prompts, schema):
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    out = [None] * len(prompts)
    for off in range(0, len(prompts), 10000):
        chunk = prompts[off:off + 10000]
        batch = client.messages.batches.create(requests=[
            Request(custom_id=str(off + i), params=MessageCreateParamsNonStreaming(
                model=model, max_tokens=16000,
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
                messages=[{"role": "user", "content": p}]))
            for i, p in enumerate(chunk)])
        print(f"  batch {batch.id}: {len(chunk)} requests")
        while (batch := client.messages.batches.retrieve(batch.id)).processing_status != "ended":
            c = batch.request_counts
            print(f"  ... processing {c.processing}, succeeded {c.succeeded}, errored {c.errored}")
            time.sleep(30)
        for r in client.messages.batches.results(batch.id):
            if r.result.type != "succeeded" or r.result.message.stop_reason != "end_turn":
                continue
            text = next((b.text for b in r.result.message.content if b.type == "text"), "")
            try:
                out[int(r.custom_id)] = json.loads(text)
            except json.JSONDecodeError:
                pass
    print(f"  {sum(o is not None for o in out)}/{len(prompts)} succeeded")
    return out


def cached(path, make):
    if path.exists():
        return [json.loads(l) for l in path.open(encoding="utf-8")]
    rows = make()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return rows


MARKER_RE = re.compile(r"^(?:===|@\w+(?:[ \t]+(?:line|inline))?)[ \t]*$", re.M)


def to_example_text(replies):
    blocks = []
    for segs in replies:
        if any(MARKER_RE.search(s["text"]) or not s["text"].strip() for s in segs):
            continue
        lines = []
        for i, s in enumerate(segs):
            join = "" if i == 0 or s["join"] == "paragraph" else " " + s["join"]
            lines.append(f"@{s['label']}{join}\n{s['text'].strip()}")
        blocks.append("\n".join(lines))
    return "\n===\n".join(blocks) + "\n", len(blocks)


def generate(args):
    import anthropic

    client = anthropic.Anthropic()
    print("1/3 domains")
    domains = cached(RAW / "domains.jsonl", lambda: [
        {"domain": d} for d in run_batch(client, args.model, [DOMAINS_PROMPT.format(n=args.domains)],
                                         str_list("domains"))[0]["domains"]])

    print(f"2/3 user messages for {len(domains)} domains")

    def make_scenarios():
        res = run_batch(client, args.model, [SCENARIOS_PROMPT.format(domain=d["domain"], n=args.scenarios)
                                             for d in domains], str_list("messages"))
        return [{"domain": d["domain"], "message": m} for d, r in zip(domains, res) if r for m in r["messages"]]
    scenarios = cached(RAW / "scenarios.jsonl", make_scenarios)

    print(f"3/3 replies for {len(scenarios)} messages")

    def make_replies():
        random.seed(0)
        random.shuffle(scenarios)
        groups = [scenarios[i:i + args.per_request] for i in range(0, len(scenarios), args.per_request)]
        prompts = [REPLIES_PROMPT.format(spec=LABEL_SPEC, messages="\n".join(
            f"{j + 1}. [{s['domain']}] {s['message']}" for j, s in enumerate(g))) for g in groups]
        res = run_batch(client, args.model, prompts, REPLIES_SCHEMA)
        return [{"segments": rep["segments"]} for r in res if r for rep in r["replies"]]
    replies = cached(RAW / "replies.jsonl", make_replies)

    text, n = to_example_text([r["segments"] for r in replies])
    EXAMPLES.mkdir(exist_ok=True)
    GENERATED.write_text(text, encoding="utf-8")
    print(f"wrote {n} replies to {GENERATED}")


def build(args):
    random.seed(0)
    replies = load_examples()
    if len(replies) < 2:
        raise SystemExit(f"need examples in {EXAMPLES}: write some, or run `python datagen.py generate`")
    random.shuffle(replies)
    n_val = max(1, len(replies) // 10)
    val, train = replies[:n_val], replies[n_val:]
    samples = [assemble(r) for r in train]
    samples += [assemble(recombine(train)) for _ in range(max(0, args.samples - len(samples)))]
    DATA.mkdir(exist_ok=True)
    for name, rows in (("train.jsonl", samples), ("val.jsonl", [assemble(r) for r in val])):
        with (DATA / name).open("w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    counts = {l: sum(s["label"] == l for r in replies for s in r) for l in LABELS}
    print(f"{len(replies)} examples {counts}")
    print(f"{len(samples)} train samples, {len(val)} held-out val replies")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd")
    g = sub.add_parser("generate")
    g.add_argument("--model", default="claude-opus-5-5")
    g.add_argument("--domains", type=int, default=150)
    g.add_argument("--scenarios", type=int, default=20)
    g.add_argument("--per-request", type=int, default=6)
    b = sub.add_parser("build")
    b.add_argument("--samples", type=int, default=100000)
    a = ap.parse_args()
    if a.cmd == "generate":
        import anthropic

        try:
            generate(a)
        except (TypeError, anthropic.AuthenticationError) as e:
            if isinstance(e, TypeError) and "authentication" not in str(e):
                raise
            raise SystemExit("No valid Anthropic credentials. Set ANTHROPIC_API_KEY (https://console.anthropic.com) and rerun.")
    else:
        build(argparse.Namespace(samples=getattr(a, "samples", 100000)))
