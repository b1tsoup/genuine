import base64
import json
import random
from pathlib import Path

import torch
import torch.nn as nn

from datagen import LABELS, N_BUCKETS, featurize, tokenize

ROOT = Path(__file__).parent
EXPORT = ROOT / "genuine-model.json"
DILATIONS = [1, 2, 4, 8, 16]
EMB, SHAPE_EMB, HID, K = 32, 8, 64, 5
WORD_DROP = 0.15
N_TAGS = 2 * len(LABELS)


def encode(sample):
    toks = tokenize(sample["text"])
    ids, shapes = featurize(toks)
    tags, si, prev = [], 0, 1
    spans = sample["spans"]
    for _, start, _ in toks:
        while si < len(spans) and start >= spans[si][1]:
            si += 1
        if si < len(spans) and spans[si][0] <= start:
            lab = LABELS.index(spans[si][2])
            prev = 2 * lab + 1
            tags.append(2 * lab if start == spans[si][0] else prev)
        else:
            tags.append(prev)
    return ids, shapes, tags


class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.emb = nn.Embedding(N_BUCKETS, EMB)
        self.semb = nn.Embedding(6, SHAPE_EMB)
        self.convs = nn.ModuleList(
            nn.Conv1d(EMB + SHAPE_EMB if i == 0 else HID, HID, K, padding=d * (K // 2), dilation=d)
            for i, d in enumerate(DILATIONS))
        self.out = nn.Conv1d(HID, N_TAGS, 1)
        self.drop = nn.Dropout(0.25)

    def forward(self, ids, shapes, mask):
        m = mask.unsqueeze(1)
        x = torch.cat([self.emb(ids), self.semb(shapes)], -1).transpose(1, 2) * m
        for i, conv in enumerate(self.convs):
            h = torch.relu(conv(x)) * m
            x = h if i == 0 else x + h
            x = self.drop(x)
        return self.out(x)


def batches(data, bs, shuffle):
    idx = list(range(len(data)))
    if shuffle:
        random.shuffle(idx)
    for i in range(0, len(idx), bs):
        chunk = [data[j] for j in idx[i:i + bs]]
        L = max(len(c[0]) for c in chunk)
        ids = torch.zeros(len(chunk), L, dtype=torch.long)
        shp = torch.zeros(len(chunk), L, dtype=torch.long)
        tag = torch.full((len(chunk), L), -100, dtype=torch.long)
        for r, (a, b, c) in enumerate(chunk):
            ids[r, :len(a)], shp[r, :len(a)], tag[r, :len(a)] = torch.tensor(a), torch.tensor(b), torch.tensor(c)
        yield ids, shp, tag, (tag != -100).float()


def load(name):
    with open(ROOT / "data" / name, encoding="utf-8") as f:
        return [encode(json.loads(line)) for line in f]


def evaluate(net, data):
    net.eval()
    tok_ok = tok_n = seq_ok = 0
    with torch.no_grad():
        for ids, shp, tag, mask in batches(data, 256, False):
            pred = net(ids, shp, mask).argmax(1)
            valid = tag != -100
            tok_ok += ((pred == tag) & valid).sum().item()
            tok_n += valid.sum().item()
            seq_ok += (((pred == tag) | ~valid).all(1)).sum().item()
    net.train()
    return tok_ok / tok_n, seq_ok / len(data)


def export(net):
    tensors = {}
    for k, v in net.state_dict().items():
        a = v.detach().float().contiguous().numpy()
        tensors[k] = {"shape": list(a.shape), "data": base64.b64encode(a.astype("<f4").tobytes()).decode()}
    cfg = {"labels": LABELS, "buckets": N_BUCKETS, "dilations": DILATIONS, "kernel": K, "tensors": tensors}
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text(json.dumps(cfg))
    print(f"exported {EXPORT} ({EXPORT.stat().st_size // 1024} KB)")


def dump_parity(net, texts):
    net.eval()
    rows = []
    with torch.no_grad():
        for t in texts:
            ids, shp = featurize(tokenize(t))
            if ids:
                x = lambda a: torch.tensor([a])
                tags = net(x(ids), x(shp), torch.ones(1, len(ids))).argmax(1)[0].tolist()
                rows.append({"text": t, "tags": tags})
    (ROOT / "parity.json").write_text(json.dumps(rows))


def main(epochs=3):
    random.seed(0)
    torch.manual_seed(0)
    train, val = load("train.jsonl"), load("val.jsonl")
    print(f"{len(train)} train / {len(val)} val samples")
    net = Net()
    opt = torch.optim.AdamW(net.parameters(), lr=3e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, 3e-3, total_steps=epochs * ((len(train) + 63) // 64))
    lossf = nn.CrossEntropyLoss(ignore_index=-100)
    for ep in range(epochs):
        total = 0
        for step, (ids, shp, tag, mask) in enumerate(batches(train, 64, True)):
            ids = torch.where(torch.rand(ids.shape) < WORD_DROP, torch.randint_like(ids, N_BUCKETS), ids)
            loss = lossf(net(ids, shp, mask), tag)
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            total += loss.item()
        tok, seq = evaluate(net, val)
        print(f"epoch {ep + 1}: loss {total / (step + 1):.4f}  val token acc {tok:.4f}  val exact-sample {seq:.4f}")
    export(net)
    with open(ROOT / "data" / "val.jsonl", encoding="utf-8") as f:
        dump_parity(net, [json.loads(l)["text"] for l in f][:50])


if __name__ == "__main__":
    main()
