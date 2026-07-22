---
title: "Azure Bicep: Fundamentals"
layout: guide
category: Azure
subcategory: Infrastructure as Code
description: "Core concepts of Azure Bicep, Azure's first-party infrastructure as code language that transpiles to ARM templates, covering resource declarations, parameters, modules, scopes, deployment modes, deployment stacks, and what-if."
tags: [bicep, arm-templates, infrastructure-as-code, bicep-modules, deployment-stacks, what-if, fundamentals]
---

## What Is Azure Bicep

[Azure Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview){:target="_blank" rel="noopener noreferrer"} is Microsoft's first-party infrastructure as code language designed to improve the experience of deploying Azure resources. Bicep files are human-readable text files that define Azure infrastructure, and they compile down to Azure Resource Manager (ARM) templates in JSON format.

The language exists because raw ARM JSON templates are verbose, difficult to read, and error-prone. Bicep removes the noise while maintaining complete access to every Azure Resource Manager feature.

### What Problems Bicep Solves

**Without Bicep (using ARM JSON directly):**
- Templates are verbose and difficult to read; a simple VNet definition requires nested objects and quotes
- No automatic dependency resolution between resources; you must explicitly specify `dependsOn` even when the relationship is obvious
- Parameter handling is cumbersome with separate definitions and no type validation
- Reusing code across templates requires copy-pasting or complex linked templates
- No support for built-in functions without awkward JSON syntax
- Tooling support is limited; IDE integration is poor

**With Bicep:**
- Syntax is concise and readable; VNet definitions look like configuration, not JSON
- Dependencies are inferred from resource references automatically
- Parameters support full type validation with default values and constraints
- Modules break templates into reusable, composable pieces
- Rich set of built-in functions with intuitive syntax
- Visual Studio Code and Visual Studio provide excellent intellisense and validation

### Why Bicep Over Other Options

Architects evaluating infrastructure as code on Azure should understand Bicep's position relative to alternatives.

**Bicep vs ARM JSON:**
- Bicep is the preferred authoring experience for Azure-native projects. Because it compiles to ARM JSON, it has same-day support for anything ARM supports, with no provider release to wait for
- ARM JSON is still valid but is the lower-level representation. Write it only if you already have templates or need something the Bicep compiler does not yet surface

**Bicep vs Terraform:**
- Bicep is Azure-specific with deeper Azure Resource Manager integration and no lag behind new resource types
- Terraform is cloud-agnostic and works across AWS, Azure, Google Cloud, and others
- Terraform maintains its own state file; Bicep has no state, and Azure Resource Manager is the source of truth. That difference shapes drift handling more than syntax does
- Choose Bicep if your organization is Azure-only; choose Terraform if you manage multi-cloud infrastructure

**Bicep vs ARM templates + PowerShell:**
- Bicep replaces the need to write PowerShell wrapper scripts; it handles parameterization and modular deployment natively

---

## How Bicep Works

### The Bicep Workflow

1. **Write** a `.bicep` file with your infrastructure definition
2. **Lint** against the Bicep linter's rules, configured in `bicepconfig.json`
3. **Build** (automatic during deployment) to transpile the `.bicep` file to ARM JSON
4. **Preview** with what-if to see what would change
5. **Deploy** the compiled ARM template to Azure

Behind the scenes, Bicep transpiles to ARM JSON, which Azure Resource Manager then processes. You never manually touch the compiled JSON, and it exists only as an intermediate artifact before deployment.

```
  main.bicep  ──┐
  modules/*.bicep│   bicepconfig.json
  main.bicepparam│         │ linter rules
                 ▼         ▼
            ┌──────────────────────┐
            │  Bicep compiler      │  errors and lint
            │  (bicep build/lint)  │──► warnings here,
            └──────────┬───────────┘    before any API call
                       │ ARM JSON
                       ▼
            ┌──────────────────────┐
            │ Azure Resource       │
            │ Manager: preflight   │──► what-if preview
            └──────────┬───────────┘    (no changes made)
                       │
                       ▼
            ┌──────────────────────┐
            │ Deployment           │  mode: incremental
            │ (or deployment stack)│  or a stack with
            └──────────┬───────────┘  deny settings
                       ▼
                Azure resources

  Three separate places catch mistakes. Type errors and lint
  violations never reach Azure; preflight catches quota and
  naming problems; what-if catches unintended drift.
```

Two of those stages are frequently skipped and shouldn't be. **The Bicep linter** runs automatically in VS Code and via `bicep lint`, and its rules are configured per-repo in `bicepconfig.json`, where you can raise a rule from warning to error or disable one. **What-if** is covered [below](#what-if-deployments) and is the only stage that compares your template against what is actually deployed.

