---
title: "Amazon Cognito: Identity for Your Application's Users"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "How Cognito user pools and identity pools authenticate an application's end users, federate external identity providers, and exchange tokens for scoped AWS credentials."
tags: [cognito, user-pools, identity-pools, federation, jwt, fundamentals]
---

## What Cognito Is For

**Amazon Cognito** handles sign-in for the people who use your application, such as customers, partners, and the public. It isn't how your own staff sign in to AWS, which is IAM Identity Center's job. Cognito has two parts that are often used together but solve different problems:

- A **user pool** is a user directory and a token issuer. It signs users in, with a password, a passkey, a one-time code, or through an external provider such as Google or a company's SAML identity provider, and issues standard OpenID Connect tokens that your application and APIs trust.
- An **identity pool** trades a token for temporary AWS credentials. It takes a token from a user pool or another provider and returns credentials for an IAM role, so a mobile or web client can call AWS services such as S3 or DynamoDB directly.

An application whose clients only call its own API needs just a user pool. The identity pool matters when clients talk to AWS services without a backend in between:

{% include figure.html id="aws-cognito-token-flow" %}

The protocols underneath, OAuth 2.0 and OpenID Connect, are covered in [Identity and Access Management](/study-guides/security/identity-access-management.html). This guide covers how Cognito implements them and what it adds.

---

## User Pools

### The directory

Each user in a pool has a **username**, a set of **standard attributes** from the OpenID Connect specification, such as `email`, `phone_number`, and `name`, and up to 50 **custom attributes**, prefixed `custom:`. Every user also gets a `sub`, an identifier that never changes. Email addresses and phone numbers can change, and in some configurations can move from one account to another, so identify users in your own data by `sub`.

Several choices are fixed when the pool is created:

- **Sign-in identifiers.** Users sign in either with a username plus optional aliases, such as a verified email or phone number, or with an email address or phone number as the username itself.
- **Required attributes.** Which standard attributes a user must provide at sign-up.
- **Custom attributes.** They can be added later, but never removed or renamed.

Changing any of these means creating a new pool and moving the users into it. Plan the schema before the first user signs up. Keep frequently changing data, such as preferences or usage, in your own database keyed by `sub`, not in attributes.

### App clients

An **app client** represents one application that uses the pool, and most settings that affect an application live there: which authentication flows it may use, which OAuth grants and scopes it may request, its callback URLs, its token lifetimes, and which attributes it can read and write. A **public client**, such as a browser or mobile app, can't keep a secret and has none. A **confidential client**, such as a server-side web app, has a client secret and authenticates with it.

A pool with several applications gives each its own app client, so each has its own settings and its tokens name the client they were issued to.

### Signing in

There are two ways to put a sign-in screen in front of users:

- **Managed login** is a set of sign-in, sign-up, and password-reset pages that Cognito hosts on a Cognito domain or your own custom domain. Your app redirects the user there using the OAuth authorization code flow and receives tokens when they come back. Managed login handles federation, MFA, and passkeys without application code, and in the Essentials and Plus plans it can be branded with a visual editor. The older **hosted UI** is its less customizable predecessor.
- **Your own UI** calls the user pool API directly through an AWS SDK or AWS Amplify, with operations such as `InitiateAuth` and `RespondToAuthChallenge`. It gives full control of the experience, but federation with external providers still has to go through Cognito's OAuth endpoints.

Local users can sign in with a password, with **passkeys**, which are FIDO2 keys held by the device or a password manager, or with a one-time code sent by email or SMS. **Choice-based sign-in** lets the user pick among the methods the pool allows. MFA can use an authenticator app, SMS, or email codes. Passkeys, passwordless codes, and email MFA need the Essentials plan or above.

### Federation

A user pool can **federate** sign-in to external identity providers: social providers such as Google, Apple, Facebook, and Login with Amazon, and any SAML 2.0 or OpenID Connect provider, such as a customer's corporate directory. The user signs in at their provider, Cognito creates or updates a user in the pool from the provider's claims through **attribute mapping**, and then issues its own tokens. Your application trusts only the user pool, however many providers sit behind it.

A federated user is a separate profile from a local user with the same email address. Linking them, so that one person has one `sub` whichever way they sign in, is an explicit step, usually done in a pre sign-up Lambda trigger.

### Tokens

A successful sign-in returns three tokens:

| Token | What it's for | Lifetime |
| --- | --- | --- |
| **ID token** | Tells the client who the user is, with attributes and group membership as claims | 5 minutes to 1 day, default 1 hour |
| **Access token** | Authorizes requests to APIs, carrying the granted scopes and groups | 5 minutes to 1 day, default 1 hour |
| **Refresh token** | Gets new ID and access tokens without signing in again | 60 minutes to 10 years, default 30 days |

