---
title: "ARM Templates & Deployment Patterns"
layout: guide
category: Azure
subcategory: Infrastructure as Code
description: "ARM JSON template structure and functions, deployment modes and scopes, nested and linked templates, template specs, deployment stacks, and migrating from ARM to Bicep."
tags: [arm-templates, bicep, iac, deployment-modes, deployment-stacks, template-specs, practical]
---

## What Are ARM Templates

[Azure Resource Manager (ARM) templates](https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/overview){:target="_blank" rel="noopener noreferrer"} are JSON files that define your entire Azure infrastructure. You submit a template to Azure, and Resource Manager parses it, validates it, and deploys all resources in the correct order.

ARM templates are **the foundational deployment format for Azure**. Every deployment to Azure goes through the ARM deployment plane. When you use [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview){:target="_blank" rel="noopener noreferrer"} (Azure's modern IaC language), it compiles down to ARM JSON at deployment time. When you use the Azure Portal's graphical interface, it generates ARM templates behind the scenes.

### Why ARM Templates Still Matter

Modern Azure development increasingly uses Bicep, but ARM templates remain critical knowledge because:

**Legacy codebases:** Organizations have years of investments in ARM templates. Understanding ARM is essential when maintaining or migrating these templates.

**Bicep compilation:** When you deploy a Bicep template, Azure compiles it to ARM JSON. Understanding the compiled output helps debug issues and understand what actually gets deployed.

**Generated outputs:** Azure tools and services generate ARM templates automatically. Portal-based configuration exports generate ARM JSON. Understanding the structure helps you work with these generated files.

**Integration and tooling:** Many Azure services output ARM templates as part of their export/backup functionality. CI/CD pipelines often work directly with ARM templates.

**Capability reference:** The ARM reference documentation is the authoritative definition of every Azure resource and property. When Bicep hides complexity, the ARM docs show what's actually possible.

---

## ARM Template Structure

Every ARM template is a JSON file with this basic structure:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": { },
  "variables": { },
  "functions": [ ],
  "resources": [ ],
  "outputs": { }
}
```

### Schema and Content Version

The `$schema` URI identifies which version of the ARM template language you're using, and it also encodes the deployment scope. `https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#` is the current resource group schema. Older editors that can't process it fall back to the `2015-01-01` equivalent. Subscription, management group, and tenant deployments each use a different URI, listed under Deployment Scope below.

The `contentVersion` is a string you control. It helps you track template versions and has no impact on deployment, working like a semantic version number for the template itself.

### Parameters

Parameters allow template users to provide values at deployment time instead of hardcoding them. Parameters appear in the Azure Portal UI, CLI prompts, and automation scripts.

**Example parameter:**

```json
"parameters": {
  "location": {
    "type": "string",
    "defaultValue": "eastus",
    "metadata": {
      "description": "Azure region for resources"
    },
    "allowedValues": [
      "eastus",
      "westus",
      "northeurope"
    ]
  },
  "environmentName": {
    "type": "string",
    "minLength": 1,
    "maxLength": 10
  },
  "vmCount": {
    "type": "int",
    "defaultValue": 2,
    "minValue": 1,
    "maxValue": 10
  }
}
```

**Parameter types:**
- String, int, bool
- array, object
- secureString (hidden in logs/history)
- secureObject (for sensitive objects like secrets)

### Variables

Variables are computed values calculated once at deployment time. Use variables to avoid repeating complex expressions throughout your template.

**Example variables:**

```json
"variables": {
  "resourcePrefix": "[concat(parameters('environmentName'), '-rg')]",
  "vnetName": "[concat(variables('resourcePrefix'), '-vnet')]",
  "subnetName": "[concat(variables('resourcePrefix'), '-subnet')]",
  "uniqueId": "[uniqueString(resourceGroup().id)]",
  "storageAccountName": "[concat('storage', variables('uniqueId'))]"
}
```

Variables can reference parameters, other variables, and template functions, but Resource Manager resolves them before any resource is deployed. That rules out the `reference` function and the `list*` functions, both of which read a resource's runtime state, and it rules out outputs. A template is limited to 256 parameters, 256 variables, 800 resources, and 64 outputs.

### Functions

The `functions` array holds user-defined functions, which wrap an expression you'd otherwise repeat throughout the template. Each one lives in a namespace to avoid colliding with built-in function names.

```json
"functions": [
  {
    "namespace": "contoso",
    "members": {
      "uniqueName": {
        "parameters": [
          { "name": "prefix", "type": "string" }
        ],
        "output": {
          "type": "string",
          "value": "[concat(parameters('prefix'), uniqueString(resourceGroup().id))]"
        }
      }
    }
  }
]
```

