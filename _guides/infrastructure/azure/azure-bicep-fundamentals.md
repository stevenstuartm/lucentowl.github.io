---
title: "Azure Bicep: Fundamentals"
layout: guide
category: Azure
subcategory: Infrastructure as Code
description: "Core concepts of Azure Bicep, Azure's first-party infrastructure as code language that transpiles to ARM templates, covering resource declarations, parameters, variables, outputs, and module basics."
tags: [azure, infrastructure, cloud-computing, devops, automation, fundamentals]
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
- Bicep is the preferred approach for Azure-native projects; all new Azure features land in Bicep first
- ARM JSON is still valid but considered lower level; use it only if you already have templates or need specific legacy features

**Bicep vs Terraform:**
- Bicep is Azure-specific with deeper Azure Resource Manager integration and immediate support for new features
- Terraform is cloud-agnostic and works across AWS, Azure, Google Cloud, and others
- Choose Bicep if your organization is Azure-only; choose Terraform if you manage multi-cloud infrastructure

**Bicep vs ARM templates + PowerShell:**
- Bicep replaces the need to write PowerShell wrapper scripts; it handles parameterization and modular deployment natively

---

## How Bicep Works

### The Bicep Workflow

1. **Write** a `.bicep` file with your infrastructure definition
2. **Validate** the file using Bicep CLI or IDE validation
3. **Build** (optional, automatic) to transpile the `.bicep` file to `template.json`
4. **Deploy** the compiled ARM template to Azure

Behind the scenes, Bicep transpiles to ARM JSON, which Azure Resource Manager then processes. You never manually touch the compiled JSON; it exists only as an intermediate artifact before deployment.

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
output storageAccountConnectionString string = 'DefaultEndpointProtocol=https;AccountName=${storageAccount.name};AccountKey=${listKeys(storageAccount.id, storageAccount.apiVersion).keys[0].value};EndpointSuffix=core.windows.net'
output vnetId string = vnet.id
```

Outputs appear in the deployment response and can be queried after deployment:
```bash
az deployment group show --name mydeployment --resource-group myresourcegroup --query properties.outputs
```

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
var name = toLower('EXAMPLE')               // 'example'
var padded = padLeft('123', 5, '0')        // '00123'
var replaced = replace('hello-world', '-', '_')  // 'hello_world'
var substring = substring('hello', 0, 3)  // 'hel'
```

**Array and object functions:**
```bicep
var items = ['a', 'b', 'c']
var length = length(items)                 // 3
var joined = join(items, '-')              // 'a-b-c'
var contains_check = contains(items, 'b') // true

var config = { name: 'app', port: 8080 }
var hasKey = contains(config, 'name')      // true
```

**Resource functions:**
```bicep
// Get resource properties
output accountId string = storageAccount.id
output accountName string = storageAccount.name

// List access keys (requires `listKeys` function)
var keys = listKeys(storageAccount.id, storageAccount.apiVersion)
var primaryKey = keys.keys[0].value

// Get current resource group details
var rgId = resourceGroup().id
var rgName = resourceGroup().name
var subId = subscription().id
```

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

// The reference to vnet creates an implicit dependency
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' = {
  parent: vnet
  name: 'frontend'
  properties: {
    addressPrefix: '10.0.1.0/24'
  }
}
```

The `parent: vnet` line creates an implicit dependency. Azure knows to create the VNet before the subnet.

### Explicit Dependencies

When implicit dependencies are insufficient, use the `dependsOn` property to explicitly order resource creation.

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

// Storage account must exist before the container
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: storageAccount
  name: 'mycontainer'
  properties: {
    publicAccess: 'None'
  }
}
```

Use explicit `dependsOn` when:
- A resource needs another to complete creation even though no direct reference exists
- Resource creation order matters but cannot be inferred from property references

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
param policyDefinition object

