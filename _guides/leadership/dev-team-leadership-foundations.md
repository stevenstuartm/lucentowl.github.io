---
layout: guide
title: "Dev Team Leadership"
category: Leadership & Team Management
subcategory: Engineering Leadership
description: "What a new dev team lead does from the first day through steady delivery: clarifying the role and its authority, running 1:1s and iterations, reading team health, managing performance, and leading through incidents, missed deadlines, conflict, and departures."
tags: [fundamentals, team-lead, one-on-ones, delegation, performance-management, team-health, incident-management]
---

You're now responsible for a development team. Whether you were promoted internally, hired externally, or put in the role unexpectedly, you need to know what to do starting now. This guide covers the concrete activities that establish credibility in the first weeks, keep the team productive through routine iterations, and hold it together when something goes wrong.

## Which Lead Are You?

"Team lead" names two different jobs that organizations often blend into one role.

| | Tech lead | Engineering manager |
| --- | --- | --- |
| **Owns** | Technical direction, design quality, how the work gets built | People: hiring, performance, careers, team health |
| **Writes production code** | Yes, usually a meaningful share | Rarely, and not on the critical path |
| **Measured by** | Whether the system is sound and the team ships it | Whether the team is staffed, growing, and delivering |

Many first-time leads hold some mix of both. The mix matters because it decides what "doing too much" looks like. A tech lead who stops coding loses the context the role depends on. A manager who keeps taking critical-path tickets becomes the bottleneck the team waits on. Most of this guide applies to both, and the sections on performance management and attrition apply mainly to whoever holds people authority.

## Day Zero: Clarify the Role Before Acting

### Get Your Authority Defined Explicitly

<blockquote class="pull-quote">
<p>Don't assume your authority. Get it explicitly defined.</p>
</blockquote>

Before doing anything visible, schedule a 1:1 with your manager and settle what you can and cannot do. Authority that goes unstated gets discovered by overstepping it, usually in front of the team.

<div class="callout callout--warning">
<p class="callout__title">Questions to Answer in the First Days</p>
<ul>
<li>Do I make hiring and firing decisions, or recommend them?</li>
<li>What can I spend without approval, and up to what limit?</li>
<li>Can I change processes, tooling, or delivery practices on my own?</li>
<li>What does my manager expect from me in the first 90 days?</li>
<li>What has the team already committed to, and by when?</li>
</ul>
</div>

### Inventory What You're Inheriting

Four areas describe what you've inherited: the **team** (who is on it, their tenure and experience, open positions, anyone leaving, known performance issues), the **work in flight** (current iteration, deadlines, active incidents), the **technical landscape** (what systems the team owns, how they deploy, where documentation and decision records live), and the **working practices** (recurring meetings, tools, definition of done, how bugs and incidents are handled).

Gather this from existing documentation, the backlog, the recurring meetings on the team calendar, and your predecessor if you can reach them. Most of it is available without asking anyone, which saves your early conversations for what documents can't tell you.

### Introduce Yourself Without Disrupting Flow

Introduce yourself at the next team meeting and keep it short. Say who you are, that you're there to support the team and remove obstacles, that you'll learn how things work before changing anything, and that you'll be scheduling 1:1s with everyone.

Resist the pull to prove yourself early. Proposing changes on day one, criticizing existing practices, or promising fixes you can't guarantee all signal that you've judged the team before meeting it.

## Week One: Build Context

### Hold a First 1:1 With Everyone

Meet every team member individually within the first week. These are listening sessions, not performance reviews, and 30 to 45 minutes is enough. Cover their background and goals, what they're working on and what frustrates them about it, who they work with and where collaboration rubs, what in the current process works or wastes time, and anything blocking them right now.

Listen across conversations as well as within them. A complaint that comes up with three different people points at the system rather than at a person. Also note who seems disengaged, which blockers you could remove this week, and where expertise or leadership potential is going unused. If several people raise the same easily fixed problem, fix it immediately. Nothing builds early credibility faster.

### Set Up Communication Channels

Put recurring 1:1s on the calendar now, weekly or every two weeks depending on team size, so the cadence exists before anything competes for the time. Be visibly present and responsive in the team's chat channels, since developers need to know how to reach you. On a team larger than about eight people, open office hours give people a way to reach you between 1:1s.

### Observe the Team's Ceremonies

Attend every standup, planning session, retro, and review in the first week, and observe more than you speak. Watch who speaks up and who stays silent, whether meetings produce decisions or just consume time, and whether the team owns its work or waits to be told what to do.

### Review Technical Ownership

