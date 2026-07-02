---
title: "Eleven Fallacies of Distributed Computing"
layout: resource
type: reference
description: "The eight original fallacies (Deutsch, 1994) plus three modern additions — false assumptions that break distributed systems in production, with mitigations for each."
last_updated: 2026-07-02
tags: [architecture, distributed-systems, microservices, reliability]
related_guides:
  - /study-guides/architecture/distributed-computing.html
---

Originally identified by Peter Deutsch (1994) and colleagues at Sun Microsystems; expanded over time as distributed systems practice evolved.

| # | Fallacy | Why It's Wrong | Mitigation |
| --- | --- | --- | --- |
| 1 | The network is reliable | Packets get lost, connections drop, switches crash | Retries with exponential backoff, timeouts on every call, circuit breakers |
| 2 | Latency is zero | A network call is a million times slower than a local call | Minimize round trips, batch operations, use async where possible |
| 3 | Bandwidth is infinite | Bandwidth is limited, shared, and costs money in the cloud | Watch payload sizes, compress data, paginate large results |
| 4 | The network is secure | Traffic passes through infrastructure you don't control | TLS in transit, authenticate every request, authorize every operation |
| 5 | Topology doesn't change | Services move, scale, fail, and get replaced continuously | Use service discovery, design for dynamic topology, health checks |
| 6 | There is one administrator | Different teams own different parts of the infrastructure | Document dependencies, communicate changes early, version APIs |
| 7 | Transport cost is zero | Bandwidth, infrastructure, and serialization all cost money and CPU | Factor transport cost into architecture decisions, measure actual cost |
| 8 | The network is homogeneous | Systems run on mixed hardware, OS, and software versions | Use standard protocols, version APIs, test across environments |
| 9 | Versioning is easy | Old and new service versions run simultaneously during rollout | Plan backward compatibility, support multiple versions during transition |
| 10 | Compensating transactions always work | Some operations can't be cleanly undone | Design for idempotency, understand saga limitations before relying on them |
| 11 | Observability is optional | Debugging a distributed system blind is nearly impossible | Invest in tracing, structured logging, and metrics from day one |
