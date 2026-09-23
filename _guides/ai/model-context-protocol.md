---
title: "Model Context Protocol (MCP)"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "The Model Context Protocol: hosts, clients, and servers; tools, resources, and prompts; stdio and Streamable HTTP transports; OAuth-based authorization; the trust boundaries each connection creates; and building a server in C#."
tags: [mcp, json-rpc, oauth, integration, tool-calling, security, practical]
---

The **Model Context Protocol (MCP)** is an open protocol for connecting AI applications to tools and data sources. Instead of each application writing its own integration with GitHub, a database, or an internal API, a service is wrapped once as an MCP server, and any application that speaks MCP can use it.

## What MCP Standardizes

### The Integration Problem

Tool calling lets a model request that an application run a function. But the function definitions, the code behind them, and the authentication to the backing service all live inside each application. Five AI applications that each need access to the same ticketing system mean five separate integrations, maintained five times. MCP moves that work into a reusable server with a standard interface, so the problem becomes one server per service plus one protocol implementation per application.

MCP doesn't replace tool calling. An application connected to an MCP server still presents that server's tools to its model through the model provider's normal tool calling interface. MCP standardizes how the application discovers and invokes tools that someone else built.

### Governance and Versioning

Anthropic introduced MCP in 2024 and donated it to the Linux Foundation's Agentic AI Foundation in December 2025. The specification is revised under dated versions, and the protocol changed substantially between them, so any MCP material should state which revision it describes. This guide follows the [2026-07-28 specification](https://modelcontextprotocol.io/specification/latest){:target="_blank" rel="noopener noreferrer"}. Features being removed pass through a formal deprecation state with a minimum twelve-month window, and SDKs typically keep speaking older revisions to interoperate with existing clients and servers.

---

## Architecture

### Hosts, Clients, and Servers

- The **host** is the AI application the user interacts with, such as a chat app, an IDE, or an agent runtime. It owns the conversation with the model and decides what reaches the model's context.
- A **client** is the component inside the host that connects to one MCP server. A host connected to three servers runs three client connections.
- A **server** exposes capabilities, like tools, resources, and prompts, for one integration.

{% include figure.html id="llm-mcp-architecture" %}

The model isn't a participant in the protocol. Servers don't talk to the model, and the model never talks to servers directly. The host lists a server's tools, passes them to the model as tool definitions, receives the model's tool call, sends it to the right server through that server's client, and puts the result back into the conversation. That's what gives the host the chance to require user approval, filter what reaches the model, and log every call.

### Protocol Basics

MCP messages are JSON-RPC requests, responses, and notifications. In the 2026-07-28 revision the protocol is stateless per request. Earlier revisions opened a session with an `initialize` handshake. Now every request carries its protocol version and client capabilities in its metadata, and a server advertises its supported versions and capabilities through a `server/discover` method that clients may call up front. A server that needs state across calls, like an open shopping cart or a database transaction, returns an explicit handle from one tool and accepts it as an argument to later ones, rather than relying on a connection-scoped session.

---

## What Servers Expose

Servers offer three kinds of capability, and the difference between them is who decides when each is used.

| Primitive | What it is | Controlled by | Example |
|---|---|---|---|
| **Tools** | Functions with a JSON Schema for inputs, invoked with `tools/call` | The model, which decides when to call them | Create an issue, run a query, send a message |
| **Resources** | Data identified by URIs, read with `resources/read` | The application, which decides what to include as context | A file, a database schema, a document |
| **Prompts** | Reusable message templates with arguments | The user, who picks them, often as slash commands | "Review this pull request," "Summarize this incident" |

### Tools

An MCP tool definition carries a `name`, an optional human-readable `title`, a `description`, an `inputSchema`, and optionally an `outputSchema` and `annotations`. A result returns `content` for the model to read (text, images, audio, or links to resources) and, when the tool defines an output schema, a `structuredContent` value that conforms to it.

