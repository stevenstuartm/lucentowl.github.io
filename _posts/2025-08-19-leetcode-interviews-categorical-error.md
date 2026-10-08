---
layout: post
title: "Why LeetCode Interviews Measure the Wrong Thing"
date: 2025-08-19
tags: [hiring, interviews, career, industry]
description: "Algorithm interviews optimize for pattern memorization while ignoring the multidisciplinary skills that define effective software engineering."
author: steven-stuart
sources:
  - title: "Behroozi, Shirolkar, Barik, and Parnin, \"Does Stress Impact Technical Interview Performance?\" (ESEC/FSE 2020)"
    url: "https://par.nsf.gov/biblio/10196170"
  - title: "Aline Lerner, \"Technical interview performance is kind of arbitrary. Here's the data.\" (interviewing.io)"
    url: "https://interviewing.io/blog/technical-interview-performance-is-kind-of-arbitrary-heres-the-data"
  - title: "SIOP, \"Is Cognitive Ability the Best Predictor of Job Performance?\" (on Sackett, Zhang, Berry, and Lievens, 2022)"
    url: "https://www.siop.org/tip-article/is-cognitive-ability-the-best-predictor-of-job-performance"
  - title: "Uniform Guidelines on Employee Selection Procedures, 29 CFR 1607.5"
    url: "https://www.law.cornell.edu/cfr/text/29/1607.5"
  - title: "Hiring Without Whiteboards (GitHub)"
    url: "https://github.com/poteto/hiring-without-whiteboards"
---

Coding tests can effectively filter out candidates who can't write working code. That's a legitimate purpose. The problem emerges when organizations test for timed algorithm-puzzle skills in roles that require entirely different capabilities: system design, debugging distributed systems, architectural decision-making, or cross-functional collaboration.

<blockquote class="pull-quote">
<p>A senior engineer who can architect scalable systems and debug production failures shouldn't be rejected because they can't solve a binary tree puzzle in thirty minutes.</p>
</blockquote>

The interview tests for skills the job doesn't require while ignoring skills that define success in the role.

## Timed Puzzles Test a Skill Most Roles Rarely Use

Some roles genuinely require strong algorithm skills. If you're building database engines, compilers, or performance-critical systems, testing for algorithmic thinking makes sense. The problem is applying this filter by default regardless of what the job actually requires. A problem a competent engineer can solve cold with basic data structures, like reversing a linked list or finding duplicates with a hash map, checks the coding fluency every role needs. The mismatch starts with problems that are hard to finish in thirty minutes unless you recognize a named technique the role doesn't use, such as dynamic programming or a specific graph algorithm. Difficulty labels on practice sites don't track this line exactly, since many medium problems are plain hash-map work.

Most software engineering roles demand system design thinking to architect scalable solutions, production debugging to troubleshoot complex failures, cross-functional collaboration to align technical decisions with business needs, and trade-off evaluation to balance competing constraints. Algorithm optimization rarely appears in the day-to-day work, yet coding rounds that draw from practice-site catalogs test almost exclusively for it, and the argument here applies to the share of those problems that depend on a named technique. Larger interview loops add design and behavioral rounds, but the coding round often comes first as a screen. When that screen uses technique-dependent problems, a candidate who fails it never reaches the rounds that sample the job.

A candidate might struggle to find the optimal solution to a graph problem in thirty minutes while being excellent at diagnosing why a distributed system exhibits inconsistent behavior under load. They might fumble dynamic programming problems while being the engineer who catches architectural flaws in design reviews. When the role requires the latter skills, the interview measures their weakest capability and ignores their strongest. How often that happens across a hiring pool isn't something public data shows, which is why the case below rests on what the test contains.

Pattern matching also masquerades as algorithmic thinking. Practice sites group their problems by technique, such as two pointers, sliding window, and dynamic programming, so a candidate who has drilled enough of them can solve a hard problem by recognizing which template it fits. Recognizing patterns is a useful skill, and engineers diagnose production issues partly that way. But recognizing a problem from a drilled catalog measures hours of preparation. Defenders read those hours as a sign of conscientiousness, but hours available to drill also track free time, so the signal mixes diligence with circumstance. Under time pressure, recall produces the same answer on the whiteboard as reasoning from first principles. An interviewer can try to tell them apart by changing a constraint and asking why, but then the signal depends on that interviewer's skill rather than on the format.

