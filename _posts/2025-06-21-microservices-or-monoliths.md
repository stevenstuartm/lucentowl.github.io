---
layout: post
title: "Monoliths for Discovery, Microservices for Optimization"
date: 2025-06-21
tags: [architecture, microservices, monoliths, system-design]
description: "Why monoliths are effective for discovery and microservices are optimizations: principles for choosing the right architecture for your context."
author: steven-stuart
---

I know, I know. It is another post about microservices versus monoliths. The debate feels exhausted at this point. Yet every time I start a new project, I find myself weighing the same questions. Not because the answer is unclear, but because the answer genuinely depends on where you are and what you're trying to learn.

<blockquote class="pull-quote">
<p>The choice isn't about finding the "right" architecture in the abstract. It's about choosing what fits your context, your constraints, and most importantly, what you need to discover.</p>
</blockquote>

## Core Principles

**1. Microservices Are Optimizations, Monoliths Enable Discovery**

Microservices are optimizations for specific problems: team scaling, independent deployment, technology diversity. They're solutions to constraints you've already identified. Monoliths, on the other hand, accelerate discovery. They let you learn where boundaries should be, understand domains as they reveal themselves, and validate assumptions quickly without the overhead of distributed systems.

Start with what helps you learn fastest, then optimize when you understand what actually needs optimizing.

**2. Monoliths Don't Excuse Poor Code Quality**

The stigma around monoliths comes from poor practices, not the architecture itself. Terrible monoliths exist, but so do terrible microservices. The difference isn't the deployment model; it's whether you maintain good design discipline with SOLID principles and clear boundaries.

**3. Speed to Market vs. Perfect Architecture**

Ship and learn. Teams often block product development for months while debating the "perfect" architecture. The better approach: make reversible decisions, establish clear boundaries, and iterate based on what you learn from real usage. Perfection is a moving target; momentum matters more.

**4. Data Boundaries Matter From Day One**

Define data ownership early, even if you're starting with a monolith. Sharing databases between services isn't inherently wrong when you're just getting started, but you need clean boundaries that make future separation possible. Tangled data models trap teams in legacy architectures.

**5. Abstract Infrastructure Early**

Introducing API gateways and service abstractions early, even when everything's running as a monolith behind the scenes, gives you flexibility before you know what your final infrastructure will look like. It's a small upfront investment that buys you significant optionality down the road.

## My Approach

Start with **domain-based services**: modular monoliths organized along natural business boundaries (bounded contexts in DDD terms). This gives you:
- Clear separation of concerns from the beginning
- Team autonomy within their respective domains
- An easy migration path to microservices when the time comes
- Faster initial development than building distributed systems from day one

<blockquote class="pull-quote">
<p>Split into microservices when there's actual evidence it's needed: independent scaling requirements, team coordination becoming a bottleneck, or specific technology needs that justify the operational complexity.</p>
</blockquote>
