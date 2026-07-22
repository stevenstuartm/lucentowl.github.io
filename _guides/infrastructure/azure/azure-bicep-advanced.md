---
title: "Azure Bicep: Advanced Patterns"
layout: guide
category: Azure
subcategory: Infrastructure as Code
description: "Advanced Bicep patterns including module design, registries and template specs, loops and conditions, user-defined types, deployment stacks, extensions, and enterprise-scale IaC strategies."
tags: [bicep, bicep-modules, user-defined-types, bicep-registry, template-specs, deployment-stacks, advanced]
---

## Building Complex Infrastructure with Bicep

After mastering Bicep fundamentals, the next layer involves organizing large deployments, reducing duplication, and handling complex conditional logic. This guide covers patterns that transform Bicep from a simple templating language into a powerful infrastructure-as-code framework suitable for enterprise deployments.

---

## Module Design Patterns

Modules are the building blocks of maintainable Bicep. They encapsulate related resources, provide clear boundaries, and enable reuse across projects.

### What Modules Solve

Without modules, large deployments become unwieldy. A single Bicep file handling both networking and compute becomes difficult to understand, test, and reuse. Modules break this into manageable pieces where each module has a clear responsibility.

### Module Structure

A module is a Bicep file that accepts parameters and produces outputs. When you reference a module from a parent file, Bicep treats it as a logical unit.

```bicep
// modules/storage/main.bicep
param location string
param environment string
param storageAccountName string

@minLength(3)
@maxLength(24)
param namePrefix string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${namePrefix}${storageAccountName}'
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
  }
}

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output primaryBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
```

**Parent template using the module:**

```bicep
// main.bicep
param environment string
param location string

module storageModule 'modules/storage/main.bicep' = {
  name: 'storageDeployment'
  params: {
    location: location
    environment: environment
    storageAccountName: 'data'
    namePrefix: 'myapp'
  }
}

output storageId string = storageModule.outputs.storageAccountId
output storageName string = storageModule.outputs.storageAccountName
```

### Module Registry vs Linked Modules

Azure provides two mechanisms for sharing modules: Bicep registries and linked modules.

**Bicep Registries** store modules in an Azure Container Registry (ACR) and make them reusable across teams and projects. You reference registry modules with a registry path.

```bicep
module vnet 'br:myregistry.azurecr.io/modules/network/vnet:v1.0' = {
  name: 'vnetDeployment'
  params: {
    location: location
    addressSpace: ['10.0.0.0/16']
  }
}
```

**Local path modules** are files in your own repository. They version with the repository and need no registry infrastructure, at the cost of being copied rather than shared when another team wants them.

```bicep
module app 'modules/compute/app-service.bicep' = {
  name: 'appServiceDeployment'
  params: {
    location: location
    appName: 'myapp'
  }
}
```

A Bicep module reference is either a local file path or a registry reference. There is no third form. ARM's "linked templates," which pull JSON from a storage account URL, are a different mechanism from ARM JSON, and Bicep modules do not work that way.

**When to use each:**

- **Registry modules:** shared across teams and repositories, need independent versioning and access control
- **Local path modules:** single repository, versioned with the code that uses them, iterated on rapidly

Repeating the full registry path everywhere is noisy and makes bumping a version a find-and-replace. Define an alias in `bicepconfig.json` instead:

```json
{
  "moduleAliases": {
    "br": {
      "CoreModules": {
        "registry": "myregistry.azurecr.io",
        "modulePath": "bicep/modules"
      }
    }
  }
}
```

```bicep
module vnet 'br/CoreModules:network/vnet:v1.0' = {
  name: 'vnetDeployment'
  params: {
    location: location
  }
}
```

### Every Module Is a Nested Deployment

Bicep does not distinguish "nested" from "linked" the way CloudFormation does. Every module reference compiles to a `Microsoft.Resources/deployments` resource, which has consequences that surface at scale:

- The `name` you give a module is the **deployment name**, and it must be unique within its scope. Two modules with the same name in the same resource group overwrite each other's deployment history, which is why looped modules need the index in the name
- Deployment names are limited to 64 characters
- Nested deployments count against ARM's expansion limits, and what-if stops expanding at 500 of them
- A module's outputs are available only after that nested deployment completes, which is what serializes otherwise independent work when you chain modules through outputs unnecessarily

### Module Design Best Practices

**Single responsibility:** Each module should handle one logical piece of infrastructure. A module that creates both a database and its backups is doing too much; consider splitting into `database` and `backup-policy` modules.

**Clear parameter naming:** Parameters should be explicit about what they control. `location` is clear; `l` is not. Use descriptive names that make the intent obvious.

**Default parameters where sensible:** Provide defaults for non-critical parameters to reduce the configuration burden on consumers. Make required parameters truly required (no default), and optional parameters have sensible defaults.

