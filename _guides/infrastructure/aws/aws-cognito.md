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

Each user in a pool has a **username**, a set of **standard attributes** from the OpenID Connect specification, such as `email`, `phone_number`, and `name`, and up to 50 **custom attributes**, prefixed `custom:`. Every user also gets a `sub`, an identifier that never changes. Email addresses and phone numbers can change, and in some configurations can move from one account to another, so identify users in your own data by `sub`. Users can also belong to **groups**, which appear in their tokens and can map to IAM roles.

Several choices are fixed when the pool is created:

- **Sign-in identifiers.** Users sign in either with a username plus optional aliases, such as a verified email or phone number, or with an email address or phone number as the username itself.
- **Required attributes.** Which standard attributes a user must provide at sign-up.
- **Custom attributes.** They can be added later, but never removed or renamed.

Changing any of these means creating a new pool and moving the users into it. Plan the schema before the first user signs up. Keep frequently changing data, such as preferences or usage, in your own database keyed by `sub`, not in attributes.

A user pool lives in one AWS Region, along with its users, its request quotas, and the Lambda functions it calls.

### App clients

An **app client** represents one application that uses the pool, and most settings that affect an application live there: which authentication flows it may use, which OAuth grants and scopes it may request, its callback URLs, its token lifetimes, and which attributes it can read and write. A **public client**, such as a browser or mobile app, can't keep a secret and has none. A **confidential client**, such as a server-side web app, has a client secret and authenticates with it.

A pool with several applications gives each its own app client, so each has its own settings, and the tokens each one receives name it as the client they were issued to.

### Signing in

There are two ways to put a sign-in screen in front of users:

- **Managed login** is a set of sign-in, sign-up, and password-reset pages that Cognito hosts on a Cognito domain or your own custom domain. Your app redirects the user there using the OAuth authorization code flow and receives tokens when they come back. Managed login handles federation, MFA, and passkeys without application code, and it can be branded with a visual editor. It needs the Essentials plan or above. Pools on the Lite plan get the older **classic hosted UI**, which is less customizable.
- **Your own UI** calls the user pool API directly through an AWS SDK or AWS Amplify, with operations such as `InitiateAuth` and `RespondToAuthChallenge`. It gives full control of the experience, but federated users can't sign in through the API, so federation still goes through Cognito's OAuth endpoints.

Local users can sign in with a password, with **passkeys**, which are FIDO2 keys held by the device or a password manager, or with a one-time code sent by email or SMS. **Choice-based sign-in** lets the user pick among the methods the pool allows. MFA can use an authenticator app, SMS, or email codes. Passkeys, passwordless codes, and email MFA need the Essentials plan or above.

### Federation

A user pool can **federate** sign-in to external identity providers: social providers such as Google, Apple, Facebook, and Login with Amazon, and any SAML 2.0 or OpenID Connect provider, such as a customer's corporate directory. The user signs in at their provider, Cognito creates or updates a user in the pool from the provider's **claims**, the named values in its token, through **attribute mapping**, and then issues its own tokens. Your application trusts only the user pool, however many providers sit behind it.

A federated user is a separate profile from a local user with the same email address. Linking them, so that one person has one `sub` whichever way they sign in, is an explicit step, usually taken in a pre sign-up Lambda trigger. It has to happen before the federated user's first sign-in, and it should match only on attributes the provider has verified. Linking on an email address that a provider doesn't verify lets anyone who registers that address there take over the local account.

### Tokens

A successful sign-in returns three tokens:

| Token | What it's for | Lifetime |
| --- | --- | --- |
| **ID token** | Tells the client who the user is, with attributes and group membership | 5 minutes to 1 day, default 1 hour |
| **Access token** | Authorizes requests to APIs, carrying the granted scopes and groups | 5 minutes to 1 day, default 1 hour |
| **Refresh token** | Gets new ID and access tokens without signing in again | 60 minutes to 10 years, default 30 days |