The ID and access tokens are JSON Web Tokens (JWTs) signed with RS256. APIs should authorize with the access token, which is issued for that purpose and carries **scopes**. Custom scopes come from **resource servers** defined in the pool, such as `orders/read`. The ID token is for the client, to learn who signed in.

Any service that accepts these tokens must verify them. That means checking the signature against the keys published at `https://cognito-idp.<region>.amazonaws.com/<pool-id>/.well-known/jwks.json`, and checking that the token hasn't expired, that `iss` is your pool, that `token_use` is the type you expect, and that the app client, `aud` in an ID token or `client_id` in an access token, is one you accept. Standard JWT libraries do this. In ASP.NET Core, the JWT bearer handler reads the keys from the pool's discovery document, and the Cognito-specific claims need checking by hand:

```csharp
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE";
        // Access tokens carry client_id instead of aud.
        options.TokenValidationParameters.ValidateAudience = false;
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var user = context.Principal!;
                if (user.FindFirst("token_use")?.Value != "access" ||
                    user.FindFirst("client_id")?.Value != "1example23456789")
                {
                    context.Fail("Not an access token for this app client.");
                }
                return Task.CompletedTask;
            }
        };
    });
```

Verification happens offline, so a verified token stays usable until it expires, even after the user signs out. Signing out revokes the refresh token and marks the access token invalid for Cognito's own APIs, but an API that only checks signatures still accepts it. Keep access token lifetimes short where that matters. Turning on **refresh token rotation** makes each refresh return a new refresh token and invalidate the old one, which limits what a stolen refresh token is worth.

For service-to-service calls with no user, a confidential app client can use the OAuth **client credentials** grant to get an access token for its own scopes. These **machine-to-machine** tokens are billed per token request, so services should cache them until they expire.

### Lambda triggers

**Lambda triggers** run your code at points in the user pool's flows:

| Stage | Triggers | Typical use |
| --- | --- | --- |
| Sign-up | Pre sign-up, post confirmation | Validate or auto-confirm users, link federated accounts, create a profile in your database |
| Sign-in | Pre authentication, post authentication, custom challenge (define, create, verify) | Block sign-ins, record activity, build a custom authentication flow |
| Tokens | Pre token generation | Add, change, or remove claims and scopes |
| Federation | Inbound federation | Transform a provider's attributes before the user is created or updated |
| Migration | Migrate user | Move users from an old directory as they first sign in |
| Messages | Custom message, custom email and SMS sender | Localize messages, or send them through your own provider |

Cognito calls most triggers synchronously and waits at most five seconds, a limit that can't be changed. A slow or failing trigger fails the user's sign-in or sign-up, and the error text reaches the user, so keep triggers fast and return only errors meant for users. The pre token generation trigger can change the ID token on every plan, but changing access tokens needs the Essentials plan or above, and changing machine-to-machine tokens needs the trigger's version 3 event.

### Feature plans and pricing

User pools are billed per **monthly active user** (MAU), a user with any sign-in, token refresh, or profile activity that month, at a rate set by the pool's **feature plan**:

| Plan | Adds | Direct sign-in price |
| --- | --- | --- |
| **Lite** | Sign-up and sign-in, federation, MFA with SMS or authenticator apps, the classic hosted UI, Lambda triggers | $0.0055 per MAU, falling to $0.0046 at volume |
| **Essentials** (default) | Managed login with branding, passkeys and passwordless codes, email MFA, access token customization | $0.015 per MAU |
| **Plus** | Threat protection: compromised-credential detection, adaptive authentication based on sign-in risk, and exportable user activity logs | $0.020 per MAU |

Lite and Essentials include 10,000 direct-sign-in MAUs free each month per account or organization, and the free tier doesn't expire. Lite pools created before November 22, 2024 keep an older 50,000 MAU free tier. Users who sign in through SAML or OIDC providers cost $0.015 per MAU on every plan, after 50 free. Machine-to-machine token requests cost $0.00225 each. Identity pools are free.

---

## Identity Pools

An identity pool gives each user a stable **identity ID** and exchanges their token for temporary credentials from an IAM role. It accepts tokens from a user pool, from social and OIDC providers directly, from SAML providers, and from your own backend through **developer-authenticated identities**. It can also issue credentials to **guest** users who haven't signed in at all, through a separate unauthenticated role.

The pool decides which role a user gets in one of three ways:

- A **default role** for all authenticated users.
- **Rules** that map claims in the user's token to roles, such as giving users whose `custom:plan` claim is `premium` a role with more access.
- The **`cognito:preferred_role` claim** in a user pool token, which comes from the user's groups. Each user pool group can name an IAM role, and the highest-precedence group's role wins.

