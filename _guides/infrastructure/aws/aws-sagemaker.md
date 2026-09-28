---
title: "SageMaker AI: Training and Hosting Your Own Models"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "How Amazon SageMaker AI trains and hosts custom models: where people work, training jobs with managed spot and HyperPod, choosing real-time, serverless, asynchronous, or batch inference, several models on one endpoint, safe rollouts, MLflow, Model Registry, and Pipelines, and the security and cost controls that matter."
tags: [sagemaker, model-training, model-inference, inference-components, mlflow, hyperpod, practical]
---

## What SageMaker AI Is

Amazon SageMaker AI is AWS's managed service for training machine learning models on your data and hosting them for predictions. It was called Amazon SageMaker until December 3, 2024, when AWS gave that name to a broader platform for data, analytics, and AI. The platform groups SageMaker AI with Redshift, the lakehouse and catalog, data processing, Bedrock, and **SageMaker Unified Studio**, a single workspace where data engineers, analysts, and ML practitioners share projects. The rename touched only names. APIs, CLI commands, IAM actions, managed policies, and CloudFormation resource types all still say `sagemaker`.

This guide covers SageMaker AI itself. Deciding whether a workload needs a custom model at all, rather than a prebuilt AI service or a foundation model on Bedrock, is a separate decision made before any of this. The practice around models, such as versioning data, retraining, and watching for drift, belongs to [MLOps](/study-guides/ai/mlops.html). What follows is how SageMaker AI implements the pieces.

| Piece | What it does | How it bills |
|---|---|---|
| **Studio** and notebook instances | Where people explore data and write code, in JupyterLab, Code Editor, or RStudio | Per instance-hour while a space or notebook runs |
| **Processing and training jobs** | Run a container against data in S3 on instances that exist only for the job | Per instance-second for the job's duration |
| **HyperPod** | Persistent, self-healing clusters for training and serving very large models | Per instance-hour while the cluster exists |
| **Endpoints and batch transform** | Serve predictions in real time, on demand, from a queue, or over a whole dataset | Per instance-hour, or per second of compute for serverless |
| **MLflow, Model Registry, Pipelines** | Track experiments, version and approve models, and automate the steps between them | MLflow tracking servers per hour; Pipelines only for the jobs it runs |
| **JumpStart and Canvas** | Deploy and fine-tune pretrained models, or build models without code | Instance-hours for JumpStart; session-hours and training for Canvas |

Several older features no longer accept new customers. Since July 30, 2026, Ground Truth (labeling), Augmented AI (human review), Model Monitor, Clarify, Debugger, GeoSpatial, Role Manager, and Studio Lab are closed to accounts that weren't already using them, and Profiler is in sunset. Existing users keep them. A new account plans labeling, bias checks, and drift monitoring with other tools.

---

## Where People Work

A **domain** is the unit an administrator sets up. It holds user profiles, shared settings, an Amazon EFS volume for home directories, and the VPC and IAM role defaults. Inside it, **Studio** is the web interface for jobs, models, and endpoints, and each person runs one or more **spaces**. A space is an IDE, JupyterLab, Code Editor (based on open-source VS Code), or RStudio, running on an ML instance you choose. The previous interface, now called Studio Classic, is still supported and available as an app inside Studio, but new work starts in Studio.

A space bills for its instance for every hour it runs, whether anyone is typing. In US East (N. Virginia), an `ml.t3.medium` costs $0.05 an hour and an `ml.m5.large` $0.115, so small instances are cheap. A GPU space costs far more, and an `ml.g5.xlarge` left running over a month costs about $1,029. Turn on idle shutdown for the domain, and do heavy work in training jobs rather than on a large notebook instance.

**Notebook instances** are the older model, a single managed instance running Jupyter and billed while it is in service. They still work, but they give each person a server to remember to stop, and Studio spaces are the better default.

**SageMaker Unified Studio** is a separate entry point. It suits organizations that want data preparation, SQL, and ML in one project with shared data access and governance. It uses SageMaker AI's training and hosting underneath, so the rest of this guide applies to both.

---

## Training Jobs