```bicep
param location string
param environment string = 'dev'  // Default provided
param tags object = {}            // Optional, defaults to empty
param enableMonitoring bool = true // Optional with sensible default
```

**Validate inputs with decorators:** Use `@minLength()`, `@maxLength()`, `@allowed()` to catch bad inputs early.

```bicep
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string

@minLength(1)
@maxLength(11)
param storageNameSuffix string
```

---

## Conditional Deployments

Real infrastructure decisions depend on conditions. Conditional deployments allow you to define resources that exist only when certain criteria are met.

### If Expressions

The `if` expression determines whether a resource is deployed.

```bicep
param deploySecondary bool = false
param location string
param environment string

resource primaryStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'storage${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {}
}

resource secondaryStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = if (deploySecondary) {
  name: 'storagesecondary${uniqueString(resourceGroup().id)}'
  location: 'westus'  // Different region for backup
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {}
}

resource monitoring 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (environment == 'prod') {
  // diagnosticSettings is an extension resource: scope is required
  // and names the resource being monitored.
  scope: primaryStorage
  name: 'prodDiagnostics'
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}
```

Two details in that block do most of the work. **Extension resources need a `scope`**, and a diagnostic setting without one has no resource to attach to. And **retention is no longer configured through diagnostic settings**, because the `retentionPolicy` property was retired. Retention now belongs to the destination, either Log Analytics table retention or a storage lifecycle policy.

### Ternary Operators for Properties

Conditions are not limited to whether resources exist; they can control resource properties.

```bicep
param environment string
param location string

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'plan-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: environment == 'prod' ? 'P2v2' : 'B1'
    capacity: environment == 'prod' ? 3 : 1
  }
  properties: {}
}

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: 'app-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: environment == 'prod' ? true : false
    siteConfig: {
      minTlsVersion: environment == 'prod' ? '1.2' : '1.0'
    }
  }
}
```

### Red Flags with Conditional Deployments

Conditional deployments become problematic when conditions become too complex or when the same condition controls unrelated resources. If you find yourself writing `if (environment == 'prod' && deploySecondary && !legacyMode && region != 'southeastasia')`, your deployment is hiding too much logic. Break it into separate parameter flags with clear names, or consider using different parameter files for different scenarios.

---

## Loops and Iteration

Loops eliminate repetitive resource definitions and enable dynamic scaling based on parameters.

### For Expressions Over Resources

The `for` expression creates multiple instances of a resource based on an array or object.

```bicep
param vnetAddressSpace string = '10.0.0.0/16'
param subnets array = [
  {
    name: 'frontend'
    addressPrefix: '10.0.1.0/24'
  }
  {
    name: 'app'
    addressPrefix: '10.0.2.0/24'
  }
  {
    name: 'data'
    addressPrefix: '10.0.3.0/24'
  }
]

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: 'vnet-prod'
  location: resourceGroup().location
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressSpace
      ]
    }
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: {
        addressPrefix: subnet.addressPrefix
      }
    }]
  }
}
```

### Loops Over Module Instances

Loops are especially useful for creating multiple instances of a module.

```bicep
param locations array = ['eastus', 'westus']
param environment string = 'prod'

module storageAccounts 'modules/storage.bicep' = [for (location, index) in locations: {
  name: 'storage-${location}-${index}'
  params: {
    location: location
    environment: environment
    namePrefix: 'myapp${index}'
  }
}]

output storageIds array = [for (location, i) in locations: storageAccounts[i].outputs.storageAccountId]
```

**The loop variable order is `(item, index)`, not `(index, item)`.** Writing `for (i, location) in locations` binds `i` to the region string and `location` to the integer, and the failure is a confusing type error at a line that looks correct. Including the index in the module `name` is not optional either, because module names are deployment names and must be unique within the scope.

### Loops Over Output Properties

Loops are useful for transforming outputs from multiple resources.

```bicep
param vmCount int = 3
param location string
param subnetId string

resource nics 'Microsoft.Network/networkInterfaces@2023-05-01' = [for i in range(0, vmCount): {
  name: 'nic-${i}'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig'
        properties: {
          subnet: {
            id: subnetId
          }
        }
      }
    ]
  }
}]

output nicIds array = [for i in range(0, vmCount): nics[i].id]
output nicPrivateIPs array = [for i in range(0, vmCount): nics[i].properties.ipConfigurations[0].properties.privateIPAddress]
```

Indexing the collection is clearer than destructuring it, and it avoids the `(item, index)` ordering trap entirely. Note also that `privateIPAddress` is assigned by Azure at deployment time, so what-if cannot predict it and will report it as changing on every run.

### Index-Based vs Name-Based Loops

Bicep supports looping over arrays (using index) and objects (using key-value pairs).