The live format adds noise of its own. In a randomized controlled trial published at ESEC/FSE 2020, Mahnaz Behroozi, Chris Parnin, and colleagues gave 48 computer science students a whiteboard problem, half with an interviewer watching and half alone in a private room. Being watched cut performance by more than half. That penalty comes from observation, not from the puzzle, so it applies to any live exercise. Aline Lerner found a second source of noise in 2016 data from interviewing.io, a practice-interview platform: only about a quarter of candidates who interviewed more than once performed consistently, and many who earned a top score in one interview earned a failing score in another. That instability belongs to any single interview. Neither finding favors one format's content over another's. Both argue against letting one live round decide, and a lone timed puzzle used as a gate is exactly that, measuring preparation and composure on that day alongside a skill the role rarely uses.

The usual defense is that this filter accepts false negatives to avoid false positives, because a bad hire is expensive and a large company can afford to lose good candidates. The trade can hold for the company, but it rests on an assumption the public data doesn't settle. For a role that doesn't use the puzzle skill, the screen reduces false positives on the skills that predict success there only as far as puzzle performance happens to track them. Its false negatives also aren't spread evenly, since a filter that rewards drilled patterns favors whoever had time to drill, and the talent pool narrows in that direction. Any time-intensive format shares that skew, take-home projects included, which is a reason to keep those small.

Even when performance optimization matters in typical production systems, it's usually about database query optimization, caching strategies, network request patterns, and system architecture rather than the algorithmic complexity of isolated functions. For roles building web applications or distributed services, the engineer who can identify an N+1 query problem delivers more immediate value than the engineer who can implement graph traversal algorithms from memory. Different roles, different requirements.

## Most Roles Run on Debugging, Design, and Review

Most software engineering involves systems thinking applied to building products. That means understanding how components interact, how failures propagate, how changes impact users, and how technical decisions affect business outcomes. It means reading production metrics to diagnose issues, reviewing code to catch bugs before deployment, mentoring junior engineers to improve team capability, and collaborating with product teams to ensure what gets built actually solves user problems.

Consider what a senior application engineer actually does. They investigate why a service's 99th percentile latency spiked from 200ms to 2 seconds overnight and discover a deployment introduced inefficient database queries. They review a pull request, identify a race condition in concurrent access to shared state, and suggest refactoring with proper locking. They pair with a junior developer to debug why a feature works locally but fails in staging due to differences in environment configuration. They join a design meeting and explain why the proposed real-time notification feature requires WebSocket infrastructure and database schema changes that will take three weeks, not three days.

None of these activities resemble solving algorithm puzzles under time pressure.

## Work-Like Formats Keep What Puzzles Get Right

Puzzles persist for reasons that hold up. They're cheap to run at scale, every candidate gets a comparable problem, and the scoring is easy to defend. Their strongest defenders also treat them as a proxy for general reasoning ability. Public data tying algorithm-round scores to later job performance is scarce, so the case for or against puzzles has to lean on general selection research. Paul Sackett and colleagues' 2022 re-analysis of personnel-selection studies in the Journal of Applied Psychology estimated validity at .42 for structured interviews, .40 for job knowledge tests, .33 for work samples, and .31 for cognitive ability. Those are averages across occupations, and work samples don't clearly beat cognitive ability on their own. The consistency that makes puzzles attractive comes from the fixed task and the rubric (the same problem for every candidate, scored against written criteria), not from puzzle content, and a work-like exercise can adopt both.

