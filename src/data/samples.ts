import type { Submission } from '../engine/types'

/**
 * Synthetic submissions.
 *
 * Every name, ID and mark in this file is invented for the demonstration. No
 * real student work appears anywhere in this prototype, and the interface says
 * so wherever a record is shown.
 */

export const COURSE = {
  code: 'MBA-514',
  name: 'Retail & Supply Chain Analytics',
  assignment: 'Case Study 2 — Regional assortment rationalisation',
  term: 'Term 3, 2026',
  enrolled: 214,
  deadline: '14 Aug 2026, 23:59 GST',
}

const STRONG = `Executive summary

Meridian Foods operates 148 stores across four emirates and carries 9,400 active SKUs. This analysis examines whether the regional assortment can be reduced without losing revenue, and finds that 11% of SKUs can be delisted with a projected revenue impact of under 0.4%. Three categories carry stockout costs above their carrying costs by a factor of more than two, and the recommendation is to reallocate the released shelf space into those categories rather than to hold the saving.

Methodology

Transaction data covers 26 weeks to 30 June 2026, aggregated weekly per SKU per store. Three preparation steps were applied before any comparison was made. First, the series was deseasonalised using a 13-week trailing median, because Ramadan and back-to-school promotions distort the raw weekly series enough to reverse the ranking of two categories. Second, price elasticity was estimated per category rather than per SKU, since 62% of SKUs recorded fewer than 30 transactions per store per week and per-SKU estimates at that volume are not stable. Third, stores were clustered into four groups on footfall and basket composition, and every comparison in this analysis is made within a cluster.

Stockout cost was estimated as the deseasonalised weekly units lost multiplied by the category contribution margin, with lost units inferred from the gap between shelf availability and the cluster median. Carrying cost was taken from the finance baseline of 14.2% annualised on average inventory value. Both figures are approximations, and the sensitivity of the conclusion to each is reported in the limitations section.

Findings

Eleven per cent of SKUs, representing 2.1% of revenue over the period, contributed less than 0.15% of category margin each. These SKUs are concentrated in ambient grocery and household, and 71% of them are duplicated within their own category by a product with a higher margin and comparable elasticity.

Three categories show stockout cost exceeding carrying cost by more than a factor of two. Chilled dairy runs at 2.4 times, fresh bakery at 2.2 times, and household paper at 2.0 times. In each case the deseasonalised series shows availability falling below 92% on more than nine weeks in twenty-six, and the cluster with the highest footfall is worst affected rather than best served.

Reordering thresholds were recomputed against a 94% service-level target using the deseasonalised demand and the observed lead-time variance. The simulation lifts availability by 3.1 points at flat inventory value, because the additional cover in the three named categories is funded by the reduction in the delisted long tail rather than by new working capital. Applied across the 148 stores, the modelled contribution gain is 1.9% of category margin.

Elasticity estimates differ sharply by cluster. The high-footfall cluster is 0.4 points less price-sensitive in chilled dairy than the network average, which means the availability gain there converts to margin more efficiently than a uniform rollout would suggest. A staged rollout beginning with that cluster is therefore preferred to a network-wide change.

Limitations

Three limitations bound this recommendation. The elasticity estimates assume competitor pricing is held constant across the 26 weeks, which the dataset cannot confirm, and a sustained competitor promotion in chilled dairy would compress the modelled gain by an estimated 0.6 points. The store clustering uses a single season of footfall, so a cluster boundary that shifts seasonally would move approximately 9 stores between groups and dilute the staged rollout. Lost units are inferred rather than observed, since the point-of-sale system does not record unfulfilled demand; the inference is therefore a lower bound and the stockout costs quoted here are conservative.

None of the three reverses the ranking of the categories. The first materially affects the size of the gain, and it is the reason the recommendation is staged rather than committed network-wide.

Recommendation

Delist the 11% tail in ambient grocery and household in the high-footfall cluster first, and reallocate the released space to chilled dairy and fresh bakery in the same stores. Hold the remaining three clusters for one further quarter and use the first cluster as a controlled comparison, because the elasticity difference between clusters is large enough that a single network-wide rollout would not distinguish a real gain from a cluster effect. Review the 94% service-level target after one quarter against observed rather than inferred stockouts, since the availability instrumentation is the weakest input in this analysis and is also the cheapest to improve.`

