---
title: "Analytics and Statistics"
layout: guide
category: Data & Analytics
subcategory: Analytics
description: "How to summarize data honestly and tell a pattern from noise: variable types, center and spread, distributions and skew, correlation, sampling and confidence intervals, hypothesis testing with p-values and power, confounding and Simpson's paradox, regression to the mean, and choosing a chart."
tags: [statistics, hypothesis-testing, confidence-intervals, probability-distributions, ab-testing, causal-inference, fundamentals]
redirect_from:
  - /study-guides/analytics-and-statistics.html
---

Analytics is the work of turning data into a decision, and statistics is the toolkit that keeps the conclusions honest. Most analytical mistakes aren't arithmetic errors. They come from summarizing skewed data with the wrong number, treating noise as a pattern, or reading a cause into a correlation. This guide follows one online store from its first look at its order data through a controlled experiment, and introduces each idea at the point the store needs it.

## What Analysis Asks

### Four Questions, in Rising Difficulty

Gartner's widely used framing sorts analytics by the question it answers, and presents the four types in rising order of difficulty and value.

| Type | Question | The store asks | Typical methods |
| --- | --- | --- | --- |
| **Descriptive** | What happened? | What's our typical order value? | Summary statistics, charts, dashboards |
| **Diagnostic** | Why did it happen? | Why did conversions drop in March? | Segmenting, drill-down, correlation, experiments |
| **Predictive** | What will happen? | How many orders should we expect next month? | Forecasting, regression, [machine learning](/study-guides/ai/machine-learning.html) |
| **Prescriptive** | What should we do? | Should we ship the new checkout page? | Experiments, optimization, decision analysis |

Start from the decision the analysis will inform. "Analyze our checkout data" has no finish line. "Decide whether the redesigned checkout page should replace the current one" tells you which data matters, which comparison to make, and how large a difference would change the decision.

### Exploring Versus Confirming

Exploratory analysis looks through data for patterns without a hypothesis in mind. It uses the charts and summaries in this guide, and sometimes clustering to find natural groups of customers. Confirmatory analysis tests a specific claim stated in advance.

The two need to stay separate. Exploring a large dataset will turn up patterns by chance alone, and a pattern found by exploring is only a hypothesis. Confirming it means testing it on data that wasn't used to find it, ideally data collected for that purpose. Testing a hypothesis against the same data that suggested it tends to show a good fit and proves nothing.

## Kinds of Data

The type of a variable decides which summaries and charts mean anything.

| Type | What it is | Store examples | Meaningful summaries |
| --- | --- | --- | --- |
| **Nominal** | Categories with no order | Payment method, product category | Counts, proportions, mode |
| **Ordinal** | Categories with an order but uneven gaps | Satisfaction rating (1 to 5), shipping tier | The above, plus median and percentiles |
| **Discrete** | Countable whole numbers | Items per order, support tickets per day | All of the above, plus mean and standard deviation |
| **Continuous** | Any value in a range | Order value, page load time | All of the above |

Nominal and ordinal variables are *categorical*, and discrete and continuous variables are *quantitative*.

Ordinal data is the common trap. Survey ratings are stored as numbers, so tools will happily average them, but the gap between "dissatisfied" and "neutral" isn't necessarily the same as the gap between "satisfied" and "very satisfied." An average rating of 3.6 can hide a split between delighted and angry customers. Report the distribution of ratings, or the share of customers who chose one of the top two ratings, rather than leaning on the mean alone.

## Summarizing a Distribution

A *distribution* describes which values a variable takes and how often. Summaries compress it into a few numbers, and choosing the wrong ones is where descriptive analysis usually goes wrong.

Here are eleven order values, in dollars, from the store's first morning:

```
14, 18, 22, 25, 27, 30, 34, 41, 48, 60, 310
```

The 310 is a customer who bought a bulk order. This section keeps returning to these eleven numbers.

### Center: Mean, Median, and Mode

