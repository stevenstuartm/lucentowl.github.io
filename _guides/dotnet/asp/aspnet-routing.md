---
title: "Routing"
layout: guide
category: "ASP.NET Core"
subcategory: "ASP.NET Fundamentals"
description: "Comprehensive guide to routing in ASP.NET Core APIs, covering endpoint architecture, route templates, constraints, precedence, link generation, and diagnostics."
tags: [asp-net-core, routing, endpoint-routing, url-generation, minimal-api, mvc, api-design]
---

## Understanding Endpoint Routing

Routing sits at the heart of every ASP.NET Core application. The routing system determines which code handles each incoming request by analyzing the URL path, HTTP method, headers, and other request characteristics. Unlike older ASP.NET routing that coupled matching and execution, endpoint routing separates these concerns into distinct middleware components that provide precise control over how requests flow through the pipeline.

Endpoints represent units of executable request-handling code. Each endpoint contains a delegate that processes the request and produces a response, along with metadata that describes requirements like authorization policies, rate limiting rules, and CORS settings. The routing system matches requests to endpoints, then the endpoint middleware executes the selected endpoint's delegate.

## Endpoint Routing Architecture

The routing system splits into two middleware components that work together to match and execute endpoints. This separation enables powerful scenarios like conditional middleware execution, early termination for specific routes, and fine-grained control over the request processing pipeline.

The `UseRouting` middleware performs route matching. It examines the incoming request, compares it against all registered route templates, and selects the best matching endpoint based on the URL path, HTTP method, and any specified constraints. This middleware assigns the selected endpoint to the HttpContext so downstream middleware can inspect it.

The `UseEndpoints` middleware executes the selected endpoint. After authorization, CORS, rate limiting, and other middleware have run, the endpoint middleware invokes the delegate associated with the matched endpoint. This separation allows middleware to make decisions based on which endpoint was matched without actually executing it yet.

Between these two middleware, you can place conditional logic that inspects the matched endpoint's metadata and decides whether to continue processing or short-circuit the pipeline. Authorization middleware uses this pattern to check whether the matched endpoint requires authentication before executing it.

### Short-Circuit Routing

Starting in .NET 8, endpoints can execute immediately in the routing middleware instead of waiting for the endpoint middleware. Short-circuit routing bypasses the authorization, CORS, and other middleware that normally runs between route matching and endpoint execution. This optimization reduces latency for endpoints that don't require those middleware components.

Short-circuit endpoints prove useful for health checks, metrics endpoints, and other infrastructure routes that need minimal overhead. However, they should not be used for endpoints requiring authorization, CORS, rate limiting, or other middleware-based features since those middleware will never run.

## Route Templates

Route templates define patterns that match URL paths to endpoints. Templates can contain literal segments, parameters, optional parameters, and catch-all parameters that capture varying portions of the URL.

Literals in route templates must match exactly. The template `api/products` only matches requests to that exact path. Casing depends on your route configuration; by default, route matching is case-insensitive but can be configured to require exact case matches.

Parameters appear within curly braces and capture segments of the URL. The template `api/products/{id}` matches any single-segment path like `api/products/42` or `api/products/laptop-123`, capturing the value into a route parameter named `id`.

Optional parameters use a question mark suffix and match whether the segment is present or not. The template `api/products/{category?}` matches both `api/products` and `api/products/electronics`. When the optional segment is missing, the parameter value is null.

Catch-all parameters use an asterisk prefix and capture all remaining segments including slashes. The template `files/{*filepath}` matches `files/images/photo.jpg`, capturing `images/photo.jpg` as the `filepath` parameter. This pattern is useful for serving static files or handling hierarchical paths.

### Default Values and Constraints

Route parameters can specify default values that apply when the segment is missing. The template `api/products/{category=all}` provides a default value of "all" when no category is specified. Default values differ from optional parameters because they guarantee the parameter has a value.