A training job is SageMaker AI's core unit of compute. Most teams launch one from the SageMaker Python SDK, pointing a prebuilt AWS framework image (PyTorch, TensorFlow, XGBoost, scikit-learn) at their training script, and the SDK calls the same `CreateTrainingJob` API shown below. The job needs a container image with your training code, an IAM role, input channels in S3 (or EFS or FSx for Lustre), an instance type and count, and an S3 path for output. SageMaker AI launches the instances, runs the container, writes the trained model to S3 as `model.tar.gz`, and terminates the instances. You pay per second of the job, at the instance's training rate: $0.115 an hour for `ml.m5.large`, $1.408 for `ml.g5.xlarge`, and $63.296 for an eight-GPU `ml.p5.48xlarge`.

The input mode decides how data reaches the container. **File** mode, the default, copies the whole dataset to the instance before training starts, so the instance's storage must hold it. **FastFile** mode presents the S3 prefix as local files and streams them as the code reads, so training starts at once and the dataset can be larger than the disk. **Pipe** mode is an older streaming mode that FastFile has largely replaced.

### Managed spot training

Managed spot training runs the job on spare EC2 capacity for up to 90% less than on-demand. SageMaker AI handles interruptions. It waits for capacity, restarts the job, and, if you configure checkpointing, copies your checkpoint files from the instance to S3 and back so the job resumes where it stopped instead of starting over. Your training code has to write checkpoints to the local checkpoint path (`/opt/ml/checkpoints` by default) and load the latest one on start.

```json
{
  "TrainingJobName": "churn-xgb-2026-09-28",
  "RoleArn": "arn:aws:iam::111122223333:role/SageMakerTrainingRole",
  "AlgorithmSpecification": {
    "TrainingImage": "111122223333.dkr.ecr.us-east-1.amazonaws.com/churn-train:1.4",
    "TrainingInputMode": "FastFile"
  },
  "InputDataConfig": [{
    "ChannelName": "train",
    "DataSource": { "S3DataSource": { "S3DataType": "S3Prefix", "S3Uri": "s3://ml-data/churn/train/" } }
  }],
  "OutputDataConfig": { "S3OutputPath": "s3://ml-artifacts/churn/" },
  "ResourceConfig": { "InstanceType": "ml.g5.xlarge", "InstanceCount": 1 },
  "EnableManagedSpotTraining": true,
  "CheckpointConfig": { "S3Uri": "s3://ml-artifacts/churn/checkpoints/" },
  "StoppingCondition": { "MaxRuntimeInSeconds": 14400, "MaxWaitTimeInSeconds": 28800 }
}
```

Submit it with `aws sagemaker create-training-job --cli-input-json file://job.json`. `MaxRuntimeInSeconds` caps the time spent training, and `MaxWaitTimeInSeconds`, which must be larger, caps training plus time spent waiting for spot capacity. When the job ends, `DescribeTrainingJob` reports `TrainingTimeInSeconds` and `BillableTimeInSeconds`, and one minus billable over training time is your saving. A job billed for 100 of its 500 seconds saved 80%. Built-in algorithms that don't checkpoint are limited to a one-hour wait, so spot suits them only for short jobs. Automatic model tuning, which runs many training jobs to search hyperparameters, can use spot too. `ResourceConfig` omits `VolumeSizeInGB` here because GPU families such as `ml.g5` train on fixed local NVMe storage (250 GB on `ml.g5.xlarge`), and the setting applies only to instances that use EBS.

Before a first GPU job, check the account's service quotas. SageMaker AI sets a separate quota per instance type for training, spot training, and endpoints, and the defaults for large GPU instances are often too low to launch anything.

### Larger training: distributed jobs and HyperPod

A training job can span several instances, with SageMaker AI's distributed training libraries or a framework's own, such as PyTorch's distributed data parallel. The job still starts, runs, and ends as one unit, which suits training measured in hours.

**SageMaker HyperPod** is for work measured in weeks on hundreds or thousands of accelerators, such as pretraining or large-scale fine-tuning of foundation models. It provisions a persistent cluster orchestrated by Slurm, an open-source job scheduler common in high-performance computing, or by Amazon EKS, watches the nodes, replaces failed hardware, and resumes jobs from checkpoints. Because the cluster persists, you pay for its instances until you delete it. **Training plans** reserve GPU or Trainium capacity for a window up to eight weeks ahead, paid up front and non-refundable, when on-demand accelerators are scarce. Each plan targets one kind of resource, whether training jobs, a HyperPod cluster, inference endpoints, or Studio apps.

---

## Choosing an Inference Option

Hosting a trained model takes three objects. A **model** pairs the artifact in S3 with an inference container image and an IAM role. The image can be one of AWS's prebuilt framework containers or your own, which must answer HTTP requests on port 8080 at `/invocations` for predictions and `/ping` for health checks. An **endpoint configuration** holds one or more **production variants**, each naming a model with an instance type and count, or a serverless or asynchronous setting instead. An **endpoint** deploys a configuration, and changing what it serves means pointing it at a new configuration.