- **Mean.** The sum divided by the count. Here, 629 ÷ 11 = **$57.18**.
- **Median.** The middle value once sorted, or the average of the two middle values when the count is even. Here, the sixth value, **$30**.
- **Mode.** The most frequent value. It suits categorical data ("most orders use a card"), and it rarely means much for continuous values, where exact repeats are rare.

The mean is nearly double the median, and only two of the eleven orders are above it. The single $310 order pulled the mean away from every other customer. Remove that order and the mean falls to $31.90 while the median barely moves, to $28.50. Neither number is wrong. The mean answers "what's the total divided evenly?", which matters for revenue planning. The median answers "what does a typical customer spend?", which matters for pricing and free-shipping thresholds.

### Spread: Range, Variance, and Standard Deviation

Two datasets can share a center and differ entirely in how scattered they are, so a center without a spread is half a summary.

- **Range.** The maximum minus the minimum, here 310 − 14 = $296. It depends on the two most extreme values only, so a single outlier sets it.
- **Variance.** The average squared distance from the mean. Squaring makes every distance positive and weights large distances heavily. Its units are squared dollars, which is awkward to interpret.
- **Standard deviation (SD).** The square root of the variance, back in dollars. It's the typical distance of a value from the mean, with large distances counting extra.

For the sample standard deviation:

```
SD = √( Σ(x − mean)² ÷ (n − 1) )
```

Dividing by *n* − 1 rather than *n* corrects for the fact that a sample's values sit closer to their own mean than to the population's mean, which would otherwise make the spread look smaller than it is.

The eleven orders have an SD of **$84.93**. Without the bulk order, the SD is $14.23. The outlier inflated it six-fold, because the squaring gives its distance of about $250 from the mean enormous weight.

### Percentiles, Quartiles, and the Box Plot

The *p*th percentile is the value below which *p*% of the data falls. The median is the 50th percentile. The 25th and 75th are the first and third *quartiles*, Q1 and Q3. Percentiles describe position rather than averaging, so a single extreme value can't drag them far.

The **interquartile range (IQR)** is Q3 − Q1, the span of the middle half of the data. Using the interpolation method most spreadsheets use by default, the orders have Q1 = $23.50 and Q3 = $44.50, so the IQR is **$21**. Other software can compute slightly different quartiles for small samples, because there are several conventions for interpolating between values.

A **box plot** draws this summary. The box spans Q1 to Q3 with a line at the median, and whiskers extend to the most extreme values within 1.5 × IQR of the box. Anything beyond that fence is plotted as a separate point.

{% include figure.html id="st-box-plot" %}

Percentiles are also how engineers specify latency. A 95th-percentile response time says what 95% of requests beat, which an average can't. The [performance engineering guide](/study-guides/architecture/performance-engineering.html) covers why the tail of that distribution matters so much.

### Robust Statistics and Outliers

A statistic is *robust* if a few extreme values can't move it much. The median and IQR are robust. The mean, SD, and range are not.

| Sensitive to outliers | Robust counterpart |
| --- | --- |
| Mean | Median |
| Standard deviation | IQR, or the median absolute deviation |
| Range | IQR |

The **median absolute deviation** is the median of each value's distance from the median. For the orders, it's **$11**. Watch the abbreviation, because "MAD" also stands for the *mean* absolute deviation, which averages the distances from the mean and is pulled by outliers the same way the mean is.

Two common rules flag outliers:

- **The IQR fence.** Values below Q1 − 1.5 × IQR or above Q3 + 1.5 × IQR. For the orders, the upper fence is 44.50 + 31.50 = $76, and only the $310 order is beyond it. This is the rule behind the box plot.
- **The z-score.** A value's distance from the mean in standard deviations. Values beyond 3 SD are commonly flagged. The rule works poorly on small or skewed samples, because the outlier inflates the SD it's measured against. The $310 order is 2.98 SD from the mean, just inside the cutoff, because it pushed the SD up to $85 by itself. The z-score rule misses the one order that the IQR fence catches.