Call it as `"[contoso.uniqueName('storage')]"`. User-defined functions are deliberately sealed off from the rest of the template. They can't read variables, can't call the `reference` function, can't call each other, and can only see the parameters declared on the function itself.

### Resources

The `resources` array contains all the Azure resources to be deployed. Each resource has a type (like `Microsoft.Compute/virtualMachines`), properties, and optionally dependencies.

**Basic resource structure:**

```json
"resources": [
  {
    "type": "Microsoft.Network/virtualNetworks",
    "apiVersion": "2025-01-01",
    "name": "[variables('vnetName')]",
    "location": "[parameters('location')]",
    "properties": {
      "addressSpace": {
        "addressPrefixes": ["10.0.0.0/16"]
      },
      "subnets": [
        {
          "name": "default",
          "properties": {
            "addressPrefix": "10.0.1.0/24"
          }
        }
      ]
    }
  }
]
```

**Resource references and dependencies:**

```json
{
  "type": "Microsoft.Compute/virtualMachines",
  "name": "myVM",
  "dependsOn": [
    "[resourceId('Microsoft.Network/networkInterfaces', 'myNIC')]"
  ],
  "properties": {
    "networkProfile": {
      "networkInterfaces": [
        {
          "id": "[resourceId('Microsoft.Network/networkInterfaces', 'myNIC')]"
        }
      ]
    }
  }
}
```

Use `dependsOn` to explicitly declare dependencies when ARM cannot infer them. Use `resourceId()` to reference other resources in the template.

### Outputs

Outputs are values computed at deployment time and returned to the user. Outputs can be used by other templates, scripts, or displayed to the person running the deployment.

**Example outputs:**

```json
"outputs": {
  "vnetId": {
    "type": "string",
    "value": "[resourceId('Microsoft.Network/virtualNetworks', variables('vnetName'))]"
  },
  "vnetName": {
    "type": "string",
    "value": "[variables('vnetName')]"
  },
  "deploymentInfo": {
    "type": "object",
    "value": {
      "region": "[parameters('location')]",
      "environment": "[parameters('environmentName')]"
    }
  }
}
```

---

## Template Functions and Expressions

ARM templates use a set of built-in functions and expression syntax to compute values dynamically.

### Reference and ResourceId Functions

**reference()** retrieves properties of a resource after it's deployed:

```json
"properties": {
  "storageEndpoint": "[reference(resourceId('Microsoft.Storage/storageAccounts', 'mystorage')).primaryEndpoints.blob]"
}
```

**resourceId()** generates the fully qualified ID of a resource:

```json
"[resourceId('Microsoft.Compute/virtualMachines', 'myVM')]"
"[resourceId(subscription().subscriptionId, 'myResourceGroup', 'Microsoft.Network/networkInterfaces', 'myNIC')]"
```

The optional first two arguments are the subscription and resource group. The subscription argument has to be a bare GUID, which is what `subscription().subscriptionId` returns. `subscription().id` returns the full `/subscriptions/{guid}` path and produces a malformed resource ID.

### String Functions

**concat()** joins strings together:

```json
"[concat('prefix-', parameters('environmentName'), '-suffix')]"
```

**format()** uses string formatting:

```json
"[format('https://{0}.blob.core.windows.net/', variables('storageAccountName'))]"
```

**split()** and **join()** work with delimited lists:

```json
"[split('a,b,c', ',')]"  // Returns ["a", "b", "c"]
"[join(createArray('a', 'b', 'c'), ',')]"  // Returns "a,b,c"
```

`createArray()` builds an array from a list of values. `array()` is a different function that converts a single value into a one-element array, so it takes exactly one argument.

**toLower()**, **toUpper()**, **substring()**, **replace()**, **contains()**: all standard string operations.

### Numeric and Array Functions

**length()** returns array or string length:

```json
"[length(parameters('nameList'))]"
```

**min()**, **max()** find extrema in arrays or lists of numbers:

```json
"[max(10, 20, 30)]"  // Returns 30
```

**range()** creates an array of integers:

```json
"[range(1, 5)]"  // Returns [1, 2, 3, 4, 5]
```

**filter()**, **map()** transform arrays using a lambda. Inside the lambda body, the iteration variable is read with `lambdaVariables()` rather than by bare name:

```json
"[filter(variables('items'), lambda('x', greater(lambdaVariables('x'), 5)))]"
```

### Conditional Functions

**if()** returns a value based on a condition:

```json
"[if(equals(parameters('environment'), 'prod'), 'Premium', 'Standard')]"
```

**equals()**, **not()**, **and()**, **or()** for boolean logic:

```json
"[and(equals(parameters('env'), 'prod'), not(empty(parameters('tags'))))]"
```

### Unique Value Functions

**uniqueString()** generates a pseudo-random string based on input:

