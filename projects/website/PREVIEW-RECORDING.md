# Feature preview videos — recording guide, storyboard & demo data

The mega-menu and feature-page heroes each show a short **muted, autoplay, looping**
clip of the real app. This is the plan to record them.

- **14 clips total**: 7 features × 2 languages (EN + RO), because the app UI *and* the
  demo content differ per language.
- You record locally (just the screen, no camera, no audio), drop the files in
  `projects/website/public/videos/`, and they light up with no code change once the
  paths are wired (see §5).

> Note: the live tool comparison couldn't be web-searched (session limit). Recommendations
> below are from experience, not a fresh 2026 roundup — sanity-check pricing before buying.

---

## 1. Video spec (record to these exactly)

| Property | Value | Why |
|---|---|---|
| Aspect ratio | **16:9** | Works in both slots. The hero demo is 16:9; the mega-menu is 16:10 and uses `object-fit: cover`, so a 16:9 source just crops a sliver top/bottom. One source covers both. |
| Export resolution | **1280×720** | The largest slot renders ~600px wide; 720p downscaled is crisp and small. Record at native retina, export at 720p. |
| Format | **MP4, H.264** (High profile), `yuv420p` | Universally supported, incl. Safari/iOS. The component uses a single `<video src>`, so one MP4 per clip (no WebM needed). |
| Audio | **none** (strip it) | Autoplay only works muted; a silent track just adds weight. |
| Length | **6–10 s, seamless loop** | Start and end on a near-identical frame so the loop is invisible. |
| Frame rate | 30 fps | Smooth enough for UI, half the size of 60. |
| Faststart | **yes** (`moov` atom at front) | Lets the clip start playing before it fully downloads. |
| File size | **target < 1.5 MB** | It lazy-loads on hover; keep it light for CWV. |
| Poster | 1280×720 **JPG or WebP**, the opening frame | Shows instantly before the video loads (previews use `preload="none"`). |

**Naming** (drop into `projects/website/public/videos/`):
```
feature-<slug>.<locale>.mp4      feature-sessions.en.mp4 / feature-sessions.ro.mp4
feature-<slug>.<locale>.jpg      feature-sessions.en.jpg / feature-sessions.ro.jpg
```
slugs: `storefront, sessions, programs, exercises, payments, messaging, community`

---

## 2. What to record with (macOS)

You're on macOS, so:

- **Screen Studio** (paid, ~$89–229) — best for *designed* product demos: auto zoom-to-cursor,
  smooth cursor motion, clean window capture, exports polished MP4. If these previews should
  look premium, this is the one. Records a window at a fixed size, which is exactly what you want.
- **CleanShot X** (paid, ~$29) — clean, no-clutter screen recording, hides desktop icons,
  simple trim + export. Great value if you don't need the auto-zoom.
- **Kap** (free, open source) — good enough for short UI loops, exports MP4/WebM/GIF.
- **Built-in** (free): `Cmd+Shift+5` → "Record Selected Portion" → drag a 16:9 box over the app.
  Then compress with the ffmpeg command below. Perfectly fine for a straight capture.

**Compress / normalize every clip** (free, `brew install ffmpeg`):
```bash
# raw recording -> web-ready 720p MP4, audio stripped, faststart
ffmpeg -i raw.mov -vf "scale=1280:-2,fps=30" -an \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 24 -movflags +faststart \
  feature-sessions.en.mp4

# pull the poster frame (first frame)
ffmpeg -i feature-sessions.en.mp4 -vframes 1 -q:v 3 feature-sessions.en.jpg
```
Bump `-crf` up (26–28) if a file is still over ~1.5 MB; lower (20–22) if it looks soft.

---

## 3. Recording technique (so the small clips read well)

1. **Record the app in the target language.** Switch the app UI to RO for the `.ro` set.
2. **Fixed window size.** Resize the browser to a clean width (~1280px content) with a clean
   profile: no bookmarks bar, no extension icons, no personal tabs.
3. **One clear action per clip.** The mega-menu preview is ~300px wide — a busy screen turns to
   mush. Pick a single flow that reads at thumbnail size.