Inline constraints restrict which values match the parameter. Constraints appear after a colon following the parameter name. The template `api/products/{id:int}` only matches when the id segment can be parsed as an integer. If the segment isn't a valid integer, the route doesn't match and routing continues checking other routes.

Multiple constraints can be chained with additional colons. The template `api/products/{id:int:min(1)}` requires an integer greater than or equal to 1. Constraints run in the order specified and all must pass for the route to match.

## Route Constraints

Constraints validate route parameters before a route is considered a match. They prevent incorrect matches and help disambiguate between similar routes. However, constraints should not be used for input validation; they exist to select the correct route, not to validate business rules.

When a constraint fails, routing continues checking other routes. If multiple routes could match the URL but have different constraints, the first route with satisfied constraints wins. This behavior enables patterns like having separate endpoints for integer IDs versus string slugs.

### Type Constraints

Type constraints verify that a parameter can be converted to a specific type. Common type constraints include `int`, `long`, `guid`, `bool`, `decimal`, `double`, and `float`. The `datetime` constraint matches date and time values that can be parsed by the invariant culture.

The `alpha` constraint requires alphabetic characters only, while `alphanumeric` allows letters and digits. These constraints are useful for slug-based routes where you want to ensure clean URL segments.

### Range and Length Constraints

Range constraints limit numeric values. The `min(value)` constraint requires the parameter to be at least the specified value, while `max(value)` sets an upper bound. The `range(min, max)` constraint combines both checks.

Length constraints work with string parameters. The `minlength(length)` and `maxlength(length)` constraints enforce minimum and maximum string lengths. The `length(min, max)` constraint combines both checks in a single constraint.

### Pattern Constraints

The `regex(expression)` constraint matches parameters against a regular expression. This powerful constraint enables complex validation patterns but should be used carefully since complex expressions can impact routing performance.

For example, `{action:regex(^(list|get|create)$)}` only matches when the action parameter is exactly "list", "get", or "create". The regex must match the entire parameter value, not just part of it.

### Custom Constraints

Custom constraints implement the `IRouteConstraint` interface and provide the `Match` method that determines whether a value satisfies the constraint. Custom constraints enable domain-specific validation logic that goes beyond the built-in constraints.

Constraints are registered in the routing configuration using a unique name. Once registered, they can be used inline in route templates like any built-in constraint. Custom constraints commonly validate against application-specific rules like checking whether an ID exists in a database or whether a value matches a configured pattern.

## Route Precedence and Matching

When multiple routes could match a request, the routing system uses precedence rules to select the best match. Route precedence is computed based on specificity, with more specific routes given higher priority.

Literal segments have the highest precedence. A route with more literal segments will match before one with parameters in those positions. For example, `api/products/new` matches before `api/products/{id}` when the request is for `api/products/new`.

Constrained parameters have higher precedence than unconstrained parameters. A route with `{id:int}` matches before `{id}` when the segment is a valid integer. This allows you to have separate endpoints for different parameter types without explicit ordering.

Optional and catch-all parameters have the lowest precedence. Routes with required parameters match before routes with optional parameters. This ensures that more specific routes take priority over general fallback routes.

When precedence rules don't determine a clear winner, the routing system throws an `AmbiguousMatchException`. This exception indicates that multiple routes match equally well and you need to either add constraints to disambiguate them or use explicit route ordering.

### Route Order

The `Order` property on route attributes provides explicit control over route precedence. Lower order values have higher priority. When two routes match and have different order values, the route with the lower order wins.

By default, all routes have an order of 0. Setting explicit order values allows you to override the normal precedence rules when needed. However, relying too heavily on explicit ordering can make routing logic difficult to understand; constraints and careful route design usually provide better solutions.

## Link Generation

Generating URLs to endpoints is as important as routing requests to them. Link generation ensures that URLs stay consistent throughout the application and can adapt if route templates change. Instead of hardcoding URLs, you generate them based on endpoint names or route values.