A trained model serves predictions in one of four ways, and the choice follows from payload size, how long a prediction takes, and whether traffic is steady.

| Option | Request limits | Scales to zero | Pay for | Fits |
|---|---|---|---|---|
| **Real-time endpoint** | 6 MB payload; the container must respond within 60 seconds | Only when models are deployed as inference components, described below | Instance-hours while in service, plus $0.016/GB processed | Interactive, steady traffic; GPUs; VPC access |
| **Serverless endpoint** | 4 MB payload, 60 seconds, up to 6 GB memory, no GPU | Yes, automatically | Compute per millisecond by memory size, plus $0.016/GB | Spiky or light traffic that tolerates cold starts |
| **Asynchronous endpoint** | Payload up to 1 GB in S3, up to one hour per request | Yes, with an auto scaling minimum of zero | Instance-hours while running | Large inputs or slow models, with results collected later |
| **Batch transform** | Mini-batches up to 100 MB from S3 | Instances exist only for the job | Instance-hours for the job | Scoring a whole dataset on a schedule |

A **real-time endpoint** runs instances that stay up until you delete the endpoint. An `ml.m5.large` host costs $0.115 an hour, about $84 a month, and AWS recommends at least two instances for a production endpoint so it keeps serving if an Availability Zone fails. Real-time endpoints support GPUs, VPC placement, several variants, and streaming responses through `InvokeEndpointWithResponseStream`, which returns tokens as a language model generates them.

A **serverless endpoint** runs on capacity SageMaker AI manages, with memory from 1 GB to 6 GB and CPU in proportion. It costs $0.00004 per second at 2 GB. At 200,000 requests a month that each take 300 milliseconds, that is 60,000 seconds, or $2.40, against about $84 for one always-on instance. The crossover is near 2.1 million seconds of compute a month, which is close to a request running at every moment of the day. The first requests after an idle period, or after concurrency rises, hit a cold start while the endpoint adds capacity, and the delay lasts as long as it takes to download the model and start the container. Provisioned concurrency keeps a set number of workers warm for a per-second charge. Each endpoint can run at most 200 concurrent requests. All serverless endpoints in an account also share a Regional concurrency quota. AWS's documentation gives it as 1,000 in the largest Regions and 500 in others, but its quota table lists a default of 10, so check the account's value in Service Quotas before setting a high maximum.

The limits often decide before the price does. Serverless endpoints have no GPUs, no VPC configuration, no network isolation, no request data capture, and no multi-model hosting or multiple variants. A serverless endpoint can be converted to real time later, but a real-time endpoint can't be converted to serverless.

An **asynchronous endpoint** is called through the `InvokeEndpointAsync` API with a pointer to an input object in S3. The endpoint queues the request and writes the result to S3, with an optional SNS notification on success or error. In the .NET SDK that API's method is `InvokeEndpointAsyncAsync`, because the SDK already uses `InvokeEndpointAsync` for the Task-based real-time call. It suits video, long documents, and slow models, and with an auto scaling minimum of zero it costs nothing while the queue is empty.

**Batch transform** starts instances, runs every record in an S3 prefix through the model, writes an output file per input file, and shuts down. Scoring a table nightly with batch transform costs an hour of instance time instead of a month of it.

---

## Hosting Several Models on One Endpoint

An endpoint running one model on one instance wastes whatever capacity the model doesn't use. **Inference components** fix that. Each component names a model and reserves the CPU cores, GPUs, and memory it needs, and you set how many copies of it run. SageMaker AI places copies wherever an instance has room, and managed instance scaling adds or removes instances to fit them. Each component scales its own copy count with Application Auto Scaling, and callers choose a model by naming its component in the request.

{% include figure.html id="aws-sagemaker-inference-components" %}

Inference components are also the only way a real-time endpoint scales to zero. Set the variant's minimum instance count to zero and each component's minimum copies to zero, and the endpoint releases its instances when idle. Scaling back out needs a step scaling policy triggered by a CloudWatch alarm on the `NoCapacityInvocationFailures` metric, and provisioning takes several minutes, during which requests fail. That trade suits internal or batch-like callers that retry, not a user waiting on a page.

