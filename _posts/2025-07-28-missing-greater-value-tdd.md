---
layout: post
title: "TDD Tests Assumptions, Not Just Code"
date: 2025-07-28
tags: [tdd, testing, software-design, best-practices]
description: "TDD's real value isn't code coverage, it's catching wrong assumptions before you deliver the wrong thing."
---

In software development, the more expensive mistake isn't buggy code; it's building the wrong thing. Teams should be focused on preventing the delivery of features that don't match what users need, implementing requirements that were misunderstood, or discovering halfway through that the domain model was wrong. Test-Driven Development (TDD) is one solution to this problem, but it's often a very poorly understood concept and even those who do understand it can still do TDD wrong.

The promise of TDD is that tests guide design and catch bugs early. The reality, sometimes, is that teams write tests for features they don't yet understand, design interfaces around incomplete requirements, and spend hours on tests that get thrown away when understanding finally arrives. The resulting debate often gets heated. Advocates measure test coverage and celebrate red-green-refactor. Skeptics count rewritten tests as waste. Both sides miss what actually happened: when done right, those rewritten tests forced understanding before the wrong system got built and delivered. When done wrong, they were just ceremony.

<blockquote class="pull-quote">
<p>TDD's value isn't in the tests. It's in the understanding that writing them demands.</p>
</blockquote>

## Testing Assumptions, Not Just Code

Most discussions frame TDD as a code quality tool: write tests first, implement to pass, refactor for quality. Coverage metrics become the measure of success. But every test is also a test of assumptions about user needs and business logic. When you write a test asserting business rules, you're testing assumptions about how the system should behave. Not just your assumptions as a developer, but the assumptions baked into the requirements themselves. Writing the test first means you don't build for days before discovering misalignment. You might find that an entire scope of work needs to go back for reconsideration, and finding that on day one is obviously better than finding it on day ten.

Consider a test asserting that `CalculateDiscount(customer)` returns 15% for "premium" customers. That test encodes assumptions about what "premium" means, what discount they deserve, and whether discounts even work this way. Discovery can happen immediately: writing the test forces you to define "premium" concretely, and you realize the customer object has no tier field, or that the pricing service doesn't support percentage-based discounts, or that the requirement contradicts existing business rules. The act of writing the test surfaces the gap before any implementation begins. Or discovery happens later when product clarifies that discounts are tiered by purchase history rather than customer tier. Either way, the test change isn't waste. It's learning captured before shipping wrong behavior.

Changed tests aren't waste; they're evidence of learning. The earlier you surface wrong assumptions, the cheaper they are to fix. Tests force specific questions that conversation alone won't surface. Writing assertions exposes complexity that wasn't obvious when discussing requirements abstractly.

This doesn't mean tests must stay purely conceptual to avoid waste. Mocked code and implementation details in tests encode their own assumptions that sometimes only get validated through actual implementation. Some test code will get thrown away. That's fine. A little code waste is a small price compared to the larger waste of building the wrong system because critical misalignments went undiscovered. That said, when large test refactors happen repeatedly, it might signal something else: the developer who wrote the initial tests wasn't focused on alignment and was just going through the motions.

TDD treated as a checklist rather than a discipline for understanding will produce tests that don't surface assumptions early. The waste isn't in TDD itself; it's in treating TDD as compliance rather than inquiry.

## Stop Measuring Success by Tests

This reframing should change what we measure, but not by replacing one test metric with another. Using test coverage as a success metric is a distraction. Measuring "assumptions caught" would be too. Value delivered is the only meaningful measure of success.

Coverage metrics can still provide useful insight into quality gaps, but think in terms of use case coverage rather than line coverage. Are the critical business scenarios tested? Are the edge cases stakeholders care about covered? That's a different question than "what percentage of lines have tests?"

Tests are a tool, not an outcome. When teams treat coverage percentages as goals or count rewritten tests as waste, they've confused the means for the end. What matters isn't "how many tests do we have?" or "how many wrong assumptions did we catch?" but "did we deliver what users actually needed?"

The test suite does have secondary value as documentation that new developers can read to understand system constraints without digging through old conversations and tickets. But that's a side effect, not a success metric.

## What This Means Practically

Focus on testing assumptions that matter most. Not all assumptions carry equal risk. Prioritize tests that validate:

- **Business rules** — How discounts work, what triggers notifications, when transactions are valid
- **Edge cases stakeholders haven't considered** — What happens when the cart is empty? When the user has no purchase history?
- **Data validity assumptions** — What "valid" input looks like, what formats are acceptable, what happens with missing fields

If requirements are clear and stable, write tests to validate implementation. If requirements are uncertain, write tests to validate assumptions and expect them to change as understanding develops. That question matters more than any debate about test-first versus test-after.

The better question is what assumptions you're making about user needs and how to validate them fastest. Sometimes that's writing a test first, other times it's building a prototype first, and sometimes it's showing mockups to users first. The goal isn't perfect tests; it's validated understanding.

<blockquote class="pull-quote">
<p>The greatest value of TDD isn't in the tests that pass. It's in the tests that change because they revealed flawed assumptions.</p>
</blockquote>

## Start with Understanding

Writing the test first forces a question: what should this code actually do? That question demands understanding before implementation. The passing assertion represents a commitment: this is the contract we're building to. Implementation honors that commitment by making the test pass.

When tests change during development, you're realigning based on discovery. When tests fail after changes, they're surfacing broken commitments that need attention. The discipline isn't about tests; it's about starting with understanding, securing genuine commitment to what you're building, and then honoring what was agreed.

Building the wrong thing is the most expensive mistake in software development. TDD addresses this by forcing clarity before code, but only when practiced as inquiry rather than compliance. Tests that surface wrong assumptions early are valuable even when they get rewritten. Tests written as ceremony produce waste without insight.

Stop treating coverage as a goal. Stop counting rewritten tests as failure. If requirements are uncertain, write tests to validate assumptions and expect them to change. If requirements are clear, write tests to validate implementation. Either way, measure what matters: did you deliver what users actually needed?

TDD isn't just a testing practice. It's a discipline for understanding.