The [tools specification](https://modelcontextprotocol.io/specification/latest/server/tools){:target="_blank" rel="noopener noreferrer"} separates two kinds of failure. A **tool execution error**, such as an invalid date or a failed API call, comes back as a normal result with `isError: true` and a message the model can use to correct itself and retry. A **protocol error**, such as an unknown tool name or a malformed request, comes back as a JSON-RPC error. Returning validation problems as execution errors lets the model recover instead of stopping.

Annotations let a server describe tool behavior, for example that a tool only reads data. The specification requires clients to treat annotations as untrusted unless the server itself is trusted, because a malicious server can label a destructive tool as read-only.

### Resources

Resources expose data by URI (`file:///project/README.md`, or a custom scheme a server defines). Servers can offer URI templates for parameterized data, and clients can opt in to notifications when a resource changes. The host decides whether and when to put resource content in front of the model, which makes resources suited to material a user or application selects, like attaching a file to a conversation.

### Prompts

Prompts are templates a server publishes so users can invoke well-built interactions without writing them each time. A prompt accepts arguments and returns messages the host inserts into the conversation. They're a way for the author of an integration to ship the prompts that work best with it.

### Asking the User for Input

Sometimes a server needs more information partway through a request, like a missing parameter or confirmation of a choice. Under the current specification's multi round-trip pattern, the server returns an **input required** result instead of a final one, listing what it needs. The client gathers it and retries the original request with the answers attached.

**Elicitation** is the standard way to ask the user. Form mode collects simple structured values through the client's interface. URL mode sends the user to a web page, for example to complete a third-party OAuth flow or enter a payment detail, so that the information never passes through the client or the model. The [elicitation specification](https://modelcontextprotocol.io/specification/latest/client/elicitation){:target="_blank" rel="noopener noreferrer"} forbids using form mode to request secrets such as passwords, API keys, or tokens.

Earlier revisions also let servers request a model completion from the client (**sampling**) and ask which directories the user had shared (**roots**). Both are deprecated in the 2026-07-28 revision. The suggested replacements are for servers to call model provider APIs directly and to receive directories through tool parameters or configuration.

---

## Transports

The transport determines where messages travel, and so which security boundaries exist. The protocol semantics are the same on both standard transports.

### stdio

The host launches the server as a child process and exchanges newline-delimited JSON-RPC messages over its standard input and output. Nothing crosses the network between client and server.

```
 Developer machine
 ┌──────────────────────────────────────────────────────┐
 │                                                        │
 │  ┌──────────────┐   stdin/stdout    ┌──────────────┐  │
 │  │  Host app    │◄─────────────────►│  MCP server  │  │
 │  │              │   (local pipes)   │  (child      │  │
 │  └──────┬───────┘                   │   process)   │  │
 │         │                           └──────┬───────┘  │
 │         │                                  ▼          │
 │         │                        Files, git, local DB │
 └─────────┼────────────────────────────────────────────┘
           │ HTTPS: every tool result goes to the
           ▼ model as part of the next request
    ┌──────────────┐
    │  Model API   │
    └──────────────┘
```

"Local" describes the client-server hop, not the data. The contents of any file a local server reads become a tool result, and tool results are sent to the model provider with the next inference request. A stdio server also runs with the permissions of the user who launched it.

### Streamable HTTP

The server runs as an independent service at a single HTTP endpoint. Each client message is an HTTP POST, and the server replies with either a JSON response or, for responses that stream progress, a Server-Sent Events stream scoped to that request.

```
 Developer machine                       Remote host
 ┌─────────────────────┐                ┌──────────────────────────┐
 │                     │  HTTPS POST    │                          │
 │  ┌──────────────┐   │  + bearer      │  ┌────────────────────┐  │
 │  │  Host app    │───┼───token───────►│  │    MCP server      │  │
 │  │              │◄──┼────────────────┼──│                    │  │
 │  └──────────────┘   │  JSON or SSE   │  └─────────┬──────────┘  │
 │                     │                │            ▼             │
 └─────────────────────┘                │   Backend services       │
                                        └──────────────────────────┘
```

Request data leaves the user's machine, and the server's operator can see every request and response. This is what makes shared, centrally managed servers possible, and it's where authorization applies. The older **HTTP+SSE** transport, which used a separate event stream endpoint, has been deprecated since the 2025-03-26 revision and shouldn't be used for new work.

### Local Server, Remote Backend

A common arrangement combines the two. A server runs locally over stdio, and inside it calls a remote API such as GitHub or a ticketing system using credentials from the local environment.

```
 Developer machine
 ┌──────────────────────────────────────────────────────┐
 │                                                        │
 │  ┌──────────────┐   stdin/stdout    ┌──────────────┐  │
 │  │  Host app    │◄─────────────────►│  MCP server  │──┼──► GitHub API
 │  └──────┬───────┘                   │  (API token  │──┼──► Ticketing API
 │         │                           │   from env)  │  │
 │         │                           └──────────────┘  │
 └─────────┼────────────────────────────────────────────┘
           ▼
    ┌──────────────┐
    │  Model API   │
    └──────────────┘
```

The local server holds the credentials and decides what it sends to the remote service. The developer's machine becomes the security perimeter for those backend credentials, and every user of the server authenticates to the backend as whoever owns the token.

### Choosing a Transport

| Factor | stdio | Streamable HTTP | Local server, remote backend |
|---|---|---|---|
| **Who can use it** | One user, on one machine | Many users and applications | One user per installation |
| **Where credentials live** | Local environment | On the server, or delegated through OAuth | Local environment, for the backend |
| **Authorization model** | Environment credentials; the MCP authorization spec doesn't apply | OAuth 2.1 per the specification | Environment credentials |
| **Central control and audit** | Weak, since each machine differs | Strong, in one place | Weak locally; the backend's own audit logs help |
| **Typical use** | Local files, git, developer tooling | Shared internal services, SaaS-hosted servers | Personal access to SaaS APIs |

---

## Authorization

### Where OAuth Applies

Authorization is optional in MCP, and the [authorization specification](https://modelcontextprotocol.io/specification/latest/basic/authorization){:target="_blank" rel="noopener noreferrer"} applies to HTTP-based transports. stdio servers aren't meant to follow it and instead take credentials from their environment. For a protected HTTP server, the roles map onto OAuth 2.1:

- The **MCP server** is an OAuth resource server that accepts access tokens.
- The **MCP client** is the OAuth client, acting on behalf of the user.
- An **authorization server**, which can be separate from the MCP server, authenticates the user and issues tokens.

### The Flow

{% include figure.html id="llm-mcp-oauth-flow" %}

Several standards do the work:

- **Discovery.** The server's 401 response points to its Protected Resource Metadata document ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728){:target="_blank" rel="noopener noreferrer"}), which names its authorization servers. The client then reads the authorization server's own metadata ([RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414){:target="_blank" rel="noopener noreferrer"} or OpenID Connect discovery). No authorization URLs are hard-coded.
- **Client identification.** An MCP client usually has no prior relationship with a server it connects to. The preferred mechanism is a **Client ID Metadata Document**, where the client's ID is an HTTPS URL at which it publishes its own metadata. Pre-registration also works. Dynamic Client Registration ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591){:target="_blank" rel="noopener noreferrer"}) is deprecated in the current revision and kept for authorization servers that don't support metadata documents.
- **PKCE** protects the authorization code for public clients like desktop and command-line apps, which can't keep a client secret.
- **Resource indicators** ([RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html){:target="_blank" rel="noopener noreferrer"}) name the specific MCP server a token is for, so the authorization server issues a token that only that server should accept.
- **Scopes** can be requested incrementally. When an operation needs more access, the server responds with an insufficient-scope challenge, and the client re-authorizes for the combined set.

### Tokens Belong to One Server

An MCP server must check that each access token was issued for it as the intended audience and reject tokens meant for anything else. It must also never forward the client's token to a downstream API. The specification's [security best practices](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices){:target="_blank" rel="noopener noreferrer"} call this **token passthrough** and forbid it. A server that accepts and forwards tokens lets a stolen token for one service unlock another, bypasses the rate limits and validation that depend on audience, and leaves downstream logs showing the wrong caller.

### The Downstream Credential Gap

The specification governs how a client gets access to an MCP server. How that server authenticates to the systems behind it is up to the server's implementer, and it's where much of the risk sits.

```
         Defined by MCP                     Server implementer's problem
 ┌──────────────────────────────┐    ┌──────────────────────────────────┐
 │                              │    │                                  │
 │  Client ────► MCP server     │    │  MCP server ────► GitHub API     │
 │  OAuth 2.1, PKCE, resource   │    │  MCP server ────► Database       │
 │  indicators, audience checks │    │  MCP server ────► Ticketing API  │
 │                              │    │                                  │
 └──────────────────────────────┘    └──────────────────────────────────┘
```

Many servers use one static credential, such as a service account key or personal access token, for all backend calls. That's simple, but every user of the server acts with that credential's full permissions, and compromising the server exposes everything it can reach. Better options preserve the user's identity downstream:

- **OAuth token exchange** ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693){:target="_blank" rel="noopener noreferrer"}) swaps the token the server received for a new token scoped to a specific backend, issued by an authorization server that trusts the exchange. This requires backend support.
- **A separate OAuth flow per user**, where the server acts as an OAuth client to the third-party service. URL-mode elicitation sends the user to authorize the MCP server directly, and the server stores the resulting tokens bound to that user. The third-party credentials never pass through the MCP client.

