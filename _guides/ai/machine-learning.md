---
title: "Machine Learning"
layout: guide
category: AI & Machine Learning
subcategory: Machine Learning
description: "Machine learning fundamentals: how models learn from examples, the three kinds of learning, evaluating a model without fooling yourself, explainability, and when machine learning is the wrong tool."
tags: [supervised-learning, unsupervised-learning, reinforcement-learning, neural-networks, model-evaluation, fundamentals]
---

## How AI, Machine Learning, and Deep Learning Relate

The three terms nest inside each other. **Artificial intelligence** is the broadest: any computer system performing tasks that normally take human intelligence, such as perception, language, and decision-making, whether it gets there through hand-written rules or learned behavior. **Machine learning** is the subset of AI where the system learns its behavior from data instead of following instructions a programmer wrote. **Deep learning** is the subset of machine learning that uses neural networks with many layers.

### Machine Learning Replaces Rules With Examples

A traditional program encodes the rules directly. A spam filter written that way checks for known phrases, suspicious senders, and too many links, and every new spam tactic needs a new rule. A machine learning spam filter is instead shown thousands of emails already marked spam or not spam, and it works out for itself which patterns separate the two. The programmer's job shifts from writing the rules to choosing the data, the learning method, and the way success is measured.

The output of that learning process is a **model**: a function with learned internal values that maps new inputs to predictions. The **algorithm** is the procedure that produces the model from data. A decision tree algorithm, run on two different datasets, produces two different models.

### Deep Learning Is Machine Learning With Many-Layered Neural Networks

A neural network is a set of connected units arranged in layers. Each unit multiplies its inputs by weights, sums them, and passes the result through a non-linear function to the next layer. The design was loosely inspired by biological neurons, but the resemblance ends at the metaphor. A network with more than one hidden layer between input and output is called deep, and modern networks range from a handful of layers to hundreds.

Depth matters because each layer can build on the representations the previous one learned. In an image model, early layers tend to respond to edges, middle layers to textures and shapes, and later layers to whole objects. Nobody programs those intermediate features. They emerge from training, which is why deep learning dominates tasks like vision, speech, and language where hand-designing features is impractical.

### Narrow AI and Artificial General Intelligence

Every AI system in production today is **narrow** (sometimes called weak or applied) AI. It performs well within the tasks it was built or trained for and has no competence outside them. **Artificial general intelligence (AGI)** describes a system with general-purpose ability comparable to a human's across domains. There's no agreed definition or test for it, so claims that a system has reached it are contested.

---

## How a Model Learns

### Features, Labels, and Parameters

**Features** are the measurable inputs describing each example. For predicting house prices, features might include floor area, number of bedrooms, location, and the age of the house. Choosing informative features has a large effect on what a model can learn, and the work of deriving them from raw data is called feature engineering.

**Labels** are the correct answers the model learns to predict, like the actual sale price of each house or the species name for each bird photo. Labels come from wherever ground truth exists: human annotators, historical records, or later outcomes such as whether a customer actually churned. Obtaining labels is often the most expensive part of a project.

**Parameters** are the values the model learns during training, such as the weights in a neural network or the split points in a decision tree. **Hyperparameters** are settings chosen before training that control how learning happens, such as the learning rate, the maximum depth of a tree, or the number of clusters. Training finds the parameters. The practitioner, usually through experiments, picks the hyperparameters.

### The Training Loop

Most models learn by repeatedly measuring how wrong they are and adjusting to be less wrong.

```
 ┌──────────────┐     ┌──────────────┐     ┌───────────────┐
 │  Batch of    │────►│    Model     │────►│  Predictions  │
 │  training    │     │ (parameters) │     └───────┬───────┘
 │  examples    │     └──────▲───────┘             │
 └──────────────┘            │                     ▼
                      ┌──────┴───────┐     ┌───────────────┐
                      │  Optimizer   │◄────│  Loss: how    │
                      │  adjusts the │     │  far off the  │
                      │  parameters  │     │  predictions  │
                      └──────────────┘     │  are from the │
                          gradient         │  labels       │
                                           └───────────────┘
```

