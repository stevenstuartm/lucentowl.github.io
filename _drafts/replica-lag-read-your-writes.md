---
layout: post
title: "Read Replicas Make Your Reads Lie"
description: "Routing reads to replicas makes every read eventually consistent, including the reads that follow a user's or a service's own write. Those paths take four recognizable shapes, the session-scoped fixes frameworks ship cover only some of them, and a test run against a deliberately delayed replica finds the rest."
tags: [databases, replication, consistency, distributed-systems, aws]
author: steven-stuart
sources:
  - title: "Terry et al.: Session Guarantees for Weakly Consistent Replicated Data (PDIS 1994)"
    url: "https://dl.acm.org/doi/10.5555/381992.383631"
  - title: "Martin Kleppmann: Designing Data-Intensive Applications (O'Reilly)"
    url: "https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/"
  - title: "Amazon Aurora User Guide: Replication with Amazon Aurora"
    url: "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Replication.html"
  - title: "Amazon RDS User Guide: Working with DB instance read replicas"
    url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html"
  - title: "TanStack Query: Invalidations from Mutations"
    url: "https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations"
  - title: "Ruby on Rails Guides: Multiple Databases with Active Record"
    url: "https://guides.rubyonrails.org/active_record_multiple_databases.html"
  - title: "Laravel: Database, Read and Write Connections"
    url: "https://laravel.com/docs/12.x/database"
  - title: "MediaWiki: ChronologyProtector"
    url: "https://www.mediawiki.org/wiki/Manual:ChronologyProtector"
  - title: "Amazon Aurora User Guide: Read consistency for write forwarding"
    url: "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-mysql-write-forwarding-consistency.html"
  - title: "MongoDB Manual: Read Isolation, Consistency, and Recency"
    url: "https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/"
  - title: "MySQL 8.4 Reference Manual: Delayed Replication"
    url: "https://dev.mysql.com/doc/refman/8.4/en/replication-delayed.html"
  - title: "PostgreSQL Documentation: Replication settings (recovery_min_apply_delay)"
    url: "https://www.postgresql.org/docs/current/runtime-config-replication.html"
  - title: "Wikimedia Phabricator T230211: GET requests in API integration tests should see the effect of previous POST requests"
    url: "https://phabricator.wikimedia.org/T230211"
---

The user saved. The page reloaded. The change was gone, for 80 milliseconds. When a second reload brings it back, the bug report reads "sometimes my edits don't stick," and nobody on the team can reproduce it.

Adding a read replica feels like a capacity change, but it's a consistency change. Every read routed to a replica becomes eventually consistent, including the reads that come right after the same user or the same service wrote something. Nothing in the routing asks which reads those are, and the test suite usually runs against a single database that can't show the difference, so the bugs arrive looking intermittent and untraceable.

The guarantees these paths need aren't new. Douglas Terry and his colleagues at Xerox PARC named them in "Session Guarantees for Weakly Consistent Replicated Data" (PDIS 1994): read your writes, monotonic reads, writes follow reads, and monotonic writes. Martin Kleppmann's *Designing Data-Intensive Applications* covers the first two in its chapter on replication, along with the standard fixes. What I want to add is how to find the paths that need them. They take four recognizable shapes, the fixes frameworks ship cover only some of those shapes, and you can find the rest by making the lag big enough to see.

## A Replica Makes Every Read Eventual

### The Lag Is Small, but the Next Read Can Be Faster

Managed replicas are fast, which is why this is easy to dismiss. The Aurora documentation says replica lag "is usually much less than 100 milliseconds after the primary instance has written an update." Ordinary RDS read replicas are updated through the engine's own asynchronous replication, as the RDS documentation on read replicas describes, and it offers no comparable figure for their lag.

But the read that follows a write comes quickly. A browser follows the redirect after a form post as soon as the response arrives, and a single-page app refetches the moment its mutation succeeds. Either read arrives one round trip after the write returned, and for a client near the servers that can be less than the lag Aurora calls small. The same page adds that "replica lag varies depending on the rate of database change," and that during heavy writes "you might see an increase in replica lag." So the window widens exactly when the system is busiest and the most users are writing.

### Nothing Fails Where Anyone Is Looking

The bug hides in three ways. Local development and most test environments run a single database, where every read is a read from the writer. In production, most reads that follow a write still land after replication has caught up, so the bug appears for a fraction of users, and a retry fixes it. And when it does appear, it correlates with write load rather than with any code change, so it rarely gets traced back to the decision to route reads to replicas.