A flagged value is a question, not a verdict. The $310 order is a legitimate customer, and deleting it would understate revenue. Other outliers are data-entry errors, test transactions, or bot traffic, and they should go. Decide which case applies, and state in the results what was excluded and why.

## Shapes of Distributions

Summary statistics behave differently depending on the shape of the data, so look at the shape before choosing them. A **histogram** shows it by counting how many values fall into each of a series of equal-width bins. With many values and narrow bins, the tops of the bars smooth into a curve. The charts in this section draw that curve, where height shows how common a value is.

### The Normal Distribution

The normal distribution is the symmetric bell curve. Mean, median, and mode coincide at its peak, and it's fully described by its mean and standard deviation. Measurements that result from many small, independent effects adding together tend toward it, such as repeated measurements of the same quantity, manufacturing tolerances, and adult heights within one sex.

In a normal distribution, a fixed share of the values falls within each distance of the mean:

- About **68%** within 1 SD
- About **95%** within 2 SD
- About **99.7%** within 3 SD

{% include figure.html id="st-normal-bands" %}

This rule is also where the "beyond 3 SD" outlier cutoff comes from, and it only holds for data that's roughly normal. Many statistical methods assume normality somewhere, and the assumption matters less than it first appears for reasons covered under the central limit theorem below.

### Skewed Distributions

A distribution is **skewed** when one tail is longer than the other. Skew often appears when a variable has a hard floor but no ceiling, or the reverse.

- **Right-skewed** (positive skew): most values are small, with a long tail of large ones. Order values, page load times, file sizes, and income are right-skewed. They can't go below zero, but a few can be very large.
- **Left-skewed** (negative skew): most values are large, with a tail of small ones. Scores on an easy test are left-skewed, because they bunch near the maximum and a few low scores trail off.

