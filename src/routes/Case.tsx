import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, CardHead, LinkButton, Note, StepHead } from '../components/ui'

const ROOT_CAUSES = [
  {
    branch: 'Input variance',
    causes: ['Extraction output differs between runs', 'Whitespace, metadata, a fresh re-export', 'A different file carrying identical content'],
    answer: 'Canonicalise, then hash. The grade attaches to the work, not to the bytes.',
  },
  {
    branch: 'Model variance',
    causes: ['Sampling temperature above zero', 'The provider updates the model', 'Tokenisation differences between builds'],
    answer: 'Pin decoding and pin the build. A run that cannot be reproduced is refused from the record.',
  },
  {
    branch: 'Configuration variance',
    causes: ['The prompt is edited between runs', 'The rubric is edited between runs', 'Context assembled differently'],
    answer: 'Version the prompt and the rubric, and put both versions in the key.',
  },
]

const STAKEHOLDERS = [
  { who: 'Student', need: 'A fair grade with visible reasons', fear: 'A score with no explanation and no appeal', screen: 'Student view', to: '/student' },
  { who: 'Professor', need: 'Less time grading, final authority retained', fear: 'Being overruled by software', screen: 'Review queue', to: '/review' },
  { who: 'Administration', need: 'Comparable standards, an audit trail', fear: 'A grade that cannot be defended to a parent or an accreditor', screen: 'Audit log', to: '/audit' },
  { who: 'Platform operations', need: 'Predictable behaviour and cost', fear: 'Silent failures during submission peaks', screen: 'Consistency lab', to: '/consistency' },
]

const EXCLUDED = [
  ['Plagiarism and AI-authorship detection', 'A separate product with separate liability. Bundling it puts a contested accusation in the same workflow as a grade.'],
  ['AI tutoring and study plans', 'A different user problem, with no dependency on the grading record being correct.'],
  ['Learning analytics dashboards', 'Worth building once there is a trustworthy grade history to analyse. Not before.'],
  ['Automatic release without review', 'Withheld until override rates show it has been earned.'],
]

const PRINCIPLES = [
  ['Understand the business before writing code', 'A grade is an academic record with an appeals process attached. That fact, not the model, sets the requirements.'],
  ['Solve the root cause, not the symptom', 'Lowering temperature closes the ticket. It does not address prompt drift, rubric edits or provider updates.'],
  ['AI assists people; it does not replace their authority', 'The model proposes. The professor releases. Accountability stays where the institution already places it.'],
  ['Calculate what can be calculated', 'Ask a model only for judgement. Arithmetic belongs in code, where it is testable.'],
  ['Record enough to reproduce any past result', 'Versioned inputs are what separate a grade change that can be explained from one that cannot.'],
]