---

## Security Boundaries

### What Crosses Each Boundary

| Boundary | What crosses it | Controls |
|---|---|---|
| **User to host** | Prompts, approvals, selected files | Approval prompts for tool calls, clear display of which tools are exposed |
| **Host to model API** | The entire conversation, including every tool result and resource read | Provider data terms, data classification, filtering what enters the context |
| **Host to local server (stdio)** | Tool calls and results over pipes | Process sandboxing, filesystem restrictions, the server runs as the user |
| **Host to remote server (HTTP)** | Tool calls and results over the network | TLS, OAuth with audience-bound tokens, network controls |
| **Server to backend** | API calls under the server's credentials | Least-privilege credentials, per-user delegation, backend audit logs |

### Risks to Plan For

The first item below follows from how models read server content. The others are drawn from the specification's security guidance.

- **Instructions hidden in server content.** Tool descriptions, annotations, and tool results all reach the model's context. A malicious or compromised server can use them to steer the model toward calling other tools in harmful ways. The specification's rules that annotations are untrusted and that a human should be able to deny tool invocations exist for this reason.
- **Untrusted servers.** Installing a local MCP server means running someone else's code with your permissions. The specification requires clients offering one-click server setup to show the exact command and get explicit consent, and recommends sandboxing server processes.
- **Confused deputy.** A server that proxies to a third-party API with a single static OAuth client ID can be abused to obtain authorization without the user's consent unless it collects its own per-client consent first.
- **Server-side request forgery.** Discovery makes clients fetch URLs that a server supplies, so a malicious server can point them at internal addresses or cloud metadata endpoints. Clients deployed on servers should require HTTPS and block private address ranges.
- **Guessable state handles.** A cart or workflow ID passed as a tool argument isn't authentication. Servers must check that the authenticated caller owns the handle.

