---
layout: post
title: "TDD Tests Assumptions, Not Just Code"
date: 2025-07-28
tags: [tdd, testing, software-design, best-practices]
description: "TDD's real value isn't code coverage. It's catching wrong assumptions before you deliver the wrong thing."
sources:
  - title: "Introducing BDD, Dan North (2006)"
    url: "https://dannorth.net/blog/introducing-bdd/"
  - title: "Specification by Example, Gojko Adzic (Manning, 2011)"
    url: "https://www.manning.com/books/specification-by-example"
  - title: "A Dissection of the Test-Driven Development Process: Does It Really Matter to Test-First or to Test-Last?, Fucci et al."
    url: "https://arxiv.org/abs/1611.05994"
author: steven-stuart
---

In software development, the mistake that tends to cost more isn't the typical bug. It's building the wrong thing. A bug announces itself when something fails, and the fix is usually local. A wrong feature passes every test, ships, and only shows up when users don't use it. By then the design, the data model, and the code around it all rest on the misunderstanding. Some bugs break that pattern, such as corrupted data or a security hole, but they're the exception rather than the typical case.

Teams should be focused on preventing the delivery of features that don't match what users need, implementing requirements that were misunderstood, or discovering halfway through that the domain model was wrong. Test-Driven Development (TDD) is one solution to this problem, but it's often a very poorly understood concept, and even those who do understand it can still do TDD wrong. Dan North, who coached teams in TDD, wrote in "Introducing BDD" that people's misunderstandings of TDD "almost always came back to the word 'test'." His answer was Behaviour-Driven Development. Practices like Gojko Adzic's Specification by Example put the same concrete examples in front of stakeholders before any code exists. Those are TDD's idea with better vocabulary, and this post is about that idea.

The promise of TDD is that tests guide design and catch bugs early. The reality, sometimes, is that teams write tests for features they don't yet understand, design interfaces around incomplete requirements, and spend hours on tests that get thrown away when understanding finally arrives. The resulting debate often gets heated. Advocates measure test coverage and celebrate red-green-refactor. Skeptics count rewritten tests as waste. Both sides miss what actually happened: when done right, those rewritten tests forced understanding before the wrong system got built and delivered. When done wrong, they were just ceremony.

<blockquote class="pull-quote">
<p>TDD's value isn't in the tests. It's in the understanding that writing them demands.</p>
</blockquote>

## Testing Assumptions, Not Just Code

Most discussions frame TDD as a code quality tool: write tests first, implement to pass, refactor for quality. Coverage metrics become the measure of success. But every test also encodes assumptions about user needs and business logic. When you write a test asserting business rules, you're stating assumptions about how the system should behave, and not just your assumptions as a developer but the ones baked into the requirements themselves. A test can't check those assumptions against users on its own. Writing it makes them concrete enough to check, against the codebase and against someone who knows the business.

Not every test carries business assumptions. Small tests around a class's collaborators mostly serve design. The argument here is about the tests that assert business rules. In an ordinary TDD session those are the first test or two for each new rule, written before you know which classes you'll need. They can catch a requirement that was misunderstood, not one that was wrong to begin with. Whether users value a premium discount at all is a question for prototypes and users, not tests.

For those business-rule tests, timing is the gain. Writing the test first means you don't build for days before discovering misalignment, which is what happens when tests come at the end of a feature or not at all. You might find that an entire scope of work needs to go back for reconsideration, and finding that on day one is obviously better than finding it on day ten.

Consider a test asserting that `CalculateDiscount(customer)` returns 15% for "premium" customers. That test encodes assumptions about what "premium" means, what discount they deserve, and whether discounts even work this way. Discovery can happen immediately, because writing the test forces you to define "premium" concretely. You might realize the customer object has no tier field, or that the pricing service doesn't support percentage-based discounts, or that the requirement contradicts existing business rules.

Even the expected value forces a choice. On a $100 order that already carries a 10% promo code, is the answer $85, $76.50, or $75? Implementation code picks one too, as a line of arithmetic. The developer writing it is thinking about how to calculate, not about what the answer should be. An assertion asks for the answer itself. Working out $76.50 by hand is the moment you notice two discounts are stacking, so the choice gets made knowingly before any implementation begins.

That only helps if the choice reaches someone who knows the business. The habit that makes it work is taking any assertion you had to guess at to the product owner before moving on. TDD doesn't supply that habit. It supplies the moment where the guess becomes visible to the developer.

The test's setup can expose the larger misunderstanding too. To build a premium customer for the test, you have to decide what makes a customer premium, and asking that is how you learn that product meant purchase history rather than a tier. If nobody asks, discovery happens later when product clarifies it. The test is then where the correction lands, as one visible, reviewable edit rather than a hunt through the code. Either way, the test change isn't waste. It's learning captured before shipping wrong behavior.

A wrong assumption found before implementation costs a conversation, and found after, it costs the conversation plus the code built on it. Tests force specific questions that conversation alone often leaves unasked, because an assertion needs an exact input and an exact expected output where a requirements discussion can stay abstract.

Other routes can surface the same guess. A careful developer writing code first can meet the same question, and an example card in a Specification by Example session forces the same choice. TDD's claim isn't that only a test can force the choice. It's that a test-first habit forces the choice every time a developer starts a new rule, as a default rather than a matter of care, including on teams that never hold those sessions. It also reaches rules no session thought to raise, like how a premium discount stacks with a promo code, because those only appear when someone writes out the specific case.

