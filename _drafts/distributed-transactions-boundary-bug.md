---
layout: post
title: "Distributed Transactions Are a Boundary Bug"
description: "A saga fits a workflow whose intermediate states the business already names and handles. When a saga is the only thing keeping a business rule true, a service boundary was drawn through a transaction, and the fix is to move the rule, not to perfect the compensation. Where each invariant is enforced tells you which kind of saga you have."
tags: [architecture, distributed-systems, domain-driven-design, microservices, sagas, transactions]
author: steven-stuart
sources:
  - title: "Hector Garcia-Molina and Kenneth Salem: Sagas (SIGMOD 1987)"
    url: "https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf"
  - title: "Chris Richardson: Pattern: Saga (microservices.io)"
    url: "https://microservices.io/patterns/data/saga.html"
  - title: "Lars Frank and Torben U. Zahle: Semantic ACID Properties in Multidatabases Using Remote Procedure Calls and Update Propagations (1998)"
    url: "https://www.semanticscholar.org/paper/Semantic-acid-properties-in-multidatabases-using-Frank-Zahle/5fa10aa76219eab8ff5a287eb4e5abc410be6021"
  - title: "Laigner, Zhou, Salles, Liu, and Kalinowski: Data Management in Microservices: State of the Practice, Challenges, and Research Directions (VLDB 2021)"
    url: "https://arxiv.org/abs/2103.00170"
  - title: "Pat Helland: Life beyond Distributed Transactions: an Apostate's Opinion (CIDR 2007)"
    url: "https://www.ics.uci.edu/~cs223/papers/cidr07p15.pdf"
  - title: "Distributed Computing"
    url: "/study-guides/architecture/distributed-computing.html"
  - title: "Transactions and Isolation"
    url: "/study-guides/data/transactions-and-isolation.html"
  - title: "Vaughn Vernon: Effective Aggregate Design, Part II (2011)"
    url: "https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf"
  - title: "Pat Helland and Dave Campbell: Building on Quicksand (CIDR 2009)"
    url: "https://dsf.berkeley.edu/cs286/papers/quicksand-cidr2009.pdf"
  - title: "Domain-Driven Design"
    url: "/study-guides/architecture/domain-driven-design.html"
  - title: "Microservices Architecture"
    url: "/study-guides/architecture/microservices-architecture.html"
  - title: "Messaging Patterns"
    url: "/study-guides/architecture/messaging_patterns.html"
---

Your saga isn't a pattern. It's an apology for where you drew the line. That's too harsh as a rule, and I'll spend most of this post on the sagas it doesn't describe, but it's right often enough that a saga shouldn't be read as a sign of a mature design. A saga tells you that a piece of work crosses a boundary and can't be made atomic. The useful question is whether the work should have crossed that boundary at all.

My argument is that there are two kinds of saga, and the code doesn't tell them apart. One coordinates a business process whose intermediate states the business already names and handles, like an order waiting on payment. The other is the only thing holding a business rule together, because the data that rule depends on was split across services. The first is the pattern doing its job. The second is a boundary bug, and no amount of care in the compensating steps fixes it. You tell them apart by finding where each invariant is enforced.

## The Saga Was Built for Work the Business Already Did in Steps

### It Started as a Way to Stop Holding Locks

Hector Garcia-Molina and Kenneth Salem introduced the saga in "Sagas" (SIGMOD 1987), and the problem they solved had nothing to do with services. It was a long-lived transaction in one database, holding locks for hours or days while shorter transactions queued behind it. Their answer was to break the long transaction into a sequence of ordinary transactions, each committing on its own, and to pair each one with a compensating transaction that "undoes, from a semantic point of view, any of the actions performed" by its step. The database would guarantee that either every step ran or the completed ones were compensated.

The paper is candid about what that gives up. Other transactions "might see the effects of a partial saga execution," and when a compensation runs, "no effort is made to notify or abort transactions that might have seen the results." A saga is atomic in the end, but it isn't isolated along the way.

### Its Precondition Was a Business That Tolerates the Middle

That trade was acceptable because of which work Garcia-Molina and Salem had in mind. Their examples are an airline booking several seats, a bank computing interest across accounts, and an office processing a purchase order through inventory, accounting, and shipping. Office transactions like these, they write, "mimic real procedures and hence can cope with interleaved transactions. In reality, one does not physically lock the warehouse until a purchase order is fully processed."

The paper also says where sagas come from. In its section on designing sagas, the authors write that "the structure of the database plays an important role," and that if the database "can be laid out into a set of loosely-coupled components (with few and simple inter-component consistency constraints), then it is likely that the LLT will naturally break up into sub-transactions that can be interleaved." Read that as a design rule and it's the thesis of this post, published in 1987. A saga fits when the boundaries between its steps cut through few business rules. When they cut through many, the saga has nothing to stand on.

### Microservices Kept the Mechanism and Lost the Precondition