const WEAK = `Summary

This report looks at the assortment at Meridian Foods and recommends removing slow products. The company has many stores and a lot of SKUs, and some of them do not sell well. Removing them should improve profitability and free up space for better products.

Methodology

The data was analysed in a spreadsheet. Weekly sales per product were reviewed and the products were sorted from highest to lowest. Products in the bottom group were marked as candidates for removal. Categories were compared against each other to see which ones performed best overall. Some seasonal effects were noticed in the data but these were not adjusted for because the overall ranking looked stable.

Findings

The bottom group of products makes up a small share of revenue. Many of them appear to overlap with other products in the same category, so customers would probably buy the alternative if the slow product was not available. Some categories run out of stock more often than others, and these tend to be fresh categories, which is expected because they have shorter shelf lives.

Chilled dairy and bakery both had availability problems during the period. Household paper also had issues but less often. Increasing stock levels in these categories would likely improve sales, although this would also increase the amount of inventory held.

The stores are quite different from each other. Larger stores in busier areas sell more and have different customer profiles. A single approach across all stores may not work equally well everywhere.

Recommendation

Meridian Foods should remove the slow-moving products and increase stock in the categories that run out. This will improve availability and profitability. The change should be applied across the network so that customers get a consistent experience, and the results should be reviewed after some time to see whether it worked.`

const LATE = `Executive summary

This analysis reviews assortment efficiency at Meridian Foods across 148 stores over 26 weeks and recommends a targeted reduction of 8% of SKUs, concentrated in ambient grocery. The projected revenue impact is 0.5%, and the released space is reallocated to chilled categories where availability is the binding constraint.

Methodology

Weekly per-SKU sales were aggregated by store and adjusted for seasonality using a 13-week trailing median, because the raw series contains two promotional peaks that would otherwise dominate the ranking. Contribution margin was taken from the finance baseline. Categories were compared on margin per shelf metre rather than on absolute revenue, since shelf space is the constraint being reallocated. Stores were grouped into three bands by weekly footfall.

Findings

Eight per cent of SKUs contribute 1.6% of revenue and 0.9% of margin. Within that group, 64% are duplicated by a higher-margin product in the same category and price band, so the substitution risk on delisting is limited.

Availability in chilled dairy fell below 93% in 11 of 26 weeks, and in fresh bakery in 8 of 26. Both categories carry a contribution margin above the store average, so each lost unit costs more than the equivalent unit in the categories being reduced. Recomputing reorder points against a 93% target lifts modelled availability by 2.4 points without increasing total inventory value, because the reduction funds the cover.

The highest-footfall band shows the largest availability gap and also the highest margin per shelf metre, which means the same intervention is worth more in those stores. Across that band the modelled contribution gain is 1.4% of category margin, against 0.6% in the lowest band, and the difference is large enough that a network-wide average would misrepresent both.

Within the delisting candidates, three subcategories behave differently from the rest. Speciality condiments show low volume but high basket attachment, appearing in 6% of baskets that also contain a premium line, and were therefore excluded from the list despite meeting the volume threshold. Seasonal confectionery is concentrated in two peaks and was assessed on peak-period contribution rather than on the 26-week average. Imported ambient grocery carries longer lead times, so the carrying-cost figure understates the working capital actually tied up, and those lines were ranked using a lead-time-adjusted figure instead.

Lead-time variance is the second constraint on availability after order quantity. In chilled dairy the observed variance is 1.8 days against a planning assumption of 0.9, which alone accounts for roughly a third of the availability gap. Raising the reorder point without addressing the variance therefore buys availability with inventory rather than with accuracy, and the modelled 2.4-point gain assumes the planning assumption is corrected in the same change.

Limitations

The margin figures are category averages and mask variation within a category, so the delisting list should be reviewed at SKU level before it is actioned. Roughly 15% of the candidates sit within 0.1 points of the threshold, and a category-level error of that size would move them either way. Stockouts are inferred from shelf availability rather than measured, which understates the true cost and makes the projected gain a lower bound rather than an estimate. Competitor activity is not in the dataset at all, so the elasticity figures assume a stable competitive position that cannot be verified from the data available.

Recommendation

Delist the 8% list in the highest-footfall band and reallocate to chilled dairy and fresh bakery in the same stores. Correct the lead-time planning assumption in the same change, because the availability gain modelled here is not achievable at flat inventory value without it. Measure for one quarter against the other two bands before extending, and treat the two untouched bands as the comparison rather than the prior period, since the prior period contains the promotional peaks that the seasonal adjustment only partially removes.

Improve availability instrumentation before the next review. The weakest input in this analysis is also the one that decides whether the gain is real, and it is the cheapest of the three limitations to close. A shelf-level availability capture in twelve representative stores would replace the inference for roughly 8% of the estate at a cost well below the modelled quarterly gain, and would let the next review report a measured figure rather than a bounded one.`

