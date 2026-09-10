import type { CriterionScore, Rubric } from './types'

export interface ValidationIssue {
  criterionId?: string
  rule: string
  message: string
}

/**
 * The validation layer.
 *
 * Nothing reaches a human until it has passed these. Malformed output, scores
 * outside range, missing criteria and — the one that matters most — evidence
 * that does not actually appear in the submission are all rejected here rather
 * than being handed to a professor to notice.
 */
export function validateVerdict(
  rubric: Rubric,
  scores: CriterionScore[],
  gradedText: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const weightTotal = rubric.criteria.reduce((sum, c) => sum + c.weight, 0)
  if (weightTotal !== 100) {
    issues.push({
      rule: 'weights-sum-to-100',
      message: `Rubric ${rubric.version} weights sum to ${weightTotal}, not 100.`,
    })
  }

  for (const criterion of rubric.criteria) {
    const score = scores.find((s) => s.id === criterion.id)
    if (!score) {
      issues.push({
        criterionId: criterion.id,
        rule: 'criterion-present',
        message: `No score returned for "${criterion.name}".`,
      })
      continue
    }

    if (!Number.isInteger(score.score) || score.score < 0 || score.score > 100) {
      issues.push({
        criterionId: criterion.id,
        rule: 'score-in-range',
        message: `Score ${score.score} for "${criterion.name}" is not an integer in 0–100.`,
      })
    }

    if (score.confidence < 0 || score.confidence > 1) {
      issues.push({
        criterionId: criterion.id,
        rule: 'confidence-in-range',
        message: `Confidence ${score.confidence} for "${criterion.name}" is outside 0–1.`,
      })
    }

    if (score.kind === 'judgement') {
      if (score.evidence.length === 0) {
        issues.push({
          criterionId: criterion.id,
          rule: 'evidence-present',
          message: `"${criterion.name}" was scored without quoting the submission.`,
        })
      }
      for (const span of score.evidence) {
        if (!gradedText.includes(span)) {
          issues.push({
            criterionId: criterion.id,
            rule: 'evidence-verbatim',
            message: `Evidence quoted for "${criterion.name}" does not appear in the submission.`,
          })
        }
      }
    }
  }

  return issues
}