> **AUTHOR** — the author's experience goes here: Aurora read replicas in production at the financial research platform, and a read-your-writes path that surfaced after reads moved to the reader endpoint.

## Four Paths Read Their Own Writes

A read needs read-your-writes when it follows a write in the same logical flow, arrives within the lag window, and depends on what was written. In practice that describes four shapes, and a codebase can be searched for each one.

### A Redirect After a Write

The post, redirect, get pattern exists so a reload doesn't resubmit a form. It also guarantees that a read follows every write immediately, on a new request that a router may send to a replica. The user lands on a page that shows their data from before the save.

### A Refetch After a Mutation

Client-side data libraries make the same move deliberately. TanStack Query's documentation on invalidations from mutations tells developers that when a mutation succeeds, "it's VERY likely that there are related queries in your application that need to be invalidated," and its example invalidates them in the mutation's success callback. The refetch goes out immediately. If the API behind it reads from a replica, the client replaces what the user just saved with stale data from the server.

### A Write and a Read in One Request, on Two Connections

Within a single request, code that saves through a writer context and then loads through a reader context has the same gap with no network hop to hide it. This path tends to appear when a repository or query layer is wired to the replica by default and a command handler reuses it to build its response.

### A Consumer Acting on the Writer's Event

A service commits a write, then publishes an event, perhaps through an outbox. A consumer in another service picks up the event and reads the record the event describes. The event can travel through the broker faster than the change travels to the replica, and the consumer reads a row that doesn't exist yet or a version that predates the event. This is the path least likely to be found, because the reader isn't the writer, and the failure shows up in a different team's logs.

### Everything Else Can Stay on the Replica

Most read traffic isn't on any of these paths. A product listing, a dashboard someone else's writes feed, or a search page can show data a few hundred milliseconds old without anyone noticing, and those reads are usually the load that justified the replica. Sending every read to the writer to be safe gives up the offload the replica was added for. The work is to separate the few reads that follow their own writes from the many that don't, and to route only those.

## Session Fixes Cover Some Paths and Miss Others

### Each Framework Protects a Different Set of Paths

Several frameworks and databases ship a fix. Measured against the four paths, they cover different ground.

| Mechanism | What it remembers | Covers | Misses |
| --- | --- | --- | --- |
| Rails automatic role switching | The time of the session's last write, for a `delay` that defaults to 2 seconds | The redirect and the refetch from the same session, and reads within a write request, which go to the writer | The consumer. The guide says Rails "doesn't guarantee 'read a recent write' for other users within the delay window" |
| Laravel's `sticky` option | Whether this request has written | Reads later "during the current request cycle" | The redirect, the refetch, and the consumer, which all arrive as new requests |
| MediaWiki's ChronologyProtector | The database's replication position after the user's write, for "about one minute" | The user's next requests, including the redirect and the refetch, served by a replica that has caught up | The consumer, which is outside the user's session |
| Aurora MySQL write forwarding with `aurora_replica_read_consistency = SESSION` | The writes this database session forwarded to the writer | Reads on the same connection, which wait for those writes to replicate | Any read on another connection, including writes made through the cluster endpoint and read back through the reader endpoint |
| MongoDB causally consistent sessions | The session's operation and cluster time | Reads in the session, and in another session advanced to the same time | Any reader that's never handed that time |

Rails and Laravel draw the line in different places. An application that trusts `sticky` to handle read-your-writes is protected inside the request and exposed on the redirect, the path the post, redirect, get pattern creates on every form save.

### A Session Guarantee Ends at the Session

Terry's guarantees are defined per session, and every mechanism in that table inherits the limit. A consumer handling an event is a different session, so none of the session-scoped fixes reach the fourth path.

Two fixes do. The first is to send those consumers to the writer. The second is to carry the writer's position along with the event, which is what ChronologyProtector does with a session and what MongoDB supports across clients. MongoDB's manual notes that a client "can advance the cluster time and the operation time of one client session to be consistent with the operations of another client session." In PostgreSQL the position is the WAL location from `pg_current_wal_lsn()` after the commit, which a consumer can compare with `pg_last_wal_replay_lsn()` on the replica. In MySQL it's the GTID set, which a consumer can wait on with `WAIT_FOR_EXECUTED_GTID_SET()`. Managed engines don't always expose these the same way, so confirm what yours supports before building on it. Where it doesn't, the writer is the dependable choice.

