---
title: "MLOps"
layout: guide
category: AI & Machine Learning
subcategory: Machine Learning
description: "Running machine learning models in production: why models need their own operations discipline, maturity levels from manual to automated pipelines, feature stores and training-serving skew, safe deployment patterns, drift monitoring, and governance."
tags: [mlops, model-monitoring, data-drift, feature-store, model-registry, deployment, practical]
---

## Why Machine Learning Needs Its Own Operations Discipline

MLOps applies DevOps practices like version control, automated testing, continuous delivery, and monitoring to machine learning systems. It exists as its own discipline because those practices, applied unchanged, miss the parts of an ML system that behave differently from ordinary software.

### The Model Is a Small Part of the System

Sculley et al.'s paper [Hidden Technical Debt in Machine Learning Systems](https://papers.nips.cc/paper/5656-hidden-technical-debt-in-machine-learning-systems){:target="_blank" rel="noopener noreferrer"} (NeurIPS 2015) observed that only a small fraction of a real-world ML system is the model code. Around it sit data collection, data verification, feature extraction, configuration, resource management, serving infrastructure, and monitoring, and most of the engineering effort and most of the failures live in those surrounding pieces. The paper catalogues risks specific to ML systems, including entanglement between features, hidden feedback loops, undeclared consumers of a model's output, and dependencies on data that nobody versions.

### Models Decay Without Code Changes

Ordinary software keeps behaving the same until someone changes the code. A model can get worse while its code, weights, and infrastructure stay identical, because the world it was trained on moves. Customer behavior shifts, a supplier changes a product catalog format, or a fraud ring adapts to the model that's catching it. An ML system therefore has three things that change independently and all need managing: the code, the model, and the data.

---

## What Gets Versioned

Reproducing a model means being able to recover everything that produced it. Versioning only the training code leaves most of that unrecorded.

| Artifact | Why it needs versioning |
|---|---|
| **Training and serving code** | The same as any software, and serving code computes features too |
| **Training data** | The same code on a different data snapshot produces a different model |
| **Feature definitions** | A changed transformation silently changes what the model sees |
| **Hyperparameters and configuration** | Small changes can shift model behavior significantly |
| **Model artifact** | The deployed thing, needed for rollback and comparison |
| **Evaluation results** | The evidence a model was fit to promote |
| **Environment** | Library versions affect both training results and numeric behavior at serving time |

The record linking these together (which data, code, and configuration produced which model, evaluated how, deployed where) is called **lineage**, and it's what lets a team answer "why did the model do that?" months later.

---

## Continuous Integration, Delivery, and Training

ML systems extend the two familiar continuous practices and add a third.

| Practice | In ordinary software | Extended for ML |
|---|---|---|
| **Continuous integration** | Test and validate code | Also validate data schemas and values, and test that models train and meet quality thresholds |
| **Continuous delivery** | Deliver a software package | Deliver a training pipeline that produces models, plus the prediction service |
| **Continuous training** | Not applicable | Automatically retrain and redeploy models as new data arrives or performance degrades |

Continuous training is the part with no software equivalent. It turns retraining from a project someone schedules into a pipeline that runs on a trigger.

---

## Maturity Levels

Google Cloud's [MLOps architecture guide](https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning){:target="_blank" rel="noopener noreferrer"} describes three levels of automation that have become a common reference point.

### Level 0: Manual Process

Every step is manual and usually happens in notebooks. A data scientist trains a model and hands the artifact to engineers, who deploy it as a prediction service. Releases are rare, there's no CI or CD, and nobody actively monitors model performance, so degradation goes unnoticed until someone complains. This level is acceptable for a first model or a model that genuinely rarely needs to change, and it's where most teams start.

### Level 1: Automated Training Pipeline

The steps from data extraction to model validation become an orchestrated pipeline, and **the pipeline itself is what gets deployed to production**, not just a model. That shift is what makes continuous training possible. The production pipeline retrains on its own when a trigger fires, validates the new model, and delivers it to the prediction service.

```
  Triggers: schedule · new data · drift detected · performance drop
                                │
                                ▼
 ┌──────────────────────────────────────────────────────────────┐
 │                  Automated training pipeline                   │
 │                                                                │
 │   Extract ──► Validate ──► Prepare ──► Train ──► Evaluate and  │
 │   data        data         features    model     validate      │
 └────────────────────────────────────────────────────┬───────────┘
                                                      │ passes thresholds
                                                      ▼
                                             ┌─────────────────┐
                                             │  Model registry │
                                             └────────┬────────┘
                                                      ▼
                                             ┌─────────────────┐
                                             │   Prediction    │
                                             │   service       │
                                             └────────┬────────┘
                                                      ▼
                                             ┌─────────────────┐
             retraining trigger ◄────────────│   Monitoring    │
                                             └─────────────────┘
```