```bicep
// Index-based loop over array
param regions array = ['eastus', 'westus', 'northeurope']
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = [for (region, index) in regions: {
  name: 'storage${index}'
  location: region
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {}
}]

// Object-based loop
param environments object = {
  dev: {
    skuName: 'Standard_LRS'
    capacity: 1
  }
  prod: {
    skuName: 'Standard_GRS'
    capacity: 3
  }
}
resource accounts 'Microsoft.Storage/storageAccounts@2023-01-01' = [for (env, envConfig) in environments: {
  name: 'storage${env}'
  location: resourceGroup().location
  kind: 'StorageV2'
  sku: {
    name: envConfig.skuName
  }
  properties: {}
}]
```

---

## User-Defined Types

User-defined types allow you to create reusable, validated object structures that enforce consistency across your deployments.

### Defining Custom Types

**`@allowed` is permitted only on `param` statements.** Inside a `type` declaration, constrain values with union type syntax instead, using the `|` operator. Likewise `@minValue` and `@maxValue` apply to `int` only, and `@minLength`/`@maxLength` to strings and arrays.

```bicep
// types.bicep
@export()
type delegationService = 'Microsoft.Web/serverFarms' | 'Microsoft.Sql/managedInstances'

@export()
type subnetConfig = {
  name: string
  addressPrefix: string

  @description('Service to delegate the subnet to. Omit for no delegation.')
  delegation: delegationService?
}

@export()
@sealed()
type vmConfig = {
  name: string
  vmSize: string
  imageOffer: 'UbuntuLTS' | 'WindowsServer2022'

  @minValue(1)
  @maxValue(10)
  diskCount: int
}
```

A property is optional when its type carries the `?` marker, which replaces the awkward pattern of allowing `null` in a value list. `@sealed()` raises an unrecognized property name from a warning to an error, so a typo like `vmSizes` fails the build instead of being silently ignored.

### Using Custom Types in Modules

Types declared with `@export()` are not automatically visible elsewhere. The consuming file has to import them:

```bicep
import { subnetConfig, vmConfig } from 'types.bicep'

param subnets subnetConfig[]
param vmConfiguration vmConfig

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: 'vnet'
  location: resourceGroup().location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [for subnet in subnets: {
      name: subnet.name
      properties: {
        addressPrefix: subnet.addressPrefix
      }
    }]
  }
}
```

The same `import`/`@export()` mechanism works for variables and user-defined functions, which is how a repository shares constants and naming logic without a module deployment.

**Benefits of user-defined types:**

- **Validation at definition time:** Type constraints are enforced by the compiler, before deployment
- **Reusability:** Define once, import in multiple modules
- **Self-documenting:** Type definitions serve as documentation of expected input structure
- **IDE support:** Editors provide better autocomplete and validation with custom types

### Types Derived from Resource Schemas

Rather than hand-writing a type that mirrors part of a resource, derive it. `resourceInput<>` gives the writable properties of a resource type and `resourceOutput<>` gives the readable ones, so the type tracks the API version instead of drifting from it.

```bicep
// Exactly the values this API version accepts, no hand-maintained list
type accountKind = resourceInput<'Microsoft.Storage/storageAccounts@2024-01-01'>.kind

param storageProps resourceInput<'Microsoft.Storage/storageAccounts@2024-01-01'>.properties = {
  accessTier: 'Hot'
  minimumTlsVersion: 'TLS1_2'
  allowBlobPublicAccess: false
}
```

Bicep checks resource-derived types when you compile, but Azure Resource Manager does not check them at deployment time, so they are a local authoring guard rather than a service-side guarantee.

### Tagged Unions

When a parameter accepts several shapes that are distinguished by one field, `@discriminator()` tells Bicep which field selects the shape, and you get per-shape validation instead of `object`.

```bicep
type blobBackup = {
  kind: 'blob'
  containerName: string
}

type sqlBackup = {
  kind: 'sql'
  databaseName: string
  retentionDays: int
}

@discriminator('kind')
type backupTarget = blobBackup | sqlBackup

param target backupTarget
```

Set `kind` to `'sql'` and the compiler now requires `databaseName` and `retentionDays` and rejects `containerName`.

---

## Deployment Stacks

Deployment stacks provide declarative resource management that simplifies lifecycle operations like updates and deletions.

### How Deployment Stacks Differ from Traditional Deployments

Traditional ARM template and Bicep deployments use create-or-update semantics. Deployment stacks add a managed layer that handles resource deletion, orphaning, and state synchronization.

A deployment stack treats all resources defined in your Bicep file as a managed set. When you delete the stack, you can choose to delete resources, detach them (leaving them running), or deny deletion if resources have dependencies.

```bicep
// bicep/infrastructure.bicep
param location string = resourceGroup().location

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'myapp${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {}
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: 'plan-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'F1'
  }
  properties: {}
}

output storageId string = storageAccount.id
output planId string = appServicePlan.id
```