The saga came back with microservices, and its problem statement changed. Chris Richardson's pattern on microservices.io asks, "How to implement transactions that span services?" That question takes the service boundaries as given and asks the saga to make up for them. The pattern is honest about the cost. A developer "must design compensating transactions that explicitly undo changes," and because the steps aren't isolated, sagas running concurrently with each other and with other transactions risk data anomalies. Richardson's *Microservices Patterns* answers the isolation problem with countermeasures drawn from Lars Frank and Torben Zahle's 1998 work on multidatabases: semantic locks, commutative updates, rereading values before overwriting them, and reordering steps to limit the damage. Each is application code that rebuilds a piece of what a local transaction would have given for free.

What practitioners actually build looks worse than the pattern. Rodrigo Laigner and colleagues studied data management in microservices through a literature review, popular open-source applications, and a practitioner survey ("Data Management in Microservices," VLDB 2021). Of the 32 respondents who explained how they keep operations that span services consistent, 78% described workflows in application code with application-level validations. In the open-source applications, the authors found cross-service references that would be foreign keys in a single schema, such as a shopping cart holding product IDs, with "no evidence of such enforcement." Delete a product and the carts still hold it. They conclude that "in most cases, practitioners simply either ignore or are unaware of the consequences." Nobody wrote a saga for those rules at all. The boundary went through them and the rules quietly stopped being enforced.

## Where Each Invariant Is Enforced Tells You Which Saga You Have

### A Process Saga Coordinates Services That Each Keep Their Own Rules

Richardson's own example is the good kind, and it shows why. An application must ensure that "a new order will not exceed the customer's credit limit." The Order Service creates the order as `PENDING`, the Customer Service attempts to reserve credit, and the order becomes `APPROVED` or `REJECTED` depending on the answer.

Look at where the credit-limit rule lives. The Customer Service checks the limit and records the reservation in one local transaction, so the rule never crosses a boundary. The saga doesn't enforce the credit limit. It carries a request to the service that does, and it carries the answer back. The intermediate state has a business name, a pending order, and so does the tentative commitment, a credit reservation. If the saga stalls, what's left is a pending order and a hold on some credit, and both are states a business already knows how to deal with.

Pat Helland described this shape in "Life beyond Distributed Transactions: an Apostate's Opinion" (CIDR 2007). He defines an entity as data that "may be atomically updated within the entity but never atomically updated across entities," and argues that without distributed transactions, "the management of uncertainty must be implemented in the business logic. The uncertainty of the outcome is held in the business semantics rather than in the record lock. This is simply workflow." His examples are reserved inventory and allocations against credit lines, which one entity grants tentatively and another later confirms or cancels. Contracts between businesses, he notes, already include "time commitments, cancellation clauses, reserved resources, and much more," and while this is harder to build than a distributed transaction, "it is how the real world works."

### A Boundary-Bug Saga Is the Only Thing Holding a Rule Together

Now consider a design that looks similar and isn't. A payments system splits into a Payments service that records each posted payment and an Accounts service that holds each account's balance, and the rule is that the balance equals the sum of posted payments. Posting a payment becomes a saga, recording the payment and then applying it to the balance, with a compensation that voids the payment if the balance update fails.

Here no service enforces the rule. It holds only after every step has run, so between the steps the books are wrong. Another saga that reads the balance in that window sees a number that disagrees with the payments on record, and a withdrawal approved or declined in that window rests on the wrong number. The countermeasures are all available, like a semantic lock on the account or a pessimistic ordering of steps, and each one is code that recreates the atomicity the split removed. The intermediate state also has no business name. "Payment recorded but not applied" is not a status an accountant would recognize. Double-entry bookkeeping records both sides of a posting in one entry that must balance. When this saga stalls, the fix isn't a business action. It's a data repair.

That's the difference, and it doesn't depend on the saga's mechanics. Both designs use local transactions, events, and compensations. In the first, every invariant is checked atomically inside one participant and the saga moves a process between them. In the second, the saga itself is the enforcement, and a compensation, which the site's Distributed Computing guide notes can fail like any other update, is all that stands between the system and a broken rule. The site's Transactions and Isolation guide makes the same point from the database side. A transaction covers one database, and a saga that spans several gives up isolation, so its intermediate states are visible to everything else.

## The Test: Would the Business Accept the Intermediate State?

### Consistency Belongs to Whoever Is Doing the Work

Vaughn Vernon's "Effective Aggregate Design" (2011) gives a tie-breaker he credits to a conversation with Eric Evans. When examining a use case, "ask whether it's the job of the user executing the use case to make the data consistent. If it is, try to make it transactionally consistent," within the other rules for aggregates. If it's another user's job, or the system's, eventual consistency is acceptable. Vernon adds that the question "exposes the real system invariants: the ones that must be kept transactionally consistent."

Applied to a saga, the question becomes whether the business would accept seeing the state between two steps. If a customer service agent could look at it and say "that order is waiting on payment," it's a process state and the saga fits. If the only honest description is "the data is inconsistent right now," the invariant needs one owner.

