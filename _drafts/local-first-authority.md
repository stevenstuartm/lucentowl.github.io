---
layout: post
title: "Local-First Software Moves Authority to the Device"
description: "Local-first software makes each device's copy of the data the one that counts, which removes the single place that could refuse a write. Only rules whose valid offline changes always merge into a valid state survive the move, and every other rule needs an authority that makes device writes tentative, divides the scarce resource in advance, or refuses to work offline."
tags: [architecture, local-first, crdt, distributed-systems, consistency, offline-first]
author: steven-stuart
sources:
  - title: "Kleppmann, Wiggins, van Hardenberg, and McGranaghan: Local-First Software: You Own Your Data, in Spite of the Cloud (Onward! 2019)"
    url: "https://www.inkandswitch.com/essay/local-first/"
  - title: "Shapiro, Preguiça, Baquero, and Zawirski: Conflict-Free Replicated Data Types (SSS 2011)"
    url: "https://link.springer.com/chapter/10.1007/978-3-642-24550-3_29"
  - title: "Bailis, Fekete, Franklin, Ghodsi, Hellerstein, and Stoica: Coordination Avoidance in Database Systems (VLDB 2014)"
    url: "https://amplab.cs.berkeley.edu/wp-content/uploads/2014/10/p168-bailis.pdf"
  - title: "Rocicorp: Ready Player Two, Bringing Game-Style State Synchronization to the Web (2023)"
    url: "https://rocicorp.dev/blog/ready-player-two"
  - title: "Zero documentation: Writing Data with Mutators"
    url: "https://zero.rocicorp.dev/docs/mutators"
  - title: "PowerSync documentation: Writing Client Changes"
    url: "https://docs.powersync.com/handling-writes/writing-client-changes"
  - title: "Electric documentation: Writes guide"
    url: "https://electric.ax/docs/guides/writes"
  - title: "Terry, Theimer, Petersen, Demers, Spreitzer, and Hauser: Managing Update Conflicts in Bayou, a Weakly Connected Replicated Storage System (SOSP 1995)"
    url: "https://dl.acm.org/doi/10.1145/224056.224070"
  - title: "Kleppmann: Making CRDTs Byzantine Fault Tolerant (PaPoC 2022)"
    url: "https://martin.kleppmann.com/papers/bft-crdt-papoc22.pdf"
  - title: "Ink & Switch: Keyhive, local-first access control"
    url: "https://www.inkandswitch.com/keyhive/notebook/"
  - title: "Helland and Campbell: Building on Quicksand (CIDR 2009)"
    url: "https://arxiv.org/abs/0909.1788"
  - title: "Balegas et al.: Extending Eventually Consistent Cloud Databases for Enforcing Numeric Invariants (SRDS 2015)"
    url: "https://arxiv.org/abs/1503.09052"
---

Local-first gives users their data. It takes away your only place to say no.

I find the local-first idea appealing. An app that opens instantly, works on a plane, and keeps the user's work on the user's own device fixes things that cloud apps made users put up with. The usual objection is that sync is hard, and it is, but libraries now handle much of it. What they can't do is the other half of what a server does. In a conventional app, every write passes through one process that can check it against every other write and refuse it. Local-first moves the copy that counts onto each device, and a device can only check a write against what it has seen.

My argument is that this loss of a single place to refuse a write is the cost to plan around, and that it's decided rule by rule, not app by app. A rule survives the move to the device if two devices, each making valid changes offline, can't break it when their changes merge. A rule that doesn't survive needs an authority again. That can be a server that makes the device's writes tentative until it agrees, a server that hands each device a share of the scarce resource before it goes offline, or a business that repairs the broken promise afterward.

## Local-First Makes the Device the Source of Truth

Martin Kleppmann, Adam Wiggins, Peter van Hardenberg, and Mark McGranaghan named the movement in their 2019 Onward! essay, "Local-First Software: You Own Your Data, in Spite of the Cloud." It sets out seven ideals, including "the network is optional" and "you retain ultimate ownership and control." The essay doesn't remove servers. It demotes them. In its words, the difference from traditional systems "is not an absence of servers, but a change in their responsibilities: they are in a supporting role, not the source of truth."

That sentence is the relocation. In a cloud app, the server's database is the source of truth, and the device holds a cache of it. In a local-first app, each device's copy is the primary one, and the server relays and backs up changes between them. The copy that counts is also the one that decides which writes stand, so authority moves with it.

The essay is explicit about scope. "We are not talking about implementing things like banking services, e-commerce, social networking, ride-sharing, or similar services, which are well served by centralized systems." Its examples are documents, drawings, and notes, where each user mostly edits their own work and collaborators merge their edits. The essay doesn't spell out why those domains fit and a bank doesn't. The reason is in which rules each one needs to enforce.

## Only Rules That Merge Survive the Move

### Convergence Is Not Validity

Local-first apps usually merge concurrent edits with conflict-free replicated data types, or CRDTs. Marc Shapiro, Nuno Preguiça, Carlos Baquero, and Marek Zawirski formalized them in 2011 around a guarantee they called strong eventual consistency. Any two replicas that have received the same updates are in the same state, with no coordination and no conflicts to resolve by hand.

