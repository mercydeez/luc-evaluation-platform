# Invariant · Learners Education

An AI assignment evaluation platform built around a single guarantee:

> **The same submission, graded twice, cannot receive two different grades.**

**[Open the live prototype →](https://mercydeez.github.io/luc-evaluation-platform/)**

Prepared for Learners Education by Atharva Soundankar, implementing the system design set out in
*AI Assignment Evaluation Platform: consistent, explainable grading at institutional scale*.

---

## The problem

A student uploaded the same assignment twice. The first submission was graded A. The second was graded B.
Neither the professor nor the platform could say which grade was correct.

Lowering the sampling temperature closes the ticket. It does not close the defect. A grade is a function of
four inputs — the extracted text, the rubric, the prompt and the model — and if any of them can change
without being recorded, the grade can change without an explanation.

## The fix

Every grading run is addressed by an **evaluation key** derived from everything that can influence the outcome:

```
sha256( canonical text ) + rubric_version + prompt_version + model_version + decoding_config
```

Three rules follow:

1. If the key already exists, the stored verdict is returned. No second model call is made.
2. If the key differs, a new run is recorded as a new version, and the field that changed is recorded with it.
3. Nothing is graded without a key. **A grade that cannot be reproduced is not admitted into the record.**

Rule 3 is enforced, not documented: run the pipeline with temperature above zero and the verdict is logged and
refused rather than stored.

## What actually runs

This is a prototype, and the README is as specific about what is stood in for as about what is real.

| Real, in your browser | Stood in for |
|---|---|
| SHA-256 content hashing over canonicalised text (Web Crypto) | Judgement scoring, from a deterministic evaluator seeded by the evaluation key |
| Evaluation key derivation, pin diffing, and the verdict cache | OCR and file parsing, represented by a confidence score per sample |
| The rubric engine: word counts, required sections, weights, late penalties | The job queue, which runs in-process rather than on a broker |
| The validation layer, including a verbatim check on quoted evidence | Every student name, mark and identifier — all invented |
| The append-only grade record and audit log | |
| 25 unit tests over the invariant, the gates and the record | |

Swapping the deterministic evaluator for a real provider means replacing
[`src/engine/evaluator.ts`](src/engine/evaluator.ts) and nothing else. The pipeline, the key, the cache, the
validation layer and the record are all indifferent to where judgement came from.

**No real student work appears anywhere in this repository.**

## Try it in ninety seconds

1. **Submit & grade** — run Priya Nandakumar's submission, then run it again without changing anything.
   The second run stops at stage 7, makes zero model calls, and returns the identical grade.
2. Edit one character of the extracted text. The evaluation key moves before you run anything.
3. Set temperature to 0.7 and run twice. Two different grades, neither admitted to the record.
4. **Consistency lab** — five runs unpinned beside five runs pinned, side by side.
5. **Review queue** → adjust a criterion, publish with a reason, then open **Student view** to see what the
   student sees. The original AI grade stays in the record.

## Architecture

```
src/engine/          Pure TypeScript. No React, no DOM assumptions beyond Web Crypto.
  hash.ts            Canonicalisation + sha-256. Identity of the work, not of the file.
  key.ts             Evaluation key derivation, formatting, pin diffing.
  rubric.ts          Rubric versions, text features, and the mechanical marks.
  evaluator.ts       Deterministic stand-in for the model. The only file a provider replaces.
  validate.ts        The output contract. Rejects malformed verdicts before a human sees them.
  pipeline.ts        Eleven named stages, as an async generator.
  store.ts           Verdict cache, append-only grade record, append-only audit log.
  engine.test.ts     25 tests.

src/routes/          Seven screens, one per stakeholder need.
src/components/      Shell, the evaluation-key chip, pipeline and verdict views, primitives.
src/data/            Synthetic submissions, and the seeding pass that grades them on first load.
```

Two decisions worth calling out:

**The pipeline is an async generator.** It yields the full stage list on every transition, so the UI renders
progress without tracking it, and `evaluate()` drains the same generator with no pacing for tests and replays.
One implementation, two consumers.

**The dashboard verifies its own claim.** The determinism panel does not assert that no grade has diverged; it
groups the record by evaluation key and counts keys that ever produced two different marks. If the engine
broke, the number would not be zero.

**Nothing on screen is hand-written data.** On first load the five sample submissions are run through the real
pipeline in the browser, so every grade, confidence, held file and rejection on the dashboard was computed,
not authored. Seeding doubles as a smoke test: a broken engine shows an empty dashboard rather than a
plausibly wrong one.

## Design

Brand colours and the logo are taken from the official Learners Education assets — green `#259D4A` and deep
teal `#0B434B` are lifted from the logo file itself. Green carries exactly one meaning in this product:
*verified, pinned, reproducible*. It is never decorative, which is what makes a green badge worth reading.

Type splits along the same line the product does: Switzer (a match for the site's PP Neue Montreal) for
anything a person wrote, IBM Plex Mono for anything the machine owns — hashes, keys, versions, timings.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
npm run build      # production build
```

Deployment is automatic: pushing to `main` runs the checks and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A failing test blocks the deploy.

## Deliberately out of scope

Plagiarism and AI-authorship detection, AI tutoring, learning analytics dashboards, and automatic release
without professor review. Each is more valuable and easier to sell once grading itself is defensible. The
sequencing is the point, not the omission.

---

Stack: React 19 · TypeScript · Tailwind CSS v4 · Vite · Vitest
