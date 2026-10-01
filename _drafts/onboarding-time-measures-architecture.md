---
layout: post
title: "What Developer Onboarding Time Says About Your Architecture"
description: "Total onboarding time mostly measures documentation, access, and mentoring, and time to a first change doesn't even predict ramp-up. The part of a newcomer's first change spent finding where the change belongs and what else it touches does measure architecture, and it shows how legible the structure is, which coupling metrics don't capture."
tags: [architecture, onboarding, modularity, coupling, developer-experience]
author: steven-stuart
sources:
  - title: "Rastogi, Thummalapenta, Zimmermann, Nagappan, and Czerwonka: Ramp-up Journey of New Hires: Tug of War of Aids and Impediments (ESEM 2015)"
    url: "https://thomas-zimmermann.com/publications/files/rastogi-esem-2015.pdf"
  - title: "Ju, Sajnani, Kelly, and Herzig: A Case Study of Onboarding in Software Teams: Tasks and Strategies (ICSE 2021)"
    url: "https://arxiv.org/abs/2103.05055"
  - title: "Spotify: How Backstage Made Our Developers More Effective"
    url: "https://backstage.spotify.com/blog/how-backstage-made-our-developers-more-effective"
  - title: "Dagenais, Ossher, Bellamy, Robillard, and de Vries: Moving into a New Software Project Landscape (ICSE 2010)"
    url: "https://www.cs.mcgill.ca/~martin/papers/icse2010.pdf"
  - title: "Sillito, Murphy, and De Volder: Questions Programmers Ask During Software Evolution Tasks (FSE 2006)"
    url: "https://www.cs.ubc.ca/~murphy/papers/other/asking-answering-fse06.pdf"
  - title: "Treude, Gerosa, and Steinmacher: Towards the First Code Contribution: Processes and Information Needs (2024)"
    url: "https://arxiv.org/abs/2404.18677"
  - title: "Borg, Tornhill, and Mones: U Owns the Code That Changes and How Marginal Owners Resolve Issues Slower in Low-Quality Source Code (EASE 2023)"
    url: "https://arxiv.org/abs/2304.11636"
  - title: "Noda, Storey, Forsgren, and Greiler: DevEx: What Actually Drives Productivity (ACM Queue, 2023)"
    url: "https://queue.acm.org/detail.cfm?id=3595878"
  - title: "Thoughtworks Technology Radar: Architectural fitness function"
    url: "https://www.thoughtworks.com/radar/techniques/architectural-fitness-function"
---

Your architecture diagram says the system is clear. Your last new hire took six weeks to ship a change that wasn't a typo fix. I think most leads would read those six weeks as a verdict on the diagram, and I wanted to know whether the research backs that reading. It mostly doesn't. The studies of developer onboarding blame documentation, access, setup, and mentoring for most of the delay, and one of them found that the time to a first change doesn't even predict how fast someone ramps up afterward.

A smaller part of that time does measure architecture. It's the hours a newcomer spends working out where a change belongs and what else it will touch. Those hours show whether the structure makes its own layout visible to someone who doesn't already know it. That's a property coupling metrics don't record, and a new hire's first few changes are one of the few places it shows up.

## Most Onboarding Time Isn't Architecture

### The Studies Blame Documentation, Access, and Mentors

Ayushi Rastogi, Suresh Thummalapenta, Thomas Zimmermann, Nachiappan Nagappan, and Jacek Czerwonka measured the time from a new hire's start date to their first check-in across eight large product groups at Microsoft, in "Ramp-up Journey of New Hires" (ESEM 2015). They then surveyed the new hires about what slowed them down. Lack of proper documentation strongly increased the time to first check-in in five of the seven groups that responded, and moderately in the other two. Getting access and permissions increased it in every group. Working on code with dependencies on other people's work, and working on legacy code, increased it moderately in most groups. In the open-ended answers, the most common themes were mentorship, documentation, process, access, and environment setup, in that order. The size of the code base came up, but after all of those.

