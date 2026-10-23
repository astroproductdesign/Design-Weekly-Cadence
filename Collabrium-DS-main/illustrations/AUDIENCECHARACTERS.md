# Blob Character Bible

How to draw one of these characters, and the rules it must obey to be accepted
into the set.

Applies to every audience-segment character. If you are adding character #52,
this document is the whole brief.

---

## 1. Anatomy

These are the invariants. They are what make separately generated characters
read as one family — break one and the character leaves the set.

| Part | Rule |
|---|---|
| **Body** | One soft squircle. No neck, no torso detail. One solid flat colour — no gradient, no shading, **no outline on the body shape**. |
| **Face** | Tiny, sits high on the body. Exactly **two dot eyes, one short tick brow, one curved smile**. No nose. No mouth interior. |
| **Limbs** | Thin single-weight ink lines. Long noodle legs, small flat feet, no shoes. |
| **Hands** | Articulated fingers, matching the reference. See [Ruling 1](#ruling-1--hands-have-fingers). |
| **Props** | Same thin ink line, flat solid colour fills. Never rendered, never shaded. |
| **Accents** | Small hand-drawn marks only: sparkles, motion ticks, dots. |
| **Ground** | One short thin ground line under the feet. Nothing else — no scenery. |
| **Background** | Flat `#FCFAF5`, completely empty. |
| **Framing** | Full body in frame, generous margin, centred. |

**Ink is `#2B2B2C` for every line, including the face.** There is no second
line colour and no line-weight variation.

---

## 2. Colour

**Body colour belongs to the category, not the character.** All 12 Life-stage
characters share one turquoise; all 6 Sports characters share one red. Colour
carries the taxonomy, so it is never chosen for variety or mood.

| Category | N | Body colour |
|---|---|---|
| Ethnicity | 3 | `#00C26E` |
| Life stage | 12 | `#00D9D9` |
| Income group | 4 | `#FFA425` |
| Business & professionals | 4 | `#1473E6` |
| Entertainment | 7 | `#9F56FF` |
| Trendsetter | 8 | `#FF7A90` |
| Sports | 6 | `#FD3343` |
| Shopping intent | 7 | `#FF5825` |

A new character inherits its category's colour. It does not get a new one.
A new *category* needs a colour decision before any character in it is drawn.

**Accents:** at most **two** per character, from
`#FF5825` `#FF7A90` `#FFA425` `#00C26E` `#00D9D9` `#1473E6` `#9F56FF` `#FD3343`.
Accents are for props and sparkles only — never the body, never the linework.

So the full palette of any single character is: ink, background, body colour,
and up to two accents. Five colours, maximum.

---

## 3. Motion

Loops are 4 seconds. The still is the source of truth; the loop only moves it.

- **Locked static camera.** Background stays empty and unchanged.
- **Design, body colour and line weight identical to the still** — no redraw,
  no morphing, no re-interpretation.
- 2D cel animation. Snappy ease-out with a small overshoot.
- Gentle squash-and-stretch on the body; limbs and props trail about two frames
  behind.
- Sparkles pop in on the peak and fade out.
- **The character settles back to the exact starting pose.** The loop must be
  seamless.
- Audio: one soft pop and a light whoosh on the main beat. No music, no voice.

> **Write beats for 4 seconds, not 3.** The generator rejects anything shorter.
> The existing 51 were written as 3-second beats and play slightly slow as a
> result — don't repeat that when writing a new one.

---

## 4. Creating a new character

### Step 1 — Write the subject line

One sentence, present participle, describing pose and props only. No style
words — style comes from the shared prefix. Match the register of these:

> *standing tall and open, one hand resting over the centre of the body, the
> other extended forward palm-up in a warm greeting, two warm sparkles beside
> the head*

> *crouched forward in a launch pose holding a small paper rocket in one hand,
> other arm braced behind*

Keep it to one readable clause chain. Name the props. Say where the sparkles go.

### Step 2 — Assemble the prompt

Three parts, in order:

```
[SHARED STYLE PREFIX]  Body colour: [HEX]. Subject: a [HEX] blob character
representing the audience segment "[NAME]" — [SUBJECT LINE].
[SHARED NEGATIVE LIST]
[STYLE LOCK]
```

**Shared style prefix:**

> Flat 2D vector character illustration, modern editorial doodle style. Subject
> is a single rounded blob character: a soft squircle body with no neck and no
> torso detail, filled with ONE solid flat colour, no gradient, no shading, no
> outline on the body shape. Face is tiny and sits high on the body, drawn in
> thin charcoal ink: two small dot eyes, a short tick brow, and a simple curved
> smile. Arms and legs are thin single-weight charcoal lines (#2B2B2C), long
> noodle legs with small flat feet, no shoes. Props are drawn in the same thin
> ink line with flat solid colour fills. Only small hand-drawn accents:
> sparkles, motion ticks, dots. One short thin ground line under the feet.
> Background flat off-white #FCFAF5, completely empty. Full body in frame with
> generous margin, centred composition. Palette limited to ink #2B2B2C,
> background #FCFAF5, the body colour, and at most two accents from #FF5825
> #FF7A90 #FFA425 #00C26E #00D9D9 #1473E6 #9F56FF #FD3343. Playful, warm,
> confident, Scandinavian-modern editorial. Clean vector.

**Shared negative list:**

> Do not include: photorealism, 3D render, gradients, drop shadows, texture,
> grain, hair, clothing detail, detailed facial features, text, lettering,
> logos, watermark, busy background, scenery, outline around the body shape,
> thick uneven strokes, extra characters.

**Style lock — mandatory, and the reference image must be attached:**

> CRITICAL STYLE LOCK: the face has NO nose and NO mouth interior: exactly two
> small dot eyes, one short tick brow, and one simple curved smile line. Match
> the linework weight, hand construction, proportions and generous margin of
> the supplied reference image exactly.

Without the style lock the model adds a nose and loosens the framing. Verified
on two probes.

### Step 3 — Generate

Still: **Nano Banana 2**, 4:3, 2K, reference image attached → 2400 × 1792 PNG.
Loop: **Seedance 2.0 Mini**, 4:3, 720p, 4s, still as start frame → 1112 × 834 MP4.

The reference image is not optional. It is what carries hand construction and
line weight, and the text alone will not reproduce them.

### Step 4 — Check it against §6 before accepting it

---

## 5. Rulings

Decisions already made. Do not relitigate them per-character.

### Ruling 1 — Hands have fingers

The written spec says "simple looping line mittens." The approved reference
shows articulated fingers. **The reference wins; fingers are correct.**

All shipped characters use fingers. Prompt-level attempts to force mittens
failed — the model follows the reference image over the text. Any prose you
inherit that says "mitten hand" is stale on this point.

### Ruling 2 — No nose, ever

The unmodified prompt produces a nose. The style lock in §4 removes it. The
face is three marks: two dots, one tick, one curve.

### Ruling 3 — Companion figures are allowed where the segment requires them

Four characters render more than one blob (`young-families`, `family-dynamic`,
`the-dynamic-duo`, `new-mothers`) because the segment is inherently plural.
This contradicts "extra characters" in the negative list; the subject wins.

Companions must be **the same colour** as the main character and follow every
anatomy rule. A companion is never a different species, size-class or palette.
Do not add one for visual interest — only when the segment is about more than
one person.

---

## 6. Acceptance checklist

A character joins the set only if every line is true.

- [ ] Body is one flat colour, no outline, no gradient
- [ ] Face is exactly two dots, one tick brow, one curved smile — **no nose**
- [ ] All linework is `#2B2B2C` at one weight
- [ ] Body colour matches its category, not the character
- [ ] Two accents maximum, both from the approved list
- [ ] Background is empty `#FCFAF5` — no scenery, no texture
- [ ] One ground line, under the feet
- [ ] Full body in frame with margin on all sides
- [ ] No text, lettering, logo or watermark anywhere
- [ ] Props read clearly at thumbnail size
- [ ] Companion blobs (if any) are same-colour and justified by the segment
- [ ] Loop returns to the exact opening pose
- [ ] Body colour has been contrast-checked against `#FCFAF5` for its intended use

---

## 7. Known hazards

| Hazard | What happens |
|---|---|
| Generating without the reference image | Hands revert to mittens; line weight drifts |
| Generating without the style lock | A nose appears; framing tightens |
| Writing beats for 3 seconds | Rejected by the generator; 4s is the floor |
| Sunglasses + shopping-bag poses | Tripped a false NSFW flag once. Harmless, clears on retry |
| Limbs crossing behind the body | Smears under motion. Check the loop, not just the still |

---

**v1.1** — 2026-09-09. Narrowed to character creation and governance.