Automated data validation stops the pipeline when incoming data has an unexpected schema or suspicious values, rather than training a model on garbage. Automated model validation compares the candidate against the current production model before promoting it. What stays manual at this level is changing the pipeline itself. A new feature or model architecture still gets tested and deployed by hand.

### Level 2: CI/CD for the Pipeline

Source changes to pipeline components trigger automated building, testing, and packaging, so new pipeline implementations reach production as quickly as ordinary code changes. Tests cover the components individually and their integration, and the serving path gets load tested. Delivery into development and pre-production environments is automated, while promotion to production is commonly semi-automated or gated on approval. This level pays off when a team runs many models or changes its pipelines often.

---

## Core Components

### Model Registry

A model registry is the system of record for trained models. It stores each model version with its lineage, evaluation metrics, and lifecycle stage (such as candidate, approved, production, or archived), and it's the handoff point between training and deployment. Deployment pulls a specific registered version, which makes rollback a matter of pointing the service at the previous version.

### Feature Store and Training-Serving Skew

**Training-serving skew** is a difference between how a model's inputs look during training and how they look at prediction time. The model was never trained on the inputs it actually receives, so its accuracy drops, and nothing errors. It arises in three common ways:

- **Two implementations of the same feature.** Data scientists compute "average order value over 30 days" in a batch job, engineers reimplement it in the serving code, and the two disagree on edge cases like refunds.
- **Different data freshness.** Training used end-of-day snapshots, but serving reads live values, or the reverse.
- **Features unavailable at prediction time.** Training included a field that doesn't exist yet when the real prediction happens.

A **feature store** attacks the first two by defining each feature once and serving it to both paths. It typically has an **offline store** holding historical feature values for building training sets and an **online store** holding current values at low latency for serving. For training, it retrieves each feature's value as it was at the moment of each historical example (a point-in-time join), which prevents the model from learning on values from the future. Feature stores also let multiple models reuse the same features instead of recomputing them.

### Metadata and Experiment Tracking

Every pipeline run records its inputs, parameters, code and data versions, execution time, output artifacts, and evaluation metrics. During development this is experiment tracking, which is how a team compares hundreds of training runs. In production it's lineage and debugging. When a model misbehaves, metadata answers which data it trained on and whether that data passed validation.

---

## Deploying Models Safely

### Offline Validation Before Online Validation

A new model first has to beat the current one on held-out data, and it should also match it on important slices of that data (a new model can improve overall accuracy while getting much worse for one region or customer segment). Offline evaluation can't capture everything, though. Real traffic differs from historical data, and some effects, like whether users click a recommendation, only show up live. The deployment patterns below provide that online validation with limited risk.

### Deployment Patterns

| Pattern | How it works | What it tests | Use when |
|---|---|---|---|
| **Shadow** | The new model receives a copy of live traffic, but its predictions are logged, not used | Latency, errors, and prediction differences, with no user impact | First production exposure of a significant change |
| **Canary** | A small share of traffic goes to the new model, increasing as metrics hold | Real behavior at small blast radius | Routine promotions with fast rollback |
| **Blue-green** | A full parallel environment runs the new model and traffic switches over at once | Clean cutover and instant rollback | Changes to the serving infrastructure as well as the model |
| **A/B test** | Traffic splits between models for long enough to compare business outcomes statistically | Whether the new model actually improves the outcome | The offline metric is only a proxy for what matters |
| **Multi-armed bandit** | Traffic shifts toward whichever model is performing better while the test runs | Outcome, while limiting exposure to the worse model | Many variants, or when a losing variant is costly to keep serving |

Shadow deployment can't measure outcomes that depend on the prediction being acted on, since users never see the shadow model's output. Anything that needs user response takes a canary or an A/B test.

---

## Monitoring Models in Production

A model can return well-formed predictions at normal latency while being wrong, so infrastructure monitoring alone shows a healthy service. Model monitoring watches the data and the predictions too.

### Data Drift and Concept Drift

- **Data drift** (also called covariate shift) is a change in the distribution of the inputs. A loan model trained mostly on applicants aged 30-50 starts seeing many applicants in their early twenties. The relationship it learned might still hold, but it's now predicting in a region it saw little of.
- **Concept drift** is a change in the relationship between inputs and the correct answer. The same transaction pattern that used to be legitimate is now a common fraud technique. The inputs look familiar and the model is wrong anyway.

Data drift is detectable without labels, by comparing live feature distributions with the training distributions using a statistical distance or test. Concept drift generally isn't, because detecting it requires knowing the correct answers.

### Delayed Ground Truth

In many applications, the correct answer arrives long after the prediction. A fraud label may take weeks to confirm through chargebacks, and whether a loan defaults takes months. Until labels arrive, teams monitor proxies: input drift, shifts in the distribution of predictions (a sudden jump in the share of transactions flagged), and prediction confidence. Once labels arrive, they feed accuracy monitoring and the next training set.

### Feedback Loops

