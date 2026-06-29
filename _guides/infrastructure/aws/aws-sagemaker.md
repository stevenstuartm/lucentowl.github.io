---
title: "AWS SageMaker: ML Platform Essentials"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "ML model training, deployment, endpoints, SageMaker Studio, cost optimization, and service selection for production ML workloads"
tags: [aws, machine-learning, data-architecture, cost-analysis, infrastructure, automation]
---

## What Problems AWS SageMaker Solves

AWS SageMaker eliminates the infrastructure complexity and operational burden of building, training, and deploying machine learning models at scale.

**Traditional ML infrastructure challenges**:
- Data scientists spend 80% of time on infrastructure (provisioning GPU instances, installing libraries, managing dependencies) instead of modeling
- Training large models requires manually orchestrating distributed training across multiple GPU instances
- Deploying models to production requires building custom serving infrastructure with auto-scaling, monitoring, and A/B testing
- Experimenting with different model versions creates versioning nightmares (which dataset, which hyperparameters, which code produced this model?)
- Scaling inference from 10 requests/day to 10,000 requests/second requires re-architecting serving infrastructure

**Concrete scenario**: Your ML team built a product recommendation model using TensorFlow on local laptops. Training takes 2 days on a single GPU. To deploy, you manually set up an EC2 instance with TensorFlow Serving, write custom Flask endpoints, configure an ALB, and implement monitoring. When the model needs retraining weekly with fresh data, the process is entirely manual. The team wants to A/B test model versions, but that requires duplicating the entire infrastructure. Scaling inference during Black Friday requires manually adding EC2 instances. Total ML infrastructure cost: $8,000/month (dedicated GPU instances running 24/7). Data scientists spend 60% of their time managing infrastructure instead of improving models.

**What SageMaker provides**: Managed infrastructure for the entire ML lifecycle. This includes notebooks for exploration, distributed training jobs that auto-provision GPU clusters, one-click model deployment to auto-scaling endpoints, built-in A/B testing, and automatic model versioning. You pay per training hour and per inference request, not for idle infrastructure.

**Real-world impact**: After migrating to SageMaker, training time dropped from 2 days to 4 hours (distributed training on 4× GPUs). Deployment became one API call instead of manual infrastructure setup. A/B testing is built-in (70% traffic to model v1, 30% to v2). Inference auto-scales from 1 to 100 instances based on load. Cost dropped from $8,000/month to $1,200/month (pay only during training and inference, no idle GPU instances). Data scientists spend 90% of time on modeling, 10% on infrastructure.

## Service Fundamentals

AWS SageMaker is a fully managed ML platform with four core capabilities like Build (notebooks and data prep), Train (distributed training jobs), Deploy (managed endpoints), and Govern (model registry and monitoring).

### SageMaker Studio

**What it is**: Web-based IDE for ML development that replaces Jupyter notebooks with collaborative, version-controlled workspace.

**Key features**:
- **Unified environment**: Code, train, deploy, monitor all in one interface
- **Kernel flexibility**: Switch between Python, R, TensorFlow, PyTorch kernels without reconfiguring environment
- **Git integration**: Clone repos, commit code, push directly from Studio
- **Experiment tracking**: Automatic logging of training runs, hyperparameters, metrics
- **Shared workspaces**: Team members collaborate on same notebooks

**Studio vs traditional notebooks**:

| Aspect | SageMaker Notebook Instances | SageMaker Studio |
|--------|------------------------------|------------------|
| **Launch time** | 5-10 minutes (EC2 boot) | 1-2 minutes (container launch) |
| **Cost** | Pay for instance 24/7 | Pay per kernel-hour |
| **Collaboration** | Manual sharing via S3 | Built-in team workspaces |
| **Experiment tracking** | Manual logging | Automatic via SageMaker Experiments |
| **Kernel switching** | Requires instance restart | Instant kernel change |

