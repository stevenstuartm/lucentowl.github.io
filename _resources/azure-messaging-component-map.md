---
title: "Azure Messaging Component Map"
layout: resource
type: reference
category: "Azure"
description: "The entities inside each Azure broker and how a message routes through them: topics fanning into independent subscriptions, partitions as append-only logs with per-group offsets, and event subscriptions filtering before the push."
last_updated: 2026-09-03
tags: [messaging, azure, event-driven, service-bus, event-hubs, event-grid, practical]
related_guides:
  - /study-guides/infrastructure/azure/azure-service-bus.html
  - /study-guides/infrastructure/azure/azure-event-hubs.html
  - /study-guides/infrastructure/azure/azure-event-grid.html
  - /study-guides/infrastructure/azure/azure-logic-apps.html
---

## The Entities Inside Each Broker

<div style="overflow-x:auto; margin: 1.5rem 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 920" role="img" aria-labelledby="msg-title msg-desc" style="width:100%; min-width:680px; height:auto; display:block;">
<title id="msg-title">The routing entities inside Azure Service Bus, Event Hubs and Event Grid</title>
<desc id="msg-desc">Three bands showing the internal components of each broker: a Service Bus topic fanning into filtered subscriptions each with its own dead-letter queue, Event Hubs partitions as append-only logs with independent consumer group offsets, and Event Grid event subscriptions filtering before pushing to handlers.</desc>
<style>
.msg-box { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-primary, #1A5F8A); stroke-width: 1.5; }
.msg-log { fill: var(--color-bg, #F7F9FC); stroke: var(--color-primary, #1A5F8A); stroke-width: 1.5; }
.msg-holder { fill: none; stroke: var(--color-secondary, #2D5A85); stroke-width: 1.5; stroke-dasharray: 7 5; }
.msg-t { font-size: 14px; font-weight: 700; fill: var(--color-primary, #1A5F8A); }
.msg-n { font-size: 12px; font-weight: 700; fill: var(--color-primary, #1A5F8A); }
.msg-s { font-size: 11.5px; fill: var(--color-text-light, #4A5568); }
.msg-hd { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; fill: var(--color-text-light, #4A5568); }
.msg-flow { fill: none; stroke: var(--color-primary, #1A5F8A); stroke-width: 2; }
.msg-off { fill: none; stroke: var(--color-purple, #6B3FA0); stroke-width: 2; stroke-dasharray: 4 4; }
.msg-note { font-size: 11.5px; fill: var(--color-text, #2C3E50); }
.msg-req { font-size: 11.5px; fill: var(--color-purple, #6B3FA0); }
.msg-bad { font-size: 11.5px; font-weight: 600; fill: var(--color-accent, #A5486E); }
</style>
<defs>
<marker id="msg-a" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-primary, #1A5F8A)"/></marker>
</defs>

<g font-family="'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">

<text class="msg-hd" x="16" y="80">SERVICE BUS · A TOPIC FANS OUT INTO INDEPENDENT SUBSCRIPTIONS</text>
<text class="msg-req" x="480" y="80">topics need Standard+</text>

<rect class="msg-box" x="16" y="150" width="104" height="44" rx="6"/>
<text class="msg-t" x="28" y="178">Producer</text>
<rect class="msg-holder" x="140" y="100" width="470" height="190" rx="8"/>
<text class="msg-hd" x="154" y="120">NAMESPACE</text>
<rect class="msg-box" x="168" y="152" width="110" height="44" rx="6"/>
<text class="msg-t" x="180" y="180">Topic</text>
<rect class="msg-box" x="320" y="138" width="170" height="48" rx="6"/>
<text class="msg-n" x="332" y="160">Subscription</text>
<text class="msg-s" x="332" y="178">filter: subject</text>
<rect class="msg-box" x="320" y="206" width="170" height="48" rx="6"/>
<text class="msg-n" x="332" y="228">Subscription</text>
<text class="msg-s" x="332" y="246">filter: event type</text>
<rect class="msg-box" x="510" y="206" width="88" height="48" rx="6"/>
<text class="msg-n" x="522" y="228">DLQ</text>
<text class="msg-s" x="522" y="246">per entity</text>
<rect class="msg-box" x="650" y="138" width="170" height="48" rx="6"/>
<text class="msg-n" x="662" y="160">Competing</text>
<text class="msg-s" x="662" y="178">one wins the lock</text>
<path class="msg-flow" d="M 120,172 H 162" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 278,166 L 314,162" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 278,182 L 314,228" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 490,162 H 644" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 490,230 H 504" marker-end="url(#msg-a)"/>

<text class="msg-hd" x="16" y="350">EVENT HUBS · PARTITIONS ARE LOGS, CONSUMER GROUPS HOLD OFFSETS</text>
<text class="msg-req" x="480" y="350">2+ consumer groups need Standard+</text>

<rect class="msg-box" x="16" y="440" width="104" height="44" rx="6"/>
<text class="msg-t" x="28" y="468">Producer</text>
<rect class="msg-holder" x="140" y="380" width="470" height="190" rx="8"/>
<text class="msg-hd" x="154" y="400">EVENT HUB</text>
<rect class="msg-log" x="168" y="412" width="414" height="34" rx="4"/>
<text class="msg-s" x="180" y="434">Partition 0 · ordered, append-only</text>
<rect class="msg-log" x="168" y="458" width="414" height="34" rx="4"/>
<text class="msg-s" x="180" y="480">Partition 1 · ordered, append-only</text>
<rect class="msg-log" x="168" y="504" width="414" height="34" rx="4"/>
<text class="msg-s" x="180" y="526">Partition 2 · ordered, append-only</text>
<path class="msg-off" d="M 400,406 V 544"/>
<path class="msg-off" d="M 500,406 V 544"/>
<text class="msg-req" x="400" y="560" text-anchor="middle">analytics</text>
<text class="msg-req" x="500" y="560" text-anchor="middle">alerts</text>
<rect class="msg-box" x="650" y="412" width="170" height="44" rx="6"/>
<text class="msg-n" x="662" y="432">group: analytics</text>
<text class="msg-s" x="662" y="450">behind, at its offset</text>
<rect class="msg-box" x="650" y="470" width="170" height="44" rx="6"/>
<text class="msg-n" x="662" y="490">group: alerts</text>
<text class="msg-s" x="662" y="508">same events, later</text>
<rect class="msg-box" x="650" y="528" width="170" height="36" rx="6"/>
<text class="msg-n" x="662" y="551">Capture to Storage</text>
<path class="msg-flow" d="M 120,462 H 162" marker-end="url(#msg-a)"/>
<text class="msg-s" x="16" y="510">partition key</text>
<path class="msg-flow" d="M 582,430 H 644" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 582,488 H 644" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 582,532 L 644,544" marker-end="url(#msg-a)"/>

<text class="msg-hd" x="16" y="630">EVENT GRID · SUBSCRIPTIONS FILTER, THEN IT PUSHES</text>
<text class="msg-req" x="480" y="630">pull delivery needs a Standard namespace</text>

<rect class="msg-box" x="16" y="700" width="104" height="48" rx="6"/>
<text class="msg-n" x="28" y="722">Event source</text>
<text class="msg-s" x="28" y="740">a resource</text>
<rect class="msg-box" x="150" y="700" width="130" height="48" rx="6"/>
<text class="msg-n" x="162" y="722">Topic</text>
<text class="msg-s" x="162" y="740">system or custom</text>
<rect class="msg-box" x="320" y="666" width="180" height="48" rx="6"/>
<text class="msg-n" x="332" y="688">Event subscription</text>
<text class="msg-s" x="332" y="706">filter: subject prefix</text>
<rect class="msg-box" x="320" y="736" width="180" height="48" rx="6"/>
<text class="msg-n" x="332" y="758">Event subscription</text>
<text class="msg-s" x="332" y="776">filter: event type</text>
<rect class="msg-box" x="540" y="666" width="180" height="48" rx="6"/>
<text class="msg-n" x="552" y="688">Functions</text>
<text class="msg-s" x="552" y="706">validation handled</text>
<rect class="msg-box" x="540" y="736" width="180" height="48" rx="6"/>
<text class="msg-n" x="552" y="758">Webhook</text>
<text class="msg-s" x="552" y="776">Logic Apps, Automation</text>
<rect class="msg-box" x="540" y="800" width="220" height="32" rx="6"/>
<text class="msg-n" x="552" y="821">dead-letter to Storage</text>
<path class="msg-flow" d="M 120,724 H 144" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 280,716 L 314,694" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 280,732 L 314,758" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 500,690 H 534" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 500,760 H 534" marker-end="url(#msg-a)"/>
<path class="msg-flow" d="M 500,778 L 534,812" marker-end="url(#msg-a)"/>

<text class="msg-note" x="16" y="866">Dead-lettering is a different mechanism in each: a sub-queue in Service Bus, a Storage container in Event Grid,</text>
<text class="msg-note" x="16" y="886">and nothing at all in Event Hubs, where retention alone drops an event.</text>
<text class="msg-bad" x="16" y="908">✗ a blob container is never an Event Grid handler, only its dead-letter destination</text>

</g>
</svg>
</div>