### Practices

- **Keep credentials out of the model's context.** Credentials belong in server configuration or secret stores. Anything that appears in a tool result is sent to the model provider.
- **Start read-only.** Add write tools deliberately, scoped narrowly, and require approval for actions with side effects.
- **Restrict what servers can reach.** Limit filesystem servers to specific directories, database servers to read-only roles where possible, and network access to the endpoints they need.
- **Log every tool call** with the tool, arguments, result, caller identity, and time, for debugging and incident investigation.
- **Vet servers like dependencies.** Prefer servers from the service's own vendor or your own organization, pin versions, and review what a server's tools can do before connecting it.

---

## Building a Server

Official SDKs exist for TypeScript, Python, C#, Go, and Rust at the most complete support tier, with Java, Ruby, Swift, PHP, and Kotlin also available. A minimal stdio server with the [C# SDK](https://csharp.sdk.modelcontextprotocol.io/){:target="_blank" rel="noopener noreferrer"} uses the `ModelContextProtocol` and `Microsoft.Extensions.Hosting` packages:

```csharp
using System.ComponentModel;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Server;

var builder = Host.CreateApplicationBuilder(args);

// stdout carries protocol messages, so all logging must go to stderr.
builder.Logging.AddConsole(options =>
{
    options.LogToStandardErrorThreshold = LogLevel.Trace;
});

builder.Services
    .AddMcpServer()
    .WithStdioServerTransport()
    .WithToolsFromAssembly();

await builder.Build().RunAsync();

[McpServerToolType]
public static class OrderTools
{
    [McpServerTool, Description(
        "Look up the current status of an order by its order number. " +
        "Returns the status and, once shipped, the carrier.")]
    public static string GetOrderStatus(
        [Description("The order number, for example ORD-10042")] string orderNumber)
    {
        // Replace with a real lookup against your order system.
        return orderNumber == "ORD-10042"
            ? "Shipped via UPS"
            : $"No order found with number {orderNumber}. Check the number and try again.";
    }
}
```