A model's predictions can change the data it later trains on. A recommendation model shows certain products, users can only click what they're shown, and the next training set says those products are what users want. A fraud model blocks transactions, so blocked transactions never produce a confirmed fraud label. These loops quietly narrow what the model can learn. Countermeasures include holding back a small random share of traffic from the model's influence, and logging what was shown or blocked alongside what happened.

### Operational Metrics

| Metric | What to watch |
|---|---|
| **Latency** | Tail latency per request, including feature retrieval, not just model execution |
| **Throughput and errors** | Request volume, failed predictions, fallbacks triggered |
| **Resource use and cost** | CPU, GPU, and memory per prediction; cost per thousand predictions |
| **Data quality** | Missing values, out-of-range values, schema violations in live inputs |
| **Prediction distribution** | Shifts in the output mix, often the earliest visible sign of trouble |
| **Business outcome** | The metric the model exists to improve, once measurable |

### Retraining Triggers

Retraining can run on a schedule, when enough new data has accumulated, when drift crosses a threshold, or when measured performance drops. Scheduled retraining is simplest but retrains when nothing changed and can lag when something did. Trigger-based retraining responds faster but depends on monitoring good enough to fire at the right time. Either way, a retrained model goes through the same validation gates as any other candidate. Retraining on drifted data can also bake a temporary anomaly or a feedback loop into the model.

---

## Governance and Responsible ML

### Model Cards and Datasheets

**Model cards** (Mitchell et al., 2019) document what a model is for, what it shouldn't be used for, how it was evaluated, and how its performance varies across groups and conditions. **Datasheets for datasets** (Gebru et al., 2018) do the same for training data: how it was collected, what it contains, and its known gaps. Both give reviewers, downstream users, and auditors something concrete to evaluate, and they force the team to state limitations explicitly.

### Fairness Metrics

Fairness is measured per group, and the common metrics encode different ideas of fairness. Definitions below follow [Fairlearn's user guide](https://fairlearn.org/main/user_guide/assessment/common_fairness_metrics.html){:target="_blank" rel="noopener noreferrer"}.

| Metric | Requires | Also known as |
|---|---|---|
| **Demographic parity** | Positive predictions at the same rate across groups | Statistical parity, independence |
| **Equalized odds** | The same true positive rate and false positive rate across groups | Separation |
| **Equal opportunity** | The same true positive rate across groups | A relaxed form of equalized odds |

These metrics can conflict. When groups have different underlying rates of the outcome, results by Kleinberg et al. (2016) and Chouldechova (2017) show that a model generally can't be well calibrated and have equal error rates across groups at the same time. Which metric applies depends on the decision and its harms, and Fairlearn cautions that a metric being common doesn't make it applicable to a given situation.

### Regulation

The [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai){:target="_blank" rel="noopener noreferrer"} sorts AI systems into four risk levels (unacceptable, high, transparency, and minimal), with obligations scaled to match. It entered into force on 1 August 2024. Prohibited practices have applied since 2 February 2025 and general-purpose AI obligations since 2 August 2025. After a 2026 amendment deferred them, obligations for high-risk systems in sensitive areas apply from 2 December 2027, and for high-risk systems embedded in regulated products from 2 August 2028. High-risk obligations include risk management, data governance, technical documentation, logging, human oversight, and accuracy and robustness requirements, which map closely onto the versioning, lineage, and monitoring practices above. Sector regulators, such as those for medical devices and credit decisions, add their own requirements.

### Privacy-Preserving Training

**Federated learning** trains a shared model across many devices or organizations without moving the raw data. Each participant trains locally and sends back only model updates. **Differential privacy** adds calibrated noise during training so the finished model can't reveal whether any individual's record was in the training set, at some cost in accuracy. Both are used where regulations or trust prevent centralizing sensitive data, as in healthcare and on-device keyboard prediction.

---

## When Full MLOps Is Overkill

The machinery above has a cost, and not every model earns it. A model retrained a few times a year, serving a low-stakes internal decision, can live comfortably at level 0 with a documented training process, a versioned artifact, and basic monitoring of input data and prediction distribution. Invest in automated pipelines when models need frequent retraining, when there are many of them, when errors are costly, or when regulation demands lineage. Adopt monitoring from the first model regardless, because no amount of careful training prevents a model from silently degrading once the world moves.

---

## Common Pitfalls

| Pitfall | What happens | Prevention |
|---|---|---|
| **Feature logic implemented twice** | Training-serving skew degrades accuracy with no errors | Define features once and share them across training and serving |
| **Monitoring only infrastructure** | A wrong but fast model looks healthy | Monitor input drift, prediction distribution, and outcomes |
| **Unversioned training data** | A model can't be reproduced or its behavior explained | Snapshot or version datasets and record lineage |
| **Auto-promoting retrained models** | A bad data batch ships straight to production | Gate every candidate on validation against the current model |
| **Ignoring slices** | Overall accuracy rises while one segment gets much worse | Evaluate on important segments before promotion |
| **Unrecognized feedback loops** | The model narrows its own future training data | Keep a holdout from the model's influence and log exposures |
