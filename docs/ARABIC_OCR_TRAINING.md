# Training a custom Arabic OCR model

End-to-end guide: prepare data locally, train a CRNN+CTC recogniser on Colab.

Everything here is free and open. No Mistral, no paid API.

**Scope.** This trains a *line recogniser* — it turns a cropped line image into
text. Line segmentation is handled separately by projection profiles (already
working, see [Step 2](#step-2--export-real-line-crops)), because this book's
layout is rigid enough not to need a neural detector.

---

## Why this is cheap for us

Three things that usually cost money or months are already free here:

| normally hard | why it isn't, here |
|---|---|
| line segmentation | rigid two-column layout — projection profiles cut ~90–100 clean lines/page |
| ground-truth text | we hold the entire Quran; synthetic renders have exact labels by construction |
| evaluation set | 52,408 rows already resolved to specific verses |

The baseline to beat on *this* book is **96.3%** row resolution (best-of-both
Mistral passes). The trained model's real value is on books with **no corpus to
check against** — الفروق اللغوية, and any Jabal volumes that arrive as scans —
where raw transcription quality *is* final quality.

---

## Step 0 — What you need

- Colab Pro (A100 or L4; T4 also works, just slower)
- This repo checked out locally with `.lexicon-cache/` populated
- ~30 min local prep, ~2 h GPU

---

## Step 1 — Build the corpus text and charset

```bash
python tools/lexicon/prepare_dataset.py --pages 13-796 --out dataset.zip
```

This writes, into `dataset.zip`:

| file | what it is |
|---|---|
| `corpus_lines.jsonl` | ~15.7k verse fragments, 3–9 words each, for synthetic rendering |
| `charset.json` | 84-character alphabet derived from that text |
| `real.jsonl` | manifest of real crops, each tagged `candidate` or `needs_review` |
| `images/*.png` | the real line crops |

Synthetic **images** are not in the zip — they are generated in Colab from
`corpus_lines.jsonl`. Uploading 200k PNGs would be slow and pointless when the
text they come from is two megabytes.

Expect ~250 MB for the full book (~56k crops). Put it on Drive rather than
uploading through the browser.

---

## Step 2 — Export real line crops

Already done by Step 1, but if you want to tune it:

```bash
python tools/lexicon/export_training_data.py --mode real --pages 13-796 --dpi 300
```

Segmentation is plain CV — no model:

```python
def find_line_bands(column, min_height=12, ink_frac=0.02):
    profile = column.sum(axis=1)              # ink per row
    on = profile > profile.max() * ink_frac
    bands, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_height:
                bands.append((start, i))
            start = None
    return bands
```

> **Do not train on `needs_review` labels.**
> We know which *verse* a row cites, but not which *fragment* the typesetter
> printed, nor how the numerals and surah name were spaced. The row↔band
> pairing is positional and drifts where headers or rules interrupt. Only rows
> whose OCR matches the corpus verse at ≥0.85 are marked `candidate`, and even
> those deserve a spot check.

---

## Step 3 — Colab setup

```python
!nvidia-smi
!pip -q install pymupdf pillow numpy torch torchvision editdistance
```

Get a period-appropriate font. **This matters more than any hyperparameter.**
The book is 1960s Naskh; Windows fonts look nothing like it, and that domain gap
will cap your accuracy no matter how long you train.

```python
!wget -q https://github.com/aliftype/amiri/releases/download/1.000/Amiri-1.000.zip
!unzip -oq Amiri-1.000.zip -d /content/fonts
!find /content/fonts -name "*.ttf"
```

Mount the dataset:

```python
from google.colab import drive
drive.mount('/content/drive')
!unzip -oq /content/drive/MyDrive/dataset.zip -d /content/data
!ls /content/data
```

---

## Step 4 — Generate synthetic lines in Colab

Pillow **cannot shape Arabic** without libraqm — it silently renders isolated
glyphs left-to-right, producing images that do not match their labels. That is a
poisoned dataset: it trains without error and fails inexplicably. Render through
PyMuPDF, which shapes correctly.

```python
import fitz, io, json, random, numpy as np
from pathlib import Path
from PIL import Image, ImageFilter

FONT_DIR = Path('/content/fonts')
FONTS = [p for p in FONT_DIR.rglob('*.ttf') if 'Amiri' in p.name]
OUT = Path('/content/synth'); (OUT / 'images').mkdir(parents=True, exist_ok=True)

CSS = """
@font-face {{ font-family: ar; src: url({file}); }}
* {{ font-family: ar; }}
body {{ direction: rtl; text-align: right; font-size: {size}px; color: #000; }}
"""

def render_line(text, font_path, size):
    doc = fitz.open()
    page = doc.new_page(width=1800, height=140)
    page.insert_htmlbox(
        fitz.Rect(10, 10, 1790, 130), f"<p>{text}</p>",
        css=CSS.format(file=font_path.name, size=size),
        archive=fitz.Archive(str(font_path.parent)), scale_low=0)
    pix = page.get_pixmap(dpi=300, colorspace=fitz.csGRAY)
    arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    doc.close()
    ink = 255 - arr
    rows, cols = np.where(ink.sum(1) > 0)[0], np.where(ink.sum(0) > 0)[0]
    if rows.size == 0 or cols.size == 0:
        return None
    p = 6
    return Image.fromarray(arr[max(0, rows[0]-p):rows[-1]+p,
                               max(0, cols[0]-p):cols[-1]+p])

def degrade(img, rng):
    """Imitate 1-bit thresholding at 310 dpi — the exact damage this scan has."""
    if rng.random() < 0.8:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.1)))
    a = np.asarray(img).astype(np.float32)
    a += np.random.normal(0, rng.uniform(4, 18), a.shape)
    if rng.random() < 0.75:                      # the hard threshold
        a = np.where(a > rng.uniform(120, 165), 255, 0)
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if rng.random() < 0.4:
        out = out.rotate(rng.uniform(-0.7, 0.7), resample=Image.BILINEAR, fillcolor=255)
    return out

H = 48
lines = [json.loads(l)['text'] for l in open('/content/data/corpus_lines.jsonl')]
rng = random.Random(0); np.random.seed(0)
records = []
N = 200_000
for i in range(N):
    text = rng.choice(lines)
    img = render_line(text, rng.choice(FONTS), rng.randint(26, 38))
    if img is None:
        continue
    img = degrade(img, rng)
    img = img.resize((max(8, int(img.width * H / img.height)), H), Image.LANCZOS)
    name = f's{i:07d}.png'
    img.save(OUT / 'images' / name)
    records.append({'image': f'images/{name}', 'text': text})
    if (i+1) % 10000 == 0:
        print(i+1, flush=True)

with open(OUT / 'synth.jsonl', 'w', encoding='utf-8') as f:
    for r in records:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')
print('synthetic lines:', len(records))
```

**Sanity-check before training.** A dataset that looks right and is labelled
wrong is the most expensive mistake available here:

```python
from IPython.display import display
for r in records[:5]:
    print(r['text'])
    display(Image.open(OUT / r['image']))
```

---

## Step 5 — The single most important detail

**CTC scans left-to-right. Arabic reads right-to-left.**

The visually-leftmost glyph is the *last* logical character. So the label fed to
CTC must be the **reversed** logical string, and predictions must be reversed
back at inference. Get this wrong and the model still trains, loss still falls,
and every output is mirrored.

```python
def encode(text, stoi):
    # reversed: image is scanned LTR, Arabic logical order is RTL
    return [stoi[c] for c in reversed(text) if c in stoi]

def decode(indices, itos):
    return ''.join(itos[i] for i in reversed(indices))
```

**Diacritics.** Start undiacritized. Combining marks share the same x-position as
their base letter, which CTC handles badly, and for verse identification you do
not need them — the corpus restores full vocalisation once the verse is known.

```python
import re
# Write these ranges as explicit code points, never as literal Arabic endpoints.
#
# `[ً-ٰ]` reads like "the diacritics" but CONTAINS the Arabic-Indic
# digits at U+0660-U+0669. Using it silently deletes every surah and ayah number
# from your labels: `سورة ٢٦` becomes `سورة`.
# The images still show the digits, so you train the model to ignore them and
# never see an error.
STRIP = re.compile(
    '['
    'ً-ٟ'   # fathatan .. marks -- stops before the digits at U+0660
    'ٰ'           # superscript alef
    'ۖ-ۭ'   # Quranic annotation marks
    'ـ'           # tatweel
    ']'
)
def normalise(t): return STRIP.sub('', t)
```

Verify the round-trip and the coverage **before** you train — this is cheap and
catches the failure mode that is otherwise invisible until inference:

```python
tests = ['سورة ٢٦ آية ١٧', 'القرآن آباءنا ٢٤٦ (٥) « »', 'يٰبَنِىٓ إِسْرٰءِيلَ']
for t in tests:
    n = normalise(t)
    assert decode(encode(n)) == n, (t, decode(encode(n)))

missing = {c for t in lines for c in normalise(t)} - set(stoi)
assert not missing, f'chars absent from charset: {sorted(missing)}'
print('charset OK')
```

> Building this guide, my own charset failed exactly this check twice: `آ` was
> missing (the corpus spells it `ءَا` in Uthmani orthography, so it never
> appeared in sampled text, while the printed book uses it constantly), and so
> was the maddah `ٓ`. Both would have produced a model structurally unable to
> read common glyphs, with no error message.

---

## Step 6 — Dataset and collate

```python
import torch, json
from torch.utils.data import Dataset, DataLoader

charset = json.load(open('/content/data/charset.json'))['charset']
charset = sorted({normalise(c) for c in charset if normalise(c)})
stoi = {c: i + 1 for i, c in enumerate(charset)}   # 0 = CTC blank
itos = {i + 1: c for i, c in enumerate(charset)}
NCLASS = len(charset) + 1
print('classes:', NCLASS)

class LineDS(Dataset):
    def __init__(self, root, manifest, height=48, max_w=1200):
        self.root, self.h, self.max_w = Path(root), height, max_w
        self.items = [json.loads(l) for l in open(manifest, encoding='utf-8')]
        self.items = [r for r in self.items if r.get('text')]
    def __len__(self): return len(self.items)
    def __getitem__(self, i):
        r = self.items[i]
        img = Image.open(self.root / r['image']).convert('L')
        if img.height != self.h:
            img = img.resize((max(8, int(img.width * self.h / img.height)), self.h),
                             Image.LANCZOS)
        if img.width > self.max_w:
            img = img.resize((self.max_w, self.h), Image.LANCZOS)
        x = torch.from_numpy(np.asarray(img, np.float32) / 255.0)
        x = (1.0 - x).unsqueeze(0)                 # ink = 1
        y = torch.tensor(encode(normalise(r['text']), stoi), dtype=torch.long)
        return x, y

def collate(batch):
    batch = [(x, y) for x, y in batch if len(y) > 0]
    widths = [x.shape[2] for x, _ in batch]
    W = max(widths)
    xs = torch.ones(len(batch), 1, batch[0][0].shape[1], W) * 0.0
    for i, (x, _) in enumerate(batch):
        xs[i, :, :, :x.shape[2]] = x
    ys = torch.cat([y for _, y in batch])
    y_lens = torch.tensor([len(y) for _, y in batch], dtype=torch.long)
    x_lens = torch.tensor([w // 4 for w in widths], dtype=torch.long)  # CNN downsamples 4x
    return xs, ys, x_lens, y_lens
```

---

## Step 7 — Model

A CRNN. For a single typeface this beats any general-purpose OCR, and it is
small enough to train in an hour.

```python
import torch.nn as nn

class CRNN(nn.Module):
    def __init__(self, nclass, nc=1):
        super().__init__()
        def blk(i, o, pool):
            layers = [nn.Conv2d(i, o, 3, 1, 1), nn.BatchNorm2d(o), nn.ReLU(True)]
            if pool: layers.append(nn.MaxPool2d(pool))
            return layers
        self.cnn = nn.Sequential(
            *blk(nc,   64, (2, 2)),     # 48 -> 24,  W/2
            *blk(64,  128, (2, 2)),     # 24 -> 12,  W/4
            *blk(128, 256, None),
            *blk(256, 256, (2, 1)),     # 12 -> 6,   W/4
            *blk(256, 512, None),
            *blk(512, 512, (2, 1)),     # 6  -> 3,   W/4
        )
        self.rnn = nn.LSTM(512, 256, num_layers=2, bidirectional=True,
                           batch_first=False, dropout=0.1)
        self.fc = nn.Linear(512, nclass)

    def forward(self, x):
        f = self.cnn(x)                 # B,C,H',W'
        f = f.mean(dim=2)               # collapse height -> B,C,W'
        f = f.permute(2, 0, 1)          # W',B,C  (time-major for CTC)
        f, _ = self.rnn(f)
        return self.fc(f)               # W',B,nclass
```

Height is collapsed by mean-pooling rather than a fixed-size conv, so the model
tolerates small height variation without shape errors.

---

## Step 8 — Train

```python
import editdistance, time

dev = 'cuda'
model = CRNN(NCLASS).to(dev)
opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
scaler = torch.amp.GradScaler('cuda')
ctc = nn.CTCLoss(blank=0, zero_infinity=True)

ds = LineDS('/content/synth', '/content/synth/synth.jsonl')
n_val = max(500, len(ds) // 50)
train_ds, val_ds = torch.utils.data.random_split(
    ds, [len(ds) - n_val, n_val], generator=torch.Generator().manual_seed(0))
train_dl = DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=2,
                      collate_fn=collate, pin_memory=True, drop_last=True)
val_dl = DataLoader(val_ds, batch_size=64, collate_fn=collate, num_workers=2)

def greedy(logits):
    """CTC greedy decode -> list of index lists."""
    idx = logits.argmax(2).permute(1, 0).cpu().numpy()   # B,T
    out = []
    for seq in idx:
        prev, cur = 0, []
        for k in seq:
            if k != prev and k != 0:
                cur.append(int(k))
            prev = k
        out.append(cur)
    return out

@torch.no_grad()
def cer(dl, limit=40):
    model.eval(); num = den = 0
    for b, (x, y, xl, yl) in enumerate(dl):
        if b >= limit: break
        with torch.autocast('cuda', dtype=torch.float16):
            log = model(x.to(dev))
        preds = greedy(log.float())
        off = 0
        for p, L in zip(preds, yl.tolist()):
            gt = y[off:off+L].tolist(); off += L
            num += editdistance.eval(p, gt); den += len(gt)
    model.train()
    return num / max(den, 1)

EPOCHS = 12
for ep in range(EPOCHS):
    t0 = time.time()
    for i, (x, y, xl, yl) in enumerate(train_dl):
        x = x.to(dev, non_blocking=True)
        with torch.autocast('cuda', dtype=torch.float16):
            log = model(x)
        lp = log.float().log_softmax(2)
        loss = ctc(lp, y, xl.clamp(max=lp.shape[0]), yl)
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        scaler.step(opt); scaler.update()
        if i % 200 == 0:
            print(f'ep{ep} it{i} loss {loss.item():.3f}', flush=True)
    print(f'== epoch {ep}  val CER {cer(val_dl):.4f}  ({time.time()-t0:.0f}s)')
    torch.save({'model': model.state_dict(), 'charset': charset},
               f'/content/drive/MyDrive/crnn_ep{ep}.pt')
```

---

## Step 9 — Fine-tune on real crops

Synthetic CER will look excellent and **mean very little** — it measures how
well the model reads its own renderer. The number that matters is CER on real
crops from the scan.

```python
real = [json.loads(l) for l in open('/content/data/real.jsonl', encoding='utf-8')]
verified = [r for r in real if r['label_status'] == 'candidate' and r.get('verse_text')]
print('usable real lines:', len(verified))
```

> Hand-check a few hundred of these before fine-tuning. This is the step that
> actually determines final accuracy, and it is the one step no script can do
> for you. Budget a few hours.

Then fine-tune at a lower learning rate (`3e-5`), 2–3 epochs, mixing ~20%
synthetic back in so the model does not forget what it learned.

---

## Step 10 — Inference

```python
@torch.no_grad()
def read_line(path):
    img = Image.open(path).convert('L')
    img = img.resize((max(8, int(img.width * 48 / img.height)), 48), Image.LANCZOS)
    x = torch.from_numpy(np.asarray(img, np.float32) / 255.0)
    x = (1.0 - x).unsqueeze(0).unsqueeze(0).to(dev)
    with torch.autocast('cuda', dtype=torch.float16):
        log = model(x)
    return decode(greedy(log.float())[0], itos)    # reversed back to logical order
```

---

## What will actually determine success

Ranked by impact, from what the pipeline work so far has shown:

1. **Font realism.** Amiri over any Windows face. If you can find a scan-matched
   1960s Naskh, better still.
2. **Degradation realism.** The hard threshold in `degrade()` matters more than
   blur or noise — 1-bit conversion is what destroyed the strokes.
3. **Honest evaluation.** Real-crop CER only. Synthetic CER flatters.
4. **Label quality on the real set.** A few hundred verified lines beat tens of
   thousands of auto-aligned guesses.
5. Architecture. Least important — CRNN is sufficient for one typeface.

## When to stop

If real-crop CER plateaus above ~10%, the problem is data, not the model —
revisit the font and degradation before touching hyperparameters.

For *this* book, remember the model has to beat **96.3% row resolution** to be
worth deploying, because corpus substitution already repairs OCR errors. For
books with no corpus, any improvement is real improvement.