The stack is created with the `az stack` command family rather than `az deployment`, and two switches define its whole behavior:

```bash
az stack group create \
  --name platform-stack \
  --resource-group myresourcegroup \
  --template-file bicep/infrastructure.bicep \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyWriteAndDelete \
  --deny-settings-excluded-principals '<pipeline-object-id>'
```

**`--action-on-unmanage`** decides what happens to a resource once it leaves the template: `detachAll` (the default, leave it running but stop tracking it), `deleteResources` (delete resources, keep resource groups), or `deleteAll`.

**`--deny-settings-mode`** creates a deny assignment over the managed resources: `none`, `denyDelete`, or `denyWriteAndDelete`. This is a control-plane block that applies regardless of the caller's RBAC, which is what makes it different from a resource lock or a role assignment.

### Enterprise Considerations

Deny settings behave differently from how most people first read them, and each of these has bitten someone:

- They cover **control plane only**. Deleting a storage account is blocked; deleting a blob inside it is not
- They apply only to **explicitly declared** resources. An AKS cluster's implicitly created node-pool VMs are not protected by a stack that declares only the cluster
- The **excluded-principals list caps at five**, and passing more fails silently rather than erroring. Exclude a Microsoft Entra group instead of individuals, and manage the exemption through group membership
- Place the stack **one scope above** what it protects. A stack at subscription scope deploying into a resource group keeps the teams working in that resource group from editing the stack that constrains them
- If the stack's tracked resource list drifts from reality, updates fail with a stack-out-of-sync error rather than deleting anything, which is the intended safe default. Resolve it by reviewing the managed resource list, not by reflexively passing the bypass flag

### When to Use Deployment Stacks

Reach for a stack when you need coordinated deletion of resources that left the template, or when you need to stop people from editing what the template owns. Both are things a plain deployment cannot do, and both were previously attempted with complete mode, which Microsoft is now gradually deprecating in favor of stacks.

For simple deployments or rapid iteration, a plain incremental deployment is often sufficient.

---

## Bicep Extensibility

Bicep allows extending functionality through extensions and user-defined functions.

### Extensions

Extensions let a Bicep file manage resources outside Azure Resource Manager. The Kubernetes extension is the canonical example, and it lets a deployment create Kubernetes objects alongside the cluster that hosts them.

The declaration keyword is `extension`, not `import`. It is still a **preview feature** that must be enabled in `bicepconfig.json`:

```json
{
  "experimentalFeaturesEnabled": {
    "extensibility": true
  }
}
```

Because the cluster credentials are a secret, the Kubernetes objects go in their own module and the parent passes the kubeconfig into a `@secure()` parameter:

```bicep
// kubernetes.bicep
@secure()
param kubeConfig string

extension kubernetes with {
  namespace: 'default'
  kubeConfig: kubeConfig
} as k8s

resource appService 'core/Service@v1' = {
  metadata: {
    name: 'my-app'
  }
  spec: {
    type: 'LoadBalancer'
    ports: [
      {
        port: 80
        targetPort: 8080
      }
    ]
  }
}
```

```bicep
// main.bicep
resource aks 'Microsoft.ContainerService/managedClusters@2024-10-01' existing = {
  name: 'demoAKSCluster'
}

module kubernetes './kubernetes.bicep' = {
  name: 'k8sDeployment'
  params: {
    kubeConfig: aks.listClusterAdminCredential().kubeconfigs[0].value
  }
}
```

Two constraints decide whether this is usable for you. The extension **does not support private clusters**, which rules it out for most production AKS estates, and it needs cluster-admin credentials at deployment time, which is a meaningful privilege for a pipeline to hold. Microsoft Graph is the other notable extension, used to create Entra ID groups and app registrations from Bicep.

### User-Defined Functions

User-defined functions encapsulate reusable logic that doesn't map cleanly to a resource definition. **The return type is required**, between the parameter list and the `=>`.

```bicep
// naming.bicep
@export()
func storageName(environment string, region string, salt string) string =>
  'stor${environment}${region}${uniqueString(salt)}'

@export()
func getStorageSku(environment string) string =>
  environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
```

```bicep
import { storageName, getStorageSku } from 'naming.bicep'

param environment string
param region string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName(environment, region, resourceGroup().id)
  location: region
  sku: {
    name: getStorageSku(environment)
  }
  kind: 'StorageV2'
}
```

Functions are deliberately limited so they stay evaluable at compile time:

- They **cannot use `reference()` or any `list*` function**, so a function cannot read a deployed resource's state or fetch a key
- Their parameters **cannot have default values**
- They can read variables in the same file, and imported variables, but nothing else from the surrounding template

Passing `resourceGroup().id` in as a `salt` parameter rather than calling scope functions inside the function keeps the function pure and testable, and it lets the same function serve a subscription-scope template.