So the numbers don't crown a content winner, and when prediction is roughly tied and no outcome data exists for a particular test, selection practice falls back on content validity. The US Uniform Guidelines on Employee Selection Procedures (29 CFR 1607.5) describe it as showing that a test's content is "representative of important aspects of performance on the job." File a puzzle under cognitive ability and it's a proxy that ranks below job knowledge. File it under job knowledge and the knowledge it samples is algorithm technique the role rarely uses. Either way, a structured exercise built from the role's own work meets the content standard more directly. That standard is about defensibility, not a proven gain in hires, but with prediction tied it breaks the tie, along with two other differences. Preparation bends the puzzle proxy, because puzzles draw from a public catalog of thousands of problems with published solutions, so a candidate who has seen the problem is measured partly on recall. And the screen's false negatives skew toward people without time to drill. A work-like format costs more, because scenarios have to be written per role, calibrated, and rotated, and interviewers have to be trained and recalibrated on the rubric. That is a recurring cost per role rather than per candidate, while a screen that rejects on the wrong content pays its cost on each candidate it turns away. No public outcome data shows which choice comes out ahead.

Some companies have made that switch, and the community-maintained Hiring Without Whiteboards list on GitHub catalogs hundreds of them. The list shows the switch is workable at scale, not that those companies hire better, so the case for it rests on the research above. The format should follow the work the role does most:

| When the role mostly... | Test it with | What it reveals |
| --- | --- | --- |
| Builds performance-critical internals like database engines, compilers, or low-latency libraries | Algorithm and data-structure problems, ideally drawn from the domain | Whether the candidate can reason about complexity where it decides the outcome |
| Extends and maintains a product codebase | Pair programming on an existing codebase | Collaboration, code quality standards, and how they work through ambiguous requirements |
| Delivers features end to end | A small take-home project with tests and documentation | Whether they can build a working feature without artificial time pressure |
| Runs services in production | Diagnosing a seeded bug from logs and metrics | How they form and test hypotheses about a failure |
| Shapes how services fit together | A system design discussion on a realistic problem | Their grasp of distributed systems, scalability patterns, and trade-off evaluation |
| Reviews others' work and mentors | Critiquing a real pull request | Whether they can find bugs, suggest improvements, and give feedback constructively |

These approaches aren't perfect. Take-home projects favor candidates with more free time, pair programming can feel stressful, and system design discussions are harder to standardize. The observation penalty from the Behroozi study also hits every live row in the table, so give candidates private time to work before they discuss their approach wherever the format allows. AI assistants make unobserved work hard to attribute, so any private or take-home portion needs a live follow-up where the candidate walks through their work and extends it. That follow-up is still observed, but the candidate explains a solution they already reached instead of searching for one under a watching eye, and the Behroozi study's private condition used the same shape, with participants solving alone and then explaining their work in a retrospective think-aloud. Each format earns its place only when it's structured: the same scenario for every candidate, and a rubric written beforehand that lists what a strong answer finds, such as the seeded bug's root cause or the race condition in the pull request. Scenarios drawn from the company's own systems leak too, through interview-review sites, but they have no published solution set and can be rotated, so they resist drilling better than a public catalog does. Built that way, they apply the structure the research ranks highest to the job's own work, rather than to memorization of algorithm patterns.

## Learn Algorithms for the Work, Not the Interview

Build your algorithmic foundation because it matters beyond the interview. Understanding data structures helps you choose the right tool for the job, and knowing complexity analysis helps you write efficient code. Study algorithms to become a better engineer, not just to pass interviews.

But recognize that grinding LeetCode is interview preparation, not professional development. The hours spent memorizing dynamic programming patterns could be spent building systems, contributing to open source, or learning distributed systems concepts. Those investments develop professional capability while LeetCode grinding mostly develops interview performance.

<blockquote class="pull-quote">
<p>Strong engineers architect scalable systems, debug production failures, and collaborate across teams to ship features. Whether they can solve algorithm puzzles in thirty minutes is an indirect, noisy signal of any of that.</p>
</blockquote>

The problem isn't the candidates' capability. It's an interview process that measures the wrong thing for the role.

The industry needs better evaluation methods that resemble actual work and measure capabilities that matter for job success. Until that changes, engineers are stuck preparing for interviews that don't reflect the job while companies miss strong candidates who don't perform well on algorithm puzzles.