4. **Move the cursor slowly and deliberately**, and **pause ~1s on the key element** before
   clicking. Fast cursor jitter looks bad on loop.
5. **Record longer than you need, then trim** to a seamless loop (end where you began).
6. Retina display → you're capturing at 2×; the ffmpeg `scale=1280` downsizes cleanly.
7. Hide any real personal data — this is why the demo account below exists.

---

## 4. Per-feature storyboard (6–10 s each)

Record against the demo account (§6). Each is one calm flow. Timings are a guide.

### storefront  — *the public coaching page*
Record the **public instructor profile**.
- 0–2s: profile hero in view (avatar, name, headline, "Book" button)
- 2–5s: slow scroll down past upcoming **sessions** and **products**
- 5–8s: pause on a **review** card (stars + a line), cursor rests on "Book a session"
- Loop back to the hero.

### sessions  — *scheduling that fills itself*
Record the **schedule / calendar**.
- 0–2s: week view with several sessions across days
- 2–4s: click a **group class** → its detail opens
- 4–8s: show **capacity + attendees** (e.g. "8/10, 2 on waitlist"), cursor on "Book"

### programs  — *plans clients follow*
Record a **program** (builder or the assigned-program view).
- 0–2s: program overview ("12-Week Strength", weeks listed)
- 2–5s: open **Week 1 · Day 1**, exercises appear with sets × reps
- 5–9s: gently scroll the day; a client's **logged/ticked** set is visible

### exercises  — *your library*
Record the **exercise library**.
- 0–2s: grid of exercises with thumbnails
- 2–4s: click one → detail with the **clip** + your **cues** + **muscle tags**
- 4–8s: the clip plays a rep; cursor rests on "Add to program"

### payments  — *invoices, subscriptions, products*  ⚠️ Stripe test mode (see §6)
Record the **payments / invoices** area.
- 0–3s: list of invoices (a couple **Paid**, one **Open**) and a **membership**
- 3–7s: open one invoice → line items + status, or the "create invoice" step
- Keep amounts realistic (e.g. 150 RON / €40).

