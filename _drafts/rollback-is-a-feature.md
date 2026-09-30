---
layout: post
title: "Rollback Is a Feature You Have to Build"
description: "A rollback reverts code, not the state the new code created, so it works only when the previous version can run against everything the new one wrote: schema, messages, and clients. That compatibility comes from splitting each change into expand and contract steps, and the release that removes the old path is where rollback ends."
tags: [architecture, devops, deployment, database-migrations, reliability]
author: steven-stuart
sources:
  - title: "SEC: In the Matter of Knight Capital Americas LLC (Release No. 70694, 2013)"
    url: "https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf"
  - title: "Jennifer Mace: Generic mitigations (O'Reilly, 2020)"
    url: "https://www.oreilly.com/content/generic-mitigations/"
  - title: "Site Reliability Engineering: Introduction"
    url: "https://sre.google/sre-book/introduction/"
  - title: "Kubernetes Documentation: Deployments"
    url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/"
  - title: "AWS CodeDeploy User Guide: Redeploy and roll back a deployment"
    url: "https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-rollback-and-redeploy.html"
  - title: "Deployment Strategies"
    url: "/study-guides/infrastructure/deployment-strategies.html"
  - title: "Martin Kleppmann: Designing Data-Intensive Applications (O'Reilly, 2017)"
    url: "https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/"
  - title: "Protocol Buffers Language Guide (proto3): Consequences of Reusing Field Numbers"
    url: "https://protobuf.dev/programming-guides/proto3/"
  - title: "Play Console Help: Release app updates with staged rollouts"
    url: "https://support.google.com/googleplay/android-developer/answer/6346149?hl=en"
  - title: "Danilo Sato: ParallelChange (martinfowler.com, 2014)"
    url: "https://martinfowler.com/bliki/ParallelChange.html"
  - title: "Pramod Sadalage and Martin Fowler: Evolutionary Database Design (2016)"
    url: "https://martinfowler.com/articles/evodb.html"
  - title: "Jacqueline Xu: Online migrations at scale (Stripe, 2017)"
    url: "https://stripe.com/blog/online-migrations"
  - title: "Deployment Strategy Comparison"
    url: "/resources/deployment-strategy-comparison.html"
---

On August 1, 2012, Knight Capital's order router sent millions of orders nobody intended into the market. According to the SEC's order against the firm, Knight had rolled out new code for its Retail Liquidity Program over the previous days, but one technician didn't copy it to one of the eight servers. The new code repurposed a flag that had once switched on Power Peg, a feature retired years earlier whose code was still present and callable. Orders carrying the flag reached the eighth server and ran the old code. While staff searched for the cause, Knight uninstalled the new code from the seven servers where it had deployed correctly. "This action worsened the problem," the SEC wrote, "causing additional incoming parent orders to activate the Power Peg code that was present on those servers." In about 45 minutes the router produced 4 million executions, and Knight lost more than $460 million.

Knight's story usually gets told as a lesson about dead code and manual deployment, and it is one. What I keep coming back to is the rollback. Knight did what most release plans say to do when a new version misbehaves, and it made things worse, because the old code met a world the new release had changed. Orders now carried a flag whose meaning had moved. Putting the old code back didn't put the old meaning back.

A rollback reverts code, not the state the new code created. It works only when the previous version can run correctly against everything the new version wrote, and that compatibility has to be built into each change. Schema changes, message formats, and client versions each break it unless the change is split into expand and contract steps. A release plan whose rollback step is "redeploy the previous version" without that work doesn't have a rollback plan. It has a hope.

## A Rollback Reverts Code and Leaves State Behind

### The Platform Rolls Back Exactly What It Deployed

Deployment tools are precise about what "rollback" means, and it is narrower than most release plans assume. The Kubernetes documentation for Deployments explains that only changes to the pod template create a revision, so "when you roll back to an earlier revision, only the Deployment's Pod template part is rolled back." AWS CodeDeploy's user guide describes a rollback as redeploying "a previously deployed revision of an application as a new deployment." Blue-green deployments switch traffic back to the old environment in seconds, but both environments usually share one database. The site's Deployment Strategies guide puts the limit in one line, "Code rolls back, but data does not," and its companion Deployment Strategy Comparison shows how each strategy's rollback depends on shared data.