```json
"[uniqueString(resourceGroup().id)]"
```

This is useful for creating globally unique names (like storage account names which must be globally unique across all Azure).

### Pseudo-Parameters

**resourceGroup()** provides information about the target resource group:

```json
"[resourceGroup().id]"
"[resourceGroup().name]"
"[resourceGroup().location]"
```

**subscription()** provides subscription information:

```json
"[subscription().id]"
"[subscription().subscriptionId]"
```

**deployment()** provides deployment metadata:

```json
"[deployment().name]"
```

---

## Loops, Copies, and Conditions

ARM templates support several mechanisms for creating multiple resources or configuring them conditionally.

### Copy Loops

**copy** creates multiple instances of a resource:

```json
"resources": [
  {
    "type": "Microsoft.Storage/storageAccounts",
    "name": "[concat('storage', copyIndex())]",
    "apiVersion": "2025-06-01",
    "location": "[parameters('location')]",
    "sku": {
      "name": "Standard_LRS"
    },
    "kind": "StorageV2",
    "copy": {
      "name": "storagecopy",
      "count": "[parameters('storageCount')]"
    }
  }
]
```

The `copyIndex()` function returns the current iteration (0, 1, 2, ...). You can also use `copyIndex()` for property-level copying to create multiple subnets within a single VNet resource.

### Conditions

**condition** controls whether a resource is deployed:

```json
"resources": [
  {
    "type": "Microsoft.Storage/storageAccounts",
    "condition": "[equals(parameters('environment'), 'prod')]",
    "name": "prodStorage",
    "apiVersion": "2025-06-01",
    "location": "[parameters('location')]",
    "sku": { "name": "Premium_LRS" },
    "kind": "StorageV2"
  }
]
```

Resources created with conditions can be referenced in outputs using the same condition, preventing errors when a conditionally deployed resource doesn't exist.

---

## Template Decomposition and Reuse

For complex deployments, ARM supports breaking templates into reusable pieces. All three mechanisms below deploy the same way, as a `Microsoft.Resources/deployments` resource inside the parent, and they differ only in where the child template lives.

### Linked Templates

**Linked templates** are separate templates deployed from a main template. The main template references external template URIs.

**Main template:**

```json
{
  "resources": [
    {
      "type": "Microsoft.Resources/deployments",
      "apiVersion": "2025-04-01",
      "name": "networkDeployment",
      "properties": {
        "mode": "Incremental",
        "templateLink": {
          "uri": "https://mystorageaccount.blob.core.windows.net/templates/network.json",
          "contentVersion": "1.0.0.0"
        },
        "parameters": {
          "location": {
            "value": "[parameters('location')]"
          }
        }
      }
    }
  ]
}
```

**How linked templates work:**

1. The main template references a URI pointing to the linked template (typically Azure Blob Storage or a raw GitHub URL)
2. Resource Manager downloads the linked template
3. The linked template deploys as its own `Microsoft.Resources/deployments` resource, targeting the parent's resource group unless it names a different one
4. The main template reads its results with `"[reference('networkDeployment').outputs.vnetId.value]"`

Every linked and nested deployment runs in Incremental mode. The `mode` property on the deployments resource accepts nothing else, though the root template that contains them can still be deployed in Complete mode.

The `relativePath` property removes the need to build full URIs by hand. Give it a path relative to the parent template's own location and Resource Manager resolves the rest:

```json
"templateLink": {
  "relativePath": "children/network.json"
}
```

**Advantages:**
- Reusable across multiple templates
- Can be versioned and stored separately
- Clear separation of concerns
- Allows team collaboration (different teams manage different templates)

**Disadvantages:**
- Resource Manager has to reach the template over HTTP or HTTPS, so a local path or an internal network location won't work
- A template behind an Azure Storage firewall can't be linked at all, and securing one with a SAS token puts that token in the deployment operations log
- More complex debugging (template chains)
- Additional API calls during deployment

### Nested Templates

**Nested templates** are templates embedded directly inside a parent template as a JSON object under the `template` property. They still deploy as a separate `Microsoft.Resources/deployments` resource, but there's only one file.

```json
{
  "resources": [
    {
      "type": "Microsoft.Resources/deployments",
      "apiVersion": "2025-04-01",
      "name": "nestedDeployment",
      "properties": {
        "mode": "Incremental",
        "expressionEvaluationOptions": {
          "scope": "inner"
        },
        "parameters": {
          "location": {
            "value": "[parameters('location')]"
          }
        },
        "template": {
          "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
          "contentVersion": "1.0.0.0",
          "parameters": {
            "location": { "type": "string" }
          },
          "resources": [
            {
              "type": "Microsoft.Storage/storageAccounts",
              "name": "mystorageaccount",
              "apiVersion": "2025-06-01",
              "location": "[parameters('location')]",
              "sku": { "name": "Standard_LRS" },
              "kind": "StorageV2"
            }
          ]
        }
      }
    }
  ]
}
```