In a right-skewed distribution, the tail pulls the mean toward it, so the mean usually sits above the median. The store's orders show exactly that. The rule is a tendency rather than a law. Paul von Hippel's ["Mean, Median, and Skew: Correcting a Textbook Rule"](https://jse.amstat.org/v13n2/vonhippel.html){:target="_blank" rel="noopener noreferrer"} shows it can fail, particularly for discrete data, so check the shape rather than inferring it from the mean and median alone.

{% include figure.html id="st-skew-center" %}

For skewed data, report the median and percentiles as the typical value, and keep the mean when the total matters.

### Two Peaks: Mixed Populations

A **bimodal** distribution has two peaks, and it often means two populations have been mixed together. Response times for a cached endpoint can look like this, with fast cache hits in one cluster and slow misses in another. The mean of a bimodal distribution can fall in the valley between the peaks and describe no request at all. Split the data by its cause (hit or miss, mobile or desktop, new or returning customer) and summarize each group on its own.

{% include figure.html id="st-bimodal" %}

## Correlation

The **correlation coefficient** (Pearson's *r*) measures how closely two quantitative variables follow a straight line. It ranges from −1 to +1:

- **+1**: the points lie exactly on a rising line
- **0**: no *linear* relationship
- **−1**: the points lie exactly on a falling line

The sign gives the direction and the size gives how tightly the points hug the line. It says nothing about how steep the line is, so a tight but shallow relationship can have a larger *r* than a loose, steep one.

The coefficient only sees straight lines. Two variables can be strongly related along a curve and still have *r* near zero, and a single extreme point can create a strong *r* in otherwise unrelated data. Statistician Francis Anscombe made this point in [a 1973 paper](https://doi.org/10.1080/00031305.1973.10478966){:target="_blank" rel="noopener noreferrer"} with four small datasets, now called Anscombe's quartet. All four have nearly the same means, variances, and correlation, and they look nothing alike when plotted. Plot the data before trusting the coefficient.

{% include figure.html id="st-correlation-shapes" %}

A strong correlation also doesn't mean one variable causes the other. That problem gets its own section below.

## From a Sample to the Population

The store's analysis so far has described data it has. Most business questions are about data it doesn't have, such as all future visitors rather than the ones who came this week. **Inferential statistics** uses a *sample* to draw conclusions about the *population* it came from, and states how uncertain those conclusions are.

### How Samples Go Wrong

A sample supports inference only if it represents the population. A random sample does that on average, because every member of the population has an equal chance of being included. Most real samples aren't random, and the biases that creep in don't shrink as the sample grows.

- **Selection bias.** The sample is drawn from a subset that differs from the population. Surveying customers through an in-app prompt reaches only the people who still use the app.
- **Survivorship bias.** Only the cases that survived some filter are visible. Studying the habits of long-lived startups says little about what works, because the failures that had the same habits aren't in the data.
- **Non-response bias.** The people who answer differ from those who don't. Customers with strong opinions answer satisfaction surveys more often than indifferent ones.

A million biased responses estimate the wrong thing with great precision. A smaller random sample is more trustworthy.

### Sample Size and the Standard Error

The mean of a sample won't exactly equal the population's mean, and a different sample would give a different answer. The **standard error** (SE) measures how much a sample mean would vary from sample to sample:

```
SE = SD ÷ √n
```

A proportion, such as a conversion rate, works the same way. Each visitor either converts (1) or doesn't (0), and the SD of those 0s and 1s is √(p × (1 − p)), where *p* is the rate. So the standard error of a rate is √(p × (1 − p) ÷ n). For a 4% rate measured on 10,000 visitors, that's √(0.04 × 0.96 ÷ 10,000) ≈ 0.002, or 0.2 percentage points. A *percentage point* is the unit of a difference between two percentages, so a rate that moves from 4.0% to 4.2% has moved 0.2 percentage points.

Precision grows with the square root of the sample size. Quadrupling the sample halves the standard error, and a tenfold increase shrinks it by a factor of about three.

For a large population, the precision of an estimate depends on the size of the sample, not on what fraction of the population it covers. A random sample of 1,000 people estimates a national proportion about as precisely as it estimates a city's. A sample doesn't need to reach some share of the population, such as 10%, to be valid. Textbooks do mention a 10% figure, but as an *upper* limit. The standard formulas assume each draw is *independent*, meaning one draw doesn't change the chances of the next. Sampling without replacement, where nobody can be picked twice, breaks that slightly, because each pick shrinks what's left. When the sample exceeds about 10% of the population, the effect is large enough that the formulas need a correction.

### The Central Limit Theorem

The **central limit theorem** says that the means of repeated random samples form an approximately normal distribution, even when the underlying data isn't normal, as long as each sample is large enough. The order values are heavily right-skewed, yet the average order value across many samples of a few hundred orders would still follow a bell curve around the true average.

{% include figure.html id="st-clt" %}

That's why so many methods built on the normal distribution work on data that isn't normal. They're applied to sample means and proportions, not to individual values. The rule of thumb that *n* ≥ 30 is "large enough" is only a rough guide. Heavily skewed data, like the store's orders with their occasional bulk purchase, can need samples in the hundreds or more before the sample mean behaves normally.

### Confidence Intervals

A **confidence interval** gives a range of plausible values for the population quantity instead of a single estimate. For a mean, the 95% interval is approximately:

```
mean ± 1.96 × SE
```

The 1.96 comes from the normal distribution, where 95% of values fall within 1.96 SD of the center. For small samples, where the SD itself is estimated imprecisely, methods use a larger multiplier from the *t distribution* instead, such as 2.26 for a sample of 10.

The "95%" describes the method, not any one interval. If the store drew 100 samples and built an interval from each, about 95 of the intervals would contain the true population value and about 5 would miss it. Any single interval either contains the true value or doesn't, and there's no way to know which from the sample alone. Saying "there's a 95% probability the true value is in this interval" is a common misreading.

{% include figure.html id="st-confidence-intervals" %}

Width is the useful signal. A narrow interval means the data pins the value down, and a wide one means it doesn't, whatever the point estimate says.

## Is the Difference More Than Noise?

The store redesigns its checkout page and runs an **A/B test**. Visitors are randomly assigned to the current page (control) or the new one (variant), and the store counts how many place an order.

| Group | Visitors | Orders | Conversion rate |
| --- | --- | --- | --- |
| Control | 10,000 | 400 | 4.0% |
| Variant | 10,000 | 460 | 4.6% |

The variant converted 0.6 **percentage points** better, the absolute difference between 4.0% and 4.6%. Testing tools often report the **relative** lift instead, 0.6 ÷ 4.0 = 15%. Both describe the same result, and mixing them up makes a modest change sound large. Random assignment will never split visitors into two perfectly identical groups, so some difference would appear even if the pages performed the same. A hypothesis test asks whether this difference is larger than chance would plausibly produce.

### Null and Alternative Hypotheses

A test starts by assuming the boring explanation. The **null hypothesis** (H₀) says there's no difference between the pages, and any gap in the data comes from which visitors happened to land in which group. The **alternative hypothesis** (H₁) says the pages convert differently. The test measures how surprising the data would be if the null were true.

### The p-value

The **p-value** is the probability of seeing a difference at least as large as the observed one if the null hypothesis were true. Computing it takes two steps.

First, find how much the difference between two rates would vary by chance. Under the null hypothesis, both pages share one rate, estimated by pooling the groups: 860 orders from 20,000 visitors, or 4.3%. Each group's rate has its own chance variation, and when two independent quantities are subtracted, their variances add. So the standard error of the difference between two groups of 10,000 is √(0.043 × 0.957 × (1 ÷ 10,000 + 1 ÷ 10,000)) ≈ 0.287 percentage points.

Second, divide the observed difference by that standard error. 0.6 ÷ 0.287 ≈ 2.09. This is a z-score, the same idea as the outlier z-score earlier, applied to the difference between the pages. It says the observed gap is 2.09 standard errors from zero. Differences in rates follow a normal curve by the central limit theorem, so the share of that curve beyond 2.09 standard errors in either direction gives the p-value, about **0.036**. This procedure is called a two-proportion z-test. If the two pages really performed the same, a gap of 0.6 points or more in either direction would appear in about 3.6% of tests like this one.

{% include figure.html id="st-p-value" %}

Before running the test, the team picks a **significance level** (α), the p-value threshold below which it will reject the null. The conventional choice is 0.05. Since 0.036 is below 0.05, the result is called *statistically significant*. For a two-sided test at α = 0.05, that's the same as the z-score landing beyond ±1.96. Here that bar sits at 1.96 × 0.287 ≈ 0.56 percentage points, and the observed 0.6 is just past it.

The p-value is widely misread. The American Statistical Association's [statement on p-values](https://www.tandfonline.com/doi/full/10.1080/00031305.2016.1154108){:target="_blank" rel="noopener noreferrer"} sets out what it does and doesn't mean:

- It is **not** the probability that the null hypothesis is true. A p-value of 0.036 doesn't mean there's a 3.6% chance the pages perform the same.
- It is **not** a measure of how large or important the effect is. A trivial difference can have a tiny p-value with enough data.
- A result just below 0.05 isn't qualitatively different from one just above it. The threshold is a convention, and a decision shouldn't rest on it alone.

### Two Ways to Be Wrong

A test decides under uncertainty, so it can err in either direction.

|  | The pages really are the same | The variant really is better |
| --- | --- | --- |
| **Test says "significant"** | **Type I error** (false positive), probability α | Correct |
| **Test says "not significant"** | Correct | **Type II error** (false negative), probability β |

The significance level caps the false-positive rate. **Power**, equal to 1 − β, is the probability of detecting an effect of a given size if it exists. By convention, experiments aim for 80% power. Lowering α to reduce false positives raises β unless the sample grows, so the two errors trade against each other at a fixed sample size.

### Effect Size and Practical Significance

A significant result says the data would be surprising if there were no difference. It doesn't say the difference is large enough to matter. The confidence interval answers that question. For the checkout test, the 95% interval for the lift is 0.6 ± 1.96 × 0.287, which runs from **0.04 to 1.16 percentage points**. The data is consistent with a lift that's almost nothing and with one nearly twice the observed 0.6 points.

Whether to ship depends on whether the low end of that range still pays for the change. With a million visitors per group, a 0.1-point difference can reach significance, so always report the size of the effect alongside the p-value.

### Deciding the Sample Size in Advance

The sample size needed depends on how small an effect the test must detect and how noisy the measurement is. [Lehr's rule of thumb](https://onlinelibrary.wiley.com/doi/abs/10.1002/sim.4780110811){:target="_blank" rel="noopener noreferrer"} gives the size per group for 80% power at α = 0.05:

```
n per group ≈ 16 × variance ÷ (smallest effect to detect)²
```

For a rate, the variance is p × (1 − p), the square of the SD from the standard error section. Near 4.3%, that's 0.043 × 0.957 ≈ 0.041. Detecting a lift of 0.6 points reliably would take about 16 × 0.041 ÷ 0.006² ≈ **18,000 visitors per group**. The store's test used 10,000 per group. If the true lift were exactly 0.6 points, the test's z-score would land around 2.09 on average, barely past the 1.96 bar, and chance variation would push it below the bar almost half the time. The test had only around a 55% chance of detecting a true lift of that size.

{% include figure.html id="st-power" %}

It happened to reach significance. But when an underpowered test does reach significance, the estimate tends to overstate the true effect, because the samples where chance inflated the difference are the ones most likely to clear the bar. Statisticians Andrew Gelman and John Carlin call this a [Type M, or magnitude, error](https://journals.sagepub.com/doi/10.1177/1745691614551642){:target="_blank" rel="noopener noreferrer"}. A follow-up test at full size would show whether the lift holds.

The formula also shows why small effects are expensive. Halving the smallest effect the test must detect multiplies the required sample by four.

### Choosing a Test

The checkout test compared two proportions. Other questions call for other tests, and the choice follows from the data type and the number of groups. They share the logic of the z-test. Each measures how far the data sits from what the null hypothesis predicts, in units of expected chance variation, and reads a p-value from a known distribution. A *t-test* does this for means, using the t distribution to allow for the SD being estimated from the sample. *Rank-based* tests replace each value with its position in the sorted data (1st, 2nd, 3rd), which makes them robust to outliers and usable on ordinal data.

| Question | Data | Common test |
| --- | --- | --- |
| Do two groups' rates differ? | Yes/no outcomes | Two-proportion z-test, or chi-square test |
| Do two groups' means differ? | Quantitative, roughly normal or large samples | Welch's t-test, which doesn't assume the groups have equal spreads |
| Do two groups differ when data is skewed, ordinal, or small? | Quantitative or ordinal | Mann-Whitney U test |
| Do three or more groups' means differ? | Quantitative | Analysis of variance (ANOVA) |
| Are two categorical variables related? | Counts in a table | Chi-square test of independence |
| Are two quantities associated? | Pairs of values | Pearson correlation test, or Spearman's for ranks or curves that only rise or only fall |

### How Tests Get Fooled

A p-value is only valid if the analysis follows the plan it was computed for. Three common habits break that plan.

- **Peeking.** Checking results daily and stopping the test as soon as p drops below 0.05. The p-value wanders as data arrives, and stopping at its lowest point inflates the false-positive rate well above 5%. Evan Miller's ["How Not to Run an A/B Test"](https://www.evanmiller.org/how-not-to-run-an-ab-test.html){:target="_blank" rel="noopener noreferrer"} shows the effect. Fix the sample size in advance, or use a sequential testing method designed for continuous monitoring.
- **Multiple comparisons.** Testing 20 metrics, or 20 customer segments, at α = 0.05 means about one will come out significant by chance even when nothing changed. The chance that at least one does is 1 − 0.95²⁰ ≈ 64%. Name one primary metric before the test starts, and treat the rest as leads to confirm later, or use a correction such as Bonferroni (dividing α by the number of tests).
- **Changing the analysis after seeing the data.** Trying different outlier rules, date ranges, or segments until something crosses the threshold is known as *p-hacking*. Each variation is another comparison, with the same effect as testing many metrics.

## Correlation Is Not Causation

The store notices that customers who use its wishlist feature spend twice as much as those who don't. It's tempting to promote the wishlist to raise spending. But the data can't say whether the wishlist *causes* higher spending.

### Confounding Variables

In an analysis of cause and effect, the **independent variable** is the one suspected of causing a change (wishlist use), and the **dependent variable** is the outcome measured (spending). A **confounding variable** influences both, and can create or inflate a correlation between them even when neither causes the other. Here, the confounder is engagement. Dedicated customers both explore features like wishlists and buy more, and pushing casual customers toward the wishlist may do nothing for their spending.

The classic illustration is that ice cream sales and drownings rise and fall together. Hot weather drives both, and ice cream causes neither.

### Randomization Breaks Confounding

A randomized experiment answers the causal question that observational data can't. When a coin flip decides who sees the new checkout page, engagement, device, location, and every other trait, measured or not, end up balanced between the groups on average. The only systematic difference left is the page itself, so a significant difference in outcomes can be attributed to it. That's why the A/B test above supports a causal claim and the wishlist correlation doesn't.

When an experiment isn't possible, observational methods can control for the confounders that were measured. *Matching* compares users who are alike on those traits, and *regression adjustment* estimates the effect while holding them constant statistically. They can't account for the ones nobody thought to record, so their causal conclusions stay weaker than an experiment's.

### Simpson's Paradox

A trend in combined data can reverse inside every subgroup. A [1986 study of kidney stone treatments](https://pmc.ncbi.nlm.nih.gov/articles/PMC1339981/){:target="_blank" rel="noopener noreferrer"} by Charig and colleagues, published in the BMJ, is the standard example.

| Stone size | Treatment A success | Treatment B success |
| --- | --- | --- |
| Small stones | **93%** (81 of 87) | 87% (234 of 270) |
| Large stones | **73%** (192 of 263) | 69% (55 of 80) |
| All patients | 78% (273 of 350) | **83%** (289 of 350) |

Treatment A did better for small stones and for large stones, yet B looks better overall. Stone size is the confounder. Doctors used A mostly on large stones, which are harder to treat, so A's combined success rate is weighed down by the difficult cases. Combining the groups hid the variable that mattered.

The same reversal can appear in product data whenever the mix of segments differs between the groups being compared. A conversion rate can improve in every traffic source and still fall overall, simply because more traffic now comes from a lower-converting source. Break results down by the major segments before trusting a combined number.

### Regression to the Mean

An extreme measurement tends to be followed by a less extreme one, because part of what made it extreme was chance, and the chance doesn't repeat. If the store picks its five worst-performing product pages from last month and redesigns them, their numbers will likely improve next month whether or not the redesign did anything. Without a comparison group of poor performers left unchanged, the improvement can't be credited to the redesign.

## Choosing a Chart

A chart answers one question, and the question decides the chart.

| Question | Chart | Watch for |
| --- | --- | --- |
| How is one quantity distributed? | Histogram, or box plot | Bin width changes a histogram's apparent shape, so try a few |
| How do groups' distributions compare? | Side-by-side box plots | A bar of averages hides the spread and the outliers |
| How do categories compare in size? | Bar chart | The value axis must start at zero, since bar length encodes the value |
| How does a value change over time? | Line chart | A line implies continuity, so don't connect unrelated categories |
| How are two quantities related? | Scatter plot | Overlapping points hide density, so use transparency or binning |
| What share does each part make up? | Stacked bar | Pie charts make close shares hard to compare |

A few habits keep charts honest. Show the uncertainty, with error bars or intervals, whenever a chart compares estimates from samples. State the sample size. Skip 3D effects, which distort how values compare, and be wary of dual vertical axes, which can suggest relationships that the choice of scales created. And give each chart a title that states what it shows ("Variant checkout converted 0.6 points better") rather than what it contains ("Conversion by group").