Skeptics still count the rewrites as waste. That doesn't mean tests must stay purely conceptual to avoid it. Mocked code and implementation details in tests encode their own assumptions that sometimes only get validated through actual implementation. Some test code will get thrown away. That's fine. A little code waste is a small price compared to the larger waste of building the wrong system because critical misalignments went undiscovered. It stays little when tests written under uncertainty are few and coarse, so a rewrite touches a handful of assertions rather than a suite.

When large test rewrites happen repeatedly, though, they might signal something else. The tests may be coupled to implementation details rather than behavior, so every internal change breaks them. Or the developer who wrote them was going through the motions rather than asking what the code should do. The trigger tells you which. A rewrite prompted by a stakeholder's answer or a newly found domain fact is learning, and a rewrite prompted by a refactor that changed no behavior is coupling.

TDD treated as a checklist rather than a discipline for understanding will produce tests that don't surface assumptions early. The waste isn't in TDD itself; it's in treating TDD as compliance rather than inquiry.

## Stop Measuring Success by Tests

This reframing should change what we measure, but not by replacing one test metric with another. Using test coverage as a success metric is a distraction. Measuring "assumptions caught" would be too. Value delivered is the only meaningful measure of success.

One signal connects value back to the tests: features that return for rework because a business rule was misunderstood. Compare one team's count before and after it adopts the habit. That's a team signal rather than proof, since changed minds feed the same count. It still beats comparing rules that had a business-rule test first against rules that didn't, because developers may write tests first more readily for rules they already understand.

Coverage metrics can still provide useful insight into quality gaps, but think in terms of use case coverage rather than line coverage. Are the critical business scenarios tested? Are the edge cases stakeholders care about covered? That's a different question than "what percentage of lines have tests?"

Tests are a tool, not an outcome. When teams treat coverage percentages as goals or count rewritten tests as waste, they've confused the means for the end. What matters isn't "how many tests do we have?" or "how many wrong assumptions did we catch?" but "did we deliver what users actually needed?"

The test suite does have secondary value as documentation that new developers can read to understand system constraints without digging through old conversations and tickets. But that's a side effect, not a success metric.

## Match the Test to How Settled the Requirement Is

Focus on testing assumptions that matter most. Not all assumptions carry equal risk. Prioritize tests that validate:

- **Business rules.** How discounts work, what triggers notifications, when transactions are valid
- **Edge cases stakeholders haven't considered.** What happens when the cart is empty? When the user has no purchase history?
- **Data validity assumptions.** What "valid" input looks like, what formats are acceptable, what happens with missing fields

The same test-first habit serves two different purposes depending on how settled the requirement is:

| Requirement | What the test is for | How to write it | When the test changes |
| --- | --- | --- | --- |
| Clear and stable | Checking the implementation against an agreed rule | Fine-grained tests around the logic, kept for the long term | Something broke a commitment, so fix the code |
| Uncertain | Exposing the assumptions inside the rule | A few tests at the business-rule boundary, asserting outcomes a stakeholder can confirm, light on mocks | Understanding moved, so update the test and keep going |

Classifying a requirement as clear is itself an assumption, and the falsely settled ones are where teams build the wrong thing. If writing the first test for a "clear" rule raises a question the ticket can't answer, the rule belongs in the uncertain row.

How settled the requirement is matters more than the usual debate about test-first versus test-after. A study by Davide Fucci and colleagues of 39 professionals found that the order of test and production code had no important influence on code quality or productivity, while small, steady steps did. Small steps are a benefit TDD brings to the code itself, separate from the understanding this post is about.

That study scored code against predefined stories on small coding tasks. The requirements were already specified, so there was nothing to misunderstand. So the study speaks to code quality and productivity, not to catching misunderstood requirements. There, the case for writing the test first rests on mechanism rather than data. An assertion written before the code has to state the expected value with no code to copy it from. A missing answer shows up as a blank the developer must fill, and the choice sits on one line a reviewer or stakeholder can read and question. One written after can simply record whatever the code already does, and the choice stays buried in the order of the arithmetic.

The better question is what assumptions you're making about user needs and how to validate them fastest. Sometimes that's writing a test first, other times it's building a prototype first, and sometimes it's showing mockups to users first. The goal isn't perfect tests. It's validated understanding.

<blockquote class="pull-quote">
<p>The most overlooked value of TDD isn't in the tests that pass. It's in the tests that change because an assumption turned out to be wrong.</p>
</blockquote>

## Tests Are Commitments to What You're Building

Writing the test first forces a question: what should this code actually do? That question demands understanding before implementation. The passing assertion represents a commitment: this is the contract we're building to. Implementation honors that commitment by making the test pass.

When tests change during development, you're realigning based on discovery. When tests fail after changes, they're surfacing broken commitments that need attention. The discipline isn't about tests. It's about starting with understanding, securing genuine commitment to what you're building, and then honoring what was agreed.

Building the wrong thing is the more expensive mistake. TDD's first business-rule tests address this by forcing clarity before code, but only when practiced as inquiry rather than compliance. Tests that surface wrong assumptions early are valuable even when they get rewritten. Tests written as ceremony produce waste without insight.

In practice, that means:

- Treat coverage as a diagnostic for missing use cases, not a goal
- Read a rewritten test as an answered question, not as failure
- Write tests to the requirement's state, coarse and disposable while it's uncertain, fine-grained once it's settled
- Measure whether you delivered what users actually needed, starting with how often features return for rework over a misunderstood rule

TDD isn't just a testing practice. It's a discipline for understanding.