The ID and access tokens are JSON Web Tokens (JWTs) signed with RS256. Each carries claims such as `email`, the issuer `iss`, and the expiry time `exp`. APIs should authorize with the access token, which is issued for that purpose and carries **scopes**. Custom scopes come from **resource servers** defined in the pool, such as `orders/read`. The ID token is for the client, to learn who signed in.

Custom scopes only appear in tokens issued through the pool's OAuth endpoints, as managed login and federation use. A token from API sign-in carries just `aws.cognito.signin.user.admin`, the scope for a user managing their own profile. An application with its own sign-in UI that needs API scopes has to add them with a pre token generation trigger, on the Essentials plan or above.

Any service that accepts these tokens must verify them. Each pool publishes a **discovery document**, at `https://cognito-idp.<region>.amazonaws.com/<pool-id>/.well-known/openid-configuration`, that points to its signing keys. Verification checks the signature against those keys, then checks that the token hasn't expired, that `iss` names your pool, that `token_use` is `access` or `id` as expected, and that the app client is one you accept. An ID token names the client in `aud`, and an access token in `client_id`. Standard JWT libraries do most of this. In ASP.NET Core, the JWT bearer handler reads the keys through the discovery document, and the Cognito-specific claims need checking by hand:

```csharp
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE";
        // Access tokens name the app client in client_id. They carry aud
        // only when the client requested a resource binding.
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

Pools can also use an **updated issuer**, `https://issuer-cognito-idp.<region>.amazonaws.com/<pool-id>`, which AWS recommends because it serves the same keys from several Regions. Application Load Balancer authentication with Cognito and API Gateway's REST API Cognito authorizer don't yet accept it.

Verification happens offline, so a verified token stays usable until it expires, whatever happens to the session:

- **Revoking** a refresh token, with `RevokeToken`, invalidates it and every token issued from it, for one session.
- **Global sign-out**, with `GlobalSignOut`, revokes all of a user's tokens. After it, the refresh tokens stop working and Cognito's own APIs reject the access tokens, but an API that only checks signatures still accepts an access token until it expires.
- **Managed login** keeps its own session cookie in the browser for an hour, which can sign the user in again without credentials. Send users to the pool's logout endpoint to clear it, and don't set token lifetimes below an hour with managed login, since the cookie outlasts them anyway.

Keep access token lifetimes as short as your APIs can tolerate, since that bounds how long a revoked session keeps working. **Refresh token rotation** makes each refresh return a new refresh token and invalidate the old one, which limits what a stolen refresh token is worth. It replaces the `REFRESH_TOKEN_AUTH` flow with the `GetTokensFromRefreshToken` operation, so applications that refresh through `InitiateAuth` need changing before it's turned on.

For service-to-service calls with no user, a confidential app client can use the OAuth **client credentials** grant to get an access token for its own scopes. These **machine-to-machine** tokens are billed per token request, so services should cache them until they expire.

### Lambda triggers

**Lambda triggers** run your code at points in the user pool's flows:

| Stage | Triggers | Typical use |
| --- | --- | --- |
| Sign-up | Pre sign-up, post confirmation | Validate or auto-confirm users, link federated accounts, create a profile in your database |
| Sign-in | Pre authentication, post authentication | Block sign-ins, record activity |
| Custom sign-in steps | Define, create, and verify auth challenge | Build challenge steps of your own, such as a CAPTCHA or an external check |
| Tokens | Pre token generation | Add, change, or remove claims and scopes |
| Federation | Inbound federation | Transform a provider's attributes before the user is created or updated |
| Migration | Migrate user | Move users from an old directory as they first sign in |
| Messages | Custom message, custom email and SMS sender | Localize messages, or send them through your own provider |

Cognito calls most triggers synchronously and waits at most five seconds, a limit that can't be changed. A slow or failing trigger fails the user's sign-in or sign-up, and the trigger's error text reaches the user, so keep triggers fast and return only errors meant for users. Move slow work, such as provisioning a user's data, out of the sign-in path.

