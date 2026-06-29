---
title: "Azure Bicep: Advanced Patterns"
layout: guide
category: Azure
subcategory: Infrastructure as Code
description: "Advanced Bicep patterns including modules, conditional deployments, loops, template specs, deployment stacks, user-defined types, and enterprise-scale IaC strategies."
tags: [azure, infrastructure, cloud-computing, devops, automation, advanced, design-patterns]
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

**Linked Modules** live in storage accounts or are referenced by file path and work well for single-project module libraries. They are simpler to set up but require you to manage module versioning and access control yourself.

```bicep
module app 'modules/compute/app-service.bicep' = {
  name: 'appServiceDeployment'
  params: {
    location: location
    appName: 'myapp'
  }
}
```

**When to use each:**

- **Registry modules:** Shared across teams, multiple projects, require versioning and governance, need community discoverability
- **Linked modules:** Single project, team-owned library, rapid iteration without versioning overhead

### Nested vs Linked

Bicep itself does not distinguish between "nested" and "linked" the way CloudFormation does. Any module reference creates a child deployment, though Azure allows you to structure the actual files differently. The pattern that matters is whether modules are co-located in your file system or stored centrally.

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

resource monitoring 'Microsoft.Insights/diagnosticSettings@2017-05-01-preview' = if (environment == 'prod') {
  name: 'prodDiagnostics'
  properties: {
    logs: [
      {
        category: 'StorageRead'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
  }
}
```

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

output storageIds array = [for (i, location) in locations: storageAccounts[i].outputs.storageId]
```

### Loops Over Output Properties

Loops are useful for transforming outputs from multiple resources.

```bicep
param vmCount int = 3
param location string

resource nics 'Microsoft.Network/networkInterfaces@2023-05-01' = [for i in range(0, vmCount): {
  name: 'nic-${i}'
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig'
        properties: {
          subnet: {
            id: '${vnet.id}/subnets/default'
          }
        }
      }
    ]
  }
}]

output nicIds array = [for (i, nic) in nics: nic.id]
output nicPrivateIPs array = [for nic in nics: nic.properties.ipConfigurations[0].properties.privateIPAddress]
```

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

```bicep
@export()
type subnetConfig = {
  name: string
  addressPrefix: string
  @minValue(0)
  @maxValue(1)
  delegated: bool
  @allowed([
    'Microsoft.Web/serverFarms'
    'Microsoft.Sql/managedInstances'
    null
  ])
  delegation: string?
}

@export()
type vmConfig = {
  name: string
  vmSize: string
  @allowed([
    'UbuntuLTS'
    'WindowsServer2022'
  ])
  imageOffer: string
  @minValue(1)
  @maxValue(10)
  diskCount: int
}
```

### Using Custom Types in Modules

```bicep
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

**Benefits of user-defined types:**

- **Validation at definition time:** Type decorators enforce constraints before deployment
- **Reusability:** Define once, use in multiple modules
- **Self-documenting:** Type definitions serve as documentation of expected input structure
- **IDE support:** Editors provide better autocomplete and validation with custom types

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

When deployed as a stack, the entire set of resources is tracked together, enabling operations like:

- **Deny modifications:** Prevent accidental changes to managed resources
- **Detach on delete:** Remove the stack definition while keeping resources running
- **Managed deletions:** Automatically delete resources when the stack is deleted
- **Dependency tracking:** Understand which resources depend on which

### When to Use Deployment Stacks

Deployment stacks are most valuable in enterprise scenarios where resource lifecycle management is complex. Use them when you need coordinated deletion, prevent accidental modifications, or enforce that resources stay synchronized with template definition.

For simple deployments or rapid iteration, traditional Bicep deployments are often sufficient.

---

## Bicep Extensibility

Bicep allows extending functionality through providers and user-defined functions.

### Providers

Providers enable you to use external systems as part of your Bicep deployments. Kubernetes provider, for example, allows you to manage Kubernetes resources alongside Azure infrastructure.

```bicep
import kubernetes as k8s

param clusterName string
param location string

resource managedCluster 'Microsoft.ContainerService/managedClusters@2023-09-01' = {
  name: clusterName
  location: location
  properties: {
    kubernetesVersion: '1.27'
  }
}

resource namespace = k8s.core.v1.Namespace.new('kube-system')
```

Other providers include Kubernetes, Docker, and HTTP (for calling external APIs as part of deployment).

### User-Defined Functions

User-defined functions encapsulate reusable logic that doesn't map cleanly to a resource definition.

```bicep
@export()
func storageName(environment string, region string) => 'stor${environment}${region}${uniqueString(resourceGroup().id)}'

@export()
func getStorageSku(environment string) => environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'

param environment string
param region string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName(environment, region)
  location: region
  sku: {
    name: getStorageSku(environment)
  }
  kind: 'StorageV2'
  properties: {}
}
```

---

## Multi-Scope Deployments

Production deployments often need to create resources at different scopes: subscription-level resources (management groups, policies, subscriptions), resource groups, and resources within resource groups. Bicep supports multi-scope deployments within a single file.

### Subscription Scope

```bicep
targetScope = 'subscription'

param location string
param environment string

resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environment}-primary'
  location: location
}

