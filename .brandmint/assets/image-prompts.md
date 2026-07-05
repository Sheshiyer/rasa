# Rasa — image-generation prompts

Ready-to-run prompts for the Rasa brand-mint visual assets. Every prompt encodes the Rasa palette and art direction:

- **Turmeric Saffron `#E8A33D`** (primary — warmth, appetite, the golden spice heart)
- **Fresh Basil Green `#2F7D5B`** (secondary — balance, health, freshness)
- **Ripe Tomato `#E4572E`** (accent — the one-tap confirm only)
- **Warm cream `#FBF6EC`** backgrounds; matte, flat, no gloss
- Type where shown: General Sans / Satoshi headers, Inter body, tabular figures for macros/prices
- **Art direction:** spice-warm and appetising, grounded by fresh green and cream; nourishing, not clinical; real top-down food; soft rounded plate/bowl shapes; everyday Indian contexts; honest portions; no glossy fast-food gloss; no diet-scold imagery

**Guardrails baked into prompts:** nutrition figures shown as estimates ("~" / "est."); no medical or "doctor-approved" cues; the tomato colour appears only on a confirm button; never depict silent auto-ordering.

Recommended engines: Flux 1.1 Pro or GPT-Image-1 for photography/heroes; a vector-capable model (or SVG hand-off) for the logo, app icon and icon set. Aspect ratios noted per asset.

---

## 1. Primary logo — the "bowl-R" wordmark

**Aspect:** 1200x400 (transparent PNG) · also export monogram at 512x512

```
Minimal, warm brand logo for a calm Indian food-tech app called "rasa". A lowercase wordmark "rasa" in a warm, humanist geometric sans-serif (General Sans / Satoshi style), semibold, gently tight letter-spacing, in a warm near-black charcoal (#2B2620). To the left, a friendly monogram: the letter "R" drawn so its bowl reads as a rounded serving bowl seen from the front, in turmeric saffron (#E8A33D), with a single small fresh-basil-green (#2F7D5B) dot resting inside the bowl like a spice seed or a served meal. Flat matte vector, no gradients, no drop shadow, no gloss, no 3D. Warm cream (#FBF6EC) or transparent background. Balanced, appetising, calm, professional. Generous negative space. High-resolution, crisp edges, logo design.
```

Variants to also render: reversed (saffron mark + cream wordmark on basil-green `#2F7D5B`); monochrome dark (all `#2B2620` on cream); monogram-only (bowl-R alone for favicon/app icon).

---

## 2. App icon — bowl-R on green

**Aspect:** 1024x1024 (rounded-square app-icon safe area)

```
iOS/Android app icon for a warm Indian meal-planning app "rasa". A single centred monogram: the letter "R" whose bowl forms a rounded serving bowl, rendered in turmeric saffron (#E8A33D) with one small cream (#FBF6EC) spice dot inside the bowl, on a solid fresh-basil-green (#2F7D5B) background. Flat matte, no gradient, no gloss, no shadow. Soft rounded-square icon shape, centred with comfortable padding. Friendly, calm, appetising, premium. Vector-clean, high-resolution.
```

---

## 3. Hero image A — "the 1pm confirm, from above" (recommended landing hero)

**Aspect:** 1600x1000 (leave upper-left third clean for headline + CTA)

```
Warm, honest top-down (90-degree overhead) photo of a real home work desk at midday. On a warm cream and light-wood surface: a real grilled chicken bowl (honest everyday portion, matte, no gloss, no fake garnish) beside a modern smartphone. The phone screen shows a calm cream meal-app confirm sheet with a dish name, a rupee price "₹240", an arrival time "~12:35", tabular macro chips, a small "est." estimate label, and a single ripe-tomato (#E4572E) "Confirm" button. Edge of a laptop keyboard, an empty cup. Soft natural window daylight, warm and directional, matte finish. Palette: warm cream, wood, turmeric-saffron and basil-green accents; tomato appears only on the confirm button. Mood: relief, calm, everyday competence. Generous clean negative space in the upper-left third for a headline. Photorealistic, natural, un-staged, no glossy delivery-ad look, no diet-app clichés.
```

---

## 4. Hero image B — "a calm month, laid out"

**Aspect:** 1600x1000 (keep right third clean for headline)

```
Warm lifestyle product photo: a modern smartphone held over a warm cream surface, its screen showing a calm cream meal-planner "30-day plan" view — a scrollable month of meal cards with small tabular macro and rupee-price chips and a green "under cap" spend bar. Around the phone, a few real, honest Indian dishes loosely arranged (a bowl, roti, a small bowl of dal) on cream and light wood, natural everyday portions, matte, no gloss. Soft even warm daylight. Palette: cream background, turmeric-saffron and basil-green accents, tomato only as a small confirm element on screen. Mood: in control, unhurried, "a whole month, handled." Clean negative space on the right for a headline. Photorealistic, warm, honest, not glossy.
```