### Six Signals Separate a Process From a Misplaced Rule

The signals below separate the two in practice. No single row decides it, but a saga that lands in the right column on most of them is guarding an invariant that belongs inside one boundary.

| Signal | Process saga | Boundary-bug saga |
| --- | --- | --- |
| The intermediate state | Has a business name (pending, reserved, on hold) | Has no name except "inconsistent" |
| Where each invariant is checked | Atomically inside one participant | Only after every step completes |
| What compensation does | A business action the domain already has (cancel, refund, release the hold) | A data undo (delete the row, reverse the write) |
| Isolation countermeasures | Few, because other work is allowed to see the middle | Many, to hide the middle from other work |
| When the saga stalls | A person resolves it through a normal business process | Someone writes a repair script |
| Why the steps are separate | The business has separate owners for them | A service map drawn before the rules were known |

### Some Rules Are Allowed to Slip

Helland's later paper with Dave Campbell, "Building on Quicksand" (CIDR 2009), adds one refinement. Many business rules are less absolute than they sound, and the business sets how much risk it will carry. Their examples include "Don't overbook the airplane by more than 15%," clearing a check locally when it's under $10,000 while coordinating on larger ones, and shipping a common book from a local guess at inventory while "the one and only one Gutenberg bible requires strict coordination." Where a rule tolerates slippage, the business apologizes when it slips, as airlines do when they overbook. So the test is also a conversation with the business. A rule it will let slip, with an apology it already knows how to make, can live across a boundary. A rule it won't let slip needs one owner. The orphaned carts in Laigner's study are neither. That rule slipped because nobody decided whether it could.

## Move the Rule Instead of Perfecting the Compensation

When a saga fails the test, making its compensations more reliable treats the symptom. The cause is where the rule lives, and there are three ways to change that.

### Merge the Services Around the Invariant

The most direct fix is to put the data an invariant spans back inside one boundary, so one local transaction enforces it. The site's Domain-Driven Design guide describes this as the aggregate's job, a cluster that changes "together under one set of rules" and is saved in one transaction. The Microservices Architecture guide puts the service-level version plainly. If two services constantly need to change data atomically, that's strong evidence they belong in one service. In the payments example, recording a payment and applying it to the balance becomes one transaction in one service, and the saga disappears. Merging has a cost the DDD guide also names. A larger consistency boundary means more concurrent work contends on the same data, which is why the boundary should enclose what one invariant needs and no more.

This is also why the saga's appearance is useful as a signal. Boundaries drawn before a domain's rules are known tend to cut through some of them, and the saga is where that shows first. A modular monolith, where modules can still share a transaction, lets those boundaries move cheaply until the rules settle.

> **AUTHOR** — the author's experience goes here: service boundaries redesigned around transactions at a financial research platform. What the saga or cross-service write was guarding, what the boundary moved to, and what went away.

### Give One Service the Rule and Make the Others Ask

Sometimes the data can't be merged, because the services have separate owners or separate scaling needs. Then give the invariant to one service and have the others request tentative commitments from it, the way Richardson's Customer Service owns the credit limit. An Inventory service that owns "available stock never goes below zero" grants reservations, and an Order service asks for them. The rule is enforced atomically where it lives, and what crosses the boundary is a request the owner can refuse. The reservation and the reply announcing it still need to leave the owner reliably, which is what the transactional outbox in the site's Messaging Patterns guide is for. It writes the message in the same local transaction as the reservation. That turns a boundary-bug saga into a process saga, because the intermediate state is now a reservation, which the business can name.

### Accept the Saga Where the Line Isn't Yours

Some boundaries can't be moved. A card network, a shipping carrier, or another company's system sits outside anything you can merge, and a rule that spans your data and theirs can't have a single owner. The same holds, in Helland's argument, when scale forces data onto machines that can't share a transaction. There the saga is the correct tool, and the work is to make the rule one the business can tolerate slipping, with states it can name and apologies it knows how to make. A payment captured for an order that can't ship ends in a refund, and every business that takes payments already has one.

What the test rules out is treating every boundary as if it were one of these. A line between two of your own services is a decision you made, and one you can change.

## Checking Your Own Sagas

List every saga, compensating action, and cross-service write in your system this week. For each one:

- Name the intermediate state between each pair of steps, in words the business would use, and ask whether the business would accept a customer seeing it. If you can't name it, or it's unacceptable, the step boundary runs through an invariant
- Find where each business rule it touches is checked, and whether that check happens atomically inside one service or only after every step completes
- Read each compensation and ask whether it's a business action the domain already has or an undo that exists only because the write was split
- Count the isolation countermeasures, like semantic locks and rereads, and ask what each one is hiding from other work

A saga that passes every check is a business process, and it belongs where it is. A saga that fails most of them is protecting a rule from a boundary you drew, and moving the boundary will do more than perfecting the saga.