An Ju, Hitesh Sajnani, Scot Kelly, and Kim Herzig reached a similar picture from interviews with 32 developers and 15 managers at Microsoft, in "A Case Study of Onboarding in Software Teams: Tasks and Strategies" (ICSE 2021). Newcomers learned mostly from task documentation, team support, and meetings. In their follow-up survey, 90% of developers agreed that complete, current, well-organized documentation helps new members learn, and 98% agreed that a safe place to ask questions does. Of the 18 interviewees who had a mentor or onboarding buddy, 14 found the mentor helpful.

The most concrete improvement figure I found came from tooling, not code. Spotify reported that before it built Backstage, its internal developer portal, it took more than 60 days for a new engineer to merge their tenth pull request, and afterward it took 20. The explanation Spotify gave was discoverability. Engineers could find documentation, services, and each service's owner in one place instead of searching for them. That's a company's own account of its own product, not a controlled study, but it points the same way as the Microsoft research. A large share of onboarding time is spent looking for information that exists somewhere.

### Time to a First Change Doesn't Predict Ramp-Up

The Rastogi study also asked whether a fast first check-in meant a fast ramp-up, measured as the time until a new hire matched the median check-ins, lines changed, and files changed of existing developers. Across the eight product groups, the correlations were mostly negligible to weak, and where they weren't, they were negative. New hires who took longer to make their first check-in didn't take longer to ramp up afterward.

So a first-change date read from version control is a weak measure of anything, architecture included. It mixes laptop provisioning, permission requests, and the choice of starter task with whatever the code contributes, and it doesn't forecast the months that follow. Read as a single number, onboarding time doesn't measure architecture.

## Finding Where a Change Goes Is the Architectural Part

### A First Change Is a Search

Barthélémy Dagenais and colleagues interviewed 18 developers joining 18 projects at IBM, in "Moving into a New Software Project Landscape" (ICSE 2010). Without an understanding of the architecture, newcomers found it hard to tell where their tasks fitted in the product and whether their changes complied with the existing architecture. Teams tried to fix that with an architecture overview in the first days, and it didn't take. Newcomers came to understand the architecture only through exploration, meaning questions, technical meetings, and experiments. Their early tasks depended less on the big-picture architecture than on the low-level design and runtime behavior of specific components, which was usually the least documented part of the project. The structure a newcomer has to navigate is the layout of the code, not the boxes on the diagram.

Jonathan Sillito, Gail Murphy, and Kris De Volder recorded what that exploration looks like, in "Questions Programmers Ask During Software Evolution Tasks" (FSE 2006). In one of their two studies, nine developers new to the ArgoUML code base worked in pairs on change tasks taken from the project's history. Their first questions were about finding a starting point: which type represents this domain concept, where in the code this UI text or error message lives, and whether there's an existing example of what they need to do. From each starting point, they asked what it belonged to, what used it, and what it depended on, one hop at a time. When the search turned up too many candidates, some of them set breakpoints in each one and ran the feature to see which were even relevant. The participants were graduate students, most with some professional experience, working in timed sessions, so the study shows the shape of the search rather than how long it takes on the job.

That sequence is the architectural part of a first change. A structure where a domain concept has one obvious home, named the way the business names it, answers the first question with a search. A structure where the concept is spread across a controller, two services, a shared utilities project, and a stored procedure answers it with a week of breakpoints. Newcomers rely on the code itself for this. In a survey of about 100 practitioners by Christoph Treude, Marco Gerosa, and Igor Steinmacher, "Towards the First Code Contribution" (2024), source code was the highest-rated source of information for a newcomer's first contribution, above API documentation and tutorials.

### Unfamiliar Code Costs More When It's Tangled

Markus Borg, Adam Tornhill, and Enys Mones measured how much unfamiliarity with a file costs in different code, in "U Owns the Code That Changes and How Marginal Owners Resolve Issues Slower in Low-Quality Source Code" (EASE 2023). They mined 40 proprietary repositories and linked 7,307 Jira issues to the files each one touched. A marginal owner is a developer who owns less than a tenth of a file's code. In files that CodeScene's Code Health metric rated as low quality, marginal owners took 45% longer on small changes and 93% longer on large ones than in healthy files. Code Health is a file-level measure built from design smells like God classes, complex methods, and duplicated code, and a marginal owner isn't necessarily a new hire. The study still shows the mechanism. Knowing the code is what lets a developer get through tangled code, so the people who don't know it yet pay the most for it.

