---
layout: post
title: "The Path Is Useful, Not the Cert"
description: "For most software roles, IT certifications stopped deciding who gets hired long before AI arrived. AI removes the last reason an individual had to hold one while leaving the institutional reasons untouched, but the study path still builds the awareness and discipline that keep paying off."
tags: [certifications, careers, hiring, ai, professional-development]
author: steven-stuart
sources:
  - title: "Renew your Microsoft Certification (Microsoft Learn)"
    url: "https://learn.microsoft.com/en-us/credentials/certifications/renew-your-microsoft-certification"
  - title: "DoD 8140 Cyber Workforce Qualification Program (DoD Cyber Exchange)"
    url: "https://public.cyber.mil/wid/dod8140/"
  - title: "The Market for 'Lemons': Quality Uncertainty and the Market Mechanism (Akerlof, 1970)"
    url: "https://www.jstor.org/stable/1879431"
  - title: "Job Market Signaling (Spence, 1973)"
    url: "https://www.jstor.org/stable/1882010"
---

I was about to start on Azure and AWS certifications again when I stopped to ask who would actually care. The honest answer was almost no one. No company I have worked for has cared about my education or my certifications, and I can't think of a coworker, at any of those companies, who needed a cert or a degree to land their next job. The roles that did care were few and specific, usually high-risk or contract-bound.

So when people ask whether AI is making certifications worthless, I think they have the timeline backwards. For most software roles the decline started long before AI. What AI changes is narrower and more interesting. It removes the last reason an individual had to hold a cert, leaves the institutional reasons untouched, and makes the study path behind a cert more valuable than the credential at the end of it.

## A Cert Bundles the Path and the Credential

A certification is two things sold as one. The path is the curriculum, the labs, and the forced sweep across a product surface. The credential is the proof at the end that you walked it.

The credential in turn carries several signals at once. It says you knew a vendor's catalog at a point in time, which services exist, their limits, and which one fits which requirement. It implies some grasp of the underlying discipline, like the tradeoffs between reliability and cost or consistency and availability. It shows you picked a curriculum and finished it. And for some employers it satisfies a quota, since vendor partner programs require a minimum number of certified staff.

These signals decay at very different rates, and most arguments about certs treat them as one thing.

## The Credential Stopped Mattering Before AI

### Employers Who Can Judge Skill Stopped Asking

Wherever a hiring team can evaluate skill directly, it tends to prefer track record, referrals, and interviews over a certificate. A cert is a stand-in for judgment the employer can't or won't exercise itself. Teams that can exercise it don't need the stand-in, and for mainstream software engineering that has been true for a long time.

### Where Certs Still Hold

Certs keep their weight where the evaluator needs something defensible on paper rather than an accurate read on skill.

| What the cert protects | Who benefits | What the cert is in practice |
| --- | --- | --- |
| The certifier's revenue | The certifier | The product being sold |
| Regulatory and compliance integrity, such as DoD 8140 or auditor qualifications | The employer or regulator | Evidence of due diligence that moves liability off the employer |
| Consulting credibility, such as partner tiers and RFP requirements | The consulting firm | A checkbox procurement can point to |

In none of these rows is the beneficiary the practitioner or a team hiring for skill. The cert is a transaction between institutions, and the practitioner carries it. High-risk regulated roles still make good sense here, since a regulator can't interview every auditor. But those roles don't represent most certs sold or most of the revenue behind them.

## AI Removes the Last Individual Reason

### Recall Is What Models Do Best

Most cert exams test recall and pattern matching over a vendor's catalog. A typical question asks which service meets a requirement under a given constraint. That is exactly the kind of question a model answers well, and it's also the knowledge that goes stale fastest as vendors ship faster. A cert earned a year ago can miss a full generation of managed options, pricing models, and defaults.

Compare a person holding a year-old cert with a person who has the same disciplines and is skilled at using AI to work with current services. The cert holder isn't worse at the discipline. Their cert never measured the discipline well in the first place. It measured catalog recall and used that as a proxy, and AI made catalog recall close to free.

### Vendors Have Already Conceded Currency Over Recall

Microsoft now lets candidates consult Microsoft Learn during its exams, and its role-based certifications renew every year through a free, unproctored online assessment. Both moves say that knowing what's current matters more than memorizing it, and that looking something up is a legitimate part of the job. They also mean the vendor that profits from certifying you has stopped pretending recall is the point.

## Better Certs Cost More, and Someone Has to Pay

A cert that matched how work is actually done would test outcomes under realistic conditions, AI included. That kind of exam costs more to run. Labs need infrastructure for every candidate, scenarios go stale as fast as the products they test, and grading judgment is harder than grading multiple choice. A better exam also has a lower pass rate, and for a for-profit certifier the pass rate is a revenue lever. Certifiers defend their authority because their profit depends on it, which makes improvement a business decision before it's an educational one.

### Who Profits Decides Who Improves