**Multi-model endpoints** solve a different problem, serving thousands of similar small models, such as one per customer, from one container. The endpoint loads a model from S3 on its first request, caches it in memory, and evicts the least used when memory fills. The first request for a cold model is slow and can return `ModelNotReadyException`, so callers must retry. Use inference components when a few models need guaranteed resources, and multi-model endpoints when many models share one framework and most sit idle.

---

## Calling an Endpoint from an Application

Endpoints aren't public URLs. Every call is signed with AWS credentials and authorized by IAM (`sagemaker:InvokeEndpoint`), so external callers reach a model through your own API, such as an API Gateway route or a service that calls the endpoint. With the AWS SDK for .NET (`AWSSDK.SageMakerRuntime`):

```csharp
using System.Text;
using Amazon.SageMakerRuntime;
using Amazon.SageMakerRuntime.Model;

var client = new AmazonSageMakerRuntimeClient(new AmazonSageMakerRuntimeConfig
{
    // The container has 60 seconds to respond; give the socket a margin beyond that.
    Timeout = TimeSpan.FromSeconds(70)
});

var request = new InvokeEndpointRequest
{
    EndpointName = "churn-prod",
    InferenceComponentName = "churn-model", // only when the endpoint hosts inference components
    ContentType = "application/json",
    Accept = "application/json",
    Body = new MemoryStream(Encoding.UTF8.GetBytes(
        """{"tenure_months": 14, "plan": "pro", "tickets_90d": 3}"""))
};

InvokeEndpointResponse response = await client.InvokeEndpointAsync(request);
using var reader = new StreamReader(response.Body);
string prediction = await reader.ReadToEndAsync();
```

Three errors deserve handling. `ModelError` (HTTP 424) means your container returned an error, and its CloudWatch log stream has the detail. `ModelNotReadyException` (429) means a serverless endpoint is still provisioning or a multi-model endpoint is still loading the model, so retry with backoff. Throttling means you've hit an endpoint's concurrency or the account's limit of 10,000 invocations per second per Region.

---

## Rolling Out and Scaling Endpoints

Updating the configuration of a live endpoint uses **deployment guardrails**, SageMaker AI's managed versions of the release strategies covered in [Deployment Strategies](/study-guides/infrastructure/deployment-strategies.html). A blue/green update builds a new fleet and shifts traffic to it all at once, as a canary slice then the rest, or in linear steps, while CloudWatch alarms you choose watch a baking period and roll back automatically if one fires. A rolling update replaces capacity in batches instead of doubling it. Guardrails apply to real-time and asynchronous endpoints. On an endpoint built from inference components, you update one model at a time by updating its component, which rolls out new copies in batches without touching the others. To compare two models on live traffic, deploy them as **production variants** of one endpoint with traffic weights, and let a caller pin a variant with `TargetVariant` when it needs one.

Auto scaling uses Application Auto Scaling. The usual policy is target tracking on invocations per instance (`SageMakerVariantInvocationsPerInstance`), or per copy for inference components. Load-test to find how many invocations one instance handles within your latency target, then set the target below that. The minimum capacity is the part you always pay for, so set it to baseline traffic, not to the peak.

---

## Tracking, Registering, and Automating

**Managed MLflow** records experiments: parameters, metrics, artifacts, and, for generative AI applications, traces of each step. SageMaker AI offers it two ways. **MLflow Apps** are the newer option, which AWS recommends over tracking servers for faster startup, cross-account sharing, and tighter integration. The older **MLflow tracking servers** run in Small, Medium, or Large sizes, billed per hour while running ($0.60 an hour for Small) plus $0.10 per GB-month of metadata. Check the pricing page for Apps before choosing. Either way, artifacts live in an S3 bucket in your account.

**Model Registry** is the catalog of models headed for production. A model group holds the versions trained for one problem, each with its metrics, lineage, and an approval status of `PendingManualApproval`, `Approved`, or `Rejected`. Changing the status emits an EventBridge event, which is the usual trigger for a deployment pipeline, so approving a version is what deploys it. Models registered in MLflow can register themselves in Model Registry, and model groups can be shared with other accounts for a separate production account.

**Pipelines** chains processing, training, tuning, evaluation, conditions, registration, and deployment into a versioned workflow defined in the Python SDK, JSON, or Studio's visual editor. Steps can cache results so a rerun skips unchanged work. The orchestration itself is free, and you pay for the jobs it runs.

