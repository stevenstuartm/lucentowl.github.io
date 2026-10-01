---
layout: post
title: "Soft Deletes Are a Lie Your Schema Tells"
description: "An IsDeleted flag stands in for several lifecycle states, like trash, closed, pending erasure, and on hold, each with its own rules for who can see a row, whether it comes back, and when it must be gone. The flag answers none of those questions, so model the states the flag hides and let each one carry its own rules."
tags: [architecture, software-design, data-modeling, databases, privacy]
author: steven-stuart
sources:
  - title: "Brandur Leach: Soft Deletion Probably Isn't Worth It (2022)"
    url: "https://brandur.org/soft-deletion"
  - title: "Microsoft Learn: Global Query Filters in EF Core"
    url: "https://learn.microsoft.com/en-us/ef/core/querying/filters"
  - title: "paranoia gem README"
    url: "https://github.com/rubysherpas/paranoia"
  - title: "discard gem README: Why not paranoia or acts_as_paranoid?"
    url: "https://github.com/jhawthorn/discard"
  - title: "GDPR Article 17: Right to erasure"
    url: "https://gdpr-info.eu/art-17-gdpr/"
  - title: "ICO: Right to erasure"
    url: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/"
  - title: "Federal Rules of Civil Procedure, Rule 37(e) (Cornell LII)"
    url: "https://www.law.cornell.edu/rules/frcp/rule_37"
  - title: "TechCrunch: Twitter keeps deleted direct messages for years (2019)"
    url: "https://techcrunch.com/2019/02/15/twitter-direct-messages/"
  - title: "PostgreSQL: Partial Indexes"
    url: "https://www.postgresql.org/docs/current/indexes-partial.html"
  - title: "Microsoft Learn: Indexes in EF Core (index filter)"
    url: "https://learn.microsoft.com/en-us/ef/core/modeling/indexes"
---

Your records aren't deleted. They're in a state your schema refuses to name. A row with `IsDeleted = true` might be an order the customer cancelled, an account that was closed, a document someone put in the trash by mistake, or a person who asked to be forgotten. The database stores all of them the same way, and the code that reads them has to guess which one it's looking at.

The case against soft deletion isn't mine. Brandur Leach made it well in "Soft Deletion Probably Isn't Worth It" (2022). The filter leaks into every query, foreign keys stop enforcing anything about deleted rows, retention law forces a hard delete anyway, and across ten years and several companies, he writes, "never once, did anyone at any of these places ever actually use soft deletion to undelete something." What I want to add is why the flag keeps failing. A deleted flag stands in for a lifecycle with several distinct states, each with its own rules about who can see a row, whether it can come back, and when it must be gone. One boolean can't carry those rules, so they end up scattered through the code or missing entirely. The fix is to name the states.

## One Flag, Several Promises

### The Documentation Already Names Two Purposes

Microsoft's EF Core documentation introduces global query filters with soft deletion as its first example. "Soft deletion allows rows to be undeleted if needed, or to preserve an audit trail where deleted rows are still accessible."

Those are two purposes with opposite retention needs. Undelete wants a short window, days or weeks, after which the row should go, because few people go looking for a document they trashed three years ago. An audit trail wants the row kept for as long as the audit obligation runs, often years, and never restored at all. A schema that serves both with one column has to pick one retention rule, and whichever it picks is wrong for the other purpose.

### A Deleted Row Can Be in Four Different States

Ask what a deleted row is for, and the answer splits into states that differ on every rule that matters:

| State | Who can still see it | Can it come back? | When must it be gone? | Does it still hold its unique values? |
| --- | --- | --- | --- | --- |
| **In the trash** | The owner, in a trash view | Yes, by the owner | After a recovery window, such as 30 days | Usually yes, so a restore doesn't collide |
| **Closed or cancelled** | History, reports, and anything that references it | Sometimes, by an administrator | When the business or tax record period ends | Depends on the domain (a closed account's email may be reusable) |
| **Pending erasure** | Nobody, except the process erasing it | No | Within a legal deadline, such as a month | No |
| **Voided or merged** | Nobody, except as a pointer to what replaced it | No | Whenever convenient | No |

A single `IsDeleted` column answers only one of these questions, and only one way. It says "hide this by default." It doesn't say from whom, for how long, or what happens next, so each of those answers has to live somewhere else, in a nightly job, a reporting query, or a developer's memory.

Legal hold doesn't fit in the table at all, and that's instructive. A hold isn't a state a row moves into. It's an overlay that suspends deletion for whatever state the row is in, and a row can fall under more than one hold at once, one per matter. A flag can't model it, and neither can a single status column.

## What the Flag Can't Answer

### Hiding Depends on Every Reader Remembering

A deleted flag is only as good as the filter every reader applies. Leach's point is that "soft deletion logic bleeds out into all parts of your code," and forgetting it "accidentally returns data that's no longer meant to be seen."

ORM-level filters narrow the gap without closing it. EF Core's global query filter adds the predicate to every query EF Core runs against the entity type, but only there. A report written in SQL, a Dapper query, a warehouse export, or a support engineer at a database console reads every row. Tenant filters built on the same mechanism leak the same way. Inside EF Core, filters can only be defined on the root type of an inheritance hierarchy, and the documentation warns that a filter on a required navigation can make rows vanish from results. EF Core can load a required relationship with an inner join, so filtering out the related row filters out the row that references it too. Soft-delete a customer, and a query for invoices that includes the customer returns fewer invoices.

The Ruby ecosystem went through the same arc. The paranoia gem, which hides deleted rows through a default scope, now says it "is not recommended for new projects." It points to the discard gem instead, whose README gives the reason. A default scope "will take more effort to work around and will cause more headaches," so discard makes every query say whether it wants discarded rows.

Public incident reports rarely name a forgotten soft-delete filter as the cause of a breach, so how often these leaks happen is unknown. The mechanism is the part a reader can check. Every path that reads the table without the ORM sees deleted rows, and every path that does use it inherits the filter's blind spots.

### Erasure Needs a Deadline the Flag Doesn't Carry

GDPR Article 17 gives a person the right to have their data erased "without undue delay," and the UK Information Commissioner's Office expects a response "at the latest within one month" of the request. A soft-deleted row is still there. It's hidden from the application, not erased, and the difference shows up whenever something reads the table without the filter, like an export, a replica, or a subject access request answered from the raw data.

Twitter's direct messages showed that gap in public. In 2019, security researcher Karan Saini found that messages users had deleted were still retrievable, including a conversation from March 2016 with a suspended account, as TechCrunch reported. How Twitter stored them internally was never published, but the gap between "deleted" in the product and "erased" in storage is the one a flag creates by design.

A flag also can't tell an erasure request apart from any other deletion. If the trash, cancelled orders, and erasure requests all set the same column, the purge job has no way to know which rows have a one-month legal deadline and which have a 30-day courtesy window. The ICO's guidance even names a state outside the table. Backups can hold erased data until they rotate out, provided it's put "beyond use," so a schema that models erasure still needs a rule for the copies it doesn't hold.

### Legal Hold Runs the Other Way

Erasure has exceptions, and one of them points the other way. Article 17 doesn't apply where processing is needed "for the establishment, exercise or defence of legal claims," and in US litigation the duty to preserve starts before any lawsuit is filed. Federal Rule of Civil Procedure 37(e) sanctions the loss of electronic information "that should have been preserved in the anticipation or conduct of litigation." A row can be pending erasure and under a hold at the same time, and for the data the hold covers, the hold generally wins until it's released.

A boolean can't represent that combination. A purge job driven by `IsDeleted` can delete held data, and one that skips anything suspicious will keep data past its legal deadline. The only way to get both right is for the schema to record the hold and the erasure deadline as separate facts.

## Model the Lifecycle Instead

### Give Each State Its Own Name and Its Own Dates

Replace the flag with a status whose values are the states the domain actually has, and give each state the timestamp that drives its rule. Holds get their own table, because they overlay the status rather than replace it.

```csharp
public enum CustomerStatus
{
    Active,
    Closed,          // kept for history and reports until the record period ends
    PendingErasure   // must be erased by ErasureDueBy unless a hold applies
}

public class Customer
{
    public int Id { get; private set; }
    public string Email { get; private set; } = "";
    public CustomerStatus Status { get; private set; }
    public DateTimeOffset? ClosedAt { get; private set; }
    public DateTimeOffset? RetainUntil { get; private set; }
    public DateTimeOffset? ErasureDueBy { get; private set; }

    public void Close(DateTimeOffset now, TimeSpan recordPeriod)
    {
        Status = CustomerStatus.Closed;
        ClosedAt = now;
        RetainUntil = now + recordPeriod;
    }

    public void RequestErasure(DateTimeOffset now)
    {
        Status = CustomerStatus.PendingErasure;
        ErasureDueBy = now.AddMonths(1);
    }
}

// A hold overlays any status, and several can apply to one customer.
public class LegalHold
{
    public int Id { get; private set; }
    public int CustomerId { get; private set; }
    public string Matter { get; private set; } = "";
    public DateTimeOffset PlacedAt { get; private set; }
    public DateTimeOffset? ReleasedAt { get; private set; }
}
```

The purge job no longer guesses. It erases customers whose erasure deadline or retention period has arrived and who have no open hold, and it reports the held ones instead of silently skipping them, since the ICO expects an organization that doesn't erase to tell the person "the reasons you are not taking action" within the same month.

```csharp
var due = await db.Customers
    .Where(c => (c.Status == CustomerStatus.PendingErasure && c.ErasureDueBy <= now)
             || (c.Status == CustomerStatus.Closed && c.RetainUntil <= now))
    .Where(c => !db.LegalHolds.Any(h => h.CustomerId == c.Id && h.ReleasedAt == null))
    .ToListAsync(ct);
```

Each state also gets its own query rules. Active lists filter to `Active`. History and reports include `Closed`. Nothing but the purge job reads `PendingErasure`. Those are still filters, but each one says what it's for, so a reviewer can tell whether a report should include closed customers, which nobody can tell from `!IsDeleted`.

### Let Uniqueness Follow the State

A flag forces one answer to whether a deleted row still owns its unique values, and it's often the wrong one. A soft-deleted user who keeps their email blocks anyone from signing up with it, while dropping the constraint for every deleted row lets a trashed account's restore collide with a new one.

A partial unique index makes the answer a per-state decision. PostgreSQL's documentation shows the pattern, a unique index with a `WHERE` clause that applies only to the rows matching it, and SQL Server has the same thing as a filtered index, which EF Core's index documentation configures with `HasFilter`.

```sql
-- Active and closed customers keep their email unique; erasure candidates release it.
CREATE UNIQUE INDEX customers_email_unique ON customers (email)
    WHERE status IN ('Active', 'Closed');
```

Whether a closed account's email should stay reserved is a domain question. The schema can only answer it once the domain has named the state.

### Move What's Truly Gone Out of the Table

Some rows don't need a state at all, because nothing should read them again. Leach's alternative is a separate `deleted_record` table that holds a JSON copy of each deleted row, so the live table keeps real deletes and working foreign keys, and old copies can be purged with one statement. That fits the voided-or-merged case and the end of the trash window, where the row matters only as a record that it existed.

### When a Plain Flag Is Enough

A single `DeletedAt` column is an honest model when the domain really has one state. A trash with a fixed recovery window and a purge job that runs on it is that case. The column carries the only date the rule needs, the only reader that ignores it is the purge job, and nothing is held or erased on a deadline.

It stops being enough as soon as a second rule appears. That might be a report that needs cancelled orders, a retention period longer than the trash window, or the first erasure request. Each one tends to arrive as a special case in a query somewhere, and the schema goes on saying that all deleted rows are the same.

Lifecycle modeling costs more up front. There are more columns, more states to test, and a purge job with real logic in it. What it buys is that the rules live in one place, where they can be read and reviewed, instead of in every query that touches the table.

## Checking Your Own Schema

Find every table with an `IsDeleted` or `DeletedAt` column this week, and for each one:

- List the states it actually stands for. Ask who sets it, from which screen or job, and why.
- For each state, write down who should still see the row, whether it can be restored, and when it must be gone.
- Check whether any of those states has a legal deadline, like an erasure request, or a legal override, like a hold. If one does, the flag can't enforce it.
- Find the paths that read the table without your ORM's filter, such as reports, exports, scripts, and replicas, and check what they show for deleted rows.
- Check what a deleted row does to your unique constraints, and whether that's the answer the domain would give.

If one column turns out to mean three things, you've found the states your schema should name.
