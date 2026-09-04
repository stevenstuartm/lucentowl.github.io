---
title: "Azure Observability Component Map"
layout: resource
type: reference
category: "Azure"
description: "How Azure telemetry actually flows: four kinds of source each needing a different collector, all converging on one workspace, with metrics running on a separate pipeline that never touches it."
last_updated: 2026-09-03
tags: [observability, azure, monitoring, logging, alerting, sentinel, practical]
related_guides:
  - /study-guides/infrastructure/azure/azure-monitor.html
  - /study-guides/infrastructure/azure/azure-monitor-diagnostic-settings.html
  - /study-guides/infrastructure/azure/azure-application-insights.html
  - /study-guides/infrastructure/azure/azure-defender-sentinel.html
---

## The Telemetry Pipeline

<div style="overflow-x:auto; margin: 1.5rem 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700" role="img" aria-labelledby="obs-title obs-desc" style="width:100%; min-width:680px; height:auto; display:block;">
<title id="obs-title">Azure observability telemetry pipeline</title>
<desc id="obs-desc">Four kinds of telemetry source, each requiring a different collection mechanism, converging on a single Log Analytics workspace, with platform metrics drawn as a separate pipeline that bypasses the workspace entirely.</desc>
<style>
.obs-box { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-primary, #1A5F8A); stroke-width: 1.5; }
.obs-box-hub { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-primary, #1A5F8A); stroke-width: 3; }
.obs-box-alt { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-purple, #6B3FA0); stroke-width: 1.5; }
.obs-box-met { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-green, #3C8D53); stroke-width: 1.5; }
.obs-box-ctl { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-text-light, #4A5568); stroke-width: 1.5; stroke-dasharray: 5 4; }
.obs-band { fill: var(--color-bg, #F7F9FC); stroke: var(--color-green, #3C8D53); stroke-width: 1; stroke-dasharray: 6 4; }
.obs-t { font-size: 14px; font-weight: 700; fill: var(--color-primary, #1A5F8A); }
.obs-t-met { font-size: 14px; font-weight: 700; fill: var(--color-green, #3C8D53); }
.obs-t-alt { font-size: 14px; font-weight: 700; fill: var(--color-purple, #6B3FA0); }
.obs-t-ctl { font-size: 14px; font-weight: 700; fill: var(--color-text-light, #4A5568); }
.obs-s { font-size: 11.5px; fill: var(--color-text-light, #4A5568); }
.obs-hd { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; fill: var(--color-text-light, #4A5568); }
.obs-hd-met { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; fill: var(--color-green, #3C8D53); }
.obs-flow { fill: none; stroke: var(--color-primary, #1A5F8A); stroke-width: 2; }
.obs-req { fill: none; stroke: var(--color-purple, #6B3FA0); stroke-width: 2; stroke-dasharray: 8 5; }
.obs-met { fill: none; stroke: var(--color-green, #3C8D53); stroke-width: 2; }
.obs-lbl { font-size: 11.5px; fill: var(--color-text, #2C3E50); }
.obs-bad { font-size: 11.5px; font-weight: 600; fill: var(--color-accent, #A5486E); }
</style>
<defs>
<marker id="obs-a" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-primary, #1A5F8A)"/></marker>
<marker id="obs-a-req" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-purple, #6B3FA0)"/></marker>
<marker id="obs-a-met" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-green, #3C8D53)"/></marker>
</defs>

<g font-family="'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">

<text class="obs-hd" x="16" y="42">SOURCES</text>
<text class="obs-hd" x="224" y="42">EACH NEEDS ITS OWN COLLECTOR</text>
<text class="obs-hd" x="470" y="42">WHERE IT LANDS</text>
<text class="obs-hd" x="706" y="42">WHAT READS IT</text>

<rect class="obs-box" x="16" y="70" width="170" height="68" rx="6"/>
<text class="obs-t" x="30" y="94">Azure resources</text>
<text class="obs-s" x="30" y="114">PaaS, network, vaults</text>
<rect class="obs-box" x="16" y="158" width="170" height="68" rx="6"/>
<text class="obs-t" x="30" y="182">VMs, guest OS</text>
<text class="obs-s" x="30" y="202">inside the machine</text>
<rect class="obs-box" x="16" y="246" width="170" height="68" rx="6"/>
<text class="obs-t" x="30" y="270">Application code</text>
<text class="obs-s" x="30" y="290">requests, traces</text>
<rect class="obs-box" x="16" y="334" width="170" height="68" rx="6"/>
<text class="obs-t" x="30" y="358">Subscription</text>
<text class="obs-s" x="30" y="378">control plane events</text>

<rect class="obs-box" x="224" y="70" width="196" height="68" rx="6"/>
<text class="obs-t" x="238" y="94">Diagnostic Settings</text>
<text class="obs-s" x="238" y="112">one per resource</text>
<text class="obs-bad" x="238" y="130">✗ forget one, blind spot</text>
<rect class="obs-box" x="224" y="158" width="196" height="68" rx="6"/>
<text class="obs-t" x="238" y="182">Monitor Agent</text>
<text class="obs-s" x="238" y="200">no DCR means no data</text>
<rect class="obs-box" x="224" y="246" width="196" height="68" rx="6"/>
<text class="obs-t" x="238" y="270">Application Insights</text>
<text class="obs-s" x="238" y="288">sampling on by default</text>
<text class="obs-bad" x="238" y="306">✗ counts read low</text>
<rect class="obs-box" x="224" y="334" width="196" height="68" rx="6"/>
<text class="obs-t" x="238" y="358">Activity Log</text>
<text class="obs-s" x="238" y="378">on by default, 90 days</text>

<rect class="obs-box-ctl" x="470" y="70" width="196" height="58" rx="6"/>
<text class="obs-t-ctl" x="484" y="94">Storage account</text>
<text class="obs-s" x="484" y="114">archive, indefinite</text>
<rect class="obs-box-ctl" x="470" y="146" width="196" height="58" rx="6"/>
<text class="obs-t-ctl" x="484" y="170">Event Hub</text>
<text class="obs-s" x="484" y="190">a buffer, not storage</text>
<rect class="obs-box-hub" x="470" y="240" width="196" height="150" rx="6"/>
<text class="obs-t" x="484" y="276">Log Analytics</text>
<text class="obs-t" x="484" y="296">workspace</text>
<text class="obs-s" x="484" y="326">queried with KQL</text>
<text class="obs-s" x="484" y="346">30d default</text>
<text class="obs-s" x="484" y="366">2y max retention</text>

<rect class="obs-box-alt" x="706" y="230" width="178" height="62" rx="6"/>
<text class="obs-t-alt" x="720" y="254">Sentinel</text>
<text class="obs-s" x="720" y="274">runs on the workspace</text>
<rect class="obs-box" x="706" y="310" width="178" height="62" rx="6"/>
<text class="obs-t" x="720" y="334">Alert rules</text>
<text class="obs-s" x="720" y="354">log and activity</text>
<rect class="obs-box" x="706" y="410" width="178" height="62" rx="6"/>
<text class="obs-t" x="720" y="434">Action Groups</text>
<text class="obs-s" x="720" y="454">email, webhook, runbook</text>

<path class="obs-flow" d="M 186,104 H 218" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 186,192 H 218" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 186,280 H 218" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 186,368 H 218" marker-end="url(#obs-a)"/>

<path class="obs-flow" d="M 420,88 L 464,96" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 420,104 L 464,172" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 420,120 L 464,272" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 420,192 L 464,300" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 420,280 L 464,328" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 420,368 L 464,356" marker-end="url(#obs-a)"/>

<path class="obs-req" d="M 700,262 L 672,290" marker-end="url(#obs-a-req)"/>
<path class="obs-flow" d="M 666,336 H 700" marker-end="url(#obs-a)"/>
<path class="obs-flow" d="M 795,372 V 404" marker-end="url(#obs-a)"/>

<rect class="obs-band" x="16" y="500" width="868" height="146" rx="8"/>
<text class="obs-hd-met" x="32" y="528">A SEPARATE PIPELINE · METRICS NEVER ENTER THE WORKSPACE</text>
<rect class="obs-box-met" x="32" y="546" width="170" height="62" rx="6"/>
<text class="obs-t-met" x="46" y="570">Every resource</text>
<text class="obs-s" x="46" y="590">emits metrics free</text>
<rect class="obs-box-met" x="470" y="546" width="196" height="62" rx="6"/>
<text class="obs-t-met" x="484" y="570">Platform metrics</text>
<text class="obs-s" x="484" y="590">93 days, no ingestion cost</text>
<rect class="obs-box-met" x="706" y="546" width="178" height="62" rx="6"/>
<text class="obs-t-met" x="720" y="570">Metric alerts</text>
<text class="obs-s" x="720" y="590">near real time</text>
<path class="obs-met" d="M 202,577 H 464" marker-end="url(#obs-a-met)"/>
<text class="obs-lbl" x="333" y="568" text-anchor="middle">no setting, no agent, no cost</text>
<path class="obs-met" d="M 666,577 H 700" marker-end="url(#obs-a-met)"/>
<path class="obs-met" d="M 795,546 V 478" marker-end="url(#obs-a-met)"/>
<text class="obs-lbl" x="786" y="516" text-anchor="end">both tracks end here</text>

<g transform="translate(16, 672)">
<line class="obs-flow" x1="0" y1="0" x2="40" y2="0" marker-end="url(#obs-a)"/>
<text class="obs-s" x="48" y="4">telemetry flow</text>
<line class="obs-req" x1="160" y1="0" x2="200" y2="0" marker-end="url(#obs-a-req)"/>
<text class="obs-s" x="208" y="4">requires</text>
<line class="obs-met" x1="290" y1="0" x2="330" y2="0" marker-end="url(#obs-a-met)"/>
<text class="obs-s" x="338" y="4">metrics, a separate pipeline</text>
<text class="obs-bad" x="530" y="4">✗ silent gap</text>
</g>

</g>
</svg>
</div>