### Bicep vs Its Compiled Output

A Bicep file:
```bicep
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'myVnet'
  location: 'eastus'
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
  }
}
```

Compiles to ARM JSON:
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.Network/virtualNetworks",
      "apiVersion": "2023-09-01",
      "name": "myVnet",
      "location": "eastus",
      "properties": {
        "addressSpace": {
          "addressPrefixes": [
            "10.0.0.0/16"
          ]
        }
      }
    }
  ]
}
```

Notice the reduction in verbosity and nesting. Bicep handles the boilerplate JSON structure automatically.

---

## Core Language Constructs

### Resources

A resource declaration defines an Azure resource that Bicep will deploy.

**Syntax:**
```bicep
resource <symbolic-name> '<resource-type>@<api-version>' = {
  name: '<resource-name>'
  location: '<azure-region>'
  properties: {
    // Resource-specific properties
  }
}
```

**Example:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mystgaccount'
  location: 'eastus'
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
  }
}
```

Each resource has:
- **Symbolic name** (`storageAccount` above): used to reference the resource elsewhere in the template
- **Resource type** (`Microsoft.Storage/storageAccounts`): the Azure resource type identifier
- **API version** (`2023-01-01`): the version of the Azure API for this resource type; different versions support different properties
- **Properties**: the configuration specific to that resource

### Parameters

Parameters allow templates to accept input values at deployment time, enabling templates to be reusable across environments.

**Syntax:**
```bicep
param parameterName parameterType = defaultValue
```

**Example:**
```bicep
param location string = 'eastus'
param environment string = 'dev'
param vmCount int = 2
param tags object = {
  project: 'myapp'
  owner: 'teamA'
}
```

Parameters can have decorators that add metadata or constraints:
```bicep
@description('Azure region where resources will be deployed')
@minLength(1)
@maxLength(100)
param location string = 'eastus'

@description('Environment name')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string

@description('Number of VMs to create')
@minValue(1)
@maxValue(100)
param vmCount int = 2
```

Using parameters:
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mysa${environment}'  // References parameter
  location: location           // References parameter
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
}
```

#### Secure Parameters

Mark any parameter carrying a secret with `@secure()`. It applies to `string` and `object` types, and it keeps the value out of the deployment history and out of logs.

```bicep
@secure()
@description('Administrator password for the SQL server')
param adminPassword string

@secure()
param connectionSettings object
```

A secure parameter has no default value and cannot be logged, but it is not encrypted in transit to whatever you pass it to. It also cannot be referenced in an output, which the linter enforces.

#### Parameter Files

Passing values inline with `--parameters key=value` works for a couple of values and stops scaling quickly. The native mechanism is a **`.bicepparam` file**, written in Bicep rather than JSON, so it gets type checking and IntelliSense against the template it targets.

**main.dev.bicepparam:**
```bicep
using './main.bicep'

var namePrefix = 'contoso'

param environment = 'dev'
param location = 'eastus'
param storageAccountName = '${namePrefix}devstore'
```

Deploy it without naming the template separately, because the `using` statement already points at it:

```bash
az deployment group create \
  --resource-group myresourcegroup \
  --parameters main.dev.bicepparam
```

One parameter file per environment is the usual arrangement. Parameter files store values as **plain text**, so never put a secret in one. For a secret, pull it from Key Vault at deployment time with `getSecret`, which passes the value directly to a secure module parameter without it ever appearing in the parameter file or the deployment history:

```bicep
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'myKeyVault'
  scope: resourceGroup('security-rg')
}

module sqlServer 'sql.bicep' = {
  name: 'sqlDeployment'
  params: {
    adminPassword: kv.getSecret('sqlAdminPassword')
  }
}
```

### Variables

Variables store values computed or transformed from parameters and resource properties. Unlike parameters, variables cannot be changed at deployment time.

**Syntax:**
```bicep
var variableName = expression
```

**Example:**
```bicep
var environment = 'prod'
var location = 'eastus'
var resourceNamePrefix = '${environment}-${location}'
var vnetAddressPrefix = '10.0.0.0/16'
var subnetAddressPrefix = '10.0.1.0/24'

