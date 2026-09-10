/**
 * The walkthrough.
 *
 * The product is also a nine-step argument, and the nav is that argument in
 * order. A director can click 1 to 9 and arrive at the conclusion without ever
 * being told where to look next, which is the only navigation a demo really
 * needs. Every screen's heading, kicker and neighbours come from here, so the
 * order can only be changed in one place.
 *
 * A kicker earns its line by saying something the heading cannot. Where it
 * would only restate the heading, it is not written.
 */
export interface Step {
  n: number
  /** Nav label. Short enough to fit nine of them on one bar. */
  label: string
  to: string
  kicker: string
  title: string
  /** One line under the title. The claim the screen has to make good on. */
  lede: string
}

export const STEPS: Step[] = [
  {
    n: 1,
    label: 'Case',
    to: '/',
    kicker: 'The defect this platform exists for',
    title: 'Two grades, one file.',
    lede: 'A student uploaded the same assignment twice and was graded A, then B. Neither the professor nor the platform could say which was correct, and the college had no way to reconstruct either decision.',
  },
  {
    n: 2,
    label: 'Overview',
    to: '/overview',
    kicker: 'What the course owner opens on Monday',
    title: 'Grading',
    lede: 'Everything on this screen was computed by the engine in your browser. Nothing on it was written by hand.',
  },
  {
    n: 3,
    label: 'Submit',
    to: '/submit',
    kicker: 'Where a grade gets its address',
    title: 'Intake',
    lede: 'Change the work or change a pin, and watch the evaluation key move before anything runs.',
  },
  {
    n: 4,
    label: 'Consistency',
    to: '/consistency',
    kicker: 'The same file, graded five times, twice over',
    title: 'Proof',
    lede: 'The reported defect reproduced on demand, with the fix running beside it.',
  },
  {
    n: 5,
    label: 'Review',
    to: '/review',
    kicker: 'Nothing on this list has reached a student',
    title: 'Queue',
    lede: 'The model proposes. Release is a separate state, and it belongs to the course owner.',
  },
  {
    n: 6,
    label: 'Decision',
    to: '/review/sub_2211',
    kicker: 'An override is a disagreement, not a failure',
    title: 'Decision',
    lede: 'Adjust a criterion and publish. The proposed grade stays in the record beside yours.',
  },
  {
    n: 7,
    label: 'Student',
    to: '/student',
    kicker: 'A mark nobody can explain is not a mark',
    title: 'Student',
    lede: 'The same decision, seen from the only side that has to live with it.',
  },
  {
    n: 8,
    label: 'Record',
    to: '/audit',
    kicker: 'What is still true after everyone has forgotten',
    title: 'Record',
    lede: 'Append-only, and replayable from any evaluation key on it.',
  },
  {
    n: 9,
    label: 'Cohort',
    to: '/cohort',
    kicker: 'One term of this, at forty submissions',
    title: 'Cohort',
    lede: 'A synthetic cohort, graded by the same engine, so the distribution is output rather than illustration.',
  },
]

export function stepFor(pathname: string): Step | undefined {
  return STEPS.find((s) => s.to === pathname) ?? (pathname.startsWith('/review/') ? STEPS[5] : undefined)
}

export function neighbours(step: Step | undefined): { prev?: Step; next?: Step } {
  if (!step) return {}
  return { prev: STEPS[step.n - 2], next: STEPS[step.n] }
}