None of these tools claims to undo a migration, drain a queue of messages the new version produced, or recall an app from users' phones. They restore an artifact. Everything the artifact changed outside itself stays changed.

### Rollback Works Before Anyone Understands the Outage

That limit matters because of when rollback gets used. Google's SRE book estimates that "roughly 70% of outages are due to changes in a live system," and it names rolling back "changes safely when problems arise" as one of three practices, alongside progressive rollouts and fast detection, that contain the damage. Jennifer Mace, an SRE at Google, calls rollback "probably the most common generic mitigation," where the defining property of a generic mitigation is that "you don't need to fully understand your outage to use it."

That property is what gives rollback its value. In the first minutes of an incident, the team knows a release went out and something broke. It doesn't yet know why. A rollback that works lets the team stop the damage and diagnose later, in daylight. Mace's section on rollback carries a warning. "Far too many *think* they have safe rollbacks, only to learn otherwise during an outage." A rollback that depends on the state still matching the old code fails at the moment the team has the least information to notice.

## Rollback Requires Old Code to Read New State

### Rolling Deployments Test Forward Compatibility Only Briefly

Martin Kleppmann's *Designing Data-Intensive Applications* gives the two directions of compatibility names. Backward compatibility means newer code can read data written by older code. Forward compatibility means older code can read data written by newer code. Backward compatibility is the one teams plan for, because the new release has to read yesterday's data or it fails on its first request. Forward compatibility is the one rollback depends on, and a release that replaces every instance at once never exercises it.

A rolling or canary deployment does exercise it. While the rollout runs, old and new instances share the same database and the same queues, so old instances read whatever new instances write. The gap is time. Rolling-deploy compatibility has to last only until the last old instance stops. Rollback compatibility has to last until the team is sure it won't need to go back.

### New State Hides in Three Places

**The schema.** A migration that renames a column, changes a type, adds a `NOT NULL` constraint, or drops a table changes what every version of the code finds in the database. If the old code expects `Name` and the migration replaced it with `GivenName` and `FamilyName`, redeploying the old code produces errors on every query that touches the table. Reverse migrations don't close the gap cleanly. Tools like EF Core generate a `Down` method for each migration, but reverting a migration that added a column drops the column along with everything the new version wrote into it. Pramod Sadalage and Martin Fowler write in "Evolutionary Database Design" that they haven't found automated reverse migrations "cost effective and beneficial enough to try all the time." They write migrations so the application "can work with both the old and new version of the database" instead.

**Messages and flags.** A message on a queue outlives the deployment that produced it. When the new version publishes events in a new shape, or gives an existing field a new meaning, those messages are still waiting when the old consumer comes back. Knight's repurposed flag is the extreme case, a field whose meaning changed while its name stayed the same, so the old code acted on it without any error. The Protocol Buffers language guide forbids the equivalent in its own format. Field numbers "should never be reused," because "reusing a field number makes decoding wire-format messages ambiguous," and the consequences it lists run from parse errors to data corruption.

**Clients.** Code that runs on someone else's machine can't be rolled back by the team that shipped it. Play Console's help on staged rollouts says that halting a rollout stops new users from receiving the version, but users who already received it keep it. The only way to change what they run is a newer release. Browsers holding cached scripts behave the same way until the cache expires. Client versions also constrain the server in the other direction. Once a released mobile app calls a new endpoint, rolling the server back to a version without that endpoint breaks every user who updated.

## Expand and Contract Builds the Rollback Into the Change

### Parallel Change Splits a Breaking Change Into Compatible Steps

Danilo Sato's description of parallel change on Martin Fowler's site, also called expand and contract, splits a breaking change into three phases. The expand phase adds the new structure beside the old one, the migrate phase moves every client to the new structure, and the contract phase removes the old one. Sato notes that the pattern "allows your code to be released in any of these three phases." Jacqueline Xu's account of online migrations at Stripe applies the same shape to data, as dual writing to the old and new tables, moving reads to the new table, moving writes to the new table, and then removing the old data.