<div class="callout callout--tip">
<p class="callout__title">Cost Optimization</p>
<p>Studio charges per kernel-hour, not per instance. If notebook sits idle, you pay $0. With notebook instances, idle ml.t3.medium = $0.05/hour × 730 hours/month = $36.50/month wasted.</p>
</div>

### Training Jobs

**What they are**: Managed infrastructure for model training that auto-provisions compute, runs training code, saves model artifacts to S3, and tears down resources.

**Training job workflow**:
1. Specify training code (Python script or container)
2. Specify instance type and count (e.g., 4× ml.p3.8xlarge with 4 V100 GPUs each = 16 GPUs total)
3. Specify input data location (S3)
4. SageMaker provisions instances, downloads data, runs training script
5. Model artifacts uploaded to S3
6. Instances terminated

**Example training job** (Python SDK):
```python
from sagemaker.pytorch import PyTorch

estimator = PyTorch(
    entry_point='train.py',  # Your training script
    role='arn:aws:iam::123456789012:role/SageMakerRole',
    instance_type='ml.p3.2xlarge',  # Single GPU instance
    instance_count=1,
    framework_version='2.0',
    py_version='py310',
    hyperparameters={
        'epochs': 50,
        'batch-size': 64,
        'learning-rate': 0.001
    }
)

estimator.fit({'training': 's3://my-bucket/training-data/'})
```

**Distributed training**: Scale training across multiple instances/GPUs automatically.

**Data parallelism** (split data across GPUs):
```python
from sagemaker.pytorch import PyTorch

estimator = PyTorch(
    entry_point='train.py',
    instance_type='ml.p3.8xlarge',  # 4 GPUs per instance
    instance_count=4,  # 4 instances = 16 GPUs total
    distribution={
        'pytorchddp': {  # Distributed Data Parallel
            'enabled': True
        }
    }
)
```