export default function Case() {
  return (
    <div className="mx-auto max-w-4xl">
      <StepHead
        actions={
          <>
            <LinkButton to="/consistency" variant="primary">
              See it reproduced
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </LinkButton>
            <LinkButton to="/overview" variant="secondary">
              Open the platform
            </LinkButton>
          </>
        }
      />

      <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-4">
        {/* The lockup is drawn in deep teal, so it keeps a light ground in both themes. */}
        <span className="rounded-lg bg-white px-3 py-2">
          <img
            src={`${import.meta.env.BASE_URL}luc-logo.svg`}
            alt="Learners Education"
            className="h-8 w-auto"
            width={100}
            height={32}
          />
        </span>
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-relaxed text-ink-soft">
          An institution can already grade with a model. What it cannot yet do is defend a grade. Invariant treats a
          grade as a decision record — reproducible, versioned and attributable — and every screen that follows is a
          consequence of that one commitment.
        </p>
      </div>

      <Section title="The reported defect">
        <p>
          A student uploaded the same assignment twice. The first submission was graded A. The second was graded B.
          Neither the professor nor the platform could say which grade was correct, and the institution had no
          mechanism to reconstruct either decision.
        </p>
        <p>
          The defect is small in code and large in credibility, and it is the right entry point into the design
          because fixing it properly forces three properties on the system that everything else depends on:
          versioned inputs, stored evidence, and a defined human authority.
        </p>
        <Note tone="verified" title="The position this design takes">
          Consistency is not correctness. A system that returns the same wrong grade every time is perfectly
          consistent. Determinism is a precondition for trust, not a replacement for accuracy, which is why this
          design pairs deterministic grading with professor authority over release.
        </Note>
      </Section>

      <Section title="Root cause, in three branches">
        <p>
          Sampling randomness is the usual suspect, and it is one branch of three. A grade is a function of four
          inputs — the extracted text, the rubric, the prompt and the model. If any of them can change without being
          recorded, the grade can change without an explanation. Lowering temperature closes one branch and leaves
          the other two open, which is why it was rejected as a complete answer.
        </p>
        <div className="not-prose mt-5 grid gap-3 sm:grid-cols-3">
          {ROOT_CAUSES.map((branch) => (
            <div key={branch.branch} className="rounded-card border border-line bg-surface p-4">
              <h3 className="text-[0.875rem] font-semibold tracking-tight text-ink">{branch.branch}</h3>
              <ul className="mt-2.5 space-y-1.5">
                {branch.causes.map((cause) => (
                  <li key={cause} className="text-[0.8125rem] leading-snug text-ink-soft">
                    {cause}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-3 text-[0.8125rem] leading-relaxed text-verified-ink">
                {branch.answer}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The design decision">
        <p>
          Every grading run is addressed by a key derived from everything that can influence the outcome. Three rules
          follow from it, and they are the whole of the fix.
        </p>
        <ol className="not-prose mt-5 space-y-3">
          {[
            'If the key already exists, the stored grade is returned. No second model call is made.',
            'If the key differs, a new grading run is recorded as a new version, and the field that changed is recorded with it.',
            'Nothing is graded without a key. A grade that cannot be reproduced is not admitted into the record.',
          ].map((rule, i) => (
            <li key={rule} className="flex gap-3.5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[0.6875rem] font-medium text-surface">
                {i + 1}
              </span>
              <span className="text-[0.9375rem] leading-relaxed text-ink-soft">{rule}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Who this is for">
        <div className="not-prose overflow-x-auto">
          <table className="w-full min-w-[38rem] text-left">
            <thead>
              <tr className="border-b border-line-strong">
                <th className="label py-2.5 pr-4 font-medium">Who</th>
                <th className="label py-2.5 pr-4 font-medium">What they need</th>
                <th className="label py-2.5 pr-4 font-medium">What they will not accept</th>
                <th className="label py-2.5 font-medium">Screen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {STAKEHOLDERS.map((row) => (
                <tr key={row.who}>
                  <td className="py-3 pr-4 align-top text-[0.875rem] font-medium tracking-tight whitespace-nowrap text-ink">
                    {row.who}
                  </td>
                  <td className="py-3 pr-4 align-top text-[0.8125rem] leading-relaxed text-ink-soft">{row.need}</td>
                  <td className="py-3 pr-4 align-top text-[0.8125rem] leading-relaxed text-ink-soft">{row.fear}</td>
                  <td className="py-3 align-top">
                    <Link to={row.to} className="text-[0.8125rem] font-medium whitespace-nowrap text-ink no-underline hover:underline">
                      {row.screen} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="What was deliberately left out">
        <p>
          Each of these is more valuable, and easier to sell, once grading itself is defensible. The sequencing is
          the point, not the omission.
        </p>
        <dl className="not-prose mt-5 divide-y divide-line border-y border-line">
          {EXCLUDED.map(([title, why]) => (
            <div key={title} className="flex flex-col gap-1.5 py-3.5 sm:flex-row sm:gap-6">
              <dt className="shrink-0 text-[0.875rem] font-medium tracking-tight text-ink sm:w-64">{title}</dt>
              <dd className="text-[0.8125rem] leading-relaxed text-ink-soft">{why}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="The rules this was written against">
        <ol className="not-prose space-y-4">
          {PRINCIPLES.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="mt-1 w-5 shrink-0 font-mono text-[0.75rem] text-ink-faint tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-[0.9375rem] font-medium tracking-tight text-ink">{title}</h3>
                <p className="mt-1 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Card className="mt-12">
        <CardHead
          title="What is real in this prototype, and what is not"
          meta="Stated plainly, because a demo that overclaims is the fastest way to lose a room."
          action={<Badge tone="review" dot>Prototype</Badge>}
        />
        <div className="grid gap-px bg-line sm:grid-cols-2">
          <div className="bg-surface px-5 py-4">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-verified-ink">Runs for real, in your browser</h3>
            <ul className="mt-2.5 space-y-1.5 text-[0.8125rem] leading-relaxed text-ink-soft">
              <li>SHA-256 content hashing over canonicalised text, via Web Crypto</li>
              <li>Evaluation key derivation, diffing and the verdict cache</li>
              <li>The rubric engine: word counts, required sections, weights, late penalties</li>
              <li>The validation layer, including the check that quoted evidence is verbatim</li>
              <li>The append-only grade record and audit log</li>
              <li>24 unit tests over the invariant, the gates and the record</li>
            </ul>
          </div>
          <div className="bg-surface px-5 py-4">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-review-ink">Stood in for</h3>
            <ul className="mt-2.5 space-y-1.5 text-[0.8125rem] leading-relaxed text-ink-soft">
              <li>
                Judgement scoring, which comes from a deterministic evaluator seeded by the evaluation key rather
                than from a language model. Swapping in a provider replaces one file.
              </li>
              <li>OCR and file parsing, which are represented by a confidence score on each sample</li>
              <li>The job queue, which runs in-process rather than on a broker</li>
              <li>Every student name, mark and identifier, all of which are invented</li>
            </ul>
          </div>
        </div>
      </Card>

      <p className="mt-8 max-w-[62ch] text-[0.8125rem] leading-relaxed text-ink-faint">
        Prepared for Learners Education by Atharva Soundankar. The system design this prototype implements is set out
        in the accompanying proposal, <em>AI Assignment Evaluation Platform: consistent, explainable grading at
        institutional scale</em>.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[1.375rem] leading-tight font-medium tracking-[-0.03em] text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-ink-soft [&>p]:max-w-[68ch]">{children}</div>
    </section>
  )
}