const SCANNED = `Executive summary. This report reviews the assort ment at Meridian Foods and recomm ends a redu ction of slow moving lines. The analysis covers 148 st ores. Methodology. Sales data was revie wed weekly. Seasonal effects were adjus ted. Find ings. The bottom group of pro ducts contributes little margin. Chilled categ ories run out of stock more often. Recomm endation. Reduce the tail and increase cover in chilled.`

export const SUBMISSIONS: Submission[] = [
  {
    id: 'sub_2211',
    student: 'Priya Nandakumar',
    studentId: 'MBA-514-A17',
    course: COURSE.code,
    assignment: COURSE.assignment,
    attempt: 2,
    fileName: 'nandakumar_p_case2_final.pdf',
    sizeKb: 412,
    pages: 9,
    submittedAt: '2026-08-11T21:04:00+04:00',
    lateHours: 0,
    ocrConfidence: 0.98,
    text: STRONG,
  },
  {
    id: 'sub_2214',
    student: 'Omar Al-Bakri',
    studentId: 'MBA-514-B04',
    course: COURSE.code,
    assignment: COURSE.assignment,
    attempt: 1,
    fileName: 'omar_case_study_2.docx',
    sizeKb: 96,
    pages: 4,
    submittedAt: '2026-08-13T18:22:00+04:00',
    lateHours: 0,
    ocrConfidence: 0.99,
    text: WEAK,
  },
  {
    id: 'sub_2219',
    student: 'Ravi Menon',
    studentId: 'MBA-514-C11',
    course: COURSE.code,
    assignment: COURSE.assignment,
    attempt: 1,
    fileName: 'menon_case2.pdf',
    sizeKb: 288,
    pages: 7,
    submittedAt: '2026-08-16T11:47:00+04:00',
    lateHours: 36,
    ocrConfidence: 0.96,
    text: LATE,
  },
  {
    id: 'sub_2226',
    student: 'Fatima Al-Suwaidi',
    studentId: 'MBA-514-A03',
    course: COURSE.code,
    assignment: COURSE.assignment,
    attempt: 1,
    fileName: 'scan_20260814_case2.zip',
    sizeKb: 8140,
    pages: 11,
    submittedAt: '2026-08-14T22:51:00+04:00',
    lateHours: 0,
    ocrConfidence: 0.41,
    text: SCANNED,
  },
  {
    id: 'sub_2231',
    student: 'Marcus Oduya',
    studentId: 'MBA-514-D08',
    course: COURSE.code,
    assignment: COURSE.assignment,
    attempt: 1,
    fileName: 'oduya_case2_export.pdf',
    sizeKb: 1204,
    pages: 0,
    submittedAt: '2026-08-14T23:58:00+04:00',
    lateHours: 0,
    ocrConfidence: 0,
    text: '',
    corrupt: true,
  },
]

export const SAMPLE_NOTES: Record<string, string> = {
  sub_2211: 'Complete submission, clean text layer. Use this one to run the duplicate demonstration.',
  sub_2214: 'Short, asserts rather than evidences, and omits two required sections. The mechanical penalties are visible in full.',
  sub_2219: '36 hours late. The penalty is arithmetic and is computed in code, not judged by the model.',
  sub_2226: 'Scanned bundle. Extraction confidence 0.41 — below the gate, so it is never graded.',
  sub_2231: 'Truncated export. Rejected at intake before a grading job exists.',
}

export function submissionById(id: string): Submission | undefined {
  return SUBMISSIONS.find((s) => s.id === id)
}
