---
title: "Model Context Protocol (MCP)"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "Understanding MCP: the open protocol for connecting AI models to external data sources and tools, enabling richer context and agentic capabilities."
tags: [ai, generative-ai, llm, mcp, integration, tools, practical]
---

## What Is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to large language models. Think of it as a universal adapter between AI models and the data sources, tools, and services they need to access.

**The core problem MCP solves**: Every AI application needs to connect to external systems (databases, APIs, file systems, services). Without a standard protocol, each integration is custom-built, creating fragmentation and duplication of effort.

### The Analogy

MCP is to AI context what USB is to peripherals. Before USB, every device needed its own connector and driver. USB standardized the interface, and suddenly any device could work with any computer. MCP aims to do the same for AI-to-tool connections.

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Standardization** | One protocol instead of custom integrations per tool |
| **Portability** | Switch LLM providers without rewriting integrations |
| **Security** | Controlled, auditable access to external resources |
| **Ecosystem** | Pre-built servers for common data sources |
| **Separation of concerns** | Context providers don't need to understand AI models |

---

## MCP Architecture

MCP uses a client-server architecture where AI applications (clients) connect to context servers that provide access to specific resources.

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Host Application                   │
│              (Claude Desktop, IDE, etc.)             │
├─────────────────────────────────────────────────────┤
│                     MCP Client                       │
└───────────┬─────────────────┬─────────────────┬─────┘
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │ MCP Server  │   │ MCP Server  │   │ MCP Server  │
     │  (GitHub)   │   │ (Database)  │   │   (Slack)   │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                 │                 │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
     │  GitHub API │   │  PostgreSQL │   │  Slack API  │
     └─────────────┘   └─────────────┘   └─────────────┘
```

**Host Application**: The AI-powered application (Claude Desktop, an IDE, a custom app)

**MCP Client**: Embedded in the host, manages connections to servers

**MCP Servers**: Standalone processes that expose resources, tools, and prompts

**External Resources**: The actual data sources and services

---

## Transport Architecture

MCP communicates via JSON-RPC 2.0, but the transport layer determines where data flows and what security boundaries exist. Understanding transport modes is important for any production deployment because the choice affects data residency, auditability, and the controls available to security teams.

### stdio Transport (Local Process)

The MCP server runs as a child process on the developer's machine. The host application communicates with it over stdin/stdout pipes. No network traffic is involved between the client and server.

```
Developer Workstation
┌──────────────────────────────────────────────────┐
│                                                  │
│  ┌──────────────┐   stdin/stdout   ┌───────────┐ │
│  │  Host App    │◄────────────────►│   MCP     │ │
│  │  (Claude     │  (local pipes,   │  Server   │ │
│  │   Desktop,   │   no network)    │ (local    │ │
│  │   IDE)       │                  │  process) │ │
│  └──────┬───────┘                  └─────┬─────┘ │
│         │                                │       │
│         │ HTTPS                    Local │       │
│         │ (model inference)       resources      │
└─────────┼────────────────────────────────┼───────┘
          │                                │
          ▼                                ▼
   ┌──────────────┐                 Files, repos,
   │  LLM API     │                 databases
   │  (remote)    │
   └──────────────┘
```

**Security boundary**: Everything between the client and server stays on the local machine. The only network traffic is from the host application to the remote LLM API for inference. Local MCP server operations like file reads, git commands, and database queries never leave the machine as raw operations; they enter the model context and are transmitted as part of the inference request.

### HTTP/SSE Transport (Remote Hosted)

The MCP server runs on a remote host. The client sends requests via HTTP POST and receives responses via Server-Sent Events. All communication traverses the network.

```
Developer Workstation              Remote Host
┌─────────────────────┐           ┌─────────────────────┐
│                     │           │                     │
│  ┌──────────────┐   │  HTTPS    │  ┌──────────────┐   │
│  │  Host App    │───┼──────────►│  │  MCP Server  │   │
│  │              │◄──┼───────────│  │              │   │
│  └──────────────┘   │  POST +   │  └──────┬───────┘   │
│                     │  SSE      │         │           │
└─────────────────────┘           │  ┌──────▼───────┐   │
                                  │  │   Backend    │   │
                                  │  │   Services   │   │
                                  │  └──────────────┘   │
                                  └─────────────────────┘