The pre token generation trigger receives a versioned event. Version 1 changes ID tokens and works on every plan. Version 2 also changes access tokens, and version 3 also changes machine-to-machine tokens, and both need Essentials or above.

### Feature plans and pricing

User pools are billed per **monthly active user** (MAU), a user with any sign-in, token refresh, or profile activity that month, at a rate set by the pool's **feature plan**:

| Plan | Adds | Direct sign-in price |
| --- | --- | --- |
| **Lite** | Sign-up and sign-in, federation, MFA with SMS or authenticator apps, the classic hosted UI, Lambda triggers | $0.0055 per MAU, falling to $0.0046 at volume |
| **Essentials** (default) | Managed login with branding, passkeys and passwordless codes, email MFA, access token customization | $0.015 per MAU |
| **Plus** | Threat protection: compromised-credential detection, adaptive authentication based on sign-in risk, and exportable user activity logs | $0.020 per MAU |

Lite and Essentials include 10,000 direct-sign-in MAUs free each month per account or organization, and the free tier doesn't expire. Lite pools created before November 22, 2024 keep an older 50,000 MAU free tier. Users who sign in through SAML or OIDC providers cost $0.015 per MAU on every plan, after 50 free. Machine-to-machine token requests cost $0.00225 each. Identity pools are free.

### Multi-Region replication

On Essentials or Plus, **multi-Region replication** adds one replica of a user pool in a second Region, sharing the pool ID and the user directory, at extra cost. It needs a multi-Region KMS key. The primary Region stays the only place users can be created, reset passwords, or change profiles. The replica handles sign-in and token refresh when a Route 53 health check fails the pool's domain over to it, but authenticator-app MFA doesn't work there. It's disaster recovery for sign-in, not an active-active directory.

---

## Identity Pools

An identity pool gives each user a stable **identity ID** and exchanges their token for temporary credentials from an IAM role. It accepts tokens from a user pool, from social and OIDC providers directly, from SAML providers, and from your own backend through **developer-authenticated identities**. It can also issue credentials to **guest** users who haven't signed in at all, through a separate unauthenticated role.

The pool decides which role a user gets in one of three ways:

- A **default role** for all authenticated users.
- **Rules** that map claims in the user's token to roles, such as giving users whose `custom:plan` claim is `premium` a role with more access. A rule should only use claims the user can't set, so the app client needs read-only access to `custom:plan`. Otherwise any user can write the value and take the role.
- The **`cognito:preferred_role` claim** in a user pool token, which comes from the user's groups. Each user pool group can name an IAM role, and the role of the group with the highest precedence wins.

**Attributes for access control** copy token claims into **session tags**, key-value pairs attached to the temporary credentials. An IAM policy can then use those tags as conditions, such as allowing access only to S3 objects under a prefix matching the user's `sub` or tenant ID. One role and one policy then serve every user, each limited to their own data.

The roles' **trust policies**, which say who may assume each role, are part of the security boundary. Each must trust `cognito-identity.amazonaws.com` only for your identity pool, with a condition that `cognito-identity.amazonaws.com:aud` equals the pool's ID, and the authenticated role only for signed-in users, with a condition that `cognito-identity.amazonaws.com:amr` includes `authenticated`. The guest role, if enabled, should allow only what an anonymous user may do.

---

## Putting Cognito in Front of an API

An API can verify Cognito tokens itself, as in the example above, or leave it to the service in front of it:

- **API Gateway** checks Cognito tokens before a request reaches the backend. REST APIs use a Cognito user pool authorizer and HTTP APIs use a JWT authorizer, and both can require scopes.
- An **Application Load Balancer** can verify a bearer token with its `jwt-validation` listener action, checking the signature, issuer, expiry, and up to ten more claims, which suits machine-to-machine calls. It can also run a browser sign-in itself with its `authenticate-cognito` action, redirecting users to managed login, keeping the session in a cookie, and passing user claims to the targets in headers. That suits server-rendered web applications with no sign-in code of their own.
- **AppSync** accepts user pool tokens for GraphQL APIs.