**Attributes for access control** map token claims to session tags on the credentials. An IAM policy can then use those tags as conditions, such as allowing access only to S3 objects under a prefix matching the user's `sub` or tenant ID. One role and one policy then serve every user, each limited to their own data.

The roles' trust policies are part of the security boundary. Each must trust `cognito-identity.amazonaws.com` only for your identity pool, with a condition on `cognito-identity.amazonaws.com:aud`, and only for authenticated users where that applies, with a condition on `amr`. The guest role, if enabled, should allow only what an anonymous user may do.

---

## Putting Cognito in Front of an API

An API can verify Cognito tokens itself, as in the example above, or leave it to the service in front of it:

- **API Gateway** checks Cognito tokens before a request reaches the backend. REST APIs use a Cognito user pool authorizer and HTTP APIs use a JWT authorizer, and both can require scopes.
- An **Application Load Balancer** can run the sign-in itself with its `authenticate-cognito` listener action, redirecting unauthenticated browsers to managed login and passing user claims to the targets in headers. It suits server-rendered web applications that have no sign-in code of their own.
- **AppSync** accepts user pool tokens for GraphQL APIs.

Verifying in the gateway keeps unauthenticated traffic away from the backend, but the backend still needs the user's identity and should still check the scopes and claims its own authorization depends on.

---

## Multi-Tenant Applications

A software-as-a-service application serving many customer organizations has to decide how tenants map onto Cognito resources:

| Approach | Isolation | Trade-off |
| --- | --- | --- |
| **User pool per tenant** | Strongest. Each tenant has its own users, settings, identity providers, and feature plan | Pool management at scale, a default quota of 1,000 pools per Region, and a way to route users to their pool |
| **App client per tenant** | Per-tenant identity providers and settings in a shared pool | Users are shared, and a managed login session signs a local user in to every app client in the pool |
| **Group or custom attribute per tenant** | Tenant ID carried as a claim in a shared pool | Simplest, but every tenant shares one configuration, and your authorization code must enforce the tenant boundary |

Whatever the choice, the tenant ID should reach the application in a claim the user can't change, such as an immutable custom attribute set by an administrator, or a claim added by the pre token generation trigger. Cognito's request-rate quotas are per account and Region and shared by all tenants in it.

---

## Common Pitfalls

- **Fixed pool settings.** Sign-in identifiers and required attributes can't change after the pool is created, and custom attributes can't be removed. Migrating to a new pool is the only fix, and the migrate user trigger can move users as they sign in, but only if the old pool can verify their passwords.
- **Accepting tokens from the wrong client.** A service that checks only the signature and issuer accepts tokens issued to any app client in the pool, including one that was never meant to call it. Check the client ID and `token_use` too.
- **Authorizing with the ID token.** ID tokens carry user attributes, not the scopes an API should check, and they're meant for the client. APIs should require the access token.
- **Expecting sign-out to stop API access.** An access token that an API verifies offline works until it expires. Short access token lifetimes bound the gap.
- **Slow triggers.** A trigger that calls a slow database or cold-starts in a VPC can exceed the five-second limit and fail sign-ins. Keep trigger work small, and move anything slow to an asynchronous step after sign-up.
- **Throttling at scale.** User pool API requests are limited per account and Region by category, such as sign-in operations. A large launch or a client that refreshes tokens too often can hit the limit, and extra capacity can be bought in advance.

---

## When Cognito Fits

Cognito fits applications on AWS that need customer sign-in at a low cost per user, and it integrates most closely with the rest of AWS. API Gateway, Application Load Balancers, and AppSync verify its tokens natively, and identity pools give clients scoped AWS credentials that no third-party provider can issue directly. Its per-user price at scale is well below that of most dedicated customer identity products.

Dedicated identity products offer more polished sign-in experiences, richer customization, and features such as organization management and fine-grained consent, and they work the same across clouds. Many teams use one of them as the identity provider and, where clients need AWS credentials, federate it into an identity pool. For workforce identity, where employees sign in to AWS accounts and business applications, use IAM Identity Center rather than Cognito.

---

## Key Takeaways

- A user pool signs users in and issues tokens. An identity pool trades a token for temporary AWS credentials. Many applications need only the user pool.
- Plan the user pool's sign-in identifiers and required attributes before launch, because they can't change later. Identify users by `sub`.
- Authorize APIs with the access token and its scopes, and verify the signature, issuer, expiration, `token_use`, and client ID on every request.
- Access tokens verified offline stay valid until they expire, so keep their lifetime short and turn on refresh token rotation.
- Lambda triggers customize every stage of sign-up and sign-in, within a five-second limit.
- The Essentials plan, the default, adds managed login branding, passkeys, and access token customization. Plus adds threat protection.
- In identity pools, scope the role trust policies to your pool and to authenticated users, and use session tags to limit each user to their own data.