**Advantages:**
- Self-contained; no external file dependencies
- Can pass complex expressions and outputs between parent and nested
- Easier to debug (everything in one place)

**Disadvantages:**
- Templates become large and hard to read
- Not easily reusable across multiple parents
- Difficult to version independently

#### Expression Evaluation Scope

`expressionEvaluationOptions` decides where `parameters()`, `variables()`, `resourceGroup()`, and `subscription()` resolve inside the nested body, and it defaults to `outer`, meaning the parent's scope. A nested template written under `outer` that calls `parameters('location')` gets the parent's `location` parameter, and the `parameters` block on the deployments resource has nothing to bind to.

```
   outer scope (the default)             inner scope
   ─────────────────────────             ─────────────────────────
   parent template                       parent template
     location = "eastus"                   location = "eastus"
            ▲                                     │
            │ resolved                            │ passed in as a
            │ up here                             │ deployment parameter
   ┌────────┴──────────────┐                      ▼
   │ nested template       │             ┌──────────────────────────┐
   │  (declares no         │             │ nested template          │
   │   parameters)         │             │  parameters: location ◄──┤
   │                       │             │                          │
   │  [parameters(         │             │  [parameters(            │
   │   'location')]        │             │   'location')]           │
   └───────────────────────┘             └──────────────────────────┘
     reads the parent's                    reads its own bound
     parameter                             parameter
```

Under `outer` scope you also can't use `reference()` in the nested template's `outputs` section for a resource that same nested template deployed, and any secure value passed through is written to the deployment history in plain text where anyone with read access can see it. Set `scope` to `inner` for a nested template that takes parameters or returns outputs. Templates declaring `"languageVersion": "2.0"` default to `inner` and reject `outer` outright.

### Template Specs

A [template spec](https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/template-specs){:target="_blank" rel="noopener noreferrer"} is a `Microsoft.Resources/templateSpecs` resource that stores a main template and its linked templates in Azure as a single versioned artifact. It exists to solve the hosting problem that linked templates create. Instead of a storage account, a SAS token, and an expiry to manage, you get an Azure resource with RBAC on it, and the built-in Template Spec Reader role lets someone deploy a template without being able to read or modify it.

```bash
az ts create \
  --name storageSpec \
  --version 1.0.0 \
  --resource-group templateSpecRG \
  --location eastus \
  --template-file main.json
```

The CLI walks the main template's `relativePath` links and packages the referenced files into the spec, so nothing needs staging first. Deploy by resource ID rather than by path, with the version baked into the ID:

```bash
az deployment group create \
  --resource-group demoRG \
  --template-spec "/subscriptions/{sub-id}/resourceGroups/templateSpecRG/providers/Microsoft.Resources/templateSpecs/storageSpec/versions/1.0.0"
```

Versions are free-form strings and unlimited in number, so semantic versioning works if you want it. A spec is capped at roughly 2 MB, past which you split it and link the pieces.

### When to Use Which

**Use linked templates when:**
- You want reusable components shared across many deployments
- Different teams manage different infrastructure domains
- Templates are large and benefit from separation
- You can reliably host template files in a URI-accessible location

**Use nested templates when:**
- You want self-contained deployments with no external dependencies
- Components are only used in this one parent template
- You're doing simple decomposition for readability

**Use template specs when:**
- The template is shared across teams and you'd rather manage access with RBAC than with SAS tokens
- Callers should be able to deploy a template without being able to change it
- You need published versions that consumers pin to explicitly

---

## Deployment Modes

ARM deployments operate in two modes, each with different implications for existing resources. Incremental is the default.

### Incremental Mode

**Incremental deployment** adds or updates resources specified in the template while leaving everything else untouched.

```json
{
  "properties": {
    "mode": "Incremental"
  }
}
```

**What happens:**
- Resources in the template are created or updated
- Resources in the resource group that aren't in the template are left alone

The word incremental describes what happens to the *resource group*, not to an individual resource. When a resource in the template already exists, Resource Manager reapplies the whole definition rather than merging your changes into what's already there. Properties you leave out are reset to their defaults instead of being preserved, so a template has to carry every non-default value for a resource, not just the ones you're changing.

Two resource types make this especially sharp. Define subnets through the `subnets` property on the virtual network rather than as standalone `Microsoft.Network/virtualNetworks/subnets` resources, or redeploying the VNet drops them. Web app site configuration behaves the other way around: an empty `Microsoft.Web/sites/config` object leaves the existing settings alone, while a populated one replaces them.