---

## Multi-Scope Deployments

Production deployments often need to create resources at different scopes: subscription-level resources (management groups, policies, subscriptions), resource groups, and resources within resource groups. Bicep supports multi-scope deployments within a single file.

### Subscription Scope

```bicep
targetScope = 'subscription'

param location string
param environment string

// Avoid naming a symbol 'resourceGroup': it shadows the
// resourceGroup() function for the rest of the file.
resource primaryRg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environment}-primary'
  location: location
}

resource auditPolicy 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: 'auditDiagnosticsPolicy'
  properties: {
    policyDefinitionId: '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.Authorization/policyDefinitions/auditDiagnostics'
    parameters: {}
  }
}

output resourceGroupId string = primaryRg.id
output resourceGroupName string = primaryRg.name
```

The assignment lands on the subscription this deployment targets. `properties.scope` is read-only on `policyAssignments`, so scope comes from the deployment, not from a property you set.

### Mixed Scope with Modules

The `scope` property on a module is what lets one file span the hierarchy. The parent runs at one scope, and each module runs as a nested deployment at whatever scope you point it to.

```bicep
targetScope = 'subscription'

param location string
param environment string

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environment}'
  location: location
}

module vnetModule 'modules/networking.bicep' = {
  scope: rg
  name: 'vnetDeployment'
  params: {
    location: location
    environment: environment
  }
}
```

```
  targetScope = 'subscription'
  ┌─────────────────────────────────────────────────┐
  │ Subscription deployment                         │
  │                                                 │
  │  resource rg  ────────► creates rg-prod         │
  │                                                 │
  │  module vnetModule                              │
  │    scope: rg  ─────┐                            │
  │  module dbModule   │                            │
  │    scope: rg  ───┐ │                            │
  └──────────────────┼─┼────────────────────────────┘
                     │ │  each becomes its own
                     ▼ ▼  nested deployment
        ┌────────────────────────────────┐
        │ Resource group: rg-prod        │
        │   vnetDeployment  ──► VNet,NSG │
        │   dbDeployment    ──► SQL      │
        └────────────────────────────────┘

  The resource group must exist before a module can target it,
  which the scope reference establishes automatically. Module
  names are deployment names and are unique per scope.
```

A module's own `targetScope` must be compatible with the scope you give it. A module written for resource group scope (the default) can be pointed at any resource group, including one in another subscription via `resourceGroup(subId, rgName)`, but it cannot be deployed at subscription scope.

---

## Parameterization Strategies

Effective parameterization separates infrastructure code from environment-specific configuration, enabling the same Bicep file to deploy to dev, staging, and production.

### Parameter File Organization

```
infrastructure/
├── bicep/
│   ├── main.bicep
│   ├── modules/
│   │   ├── networking.bicep
│   │   ├── compute.bicep
│   │   └── storage.bicep
│   └── types.bicep
├── parameters/
│   ├── shared.bicepparam     // Base values, extended by the others
│   ├── dev.bicepparam
│   ├── staging.bicepparam
│   └── prod.bicepparam
└── README.md
```

**Parameter file structure:**

```bicep
// prod.bicepparam
using '../bicep/main.bicep'

param environment = 'prod'
param location = 'eastus'
param vmSize = 'Standard_D4s_v3'
param tags = {
  environment: 'prod'
  owner: 'platform-team'
  costCenter: 'engineering'
}
```

`.bicepparam` files are type-checked against the template named in `using`, so a renamed parameter or a wrong type fails at build rather than at deployment. JSON parameter files still work and are what `--parameters @file.json` expects, but they get none of that checking.

Shared values across environments are handled with `extends`, which inherits from a base parameter file and lets each environment override selectively:

```bicep
// prod.bicepparam
using '../bicep/main.bicep'
extends 'shared.bicepparam'

param environment = 'prod'
param vmSize = 'Standard_D4s_v3'
```

Parameter files are plain text in source control. Keep secrets out of them and pull them from Key Vault with `getSecret` at deployment time.

### Environment-Specific Logic

Instead of embedding environment-specific logic deeply in your Bicep files, keep logic at the top level where it is visible. Pass environment-specific values as parameters.

```bicep
param environment string
param location string

// Instead of: if (environment == 'prod') { complex logic... }
// Pass the specific config as a parameter:
param vmSku string
param replicaCount int
param enableMonitoring bool

resource vmScaleSet 'Microsoft.Compute/virtualMachineScaleSets@2023-09-01' = {
  name: 'vmss-${environment}'
  location: location
  sku: {
    name: vmSku
    capacity: replicaCount
  }
  properties: {}
}
```

---

## Module Registries

Bicep registries, built on Azure Container Registry, provide a centralized way to store and version modules.

### Publishing Modules to a Registry