| Certifier type | Where the profit comes from | Likely direction |
| --- | --- | --- |
| Vendor, such as AWS, Microsoft, or Google | Platform consumption. The cert funnels people into adoption | Flat or cheaper. Current practitioners sell cloud consumption, so vendors can subsidize currency |
| Independent and mandate-propped | The cert is the product, and regulation or contracts guarantee demand | More expensive without getting better, since demand doesn't depend on quality |
| Independent and signal-propped, such as hands-on lab exams | Reputation. People pay because passing is hard to fake | More expensive and better. The price buys a signal |

Mandates are the risk. Where a contract or regulation guarantees demand, price and quality come apart, and a cert can grow more expensive while its signal keeps weakening.

AI also cuts some of the cost of better exams. It can generate fresh scenario variants for every candidate, which also undercuts leaked question dumps, and it can score a lab transcript for far less than a human reviewer. Keeping content current is the one cost it doesn't remove. A certifier that holds prices high after grading gets cheaper is charging for its authority, not its costs.

### Proctoring Is Only Worth What It Protects

In-person proctoring is the obvious answer to AI-assisted cheating, but it defends integrity, not relevance. Wrapped around a recall exam, it guarantees that no model helped answer questions a model will answer for the candidate on their first day at work. It also brings back the costs that pushed exams toward remote proctoring in the first place. Candidates far from a test center travel farther or wait longer, shared centers still have a limited number of seats, and earpieces and smart glasses shift the arms race without ending it.

In-person proctoring earns its price when it stops trying to keep AI out and starts watching how the candidate uses it. A controlled room can supply a sanctioned AI tool, log every interaction, and grade both the outcome and whether the candidate caught a planted wrong answer. Remote proctoring can't reliably tell a sanctioned tool from a second device, and a physical room can. Cisco's CCIE lab already works close to this model, with a long in-person hands-on exam, few locations, and a steep fee, and it has kept its reputation because it measures delivery under controlled conditions.

## Entry Level Is Where the Signal Breaks First

### A Market for Lemons

People with no track record yet, like new graduates and career changers, are the one group for whom a cert still works as an individual signal, because there's nothing else to judge them by. They are also the people with the most reason to cheat. The cert decides whether they get an interview, they have no reputation to risk, and they are competing in the tightest part of the market. If I were in that position, I would be tempted too. That isn't a character flaw. It's the rational response to how the signal is built.

George Akerlof described what happens next in his 1970 paper on the market for lemons. When buyers can't tell good goods from bad, they discount everything to the average. If employers can't tell an honestly earned cert from a cheated one, they discount every cert, which removes the reason to earn one honestly, which lowers the average again. The loop runs until holding the cert means about the same as not holding it. Everyone ends up at the same starting line with the same certs, having learned nothing.

Michael Spence's work on job market signaling explains which signals survive this. A signal holds only when it costs more to fake than faking pays. Observed labs, in-person proctoring, and live defense of a decision all clear that bar, and they are the most expensive formats, which puts them furthest out of reach for the candidates who need a trustworthy signal most.

### The Only Unfakeable Signal Is the Job Itself

Apprenticeships, internships, contract-to-hire, and real probation periods all let an employer watch someone do the work, and nobody can fake that. They also put the cost of verifying skill on the employer instead of on the candidate or a certifier. Certs were a way to hand that cost off. As AI makes the hand-off unreliable, the cost comes back to employers whether they accept it or not, and the market pushes candidates toward faking it until they make it in the meantime. The alternative is employers getting more hands-on in interviews and measuring the skills that matter instead of recall.

## The Path Still Compounds

### Awareness You Can't Ask For

AI answers the questions you ask. Studying for a broad cert shows you which questions exist. A practitioner who is fluent with AI but never swept a product surface end to end has blind spots they can't see, and a model won't point them out unprompted. You can't evaluate output you have no way to recognize as wrong. That overall awareness is the part of a cert that survives AI, and it lives in the path, not the credential.

### Discipline Outlasts the Catalog

Before AI, one round of study built two kinds of knowledge at once. Catalog knowledge compounded because products moved slowly, so what you learned stayed true for years. Discipline knowledge compounded too: why a service exists, what tradeoff it makes, and how it fails. Now the catalog churns and a model can recall it on demand, so only the discipline keeps compounding. Every new service is a variation on tradeoffs you already understand, so you place it faster, evaluate it faster, and notice sooner when the model gets it wrong.

That argues for studying a cert curriculum for the reasons behind the answers rather than the answers themselves, which is also exactly what the exam never checked.

## Choose the Path and the Credential Separately

The credential and the learning used to come as a pair. They don't anymore, so each deserves its own decision:

- Take the curriculum when you want awareness of a whole product surface. Study guides, skill-builder labs, and practice exams are cheap or free
- Pay for the exam only when an institution on the other side requires it, like a regulator, a contract, or a partner program
- Study for the tradeoffs behind each answer, since that's the knowledge that keeps compounding
- If you hire, read a cert's age like a version number, and spend the screening time you save on watching a candidate reason through a decision with their tools in hand