List the services and components the team owns, their availability commitments, the on-call rotation if there is one, and where the runbooks live. Then read the last three to six months of production incidents. What failed, why, and whether it was preventable tells you where the technical debt and operational risk actually sit. Deployment frequency tells you something too. A team that deploys monthly carries more risk per deployment and usually has more manual process than one that deploys daily.

## Week Two: Early Wins and Rhythm

### Deliver Two or Three Quick Wins

<blockquote class="pull-quote">
<p>Credibility comes from removing friction and demonstrating you're useful.</p>
</blockquote>

The first 1:1s reveal the candidates. A good quick win is something several people complained about, that is easy to change, that affects daily work, and that sits inside your authority. Typical examples are cancelling a meeting everyone considers a waste, fixing a slow or flaky pipeline step, getting approval for a long-requested tool, or documenting a task everyone keeps asking about.

### Make Decisions and Updates Predictable

Decide how status and decisions will reach the team (a weekly written summary, a slot in planning, or a dedicated channel) and keep to it. When you make a decision that affects the team, share the reasoning along with the conclusion. Make the escalation path explicit too, so people know how to raise a blocker, a conflict, or something urgent.

### Meet the Stakeholders

Meet the people outside the team who depend on it: the product owner if that isn't you, peer leads and architects, your manager, and any business stakeholders consuming the team's output. Ask each what they expect from the team, how they judge success, what works and what frustrates them in the current collaboration, and how they prefer to communicate. Their answers are often inconsistent with each other, and finding that out early is part of the value.

## Running the Iteration Cycle

Iteration mechanics depend on the team's methodology (Scrum, Kanban, Shape Up, or a hybrid). The lead's responsibilities in each part of the cycle are similar regardless.

### Planning

Before planning, review upcoming work with the product owner, surface technical risks and unknowns, and make sure items have acceptance criteria. During planning, facilitate rather than dominate. Confirm the team understands what's being asked, call out dependencies, account for real capacity (leave, on-call, meetings), and push back when a commitment is unrealistic. Afterward, make sure the iteration goal is written down and ownership of the work is clear.

Planning is going badly when the team is silent, when work is dictated rather than discussed, when nobody asks clarifying questions, or when the same person always drives the estimates.

### Standups

The team drives standup, not you. Listen for blockers you can remove, work that has stalled, coordination needs between people, and confusion about priorities. Take problem-solving offline, and don't let standup turn into a status report delivered to you. For an experienced or distributed team, asynchronous written updates can replace the daily meeting entirely.

### Mid-Iteration Check

Halfway through, check whether committed work is on track, whether blockers are unresolved, whether scope needs to change, and whether anyone is stuck without saying so. The board and your 1:1s usually answer this without an extra meeting.

### Review and Demo

Team members should present their own work, with you facilitating and making sure stakeholders understand what was delivered and what comes next. Be concerned when nobody wants to demo, when stakeholders leave confused, when "done" work isn't shippable, or when the same person always presents.

### Retrospective

The retro is where the team changes its own process, and your job is to facilitate, listen, and commit to the changes. The format matters less than two rules: nobody is blamed, and every action item has an owner and gets tracked. If the same issue appears retro after retro without action, the team learns that raising problems is pointless, and the retros go quiet.

### Delivery Metrics

Measure trends, not absolute values, and measure the flow of work rather than individual output.

| Metric | What it shows |
| --- | --- |
| **Throughput** | Items completed per iteration, under any methodology |
| **Cycle time** | Time from starting an item to finishing it. Rising cycle time points at blockers or too much work in progress |
| **Velocity** | Story points completed. Only meaningful as this team's own trend, never compared across teams |
| **Escaped defects** | Bugs found in production that testing should have caught |