**Safe for:** Most deployments, and the mode Microsoft recommends.

**Risk:** If your template is incomplete or you forget to include a resource, the old resource remains.

### Complete Mode

**Complete deployment** replaces everything in the scope. Resources in the template are created or updated, and resources not in the template are **deleted**.

```json
{
  "properties": {
    "mode": "Complete"
  }
}
```

Microsoft now advises against complete mode and is phasing it out, pointing anyone who needs deletion at deployment stacks instead. Treat what follows as maintenance knowledge for templates that already use it rather than as a pattern to adopt.

**What happens:**
- Resources in the template are created or updated
- Resources in the resource group that are not in the template are **deleted**

**Safe for:** Resource groups created solely for this template, where the template describes the complete desired state.

**Risk:** If your template is incomplete or accidentally excludes a resource, that resource is deleted, causing data loss or downtime.

Complete mode also carries restrictions that catch people out. Only the root template can use it, so linked and nested templates are always Incremental. Subscription-level deployments don't support it at all, and neither does the portal. A lock on the resource group stops the deletions. Some child resources survive on their own but go when their parent is deleted, so leaving a DNS zone out of the template takes its CNAME records with it while leaving out only the CNAME record deletes nothing. A resource whose `condition` evaluates to false counts as absent and gets deleted under API version 2019-05-10 or later, which is what current Azure CLI and PowerShell use.

### Deployment Scope

Deployments target one of four scopes, and the scope determines both the `$schema` URI and what you're allowed to deploy. All four URIs are rooted at `https://schema.management.azure.com/schemas/`.

| Scope | Schema path | Typical contents |
| --- | --- | --- |
| Resource group | `2019-04-01/deploymentTemplate.json#` | Most resources: VMs, networks, storage, databases |
| Subscription | `2018-05-01/subscriptionDeploymentTemplate.json#` | Resource groups, policy assignments, subscription-scoped role assignments |
| Management group | `2019-08-01/managementGroupDeploymentTemplate.json#` | Policy definitions and assignments, role assignments spanning subscriptions |
| Tenant | `2019-08-01/tenantDeploymentTemplate.json#` | Management groups, subscriptions, tenant-wide role assignments |

The `resourceId()` function only works for resource group scope. Subscription, management group, and tenant resources need `subscriptionResourceId()`, `managementGroupResourceId()`, and `tenantResourceId()` respectively, and extension resources like a policy assignment need `extensionResourceId()`.

---

## Deployment Stacks

A [deployment stack](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deployment-stacks){:target="_blank" rel="noopener noreferrer"} is a `Microsoft.Resources/deploymentStacks` resource that owns the set of resources a template describes. It covers the two things a plain ARM deployment can't do, which are deleting resources that fall out of the template and stopping someone from changing what the template deployed. Stacks accept ARM JSON templates, Bicep files, and template specs, so an existing ARM codebase can adopt them without being converted first.

When you update a stack and a resource is no longer in the template, `actionOnUnmanage` decides what happens to it:

| Value | Behavior |
| --- | --- |
| `detachAll` | Leave the resources and resource groups in place and stop tracking them |
| `deleteResources` | Delete the resources, leave the resource groups |
| `deleteAll` | Delete the resources and the resource groups |

Deny settings put a deny assignment on the managed resources so nobody edits them out of band. `denySettingsMode` takes `none`, `denyDelete`, or `denyWriteAndDelete`, with escape hatches for up to 200 excluded actions and five excluded principals. Because five is a hard ceiling that fails silently rather than erroring, exclude Microsoft Entra groups rather than individual identities. The deny assignment covers control-plane operations only, so blob containers and Key Vault secrets created through the data plane fall outside it, as do resources Azure creates implicitly like the VMs behind an AKS cluster.

```bash
az stack group create \
  --name app-stack \
  --resource-group myRG \
  --template-file main.json \
  --action-on-unmanage deleteResources \
  --deny-settings-mode denyWriteAndDelete
```

A stack lives at resource group, subscription, or management group scope, and that scope is where the deny assignment lands too. Creating the stack one level above the resources it manages keeps the people working inside the resource group from being able to edit the stack that protects it. Stacks need Azure CLI 2.61.0 or later, or Azure PowerShell 12.0.0 or later.

---

## Parameter Files and Environment Management

ARM templates are separated from their input values using parameter files.

**main.json (template):**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": { "type": "string" },
    "environmentName": { "type": "string" },
    "vmSize": { "type": "string" }
  },
  "resources": [
    {
      "type": "Microsoft.Compute/virtualMachines",
      "name": "[concat(parameters('environmentName'), '-vm')]",
      "location": "[parameters('location')]",
      "properties": {
        "hardwareProfile": {
          "vmSize": "[parameters('vmSize')]"
        }
      }
    }
  ]
}
```

**parameters-dev.json:**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": { "value": "eastus" },
    "environmentName": { "value": "dev" },
    "vmSize": { "value": "Standard_B2s" }
  }
}
```