A **loss function** turns prediction error into a single number, such as the average squared difference between predicted and actual prices. The **gradient** of the loss says which direction each parameter should move to reduce it. **Gradient descent** moves every parameter a small step in that direction, with the step size set by the learning rate, and then the loop repeats on the next batch. A learning rate that's too high makes the loss jump around or diverge. One that's too low makes training slow and can stall it.

Not every algorithm uses gradient descent. Decision trees, for example, grow by greedily choosing the split that best separates the labels at each node. The pattern of fitting to data and measuring error against labels still holds.

### Neural Networks and Backpropagation

In a network with many layers, computing the gradient for every weight is the hard part. **Backpropagation** solves it by applying the chain rule backwards from the loss, layer by layer, so one backward pass yields every gradient.

The ideas took decades to come together. The McCulloch-Pitts neuron model dates to 1943 and Frank Rosenblatt's perceptron to 1958. In 1969, Minsky and Papert's *Perceptrons* showed that a single-layer perceptron can only learn linearly separable functions (it can't learn XOR), which contributed to a collapse in neural network funding and interest. The reverse-mode differentiation behind backpropagation appeared in Seppo Linnainmaa's 1970 thesis, and Paul Werbos proposed applying it to neural networks in 1974. It was [Rumelhart, Hinton, and Williams' 1986 paper in Nature](https://www.nature.com/articles/323533a0){:target="_blank" rel="noopener noreferrer"} that demonstrated backpropagation training multi-layer networks and revived the field. The modern deep learning era took off after 2012, when a GPU-trained convolutional network (AlexNet) won the ImageNet image-recognition competition by a wide margin.

### Training and Inference

**Training** is the loop above, run until the model stops improving on data it hasn't trained on. It's the computationally expensive phase. **Inference** is using the finished model to make predictions on new inputs, with the parameters frozen. Inference is usually far cheaper per prediction, but it runs continuously in production, so for widely used models its total cost can exceed training's. Where inference runs (a cloud service, a server, a phone) depends on the model's size and the latency the application needs.

---

## The Three Kinds of Learning

### Supervised Learning

The model learns from examples paired with correct answers, then predicts answers for new examples. Two task types cover most uses:

- **Classification** predicts a category. Binary classification picks between two (spam or not spam, fraud or legitimate), and multiclass classification picks among several (which of ten handwritten digits, which product category).
- **Regression** predicts a continuous number, like a price, a temperature, or delivery time.

Common algorithms trade interpretability, accuracy, and data requirements against each other:

| Algorithm | How it works | Strengths | Watch out for |
|---|---|---|---|
| **Linear regression** | Fits a weighted sum of features to a numeric target | Fast, interpretable, a strong baseline | Can't capture non-linear relationships without engineered features |
| **Logistic regression** | Fits a weighted sum and squashes it into a probability for classification | Interpretable, calibrated probabilities | Same linearity limit as linear regression |
| **Decision tree** | Learns a hierarchy of if/then splits on features | Easy to visualize and explain | A single deep tree overfits readily |
| **Random forest** | Averages many trees, each trained on random subsets of rows and features (Breiman, 2001) | Robust, little tuning needed | Harder to explain than one tree |
| **Gradient-boosted trees** | Adds trees one at a time, each correcting the errors of those before | Frequently the most accurate choice on tabular data | More hyperparameters to tune, easier to overfit than a forest |
| **Support vector machine** | Finds the boundary with the widest margin between classes, using the kernel trick for non-linear boundaries (Boser, Guyon, and Vapnik, 1992) and a soft margin for overlapping classes (Cortes and Vapnik, 1995) | Effective in high-dimensional spaces with modest data | Scales poorly to very large datasets |
| **Neural network** | Layers of weighted units trained by backpropagation | Learns its own features from raw images, audio, and text | Needs a lot of data and compute; hard to interpret |

Decision trees trace to the CART (Breiman et al., 1984) and ID3 (Quinlan, 1986) algorithms.

### Unsupervised Learning

The model gets data with no labels and finds structure in it. Evaluating the result is harder than in supervised learning because there's no correct answer to compare against. A clustering is only as good as the decisions it supports, such as whether the customer segments it finds respond differently to marketing.

- **Clustering** groups similar items together, such as segmenting customers by purchasing behavior. There's no single best clustering criterion, and different algorithms (k-means, density-based methods, hierarchical clustering) can produce very different groupings of the same data.
- **Dimensionality reduction** compresses many features into fewer while keeping as much of the variation as possible. It's used to visualize high-dimensional data, speed up other algorithms, and remove noise. Principal component analysis (PCA) is the classic method.
- **Anomaly detection** flags points that don't fit the patterns in the rest of the data, such as unusual transactions or sensor readings.

**Self-supervised learning** sits between supervised and unsupervised. It creates labels from the data itself, for example by hiding a word in a sentence and training the model to predict it. It needs no human labeling, which makes training on enormous unlabeled datasets possible, and it's how large language models are pretrained.

### Reinforcement Learning

An **agent** takes actions in an **environment**, observes the resulting **state**, and receives a **reward** signal. Nobody tells it the correct action. It learns a **policy** (a strategy for choosing actions) that maximizes the total reward it collects over time.

```
                     action
        ┌──────────────────────────────┐
        │                              ▼
  ┌─────┴─────┐                 ┌─────────────┐
  │   Agent   │                 │ Environment │
  │ (policy)  │                 │             │
  └─────▲─────┘                 └──────┬──────┘
        │      new state + reward      │
        └──────────────────────────────┘
```

Two things make reinforcement learning harder than supervised learning. Rewards can arrive long after the actions that earned them, so the agent has to work out which earlier actions deserve credit. And the agent has to balance exploiting actions it knows pay off against exploring actions that might pay off more.

Much of reinforcement learning rests on the **Bellman equation**, from Richard Bellman's work on dynamic programming in the 1950s. It defines the value of a state recursively: the best achievable value is the immediate reward plus the discounted value of wherever the best action leads. The optimality form, as written in [Sutton and Barto's *Reinforcement Learning*](http://incompleteideas.net/book/the-book-2nd.html){:target="_blank" rel="noopener noreferrer"}, is:

```
V*(s) = max over actions a of  Σ  p(s', r | s, a) × [ r + γ · V*(s') ]
                              s',r
```

Here `p(s', r | s, a)` is the probability of reaching state `s'` with reward `r` after taking action `a` in state `s`, and the discount factor `γ` (between 0 and 1) sets how much future rewards count relative to immediate ones. The sum matters: environments are often random, so the equation weighs every possible outcome by its probability rather than assuming one. A related form defines Q-values, the value of taking a specific action in a state, which algorithms like Q-learning estimate directly.

**Deep reinforcement learning** uses neural networks to approximate these value functions or the policy itself. DeepMind's AlphaGo combined networks trained partly through self-play reinforcement learning with tree search to beat top human Go players. Beyond games, reinforcement learning is applied to robotics control, resource allocation, and recommendation, and a variant that learns from human preference judgments is used to fine-tune large language models.

### Choosing a Learning Type

```
Do you have examples with known correct answers?
├── Yes ─► Supervised learning
│          Is the answer a category or a number?
│          ├── Category ─► Classification
│          └── Number   ─► Regression
└── No
    ├── Is the goal to find structure in the data? ─► Unsupervised learning
    │     ├── Groups of similar items   ─► Clustering
    │     ├── Fewer, denser features    ─► Dimensionality reduction
    │     └── Points that don't fit     ─► Anomaly detection
    └── Does a system act repeatedly and receive a reward signal?
          └── Yes ─► Reinforcement learning
```

A common intermediate case is having a large unlabeled dataset and a small labeled one. Self-supervised pretraining on the unlabeled data, followed by supervised training on the labeled data, often beats training on the small labeled set alone.

---

## Evaluating a Model

A model that performs well on the data it trained on has proven nothing. The whole point is performance on data it hasn't seen, and most evaluation practice exists to measure that honestly.

### Train, Validation, and Test Splits

[scikit-learn's cross-validation guide](https://scikit-learn.org/stable/modules/cross_validation.html){:target="_blank" rel="noopener noreferrer"} calls testing a model on the data it trained on "a methodological mistake," since a model that simply memorized the labels would score perfectly and predict nothing useful. The standard remedy divides the data by role:

| Split | Used for | Rule |
|---|---|---|
| **Training set** | Fitting the model's parameters | The model sees these labels |
| **Validation set** | Comparing models and tuning hyperparameters | Used repeatedly during development |
| **Test set** | One final estimate of real-world performance | Touched once, after all decisions are made |

The validation set exists because tuning against the test set leaks information. Every time you adjust a hyperparameter because the test score improved, the test set stops being unseen data, and its score stops reflecting how the model will generalize.

### Cross-Validation

Holding out a separate validation set wastes data when data is scarce. **K-fold cross-validation** splits the training data into k parts, trains k times using k−1 parts, and validates on the remaining part each time. The reported score is the average across folds, which is also more stable than a single validation split. The test set still stays held out for the final check.

Random splitting assumes examples are independent. For time series, validation data has to come after the training data in time, or the model gets to learn from the future.

### Data Leakage

**Data leakage** occurs, in [scikit-learn's words](https://scikit-learn.org/stable/common_pitfalls.html){:target="_blank" rel="noopener noreferrer"}, "when information that would not be available at prediction time is used when building the model." It produces evaluation scores that look excellent and a model that disappoints in production. It happens in a few recurring ways:

- **Preprocessing before splitting.** Fitting a scaler, feature selector, or imputer on the full dataset lets statistics from the test data shape the training data. Split first, fit preprocessing on the training set only, and apply the same fitted transform to the test set. Pipelines that bundle preprocessing with the model enforce this automatically.
- **Features that encode the answer.** A churn model that uses "account closure date" as a feature will look brilliant, because that field only exists for customers who already churned.
- **Duplicates across splits.** Near-identical records in both training and test sets let the model score well by recognition rather than generalization.

### Underfitting and Overfitting

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Underfitting</h4>
<ul>
<li><strong>Symptom</strong>: Poor performance on both training and validation data</li>
<li><strong>Cause</strong>: The model is too simple for the pattern, the features don't carry enough signal, or training stopped too early</li>
<li><strong>Remedies</strong>: A more expressive model, better features, longer training</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Overfitting</h4>
<ul>
<li><strong>Symptom</strong>: Strong training performance, much weaker validation performance</li>
<li><strong>Cause</strong>: The model learned noise and quirks of the training set instead of the general pattern</li>
<li><strong>Remedies</strong>: More training data, a simpler model, regularization, early stopping</li>
</ul>
</div>
</div>

The two pull against each other, which is often described as the bias-variance trade-off. A simple model makes consistent but systematically wrong predictions (high bias). A very flexible model fits each training set closely but changes a lot between training sets (high variance). **Regularization** adds a penalty for complexity to the loss. L2 regularization (ridge) shrinks all weights toward zero, L1 (lasso) can drive some weights exactly to zero and so drops features, and elastic net combines the two. **Early stopping** ends training when the validation loss starts rising even as training loss keeps falling.

### Choosing a Metric

The metric decides what "good" means, and the default one is often the wrong one.

| Metric | Measures | Use when |
|---|---|---|
| **Accuracy** | Share of all predictions that are correct | Classes are roughly balanced and all errors cost the same |
| **Precision** | Of the items predicted positive, the share that actually are | False positives are expensive, like flagging legitimate transactions as fraud |
| **Recall** | Of the items actually positive, the share the model found | False negatives are expensive, like missing a disease |
| **F1 score** | Harmonic mean of precision and recall | You need one number that balances both |
| **ROC AUC** | How well the model ranks positives above negatives across all thresholds | Comparing models before choosing a decision threshold |
| **MAE** | Average absolute error of a numeric prediction | Every unit of error costs the same |
| **RMSE** | Square root of the average squared error | Large errors are disproportionately bad |
| **R²** | Share of the target's variance the model explains | Comparing regression models on the same target |

Accuracy misleads badly on imbalanced data. If 1% of transactions are fraudulent, a model that labels everything legitimate is 99% accurate and catches no fraud at all. Precision and recall also trade against each other through the decision threshold. Lowering the score at which a model says "fraud" finds more fraud (higher recall) and flags more legitimate transactions (lower precision), so picking the threshold is a business decision about which error costs more.

---

## Explainability

### Black Boxes and Interpretable Models

Some models explain themselves. A linear model's weights say how much each feature pushes the prediction, and a shallow decision tree can be read as a flowchart. Others, like large ensembles and deep neural networks, are **black boxes** that produce predictions without a readable account of why. The more expressive models tend to be the less interpretable ones, so a regulated decision such as a loan approval can favor a slightly less accurate model whose reasoning can be shown to an auditor or the person affected.

### Explanation Methods

**Explainable AI (XAI)** covers techniques that describe a black-box model's behavior after the fact:

- **Global feature importance** ranks which features matter most across all predictions, for example by measuring how much performance drops when a feature's values are shuffled (permutation importance).
- **Local explanations** attribute a single prediction to its features. SHAP assigns each feature a contribution based on game-theoretic Shapley values, and LIME fits a simple interpretable model around one prediction.
- **Partial dependence plots** show how the predicted outcome changes as one feature varies.

These methods describe what the model is sensitive to, not the true causal reasoning, and they can disagree with each other. Attention weights in neural networks are a particular trap. They look like an explanation of which inputs mattered, but [Jain and Wallace (2019)](https://aclanthology.org/N19-1357/){:target="_blank" rel="noopener noreferrer"} found that attention weights frequently didn't correlate with gradient-based importance measures, and that very different attention patterns could produce the same predictions.

---

## When Not to Use Machine Learning

Machine learning trades the effort of writing rules for the effort of gathering data, validating models, and monitoring them indefinitely. That trade doesn't always pay:

- **The rules are known and stable.** Tax calculations, access control, and input validation are better as explicit code that can be read, tested, and audited.
- **There isn't enough data, or no reliable labels.** A model can't learn a pattern the data doesn't contain, and noisy labels teach noisy behavior.
- **Every error needs a guarantee.** Model predictions are probabilistic. If a wrong answer is unacceptable and there's no human review or fallback, a deterministic system fits better.
- **A simple heuristic gets close enough.** Start with a baseline, even "always predict the most common class" or a hand-written rule. If a model can't beat it by enough to justify the ongoing cost, don't ship the model.
- **The decision must be explained and the explanation must be exact.** Post-hoc explanation methods approximate a black box's behavior without reproducing its reasoning.

---

## Common Pitfalls

| Pitfall | What happens | Prevention |
|---|---|---|
| **Evaluating on training data** | Scores reflect memorization, not generalization | Hold out validation and test sets |
| **Tuning against the test set** | The test score becomes optimistic | Tune on validation data or cross-validation; use the test set once |
| **Data leakage** | Excellent offline scores, poor production performance | Split before preprocessing; audit features for information unavailable at prediction time |
| **Accuracy on imbalanced classes** | A model that ignores the rare class looks nearly perfect | Use precision, recall, or F1, and inspect the confusion matrix |
| **Random splits on time-ordered data** | The model learns from the future | Split by time |
| **No baseline** | No way to tell whether the model adds value | Compare against a simple rule or majority-class prediction first |