The `LinkGenerator` service provides the primary API for generating URLs. This service is registered as a singleton and can be injected into any class, making it more flexible than the older `IUrlHelper` which requires controller context.

### Using LinkGenerator

The `GetPathByAction` method generates a path to a controller action by name. You provide the controller name, action name, and any route values needed to fill the template parameters. The result is a path like `/api/products/42` that you can use in responses or headers.

The `GetUriByAction` method works similarly but produces an absolute URI including the scheme and host. This method is useful when you need to return full URLs in API responses, such as Location headers after creating a resource.

For minimal APIs, the `GetPathByName` and `GetUriByName` methods generate URLs to named endpoints. Endpoints are named using the `WithName` method when mapping routes. Named endpoints provide stable references that don't depend on implementation details like action method names.

### Route Values and Ambient Values

Route values are the parameters you explicitly provide when generating a link. If you're generating a URL to an endpoint with an `{id}` parameter, you pass the id as a route value.

Ambient values come from the current request's route data. When generating links from within a controller action, the current controller and action are ambient values. Link generation can reuse these values unless you explicitly override them, which simplifies generating links to actions in the same controller.

The link generator merges ambient values and explicit route values to fill the template parameters. If a required parameter isn't found in either source, link generation returns null indicating that no route could satisfy the requirements.

### IUrlHelper in Controllers

Controller-based APIs can use `IUrlHelper` for link generation. This helper is available through the `Url` property on controller base classes. The `Action` method generates a URL to another action, while the `RouteUrl` method generates a URL by route name.

`IUrlHelper` automatically uses the current request's ambient values, making it convenient for generating links within the same area or controller. However, `LinkGenerator` is generally preferred for new code because it doesn't require controller context and can be used in services, middleware, and other non-controller components.

## Area Routing

Areas partition large applications into separate functional groups, each with its own set of controllers, views, and models. Areas create a hierarchy for routing by adding an `area` route parameter that sits above the controller and action.

The route template for areas typically looks like `{area}/{controller}/{action}/{id?}`. This structure allows the routing middleware to identify the area from the URL first, then the specific controller within that area, and finally the action method to execute.

Controller classes opt into an area using the `[Area("AreaName")]` attribute. This attribute adds metadata that the routing system uses to match requests. Routes can also require a specific area using constraints, ensuring that a route only matches when the area segment has the expected value.

Areas prove valuable in large APIs where you want to organize controllers by functional domain. For example, an e-commerce API might have separate areas for catalog, orders, customers, and administration. Each area contains the controllers relevant to that domain, improving code organization and navigation.

Link generation with areas requires passing the area as a route value. When generating a link to an action in a different area, you must explicitly specify the area name. This ensures that the generated URL includes the correct area segment.

## Route Groups in Minimal APIs

Minimal APIs use the `MapGroup` method to organize related endpoints under a common route prefix and configuration. Route groups reduce repetitive code and allow applying middleware, metadata, and filters to entire groups of endpoints with a single method call.

Creating a group starts with calling `MapGroup` on the `WebApplication` and providing a route prefix. All endpoints added to the group inherit this prefix. For example, a group with prefix `/api/products` makes all its endpoints appear under that path.

Groups can apply shared configuration using methods like `RequireAuthorization`, `WithMetadata`, `AddEndpointFilter`, and `WithOpenApi`. These methods apply to every endpoint in the group, eliminating the need to repeat the same configuration on each individual endpoint.

Nested groups provide deeper organization. You can create a group for `/api`, then create subgroups for `/products` and `/orders` within it. Each level of nesting adds its prefix and configuration to the endpoints below it.

Empty prefix groups serve a special purpose: applying configuration without changing routes. An empty group like `MapGroup("")` allows you to attach metadata or filters to a collection of endpoints while keeping their original paths. This pattern is useful when you want to apply authorization or OpenAPI configuration to multiple endpoints that don't share a common prefix.

