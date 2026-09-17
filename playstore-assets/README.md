# Ante — Google Play Store assets

All assets use Ante's real UI, colors, and copy. Regenerate any of them by editing
the matching file in `_build/sources/` and re-running the snapshot pipeline (see bottom).

## Files & Play Console slots

| File | Size | Play Console slot | Notes |
|---|---|---|---|
| `feature-graphic.png` | 1024 × 500 | **Feature graphic** (required) | Shown at the top of your listing & in promos |
| `app-icon-512.png` | 512 × 512 | **App icon** (required) | 32-bit PNG; Google applies the rounded mask |
| `01-home.png` | 1080 × 1920 | Phone screenshot | Dashboard — "Every session, in one place." |
| `02-tracker.png` | 1080 × 1920 | Phone screenshot | Live tracking — "Log every hand as you play." |
| `03-saved.png` | 1080 × 1920 | Phone screenshot | Session summary — "Know exactly where you stand." |
| `04-insights.png` | 1080 × 1920 | Phone screenshot | Analytics — "See which game actually pays." |
| `05-accuracy.png` | 1080 × 1920 | Phone screenshot | Blackjack — "Every hand graded vs. basic strategy." |
| `06-leaks.png` | 1080 × 1920 | Phone screenshot | Leak detection — "It calls out how you really play." |

## Play Store requirements (met)

- **Feature graphic:** exactly 1024 × 500, PNG/JPEG, no alpha needed. ✅
- **App icon:** 512 × 512, 32-bit PNG. ✅
- **Phone screenshots:** PNG/JPEG, 320–3840 px per side, aspect ratio between 1:2 and 2:1.
  These are 1080 × 1920 (9:16). You need **at least 2**; up to 8. Six are provided. ✅

## Not included (Google may ask for these separately)

- 7-inch and 10-inch **tablet screenshots** (only if you publish for tablets).
- A **promo/preview video** — you already have `brag-output/brag.mp4` (37s); upload it as a
  YouTube link in the "Video" field if you want one.
- Short description (80 chars) and full description (4000 chars) — copy is in `store-copy.txt`.

## Regenerating

From `playstore-assets/_build/` (with Node + ffmpeg on PATH):

```bash
cp sources/<name>.html index.html
npx hyperframes snapshot --at 0.1
# output lands in snapshots/ — copy it up to ../<name>.png
```

Sizes come from each source file's `data-width` / `data-height`.
