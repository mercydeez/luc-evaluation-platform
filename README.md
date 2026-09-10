# Invariant · Learners Education

An AI assignment evaluation platform built around a single guarantee:

> **The same submission, graded twice, cannot receive two different grades.**

**[Open the live prototype →](https://mercydeez.github.io/luc-evaluation-platform/)**

Nine screens, walked in the order the argument is made. Arrow keys move between them, `/` asks the record,
`t` switches theme, `?` explains the demo.

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

## The walkthrough

| # | Screen | What it has to make good on |
|---|---|---|
| 1 | Case | The defect, its root cause in three branches, and what was deliberately left out |
| 2 | Overview | The working dashboard — and a determinism claim the page checks rather than asserts |
| 3 | Submit | Edit the work or a pin and watch the evaluation key move before anything runs |
| 4 | Consistency | Five runs unpinned beside five runs pinned. The defect and the fix, side by side |
| 5 | Review | The queue. Release is a separate state and it belongs to the course owner |
| 6 | Decision | Adjust a criterion, publish with a reason; the proposed grade stays in the record |
| 7 | Student | The same decision from the only side that has to live with it |
| 8 | Record | Append-only, replayable from any evaluation key on it |
| 9 | Cohort | Forty synthetic submissions, graded by the same engine, charted from its output |

## Ask the record

A tutor panel that answers questions about any grade — **strictly from what is stored**.

There is no model and no network in that path. The corpus is built from the record itself (verdicts,
criterion scores, evidence spans, professor decisions, audit entries, plus the rules the engine actually
implements), indexed with BM25, and ranked locally. Every answer names the document it came from and links to
the screen where it can be checked. When nothing clears the relevance floor, it says the record does not
cover the question rather than inventing an answer.

That is not a safety veneer. It is the appeals rule, made interactive: an appeal is resolved against stored
evidence rather than by re-running the model, because re-running risks producing a third answer in front of a
student who is already disputing the second. A tutor that could invent would break the guarantee the platform
exists to make.

Two rules keep it honest, both tested:

- A concrete record fact outranks the general policy that covers it.
- One matched word is a subject, not a question. A multi-word question must land on at least two of its own
  terms; a single word is answered only when it is specific enough to identify a small part of the record.

## What actually runs

| Real, in your browser | Stood in for |
|---|---|
| SHA-256 content hashing over canonicalised text (Web Crypto) | Judgement scoring, from a deterministic evaluator seeded by the evaluation key |
| Evaluation key derivation, pin diffing, and the verdict cache | OCR and file parsing, represented by a confidence score per sample |
| The rubric engine: word counts, required sections, weights, late penalties | The job queue, which runs in-process rather than on a broker |
| The validation layer, including a verbatim check on quoted evidence | Every student name, mark and identifier — all invented |
| The append-only grade record and audit log | |
| BM25 retrieval over the record, for the tutor | |
| The cohort: 40 submissions generated and graded on load | |
| 39 unit tests over the invariant, the gates, the record and retrieval | |

Swapping the deterministic evaluator for a real provider means replacing
[`src/engine/evaluator.ts`](src/engine/evaluator.ts) and nothing else. The pipeline, the key, the cache, the
validation layer, the record and the tutor are all indifferent to where judgement came from.

**No real student work appears anywhere in this repository.**

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
  retrieval.ts       BM25 over a corpus built from the record. Powers the tutor.
  *.test.ts          39 tests.

src/steps.ts         The nine-step walkthrough. Nav, headings and neighbours, in one place.
src/theme.ts         Light/dark, stamped on the root before first paint.
src/routes/          One screen per step.
src/components/      Shell, evaluation-key chip, pipeline and verdict views, tutor, tour.
src/data/            Synthetic submissions, the seeding pass, and the cohort generator.
```

Four decisions worth calling out:

**The pipeline is an async generator.** It yields the full stage list on every transition, so the UI renders
progress without tracking it, and `evaluate()` drains the same generator with no pacing for tests, replays
and the cohort. One implementation, four consumers.

**The dashboard verifies its own claim.** The determinism panel does not assert that no grade has diverged; it
groups the record by evaluation key and counts keys that ever produced two different marks. If the engine
broke, the number would not be zero.

**Nothing on screen is hand-written data.** On load the sample submissions are run through the real pipeline,
and the cohort screen generates and grades forty more. Every grade, confidence, held file, rejection and bar
was computed, not authored. Seeding doubles as a smoke test: a broken engine shows an empty dashboard rather
than a plausibly wrong one.

**Content addressing tells on itself.** Generating the cohort surfaced submissions from *different* students
that were byte-identical. The cache answers them correctly — identical work must receive identical grades —
but the cohort screen reports them separately from genuine resubmissions, because one is a saving and the
other is an integrity signal. Counting them together would have been the easy demo and the wrong number.

## Design

Brand colours and the logo are taken from the official Learners Education assets — green `#259D4A` and deep
teal `#0B434B` are lifted from the logo file itself. Green carries exactly one meaning in this product:
*verified, pinned, reproducible*. It is never decorative, which is what makes a green badge worth reading.

Type splits along the same line the product does: Switzer (a match for the site's PP Neue Montreal) for
anything a person wrote, IBM Plex Mono for anything the machine owns — hashes, keys, versions, timings.

Both themes are one palette. Every colour is named once in the light theme; the dark theme redefines the same
names and nothing else, so no component knows which theme it is in.

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