## Host and Port Matching

Routes can restrict matches based on the request's host header or port. Host matching enables scenarios where different endpoints handle requests to different domains, even when running on the same server.

The `RequireHost` method constrains a route to specific hosts. You can specify exact hosts like `api.example.com` or use wildcards like `*.example.com` to match any subdomain. Multiple host patterns can be provided, and the route matches if any pattern matches.

Port matching works similarly through route constraints. You can specify that a route only matches requests to a particular port, which is useful when running development and production endpoints on the same application instance but different ports.

Host-based routing should be used carefully in production environments. The host header can be spoofed by clients, so don't rely on it for security decisions. Use host matching for convenience and organization, but enforce security through authentication and authorization middleware.

## Endpoint Metadata and Filters

Endpoints carry metadata that describes their requirements and characteristics. Metadata includes authorization policies, CORS settings, rate limiting rules, content type restrictions, and custom data that middleware and filters can inspect.

Methods like `RequireAuthorization` and `RequireCors` add metadata to endpoints. These methods don't directly enforce the requirements; instead, they attach metadata that the corresponding middleware reads and enforces. This separation allows middleware to make decisions based on what the endpoint requires.

Custom metadata can be added using `WithMetadata`. Any object can be attached as metadata, making it available to middleware, filters, and other components that process the request. Custom metadata enables application-specific logic like feature flags, API versioning schemes, or permission requirements.

Endpoint filters provide lightweight hooks for processing requests before and after endpoint execution. Filters can inspect and modify the arguments passed to an endpoint, short-circuit execution by returning a result directly, or handle exceptions. Filters are simpler than middleware for endpoint-specific logic since they only run for the matched endpoint.

Filters are added to individual endpoints or entire route groups using `AddEndpointFilter`. The filter receives the endpoint context and a next delegate, allowing it to run code before and after the endpoint executes. Filters can be async and support dependency injection, making them powerful tools for cross-cutting concerns.

## Route Debugging and Diagnostics

Understanding which route matched a request is critical when debugging routing issues. Several techniques help diagnose routing problems and understand how requests flow through the routing system.

Built-in metrics track routing operations. The `Microsoft.AspNetCore.Routing` meter reports metrics about route matching attempts and results. These metrics show how many requests matched endpoints versus how many failed to match, helping identify configuration issues.

Middleware between `UseRouting` and `UseEndpoints` can inspect the matched endpoint. The `HttpContext.GetEndpoint()` method returns the endpoint selected by routing, including its route pattern and metadata. This inspection point is useful for logging which endpoint will handle each request.

Route debugger tools can be integrated into applications to visualize all registered routes. These tools typically render a page showing every route template, the controller or handler it maps to, and any constraints or metadata. Comparing the registered routes against failing requests often reveals missing templates or incorrect constraints.

Logging from the routing infrastructure provides detailed information about the matching process. Enabling debug-level logs for the `Microsoft.AspNetCore.Routing` namespace shows which routes were considered, which constraints passed or failed, and why specific routes were selected or rejected.

Common routing failures stem from incorrect constraints, missing route values, or ambiguous matches. When a request returns 404, verify that a route template matches the URL structure. When seeing ambiguous match exceptions, examine the competing routes and add constraints or explicit ordering to disambiguate them.

## Minimal API vs Controller Routing

Minimal APIs and controller-based APIs use the same underlying routing system but configure routes differently. Understanding these differences helps you choose the right approach and mix both styles when appropriate.

Minimal APIs define routes inline using methods like `MapGet`, `MapPost`, and `MapGroup` directly on the `WebApplication`. Each endpoint is registered with an explicit route template and handler delegate. This approach provides maximum flexibility and makes the route structure visible at a glance.

Controller-based APIs use attribute routing with `[Route]`, `[HttpGet]`, and similar attributes on controller classes and action methods. The routing system discovers these attributes through reflection and builds the route table automatically. This approach scales well for APIs with many endpoints organized into controllers.