Drift detection is where the closures bite. With Model Monitor closed to new customers, AWS's documented replacement is a set of open-source sample solutions that run in your account. They capture requests and responses from a real-time endpoint to S3, compare them with the training data using the Evidently AI library on a schedule, log results to MLflow, alert through SNS or CloudWatch, and can feed QuickSight dashboards that track drift and delayed ground truth over time. Data capture is an endpoint setting that serverless endpoints don't support.

---

## Lower-Code Paths: JumpStart and Canvas

**JumpStart** is a catalog of pretrained models, including open-weight foundation models whose trained parameters anyone can host. It deploys them to endpoints in your account and fine-tunes them with training jobs, so you choose the instance, control the network, and pay instance-hours whether or not requests arrive. It fits when you need a model or a level of control that Bedrock doesn't offer.

**SageMaker Canvas** builds models from tabular, time-series, image, and text data through a point-and-click interface. It absorbed Autopilot, SageMaker AI's automated machine learning, which tries algorithms and hyperparameters and ranks the resulting models, and Autopilot's AutoML API remains for code. Canvas bills $1.90 per session-hour while the workspace is open, whether or not anyone is using it, plus model building at $30 per million cells for the first 10 million cells of each model. Log out when you finish, or an idle workspace keeps billing.

---

## Security and Cost Controls

Every job, endpoint, and space runs as an **execution role**, and that role, not the person who started it, decides what data it can read. Give training, processing, and hosting separate roles, each scoped to the S3 prefixes and ECR repositories it needs.

Training jobs, processing jobs, and real-time endpoints can run in your VPC subnets, so they reach private data sources and nothing else. **Network isolation** goes further and blocks the container from making any outbound calls, which stops a compromised or careless training script from sending data out. Interface VPC endpoints for the SageMaker API, the runtime, and Studio keep traffic off the internet. Encrypt training volumes, model artifacts, and endpoint storage with a KMS key, customer managed where you need to control access to the key.

For cost, **Savings Plans for SageMaker AI** take up to 64% off in exchange for a one- or three-year hourly commitment. They cover Studio and notebook instances, processing, Data Wrangler (the visual data preparation tool), training, real-time endpoints, and batch transform, but not serverless inference. For an account's first two months, the free tier covers 250 hours of `ml.t3.medium` notebooks, 50 hours of training and 125 hours of real-time hosting on `m4.xlarge` or `m5.xlarge`, and 150,000 seconds of serverless inference. Tag domains, jobs, and endpoints by team so the bill can be split.

---

## Common Pitfalls

- **Idle GPUs in notebooks.** A GPU space or notebook instance runs all month because nobody stopped it. Turn on idle shutdown and train in jobs, which end on their own.
- **A real-time endpoint for nightly scoring.** An endpoint that serves one hour of work a day bills for 24. Use batch transform, or an asynchronous endpoint that scales to zero.
- **Spot without checkpoints.** An interrupted job restarts from the beginning and can cost more than on-demand. Write checkpoints and load the latest one on start.
- **Serverless for a model that outgrows it.** A model that later needs a GPU, VPC access, or data capture forces a move to a real-time endpoint, and the conversion is one way. Check the exclusions before choosing.
- **Scale to zero in front of users.** An endpoint at zero instances fails requests for several minutes while it provisions. Keep one instance for interactive traffic.
- **Treating an endpoint as a public API.** Endpoints accept only signed IAM requests. Put your own API in front for outside callers.

---

## Key Takeaways

- SageMaker AI is the ML service within the broader Amazon SageMaker platform, and its APIs, CLI, and IAM actions still use the `sagemaker` name.
- Training jobs create instances for the job and bill by the second. Managed spot training takes up to 90% off when the code checkpoints, and HyperPod runs persistent, self-healing clusters for foundation-model scale.
- Choose real-time endpoints for steady interactive traffic, serverless for light or spiky traffic within 4 MB, 60 seconds, 6 GB, and no GPU or VPC, asynchronous for large or slow requests, and batch transform for whole datasets.
- Inference components pack several models onto shared instances with their own resources and scaling, and they let a real-time endpoint scale to zero at the cost of minutes of failed requests when it scales out.
- MLflow tracks experiments, Model Registry approvals trigger deployments through EventBridge, and Pipelines charges only for the jobs it runs. With Model Monitor, Clarify, and Ground Truth closed to new customers, new accounts build monitoring and labeling with other tools.
- Execution roles, VPC placement, network isolation, and KMS keys secure the data path, and Savings Plans, idle shutdown, and right-sized minimums control the bill.