```bash
# Create an ACR for modules
az acr create --resource-group rg --name mymodules --sku Basic

# Publish a module
az bicep publish --file modules/storage.bicep \
  --target 'br:mymodules.azurecr.io/bicep/modules/storage:v1.0'
```

### Consuming Registry Modules

```bicep
module storage 'br:mymodules.azurecr.io/bicep/modules/storage:v1.0' = {
  name: 'storageDeployment'
  params: {
    location: location
    environment: environment
  }
}
```

### Registry Module Best Practices

- **Semantic versioning:** Use version tags (v1.0, v1.1, v2.0) to communicate breaking changes
- **Immutable tags:** Never republish over an existing tag. A consumer pinned to `v1.0` should get the same bytes forever
- **Documentation:** Include README files in modules explaining parameters, outputs, and use cases
- **Examples:** Provide example parameter files showing how to consume the module
- **Access control:** Use Azure Container Registry RBAC to control who can publish and consume modules. Publishers need `AcrPush`, consumers only `AcrPull`
- **Restore in CI:** Registry modules are downloaded at build time, so build agents need network access to the registry and an identity that can pull

### Template Specs

A **template spec** (`Microsoft.Resources/templateSpecs`) is a different sharing mechanism with a different audience. It stores a versioned template as a first-class Azure resource, secured with Azure RBAC and deployable directly.

```bash
az ts create \
  --name storage-baseline \
  --version 1.0 \
  --resource-group platform-rg \
  --template-file modules/storage.bicep

az deployment group create \
  --resource-group app-rg \
  --template-spec "/subscriptions/<sub>/resourceGroups/platform-rg/providers/Microsoft.Resources/templateSpecs/storage-baseline/versions/1.0"
```

The distinction that matters: a **registry module is a building block** that someone composes into their own template, while a **template spec is a finished deployable** that someone runs. A platform team publishes a template spec when it wants application teams to deploy an approved topology without being able to modify it, and Azure RBAC on the spec controls who can.

Template specs can also be referenced as modules with the `ts:` scheme:

```bicep
module storage 'ts:/subscriptions/<sub>/resourceGroups/platform-rg/providers/Microsoft.Resources/templateSpecs/storage-baseline/versions/1.0' = {
  name: 'storageDeployment'
  params: {
    location: location
  }
}
```

### Choosing a Sharing Mechanism

```
Is the template consumed outside the repository that defines it?
  │
  ├─ no ──► Local path module. Versioned with your code, no
  │         registry infrastructure, no publish step.
  │
  └─ yes ──► Do consumers compose it into their own templates,
             or deploy it as-is?
               │
               ├─ compose ──► Bicep registry module (br:).
               │              Versioned artifacts in ACR,
               │              access via AcrPull/AcrPush.
               │
               └─ deploy ────► Template spec (ts:).
                               An Azure resource with RBAC,
                               deployable directly by consumers
                               who never see or edit the source.
```

---

## Testing Bicep Templates

Effective testing catches errors before deployment and prevents resource creation failures.

### What-If Validation

The what-if operation shows what changes will occur without actually deploying.

```bash
# Preview changes without deploying
az deployment group what-if \
  --resource-group mygroup \
  --template-file main.bicep \
  --parameters parameters/prod.bicepparam

# Change types: Create, Delete, Ignore, NoChange, NoEffect, Modify, Deploy
```

In a pipeline, treat what-if output as something a human reads rather than something a gate parses. Expressions it cannot evaluate outside a real deployment (`utcNow()`, `newGuid()`, `listKeys()`, secure parameters, `reference()`) report as changes on every run, and nested-template expansion stops at 500 templates, marking the remainder `Ignore`. A what-if diff that always shows the same twelve phantom changes trains reviewers to skim it.

For a check that needs no Azure connection at all, `bicep snapshot` compares a normalized JSON rendering of your templates between commits, which catches unintended logic changes during code review.

### Template Validation

Bicep validation checks syntax and ARM template compatibility without deployment.

```bash
# Validate locally
az bicep build --file main.bicep

# This creates an ARM template JSON. Errors appear here if any.
```

### Bicep Linting

The Bicep linter catches style issues and common mistakes.

```bash
# Lint a template
az bicep lint --file main.bicep

# Issues include: unused parameters, missing descriptions, style violations
```

### Common Validation Errors

**Circular dependencies:** Resource A references Resource B, and Resource B references Resource A. Break the cycle by using separate deployments or reordering references.

**Invalid properties:** Resource property names or types don't match the API version. Verify property names in Azure documentation for your API version.

**Missing outputs:** Trying to reference an output that doesn't exist. Ensure outputs are explicitly defined in parent templates when using modules.

---

## Organizing Large Deployments

Large deployments require structure. Here is a pattern that scales from small projects to enterprise multi-team environments.