resource managementGroupAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: 'auditDiagnosticsPolicy'
  properties: {
    policyDefinitionId: '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.Authorization/policyDefinitions/auditDiagnostics'
    parameters: {}
  }
}

output resourceGroupId string = resourceGroup.id
output resourceGroupName string = resourceGroup.name
```

### Mixed Scope with Modules

You can deploy resources at subscription scope while using modules that deploy at resource group scope.

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
│   ├── common.json          // Shared across all environments
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
└── README.md
```

**Parameter file structure:**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": {
      "value": "prod"
    },
    "location": {
      "value": "eastus"
    },
    "vmSize": {
      "value": "Standard_D4s_v3"
    },
    "tags": {
      "value": {
        "environment": "prod",
        "owner": "platform-team",
        "costCenter": "engineering"
      }
    }
  }
}
```

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
- **Documentation:** Include README files in modules explaining parameters, outputs, and use cases
- **Examples:** Provide example parameter files showing how to consume the module
- **Access control:** Use Azure Container Registry RBAC to control who can publish and consume modules

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
  --parameters environment=prod location=eastus

# Output shows: Create, Modify, Delete, NoChange, Ignore
```

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

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate Bicep
        run: az bicep build --file infrastructure/bicep/main.bicep

      - name: Lint Bicep
        run: az bicep lint --file infrastructure/bicep/main.bicep

  what-if:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: What-If Staging
        run: |
          az deployment group what-if \
            --resource-group staging-rg \
            --template-file infrastructure/bicep/main.bicep \
            --parameters @infrastructure/parameters/staging.json

  deploy-staging:
    needs: [validate, what-if]
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    environment: staging
    steps:
      - uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy to Staging
        run: |
          az deployment group create \
            --resource-group staging-rg \
            --template-file infrastructure/bicep/main.bicep \
            --parameters @infrastructure/parameters/staging.json
```

### Integration Principles

- **Validation first:** Always validate before what-if, always what-if before deploy
- **Environment separation:** Separate deployments for dev, staging, and production with different Azure credentials and approvals
- **Rollback strategy:** Plan for rolling back failed deployments; consider using separate stacks or blue-green deployments
- **Audit trail:** Log what was deployed, by whom, and when; use deployment history for forensics

---

## Bicep vs Terraform vs CloudFormation

Understanding where Bicep fits compared to other IaC tools helps you choose the right tool.

| Aspect | Bicep | Terraform | CloudFormation |
|--------|-------|-----------|----------------|
| **Learning curve** | Low (similar to JSON, Azure-focused) | Medium (general-purpose, steeper learning) | Medium (verbose, lots of boilerplate) |
| **Language** | Bicep (domain-specific) | HCL (domain-specific) | YAML/JSON (configuration) |
| **State management** | Implicit (stored in Azure deployments) | Explicit (separate state files) | Implicit (stored in AWS) |
| **Multi-cloud** | Azure-only | AWS, Azure, GCP, others | AWS-only |
| **Module ecosystem** | Growing (Bicep Registry) | Large (Terraform Registry) | Limited (few reusable modules) |
| **Conditional logic** | Native `if` expressions | Complex nested conditionals | CloudFormation conditions |
| **Loops** | Native `for` expressions | `for_each`, `count` | Limited (workarounds needed) |
| **IDE support** | Good (VS Code Bicep extension) | Excellent | Good |
| **Community** | Growing | Large and mature | Established |
| **Cost** | Free | Free (state storage costs) | Free |
| **Drift detection** | Manual | `terraform plan` | AWS-native drift detection |

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

3. **Validate inputs with decorators and user-defined types.** The earlier invalid input is caught, the better. Use `@minLength()`, `@maxLength()`, `@allowed()`, and custom types to enforce constraints.

4. **Use loops and conditionals to reduce duplication.** Loops over arrays or objects are clearer than repeating resource definitions. Conditionals control which resources exist, not environment-specific logic.

5. **Organize large deployments with consistent structure.** Use a clear directory layout with `modules/`, `parameters/`, `bicep/`, and `tests/` directories. Naming conventions make infrastructure predictable.

6. **Test before deploying.** Use what-if to preview changes, bicep lint for style issues, and bicep build for validation. Integrate validation into CI/CD so errors are caught early.

7. **Deployment stacks provide managed resource lifecycle.** Use them for coordinated deletion, preventing manual changes, and syncing resources with template definitions. They are most valuable in enterprise environments.

8. **Choose Bicep registries for shared modules.** If modules are used across teams or projects, publish them to an ACR-backed Bicep registry with semantic versioning.

9. **User-defined types enforce consistency.** Define custom types for complex objects like subnet configurations or VM settings. Types serve as self-documenting schemas.

10. **Bicep is Azure-specific; know when to use alternatives.** Bicep is the right choice for Azure-only deployments. Choose Terraform for multi-cloud or CloudFormation for AWS-only scenarios.