### messaging  — *stay close, 1:1*
Record **messages** (1:1 only — no group thread; that's roadmap).
- 0–2s: conversation list with a few clients
- 2–5s: open a thread, a short exchange visible
- 5–8s: type a message into the composer (don't need to send)

### community  — *groups, posts, comments, reactions*
Record a **group**.
- 0–2s: group header (name, members)
- 2–5s: scroll the feed to a **post** with a couple of **reactions**
- 5–8s: a **comment** is visible under it

---

## 5. Wiring the files in (one small change)

Right now `preview`/`poster` are `null` and a "Preview coming soon" placeholder shows. Two options:

- **Turnkey (recommended):** I make `preview`/`poster` locale-aware (`$localize`) and pre-wire the
  paths above, plus add a graceful fallback so a missing file still shows the placeholder. Then you
  literally just drop the 14 files in `public/videos/` and rebuild. Say the word and I'll do it.
- **Manual:** set `preview`/`poster` per feature in `_data/features.ts`. (Single value = same clip in
  both locales; for per-locale clips it must be `$localize`, hence the turnkey option.)

---

## 6. Demo data (so the app looks full when you record)

The clips must show a *lived-in* account, not empty states. Two personas, one per language.

**How to get it in — the honest split:**
- **Non-payment sections** (profile, venues, sessions, programs, exercises, groups, posts,
  messages, reviews) can be seeded straight into the local DB with a script. I can write
  `beeactive-api/scripts/seed-demo.mjs` (or a SQL file) that inserts everything below. **I need to
  know: do you record against a local API (`localhost:3800`) or a prod demo account?** That decides
  the approach.
- **Payments** are Stripe-backed — invoices/subscriptions/products need real Stripe **test-mode**
  objects, which the app creates through its own flow. So for the payments clip: switch the app to
  Stripe test keys and create 2–3 products + a couple of invoices via the UI once, then record.
  (SQL-inserting fake Stripe IDs would break the payment screens.)

### The demo content pack (EN + RO)

**Coach persona**
| | EN | RO |
|---|---|---|
| Name | Alex Rivera | Andrei Popescu |
| Handle | `@alexrivera` | `@andreipopescu` |
| Headline | Strength & conditioning coach | Antrenor de forță și condiție fizică |
| Bio | Eleven years on the gym floor. I coach a small roster online and in person, and I keep it simple: show up, get strong, stay consistent. | Unsprezece ani în sală. Antrenez un grup mic, online și în persoană, și țin lucrurile simple: vino, devino puternic, rămâi constant. |

**Clients (roster / messages)**
- EN: Sarah M., Mike T., Emma L., Tom R.
- RO: Maria I., Ștefan D., Ioana P., Elena V.

**Venues**
- EN: "Iron House Gym" (gym, city), "Riverside Park" (outdoor), "Online (Zoom)" (online)
- RO: "Sala Iron House" (sală), "Parcul Herăstrău" (în aer liber), "Online (Zoom)" (online)

**Sessions** (spread across the week)
- EN: Morning HIIT (group, 8/10), 1:1 Strength — Sarah, Yoga Flow (group), Saturday Long Run
- RO: HIIT de dimineață (grup, 8/10), Forță 1:1 — Maria, Yoga Flow (grup), Alergare lungă sâmbătă

**Programs**
- EN: "12-Week Strength", "Beginner Full Body" — Week 1 / Day 1: Back Squat 3×5, Bench Press 3×5,
  Row 3×8, Plank 3×30s
- RO: "Forță în 12 săptămâni", "Full Body pentru începători" — Săptămâna 1 / Ziua 1: Genuflexiuni cu
  bara 3×5, Împins la piept 3×5, Ramat 3×8, Plank 3×30s

**Exercises (library, ~10)**
- EN: Back Squat, Bench Press, Deadlift, Overhead Press, Barbell Row, Pull-up, Romanian Deadlift,
  Goblet Squat, Plank, Kettlebell Swing (tag muscles: quads, chest, back, shoulders, core)
- RO: Genuflexiuni cu bara, Împins la piept, Îndreptări, Împins deasupra capului, Ramat cu bara,
  Tracțiuni, Îndreptări românești, Genuflexiuni goblet, Plank, Balans cu gira

**Products** (Stripe test mode)
- EN: "Monthly Coaching" (€40/mo), "8-Session Pack" (€120), "Form Check" (€15)
- RO: "Coaching lunar" (200 RON/lună), "Pachet 8 ședințe" (600 RON), "Verificare tehnică" (75 RON)

**Group + posts (community)**
- EN group: "Morning Crew" (12 members). Post: "Great session today, everyone. New PBs from Sarah
  and Mike 💪 — recovery walk tomorrow at 8." + 2 reactions, 1 comment ("Loved it, see you tomorrow!")
- RO group: "Echipa de dimineață" (12 membri). Post: "Sesiune super azi, oameni buni. Recorduri noi
  de la Maria și Ștefan 💪 Mâine plimbare de recuperare la 8." + 2 reacții, 1 comentariu ("Mi-a
  plăcut, ne vedem mâine!")

**Reviews (on the profile)**
- EN: ★★★★★ "Alex actually pays attention. My squat has never felt this solid." — Emma
- RO: ★★★★★ "Andrei chiar e atent la detalii. Genuflexiunile mele n-au fost niciodată atât de bune." — Ioana

**Messages (1:1 sample thread)**
- EN (with Sarah): "How did the Tuesday session feel?" · "Strong! Hit all my sets 🙌" · "Love it.
  Bump the squat 2.5kg next week."
- RO (cu Maria): "Cum a fost sesiunea de marți?" · "Puternică! Am prins toate seriile 🙌" · "Super.
  Adaugă 2,5 kg la genuflexiuni săptămâna viitoare."

---

## 7. Suggested order of work
1. You tell me the record environment (local API vs prod demo) → I write the non-payment seed.
2. You set up Stripe **test** keys locally → create the 3 products + 2 invoices via the app UI.
3. I wire `preview`/`poster` to be locale-aware with graceful fallback (turnkey drop-in).
4. You record the 14 clips per §4, compress per §2, drop into `public/videos/`, rebuild.