**parameters-prod.json:**

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": { "value": "eastus" },
    "environmentName": { "value": "prod" },
    "vmSize": { "value": "Standard_D2s_v3" }
  }
}
```

**Deployment via CLI:**

```bash
az deployment group create \
  --resource-group myRG \
  --template-file main.json \
  --parameters @parameters-prod.json
```

The `@` prefix is what tells Azure CLI the argument is a file rather than an inline `name=value` pair. You can combine the two, and an inline value overrides the same parameter in the file. That's convenient for a one-off override, but a template deployed with an *external* parameter file (one passed by URI) ignores every inline value, so all of them have to be in the file.

Parameter files store their values as plain text, which makes them the wrong place for a password or a key. Reference the secret from a key vault instead, and Resource Manager retrieves it at deployment time:

```json
"adminPassword": {
  "reference": {
    "keyVault": {
      "id": "/subscriptions/{sub-id}/resourceGroups/secretsRG/providers/Microsoft.KeyVault/vaults/myVault"
    },
    "secretName": "vmAdminPassword"
  }
}
```

This separation allows the same template to be deployed to multiple environments with different configuration values.

---

## Template Validation and What-If Deployments

Before deploying, validate templates to catch errors early.

### Validation

**Validate** checks template syntax and properties without actually deploying:

```bash
az deployment group validate \
  --resource-group myRG \
  --template-file main.json \
  --parameters @parameters-prod.json
```

Validation confirms that the template is well-formed, that every parameter it needs has a value, and that expressions resolve. It doesn't confirm that a referenced resource actually exists, that quota is available, or that the design works. A template can validate cleanly and still fail halfway through a deployment.

### What-If Deployment

**What-If** shows what changes would be made if you deployed:

```bash
az deployment group what-if \
  --resource-group myRG \
  --template-file main.json \
  --parameters @parameters-prod.json