### A Time Window Guesses, and a Position Knows

The fixes differ in what they remember. Rails remembers a time, and assumes the replica has caught up once the window passes. ChronologyProtector and MongoDB remember a position, and wait until a replica has actually reached it.

A time window is simpler to build and works on any database, but its length has to cover the worst lag you've seen, not the typical lag. A window sized for Aurora's usual lag of under 100 milliseconds fails on the busy afternoon when lag grows. In ASP.NET Core, which ships no read-routing fix of its own, a time window takes a few lines:

```csharp
public sealed class ReadRouting(IHttpContextAccessor http, TimeProvider clock)
{
    const string CookieName = "last-write";

    // Longer than the worst replica lag you've measured, not the typical lag.
    static readonly TimeSpan Window = TimeSpan.FromSeconds(5);

    // Call after any successful write on behalf of this user.
    public void RecordWrite() =>
        http.HttpContext!.Response.Cookies.Append(
            CookieName,
            clock.GetUtcNow().ToUnixTimeMilliseconds().ToString(),
            new CookieOptions { HttpOnly = true, Secure = true, MaxAge = Window });

    // Check the timestamp on the server rather than trusting the browser to expire the cookie.
    public bool MustReadFromWriter() =>
        http.HttpContext?.Request.Cookies[CookieName] is { } value
        && long.TryParse(value, out var ms)
        && clock.GetUtcNow() - DateTimeOffset.FromUnixTimeMilliseconds(ms) < Window;
}

public sealed class OrderQueries(ReadRouting routing, WriterDbContext writer, ReaderDbContext reader)
{
    AppDbContext Db => routing.MustReadFromWriter() ? writer : reader;

    public Task<Order?> FindAsync(Guid id, CancellationToken ct) =>
        Db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id, ct);
}
```

This covers the redirect and the refetch from the same browser. It doesn't cover the same user on a second device, which Kleppmann notes needs the marker stored on the server rather than in the client. And it doesn't cover a consumer acting on an event, which never carries the cookie.

## Find the Paths by Exaggerating the Lag

The four shapes tell you where to look, and a delayed replica tells you whether you found them all. The MySQL reference manual lists testing as one of the reasons delayed replication exists: "To test how the system behaves when there is a lag," since lag caused by heavy load "can be difficult to generate," and a delay "can simulate the lag without having to simulate the load." MySQL sets it with `CHANGE REPLICATION SOURCE TO SOURCE_DELAY = N`, in seconds. PostgreSQL's equivalent is `recovery_min_apply_delay` on the standby, which holds back each commit until the standby's clock is that far past the primary's commit time.

Point a test environment's read connection at a replica delayed by a few seconds and run the end-to-end suite. At that delay, every path that needs read-your-writes fails every time instead of occasionally, and each failure names a path. The delay is far larger than production lag on purpose. It turns a timing question into a deterministic one.

If the application already routes by a time window, the delay decides what the run tests. A delay shorter than the window finds the paths the window doesn't protect. A delay longer than the window shows what users see on the day lag outgrows it.

Wikimedia's engineers met the same problem from the test side. Phabricator task T230211 describes API integration tests where "a client performs a write action via the API, and wants to perform a subsequent action that requires the first write to have been completed," with replication lag and deferred updates among the causes, and ChronologyProtector's per-user scope unable to cover every case. A suite that assumes every read sees every earlier write is making an assumption production doesn't honor.

Aurora Replicas have no delay setting, since they read the writer's own storage volume. The delayed replica belongs in a test environment running the engine's own replication, where the point is to exaggerate lag, not reproduce Aurora's.

## Checking Your Own Read Paths

This week, for each service that reads from a replica:

- List the endpoints that read from a replica right after the same user writes, starting with redirect targets and anything a client refetches after a mutation. What do they return during lag?
- Search command handlers for a save followed by a read through the reader connection.
- List the consumers of your write events, and check which connection they read from.
- Find your replica lag metric, such as `AuroraReplicaLag` or `ReplicaLag`, and compare its maximum over the last month with any time window your read routing assumes.
- Run one end-to-end suite against a replica delayed by a few seconds, and treat each failure as a path that needs a guarantee.

The replica is doing what replicas do. Each read either tolerates that or needs a guarantee, and a delayed replica tells you which before your users do.
