---
title: "Azure Machine Learning: ML Platform Essentials"
layout: guide
category: Azure
subcategory: Machine Learning & AI
description: "Azure Machine Learning for architects: workspaces and their associated resources, compute targets and their constraints, pipelines and components, the model registry, managed endpoints, model monitoring signals, and Responsible AI dashboard limits."
tags: [azure-ml, mlops, mlflow, model-endpoints, automl, responsible-ai, practical]
---

## What Is Azure Machine Learning

[Azure Machine Learning](https://learn.microsoft.com/en-us/azure/machine-learning/overview-what-is-azure-machine-learning){:target="_blank" rel="noopener noreferrer"} is a managed platform for training, tracking, registering, and deploying machine learning models. It supports several ways in: the [Python SDK v2](https://learn.microsoft.com/en-us/azure/machine-learning/concept-v2){:target="_blank" rel="noopener noreferrer"} (`azure-ai-ml`), the [CLI v2](https://learn.microsoft.com/en-us/azure/machine-learning/reference-azure-machine-learning-cli){:target="_blank" rel="noopener noreferrer"} for YAML-defined jobs, the studio UI, and the [Designer](https://learn.microsoft.com/en-us/azure/machine-learning/concept-designer){:target="_blank" rel="noopener noreferrer"} for visual pipeline building. It includes [AutoML](https://learn.microsoft.com/en-us/azure/machine-learning/concept-automated-ml){:target="_blank" rel="noopener noreferrer"}, native [MLflow](https://learn.microsoft.com/en-us/azure/machine-learning/concept-mlflow){:target="_blank" rel="noopener noreferrer"} tracking, a model registry, model monitoring, and the [Responsible AI dashboard](https://learn.microsoft.com/en-us/azure/machine-learning/concept-responsible-ai-dashboard){:target="_blank" rel="noopener noreferrer"}.

It sits between raw infrastructure (running training on your own VMs or Kubernetes) and fully managed prediction APIs (Azure AI services, where you consume a model rather than train one). You keep control of the training code, the data, and the preprocessing, and Azure ML handles compute provisioning, experiment metadata, environment reproducibility, and endpoint hosting.

### What Problems It Solves

**Without Azure ML:**
- Teams provision VMs or clusters, install frameworks, and manage compute lifecycle by hand
- Experiment tracking and model versioning need a custom solution or a third-party tool
- Nothing centrally records which data, code, and parameters produced a given model
- Deployment means building container images, inference servers, and scaling infrastructure yourself
- Drift goes unnoticed until a business metric moves

**With Azure ML:**
- Workspaces group all ML assets, and managed compute provisions on demand and scales to zero
- MLflow tracking is automatic, and models are versioned in a workspace registry
- Job runs snapshot code, environment, and data references, so a model traces back to its inputs
- Managed online endpoints and batch endpoints handle hosting, scaling, and traffic splitting
- Model monitoring compares production inference data against a reference window and raises alerts

---

### How Azure ML Differs from AWS SageMaker

| Concept | AWS SageMaker | Azure Machine Learning |
|---------|---------------|-----------------------|
| **Top-level container** | No single workspace; resources spread across services | Workspace is the top-level resource holding all assets |
| **Experiment tracking** | SageMaker Experiments | MLflow-native, and tracking is automatic for jobs |
| **Model registry** | SageMaker Model Registry, with approval status built in | Workspace model registry with name, version, tags, and lineage, but no promotion stages |
| **Cross-team asset sharing** | Model Registry across accounts | Azure ML registries, separate from the workspace registry |
| **Managed training compute** | Training jobs, one instance type per job | Compute clusters (one VM size each) and serverless compute |
| **Interactive development** | Notebook instances or Studio spaces | Compute instances, single-user VMs with Jupyter and VS Code |
| **Real-time inference** | Endpoints with production variants | Managed online endpoints with multiple deployments and traffic splitting |
| **Batch inference** | Batch Transform | Batch endpoints running on compute clusters |
| **AutoML** | Autopilot | AutoML, integrated into the workspace |
| **Responsible AI** | Clarify for bias and explainability | Responsible AI dashboard, with tight model-type constraints |

SageMaker gives finer control over training infrastructure at the cost of assembling more separate services. Azure ML puts more in one resource and standardizes on MLflow, which reduces setup for teams running repeated train-and-deploy cycles. The trade-off appears in the constraint rows: several Azure ML conveniences (the RAI dashboard, model monitoring) work only on specific model types and data shapes.

---

## Workspaces

### The Workspace and Its Associated Resources

A [workspace](https://learn.microsoft.com/en-us/azure/machine-learning/concept-workspace){:target="_blank" rel="noopener noreferrer"} is the top-level Azure ML resource. It holds jobs, experiments, data assets, models, components, environments, endpoints, compute, and datastore definitions, and it is the unit of access control and cost reporting.

Creating a workspace also brings in other Azure resources. Azure ML creates them if you do not supply your own:

| Resource | Role | Required |
|---|---|---|
| **Azure Storage account** | Stores artifacts, job logs, and compute instance notebooks. The workspace default upload target. | Yes |
| **Azure Key Vault** | Stores secrets that compute targets and the workspace need | Yes |
| **Application Insights** | Diagnostics and metrics from inference endpoints | Yes |
| **Azure Container Registry** | Stores images built for custom environments | **No.** Provisioned on demand the first time an image is built. |

The storage account carries constraints that catch teams out. You **cannot** use an existing account that is of type BlobStorage, is premium (`Premium_LRS` or `Premium_GRS`), or has **hierarchical namespace enabled**. That last one is the trap: an ADLS Gen2 account cannot be the workspace's default storage. Attach it as an additional datastore instead, which is fully supported and the normal arrangement for training data.

Two more constraints bind the layout permanently. A workspace **cannot be moved to a different subscription**, and the owning subscription cannot be moved to a new tenant.

### Workspace Scope and Layout

| Scope | What it holds |
|---|---|
| **Subscription and resource group** | The workspace and its associated resources. Quota for managed compute is set at subscription level. |
| **Hub workspace** | Shared security settings, connections, and compute across several project workspaces. Hub workspaces are the same resource type as Foundry hubs, so they can be used from both Azure ML studio and Foundry. |
| **Workspace** | Jobs, data assets, models, components, environments, endpoints, compute, datastores |
| **Registry** | Models, components, and environments shared **across** workspaces and regions |

Microsoft's guidance is one workspace per project, which scopes cost reporting and datastore configuration to a single deliverable. Separate workspaces per environment (dev, staging, production) give isolation, and a **registry** is how an asset crosses that boundary: you promote a model or component to a registry and consume it from another workspace, rather than sharing one workspace between environments.

### Access Control

Azure ML ships three [built-in roles](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-assign-roles){:target="_blank" rel="noopener noreferrer"} beyond the generic Owner, Contributor, and Reader:

| Role | Grants |
|---|---|
| **AzureML Data Scientist** | Everything inside a workspace **except** creating or deleting compute and modifying the workspace itself |
| **AzureML Compute Operator** | Create, manage, delete, and access compute resources in a workspace |
| **AzureML Registry User** | Read, write, and delete assets inside a registry. Cannot create or delete registries. |

Combine them for self-service: a data scientist who also needs to spin up their own compute gets both AzureML Data Scientist and AzureML Compute Operator. Where the built-ins do not fit, the workspace resource provider actions support custom roles, and the common shape is `Actions: ["*"]` with compute writes and workspace writes in `NotActions`.

One behavior changed recently and matters for anyone auditing permissions. The workspace's own system-assigned managed identity used to receive **Contributor** on the containing resource group. Workspaces created after **19 November 2024** get the narrower **Azure AI Administrator** role instead. Older workspaces keep Contributor until converted, either through the REST API or `az ml workspace update --allow-roleassignment-on-rg true`.

For network isolation, workspaces support [private endpoints](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-configure-private-link){:target="_blank" rel="noopener noreferrer"} and a managed virtual network. Note that model monitoring does not work under the `AllowOnlyApprovedOutbound` managed network setting, so lock down the network with that dependency in mind.

---

## Compute Targets

### Compute Instances

A [compute instance](https://learn.microsoft.com/en-us/azure/machine-learning/concept-compute-instance){:target="_blank" rel="noopener noreferrer"} is a managed **single-user** VM for interactive development, preloaded with Jupyter, VS Code integration, and the SDK. It has a **120 GB OS disk**, which fills up faster than people expect on image or checkpoint-heavy work.

Cost control has one detail that surprises people: stopping a compute instance stops the compute-hour charge, but you **still pay for the disk, the public IP, and the standard load balancer**. Enable **idle shutdown** so an instance forgotten on a Friday does not run all weekend.

### Compute Clusters

A [compute cluster](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-create-attach-compute-cluster){:target="_blank" rel="noopener noreferrer"} is a managed, autoscaling pool of VMs for submitted jobs. You set minimum and maximum node counts, and it scales up on submission and down when idle. Setting the minimum to **zero** is what makes an idle cluster free.

**A cluster has one VM size, chosen at creation.** You cannot mix CPU and GPU nodes, or two different VM sizes, in a single cluster. A pipeline with a CPU preprocessing step and a GPU training step uses two clusters and assigns compute per node, not one heterogeneous cluster.

### Serverless Compute

[Serverless compute](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-use-serverless-compute){:target="_blank" rel="noopener noreferrer"} is Azure ML managed compute that you never create. You submit a job with `compute="serverless"` and specify the instance type and count on the job itself, and Azure ML provisions, runs, and tears down. It is not AKS and not Container Instances. Alongside compute clusters and compute instances, it is one of the three managed compute types.

Microsoft's current guidance points here first: "Instead of creating a compute cluster, use serverless compute to offload compute lifecycle management to Azure Machine Learning." A cluster still earns its place when you need a fixed quota reservation, a persistent minimum node count for latency, or a specific network configuration.

### Attached and Kubernetes Compute

**Azure ML Kubernetes** attaches an AKS or Arc-enabled Kubernetes cluster for both training and inference, which is how you run inference on-premises or at the edge. Other unmanaged targets that can be attached include remote VMs, Azure Databricks, HDInsight, and Azure Data Lake Analytics, though support varies by workload: Databricks works for pipelines but not as a general remote training target.

### Choosing Compute

```
                     Interactive development,
                     one person, a notebook?
                              │
              ┌───────────────┴───────────────┐
             yes                             no
              │                               │
              v                               v
      Compute instance              Do you need a fixed node
      (enable idle shutdown)        reservation, warm nodes,
                                    or custom networking?
                                              │
                                  ┌───────────┴───────────┐
                                 no                      yes
                                  │                       │
                                  v                       v
                          Serverless compute      Compute cluster
                          (no lifecycle to        (min nodes 0 to
                           manage)                 avoid idle cost)

      Already running Kubernetes, or need on-premises
      or edge inference?  ──>  Azure ML Kubernetes (attached)
```

---

## Datastores and Data Assets

### Datastores

[Datastores](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-datastore){:target="_blank" rel="noopener noreferrer"} are workspace-registered connections to data sources. They hold the credential (or use the workspace identity) so training code refers to data by a datastore path rather than embedding connection strings.

Supported sources include Azure Blob Storage, Azure Data Lake Storage Gen1 and Gen2, Azure Files, and OneLake. ADLS Gen2 is the normal home for training data even though it cannot be the workspace default storage account.

Datastores can authenticate with a credential or **credential-less** using the workspace or a user-assigned managed identity, which is the better default because it puts data access under Azure RBAC instead of a stored key. Model monitoring specifically supports credential-less access by setting the workspace property `systemDatastoresAuthMode` to `identity`.

### Data Assets

[Data assets](https://learn.microsoft.com/en-us/azure/machine-learning/concept-data){:target="_blank" rel="noopener noreferrer"} are versioned, named references to data in a datastore. Registering one captures a path and metadata, not a copy, so there is no duplication cost. Types are `uri_file`, `uri_folder`, and `mltable`.

Versioning is what makes a model traceable. A job records which data asset version it consumed, so a model that misbehaves in production can be tied to the exact data that trained it. Note that `mltable` is poorly supported by Spark, so avoid it in model monitoring jobs, which run on Spark.

---

## Pipelines and Components

### Pipelines

[ML pipelines](https://learn.microsoft.com/en-us/azure/machine-learning/concept-ml-pipelines){:target="_blank" rel="noopener noreferrer"} compose data preparation, training, and evaluation into a directed acyclic graph where each node is a job and the edges carry data. They are the unit of reproducible, schedulable ML work.

### Components

A [component](https://learn.microsoft.com/en-us/azure/machine-learning/concept-component){:target="_blank" rel="noopener noreferrer"} is a self-contained pipeline step with a typed interface, its own environment, and a command to run. Components are the reusable unit: register one in the workspace, or publish it to a registry for other workspaces.

There are two ways to define one. From a Python function, using the `command_component` decorator from the `mldesigner` package:

```python
from pathlib import Path
from mldesigner import command_component, Input, Output

@command_component(
    name="prep_data",
    version="1",
    display_name="Prep Data",
    environment=dict(
        conda_file=Path(__file__).parent / "conda.yaml",
        image="mcr.microsoft.com/azureml/openmpi5.0-ubuntu24.04",
    ),
)
def prepare_data_component(
    input_data: Input(type="uri_folder"),
    training_data: Output(type="uri_folder"),
    test_data: Output(type="uri_folder"),
):
    ...
```

Or from a YAML specification loaded with `load_component()`, which suits a step whose logic already lives in a standalone script.

Pipelines themselves use the `pipeline` decorator from `azure.ai.ml.dsl`:

```python
from azure.ai.ml.dsl import pipeline

@pipeline(default_compute="serverless")
def image_classification(pipeline_input_data):
    prep_node = prepare_data_component(input_data=pipeline_input_data)
    train_node = keras_train_component(input_data=prep_node.outputs.training_data)
    train_node.resources = ResourceConfiguration(
        instance_type="Standard_NC6s_v3", instance_count=2
    )
    score_node = keras_score_component(
        input_data=prep_node.outputs.test_data,
        input_model=train_node.outputs.output_model,
    )
```

The pipeline sets a default compute, and any node needing something different overrides it. That per-node override is how a CPU preprocessing step and a GPU training step coexist in one pipeline given that a cluster holds a single VM size.

### Development Approaches

| Approach | Best for |
|---|---|
| **CLI v2 (YAML)** | Source-controlled, CI/CD-driven workflows where the pipeline definition is configuration |
| **Python SDK v2** | Complex training logic, dynamic pipeline construction, notebook-driven iteration |
| **Designer** | Visual composition and rapid prototyping without writing Python |

The CLI and SDK produce the same underlying jobs, so the choice is about which artifact you want in git.

---

## MLflow and the Model Registry

### Experiment Tracking

Azure ML implements the MLflow tracking API natively, so `mlflow.log_metric()` and friends work against the workspace with no extra configuration inside a job. A submitted job automatically captures a snapshot of the code, the environment definition, the parameters and metrics the script logs, output artifacts, and the data asset versions consumed. That combination is what makes a run reproducible and auditable, and it is the same record the model registry links back to.

### The Model Registry

Registering a model stores and versions it in the workspace. A registered model is a logical container for one or more files, identified by **name and version**, where registering under an existing name increments the version automatically.

The registry captures the artifacts, metadata **tags** for search and filtering, and lineage back to the training job, where it was deployed, and whether those deployments are healthy. Models trained outside Azure ML can be registered too. Anything loadable by Python 3.10 or later is supported.

Two things the Azure ML model registry does **not** provide, contrary to a common assumption carried over from open-source MLflow: there are **no promotion stages** (no built-in development, staging, production lifecycle on a model version) and **no approval workflow**. Promotion is something you build, normally with tags plus a CI/CD pipeline that reads them, or by promoting the model into a different workspace or registry. Designing around stages that do not exist is a common source of a half-built governance process.

One useful guardrail does exist: **you cannot delete a registered model that is in use by an active deployment.**

Try converting a model to [ONNX](https://learn.microsoft.com/en-us/azure/machine-learning/concept-onnx){:target="_blank" rel="noopener noreferrer"} before deployment. Microsoft reports the conversion typically doubles inference performance.

---

## Managed Endpoints

### Online Endpoints

[Online endpoints](https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-online){:target="_blank" rel="noopener noreferrer"} expose a model as a REST API for real-time scoring. Two flavors exist:

- **Managed online endpoints**, where Azure ML runs the compute on serverless infrastructure and handles provisioning, scaling, and OS patching
- **Kubernetes online endpoints**, which run on an attached AKS or Arc-enabled cluster, for on-premises, edge, or cluster-sharing scenarios

An endpoint holds one or more **deployments**, and traffic is split across them by percentage. That is the mechanism for safe rollout: create a second deployment with the new model, send it 10% of traffic, watch, then shift to 100%. The endpoint URL and authentication stay constant throughout.

Deploying a model requires the model, a **scoring script** (entry script), an **environment**, and any extra assets. **An MLflow model needs neither the scoring script nor the environment**, because both are inferred from the model's own metadata. That is the single biggest argument for logging models in MLflow format.

### Batch Endpoints

[Batch endpoints](https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-batch){:target="_blank" rel="noopener noreferrer"} score large datasets asynchronously. You invoke one with input data in a datastore, it runs on a compute cluster, and it writes results back to a datastore. They suit scoring millions of records where latency does not matter and cost per record does.

### Environments

Both endpoint types depend on [environments](https://learn.microsoft.com/en-us/azure/machine-learning/concept-environments){:target="_blank" rel="noopener noreferrer"}: a conda specification plus a base image defining the runtime. [Curated environments](https://learn.microsoft.com/en-us/azure/machine-learning/resource-curated-environments){:target="_blank" rel="noopener noreferrer"} cover common frameworks and are maintained by Microsoft; custom environments pin your own versions and get built into images stored in the workspace's container registry.

---

## Model Monitoring

[Model monitoring](https://learn.microsoft.com/en-us/azure/machine-learning/concept-model-monitoring){:target="_blank" rel="noopener noreferrer"} computes statistics over production inference data and compares them against reference data, raising alerts through Azure ML or Event Grid when a metric crosses a threshold.

```
   ┌──────────────────┐        ┌────────────────────────┐
   │ Online endpoint  │        │ Reference data         │
   │  + data          │        │  training / validation │
   │    collector     │        │  / ground truth        │
   └────────┬─────────┘        └───────────┬────────────┘
            │ inputs, outputs              │
            v                              │
   ┌──────────────────┐                    │
   │ Datastore        │                    │
   │ (production      │                    │
   │  inference data) │                    │
   └────────┬─────────┘                    │
            │                              │
            │   production window          │ reference window
            └──────────────┬───────────────┘
                           v
                ┌────────────────────┐
                │ Monitoring job     │  statistical test
                │ (Spark, scheduled) │  or distance score
                └──────────┬─────────┘
                           │ threshold exceeded
                           v
                ┌────────────────────┐
                │ Alert + Event Grid │──> retraining pipeline
                └────────────────────┘
```

**Six built-in signals**, each with configurable metrics and thresholds:

| Signal | Compares | Reference data |
|---|---|---|
| **Data drift** | Distribution of model inputs | Training data or recent production data |
| **Prediction drift** | Distribution of model outputs | Validation data or recent production data |
| **Data quality** | Null value rate, data type error rate, out-of-bounds rate on inputs | Training data or recent production data |
| **Feature attribution drift** (preview) | Feature importance in production against training | Training data (required) |
| **Model performance** (preview) | Accuracy, precision, recall, or MAE/MSE/RMSE | Ground truth data (required) |
| **Generative AI generation safety and quality** (preview) | Groundedness, relevance, fluency, similarity, coherence | Not applicable |

The tabular signals support classification and regression on tabular data. Custom signals are supported where the built-ins do not fit.

Getting data in is the prerequisite people skip. On a **managed online endpoint**, enable **model data collection** and inputs and outputs are captured automatically. For a batch endpoint or a model deployed outside Azure ML, **you are responsible for collecting production inference data** yourself and writing it somewhere the monitor can read.

Two configuration details govern whether results mean anything. The **lookback window size** sets how much data each run examines, and the **lookback window offset** shifts the window's end relative to the run. Make sure the reference window and the production window do not overlap, which means the reference offset should be at least the production window size plus its offset. By default the reference offset is twice the production window size, which handles the common case.

---

## Responsible AI

### The Dashboard

The [Responsible AI dashboard](https://learn.microsoft.com/en-us/azure/machine-learning/concept-responsible-ai-dashboard){:target="_blank" rel="noopener noreferrer"} assembles six components, each drawn from an established open-source package, and you include only the ones a given analysis needs:

| Component | Answers |
|---|---|
| **Model overview and fairness assessment** | How does performance break down across sensitive groups? (Fairlearn) |
| **Error analysis** | Which cohorts of data have the highest error rates? (Error Analysis) |
| **Data analysis** | Which groups are over- or under-represented in the dataset? |
| **Model interpretability** | Which features drove this prediction, globally and individually? (InterpretML) |
| **Counterfactual what-if** | What is the smallest change that flips this prediction? (DiCE) |
| **Causal analysis** | What is the causal effect of a treatment feature on a real outcome? (EconML) |

A **PDF scorecard** exports the results for stakeholders and compliance reviewers who will not open the dashboard themselves.

### Constraints That Decide Whether You Can Use It

The dashboard is narrower than its description suggests, and checking these before planning a compliance story saves rework:

- **Regression and classification (binary and multi-class) on tabular structured data only.** No image, text, or forecasting models. (Image and text dashboards exist in the open-source Responsible AI Toolbox, outside Azure ML.)
- **MLflow models registered in Azure ML with a scikit-learn implementation.** The model must implement `predict()` and `predict_proba()`, or be wrapped in a class that does, and must be pickleable.
- **Up to 5,000 data points** are visualized. Downsample first.
- Dataset inputs must be **pandas DataFrames in Parquet**. NumPy and SciPy sparse are unsupported.
- **No more than 10,000 columns.**
- **AutoML MLflow models are not supported**, and registered AutoML models cannot be used from the UI.

That last item is the one that reshapes plans. A team that uses AutoML to produce the production model cannot then run that model through the RAI dashboard, so if regulatory explainability is a requirement, either train a scikit-learn model yourself or rely on AutoML's own model explanation feature instead.

---

## AutoML

### When to Use It

[AutoML](https://learn.microsoft.com/en-us/azure/machine-learning/concept-automated-ml){:target="_blank" rel="noopener noreferrer"} searches algorithms, featurization, and hyperparameters for a supervised task and returns the best model it found. Reach for it when:

- You want a defensible baseline quickly, to know what a competent model scores before investing in a custom one
- The task is standard supervised learning: classification, regression, or time-series forecasting
- Comparing several algorithms matters more than controlling any one of them

Skip it when you need bespoke feature engineering, a specific deep learning architecture, or a custom loss function, and remember the Responsible AI constraint above before committing an AutoML model to a regulated production path.

### How It Works

You supply training data and a target column. AutoML profiles the data, splits it for validation, tries algorithm and hyperparameter combinations, ranks them on the primary metric, and returns the winner along with the leaderboard of what it tried.

Runs respect a compute budget. Set a time limit and AutoML stops when it expires, even with combinations left untried, which means a short budget produces a weaker answer rather than an error.

Configuration options include the primary metric to optimize, an allow or block list of algorithms, featurization behavior, cross-validation settings, and a model explanation on the winning run.

---

## MLOps Integration

### Continuous Training and Deployment

Azure ML integrates with [GitHub Actions](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-github-actions-machine-learning){:target="_blank" rel="noopener noreferrer"} and [Azure Pipelines](https://learn.microsoft.com/en-us/azure/machine-learning/how-to-devops-machine-learning){:target="_blank" rel="noopener noreferrer"}. A typical loop triggers on a code or data change, runs a registered pipeline, evaluates the resulting model against a threshold, registers it if it passes, and updates an endpoint deployment.

### Event-Driven Automation

Azure ML publishes lifecycle events to **Azure Event Grid**: job completion, model registration, deployment, and monitoring alerts such as drift detection. That is what closes the loop from monitoring back to training. Rather than polling for degradation, subscribe a retraining pipeline to the drift event and let the monitor start it.

---

## Common Pitfalls

### Pitfall 1: Building Governance on Registry Stages That Do Not Exist

**Problem:** A team designs a promotion process around moving a model version from staging to production in the registry, then discovers there are no stages and no approval workflow.

**Result:** A half-built process where "which version is in production" lives in someone's memory or a spreadsheet, and deployments diverge across environments.

**Solution:** Build promotion explicitly. Use registry **tags** to record state and a CI/CD pipeline that reads them, gated by that pipeline's own approvals, or promote across workspaces through an Azure ML **registry**, which turns each environment boundary into a resource boundary. Whichever you pick, write down the naming and tagging convention, because the registry will not enforce one.

---

### Pitfall 2: Expecting One Cluster to Serve a Mixed Pipeline

**Problem:** A pipeline has CPU preprocessing and GPU training, and the plan is one cluster with mixed node types.

**Result:** It cannot be configured. A compute cluster has a single VM size fixed at creation, so either preprocessing runs on expensive GPU nodes or training runs without a GPU.

**Solution:** Create separate clusters and assign compute per pipeline node, or set the pipeline's `default_compute` to `serverless` and specify the instance type on the node that needs a GPU. Serverless is the lower-maintenance option here because there is no second cluster to size, patch, or leave idle.

---

### Pitfall 3: Monitoring Configured With No Data Behind It

**Problem:** Model monitoring is enabled on a batch endpoint, or on a model deployed outside Azure ML, and no alerts ever fire.

**Result:** The monitor looks healthy because it has nothing to compare. Drift proceeds undetected and the dashboard provides false assurance.

**Solution:** Automatic collection of production inference data happens only on **managed online endpoints**, with model data collection enabled. Everywhere else you collect it yourself and write it to a datastore the monitor reads. Check the reference window and production window do not overlap, and confirm the workspace's managed network is not set to `AllowOnlyApprovedOutbound`, which monitoring does not support.

---

### Pitfall 4: Compute Instances Billing Around the Clock

**Problem:** Data scientists create compute instances for exploratory work and leave them running.

**Result:** A steady monthly charge for machines nobody is using, often larger than the training compute bill.

**Solution:** Enable **idle shutdown** on every compute instance at creation, and set compute clusters to a minimum of zero nodes. Note that stopping an instance does not zero its cost: the OS disk, public IP, and load balancer still bill. Instances that are genuinely finished with should be deleted, not just stopped.

---

### Pitfall 5: Training and Inference Environments Drifting Apart

**Problem:** Training uses a conda environment assembled months ago with loose version specifiers. Inference uses a different one. A retrain fails on a package that no longer resolves, or the endpoint scores differently from the validation run.

**Result:** Reproducibility is gone, and the difference between training and serving behavior is invisible until predictions are wrong.

**Solution:** Start from **curated environments** where one fits and pin exact versions where it does not. Log the model in **MLflow format**, which lets the deployment infer its environment from the model itself and removes the chance of a mismatched hand-written one. Register environments as versioned assets so a job records exactly which build it ran on.

---

### Pitfall 6: Endpoint Scaling Discovered in Production

**Problem:** An online endpoint is deployed with default instance counts and no load testing. Traffic spikes, requests queue, latency climbs.

**Result:** Timeouts under exactly the load the model was deployed to handle.

**Solution:** Load test before production and size from the result. Microsoft's sizing guidance is to scale **up** before scaling out: start with a machine holding about 150% of the RAM the model needs, profile, find the size that performs, then increase the instance count for concurrency. Use traffic splitting to move load onto a new deployment gradually rather than switching at once.

---

### Pitfall 7: The Workspace Storage Account Chosen Badly

**Problem:** An architect designates the team's existing ADLS Gen2 account as the workspace's storage account, on the reasonable assumption that the ML platform should point at the data lake.

**Result:** Workspace creation fails. An account with hierarchical namespace enabled cannot be a workspace default storage account, and neither can a premium account or one of type BlobStorage.

**Solution:** Let Azure ML create a general-purpose v2 account for artifacts and logs, then attach the data lake as a **datastore**. That is the intended arrangement, and it separates platform metadata from training data, which is better for lifecycle management anyway. Decide this before creation, since a workspace cannot be moved to a different subscription later.

---

## Key Takeaways

1. **A compute cluster has one VM size, fixed at creation.** Mixed CPU and GPU pipelines use separate clusters with per-node compute assignment, or serverless compute with an instance type set on the node that needs it.

2. **Serverless compute is Azure ML managed compute, and now the recommended default.** It is not AKS or Container Instances. Reach for a compute cluster when you need a reserved node count, warm nodes, or specific networking.

3. **The model registry has versions, tags, and lineage, but no stages and no approval workflow.** Promotion is something you build with tags and CI/CD, or by moving assets between workspaces through a registry.

4. **The built-in roles are AzureML Data Scientist, AzureML Compute Operator, and AzureML Registry User.** Data Scientist deliberately excludes creating compute, so self-service teams need both of the first two. Workspaces created after 19 November 2024 use the narrower Azure AI Administrator role for their managed identity.

5. **The workspace storage account cannot have hierarchical namespace, cannot be premium, and cannot be type BlobStorage.** Attach the data lake as a datastore instead, and remember a workspace cannot move subscriptions.

6. **MLflow-format models deploy without a scoring script or environment.** That alone justifies logging models in MLflow format, and it removes the most common training-serving mismatch.

7. **Model monitoring needs production inference data, and only managed online endpoints collect it for you.** Batch endpoints and externally deployed models require you to collect it. Signals cover data drift, prediction drift, data quality, feature attribution drift, model performance, and generative AI quality.

8. **The Responsible AI dashboard supports tabular classification and regression, scikit-learn MLflow models, and 5,000 data points.** It does not support AutoML models, which forces a choice between AutoML convenience and dashboard-based explainability.

9. **AutoML is a baseline generator, not an endpoint.** Use it to learn what a competent model scores, then decide whether custom training earns its cost, keeping the Responsible AI constraint in view.

10. **Event Grid closes the loop between monitoring and training.** Subscribe a retraining pipeline to drift and model-registration events rather than scheduling retraining blindly or waiting for someone to notice.