That guarantee is about agreement. It says every device ends up with the same data, and nothing about whether that data satisfies your business rules. A CRDT set that two devices each add a booking to will contain both bookings on every device, which is exactly right for a set and exactly wrong if the two bookings are for the same room at the same hour.

### The Merge Test Sorts Rules by What They Protect

Peter Bailis, then at Berkeley, and his coauthors gave the precise test in "Coordination Avoidance in Database Systems" (VLDB 2014). They called the property invariant confluence. A rule is invariant confluent for a set of operations if, whenever two replicas start from a valid state and each apply valid operations independently, merging their results is also valid.

The test is easy to run by hand. Take one valid state, let two offline devices each make a change that's valid on their own copy, merge the results, and check the rule. Bailis's paper works through common constraints, and the answers depend on the operation as much as on the rule:

| Rule | Operation | Merges safely? | Why |
| --- | --- | --- | --- |
| Every order references an existing customer | Insert an order | Yes | Merging adds records and never removes the customer |
| Every order references an existing customer | Delete a customer | No | One device deletes the customer while another adds an order for them |
| Usernames are unique | Pick a specific name | No | Two devices both claim "sam" |
| Record IDs are unique | Generate some ID | Yes | Each replica draws from its own part of the ID space |
| Balance stays at or above zero | Deposit | Yes | Adding money can't push a balance below zero |
| Balance stays at or above zero | Withdraw | No | Two devices each withdraw the last 100 |
| Stock stays at or above zero | Sell an item | No | Two registers each sell the last unit |

The rows that fail share a shape. Each is a rule about something scarce, like a name, a slot, a balance, or the last unit, and each device spends it without knowing the other device spent it too. A notes app has almost no rules like that, which is why it fits local-first so well. A bank has little else.

### No Sync Algorithm Removes the Need to Ask First

It's tempting to treat the failing rows as an engineering gap that a cleverer sync engine will close. Bailis's Theorem 1 says otherwise. Invariant confluence is a "necessary and sufficient condition for invariant-preserving, coordination-free execution." If a rule fails the test, then "no possible implementation" can keep the rule, stay available on every replica, and converge without coordinating. Something has to ask, before the write commits, whether another replica already spent what this one is about to spend.

The result applies to any multi-leader system, and an offline-capable app is exactly that, since each device accepts writes as a leader and syncs when it reconnects.

## How Sync Engines Put the Authority Back

The production sync engines have met this limit, and their documentation shows how they get past it. They keep a server that decides.

### The Server Re-Runs Every Write

Rocicorp's Zero, and its earlier Reflect server, give each operation, which they call a mutator, two implementations. The client version runs immediately against local data, so the user sees the change with no spinner. The server version runs later, against the real database, and its result wins. Rocicorp's 2023 post describing the design puts it plainly. "In Reflect, the server is the authority. It doesn't matter what clients think or say the result of a change is." Zero's documentation shows a server mutator throwing `Access denied` when the user doesn't own the row, and says that when a server mutator throws, "the optimistic mutation on the client will be reverted."

PowerSync sends every local write to an endpoint the application team writes, and that endpoint applies it to the backend database, which PowerSync describes as server-authoritative. Electric doesn't sync writes at all. Its documentation says it "does not do write-path sync," and leaves writes to the application's own API. The designs differ, but in each one a server the team owns gets the last word on every write.

Here is the rule from the last table row, written as a server-side check in C#. Nothing in it is new. What's new is when it runs, possibly hours after the clerk saw the sale succeed.

```csharp
public async Task<WriteResult> ApplySale(SaleMutation sale, AppDbContext db)
{
    var stock = await db.Stock.SingleAsync(s => s.Sku == sale.Sku);

    if (stock.OnHand < sale.Quantity)
    {
        // The device already showed this sale as done. The server is the only
        // place that knows another register sold the last unit first.
        return WriteResult.Rejected(sale.Id, "Out of stock");
    }

    stock.OnHand -= sale.Quantity;
    db.Sales.Add(sale.ToEntity());
    await db.SaveChangesAsync();
    return WriteResult.Accepted(sale.Id);
}
```

### Every Offline Write Becomes Tentative

The price of a server that gets the last word is that the device's answer is only a guess until the server gives it. The user sees a write succeed, and the server can later undo it. PowerSync's documentation describes how that looks when the server doesn't apply a write. The changes "disappear from the device for a few seconds and then re-appear" as the server's version. It also warns teams not to answer validation failures with an error status, because that "will block the PowerSync client's upload queue."

None of this is new. Xerox PARC's Bayou system, described by Douglas Terry and his coauthors at SOSP 1995, let disconnected devices accept writes and marked each one tentative until a designated primary server committed it. Each write carried its own check that the data it depended on hadn't changed, and a procedure for merging it if it had. Bayou let applications show tentative and committed data separately. Almost thirty years later, the sync engines have arrived at the same split, and the hard part is still showing users the difference.

