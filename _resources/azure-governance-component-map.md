---
title: "Azure Governance Hierarchy Component Map"
layout: resource
type: reference
category: "Azure"
description: "What contains what in Azure, what each level actually is, and which governance controls inherit downward from where. Tags are the one that does not."
last_updated: 2026-09-03
tags: [governance, azure, rbac, policy, subscriptions, tagging, practical]
related_guides:
  - /study-guides/infrastructure/azure/azure-subscription-architecture.html
  - /study-guides/infrastructure/azure/azure-resource-organization.html
  - /study-guides/infrastructure/azure/azure-policy-governance.html
  - /study-guides/infrastructure/azure/azure-rbac-managed-identities.html
---

## Containment and Inheritance

<div style="overflow-x:auto; margin: 1.5rem 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620" role="img" aria-labelledby="gov-title gov-desc" style="width:100%; min-width:680px; height:auto; display:block;">
<title id="gov-title">Azure governance hierarchy and what inherits down it</title>
<desc id="gov-desc">Nested boxes from Entra ID tenant down to an individual resource, beside four rails showing that RBAC and Policy inherit from management group down, locks from subscription down, and tags do not inherit at all.</desc>
<style>
.gov-l { fill: none; stroke: var(--color-primary, #1A5F8A); stroke-width: 1.5; }
.gov-l-in { fill: var(--color-bg, #F7F9FC); stroke: var(--color-primary, #1A5F8A); stroke-width: 2.5; }
.gov-t { font-size: 14px; font-weight: 700; fill: var(--color-primary, #1A5F8A); }
.gov-s { font-size: 11.5px; fill: var(--color-text-light, #4A5568); }
.gov-hd { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; fill: var(--color-text-light, #4A5568); }
.gov-rail { fill: none; stroke: var(--color-primary, #1A5F8A); stroke-width: 2.5; }
.gov-rail-bad { fill: none; stroke: var(--color-accent, #A5486E); stroke-width: 2.5; stroke-dasharray: 7 5; }
.gov-rn { font-size: 13px; font-weight: 700; fill: var(--color-primary, #1A5F8A); }
.gov-rn-bad { font-size: 13px; font-weight: 700; fill: var(--color-accent, #A5486E); }
.gov-note { font-size: 11.5px; fill: var(--color-text, #2C3E50); }
.gov-bad { font-size: 11.5px; font-weight: 600; fill: var(--color-accent, #A5486E); }
.gov-x { font-size: 15px; font-weight: 700; fill: var(--color-accent, #A5486E); }
</style>
<defs>
<marker id="gov-a" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-primary, #1A5F8A)"/></marker>
<marker id="gov-a-bad" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-accent, #A5486E)"/></marker>
</defs>

<g font-family="'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">

<text class="gov-hd" x="16" y="40">EVERYTHING LIVES INSIDE THE THING ABOVE IT</text>

<rect class="gov-l" x="16" y="56" width="520" height="490" rx="8"/>
<text class="gov-t" x="30" y="80">Entra ID Tenant</text>
<text class="gov-s" x="30" y="98">identity and authentication boundary</text>

<rect class="gov-l" x="36" y="110" width="480" height="410" rx="8"/>
<text class="gov-t" x="50" y="134">Root Management Group</text>
<text class="gov-s" x="50" y="152">created automatically, one per tenant</text>

<rect class="gov-l" x="56" y="164" width="440" height="330" rx="8"/>
<text class="gov-t" x="70" y="188">Management Group</text>
<text class="gov-s" x="70" y="206">up to 6 levels below root</text>

<rect class="gov-l" x="76" y="218" width="400" height="250" rx="8"/>
<text class="gov-t" x="90" y="242">Subscription</text>
<text class="gov-s" x="90" y="260">billing + access + quota, all at once</text>

<rect class="gov-l" x="96" y="272" width="360" height="170" rx="8"/>
<text class="gov-t" x="110" y="296">Resource Group</text>
<text class="gov-s" x="110" y="314">delete it and everything inside goes</text>

<rect class="gov-l-in" x="116" y="326" width="320" height="90" rx="8"/>
<text class="gov-t" x="130" y="352">Resource</text>
<text class="gov-s" x="130" y="372">exactly one resource group</text>
<text class="gov-s" x="130" y="392">region is its own, not the group's</text>

<text class="gov-hd" x="570" y="40">WHAT FLOWS DOWN, AND FROM WHERE</text>

<text class="gov-rn" x="604" y="180" text-anchor="middle">RBAC</text>
<path class="gov-rail" d="M 604,192 V 420" marker-end="url(#gov-a)"/>
<text class="gov-rn" x="676" y="180" text-anchor="middle">Policy</text>
<path class="gov-rail" d="M 676,192 V 420" marker-end="url(#gov-a)"/>
<text class="gov-rn" x="748" y="244" text-anchor="middle">Locks</text>
<path class="gov-rail" d="M 748,256 V 420" marker-end="url(#gov-a)"/>
<text class="gov-rn-bad" x="828" y="298" text-anchor="middle">Tags</text>
<path class="gov-rail-bad" d="M 828,310 V 348"/>
<circle cx="828" cy="366" r="11" fill="var(--color-card-bg, #FFFFFF)"/>
<text class="gov-x" x="828" y="372" text-anchor="middle">✗</text>

<text class="gov-note" x="570" y="456">RBAC · additive, a lower scope never subtracts</text>
<text class="gov-note" x="570" y="478">Policy · Deny blocks the write before it happens</text>
<text class="gov-note" x="570" y="500">Locks · beat RBAC, even an Owner cannot delete</text>
<text class="gov-bad" x="570" y="522">Tags · do NOT inherit, Policy must copy them</text>

<text class="gov-bad" x="16" y="578">✗ moving a resource changes its ID, so RBAC assignments, alerts and automation that name it break</text>
<text class="gov-bad" x="16" y="600">✗ a lock has to come off before a move, and deny assignments cannot be authored by you at all</text>

</g>
</svg>
</div>