Verifying in the gateway keeps unauthenticated traffic away from the backend, but the backend still needs the user's identity and should still check the scopes and claims its own authorization depends on.

---

## Multi-Tenant Applications

A software-as-a-service application serving many customer organizations has to decide how tenants map onto Cognito resources:

| Approach | Isolation | Trade-off |
| --- | --- | --- |
| **User pool per tenant** | Strongest. Each tenant has its own users, settings, identity providers, and feature plan | Pool management at scale, a default quota of 1,000 pools per Region, and a way to route users to their pool |
| **App client per tenant** | Per-tenant identity providers and settings in a shared pool, up to 1,000 app clients by default | Users are shared, and a managed login session signs a local user in to every app client in the pool |
| **Group or custom attribute per tenant** | Tenant carried as a claim in a shared pool | Simplest, but every tenant shares one configuration, and your authorization code must enforce the tenant boundary |

Whatever the choice, the tenant ID should reach the application in a claim the user can't change. That means a custom attribute that app clients can only read, set when an administrator creates the user, or a claim added by the pre token generation trigger. Cognito's request-rate quotas are per account and Region and shared by all tenants in it.

---

## Common Pitfalls

- **Migration depends on passwords.** When the schema has to change, the migrate user trigger moves users into a new pool as they sign in, but only if it can verify their passwords against the old directory. Users who never sign in during the migration have to reset their passwords.
- **Custom scopes missing from tokens.** An API that requires `orders/read` rejects every user who signed in through the application's own UI, because API sign-in tokens carry only the self-service scope. Sign in through the OAuth endpoints or add scopes in pre token generation.
- **Writable claims used for authorization.** App clients can write every attribute by default. A role rule, tenant check, or IAM condition that relies on a custom attribute the user can write is one API call from being bypassed. Give app clients read-only access to any attribute used for authorization.
- **Default email in production.** The pool's built-in email sending has a low daily limit meant for testing. Production pools need Amazon SES configured, and email MFA and one-time codes require it.
- **Throttling at scale.** User pool API requests are limited per account and Region by category, such as sign-in operations. A large launch or a client that refreshes tokens too often can hit the limit, and extra capacity can be bought in advance.

---

## When Cognito Fits

Cognito fits applications on AWS that need customer sign-in, and it integrates most closely with the rest of AWS. API Gateway, Application Load Balancers, and AppSync verify its tokens natively, and its feature plans start with a free tier of 10,000 monthly users that doesn't expire. Identity pools add what direct STS web identity federation doesn't: guest access, one stable identity per user across providers, and rule-based role selection.

Weigh its limits before committing. The pool's sign-in schema is fixed at creation, managed login customization stops at branding and styles, a pool lives in one Region with at most one failover replica, and custom logic runs in triggers with a five-second limit. Teams that need more choose a dedicated identity product as their identity provider and, where clients need AWS credentials, federate it into an identity pool. For workforce identity, where employees sign in to AWS accounts and business applications, use IAM Identity Center rather than Cognito.

---

## Key Takeaways

- A user pool signs users in and issues tokens. An identity pool trades a token for temporary AWS credentials. Many applications need only the user pool.
- Plan the user pool's sign-in identifiers and required attributes before launch, because they can't change later. Identify users by `sub`.
- Authorize APIs with the access token and its scopes, and verify the signature, issuer, expiration, `token_use`, and client ID on every request. Custom scopes need OAuth sign-in or a pre token generation trigger.
- A verified access token stays valid until it expires, even after sign-out, so its lifetime bounds how long a revoked session works. Refresh token rotation needs the `GetTokensFromRefreshToken` operation.
- Lambda triggers customize every stage of sign-up and sign-in, within a five-second limit.
- The Essentials plan, the default, adds managed login, passkeys, and access token customization. Plus adds threat protection.
- Base authorization only on claims users can't write, and in identity pools, scope the role trust policies to your pool and to authenticated users.
