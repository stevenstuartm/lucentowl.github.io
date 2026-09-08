---
title: "Azure Networking Component Map"
layout: resource
type: reference
category: "Azure"
description: "Diagrams of how Azure networking components wire together: what can front what, what fails silently without its dependency, and which paths bypass the protection you think you have."
last_updated: 2026-09-08
tags: [networking, azure, vnet, private-link, load-balancing, dns, hybrid-connectivity]
related_guides:
  - /study-guides/infrastructure/azure/azure-vnet-architecture.html
  - /study-guides/infrastructure/azure/azure-dns-traffic-manager.html
  - /study-guides/infrastructure/azure/azure-front-door-cdn.html
  - /study-guides/infrastructure/azure/azure-load-balancer-app-gateway.html
  - /study-guides/infrastructure/azure/azure-api-management.html
  - /study-guides/infrastructure/azure/azure-expressroute-vpn.html
  - /study-guides/infrastructure/azure/azure-private-link-virtual-wan.html
  - /study-guides/infrastructure/azure/azure-firewall-ddos.html
---

## The Data Path

<div style="overflow-x:auto; margin: 1.5rem 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 940" role="img" aria-labelledby="anm-title anm-desc" style="width:100%; min-width:680px; height:auto; display:block;">
<title id="anm-title">Azure networking data path component map</title>
<desc id="anm-desc">A layered diagram showing which Azure networking components can front which others, how the regional entry points chain, which dependencies fail silently, and which paths bypass edge protection.</desc>
<style>
.anm-band { fill: var(--color-bg, #F7F9FC); stroke: var(--color-border, #DDE3EB); stroke-width: 1; }
.anm-vnet { fill: none; stroke: var(--color-secondary, #2D5A85); stroke-width: 1.5; stroke-dasharray: 7 5; }
.anm-box { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-primary, #1A5F8A); stroke-width: 1.5; }
.anm-box-alt { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-purple, #6B3FA0); stroke-width: 1.5; }
.anm-box-ctl { fill: var(--color-card-bg, #FFFFFF); stroke: var(--color-text-light, #4A5568); stroke-width: 1.5; stroke-dasharray: 5 4; }
.anm-t { font-size: 14px; font-weight: 700; fill: var(--color-primary, #1A5F8A); }
.anm-t-alt { font-size: 14px; font-weight: 700; fill: var(--color-purple, #6B3FA0); }
.anm-t-ctl { font-size: 14px; font-weight: 700; fill: var(--color-text-light, #4A5568); }
.anm-s { font-size: 11.5px; fill: var(--color-text-light, #4A5568); }
.anm-band-label { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; fill: var(--color-text-light, #4A5568); }
.anm-flow { fill: none; stroke: var(--color-primary, #1A5F8A); stroke-width: 2; }
.anm-dns { fill: none; stroke: var(--color-text-light, #4A5568); stroke-width: 1.5; stroke-dasharray: 2 4; }
.anm-req { fill: none; stroke: var(--color-purple, #6B3FA0); stroke-width: 2; stroke-dasharray: 8 5; }
.anm-bad { fill: none; stroke: var(--color-accent, #A5486E); stroke-width: 2; stroke-dasharray: 8 5; }
.anm-bad-solid { fill: none; stroke: var(--color-accent, #A5486E); stroke-width: 2; }
.anm-lbl { font-size: 11.5px; fill: var(--color-text, #2C3E50); }
.anm-lbl-req { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; fill: var(--color-purple, #6B3FA0); }
.anm-lbl-bad { font-size: 11.5px; font-weight: 600; fill: var(--color-accent, #A5486E); }
.anm-x { font-size: 15px; font-weight: 700; fill: var(--color-accent, #A5486E); }
</style>
<defs>
<marker id="anm-a" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-primary, #1A5F8A)"/></marker>
<marker id="anm-a-dns" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-text-light, #4A5568)"/></marker>
<marker id="anm-a-req" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-purple, #6B3FA0)"/></marker>
<marker id="anm-a-bad" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-accent, #A5486E)"/></marker>
</defs>

<g font-family="'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">

<rect class="anm-box" x="390" y="12" width="120" height="40" rx="6"/>
<text class="anm-t" x="450" y="37" text-anchor="middle">CLIENT</text>

<rect class="anm-band" x="36" y="92" width="848" height="132" rx="8"/>
<text class="anm-band-label" x="52" y="112">GLOBAL · NO VNET, NO REGION</text>
<rect class="anm-box-ctl" x="70" y="130" width="220" height="76" rx="6"/>
<text class="anm-t-ctl" x="86" y="156">Traffic Manager</text>
<text class="anm-s" x="86" y="176">answers DNS, then steps aside</text>
<text class="anm-s" x="86" y="194">any protocol · never in the path</text>
<rect class="anm-box" x="330" y="130" width="240" height="76" rx="6"/>
<text class="anm-t" x="346" y="156">Front Door</text>
<text class="anm-s" x="346" y="176">terminates · caches · WAF</text>
<text class="anm-s" x="346" y="194">HTTP/HTTPS only</text>
<text class="anm-lbl-bad" x="330" y="245">✗ cannot nest behind another Front Door, or chain with Azure CDN</text>

<rect class="anm-vnet" x="36" y="292" width="848" height="486" rx="10"/>
<text class="anm-band-label" x="52" y="308">VNET · REGIONAL</text>

<rect class="anm-band" x="52" y="328" width="816" height="148" rx="8"/>
<text class="anm-band-label" x="68" y="348">ENTRY POINTS</text>
<rect class="anm-box" x="90" y="360" width="200" height="94" rx="6"/>
<text class="anm-t" x="106" y="386">App Gateway</text>
<text class="anm-s" x="106" y="406">L7 routing · WAF</text>
<text class="anm-s" x="106" y="424">public or private frontend</text>
<text class="anm-s" x="106" y="442">regional · HTTP/1.1 out</text>
<rect class="anm-box" x="350" y="360" width="200" height="94" rx="6"/>
<text class="anm-t" x="366" y="386">API Management</text>
<text class="anm-s" x="366" y="406">policies · versioning</text>
<text class="anm-s" x="366" y="424">external or internal mode</text>
<text class="anm-s" x="366" y="442">internal needs fronting</text>
<rect class="anm-box" x="610" y="360" width="200" height="94" rx="6"/>
<text class="anm-t" x="626" y="386">Load Balancer</text>
<text class="anm-s" x="626" y="406">TCP / UDP · pass-through</text>
<text class="anm-s" x="626" y="424">public or internal frontend</text>
<text class="anm-s" x="626" y="442">NICs in ONE VNet</text>

<rect class="anm-box" x="150" y="512" width="600" height="44" rx="6"/>
<text class="anm-t" x="450" y="539" text-anchor="middle">WORKLOADS · VMs · VMSS · App Service · AKS</text>

<rect class="anm-band" x="52" y="594" width="816" height="132" rx="8"/>
<text class="anm-band-label" x="68" y="614">WHAT THEY REACH</text>
<rect class="anm-box" x="90" y="626" width="210" height="76" rx="6"/>
<text class="anm-t" x="106" y="652">Private Endpoint</text>
<text class="anm-s" x="106" y="672">NIC in your subnet</text>
<text class="anm-s" x="106" y="690">1:1 to ONE resource</text>
<rect class="anm-box" x="350" y="626" width="200" height="76" rx="6"/>
<text class="anm-t" x="366" y="652">NAT Gateway</text>
<text class="anm-s" x="366" y="672">64,512 SNAT ports per IP</text>
<text class="anm-s" x="366" y="690">outbound only · not inbound</text>
<rect class="anm-box" x="610" y="626" width="210" height="76" rx="6"/>
<text class="anm-t" x="626" y="652">VPN / ExpressRoute</text>
<text class="anm-s" x="626" y="672">to on-premises, and back</text>
<text class="anm-s" x="626" y="690">ER and VPN sites ✗ transit</text>

<rect class="anm-box-alt" x="90" y="802" width="240" height="60" rx="6"/>
<text class="anm-t-alt" x="106" y="826">Private DNS Zone</text>
<text class="anm-s" x="106" y="846">exact name · linked to every VNet</text>
<rect class="anm-box-alt" x="610" y="802" width="240" height="60" rx="6"/>
<text class="anm-t-alt" x="626" y="826">GatewaySubnet</text>
<text class="anm-s" x="626" y="846">/27+ · no NSG · no 0.0.0.0/0 UDR</text>

<path class="anm-flow" d="M 450,52 V 124" marker-end="url(#anm-a)"/>
<text class="anm-lbl" x="462" y="80">connection</text>
<path class="anm-dns" d="M 396,50 L 268,126" marker-end="url(#anm-a-dns)"/>
<text class="anm-lbl" x="368" y="78" text-anchor="end">DNS query</text>
<path class="anm-dns" d="M 292,186 H 324" marker-end="url(#anm-a-dns)"/>
<text class="anm-lbl" x="309" y="219" text-anchor="middle">can also name Front Door</text>
<path class="anm-dns" d="M 180,206 V 310" marker-end="url(#anm-a-dns)"/>
<text class="anm-lbl" x="192" y="272">names any public endpoint</text>
<path class="anm-flow" d="M 390,32 H 18 V 318 H 190"/>
<text class="anm-lbl" x="204" y="24" text-anchor="middle">traffic connects direct, Traffic Manager never sees a packet</text>
<path class="anm-flow" d="M 450,206 V 318"/>
<text class="anm-lbl" x="462" y="265">origin · any of these, or the workload itself</text>
<text class="anm-lbl" x="462" y="282">must be publicly reachable · Private Link origins on Premium</text>
<path class="anm-flow" d="M 190,318 H 710"/>
<path class="anm-flow" d="M 190,318 V 354" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 450,318 V 354" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 710,318 V 354" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 290,406 H 344" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 550,406 H 604" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 190,454 V 506" marker-end="url(#anm-a)"/>
<text class="anm-lbl" x="202" y="492">no end-to-end gRPC</text>
<path class="anm-flow" d="M 450,454 V 506" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 710,454 V 506" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 770,626 V 460" marker-end="url(#anm-a)"/>
<text class="anm-lbl" transform="translate(800,580) rotate(-90)">on-prem inbound</text>
<path class="anm-flow" d="M 250,556 V 580 H 195 V 620" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 450,556 V 620" marker-end="url(#anm-a)"/>
<path class="anm-flow" d="M 650,556 V 580 H 715 V 620" marker-end="url(#anm-a)"/>
<path class="anm-req" d="M 195,702 V 796" marker-end="url(#anm-a-req)"/>
<text class="anm-lbl-req" x="205" y="760">REQUIRES</text>
<path class="anm-req" d="M 715,702 V 796" marker-end="url(#anm-a-req)"/>
<text class="anm-lbl-req" x="725" y="760">REQUIRES</text>
<path class="anm-bad" d="M 510,32 H 890 V 318 H 722" marker-end="url(#anm-a-bad)"/>
<text class="anm-lbl-bad" x="876" y="140" text-anchor="end">a direct hit on any origin</text>
<text class="anm-lbl-bad" x="876" y="157" text-anchor="end">skips the edge WAF entirely</text>
<text class="anm-lbl-bad" x="876" y="174" text-anchor="end">lock origins with X-Azure-FDID</text>

<g transform="translate(52, 888)">
<line class="anm-flow" x1="0" y1="0" x2="40" y2="0" marker-end="url(#anm-a)"/>
<text class="anm-s" x="48" y="4">data path</text>
<line class="anm-dns" x1="150" y1="0" x2="190" y2="0" marker-end="url(#anm-a-dns)"/>
<text class="anm-s" x="198" y="4">DNS only, not in the path</text>
<line class="anm-req" x1="380" y1="0" x2="420" y2="0" marker-end="url(#anm-a-req)"/>
<text class="anm-s" x="428" y="4">requires, fails silently without</text>
<line class="anm-bad" x1="640" y1="0" x2="680" y2="0" marker-end="url(#anm-a-bad)"/>
<text class="anm-s" x="688" y="4">bypass / conflict</text>
</g>

</g>
</svg>
</div>

## Filter Layers

<div style="overflow-x:auto; margin: 1.5rem 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 356" role="img" aria-labelledby="anm2-title anm2-desc" style="width:100%; min-width:680px; height:auto; display:block;">
<title id="anm2-title">Where each Azure network filter sits and what it can see</title>
<desc id="anm2-desc">Four filtering layers on the inbound path, each labelled with what it is able to inspect.</desc>
<g font-family="'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
<line x1="120" y1="24" x2="120" y2="300" stroke="var(--color-primary, #1A5F8A)" stroke-width="2"/>
<text class="anm-band-label" x="120" y="16" text-anchor="middle">INBOUND</text>

<circle cx="120" cy="60" r="6" fill="var(--color-primary, #1A5F8A)"/>
<line x1="126" y1="60" x2="196" y2="60" stroke="var(--color-primary, #1A5F8A)" stroke-width="1.5"/>
<rect class="anm-box" x="200" y="34" width="660" height="52" rx="6"/>
<text class="anm-t" x="216" y="56">WAF</text>
<text class="anm-s" x="216" y="74">on Front Door (edge) or App Gateway (regional) · sees HTTP URI, headers, body: SQLi, XSS</text>

<circle cx="120" cy="132" r="6" fill="var(--color-primary, #1A5F8A)"/>
<line x1="126" y1="132" x2="196" y2="132" stroke="var(--color-primary, #1A5F8A)" stroke-width="1.5"/>
<rect class="anm-box" x="200" y="106" width="660" height="52" rx="6"/>
<text class="anm-t" x="216" y="128">Azure Firewall</text>
<text class="anm-s" x="216" y="146">hub perimeter · sees 5-tuple + FQDN + threat intel · TLS decrypt and IDPS on Premium</text>

<circle cx="120" cy="204" r="6" fill="var(--color-primary, #1A5F8A)"/>
<line x1="126" y1="204" x2="196" y2="204" stroke="var(--color-primary, #1A5F8A)" stroke-width="1.5"/>
<rect class="anm-box" x="200" y="178" width="660" height="52" rx="6"/>
<text class="anm-t" x="216" y="200">NSG at the subnet</text>
<text class="anm-s" x="216" y="218">sees 5-tuple only: IP, port, protocol · free · ASGs name groups of NICs for readable rules</text>

<circle cx="120" cy="276" r="6" fill="var(--color-primary, #1A5F8A)"/>
<line x1="126" y1="276" x2="196" y2="276" stroke="var(--color-primary, #1A5F8A)" stroke-width="1.5"/>
<rect class="anm-box" x="200" y="250" width="660" height="52" rx="6"/>
<text class="anm-t" x="216" y="272">NSG at the NIC</text>
<text class="anm-s" x="216" y="290">both subnet and NIC must allow · order decides only which one logs the deny</text>

<text class="anm-s" x="120" y="332">Azure Firewall rule order: NAT, then Network, then Application, then threat intel · first match wins · default deny</text>
</g>
</svg>
</div>

## Conflicts

<div style="overflow-x:auto; margin: 1.5rem 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 240" role="img" aria-labelledby="anm3-title anm3-desc" style="width:100%; min-width:680px; height:auto; display:block;">
<title id="anm3-title">Three Azure networking conflicts</title>
<desc id="anm3-desc">Non-transitive VNet peering, service endpoint routes overriding user defined routes, and two private endpoints registered in one DNS zone.</desc>
<defs>
<marker id="anm3-a-bad" markerWidth="9" markerHeight="9" refX="8" refY="3.2" orient="auto"><path d="M0,0 L8,3.2 L0,6.4 z" fill="var(--color-accent, #A5486E)"/></marker>
</defs>
<g font-family="'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
<line x1="310" y1="20" x2="310" y2="220" stroke="var(--color-border, #DDE3EB)" stroke-width="1"/>
<line x1="610" y1="20" x2="610" y2="220" stroke="var(--color-border, #DDE3EB)" stroke-width="1"/>

<text class="anm-band-label" x="20" y="26">PEERING IS NON-TRANSITIVE</text>
<text class="anm-lbl" x="159" y="62" text-anchor="middle">A–B peered · B–C peered</text>
<rect class="anm-box" x="30" y="70" width="66" height="38" rx="6"/>
<text class="anm-t" x="63" y="94" text-anchor="middle">A</text>
<rect class="anm-box" x="126" y="70" width="66" height="38" rx="6"/>
<text class="anm-t" x="159" y="94" text-anchor="middle">B</text>
<rect class="anm-box" x="222" y="70" width="66" height="38" rx="6"/>
<text class="anm-t" x="255" y="94" text-anchor="middle">C</text>
<line class="anm-flow" x1="96" y1="89" x2="126" y2="89"/>
<line class="anm-flow" x1="192" y1="89" x2="222" y2="89"/>
<path class="anm-bad" d="M 63,110 Q 159,192 255,110"/>
<circle cx="159" cy="150" r="11" fill="var(--color-card-bg, #FFFFFF)"/>
<text class="anm-x" x="159" y="156" text-anchor="middle">✗</text>
<text class="anm-lbl-bad" x="159" y="212" text-anchor="middle">A cannot reach C</text>

<text class="anm-band-label" x="322" y="26">SERVICE ENDPOINT BEATS UDR</text>
<text class="anm-lbl-bad" x="459" y="58" text-anchor="middle">service endpoint route wins</text>
<rect class="anm-box" x="330" y="70" width="88" height="38" rx="6"/>
<text class="anm-t" x="374" y="94" text-anchor="middle">Subnet</text>
<rect class="anm-box" x="500" y="70" width="88" height="38" rx="6"/>
<text class="anm-t" x="544" y="94" text-anchor="middle">PaaS</text>
<rect class="anm-box-ctl" x="415" y="150" width="88" height="38" rx="6"/>
<text class="anm-t-ctl" x="459" y="174" text-anchor="middle">Firewall</text>
<path class="anm-bad-solid" d="M 420,89 H 494" marker-end="url(#anm3-a-bad)"/>
<path class="anm-dns" d="M 374,110 L 428,148"/>
<path class="anm-dns" d="M 492,148 L 544,110"/>
<text class="anm-lbl" x="459" y="208" text-anchor="middle">what your UDR intended</text>

<text class="anm-band-label" x="622" y="26">ONE ZONE, TWO ENDPOINTS</text>
<rect class="anm-box" x="630" y="62" width="96" height="34" rx="6"/>
<text class="anm-t" x="678" y="84" text-anchor="middle">Endpoint A</text>
<rect class="anm-box" x="630" y="122" width="96" height="34" rx="6"/>
<text class="anm-t" x="678" y="144" text-anchor="middle">Endpoint B</text>
<rect class="anm-box-alt" x="778" y="90" width="92" height="38" rx="6"/>
<text class="anm-t-alt" x="824" y="114" text-anchor="middle">one zone</text>
<path class="anm-dns" d="M 730,80 L 772,100"/>
<path class="anm-bad-solid" d="M 730,139 L 772,120" marker-end="url(#anm3-a-bad)"/>
<circle cx="752" cy="90" r="10" fill="var(--color-card-bg, #FFFFFF)"/>
<text class="anm-x" x="752" y="96" text-anchor="middle">✗</text>
<text class="anm-lbl-bad" x="750" y="196" text-anchor="middle">B's registration deletes A's record</text>
<text class="anm-lbl" x="750" y="214" text-anchor="middle">one zone per service, per sub-resource</text>
</g>
</svg>
</div>