```

What-If shows:

- Which resources will be created
- Which resources will be deleted
- Which resources will be modified (and what properties change)
- Which resources will be unchanged

This is especially useful before running a Complete mode deployment to ensure you don't accidentally delete resources.

---

## ARM Template Limitations and Pain Points

ARM templates are powerful but have drawbacks that motivated the creation of Bicep.

### Verbosity and Boilerplate

ARM templates are verbose. Simple deployments require lots of JSON. Bicep was designed to be more concise while compiling to ARM JSON.

**ARM example (repetitive):**

```json
{
  "type": "Microsoft.Storage/storageAccounts",
  "apiVersion": "2025-06-01",
  "name": "[concat('storage', uniqueString(resourceGroup().id))]",
  "location": "[parameters('location')]",
  "sku": {
    "name": "Standard_LRS"
  },
  "kind": "StorageV2",
  "properties": {},
  "resources": [
    {
      "type": "blobServices/containers",
      "apiVersion": "2025-06-01",
      "name": "default/mycontainer",
      "dependsOn": [
        "[resourceId('Microsoft.Storage/storageAccounts', concat('storage', uniqueString(resourceGroup().id)))]"
      ]
    }
  ]
}
```

The `dependsOn` isn't optional boilerplate here. Nesting a child resource inside its parent does not create an implicit dependency, so the child has to declare one.

### Looping Is a Property, Not a Language Construct

`copy` is a property you attach to a resource, a variable, a property, or an output, each with slightly different syntax and its own `copyIndex()` behavior. There's no nesting and no way to iterate over one loop inside another. Bicep's `for` expression covers the same ground with one construct.

### Decomposition Is Bolted On

ARM has no native module keyword. Reuse comes from linked templates and template specs, and both mean an extra deployments resource, an extra hop, and a separate entry in the deployment history. Bicep's `module` compiles down to exactly that nested deployment, but you write it as a few lines instead of a wrapper object.

### Weak Type Validation

ARM validates the shape of the template itself, not the property names inside a resource body. Misspell a property and the deployment often succeeds while silently ignoring what you wrote, which is harder to notice than an outright failure. Templates that declare `"languageVersion": "2.0"` can define reusable types in a `definitions` section and constrain parameters and outputs against them, but that does nothing for resource bodies. The VS Code ARM Tools extension and the Bicep compiler catch far more before you deploy than Resource Manager does.

### Complex Expressions

Using many nested functions makes templates hard to read:

```json
"[concat(variables('prefix'), '-', parameters('environment'), '-', uniqueString(deployment().name))]"
```

Bicep allows simpler string interpolation:

```bicep
'${prefix}-${environment}-${uniqueString(deployment().name)}'
```

---

## Migration from ARM to Bicep

Bicep is the modern approach for Azure IaC. Organizations with existing ARM templates can migrate incrementally.

### Decompile ARM to Bicep

The **Bicep CLI** can decompile ARM JSON templates to Bicep:

```bash
az bicep decompile --file main.json
```

This generates `main.bicep` from `main.json`. The generated Bicep is functionally equivalent but may not be perfectly idiomatic. You should review and refactor the decompiled Bicep for readability. Decompilation is best-effort and produces warnings rather than guarantees, so treat the output as a starting draft and redeploy it against a test resource group before trusting it.

### Incremental Migration

You don't need to convert everything at once:

1. Start with new infrastructure using Bicep
2. Gradually convert ARM templates to Bicep as they're updated
3. Use Bicep modules to wrap reusable pieces
4. Reference existing ARM deployments during the transition

Bicep compiles to ARM JSON, so new Bicep deployments and old ARM deployments coexist without conflict.

### Strategy for Large Codebases

**For organizations with hundreds of ARM templates:**

1. **Prioritize:** Identify frequently-changed templates and high-value deployments
2. **Create module wrappers:** Wrap ARM templates in Bicep modules to provide a consistent interface
3. **Decompile strategically:** Decompile high-value templates and refactor the output
4. **New development in Bicep:** All new infrastructure uses Bicep from the start
5. **Phase-out ARM:** Over time, convert or retire ARM templates

---

## ARM vs Bicep vs Terraform Decision Framework

All three are valid IaC approaches on Azure. The choice depends on your context.

| Aspect | ARM Templates | Bicep | Terraform |
|--------|---|---|---|
| **Language** | JSON | Bicep DSL (compiles to ARM) | HCL |
| **Learning curve** | Steeper (JSON verbosity) | Gentler (familiar syntax) | Moderate (HCL) |
| **Azure coverage** | Complete (native) | Complete (via ARM) | Broad, with provider lag on newly released services |
| **Multi-cloud** | Azure only | Azure only | AWS, GCP, Azure, others |
| **Community support** | Large (Microsoft) | Growing (Microsoft) | Very large (open source) |
| **State management** | None (stateless) | None (stateless) | Required (state files) |
| **Drift detection** | What-If | What-If | Plan shows drift |
| **Maturity** | Mature (many years) | Newer (actively improving) | Very mature (multi-year) |
| **Team expertise** | Likely exists | Smaller community | Highly valued skill |

```
                  Do you deploy to more than one cloud?
                                 │
              ┌──────────────────┴──────────────────┐
             yes                                    no
              │                                     │
          Terraform                    Is this a new template?
                                                    │
                                 ┌──────────────────┴──────────────────┐
                                yes                                    no
                                 │                                     │
                               Bicep                   Does it change more than rarely?
                                                                       │
                                                    ┌──────────────────┴──────────────┐
                                                   yes                                no
                                                    │                                 │
                                          decompile to Bicep                 leave it as ARM