For a rule that passes the merge test, tentative writes cost almost nothing, because the server will accept them anyway. For a rule that fails it, tentative means a sale can be reversed after the customer has left, or a booking can be cancelled after the confirmation email went out. The longer a device stays offline, the more of its work is provisional.

### Who May Write Is a Rule Too

Access control is also a rule, and it depends on the same authority. In the server-authoritative engines it's easy, because the server checks who is writing, as Zero's `Access denied` example does. In a purely peer-to-peer local-first app, there's no server to check, so every peer has to decide which other peers may write and trust that they follow the rules. Kleppmann's 2022 paper "Making CRDTs Byzantine Fault Tolerant" notes that most CRDT algorithms can't guarantee consistency once a peer misbehaves. Ink & Switch's Keyhive project is still building capability-based access control for local-first apps. A team that wants local-first without a server has taken on research problems as well as engineering ones.

## Choose an Authority for Each Rule That Fails

The essay scopes local-first by domain, leaving out banking and e-commerce. The merge test allows a finer cut. Most apps mix mergeable rules with a few that aren't, and each rule can have its own home.

Pat Helland and Dave Campbell laid out the options for a rule that fails the test in "Building on Quicksand" (CIDR 2009), written about replicas that lose contact with each other rather than about devices. A replica can check with its backup before acting and pay the latency. It can over-provision, holding a fixed share of a resource so it can never promise what isn't there, as in their example of two replicas each selling 500 of 1,000 books. Or it can over-book, accepting work it may not be able to honor and apologizing when it can't. Their summary is that "either you have synchronous checkpoints to your backup or you must sometimes apologize for your behavior." Mapped onto a device and a server, those options give each rule one of these homes:

| Rule | Where it can live | What the user sees offline |
| --- | --- | --- |
| Passes the merge test (notes, edits, adding items, generated IDs) | The device | Final answers |
| Fails the test, but the scarce thing can be divided in advance | The device, within its share | Final answers until the share runs out |
| Fails the test, and the business can make good on a broken promise | The device, with the server detecting violations after sync | Final answers, and an occasional apology later |
| Fails the test, and the business can tolerate undoing a write | The server, with tentative writes on the device | A pending state, and occasional reversals |
| Fails the test, and neither an apology nor a reversal is acceptable | The server, and the device requires a connection | A refusal to proceed offline |

### Divide the Scarce Thing in Advance

Some rules that fail the merge test can pass it if the scarce resource is split before devices go offline. Bailis's paper shows this for unique IDs. If each replica assigns IDs from its own range, merges stay valid. Valter Balegas and his coauthors, including Shapiro and Preguiça, built the numeric version in 2015, a bounded counter that holds a numeric rule like "stock at or above zero" by giving each replica rights to part of the total, borrowing the older idea of escrow transactions. A register allotted 20 of a product's 100 units can sell those 20 offline with no risk of overselling. It has to ask before selling the 21st, and moving rights between replicas needs a connection. The server still holds the authority, but it hands out a share before the device goes offline.

### Accept the Write and Apologize

Some businesses already run on broken promises they know how to repair. Airlines overbook, and stores backorder. For a rule like that, the device can commit the write as final and the server can find the violations after sync, handing each one to a process that rebooks, refunds, or backorders. The rule is still enforced, but after the fact and by the business rather than by the database. Helland and Campbell make the point that apologies happen even with perfect coordination, since a warehouse forklift can destroy the last book after the system correctly promised it to a customer. A server's "no" only covers what the system can see.

### Keep the Server for the Rules That Must Refuse

For the rest, the design is a server that owns the rule and a device that knows its answer might be reversed. That means marking writes pending until they're confirmed and designing the screen a user sees when the server rejects one. For a few rules, like a payment or the final seat on a flight, it means refusing to proceed offline at all, since an offline answer there is one the business can't stand behind. An app built this way isn't local-first in the essay's full sense, because the server is the source of truth for those rules, but its mergeable rules still get instant, offline-capable behavior.

> **AUTHOR** — the author's experience goes here: Vue and Nuxt applications that kept truth on the server, and which of their rules would have passed or failed the merge test.

## Checking Your Own Rules

Before choosing a sync engine, list the rules the server enforces today and run each one through the merge test:

- **List every rule the server enforces,** including database constraints, validation in write handlers, and authorization checks. These are the rules that lose their enforcer when writes move to the device.
- **Run the merge test on each one.** Start from one valid state, let two offline devices each make a change that's valid on their own copy, and merge. If the result can break the rule, it needs an authority.
- **For each rule that fails, decide whether the scarce thing can be divided in advance,** such as ID ranges, seat blocks, or stock allotted per device.
- **For the rest, decide what a broken promise costs.** If the business already repairs it, as with a backorder, let the device commit and detect violations after sync. If a reversal is cheaper, keep the rule on the server and design the pending state and the rejection screen. If neither is acceptable, require a connection for that operation.
- **Decide who checks access.** If there's no server in the write path, name the mechanism that stops a device from writing what its user isn't allowed to.

If most rules pass, the app is a good fit for local-first. If the rules that matter most to the business fail, the server is still the only place that can say no, and the app should keep it there.