var storageAccountName = '${resourceNamePrefix}sa${uniqueString(resourceGroup().id)}'
```

Variables are useful for:
- Computing derived values (like unique names based on resource group ID)
- Reducing duplication across the template
- Creating reusable expressions for multiple resources

### Outputs

Outputs expose values from deployed resources to the caller, typically for consumption by other systems or for display to users.

**Syntax:**
```bicep
output outputName outputType = value
```

**Example:**
```bicep
output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output primaryBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output vnetId string = vnet.id
```

Outputs appear in the deployment response and can be queried after deployment:
```bash
az deployment group show --name mydeployment --resource-group myresourcegroup --query properties.outputs
```

**Outputs are stored in the deployment history, so never put a secret in one.** Anyone with read access to the resource group can read deployment outputs, which is often a wider audience than the people entitled to the secret itself. Bicep's `outputs-should-not-contain-secrets` linter rule catches the common cases: referencing a `@secure()` parameter, calling any `list*` function such as `listKeys()`, or naming an output something like `adminPassword`.

There is **no secure-output decorator**. `@secure()` applies to parameters only, and the fix is structural rather than a keyword:

```bicep
// Don't: bakes the account key into the deployment history
output connectionString string = 'AccountKey=${storageAccount.listKeys().keys[0].value}'

// Do: output the identifier, and let the consumer fetch the secret
output storageAccountId string = storageAccount.id
```

The consumer retrieves the secret itself at the point of use, or reads it from Key Vault. Better still, use a managed identity and skip the key entirely.

---

## Type System and Data Types

Bicep enforces type checking at validation time, catching errors before deployment.

**Primitive types:**
- `string`: Text values
- `int`: Integer numbers
- `bool`: Boolean true/false
- `object`: Key-value pairs (like JSON objects)
- `array`: Ordered list of values

**Examples:**
```bicep
param location string = 'eastus'
param vmCount int = 3
param enableDiagnostics bool = true

param tags object = {
  environment: 'prod'
  owner: 'teamA'
}

param subnets array = [
  'frontend'
  'backend'
  'data'
]
```

**Complex types:**
You can define custom types using `@export` decorator for module reuse:
```bicep
@export()
type storageConfig = {
  accountName: string
  kind: string
  skuName: string
  accessTier: string
}

param storageSettings storageConfig = {
  accountName: 'mystg'
  kind: 'StorageV2'
  skuName: 'Standard_LRS'
  accessTier: 'Hot'
}
```

---

## Expressions and Built-in Functions

Bicep provides a rich set of built-in functions for common operations.

**String functions:**
```bicep
var lowered = toLower('EXAMPLE')                 // 'example'
var padded = padLeft('123', 5, '0')              // '00123'
var replaced = replace('hello-world', '-', '_')  // 'hello_world'
var prefix = substring('hello', 0, 3)            // 'hel'
```

**Array and object functions:**
```bicep
var items = [
  'a'
  'b'
  'c'
]
var itemCount = length(items)              // 3
var joined = join(items, '-')              // 'a-b-c'
var hasB = contains(items, 'b')            // true

var config = {
  name: 'app'
  port: 8080
}
var hasKey = contains(config, 'name')      // true
```

Give symbols names that differ from built-in functions. A variable called `length` or `substring` shadows the function of the same name and produces a confusing compile error rather than the value you expected.

**Resource functions:**
```bicep
// Get resource properties
output accountId string = storageAccount.id
output accountName string = storageAccount.name

// List access keys. Prefer the method form on the symbolic name over
// the standalone listKeys(id, apiVersion) function.
var primaryKey = storageAccount.listKeys().keys[0].value

// Get current scope details
var rgId = resourceGroup().id
var rgName = resourceGroup().name
var subId = subscription().id
```

Anything derived from a `list*` function is a secret. Use it to configure another resource in the same template, never to populate an output.

**Comparison and conditional expressions:**
```bicep
var environment = 'prod'
var isProduction = environment == 'prod'

var tier = isProduction ? 'Premium' : 'Standard'

var vmSize = environment == 'dev' ? 'Standard_B1s' : 'Standard_D2s_v3'
```

**Interpolation:**
```bicep
var location = 'eastus'
var environment = 'prod'
var resourceName = '${environment}-${location}-app'  // 'prod-eastus-app'
```

---

## Resource Dependencies

### Implicit Dependencies

When a resource references another resource, Bicep automatically creates a dependency. Azure Resource Manager will create the referenced resource before the dependent resource.

**Example:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mystgaccount'
  location: 'eastus'
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
}

// The parent property creates an implicit dependency
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'mycontainer'
  properties: {
    publicAccess: 'None'
  }
}
```

Referencing another resource's property does the same thing. `vnet.id` anywhere in a resource body tells Resource Manager to create the VNet first.

#### The Child-Resource Exception That Bites Early

A handful of resource types can be expressed either as a child resource or as a property of the parent, and for those the choice is not stylistic. **Subnets are the one that catches people.** Microsoft's guidance is to define subnets through the `subnets` property on the virtual network, *not* as separate `Microsoft.Network/virtualNetworks/subnets` resources:

```bicep
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'myVnet'
  location: 'eastus'
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'frontend'
        properties: {
          addressPrefix: '10.0.1.0/24'
        }
      }
    ]
  }
}
```

The reason is how incremental deployment treats properties, covered under [deployment modes](#incremental-mode-default): redeploying the VNet reapplies its full property set, and a VNet declared without a `subnets` property is a VNet with no subnets. Subnets defined as separate child resources get removed on the next VNet deployment. The same trap applies to `Microsoft.Web/sites/config` for web apps.

### Explicit Dependencies

When no property reference captures the ordering you need, declare it with `dependsOn`, which takes an array of symbolic names.

```bicep
resource script 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'seedDatabase'
  location: location
  kind: 'AzureCLI'
  properties: {
    azCliVersion: '2.61.0'
    scriptContent: 'az sql db show ...'
    retentionInterval: 'PT1H'
  }
  // The script talks to the firewall rule over the network, so nothing
  // in its body references the rule. State the ordering explicitly.
  dependsOn: [
    sqlFirewallRule
  ]
}
```

Use explicit `dependsOn` when:
- A resource needs another to finish even though no property reference exists between them
- Ordering is enforced by a side effect (a network path, an RBAC assignment, a data-plane operation) rather than by a value

Reach for it sparingly. Every unnecessary `dependsOn` serializes work that Resource Manager would otherwise run in parallel, and the linter flags dependencies it can already infer.

### Referencing Resources You Don't Deploy

The `existing` keyword declares a reference to a resource that some other template or process created. Nothing is deployed, and you get a typed handle for reading its properties.

```bicep
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'sharedKeyVault'
  scope: resourceGroup('platform-rg')   // optional: another resource group
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: 'sharedWorkspace'
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: storageAccount
  name: 'sendToLogAnalytics'
  properties: {
    workspaceId: logAnalytics.id
    logs: []
  }
}
```

This is how templates compose across ownership boundaries: a platform team owns the workspace and the vault, and an application template consumes them without redeclaring or accidentally reconfiguring them.

### Loops and Conditions on Resources

Modules are not the only thing that can loop or deploy conditionally. Both apply to resources directly.

```bicep
param subnetNames array = [
  'frontend'
  'backend'
]
param deployBastion bool = false

// Loop: one NSG per name, with the index available if needed
resource nsgs 'Microsoft.Network/networkSecurityGroups@2023-09-01' = [for (name, i) in subnetNames: {
  name: 'nsg-${name}'
  location: location
}]

// Condition: deployed only when the flag is true
resource bastion 'Microsoft.Network/bastionHosts@2023-09-01' = if (deployBastion) {
  name: 'myBastion'
  location: location
  properties: {
    ipConfigurations: []
  }
}
```

A looped resource is referenced by index (`nsgs[0].id`), and the whole collection can be passed around as an array. A conditional resource that evaluates to false still exists as a symbol, so referencing its properties elsewhere yields null rather than a compile error, which is a common source of confusing runtime failures.

---

## Scope and Targeting

Bicep can deploy resources at different scopes in Azure's management hierarchy.

### Resource Group Scope (Default)

Most resources deploy to a specific resource group. This is the default scope.

```bicep
param location string
param resourceGroupName string = resourceGroup().name

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'myVnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
  }
}
```

Deploy with:
```bash
az deployment group create \
  --resource-group myresourcegroup \
  --template-file main.bicep
```

### Subscription Scope

Deploy resources at the subscription level using `targetScope`:

```bicep
targetScope = 'subscription'

param location string
param resourceGroupName string

// Create a resource group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
}

// Create a storage account in that resource group
module storageModule 'storage.bicep' = {
  scope: rg
  name: 'storageDeployment'
  params: {
    location: location
  }
}
```

Deploy with:
```bash
az deployment sub create \
  --location eastus \
  --template-file main.bicep
```

### Management Group Scope

Deploy policies and role assignments across multiple subscriptions:

```bicep
targetScope = 'managementGroup'

param policyName string
param policyDefinitionId string

// Assigned at the management group this deployment targets,
// so it applies to every subscription beneath it.
resource policyAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: policyName
  properties: {
    policyDefinitionId: policyDefinitionId
    enforcementMode: 'Default'
  }
}
```

The assignment's scope comes from `targetScope` and the deployment's target management group. `properties.scope` is read-only on `policyAssignments`, so setting it does nothing. To assign at a different scope, deploy there or use a module with a `scope:` property.

### Tenant Scope

Deploy resources that span the entire tenant, such as management groups and tenant-wide role definitions:

```bicep
targetScope = 'tenant'

param assignableScopeId string

// A custom role definition. assignableScopes is required and
// determines where the role can actually be assigned.
resource customRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid('my-custom-role')
  properties: {
    roleName: 'Custom App Developer'
    description: 'Read and write App Service sites'
    type: 'CustomRole'
    assignableScopes: [
      assignableScopeId
    ]
    permissions: [
      {
        actions: [
          'Microsoft.Web/sites/read'
          'Microsoft.Web/sites/write'
        ]
        notActions: []
      }
    ]
  }
}
```

Tenant-scope deployments need permissions at the tenant root, which most engineers do not have by default. In practice, management group scope covers nearly everything that motivates reaching for tenant scope.

---

## Modules

Modules break Bicep templates into reusable, composable pieces. A module is a Bicep file that other Bicep files reference.

### Creating a Module

**storage.bicep:**
```bicep
param location string
param accountName string
param kind string = 'StorageV2'
param skuName string = 'Standard_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: accountName
  location: location
  kind: kind
  sku: {
    name: skuName
  }
  properties: {
    accessTier: 'Hot'
  }
}

output id string = storageAccount.id
output name string = storageAccount.name
output primaryEndpoint string = storageAccount.properties.primaryBlobEndpoint
```

### Using a Module

**main.bicep:**
```bicep
param location string = 'eastus'
param environment string = 'dev'

module storage 'storage.bicep' = {
  name: 'storageDeployment'
  params: {
    location: location
    accountName: '${environment}storage${uniqueString(resourceGroup().id)}'
    kind: 'StorageV2'
    skuName: 'Standard_LRS'
  }
}

output storageAccountId string = storage.outputs.id
output storageAccountName string = storage.outputs.name
```

### Module Features

**Passing parameters:**
```bicep
module network 'network.bicep' = {
  name: 'networkDeployment'
  params: {
    location: location
    vnetAddressPrefix: '10.0.0.0/16'
    subnets: [
      {
        name: 'frontend'
        addressPrefix: '10.0.1.0/24'
      }
      {
        name: 'backend'
        addressPrefix: '10.0.2.0/24'
      }
    ]
  }
}
```

**Referencing module outputs:**
```bicep
var vnetId = network.outputs.vnetId
var subnetIds = network.outputs.subnetIds
```

**Conditional module deployment:**
```bicep
param deployProduction bool = false

module prodResources 'production.bicep' = if (deployProduction) {
  name: 'productionDeployment'
  params: {
    location: location
  }
}
```

**Looping modules:**
```bicep
param environments array = ['dev', 'staging', 'prod']

module deploy 'app.bicep' = [for env in environments: {
  name: '${env}-deployment'
  params: {
    location: 'eastus'
    environment: env
  }
}]
```

---

## Deployment Modes

Azure Resource Manager supports two deployment modes, and they differ only in how they treat resources that exist in the resource group but are absent from the template.

### Incremental Mode (Default)

In incremental mode, Resource Manager creates or updates the resources in the template and leaves everything else in the resource group alone.

**When to use:**
- Effectively all deployments. Microsoft names incremental the recommended mode
- When the template doesn't represent the entire resource group
- When other systems or teams manage additional resources in the same group

```bash
az deployment group create \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --mode Incremental
```

**"Incremental" describes the resource group, not the resource.** This is the single most common misunderstanding about Bicep and ARM, and it causes real outages. Within a resource that *is* in the template, every property is reapplied from the template, and **any property you omit is reset to its default value.** There is no merge with the resource's current state.

```
  Deployed today          Template says          Result
  ─────────────────       ─────────────────      ─────────────────
  vnet-a                  vnet-a                 vnet-a updated
    subnets: [x, y]         (no subnets prop)      subnets: []  ← gone
    tags: {env, owner}      tags: {env}            tags: {env}  ← owner gone
  storage-b               (absent)               storage-b untouched
```

The resource definition in a template is a statement of the resource's complete final state, not a patch. Specify every non-default value you want, including ones you are not changing.

### Complete Mode

In complete mode, Resource Manager **deletes** resources that exist in the resource group but are not in the template.

**Microsoft now advises against it.** The current guidance on both the incremental and complete mode documentation is to use [deployment stacks](#deployment-stacks) when you need deletions, and it states that complete mode "will be gradually deprecated." Treat complete mode as something you may find in an existing pipeline rather than something to adopt.

```bash
az deployment group create \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --mode Complete
```

If you do encounter it, its behavior has more edges than the one-line description suggests:

- **Resource group scope only.** Subscription-level deployments do not support complete mode, and linked or nested templates must use incremental
- **Locks win.** If the resource group is locked, complete mode deletes nothing
- **Not every child resource is deleted.** A parent absent from the template is deleted along with its children, but a child absent from a template whose parent is present usually survives
- **Copy loops are dangerous.** Anything not produced by the loop after it resolves is deleted
- **Conditional resources are deleted.** With current tooling, a resource whose `condition` evaluates to false is treated as absent and removed
- **The portal cannot do it at all**

Always run what-if before a complete-mode deployment.

---

## Deployment Stacks

A **deployment stack** (`Microsoft.Resources/deploymentStacks`) is an Azure resource that manages a set of resources as one unit. It is the supported answer to the two problems complete mode was reached for: cleaning up resources that left the template, and stopping people from changing what the template owns.

A stack tracks which resources it manages. Remove a resource from the Bicep file and redeploy, and the stack acts on it according to `actionOnUnmanage`:

- `detachAll`: stop managing the resource, leave it in Azure (the default)
- `deleteResources`: delete the resources, keep the resource groups
- `deleteAll`: delete the resources and the resource groups

**Deny settings** are the part complete mode never had. The stack creates a deny assignment over its managed resources, so changes are blocked at the control plane regardless of the caller's RBAC:

- `none`: no restriction
- `denyDelete`: managed resources cannot be deleted
- `denyWriteAndDelete`: managed resources cannot be modified or deleted

```bash
az stack group create \
  --name platform-stack \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyWriteAndDelete \
  --deny-settings-excluded-principals '<pipeline-object-id>'
```

Stacks exist at resource group, subscription, and management group scope, and a stack can deploy to a scope below where it lives. Putting the stack one level above the resources it protects is the recommended arrangement, because it keeps the people working in the resource group from being able to edit the stack that constrains them.

**Constraints to know before relying on deny settings:**

- They cover **control plane** operations only. Deleting a storage account is blocked; deleting a blob inside it is not
- They apply only to resources **explicitly declared** in the template. Resources that Azure creates implicitly (the VMs behind an AKS cluster, for example) are not covered
- You can exclude at most **five principals**. Exceeding five fails silently rather than erroring, so exclude a Microsoft Entra group instead of listing individuals
- A stack whose tracked resource list drifts raises a stack-out-of-sync error rather than deleting anything, which is the intended safe default

### Choosing How to Handle Resources Not in Your Template

```
Do you need resources removed from the template to be deleted from Azure?
  │
  ├─ no ──► Incremental mode (the default). Orphans stay.
  │
  └─ yes ──► Do you also want to block manual changes to what you manage?
               ├─ yes ──► Deployment stack, actionOnUnmanage=deleteResources,
               │          denySettingsMode=denyWriteAndDelete
               └─ no  ──► Deployment stack, actionOnUnmanage=deleteResources,
                          denySettingsMode=none

Complete mode is not on this tree on purpose. It is the legacy
path to the same deletion behavior, with none of the protection
and a deprecation notice attached.
```

---

## What-If Deployments

Before deploying, preview what changes will be made to resources. What-if is available at resource group, subscription, management group, and tenant scope.

**Syntax:**
```bash
az deployment group what-if \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --parameters main.prod.bicepparam
```

To preview and then deploy in one step with a confirmation prompt, add `--confirm-with-what-if` (or `-c`) to the `create` command instead.

**What-if reports seven change types:**

| Change type | Meaning |
|---|---|
| **Create** | Not currently deployed, defined in the template |
| **Delete** | Deployed, not in the template, and will be removed. Only appears in complete mode |
| **Ignore** | Deployed, not in the template, and will be left alone. This is the normal incremental-mode outcome for untracked resources, not a scoping error |
| **NoChange** | Deployed and in the template, will be redeployed with no property changes |
| **Modify** | Deployed and in the template, and listed properties will change |
| **NoEffect** | The property is read-only and the service will ignore it |
| **Deploy** | Will be redeployed, and what-if cannot determine whether properties change. Appears with `ResourceIdOnly` output |

### Reading Past the Noise

What-if compares template values against deployed values, and there are expressions it cannot evaluate outside a real deployment. Anything it cannot resolve shows as a change every single time:

- Nondeterministic functions such as `utcNow()` and `newGuid()`
- Any reference to a `@secure()` parameter value
- Resource functions such as `listKeys()`
- The `reference()` function, and references to resources or properties not defined in the same template

Separately, properties absent from your template but assigned a default by Azure are often reported as deletions that will not actually happen. Both categories are documented noise. Learning which lines in your own what-if output are permanent noise is what makes the tool useful, because a diff that always shows twelve changes trains people to stop reading it.

What-if also stops expanding nested templates at 500 templates, 800 resource groups, or five minutes, and everything beyond those limits is reported as **Ignore**. A large deployment can therefore under-report rather than error.

For a purely local check with no Azure connection, `bicep snapshot` compares a normalized JSON representation of your templates to catch unintended logic changes in review.

---

## Comparison: Bicep vs ARM JSON vs Terraform

| Aspect | Bicep | ARM JSON | Terraform |
|--------|-------|----------|-----------|
| **Syntax** | Concise, readable | Verbose, JSON | Concise, clear |
| **Azure integration** | Native, immediate new features | Native, immediate new features | Third-party, delayed features |
| **Multi-cloud** | Azure only | Azure only | AWS, Azure, Google Cloud, others |
| **Learning curve** | Easy (procedural style) | Steep (deeply nested JSON) | Moderate (different paradigm) |
| **Dependency inference** | Automatic from references | Automatic from references | Automatic from references |
| **Modules/reuse** | First-class support | Linked templates (complex) | First-class modules |
| **Type safety** | Full type checking, user-defined types | None | Full type system with custom validation |
| **State** | None; Azure is the source of truth | None; Azure is the source of truth | State file you must store and lock |
| **IDE support** | Excellent (VS Code, Visual Studio) | Basic | Excellent |
| **Compilation step** | Bicep → ARM JSON (automatic) | Direct deployment | Terraform plan → apply |
| **Community** | Growing (Microsoft-backed) | Large (mature) | Very large (industry standard) |
| **Cost for Azure-only** | No additional cost | No additional cost | No additional cost |

**Choose Bicep when:**
- Your organization is Azure-only
- You want simpler syntax than ARM JSON
- You need immediate support for new Azure features

**Choose Terraform when:**
- You manage infrastructure across multiple clouds
- Your team prefers a domain-specific language
- You want broader community support and integrations

---

## Comparison: Bicep vs AWS CloudFormation

| Aspect | Bicep | CloudFormation |
|--------|-------|----------------|
| **Language design** | Modern, concise | Verbose, nested (YAML or JSON) |
| **Default format** | Human-readable Bicep | Human-editable YAML/JSON |
| **Type system** | Full type checking | No type checking |
| **Dependency handling** | Automatic inference | Automatic + explicit DependsOn |
| **Modules** | Native, composable | Nested stacks (more complex) |
| **Outputs** | Simple, typed | Simple but untyped |
| **Parameter validation** | Rich decorators (min, max, allowed values) | Basic types only |
| **Feature parity** | 100% ARM support | Comprehensive AWS coverage |
| **Update preview** | What-if deployments | Change sets |
| **Scope levels** | Resource group, subscription, management group, tenant | Region, global |
| **Cost** | Included with Azure | Included with AWS |

**Key differences:**
- CloudFormation is more established with broader AWS service coverage
- Bicep provides better syntax and type safety
- Both support modular deployments; Bicep modules are more ergonomic
- CloudFormation uses change sets for preview; Bicep uses what-if

---

## Common Pitfalls

### Pitfall 1: Incorrect API Versions

**Problem:** Using outdated API versions that don't support properties you need, or using new API versions that introduce breaking changes.

**Result:** Deployments fail, or properties silently get ignored without error.

**Solution:** Use the latest stable API version. Check the Microsoft documentation for the resource type to find the current version. Visual Studio Code with Bicep extensions provides intellisense that shows available properties for each API version.

---

### Pitfall 2: Forgetting Symbolic Names in Parent Relationships

**Problem:** Creating child resources without correctly establishing the parent relationship, or using `parent` keyword incorrectly.

**Result:** Child resources fail to deploy or create in the wrong scope.

**Solution:** Child resources must reference their parent using the `parent` property or by nesting within the parent resource. The symbolic name uniquely identifies the parent within the template.

---

### Pitfall 3: Name Generation Without Uniqueness

**Problem:** Creating resource names that must be globally unique (like storage accounts) without ensuring uniqueness across deployments.

**Result:** Deployments fail because the name already exists in Azure.

**Solution:** Use `uniqueString()` to generate a suffix based on the resource group ID:
```bicep
var uniqueSuffix = uniqueString(resourceGroup().id)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'app${environment}${uniqueSuffix}'
  // Rest of properties
}
```

---

### Pitfall 4: Exposing Secrets in Outputs

**Problem:** Including sensitive values like access keys or connection strings in template outputs.

**Result:** The value is stored in the deployment history. Anyone with read access to the resource group can retrieve it, which is usually a wider audience than those entitled to the secret.

**Solution:** There is no secure-output decorator, so this cannot be fixed with a keyword. `@secure()` applies to parameters only. Output the resource ID instead and let the consumer fetch the secret at the point of use, read secrets from Key Vault with `getSecret`, or use managed identity and avoid the key entirely. Leave the `outputs-should-not-contain-secrets` linter rule enabled, and when it fires on a genuine false positive, suppress that one line with `#disable-next-line outputs-should-not-contain-secrets` and a comment explaining why.

---

### Pitfall 5: Circular Dependencies

**Problem:** Resource A depends on B, and B depends on A (directly or indirectly through other resources).

**Result:** Deployment fails with a circular dependency error.

**Solution:** Restructure templates to break the cycle. Often this means moving one dependency to a separate deployment phase or using conditional deployment.

---

### Pitfall 6: Mismatching Resource Group Scope in Modules

**Problem:** Deploying a module at subscription scope when it contains resources expecting resource group scope, or vice versa.

**Result:** Deployment fails with scope mismatch errors.

**Solution:** Explicitly set the scope when calling modules. If a module expects resource group scope, it must be called from a resource group scope deployment.

---

### Pitfall 7: Assuming Omitted Properties Are Left Alone

**Problem:** Treating a Bicep resource block as a patch, and writing a template that specifies only the properties being changed.

**Result:** Every property not in the template is reset to its default on the next deployment. Subnets vanish from a virtual network, tags applied by another team disappear, and web app configuration reverts. The deployment reports success.

**Solution:** Write each resource as its complete intended final state. Before deploying a template against resources that already exist, run what-if and read the deletion lines, because this failure shows up there as properties being removed. When a resource type can express the same thing as a child resource or a parent property (subnets, site config), follow Microsoft's guidance and use the parent property.

---

## Key Takeaways

1. **Bicep simplifies infrastructure as code for Azure.** It provides cleaner syntax than ARM JSON while maintaining full access to Azure Resource Manager capabilities and supporting immediate access to new Azure features.

2. **Bicep transpiles to ARM JSON automatically.** You never write JSON by hand; Bicep handles compilation during deployment. This separation ensures that Bicep improvements don't break existing templates.

3. **Dependencies are inferred from resource references.** When one resource references another, Bicep automatically establishes the dependency order. Use explicit `dependsOn` only when the dependency is not captured by a property reference.

4. **Parameters enable template reusability.** Use parameters with type validation and decorators to accept different values for different environments without duplicating template logic. Keep values in a `.bicepparam` file per environment rather than passing them inline, mark secrets `@secure()`, and pull real secrets from Key Vault with `getSecret` rather than storing them in a parameter file.

5. **Variables reduce duplication and compute derived values.** Variables cannot be changed at deployment time but are useful for constructing names, storing computed values, and storing reusable expressions.

6. **Modules are the primary mechanism for template composition.** Break large templates into modules for clarity, reusability, and easier maintenance. Modules can accept parameters and produce outputs just like functions.

7. **Scope levels range from resource groups to tenants.** Most deployments target resource groups, but Bicep also supports subscription-level deployments for multi-resource-group scenarios, management group policies, and tenant-level resources.

8. **Type checking catches errors during validation.** Bicep enforces parameter types and validates property names and types against the ARM schema, preventing runtime errors from typos or invalid property combinations. The linter catches a second class of problem, and its rules are configurable per repository in `bicepconfig.json`.

9. **A resource block declares final state, not a patch.** Incremental mode leaves *other* resources alone, but within a resource in your template every omitted property resets to its default. This is what silently deletes subnets and tags, and it is why subnets belong in the virtual network's `subnets` property rather than in separate child resources.

10. **Never put a secret in an output.** Outputs live in the deployment history, readable by anyone with read access. There is no secure-output decorator, so the fix is to output a resource ID and fetch the secret at the point of use.

11. **What-if previews changes, and part of its output is noise.** Run it before every production deployment, and learn which lines are permanent noise in your templates: `utcNow()`, `newGuid()`, `listKeys()`, secure parameters, and Azure-assigned defaults all report as changes that will not happen.

12. **Use deployment stacks when you need deletion or protection.** Complete mode is what people historically used to remove orphaned resources, and Microsoft now says it will be gradually deprecated. Deployment stacks delete unmanaged resources on your terms and add deny settings that block changes to what the stack owns.

13. **Bicep is Azure-native and preferred over ARM JSON.** If you are deploying only to Azure, Bicep is the better choice. Use Terraform only if you need multi-cloud support or your team requires it.