Combining both styles in the same application is fully supported. You can use controllers for CRUD operations on domain entities while using minimal APIs for health checks, metrics, or simple utility endpoints. The routing system treats all endpoints uniformly regardless of whether they came from controllers or minimal API methods.

Route precedence works identically for both styles. A minimal API route and a controller route can both match the same URL pattern, and the normal precedence rules determine which one wins. Constraints, order values, and specificity all apply consistently across both programming models.

## Common Routing Patterns

Several routing patterns appear frequently in well-designed APIs. These patterns solve common organizational and technical challenges while keeping routes clean and maintainable.

Versioning through route prefixes places the API version in the URL like `/api/v1/products` and `/api/v2/products`. Route groups or area routing naturally support this pattern by applying version-specific prefixes to groups of endpoints. This explicit versioning makes it clear which version of the API a client is using.

Resource-oriented routes follow REST conventions with patterns like `/api/products/{id}` for single resources and `/api/products` for collections. The HTTP method determines the operation, with GET for retrieval, POST for creation, PUT for updates, and DELETE for removal. This pattern keeps URLs clean and predictable.

Hierarchical resources use nested paths like `/api/orders/{orderId}/items/{itemId}` to represent relationships. These routes express that items belong to orders, making the API structure self-documenting. However, deeply nested routes can become unwieldy; limiting nesting to two or three levels keeps URLs manageable.

Action-based routes include the operation in the path like `/api/products/search` or `/api/orders/{id}/cancel`. These routes work well for operations that don't fit cleanly into CRUD patterns. While less RESTful, they often provide clearer intent than trying to force operations into standard HTTP methods.

## Performance Considerations

Routing performance matters in high-throughput APIs. While the routing system is highly optimized, certain patterns and configurations can impact performance.

Route constraints execute for every potential match. Complex regex constraints can slow down routing, especially when many routes need to be evaluated. Using simpler constraints like type checks instead of regex when possible keeps routing fast.

The number of routes affects matching time, though the routing system uses optimizations like tries to minimize this impact. Applications with thousands of routes should consider route organization and precedence to ensure commonly accessed endpoints match early in the evaluation process.

Link generation performance depends on the number of route values and the complexity of the templates being filled. Generating URLs happens frequently in APIs that return hypermedia, so caching generated URLs or route patterns can improve performance.

Short-circuit routing provides measurable performance improvements for endpoints that don't need authorization or CORS middleware. Health checks and metrics endpoints are excellent candidates for short-circuiting since they bypass middleware that would just allow the request through anyway.

## Red Flags

Certain routing configurations indicate potential problems that can cause runtime errors, maintenance difficulties, or poor performance.

Ambiguous routes that throw `AmbiguousMatchException` indicate insufficient disambiguation. When two routes match equally well, add constraints or order values to establish clear precedence. Relying on route registration order without explicit configuration makes the routing logic fragile.

Using route constraints for input validation leads to poor error handling. When a constraint fails, routing returns 404 Not Found instead of 400 Bad Request with validation details. Validate input in endpoint handlers or filters where you can provide meaningful error messages.

Hardcoded URLs scattered throughout the application make routes difficult to change. Always use link generation to produce URLs to other endpoints. When route templates change, link generation adapts automatically while hardcoded URLs break.

Overly complex route templates with many optional parameters and defaults become difficult to understand and maintain. If a single route template handles too many URL variations, consider splitting it into multiple simpler routes that are easier to reason about.

Missing host validation when using `RequireHost` creates security risks. The host header can be spoofed, so don't make security decisions based solely on host matching. Use it for convenience but enforce authorization through proper authentication and authorization middleware.

Deeply nested areas or route groups create long URLs that are hard to type and remember. Flat or minimally nested structures usually provide better usability. If you need deep nesting for organization, consider whether your domain model is too complex or whether the API structure needs simplification.