The SDK builds each tool's name, description, and input schema from the method signature and its `Description` attributes, so those strings are what the model reads. Writing a message to standard output from a stdio server corrupts the protocol stream, which is why logging goes to standard error.

For a remote server, the `ModelContextProtocol.AspNetCore` package hosts the same tools over Streamable HTTP:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddMcpServer()
    .WithHttpTransport(options => options.Stateless = true)
    .WithToolsFromAssembly();

var app = builder.Build();
app.MapMcp();
app.Run();
```

A production HTTP server also needs authentication in front of that endpoint, following the authorization flow above.

### Choosing Primitives

- Expose **tools** for anything the model should decide to do on its own, especially actions and parameterized queries.
- Expose **resources** for content an application or user selects to include, like files, schemas, or records.
- Expose **prompts** for workflows users trigger by name that benefit from a carefully written template.

The design principles for good tools apply unchanged to MCP tools. Build around tasks rather than endpoints, write descriptions for a reader with no context, return concise and meaningful results, and make errors actionable.

---

## Using MCP

### Connecting a Server to a Host

Each host has its own way to register servers, usually a settings screen or a JSON configuration file. For a local stdio server, the configuration names the command that launches it:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/me/projects/app"]
    }
  }
}
```

The path argument limits this reference server to one directory. Remote servers are typically added by URL, after which the host runs the authorization flow in a browser. Check the host's documentation for its exact format.

### Finding Servers

The [MCP Registry](https://registry.modelcontextprotocol.io/){:target="_blank" rel="noopener noreferrer"} lists published servers, and many software vendors now publish official servers for their own products. The protocol project's own [reference servers](https://github.com/modelcontextprotocol/servers){:target="_blank" rel="noopener noreferrer"} are a small set (Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, and Time) meant to demonstrate the protocol, not to run in production. Earlier reference servers for services like GitHub, Slack, and PostgreSQL were archived, so guides and configurations that point to them are out of date.

---

## MCP or Direct Tool Definitions

| Aspect | MCP server | Tools defined in the application |
|---|---|---|
| **Reuse** | Any MCP-capable host can use it | Tied to one application |
| **Ownership** | The integration's owner maintains it, often the service vendor | The application team maintains it |
| **Runtime** | A separate process or service, with its own deployment | In-process code |
| **Latency and moving parts** | An extra hop and another component that can fail | Direct function calls |
| **Security surface** | A new trust boundary to vet, authorize, and monitor | Contained within the application |

Use MCP when the same integration serves several applications or users, when a vendor already provides a maintained server, or when you want the people who own a system to own its AI integration. Define tools directly when the capability is specific to one application, latency matters, or running another service isn't justified. Many applications do both: MCP for shared integrations, and direct tools for application-specific logic.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Following material written for older revisions** | Code built on the HTTP+SSE transport, sessions, or sampling targets deprecated features | Check which specification revision a source describes |
| **Installing unvetted local servers** | Arbitrary code runs with the user's permissions | Treat servers like dependencies: trusted sources, pinned versions, review |
| **Passing the client's token downstream** | Tokens meant for one service unlock another; audit trails break | Validate audience and use a separate credential or token exchange for backends |
| **One broad static backend credential** | Every user acts with full permissions; a compromise exposes everything | Least-privilege credentials, or per-user delegation |
| **Trusting tool annotations and results** | A server steers the model or mislabels destructive tools | Treat server-provided content as untrusted and require approval for consequential actions |
| **Logging to stdout in a stdio server** | Corrupted messages and a broken connection | Log to stderr |
| **Assuming "local" means private** | File contents read by a local server are sent to the model provider | Classify what servers can read, and restrict their scope |