### Project Structure for Enterprise Deployments

```
infrastructure/
├── README.md
├── bicep/
│   ├── main.bicep                  // Entry point
│   ├── modules/
│   │   ├── networking/
│   │   │   ├── vnet.bicep
│   │   │   ├── nsg.bicep
│   │   │   └── README.md
│   │   ├── compute/
│   │   │   ├── vmscaleset.bicep
│   │   │   ├── appservice.bicep
│   │   │   └── README.md
│   │   └── storage/
│   │       ├── storageaccount.bicep
│   │       └── README.md
│   ├── types/
│   │   ├── networking-types.bicep
│   │   └── compute-types.bicep
│   └── common/
│       ├── variables.bicep         // Shared constants
│       └── functions.bicep         // Shared functions
├── parameters/
│   ├── common.json
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
└── tests/
    ├── validation.sh              // Validation tests
    └── what-if-tests.sh           // What-if validation tests
```

### Naming Conventions

Consistent naming makes infrastructure predictable and searchable.

```bicep
// Resource naming: <environment>-<component>-<type>
param resourceNamePrefix string = '${environment}-${applicationName}'

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: '${resourceNamePrefix}-vnet'
  // ...
}

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: '${resourceNamePrefix}-nsg'
  // ...
}
```

**Module naming:** Module names should reflect what they create, not how they create it. `networking` is better than `network-module` or `vnet-and-nsg`.

---

## CI/CD Integration Patterns

Bicep integrates into CI/CD pipelines where templates are validated, tested, and deployed automatically.

### GitHub Actions Workflow

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
    paths: ['infrastructure/**']

# Required for OIDC federated credentials
permissions:
  id-token: write
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Bicep
        run: az bicep build --file infrastructure/bicep/main.bicep

      - name: Lint Bicep
        run: az bicep lint --file infrastructure/bicep/main.bicep

  what-if:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: What-If Staging
        run: |
          az deployment group what-if \
            --resource-group staging-rg \
            --parameters infrastructure/parameters/staging.bicepparam

  deploy-staging:
    needs: what-if
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy to Staging
        run: |
          az deployment group create \
            --resource-group staging-rg \
            --parameters infrastructure/parameters/staging.bicepparam