For the delivery pipeline itself, [DORA's software delivery metrics](https://dora.dev/guides/dora-metrics/){:target="_blank" rel="noopener noreferrer"} are a widely used benchmark. They measure throughput as change lead time, deployment frequency, and failed deployment recovery time, and instability as change fail rate and deployment rework rate. Report to stakeholders briefly: what was delivered, what's next, and the risks.

## People Management

### Regular 1:1s

1:1s are your most important people-management tool, and consistency matters more than length. Meet weekly with new or struggling team members and every two weeks with experienced ones who are doing well. The time belongs to them. Start with how they're doing, then current work and frustrations, team dynamics, career growth, and feedback in both directions, and end with what each of you will do before the next one.

Listen for declining morale, friction with teammates, signs of burnout like late nights and weekend work, and confusion about priorities. A 1:1 that turns into a status update wastes its purpose, and one that keeps getting rescheduled tells the person where they rank.

### Delegation and Ownership

You can't do all the work, and trying to stunts the team. Delegate work that builds capability, such as running ceremonies, leading a technical spike, mentoring a newer developer, or representing the team in a cross-team discussion.

Delegation works when the person knows the outcome you want, why it matters, what they're allowed to decide without you, and when you'll check in. Then let them do it and review the result rather than the steps. You're under-delegating if every decision routes through you, if work stops when you're out, or if you're working nights while the team has capacity.

### Performance Management

Developing strong performers and addressing weak performance are the same job. For strong performers, that means recognition in public and private, work that stretches them, growth opportunities like leading a project or mentoring, and advocacy for promotion when it's earned. It also means not treating them as the default destination for every hard problem until they burn out.

Address underperformance early and specifically. Name what isn't meeting expectations, agree on concrete goals and a timeline, provide support through mentoring, pairing, or training, and document each conversation. If there's no improvement, involve HR and follow the company's formal process. Nobody should hear about a problem for the first time in a performance review, so if that happens, the feedback came too late.

## Reading Team Health

Some dysfunctions don't show up in delivery metrics until they've done damage. They show up first in how the team behaves, and the behaviors below each have a cause that social psychology named long before software teams existed.

### Adding People Slows the Team Down

Ivan Steiner called it process loss in *Group Process and Productivity* (1972): the gap between what a group could produce and what it does produce, because coordinating people consumes effort. Its best-known software form is Brooks's Law.

> "Adding manpower to a late software project makes it later."
>
> -- Fred Brooks, *The Mythical Man-Month* (1975)

Brooks's reasoning was that new people need time to ramp up, existing people spend time training them, and communication paths multiply as a team grows. Some work also can't be divided at all. As Brooks put it, a child takes nine months no matter how many women are assigned.

The symptoms are frequent merge conflicts, several people changing the same code, and more time spent coordinating than building. The remedy is to split the work into streams that can proceed independently, and to add people only where such a stream exists for them.

### Practices Nobody Defends Keep Going

A team might privately think the daily standup is a waste of time, yet nobody says so because each person assumes the others find it useful, and the practice continues indefinitely. Daniel Katz and Floyd Allport named this pluralistic ignorance in 1931: most members of a group privately reject a norm but assume everyone else accepts it, so they all go along.

It shows up as practices that persist with no clear value, complaints voiced in private but never in the team setting, and meetings where nobody challenges anything. Counter it by asking directly ("Is this meeting useful? Should we change it?"), by discussing things in smaller groups where people speak more freely, and by using anonymous input when the topic is sensitive.

### Shared Work Goes Undone

A bug report posted in a channel with twenty people can sit untouched precisely because twenty people saw it. When a task belongs to everyone, each person assumes someone else will handle it. John Darley and Bibb Latané demonstrated this diffusion of responsibility in 1968, showing that people were less likely to help someone in trouble the more bystanders they believed were present.

Watch for work falling through the cracks, "I thought someone else had that," and finger-pointing after something goes wrong. The remedy is explicit ownership. Every task and every shared channel responsibility has a named owner, visible on the board or rotated on a schedule.

### Problems Surface Late

Risks, mistakes, and doubts reach the lead only when they can no longer be hidden: at the demo, in production, or in a postmortem where someone says they had suspected it for weeks. Amy Edmondson's research on team learning (1999) traced this to psychological safety, a shared belief that it is safe to take interpersonal risks such as admitting a mistake or questioning a plan. Teams without it stay quiet, not because nothing is wrong, but because speaking up feels more dangerous than waiting.

The symptoms are bad news arriving all at once, retrospectives where nobody names a problem, and estimates that are never challenged. The lead sets the level more than anyone. Admit your own mistakes openly, thank the person who brings bad news before discussing the problem, and keep incident reviews focused on how the system allowed the failure rather than on who caused it.

## When Things Go Wrong

### Production Incidents

During an incident, your job is to support the response, not to run the debugging.

1. **Stay calm.** The team takes its cue from you.
2. **Make sure someone is leading the response**, usually the on-call engineer or a senior developer, and let them lead.
3. **Remove obstacles** by getting approvals, escalating blockers, and pulling in other teams.
4. **Update stakeholders on a fixed, announced cadence** so they stop interrupting responders for status.
5. **Shield responders** from questions and meetings that can wait.

Teams that resolve incidents quickly tend to follow a disciplined process. They gather facts before interpreting them, reproduce the problem before fixing it, and change one thing at a time. [Troubleshooting Production: Discipline Under Pressure](/blog/2025/11/08/troubleshooting-production.html){:target="_blank" rel="noopener noreferrer"} covers that discipline in depth.

Afterward, hold a blameless postmortem while details are fresh. [Google's SRE guidance](https://sre.google/sre-book/postmortem-culture/){:target="_blank" rel="noopener noreferrer"} defines blameless as assuming everyone involved acted with good intentions on the information they had, which moves the analysis from who erred to what in the system allowed it. Agree on the criteria that trigger a postmortem before incidents happen, give every corrective action an owner and a date, and follow up until they're done. Incidents that recur mean the corrective actions aren't happening, and people hiding mistakes means the postmortems aren't actually blameless.

### Missed Commitments

As soon as you know a commitment will slip, tell stakeholders. Waiting for the deadline turns a planning problem into a trust problem. Explain what happened (a bad estimate, changed requirements, an unexpected blocker), offer options such as partial delivery, a later date, or reduced scope, and commit to a revised plan you can keep. Then run a retro on the miss. Repeated overcommitment is a process problem, and the fix is usually in how the team estimates and how much buffer it plans.

### Team Conflict

Address conflict between team members early, before others start taking sides or routing work around each other.

1. **Talk to each person separately first** to hear both perspectives.
2. **Find the underlying issue**, which is often not the stated one.
3. **Bring them together** if they can't resolve it themselves, and facilitate.
4. **Set the expectation** that disagreement is fine and disrespect is not.
5. **Follow up** with both a week later.

A conflict left to simmer, or one person who repeatedly causes conflict without consequence, damages the rest of the team's trust in you as well as in each other.

### Departures

When someone leaves, find out what they owned and what knowledge leaves with them, and if they're leaving on good terms, capture it in runbooks and decision records before their last day. Redistribute their work deliberately, tell the team what's happening as openly as HR constraints allow, and tell stakeholders how commitments change. If you're backfilling, start recruiting immediately, involve the team in interviews, and have an onboarding plan ready.

Departures reveal knowledge concentrated in one person, and they can overload the people who stay. One departure followed by an overloaded team is how a single resignation becomes several.

## Signs You've Miscalibrated

<div class="comparison">
<div class="content-card content-card--accent">
<h4>You're Doing Too Much</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>Working late and weekends regularly</li>
<li>You're the bottleneck for decisions</li>
<li>The team waits for you to tell them what to do</li>
<li>You hold critical-path work the team is waiting on</li>
</ul>
<p><strong>Fix</strong>: Delegate more, let the team make decisions, move your own coding off the critical path, and spend the time unblocking</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>You're Not Doing Enough</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>The team is directionless or confused</li>
<li>Blockers sit unresolved for days</li>
<li>Stakeholders go around you</li>
<li>Conflicts simmer without resolution</li>
</ul>
<p><strong>Fix</strong>: Engage more, remove blockers before you're asked, use your authority, and address conflicts directly</p>
</div>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>You've Lost Technical Credibility</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>The team dismisses your technical input</li>
<li>You can't follow design discussions</li>
<li>You no longer understand the codebase</li>
</ul>
<p><strong>Fix</strong>: Review code, build prototypes, pair on hard problems, and attend technical discussions</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>You're Protecting the Team from Reality</h4>
<p><strong>Symptoms</strong>:</p>
<ul>
<li>The team doesn't understand business constraints</li>
<li>Priority shifts surprise developers</li>
<li>You absorb all stakeholder pressure and conflict yourself</li>
</ul>
<p><strong>Fix</strong>: Share context freely, involve the team in priorities, and let them hear stakeholder feedback directly</p>
</div>
</div>

## Key Takeaways

- **Settle the role first.** Know whether you're a tech lead, a manager, or both, and get your authority stated before you use it.
- **Listen before changing.** Use the first week of 1:1s and ceremonies to learn, then deliver a few quick wins drawn from what you heard.
- **Facilitate the cycle.** The team owns planning, standup, and retros, while you remove blockers and make sure retro actions happen.
- **Protect the 1:1 cadence.** It's where morale, conflict, and performance problems surface early enough to fix.
- **Watch behavior before metrics.** Slowdowns as the team grows, practices nobody defends, shared work left undone, and problems that surface late all erode a team before delivery numbers show it.
- **In a crisis, support rather than take over.** Communicate early, keep postmortems blameless, and follow corrective actions to completion.

Success is measured by what the team delivers and how it grows, not by your personal output.