---

## 5. Lifestyle food shot 1 — grilled chicken bowl, top-down

**Aspect:** 1200x1200

```
Top-down (overhead) photo of a single real grilled chicken bowl on a warm cream surface, honest everyday portion, matte finish, natural real garnish only (a little coriander), no gloss, no glycerine sheen, no artificial styling. Soft natural window light from one side, gentle shadow. Beside the bowl, a small cream card with tabular macro figures "est. 520 kcal · P 42g · C 40g · F 18g" in clean sans-serif. Palette warm: cream, wood, saffron and green tones. Appetising, honest, calm. Photorealistic, not a glossy fast-food ad.
```

---

## 6. Lifestyle food shot 2 — paneer butter masala + roti

**Aspect:** 1200x1200

```
Low three-quarter angle (about 30 degrees) photo of a real paneer butter masala with two rotis on a matte ceramic plate on warm wood, honest home-style portion, real coriander garnish, matte finish, no gloss or over-saturation. Soft natural daylight, single source, gentle warm shadow. Palette: warm cream and wood, turmeric-saffron and basil-green harmony. Cosy, honest, appetising, everyday Indian food. Photorealistic, un-styled, no fast-food gloss.
```

---

## 7. Lifestyle food shot 3 — honest steel thali

**Aspect:** 1200x1200

```
Top-down photo of a real steel Indian thali with everyday home-style portions — dal, sabzi, rice, roti, a small salad — on a warm cream surface, matte, natural, honest amounts (not a feast). Soft natural window light, gentle shadow, warm tones. Palette: cream, steel, saffron and green accents. Grounded, authentic, calm, appetising. Photorealistic, documentary-honest, no studio drama, no glossy styling.
```

---

## 8. Icon set — the core app icons

**Aspect:** 1024x1024 sheet (or export individually at 24/48px SVG). Render as one consistent set.

**Shared style block (prepend to each icon prompt):**
```
Rounded outline icon, 2px consistent stroke with rounded caps and joins, on a 24px grid, friendly and geometric, warm and calm, never cartoonish. Line colour warm charred-cardamom (#2B2620) on transparent/cream; a single flat accent fill in turmeric saffron (#E8A33D) or basil green (#2F7D5B) where noted; ripe tomato (#E4572E) used ONLY on the confirm icon; allergen red (#C0362C) used ONLY on the allergen-block/error icon and kept visually distinct from the confirm tomato. Flat, matte, no gradient, no shadow.
```

Render these icons in the set:

1. **plan** — a calendar-grid of small bowls (the 30-day plan home).
2. **today** — a single bowl with a small sun/clock hint (today's meals).
3. **ledger** — a wallet with a level line (the spend ledger), green accent.
4. **budget-cap** — a rupee "₹" under a rounded ceiling/cap line (the hard monthly cap).
5. **under-cap** — a rupee "₹" with a green level line below the cap (stayed under budget), green accent.
6. **coupon** — a price tag with a small cut (applied offer).
7. **calories** — a soft flame in a rounded outline, with a small "~" estimate mark (estimated calories).
8. **macro-balanced** — three level arcs inside a bowl (macro-fit / balanced), saffron+green.
9. **protein / carbs / fat** — a rounded "P" chip, a grain cluster, a droplet (macro trio).
10. **estimate** — a "~" tilde inside a soft circle (marks every nutrition figure as an estimate).
11. **confirm** — a bowl/plate with a check, drawn in ripe tomato (#E4572E) (THE one-tap confirm action).
12. **swap** — two curved arrows around a bowl (swap this meal for a fallback).
13. **skip** — a bowl with a forward-skip arrow (skip this slot).
14. **allergen-block** — a peanut/shellfish shape inside a red (#C0362C) no-entry ring (hard block), clearly distinct from the confirm icon.
15. **veg / non-veg** — the Indian green-square veg and brown/red non-veg marks.
16. **order-confirmed** — a bowl with a green check (order placed after your tap).
17. **on-the-way** — a delivery scooter carrying a bowl (tracking a live order).
18. **info-estimate** — an "i" in a soft slate circle (opens the estimate / wellness disclaimer).

---

## Negative-prompt guidance (append where the engine supports it)

```
no gloss, no glossy fast-food look, no dripping cheese pull, no fake steam, no artificial garnish, no over-saturation, no studio spotlight drama, no marble aspirational kitchen, no diet-app clichés (no scales, no measuring tape, no before/after bodies, no guilt imagery), no medical or doctor symbols, no confetti or hype, no neon, no gradients on brand marks, no drop shadow on the logo, no Title Case or shouting all-caps UI text.
```