Neither source frames the pattern as a rollback technique. But the pattern keeps each pair of adjacent releases able to run against the same data, and that's the property rollback needs. Splitting `Name` into `GivenName` and `FamilyName` takes five releases instead of one, and each release can be rolled back to the one before it:

| Release | Schema | Code writes | Code reads | Rolling back to the previous release |
| --- | --- | --- | --- | --- |
| 1. Expand | Adds nullable `GivenName` and `FamilyName` | `Name` | `Name` | Safe. The previous code ignores the new columns |
| 2. Dual write | Unchanged. A backfill fills the new columns for existing rows | `Name` and the new columns | `Name` | Safe. The new columns stop updating, so the backfill must run again when release 2 returns |
| 3. Read new | Unchanged | Both | The new columns | Safe. `Name` is still current, so release 2 reads correct data |
| 4. Stop writing old | Unchanged | The new columns | The new columns | Safe to release 3, which reads the new columns. Not safe any further back, because `Name` has gone stale |
| 5. Contract | Drops `Name` | The new columns | The new columns | Only to release 4. No release that reads `Name` can run again |

The same steps apply to messages and APIs. A producer adds a new field and keeps the old one, consumers move to the new field, and the old field is retired only after no consumer reads it and no message carrying only the old field is still queued. For a mobile client, the server keeps the old endpoint until the versions that call it have aged out.

### The Contract Step Is Where Rollback Ends

Each release in the table can go back one step, and the reach shrinks as the change proceeds. After release 4, going back to anything that reads `Name` is unsafe. After release 5, it's impossible. That isn't a flaw in the pattern. Every change that eventually removes something has a point of no return. Expand and contract makes that point visible and moves it to a release the team schedules, after the new path has run in production long enough to trust.

Without the pattern, the point of no return is the first release, and it arrives unannounced. A migration that renames a column in place makes the previous version unrunnable the moment it commits.

Sato gives the pattern's cost as plainly as its benefit. "If the contract phase is not executed you might end up in a worse state than you started." Columns that are written twice, fields that are never retired, and endpoints nobody dares delete are the price of skipping the last step. The contract release needs an owner and a date like any other piece of work.

## Rolling Forward Is a Plan Only When It's Chosen

Some teams answer all of this by declaring that they only roll forward. When a release breaks, they fix it with another release. For some changes, that's the only honest option. A release that sends email, captures payments, deletes data, or calls a partner's API has effects no deployment can reverse, and an installed mobile app can only move forward.

But rolling forward has a price that the rollback-free plan tends to leave out. A fix-forward requires the team to understand the problem, write a fix, and ship it through the full pipeline while the incident is still running, which is the opposite of Mace's generic mitigation. I haven't found a study that compares outage duration under roll-forward-only and rollback-capable practice, so I can't claim one is safer in general. The difference I can point to is what each one asks of the team at the worst moment. A working rollback asks for nothing beyond noticing the problem. Rolling forward asks for a diagnosis.

Rolling forward also doesn't escape the compatibility work, since every rolling or canary rollout already needs old and new versions to share state safely. A team shipping that way is paying most of the cost of expand and contract already, and keeping the compatibility for one more release is what buys the rollback.

The difference between a plan and a hope is whether the team chose. A release where rolling back is unsafe past a certain step, and the team knows it and has reviewed that step more carefully, has a plan. A release where nobody asked has a hope that the old code will cope with the new state, and Knight found out what that hope was worth.

## Checking Your Last Release

Pick the last release that changed a schema, a message, or an API, and ask:

- Could the previous version run correctly against the database as it stands now, after the migration ran?
- Would the previous consumers understand every message the new version has put on a queue, including fields whose meaning changed?
- Which clients are already running against the new server behavior, and would a server rollback break them?
- Does the migration have a reverse, and would running it destroy data written since the release?
- If the answer to any of these is no, was the release planned as a point of no return, or did it become one by accident?
- Does every change still in its expand phase have a scheduled contract release with an owner?

The deployment tool can put the old code back in seconds. Whether that code can run on what the new release left behind was decided when the change was designed, and that's the part of rollback a team has to build.