```

Authenticate with **OIDC federated credentials** rather than a long-lived service principal secret in `AZURE_CREDENTIALS`. The workflow requests a short-lived token scoped to that run, so there is no stored secret to rotate or leak, and the `id-token: write` permission is what makes it work.

### Integration Principles

- **Validation first:** Always build and lint before what-if, always what-if before deploy
- **Environment separation:** Separate deployments for dev, staging, and production with distinct identities and approval gates
- **Least privilege per stage:** The what-if job needs only read access. Grant deploy permissions to the deploy job's identity, not to every job
- **Rollback strategy:** There is no rollback command. Redeploying the previous commit is the realistic path, which is an argument for keeping templates deployable from any tagged commit
- **Audit trail:** Deployment history records what was deployed and when. Attach the commit SHA as a tag or deployment name so a resource can be traced back to a pull request

---

## Bicep vs Terraform vs CloudFormation

Understanding where Bicep fits compared to other IaC tools helps you choose the right tool.

| Aspect | Bicep | Terraform | CloudFormation |
|--------|-------|-----------|----------------|
| **Learning curve** | Low (similar to JSON, Azure-focused) | Medium (general-purpose, steeper learning) | Medium (verbose, lots of boilerplate) |
| **Language** | Bicep (domain-specific) | HCL (domain-specific) | YAML/JSON (configuration) |
| **State management** | None; Azure Resource Manager is the source of truth | Explicit (separate state files you store and lock) | None; AWS tracks stack resources |
| **Multi-cloud** | Azure-only | AWS, Azure, GCP, others | AWS-only |
| **Module ecosystem** | Growing (Bicep Registry) | Large (Terraform Registry) | Limited (few reusable modules) |
| **Conditional logic** | Native `if` expressions | Complex nested conditionals | CloudFormation conditions |
| **Loops** | Native `for` expressions | `for_each`, `count` | Limited (workarounds needed) |
| **IDE support** | Good (VS Code Bicep extension) | Excellent | Good |
| **Community** | Growing | Large and mature | Established |
| **Cost** | Free | Free (state storage costs) | Free |
| **Drift detection** | `what-if`, or deny settings on a deployment stack to prevent drift | `terraform plan` | AWS-native drift detection |

**Choose Bicep when:**
- Your infrastructure is Azure-only and unlikely to change
- You want the simplest learning curve for Azure deployments
- Your team is familiar with declarative, template-based IaC
- You need native Azure-first features and fast service coverage

**Choose Terraform when:**
- You deploy across clouds (AWS, Azure, GCP, on-premises)
- You need strong state management and drift detection
- You want access to a massive ecosystem of community modules
- Your team values programming-language-like constructs and flexibility

**Choose CloudFormation when:**
- You are AWS-exclusive and want AWS-native tooling
- You need deep integration with AWS service-specific features
- You have existing CloudFormation investments

---

## Common Pitfalls

### Pitfall 1: Modules That Are Too Large

**Problem:** Creating a single module that handles networking, compute, and storage because they are deployed together.

**Result:** The module becomes difficult to test, reuse, and understand. A change to storage logic requires re-testing the entire module.

**Solution:** Break modules by responsibility. Create separate `networking`, `compute`, and `storage` modules. The parent template coordinates them.

---

### Pitfall 2: Overusing Conditional Logic

**Problem:** Embedding complex if-then-else chains in your Bicep files to handle different scenarios, environments, or feature flags.

**Result:** The Bicep file becomes hard to read, and it becomes unclear which resources are deployed in which scenarios.

**Solution:** Use separate parameter files for different scenarios. Pass environment-specific configuration as parameters rather than embedding conditions in the template.

---

### Pitfall 3: Not Validating Inputs

**Problem:** Writing modules with parameters that accept any string, integer, or object without validation.

**Result:** Invalid configurations are not caught until deployment, wasting time and resources.

**Solution:** Use decorators to validate inputs. Define user-defined types with constraints. The earlier invalid input is caught, the faster feedback loops become.

---

### Pitfall 4: Circular Dependencies

**Problem:** Creating modules or resources where A depends on B and B depends on A.

**Result:** Deployment fails with circular dependency errors.

**Solution:** Map out dependencies before writing Bicep. Use outputs from earlier modules as inputs to later modules, not the other way around. If cycles appear necessary, restructure to separate the deployment into multiple phases.

---

### Pitfall 5: Hard-Coded Values

**Problem:** Embedding environment-specific values, API versions, or region names directly in Bicep files.

**Result:** Reusing the template in different environments requires editing the file. Bicep files diverge between environments.

**Solution:** Move all environment-specific values to parameters or parameter files. Use `param` for everything that varies between deployments.

---

### Pitfall 6: Ignoring API Versions

**Problem:** Using outdated API versions that don't support new properties or behaviors.

**Result:** Features you need are unavailable, or behaviors differ from documentation.

**Solution:** Check the [Azure Resource Manager provider API reference](https://learn.microsoft.com/en-us/azure/templates/){:target="_blank" rel="noopener noreferrer"} for your resource type. Use the latest stable API version unless you have compatibility reasons to use an older one.

---

## Key Takeaways

1. **Modules are the foundation of maintainable Bicep.** Encapsulate each logical unit in its own module, with clear parameters and outputs. Reuse modules across projects.

2. **Parameterize everything that varies.** Use parameters for environment-specific values, not conditionals. Create separate parameter files for dev, staging, and production, and use the same Bicep file for all.

3. **Validate inputs with decorators and user-defined types.** The earlier invalid input is caught, the better. Use `@minLength()`, `@maxLength()`, and `@allowed()` on parameters. Inside a `type` declaration, `@allowed()` is not permitted, so constrain values with union syntax (`'dev' | 'prod'`) instead, and add `@sealed()` so a mistyped property name fails the build.

4. **Use loops and conditionals to reduce duplication.** Loops over arrays or objects are clearer than repeating resource definitions. Conditionals control which resources exist, not environment-specific logic.

5. **Organize large deployments with consistent structure.** Use a clear directory layout with `modules/`, `parameters/`, `bicep/`, and `tests/` directories. Naming conventions make infrastructure predictable.

6. **Test before deploying.** Use what-if to preview changes, bicep lint for style issues, and bicep build for validation. Integrate validation into CI/CD so errors are caught early.

7. **Deployment stacks provide managed resource lifecycle.** `actionOnUnmanage` decides what happens to resources that leave the template, and deny settings block control-plane changes to what the stack owns. Both cover only explicitly declared resources, and the excluded-principals list silently caps at five.

8. **Registries and template specs answer different questions.** Publish a registry module when consumers compose it into their own templates. Publish a template spec when consumers deploy it as-is and Azure RBAC should decide who can.

9. **User-defined types enforce consistency, and `import` is what shares them.** `@export()` marks a type, variable, or function as shareable, but the consuming file still needs an `import` statement. Derive types from resource schemas with `resourceInput<>` when you would otherwise hand-maintain a list that tracks an API version.

10. **Every module is a nested deployment.** Module names are deployment names, unique per scope and capped at 64 characters, which is why looped modules need the index in the name. The `scope` property is what lets one file span the resource hierarchy.

11. **Bicep is Azure-specific; know when to use alternatives.** Bicep is the right choice for Azure-only deployments. Choose Terraform for multi-cloud or CloudFormation for AWS-only scenarios.