**Model parallelism** (split large model across GPUs when model doesn't fit in single GPU memory):
```python
from sagemaker.pytorch import PyTorch

estimator = PyTorch(
    entry_point='train.py',
    instance_type='ml.p4d.24xlarge',  # 8× A100 GPUs (40 GB each)
    instance_count=2,
    distribution={
        'smdistributed': {
            'modelparallel': {
                'enabled': True,
                'parameters': {
                    'partitions': 4  # Split model across 4 GPUs
                }
            }
        }
    }
)
```

**Spot instances for training**: Use spot instances for 70% cost savings on training.

```python
estimator = PyTorch(
    entry_point='train.py',
    instance_type='ml.p3.2xlarge',
    instance_count=4,
    use_spot_instances=True,
    max_wait=7200,  # Max time to wait for spot capacity (seconds)
    max_run=3600  # Max training time (seconds)
)
```

**Cost comparison** (4 hours training on ml.p3.2xlarge):
- On-demand: $3.825/hour × 4 hours = $15.30
- Spot (70% discount): $1.15/hour × 4 hours = $4.60
- Savings: $10.70 (70%)

Risk: Spot instances can be interrupted. Use checkpointing to resume from last checkpoint if interrupted.

### Model Registry

**What it is**: Centralized repository for model versions with approval workflows and deployment tracking.

**Model registry workflow**:
1. Training job completes, model artifacts saved to S3
2. Register model version in registry with metadata (accuracy, F1 score, training data version)
3. Approval workflow: Data science lead reviews metrics, approves for production
4. Approved models deployed to endpoints
5. Track which model version serves each endpoint

**Example model registration**:
```python
from sagemaker.model import Model

model = Model(
    image_uri='763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:2.0-cpu',
    model_data='s3://my-bucket/model.tar.gz',
    role='arn:aws:iam::123456789012:role/SageMakerRole'
)

model_package = model.register(
    content_types=['application/json'],
    response_types=['application/json'],
    inference_instances=['ml.t2.medium', 'ml.m5.large'],
    transform_instances=['ml.m5.large'],
    model_package_group_name='product-recommendations',
    model_metrics={
        'accuracy': {'value': 0.92},
        'f1_score': {'value': 0.88}
    },
    approval_status='PendingManualApproval'
)
```

### Inference Endpoints

**What they are**: Managed HTTPS endpoints that serve model predictions with auto-scaling, monitoring, and A/B testing.

**Endpoint types**:

1. **Real-time endpoints**: Always-on, low-latency (<100ms) inference
   - Use case: Product recommendations, fraud detection, personalization
   - Pricing: Pay for instance hours (ml.t2.medium = $0.065/hour)

2. **Serverless endpoints**: Auto-scale from zero, pay per inference request
   - Use case: Sporadic inference, cost-sensitive applications
   - Pricing: $0.20 per million requests + $0.0024/hour per GB memory

3. **Batch transform**: Process large batches of data asynchronously
   - Use case: Nightly batch scoring, offline analytics
   - Pricing: Same as training (pay per instance-hour)

4. **Asynchronous endpoints**: Queue requests, process asynchronously (15-minute timeout)
   - Use case: Long-running inference (video processing, large document analysis)
   - Pricing: Same as real-time endpoints

**Real-time endpoint deployment**:
```python
from sagemaker.predictor import Predictor

predictor = model.deploy(
    initial_instance_count=2,
    instance_type='ml.m5.large',
    endpoint_name='product-recommendations-prod'
)

# Make prediction
result = predictor.predict({
    'user_id': 12345,
    'context': {'time_of_day': 'evening', 'device': 'mobile'}
})
```

**Auto-scaling configuration**:
```python
import boto3

autoscaling = boto3.client('application-autoscaling')

# Register endpoint as scalable target
autoscaling.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/product-recommendations-prod/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=2,
    MaxCapacity=10
)

# Define scaling policy: scale on invocations per instance
autoscaling.put_scaling_policy(
    PolicyName='scale-on-invocations',
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/product-recommendations-prod/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    PolicyType='TargetTrackingScaling',
    TargetTrackingScalingPolicyConfiguration={
        'TargetValue': 1000.0,  # Target 1000 invocations per instance
        'PredefinedMetricSpecification': {
            'PredefinedMetricType': 'SageMakerVariantInvocationsPerInstance'
        },
        'ScaleInCooldown': 300,
        'ScaleOutCooldown': 60
    }
)
```

**A/B testing (multi-variant endpoints)**:
```python
from sagemaker.model import Model

# Model v1 (current production)
model_v1 = Model(
    image_uri='...',
    model_data='s3://my-bucket/model-v1.tar.gz',
    role=role
)

# Model v2 (new candidate)
model_v2 = Model(
    image_uri='...',
    model_data='s3://my-bucket/model-v2.tar.gz',
    role=role
)

# Deploy both models to same endpoint with traffic split
from sagemaker.multidatamodel import MultiDataModel
from sagemaker.predictor import Predictor

endpoint_name = 'product-recommendations-ab-test'

# Deploy with 70% v1, 30% v2
predictor_v1 = model_v1.deploy(
    initial_instance_count=2,
    instance_type='ml.m5.large',
    endpoint_name=endpoint_name,
    variant_name='model-v1',
    traffic_weight=70
)

model_v2.deploy(
    initial_instance_count=1,
    instance_type='ml.m5.large',
    endpoint_name=endpoint_name,
    variant_name='model-v2',
    traffic_weight=30
)
```

SageMaker routes 70% of requests to model-v1, 30% to model-v2. Monitor metrics (latency, error rate, business KPIs) to determine winner.

### Serverless Inference

**When to use**: Inference traffic is intermittent (not 24/7) or unpredictable.

**Pricing comparison** (100,000 requests/month, 512 MB memory, 2 seconds per inference):

**Real-time endpoint** (ml.t2.medium, $0.065/hour):
- Instance hours: 730 hours/month × $0.065 = $47.45/month
- Requests: Free (included in instance cost)
- Total: $47.45/month

**Serverless endpoint**:
- Memory-hours: 100,000 requests × 2 seconds × 512 MB = 28.4 GB-hours = $0.068
- Requests: 100,000 ÷ 1,000,000 × $0.20 = $0.02
- Total: $0.09/month

Serverless wins by 99.8% for low-traffic endpoints.

**Break-even point**: ~40,000 requests/hour continuous (960,000/day). Above this, real-time endpoints cheaper.

**Serverless endpoint deployment**:
```python
from sagemaker.serverless import ServerlessInferenceConfig

serverless_config = ServerlessInferenceConfig(
    memory_size_in_mb=2048,  # 1024, 2048, 3072, 4096, 5120, 6144 MB
    max_concurrency=10  # Max concurrent invocations
)

predictor = model.deploy(
    serverless_inference_config=serverless_config,
    endpoint_name='product-recommendations-serverless'
)
```

**Cold start latency**: First request after idle period incurs ~3-10 seconds cold start. Subsequent requests <100ms. Not suitable for latency-sensitive applications with infrequent traffic.

## Cost Optimization Strategies

SageMaker costs have three components: training (instance-hours), inference (instance-hours or requests), and storage (model artifacts, data). Optimize each independently.

### Training Cost Optimization

**1. Use Spot instances** (70% cost savings):
```python
estimator = PyTorch(
    entry_point='train.py',
    instance_type='ml.p3.2xlarge',
    instance_count=4,
    use_spot_instances=True,
    max_wait=7200,
    checkpoint_s3_uri='s3://my-bucket/checkpoints/'  # Save checkpoints for resumption
)
```

**2. Right-size instance types**: Don't over-provision GPUs.

| Model Size | Instance Type | GPUs | Cost/hour | Use Case |
|------------|---------------|------|-----------|----------|
| Small (<1 GB) | ml.g4dn.xlarge | 1× T4 (16 GB) | $0.736 | Prototyping, small models |
| Medium (1-10 GB) | ml.p3.2xlarge | 1× V100 (16 GB) | $3.825 | Standard deep learning |
| Large (10-40 GB) | ml.p3.8xlarge | 4× V100 (64 GB total) | $14.688 | Distributed training |
| Very Large (>40 GB) | ml.p4d.24xlarge | 8× A100 (320 GB total) | $37.688 | Largest models, model parallelism |

**3. Use managed data parallelism**: Train faster with multiple instances instead of single large instance.

**Example**: Train model in 1 hour on ml.p3.8xlarge (4 GPUs, $14.69/hour) vs 4 hours on ml.p3.2xlarge (1 GPU, $3.83/hour).
- ml.p3.8xlarge: 1 hour × $14.69 = $14.69
- ml.p3.2xlarge: 4 hours × $3.83 = $15.32

Single large instance cheaper when training scales well across GPUs (distributed training overhead <10%).

**4. Use SageMaker Training Compiler**: Optimize training code for 50% faster training (Python/TensorFlow/PyTorch).

```python
estimator = PyTorch(
    entry_point='train.py',
    instance_type='ml.p3.2xlarge',
    compiler_config={  # Enable SageMaker Training Compiler
        'enabled': True
    }
)
```

Training time: 4 hours → 2 hours. Cost: 4 × $3.83 = $15.32 → 2 × $3.83 = $7.66 (50% savings).

**5. Use Pipe mode for large datasets**: Stream data from S3 instead of downloading entire dataset to instance.

**File mode** (default): Download 100 GB dataset to instance before training (15 minutes download, costs $1 in instance time).

**Pipe mode**: Stream data during training (0 download time, start training immediately).

```python
from sagemaker.inputs import TrainingInput

estimator.fit({
    'training': TrainingInput(
        's3://my-bucket/training-data/',
        input_mode='Pipe'  # Stream data instead of download
    )
})
```

### Inference Cost Optimization

**1. Use serverless endpoints for low traffic** (<40,000 requests/hour):

**Example**: 10,000 requests/day.
- Real-time endpoint: ml.t2.medium = $0.065/hour × 730 hours = $47.45/month
- Serverless: 10,000 × 30 days × $0.20/million + minimal GB-hours = $0.10/month
- Savings: $47.35/month (99.8%)

**2. Use instance families optimized for inference** (not training):

| Instance Family | Use Case | Cost/hour (ml.c5.xlarge) |
|-----------------|----------|--------------------------|
| **ml.c5** | CPU inference (general purpose) | $0.238 |
| **ml.g4dn** | GPU inference (image/video models) | $0.94 |
| **ml.inf1** | AWS Inferentia (custom chip for inference) | $0.368 |

ml.inf1 provides GPU-like performance at 60% lower cost for supported frameworks (TensorFlow, PyTorch).

**3. Use multi-model endpoints**: Host multiple models on single endpoint to share infrastructure.

```python
from sagemaker.multidatamodel import MultiDataModel

multi_model = MultiDataModel(
    name='multi-model-endpoint',
    model_data_prefix='s3://my-bucket/models/',  # Folder with multiple model.tar.gz files
    image_uri='...',
    role=role
)

predictor = multi_model.deploy(
    initial_instance_count=2,
    instance_type='ml.m5.large'
)

# Invoke specific model
result = predictor.predict(data, target_model='model-123.tar.gz')
```

**Cost savings**: Host 100 models on 2× ml.m5.large instances ($0.134/hour × 2 = $0.268/hour) instead of 100 separate endpoints (100 × $0.134 = $13.40/hour). Savings: 98%.

**Limitation**: Works best when models invoked infrequently. Frequent model switching incurs model load time (~1 second per model).

**4. Right-size auto-scaling**: Don't over-provision minimum instances.

**Bad configuration**:
```python
MinCapacity=10,  # 10 instances always running
MaxCapacity=50
```

10 instances × ml.m5.large × $0.134/hour × 730 hours = $978/month minimum cost, even if traffic only requires 2 instances.

**Good configuration**:
```python
MinCapacity=2,  # Start with 2 instances
MaxCapacity=50  # Scale up to 50 during peak
```

2 instances × $0.134/hour × 730 hours = $196/month minimum. Savings: $782/month (80%).

**5. Use batch transform for offline inference**: Don't run real-time endpoint for nightly batch jobs.

**Bad**: Real-time endpoint running 24/7, used only for 1-hour nightly batch job.
- Cost: ml.m5.large × $0.134/hour × 730 hours = $97.82/month

**Good**: Batch transform job runs 1 hour/night.
- Cost: ml.m5.large × $0.134/hour × 30 hours = $4.02/month
- Savings: $93.80/month (96%)

### Storage Cost Optimization

**Model artifacts** in S3 incur storage costs. Delete old model versions.

**Example**: 100 model versions × 5 GB each = 500 GB × $0.023/GB = $11.50/month.

**S3 lifecycle policy**: Delete model artifacts older than 90 days.
```json
{
  "Rules": [{
    "Id": "delete-old-models",
    "Filter": {"Prefix": "models/"},
    "Status": "Enabled",
    "Expiration": {"Days": 90}
  }]
}
```

Keep only latest 10 versions in model registry, delete rest.

## When to Use AWS SageMaker

**Strong fit**:
- ✅ Production ML workloads requiring scalable training and inference
- ✅ Teams already using Python ML libraries (TensorFlow, PyTorch, scikit-learn, XGBoost)
- ✅ Distributed training requirements (models too large for single GPU, datasets >100 GB)
- ✅ MLOps maturity goals (model versioning, A/B testing, monitoring)
- ✅ Cost optimization through spot instances and serverless inference
- ✅ Need for managed infrastructure (no DevOps team to maintain ML clusters)

**Consider alternatives when**:
- ❌ **Simple inference on pre-trained models** → Lambda with container images (cheaper for <10,000 requests/day)
- ❌ **No custom model training** → Use AWS AI services (Rekognition, Comprehend, Textract) for pre-built models
- ❌ **Existing Kubernetes ML infrastructure** → Keep using Kubeflow, selectively adopt SageMaker for training only
- ❌ **Real-time inference <1ms latency** → Deploy models on EC2 with GPU optimization or Lambda@Edge
- ❌ **Ultra-low cost priority, can manage infra** → Self-managed EC2 Spot instances with MLflow/Kubeflow

## SageMaker vs Alternatives

### SageMaker vs Self-Managed (EC2 + MLflow/Kubeflow)

| Aspect | SageMaker | Self-Managed |
|--------|-----------|--------------|
| **Training cost** | Pay per training hour | Pay for cluster 24/7 |
| **Inference cost** | Pay per endpoint hour or request (serverless) | Pay for cluster 24/7 |
| **Setup time** | Minutes (API call) | Days-weeks (infrastructure setup) |
| **Distributed training** | Built-in (data/model parallelism) | Manual setup (Horovod, DeepSpeed) |
| **Spot instances** | One parameter | Manual spot fleet management |
| **A/B testing** | Built-in multi-variant endpoints | Custom routing logic |
| **Model registry** | Built-in with approval workflows | MLflow Model Registry (self-hosted) |

**Cost example** (4 hours training/day on ml.p3.2xlarge):
- SageMaker: 4 hours/day × $3.83 × 30 days = $459/month
- Self-managed: p3.2xlarge 24/7 = $2,795/month (even if used only 4 hours/day)
- Savings: $2,336/month (84%)

### SageMaker vs Vertex AI (Google Cloud)

| Aspect | SageMaker | Vertex AI |
|--------|-----------|-----------|
| **Ecosystem** | AWS-native (S3, IAM, CloudWatch) | GCP-native (GCS, IAM, Cloud Monitoring) |
| **Training pricing** | $3.06/hour (n1-standard-4 + V100) | $2.90/hour (n1-standard-4 + V100) |
| **Managed notebooks** | SageMaker Studio | Vertex AI Workbench |
| **AutoML** | SageMaker Autopilot | Vertex AI AutoML |
| **Pre-built algorithms** | 17 built-in algorithms | Vertex AI pre-built containers |

Both platforms comparable in features and pricing. Choose based on existing cloud provider.

### SageMaker vs Databricks ML

| Aspect | SageMaker | Databricks ML |
|--------|-----------|---------------|
| **Strength** | End-to-end ML platform | Unified data + ML platform (Spark + ML) |
| **Training** | Managed training jobs | Notebooks on Databricks clusters |
| **Inference** | Managed endpoints | MLflow Model Serving (beta) |
| **Data prep** | SageMaker Data Wrangler | Native Spark integration |
| **Cost** | Training + inference separate | Cluster costs (all-in-one) |

**Databricks wins** if your primary workload is big data processing (Spark) with ML as secondary. **SageMaker wins** if ML is primary workload.

### SageMaker Training vs AWS Batch + EC2

**AWS Batch**: Run containerized training jobs on EC2/Spot with custom job orchestration.

**When to use AWS Batch instead of SageMaker Training**:
- ✅ Need full control over container environment (custom libraries, system dependencies)
- ✅ Want to manage Spot instance bidding strategies manually
- ✅ Already have Batch infrastructure for other workloads

**When to use SageMaker Training**:
- ✅ Want managed distributed training without configuring MPI/Horovod
- ✅ Need automatic model versioning and experiment tracking
- ✅ Prefer declarative training API over custom Docker containers

**Cost**: Comparable. Both use same underlying EC2/Spot instances. SageMaker adds 10-15% overhead for managed features.

## Common Pitfalls

### Running Real-Time Endpoints 24/7 for Batch Inference

**Symptom**: Endpoint used only 1 hour/day for nightly batch scoring, but runs 24/7.

**Cost**: ml.m5.large × $0.134/hour × 730 hours = $97.82/month.

**Solution**: Use batch transform instead.
- Cost: ml.m5.large × $0.134/hour × 30 hours = $4.02/month
- Savings: $93.80/month (96%)

### Not Using Spot Instances for Training

**Symptom**: All training jobs use on-demand instances, paying full price.

**Solution**: Enable spot instances for 70% savings.

```python
use_spot_instances=True,
max_wait=7200,
checkpoint_s3_uri='s3://my-bucket/checkpoints/'
```

**Consideration**: Implement checkpointing to handle spot interruptions. SageMaker resumes from last checkpoint automatically.

### Over-Provisioning Endpoint Min Capacity

**Symptom**: Auto-scaling min capacity set to 10 instances, but traffic only requires 2 instances most of the time.

**Cost impact**: 8 unnecessary instances × ml.m5.large × $0.134/hour × 730 hours = $782/month wasted.

**Solution**: Set min capacity to actual baseline traffic, rely on auto-scaling for peaks.

### Not Monitoring Model Performance Drift

**Symptom**: Model accuracy degrades over months, but no one notices until business metrics drop.

**Root cause**: No monitoring of model predictions vs ground truth.

**Solution**: Use SageMaker Model Monitor to detect drift.

```python
from sagemaker.model_monitor import DataCaptureConfig

data_capture_config = DataCaptureConfig(
    enable_capture=True,
    sampling_percentage=100,  # Capture 100% of requests
    destination_s3_uri='s3://my-bucket/data-capture'
)

predictor = model.deploy(
    initial_instance_count=2,
    instance_type='ml.m5.large',
    data_capture_config=data_capture_config
)
```

Model Monitor compares recent predictions against baseline distribution, alerts on drift.

### Storing Notebooks on Expensive Instance Storage

**Symptom**: SageMaker notebook instance (ml.t3.medium) runs 24/7 even when not in use, costing $36.50/month.

**Solution**: Use SageMaker Studio (pay per kernel-hour) or stop notebook instances when idle.

**Studio cost**: If notebook used 20 hours/month, pay only for those 20 hours (vs 730 hours/month with always-on instance).

### Not Using Managed Spot Training Checkpoints

**Symptom**: Spot instance interrupted during training, entire training job restarts from scratch, wasting hours of compute.

**Solution**: Enable checkpointing so training resumes from interruption point.

```python
checkpoint_s3_uri='s3://my-bucket/checkpoints/',
use_spot_instances=True
```

SageMaker saves checkpoints every N minutes, resumes from last checkpoint after spot interruption.

## Key Takeaways

**AWS SageMaker provides managed infrastructure for the full ML lifecycle** from experimentation in Studio notebooks to distributed training on spot instances to auto-scaling inference endpoints. This eliminates the operational burden of managing GPU clusters, implementing distributed training, and building serving infrastructure.

**Cost optimization comes from spot instances and right-sizing**. Use spot instances for 70% training cost savings, serverless endpoints for infrequent inference (99% cheaper than always-on endpoints), and multi-model endpoints to host dozens of models on shared infrastructure.

**Distributed training is built-in** via data parallelism (split dataset across GPUs) and model parallelism (split model across GPUs). This scales training from 1 GPU to 100+ GPUs with minimal code changes, reducing training time from days to hours.

**Model registry and A/B testing enable MLOps maturity**. Version models automatically, implement approval workflows before production deployment, and A/B test model versions by routing traffic splits to different variants on the same endpoint.

**Choose SageMaker when ML is your primary workload** and you want managed infrastructure. Use AWS AI services (Rekognition, Comprehend) for pre-built models without custom training. Use self-managed EC2 if you need absolute cost minimization and have DevOps resources to manage clusters.

**Common pitfalls involve not using cost-saving features**. Enable spot instances for training, use serverless endpoints for low-traffic inference, implement auto-scaling with appropriate min capacity, and stop unused notebook instances. Monitor model performance drift to detect when retraining is needed.

**SageMaker vs Databricks**: Choose SageMaker for pure ML workloads, Databricks if you're primarily doing Spark-based big data processing with ML as a secondary concern. Both provide similar ML capabilities, but differ in data processing integration.

**Serverless inference is the default for new endpoints** unless you have >40,000 requests/hour continuous traffic. Below that threshold, serverless costs 95-99% less than always-on real-time endpoints with comparable latency (excluding cold starts).