The Microsoft studies show the same effect at the boundary between teams. Rastogi's new hires reported that code with dependencies on other people's work slowed their first check-in. Ju's study found tasks that required cross-team collaboration challenging for newcomers, largely because of the waiting. One newcomer's feature stalled because the other teams wouldn't review the pull requests. A first change that has to cross a team boundary is measuring where the system's boundaries fall relative to the teams, and a newcomer, who has no relationships to spend yet, feels that cost at full price.

## Coupling Metrics Don't Measure Legibility

Coupling metrics count dependencies. Afferent and efferent coupling, Robert Martin's instability and main sequence, and Meilir Page-Jones's connascence describe how components depend on each other and how far a change will spread. They're the right tools for asking how much a change will cost once you know where to make it.

They don't record whether you can find where to make it. A module can sit on the main sequence and still be named after a framework pattern instead of the business concept it implements. Two services can have clean, narrow interfaces and still split one concept in a way nobody would guess. Those are properties of legibility, whether the structure shows where things belong, and the first question in Sillito's list tests exactly that. The Developer Experience framework of Abi Noda, Margaret-Anne Storey, Nicole Forsgren, and Michaela Greiler (ACM Queue, 2023) names cognitive load, the mental effort required to do the work, as one of three dimensions that drive productivity. For someone new, structure that hides where things belong is a direct source of that load, and nothing in a coupling report shows it.

No study I found compares newcomer friction with coupling metrics head to head, so I can't claim one tracks structural clarity better than the other. What the evidence supports is that they measure different things. Coupling metrics describe the dependency graph. A newcomer's search describes how well the names and boundaries lead to the right place in that graph.

## Sort a First Change's Time Before Reading It

A newcomer's first few changes are an architecture review nobody scheduled, but only if you separate the architectural time from everything else. The study findings above sort into a handful of places where the time goes, and each one points at something different:

| Where the time went | What it points at | Architecture? |
| --- | --- | --- |
| Laptop, accounts, permissions, local build | Platform and access provisioning | No |
| Finding documentation, owners, and who to ask | Discoverability and mentoring | No |
| Finding where the change belongs | Whether concepts have one obvious, well-named home | Yes: legibility |
| Learning what else the change touches | How far changes spread between components | Yes: coupling |
| Waiting on another team to review or change something | Whether component boundaries match team boundaries | Yes: ownership boundaries |
| Review cycles over "that's not how we do it here" | Whether the structure's rules are written down or only remembered | Partly: undocumented rules |

In the studies above, the first two rows account for most of the delay newcomers reported. Fix them first, because the fixes are cheap and well understood. The rows marked as architecture are the ones no documentation effort removes. Better docs about a concept spread across five projects still leave it spread across five projects.

Keep the measurement as a question, not a target. A team told to cut time to first merge can hand every newcomer a one-line configuration change, and the number will improve while telling you nothing. Neal Ford, Rebecca Parsons, and Patrick Kua's fitness functions, from *Building Evolutionary Architectures*, give an objective check for each architectural property a team decides to protect, and legibility can be one of them. The fitness function here is a person, and it only works while that person is still unfamiliar with the code.

## Checking Your Own Onboarding

For your last new hire, or the next one:

- Ask when they merged their first change that wasn't a typo or configuration fix, and what it was
- Ask them to split the time before it into the rows of the table above, from memory, while it's still recent
- For the architectural rows, have them name the concept they were looking for and every place they had to look before finding its home
- Note every file or service the change touched that they didn't expect to touch, and every team they had to wait on
- Pick the single place where they got stuck longest, and ask whether a rename, a move, or a boundary change would have taken them straight there

If most of their time landed in the first two rows, you have an onboarding problem and a cheap fix. If it landed in the architectural rows, your last new hire has shown you, by making a change, where the structure hides where things belong.