```

### When to Use ARM

- **Legacy codebases:** Existing ARM templates don't justify immediate conversion
- **Azure-only shops:** No multi-cloud needs and deep Azure expertise
- **Generated outputs:** Portal or tool-generated templates are already ARM

### When to Use Bicep

- **New Azure deployments:** All new projects should start with Bicep
- **Modern syntax preference:** Teams prefer readable syntax over JSON
- **Azure specialists:** Your team knows Azure deeply and doesn't need multi-cloud support
- **Migration from ARM:** Converting existing ARM templates to Bicep for maintainability

### When to Use Terraform

- **Multi-cloud architectures:** Support for AWS, GCP, Azure, and other providers
- **Polyglot teams:** HCL expertise is more widely available than Bicep
- **Platform engineering:** Building abstractions that work across clouds
- **State management requirements:** Organizations with sophisticated state/drift management needs

---

## Common Pitfalls

### Pitfall 1: Using Complete Mode Without Careful Planning

**Problem:** Deploying in Complete mode with an incomplete template deletes unintended resources.

**Result:** Data loss, service interruptions, or deleted configurations.

**Solution:** Prefer a deployment stack, which is where Microsoft is taking resource deletion and which shows you the managed resource list before it acts. Where complete mode is already in place, run What-If every time and restrict it to resource groups the template owns end to end. For resource groups holding anything managed outside the template, use Incremental mode.

---

### Pitfall 2: Hard-Coded Values Instead of Parameters

**Problem:** Embedding environment-specific values directly in the template (location, VM sizes, SKUs).

**Result:** Template is not reusable. Each environment requires a separate template copy.

**Solution:** Use parameters for all values that vary between environments or users. Provide sensible defaults for parameters.

---

### Pitfall 3: Incorrect Resource Dependencies

**Problem:** Resources can deploy in any order, but your infrastructure has dependencies (e.g., NIC before VM). Omitting explicit `dependsOn` may cause race conditions.

**Result:** Deployment fails intermittently or resources deploy in wrong order causing configuration errors.

**Solution:** ARM infers a dependency whenever one resource references another through `reference()` or `resourceId()`, and those inferred dependencies are usually enough. Add `dependsOn` where no such reference exists, most commonly for a child resource nested inside its parent, which gets no implicit dependency. Avoid adding dependencies that aren't needed, since they serialize deployments that could have run in parallel and can produce circular references.

---

### Pitfall 4: Linked Template URI Access Issues

**Problem:** Linked templates stored in Blob Storage become inaccessible due to firewall rules, missing SAS tokens, or incorrect permissions.

**Result:** Deployment fails with "Unable to download template" errors.

**Solution:** Use a template spec, which stores the linked templates alongside the main one and gates access with RBAC instead of a URI. Where blob storage is already in use, confirm the URI resolves from outside your network before deploying, keep SAS token lifetimes short, and remember that a storage account behind a firewall can't serve linked templates at all. Nested templates avoid the problem entirely for small cases.

---

### Pitfall 5: Forgetting to Reference Outputs

**Problem:** Linked template outputs are available but never used, so deployments don't propagate information other systems need.

**Result:** Other infrastructure or scripts don't have the information they need (like resource IDs or connection strings).

**Solution:** Design templates to output critical information (resource IDs, endpoints, connection strings). Return these from linked templates to parent deployments.

---

### Pitfall 6: Outdated API Versions

**Problem:** Using very old API versions (e.g., `2015-08-01`) that have been deprecated.

**Result:** Properties that don't exist in the old API version cause the deployment to fail, and newer features stay out of reach.

**Solution:** Use current API versions. Reference the [Azure Resource Manager schema documentation](https://learn.microsoft.com/en-us/azure/templates/){:target="_blank" rel="noopener noreferrer"} for current versions.

---

### Pitfall 7: Complex Resource Interdependencies in Large Templates

**Problem:** Large templates with many resources become difficult to understand what depends on what.

**Result:** Changes to one resource cause unexpected failures in others, and debugging is painful.

**Solution:** Break large templates into logical pieces using linked or nested templates. Each piece handles a cohesive infrastructure domain (networking, compute, data). This improves readability and reduces accidental coupling.

---

## Key Takeaways

1. **ARM templates are fundamental to Azure.** Every deployment to Azure goes through the ARM deployment plane. Understanding ARM is essential for working effectively with Azure infrastructure.

2. **ARM's role is foundational, not deprecated.** Bicep compiles to ARM, making ARM knowledge relevant even in modern Bicep-based deployments. ARM understanding helps debug compiled Bicep output.

3. **Parameters and variables separate concerns.** Templates define structure; parameter files provide values. This separation enables the same template to deploy to multiple environments.

4. **Incremental is the default, but it isn't a merge.** Resources outside the template are left alone, while each resource inside it is reapplied in full, so any property you omit resets to its default. Complete mode deletes whatever the template doesn't name and is being phased out in favor of deployment stacks.

5. **Deployment stacks are how you delete and protect resources now.** A stack owns the resources its template describes, deletes or detaches them when they leave the template, and can apply a deny assignment so nobody edits them out of band. Stacks work with ARM JSON, not just Bicep.

6. **Linked templates, nested templates, and template specs trade reusability for complexity.** Linked templates enable reuse but need an endpoint Resource Manager can reach. Nested templates are self-contained, and their `expressionEvaluationOptions` scope decides where parameters and variables resolve. Template specs store either kind in Azure and share them through RBAC instead of SAS tokens.

7. **Copies and conditions enable complex deployments without duplication.** Use `copy` for multiple resource instances and `condition` to deploy resources conditionally based on parameters.

8. **Template functions enable dynamic configuration.** Functions like `reference()`, `uniqueString()`, `concat()`, and `if()` make templates flexible and reusable without hardcoding. Variables resolve before deployment starts, which is why they can't call `reference()` or the `list*` functions.

9. **Validation and What-If prevent deployment disasters.** Validation only proves the template is processable. Run What-If before anything that can delete, whether that's a complete-mode deployment or a stack update carrying a delete flag.

10. **Bicep is the modern approach, but ARM knowledge remains relevant.** New projects should use Bicep, but understanding ARM's structure, functions, and limitations is necessary for working with existing infrastructure.

11. **Large templates need decomposing before they become unmaintainable.** Break them into logical pieces using linked or nested templates, one cohesive infrastructure domain at a time.