// Assign a policy to all subscriptions under this management group
resource policyAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: policyName
  properties: {
    policyDefinitionId: policyDefinition.id
    scope: managementGroup().id
  }
}
```

### Tenant Scope

Deploy resources that span the entire tenant (global services like role definitions):

```bicep
targetScope = 'tenant'

// Define a custom role available across the entire tenant
resource customRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(tenant().id, 'my-custom-role')
  properties: {
    roleName: 'Custom App Developer'
    type: 'CustomRole'
    permissions: [
      {
        actions: [
          'Microsoft.Web/sites/read'
          'Microsoft.Web/sites/write'
        ]
      }
    ]
  }
}
```

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

Azure Resource Manager supports two deployment modes that affect how updates are handled.

### Complete Mode

In complete mode, Azure Resource Manager deletes resources that exist in the resource group but are not defined in the template.

**When to use:**
- Deploying a complete infrastructure definition
- Ensuring the resource group only contains resources defined in the template
- Cleaning up resources that were manually added outside the template

**Risk:**
- Accidental deletion of resources not tracked in the template; use with care in production

**Example:**
```bash
az deployment group create \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --mode Complete
```

### Incremental Mode (Default)

In incremental mode, Azure Resource Manager only creates or updates resources defined in the template. Resources not in the template are left unchanged.

**When to use:**
- Most production deployments
- When the template doesn't represent the entire resource group
- When other systems or teams manage additional resources in the same group

**Safety:**
- Partial templates can coexist in the same resource group
- Manual resources are not deleted when using incremental mode

**Example:**
```bash
az deployment group create \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --mode Incremental
```

---

## What-If Deployments

Before deploying, preview what changes will be made to resources.

**Syntax:**
```bash
az deployment group what-if \
  --resource-group myresourcegroup \
  --template-file main.bicep \
  --parameters location=eastus environment=prod
```

**Output shows:**
- **Create:** Resources that will be created
- **Modify:** Resources that will be updated, listing which properties will change
- **Delete:** Resources that will be removed (only in Complete mode)
- **Ignore:** Resources outside the template scope

This preview helps catch unintended changes before they deploy to production.

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
| **Type safety** | Full type checking | None | Basic type support |
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

**Result:** Secrets appear in deployment logs and can be retrieved by querying outputs.

**Solution:** Mark sensitive outputs as sensitive and avoid exposing credentials directly. Use Azure Key Vault references or managed identity authentication instead.

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

## Key Takeaways

1. **Bicep simplifies infrastructure as code for Azure.** It provides cleaner syntax than ARM JSON while maintaining full access to Azure Resource Manager capabilities and supporting immediate access to new Azure features.

2. **Bicep transpiles to ARM JSON automatically.** You never write JSON by hand; Bicep handles compilation during deployment. This separation ensures that Bicep improvements don't break existing templates.

3. **Dependencies are inferred from resource references.** When one resource references another, Bicep automatically establishes the dependency order. Use explicit `dependsOn` only when the dependency is not captured by a property reference.

4. **Parameters enable template reusability.** Use parameters with type validation and decorators to accept different values for different environments without duplicating template logic.

5. **Variables reduce duplication and compute derived values.** Variables cannot be changed at deployment time but are useful for constructing names, storing computed values, and storing reusable expressions.

6. **Modules are the primary mechanism for template composition.** Break large templates into modules for clarity, reusability, and easier maintenance. Modules can accept parameters and produce outputs just like functions.

7. **Scope levels range from resource groups to tenants.** Most deployments target resource groups, but Bicep also supports subscription-level deployments for multi-resource-group scenarios, management group policies, and tenant-level resources.

8. **Type checking catches errors during validation.** Bicep enforces parameter types and validates property names and types against the ARM schema, preventing runtime errors from typos or invalid property combinations.

9. **What-if deployments preview changes before deployment.** Always use what-if to see what will change, be created, or be deleted before committing to a deployment, especially in production.

10. **Bicep is Azure-native and preferred over ARM JSON.** If you are deploying only to Azure, Bicep is the better choice. Use Terraform only if you need multi-cloud support or your team requires it.