```

**Security boundary**: Data leaves the developer's machine to reach the MCP server, and the MCP server then accesses its backend services. Two network hops carry data in flight: client to MCP server, and MCP server to backend. TLS protects the wire, but the MCP server operator sees all request and response data. This mode enables shared MCP servers that multiple users or applications can connect to.

### Hybrid Transport (Local Server, Remote Backend)

This is the most common production pattern. The MCP server runs locally as a child process (stdio transport) but internally makes authenticated calls to remote services like GitHub, Slack, or Jira.

```
Developer Workstation
┌──────────────────────────────────────────────────┐
│                                                  │
│  ┌──────────────┐   stdin/stdout   ┌───────────┐ │
│  │  Host App    │◄────────────────►│   MCP     │ │
│  │              │  (local pipes)   │  Server   │─┼───► GitHub API
│  └──────┬───────┘                  │ (local    │─┼───► Slack API
│         │                          │  process) │─┼───► Jira API
│         │ HTTPS                    └───────────┘ │
│         │ (model inference)                      │
└─────────┼────────────────────────────────────────┘
          ▼
   ┌──────────────┐
   │  LLM API     │
   │  (remote)    │
   └──────────────┘
```

**Security boundary**: The client-to-server communication is local, but the server-to-backend communication crosses the network. The local MCP server is the trust boundary; it decides what data to send to remote services and manages the credentials for those connections. Those credentials typically live in local configuration files or environment variables, which means the developer's machine becomes the security perimeter for backend API access.

### Transport Selection Guidance

| Factor | stdio (Local) | HTTP/SSE (Remote) | Hybrid (Local + Remote Backend) |
|--------|--------------|-------------------|--------------------------------|
| **Data residency** | All local | Data on remote server | Local processing, selective remote calls |
| **Multi-user access** | Single user | Shared server | Single user per instance |
| **Credential management** | Local env vars | Server-side | Local env vars for backend APIs |
| **Network requirements** | None (client-server) | Full network path | Outbound to specific API endpoints |
| **Audit capability** | Local logs only | Server-side logging | Local logs + remote API audit trails |
| **Typical use** | Dev tools, file access | Shared enterprise services | GitHub, Slack, Jira integrations |

---

## Core Primitives

MCP defines three core primitives that servers can expose to clients.

### Resources

Resources are data that the AI can read. They're identified by URIs and can represent files, database records, API responses, or any other content.

```json
{
  "uri": "file:///projects/myapp/README.md",
  "name": "Project README",
  "mimeType": "text/markdown"
}
```

**Use cases**: Documents, code files, database rows, configuration files, log entries

**Characteristics**:
- Read-only from the AI's perspective
- Can be listed and retrieved
- Support for text and binary content
- Can include metadata

### Tools

Tools are actions the AI can perform. They're functions with defined inputs and outputs that let the model interact with external systems.

```json
{
  "name": "create_github_issue",
  "description": "Create a new issue in a GitHub repository",
  "inputSchema": {
    "type": "object",
    "properties": {
      "repo": { "type": "string" },
      "title": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["repo", "title"]
  }
}
```

**Use cases**: Create records, send messages, execute commands, trigger workflows

**Characteristics**:
- Require explicit user approval (in well-designed clients)
- Have defined input schemas
- Return results to the model
- Can have side effects

### Prompts

Prompts are reusable templates that servers can expose. They help standardize common interactions and can include dynamic content.

```json
{
  "name": "explain_code",
  "description": "Get an explanation of code in a file",
  "arguments": [
    { "name": "file_path", "required": true }
  ]
}
```

**Use cases**: Code review templates, analysis workflows, report generation

**Characteristics**:
- Can accept arguments
- Return messages that can be added to conversation
- Help standardize common tasks

---

## Common MCP Servers

The MCP ecosystem includes pre-built servers for common integrations.

### Official Reference Servers

| Server | Resources | Tools | Description |
|--------|-----------|-------|-------------|
| **Filesystem** | Files, directories | Read, write, search | Access local file system |
| **GitHub** | Repos, issues, PRs | Create issues, PRs | GitHub integration |
| **GitLab** | Repos, issues, MRs | Create issues, MRs | GitLab integration |
| **Slack** | Channels, messages | Send messages | Slack workspace access |
| **Google Drive** | Files, folders | Search, read | Google Drive access |
| **PostgreSQL** | Schema, query results | Execute queries | Database access |
| **SQLite** | Schema, query results | Execute queries | Local database access |
| **Puppeteer** | Web page content | Navigate, interact | Browser automation |

### Community Servers

The community has built servers for:
- Notion, Confluence, and other documentation platforms
- Jira, Linear, and project management tools
- AWS, GCP, and cloud services
- Monitoring and observability platforms
- Custom internal systems

### Finding Servers

- Official MCP servers repository
- Community server directories
- Build custom servers for specific needs

---

## Using MCP in Practice

### Setting Up MCP (Claude Desktop Example)

Claude Desktop supports MCP servers through its configuration file:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

Once configured, the AI can access files and GitHub resources during conversations.

### Workflow Example

**Without MCP**:
1. User asks about code issue
2. User manually copies relevant code into chat
3. AI analyzes and responds
4. User manually creates GitHub issue
5. User pastes AI's suggestion into issue

**With MCP**:
1. User asks about code issue
2. AI reads relevant files directly via MCP
3. AI analyzes and proposes solution
4. AI creates GitHub issue via MCP tool
5. Done in one conversation

### When to Use MCP

| Scenario | MCP Value |
|----------|-----------|
| **Frequent context needs** | High: Eliminates copy-paste |
| **Multi-step workflows** | High: Tools enable automation |
| **Sensitive data** | Medium: Controlled access, but consider security |
| **One-off queries** | Low: Manual context may be faster |
| **Simple conversations** | Low: No external access needed |

---

## Building Custom MCP Servers

When pre-built servers don't meet your needs, you can build custom servers.

### Server Implementation

MCP servers can be built in any language. Official SDKs exist for:
- **TypeScript/JavaScript** (most mature)
- **Python**

### Basic Server Structure (TypeScript)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

const server = new Server({
  name: "my-custom-server",
  version: "1.0.0"
});

// Define available tools
server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "my_tool",
    description: "Does something useful",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" }
      }
    }
  }]
}));

// Handle tool calls
server.setRequestHandler("tools/call", async (request) => {
  if (request.params.name === "my_tool") {
    const result = doSomething(request.params.arguments.input);
    return { content: [{ type: "text", text: result }] };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### What to Expose

**As Resources**:
- Content the AI should read and reference
- Data that changes over time
- Information needed for context

**As Tools**:
- Actions with side effects
- Operations that modify state
- Queries that need parameters

**As Prompts**:
- Common workflows you want standardized
- Complex tasks with multiple steps
- Templates that benefit from consistency

### Design Considerations

| Consideration | Guidance |
|---------------|----------|
| **Granularity** | Prefer focused servers over monolithic ones |
| **Naming** | Use clear, descriptive names for tools and resources |
| **Documentation** | Write detailed descriptions; the AI uses them |
| **Error handling** | Return meaningful errors the AI can act on |
| **Idempotency** | Design tools to be safely retryable |

---

## Security Considerations

MCP introduces trust boundaries between the client, the server, and any backend services the server connects to. Understanding these boundaries and the authorization model is important for production deployments.

### OAuth 2.1 Authorization Lifecycle

For remote (HTTP/SSE) MCP servers, the protocol specifies [OAuth 2.1](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12){:target="_blank" rel="noopener noreferrer"} as the authorization mechanism. The flow works as follows:

```
MCP Client                                 MCP Server / Auth Server
    │                                           │
    │  1. Initial MCP request                   │
    │──────────────────────────────────────────►│
    │  2. 401 Unauthorized                      │
    │◄──────────────────────────────────────────│
    │                                           │
    │  3. Discover auth metadata                │
    │     GET /.well-known/                     │
    │         oauth-authorization-server        │
    │──────────────────────────────────────────►│
    │  4. Auth server URLs                      │
    │◄──────────────────────────────────────────│
    │                                           │
    │  5. Dynamic client registration           │
    │     POST /register                        │
    │──────────────────────────────────────────►│
    │  6. client_id issued                      │
    │◄──────────────────────────────────────────│
    │                                           │
    │  7. Authorization request                 │
    │     (PKCE code_challenge included)        │
    │──────────────────────────────────────────►│
    │                                           │
    │         [User authenticates in browser]    │
    │                                           │
    │  8. Redirect with authorization code      │
    │◄──────────────────────────────────────────│
    │                                           │
    │  9. Token exchange                        │
    │     (auth code + PKCE code_verifier)      │
    │──────────────────────────────────────────►│
    │ 10. Access token (+ refresh token)        │
    │◄──────────────────────────────────────────│
    │                                           │
    │ 11. Authenticated MCP requests            │
    │     Authorization: Bearer <token>         │
    │──────────────────────────────────────────►│
```

The flow has several elements worth understanding:

- **Discovery**: The client finds the authorization server's endpoints via a `.well-known` metadata document ([RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414){:target="_blank" rel="noopener noreferrer"}). This avoids hardcoding auth URLs into clients.
- **Dynamic client registration**: MCP clients can register themselves with servers automatically ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591){:target="_blank" rel="noopener noreferrer"}). Pre-registration is impractical for a protocol designed for ad-hoc tool connections, so clients obtain a `client_id` on the fly.
- **PKCE (Proof Key for Code Exchange)**: Required by OAuth 2.1 for all clients. The client generates a random code verifier, sends a hashed challenge with the authorization request, and proves possession of the verifier during token exchange. This prevents authorization code interception, which is critical for desktop and CLI applications that cannot securely store a client secret.
- **Grant types**: Authorization code with PKCE is the primary flow for user-facing agents. Client credentials may be used for machine-to-machine scenarios where no human user is involved.

For local stdio servers, protocol-level authorization is not applicable because the server runs as a child process of the host application. Authentication to backend services is handled through environment variables and local credential stores.

### The Downstream Authorization Gap

The MCP specification defines how a client authenticates to an MCP server. It does not define how the MCP server authenticates to its backend services. This is an intentional scope boundary in the protocol, but it creates a gap that every production deployment must address.

```
     MCP Spec Covers This               Outside MCP Spec
┌────────────────────────────────┐    ┌──────────────────────────────┐
│                            │    │                              │
│  Client ───► MCP Server    │    │  MCP Server ───► GitHub API  │
│  (OAuth 2.1, PKCE,        │    │  MCP Server ───► Database    │
│   dynamic registration)    │    │  MCP Server ───► Slack API   │
│                            │    │                              │
│                            │    │  Credential management is    │
│                            │    │  the server implementor's    │
│                            │    │  responsibility              │
└────────────────────────────┘    └──────────────────────────────┘
```

Most current MCP servers use static credentials for backend access like API keys, personal access tokens, or service account credentials stored in environment variables. This is simple but has a security implication. Compromising an MCP server's credentials grants access to all backend services it connects to, regardless of which user initiated the request.

The emerging pattern for more sophisticated deployments is [token exchange (RFC 8693)](https://datatracker.ietf.org/doc/html/rfc8693){:target="_blank" rel="noopener noreferrer"}, where the MCP server exchanges the client's access token for a downstream token scoped to specific backend services. This preserves the user's identity through the chain and allows backend services to make authorization decisions based on who is actually requesting access. Adoption is still early because it requires backend services to support the token exchange flow.

### Security Boundary Analysis

Each connection in the MCP architecture represents a trust boundary where data crosses from one domain of control to another.

| Boundary | What Crosses It | Available Controls |
|----------|----------------|-------------------|
| **Developer to Host App** | User prompts, file paths, tool selections | Human-in-the-loop approval for tool calls |
| **Host App to LLM API** | Full conversation context including all tool results | TLS encryption, API key authentication, data classification policies |
| **Host App to MCP Server (stdio)** | Tool requests and responses via local pipes | Local process isolation, filesystem sandboxing |
| **Host App to MCP Server (HTTP)** | Tool requests and responses over network | TLS encryption, OAuth 2.1 authorization, network controls |
| **MCP Server to Backend** | API calls with server-managed credentials | Principle of least privilege, token exchange, API-level RBAC |

Several principles apply across all boundaries:

- **Never expose credentials to the AI model.** Credentials belong in server configuration (environment variables, secret stores), not in the protocol messages. If a credential appears in the conversation context, it will be sent to the LLM provider as part of the next inference request.
- **Start with read-only access.** Add write access incrementally, and require user approval gates for tools with side effects.
- **Sandbox server access.** Filesystem servers should restrict to specific directories. Database servers should use read-only connections when possible. Network access should be scoped to necessary endpoints.
- **Log all tool invocations.** Record what tool was called, the arguments provided, the result returned, the timestamp, and the user identity. These logs are necessary for both debugging and security forensics.
- **User approval is a security boundary.** Well-designed MCP clients require explicit user approval before executing tools with side effects. This is the primary defense against prompt injection attacks that attempt to use the agent's tool access for unintended purposes.

For broader organizational controls around AI tool usage, data classification, and network-level monitoring, see the [AI Security for Organizations](/study-guides/ai/ai-security-for-organizations.html) guide.

---

## MCP vs. Alternatives

### MCP vs. Function Calling

| Aspect | MCP | Function Calling |
|--------|-----|------------------|
| **Scope** | Protocol for context and tools | Model-specific tool interface |
| **Portability** | Works across LLM providers | Provider-specific |
| **Architecture** | Separate server processes | In-application functions |
| **Ecosystem** | Shared servers | Custom per application |

MCP and function calling are complementary. MCP servers can be exposed as functions to models that support function calling.

### MCP vs. LangChain Tools

| Aspect | MCP | LangChain Tools |
|--------|-----|-----------------|
| **Design** | Protocol-first, language-agnostic | Library-specific |
| **Isolation** | Separate processes | In-process |
| **Reusability** | Across any MCP client | Within LangChain apps |

LangChain has an MCP integration, allowing MCP servers to be used as LangChain tools.

### When to Use What

- **MCP**: When you want reusable context providers that work across applications
- **Function calling**: When tools are application-specific and tightly integrated
- **Both**: MCP for shared infrastructure, function calling for app-specific logic

---

## Practical Patterns

### Development Workflow Integration

Connect MCP servers for your development tools:

```
IDE ─── MCP Client
         ├── Filesystem (project files)
         ├── GitHub (issues, PRs)
         ├── Jira (tickets)
         └── Database (local dev DB)
```

The AI can now read code, understand tickets, and check database state without manual context copying.

### Documentation Q&A

Build a documentation assistant:

```
Chat App ─── MCP Client
              ├── Confluence (docs)
              ├── Notion (runbooks)
              └── GitHub (README files)
```

Questions about processes or procedures can be answered by retrieving relevant documentation automatically.

### Workflow Automation

Combine reading and writing capabilities:

1. AI reads ticket from Jira (resource)
2. AI analyzes related code (resource)
3. AI creates GitHub PR (tool)
4. AI updates Jira ticket (tool)
5. AI notifies team in Slack (tool)

### Multi-Environment Access

Different servers for different environments:

```json
{
  "mcpServers": {
    "prod-db": { "command": "...", "env": { "DB_URL": "prod-url" } },
    "staging-db": { "command": "...", "env": { "DB_URL": "staging-url" } }
  }
}
```

The AI can compare data across environments safely.

---

## Limitations and Considerations

### Current Limitations

| Limitation | Implication |
|------------|-------------|
| **Ecosystem maturity** | Not all integrations exist yet |
| **Client support** | Not all AI applications support MCP |
| **Complexity** | Running servers adds operational overhead |
| **Latency** | Server communication adds response time |

### When MCP Might Not Be Right

- Simple, one-off tasks where manual context is faster
- Highly sensitive environments where any external access is risky
- Applications where latency is critical
- Teams without capacity to operate additional services

### Future Direction

MCP is actively evolving. Expected developments include:
- Broader client support across AI applications
- More pre-built servers for common services
- Improved authentication and authorization patterns
- Better tooling for server development and debugging

---

## Quick Reference

### MCP Primitives Summary

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **Resources** | Data to read | Files, DB records, API responses |
| **Tools** | Actions to perform | Create issue, send message |
| **Prompts** | Reusable templates | Code review workflow |

### Getting Started Checklist

1. [ ] Identify what external context your AI needs
2. [ ] Find existing MCP servers for those sources
3. [ ] Configure servers in your MCP client
4. [ ] Test with simple queries
5. [ ] Add tools for write operations (carefully)
6. [ ] Build custom servers for unique needs

### Security Checklist

1. [ ] Credentials stored in environment variables, not in protocol
2. [ ] Read-only access where possible
3. [ ] User approval required for side-effect tools
4. [ ] Audit logging enabled
5. [ ] Sandboxing configured (directories, network)
6. [ ] Regular review of granted permissions
