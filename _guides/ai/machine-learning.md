---
title: "Machine Learning"
layout: guide
category: AI & Machine Learning
subcategory: Machine Learning
description: "Machine learning fundamentals built up from one worked example: how a model learns from labeled data through loss and gradient descent, how neural networks extend the same idea, the three kinds of learning, evaluating a model without fooling yourself, explainability, and when machine learning is the wrong tool."
tags: [supervised-learning, unsupervised-learning, reinforcement-learning, neural-networks, gradient-descent, model-evaluation, fundamentals]
---

## What Machine Learning Is

### Rules Written by Hand Versus Rules Learned From Examples

A traditional program encodes its rules directly. A spam filter written that way checks for known phrases, suspicious senders, and too many links, and every new spam tactic needs a new rule from a programmer. A machine learning spam filter is instead shown thousands of emails that people have already marked as spam or not spam, and a training algorithm works out for itself which patterns separate the two. The programmer's job shifts from writing the rules to choosing the examples, the learning method, and the way success is measured.

{% include figure.html id="ml-rules-vs-examples" %}

The output of training is a **model**, and it takes the place the hand-written program used to hold. A new email goes in and an answer comes out, but the logic producing the answer was learned rather than typed.

### A Worked Example: Predicting House Prices

Most of this guide builds on one small problem. Suppose a dataset records houses that have already sold:

| Floor area (m²) | Bedrooms | Age (years) | Sale price |
|---|---|---|---|
| 60 | 1 | 45 | $150k |
| 95 | 2 | 30 | $200k |
| 130 | 3 | 12 | $250k |
| 170 | 4 | 8 | $310k |

Each row is one **example**. The columns describing the house are its **features**, the measurable inputs the model gets to see. The column the model has to predict is the **label**, the correct answer for that example. Once trained, the model receives the features of a house that hasn't sold and predicts its price.

Choosing informative features has a large effect on what a model can learn. Floor area says a lot about price, while the color of the front door probably says little. Deriving useful features from raw data, such as turning a street address into a distance from the city center, is called feature engineering.

Labels come from wherever ground truth exists. Here they come from historical sales records. Elsewhere they come from human annotators, or from later outcomes such as whether a customer actually churned. Obtaining labels is often the most expensive part of a project.

### A Model Is a Function With Learned Parameters

The simplest useful model for this data is a straight line relating floor area to price:

```
predicted price = w × floor area + b
```

`w` is how many thousand dollars each extra square meter adds, and `b` is a baseline price. These two numbers are the model's **parameters**, the values learned during training. Before training they're arbitrary and the line is a poor guess. Training adjusts them until the line runs close to the known sales. A model that uses more features gets one weight per feature (`w₁ × area + w₂ × bedrooms + w₃ × age + b`), and a large neural network has millions or billions of parameters, but each one is a learned number of the same kind.

The **algorithm** is the procedure that produces the model from data. Fitting a line is one algorithm, and growing a decision tree is another. Run the same algorithm on two different datasets and it produces two different models.

**Hyperparameters** are settings chosen before training that control how learning happens, such as how far training moves the parameters on each adjustment, or how many levels a decision tree may grow. Training finds the parameters. The practitioner picks the hyperparameters, usually by running experiments and comparing the results.

### Machine Learning Within AI

Three terms that are often used interchangeably nest inside each other. **Artificial intelligence** is the broadest: any computer system performing tasks that normally take human intelligence, such as perception, language, and decision-making, whether it gets there through hand-written rules or learned behavior. **Machine learning** is the subset of AI where the behavior is learned from data, as in the examples above. **Deep learning** is the subset of machine learning that uses neural networks with many layers, which this guide builds up to after covering how a simpler model learns.

Every AI system in production today is **narrow** (sometimes called weak or applied) AI. It performs well within the tasks it was built or trained for and has no competence outside them. **Artificial general intelligence (AGI)** describes a system with general-purpose ability comparable to a human's across domains. There's no agreed definition or test for it, so claims that a system has reached it are contested.

---

## How a Model Learns

### Loss Measures How Wrong the Model Is

Training needs a way to score a guess. A **loss function** turns the model's errors across a set of examples into a single number, where lower is better. For house prices, a common choice is the average of the squared differences between predicted and actual prices. Squaring makes every error positive, and it makes one large miss count for far more than several small ones.

{% include figure.html id="ml-loss-line-fit" %}

Each dashed segment is one house's error, the gap between its actual price and the price the line predicts. The poor guess leaves long gaps and scores a large loss. The trained line runs through the middle of the points, and its loss is a small fraction of the first. Training is the search for the parameters that make this number as small as possible.

### Gradient Descent Walks the Loss Downhill

For a fixed dataset, every choice of `w` produces a loss. Plotting loss against `w` gives a curve with a lowest point, and that point is the best line. Training doesn't try every possible value. It starts somewhere, measures the slope of the curve where it stands, and takes a step downhill. That slope is the **gradient**, and repeating the measure-and-step is called **gradient descent**. A model with many parameters has a loss surface in many dimensions instead of a curve, but the gradient still says which direction lowers the loss fastest, and each step moves every parameter a little that way.

The size of each step is set by the **learning rate**, the hyperparameter that controls how far each adjustment moves the parameters.

{% include figure.html id="ml-gradient-descent" %}

A learning rate that's too small makes training crawl, and it can stall before it gets near the bottom. One that's too large overshoots the lowest point on every step, so the loss bounces around or climbs until training diverges.

### The Training Loop

Real datasets are too large to compute the loss over every example before every step, so training works through the data in small **batches**. Each pass of the loop predicts, measures, and adjusts:

{% include figure.html id="ml-training-loop" %}

The model predicts prices for a batch of houses. The loss compares those predictions against the batch's labels. The **optimizer**, the component that carries out gradient descent, computes the gradient and updates each parameter, and the loop repeats with the next batch. One full pass over the training data is called an **epoch**, and training often runs for several.

### Not Every Algorithm Uses Gradient Descent

A **decision tree** learns a hierarchy of yes-or-no questions about the features. At each step the algorithm tries candidate splits, such as "floor area under 120 m²?", and keeps the one that best separates the labels, meaning the houses on each side of the split have prices as similar as possible. It then repeats the search inside each branch. A leaf predicts the average price of the training houses that ended up there.

{% include figure.html id="ml-decision-tree" %}

Here the learned parameters are the questions, thresholds, and leaf values rather than weights. The pattern of fitting to training data and measuring error against labels still holds.

### Training and Inference

**Training** is the loop above, run until the model stops improving on data it hasn't trained on. It's the computationally expensive phase. **Inference** is using the finished model to make predictions on new inputs, with the parameters frozen. Inference is usually far cheaper per prediction, but it runs continuously in production, so for widely used models its total cost can exceed training's. Whether inference runs in a cloud service, on a server, or on a phone depends on the model's size and the latency the application needs.

---

## Neural Networks and Deep Learning

### One Unit Is a Weighted Sum With a Bend

A neural network is built from simple units, and each unit does what the house-price line does. It multiplies each input by a weight and adds the results together with a bias, which plays the role of `b`. It then passes the total through an **activation function**, a fixed non-linear bend. A common choice called ReLU passes positive totals through unchanged and turns negative totals into zero.

Units are arranged in **layers**. The input layer holds the features, the output layer produces the prediction, and the layers in between are called **hidden layers** because nothing outside the network sees their values directly. In the common fully connected arrangement, every unit feeds every unit in the next layer, and every one of those connections has its own weight.

{% include figure.html id="ml-neural-network" %}

The design was loosely inspired by biological neurons, but the resemblance ends at the metaphor.

### Why the Bend Matters

Without the activation function, stacking layers would gain nothing. A weighted sum of weighted sums is still one weighted sum, so a hundred layers without bends can only draw the same straight line as one. The bend lets each layer reshape the output of the previous one, and with enough units a network can approximate curved relationships, such as a price that rises steeply with floor area up to a point and then levels off.

This limit shaped the field's history. A single layer of units can only separate classes with a straight boundary, so it can't learn XOR, the function that's true when exactly one of its two inputs is true. Minsky and Papert's 1969 book *Perceptrons* showed this for the single-layer perceptron, which contributed to a collapse in neural network funding and interest. A network with one hidden layer and a non-linear activation can learn XOR.

### Backpropagation Assigns Each Weight Its Share of the Error

Gradient descent needs the gradient for every weight, and in a network with many layers that's the hard part. A weight in the first hidden layer affects the loss only through every layer after it. **Backpropagation** works backwards from the loss one layer at a time. It first computes how much each weight in the output layer contributed to the error, then reuses those results to compute the contributions of the layer before, and so on down to the input. Mathematically it's the chain rule from calculus applied layer by layer, and one backward pass yields the gradient for every weight.

The pieces took decades to come together. The McCulloch-Pitts neuron model dates to 1943 and Frank Rosenblatt's perceptron to 1958. The reverse-mode differentiation behind backpropagation appeared in Seppo Linnainmaa's 1970 thesis, and Paul Werbos proposed applying it to neural networks in 1974. It was [Rumelhart, Hinton, and Williams' 1986 paper in Nature](https://www.nature.com/articles/323533a0){:target="_blank" rel="noopener noreferrer"} that demonstrated backpropagation training multi-layer networks and revived the field.

### Deep Networks Learn Their Own Features

A network with more than one hidden layer is called deep, and modern networks range from a handful of layers to hundreds. Depth matters because each layer can build on the representations the previous one learned. In an image model, early layers tend to respond to edges, middle layers to textures and shapes, and later layers to whole objects. Nobody programs those intermediate features. They emerge from training.

That's the practical difference from the house-price example. A person can choose floor area and bedrooms as features, but nobody can hand-write useful features for raw pixels, audio, or text, which is why deep learning dominates vision, speech, and language. The modern deep learning era took off after 2012, when a GPU-trained convolutional network (AlexNet) won the ImageNet image-recognition competition by a wide margin.

---

## The Three Kinds of Learning

The three kinds differ in what the training data tells the model. Supervised learning gets the correct answers, unsupervised learning gets no answers, and reinforcement learning gets a score for its own actions.

{% include figure.html id="ml-learning-tasks" %}

### Supervised Learning

The house-price model is supervised. It learns from examples paired with correct answers, then predicts answers for new examples. Two task types cover most uses:

- **Classification** predicts a category. Binary classification picks between two (spam or not spam, fraud or legitimate), and multiclass classification picks among several (which of ten handwritten digits, which product category).
- **Regression** predicts a continuous number, like a price, a temperature, or a delivery time.

Common algorithms trade interpretability, accuracy, and data requirements against each other:

| Algorithm | How it works | Strengths | Watch out for |
|---|---|---|---|
| **Linear regression** | Fits a weighted sum of features to a numeric target, like the house-price line | Fast, interpretable, a strong baseline | Only fits straight-line relationships unless the features are transformed first |
| **Logistic regression** | Fits a weighted sum and converts it into a probability between 0 and 1 for classification | Interpretable, and outputs a probability rather than only a label | Same straight-line limit as linear regression |
| **Decision tree** | Learns a hierarchy of yes-or-no splits on features | Easy to visualize and explain | A single deep tree overfits readily |
| **Random forest** | Averages many trees, each trained on random subsets of rows and features (Breiman, 2001) | Robust, little tuning needed | Harder to explain than one tree |
| **Gradient-boosted trees** | Adds trees one at a time, each correcting the errors of those before | Frequently the most accurate choice on tabular data | More hyperparameters to tune, easier to overfit than a forest |
| **Support vector machine** | Finds the boundary that leaves the widest gap between classes. The kernel trick lets it draw curved boundaries (Boser, Guyon, and Vapnik, 1992), and a soft margin tolerates overlapping classes (Cortes and Vapnik, 1995) | Effective with many features and modest data | Scales poorly to very large datasets |
| **Neural network** | Layers of weighted units trained by backpropagation | Learns its own features from raw images, audio, and text | Needs a lot of data and compute, and is hard to interpret |

Decision trees trace to the CART (Breiman et al., 1984) and ID3 (Quinlan, 1986) algorithms.

### Unsupervised Learning

The model gets data with no labels and finds structure in it. Evaluating the result is harder than in supervised learning because there's no correct answer to compare against. A clustering is only as good as the decisions it supports, such as whether the customer segments it finds respond differently to marketing.

- **Clustering** groups similar items together, such as segmenting customers by purchasing behavior. There's no single best clustering criterion, and different algorithms (k-means, density-based methods, hierarchical clustering) can produce very different groupings of the same data.
- **Dimensionality reduction** compresses many features into fewer while keeping as much of the variation between examples as possible. A dataset with fifty measurements per customer can be reduced to two combined measurements and plotted, and the plot can reveal groups that were invisible in the raw columns. It's also used to speed up other algorithms and remove noise. Principal component analysis (PCA) is the classic method.
- **Anomaly detection** flags points that don't fit the patterns in the rest of the data, such as unusual transactions or sensor readings.

**Self-supervised learning** sits between supervised and unsupervised. It creates labels from the data itself, for example by hiding a word in a sentence and training the model to predict it. It needs no human labeling, which makes training on enormous unlabeled datasets possible, and it's how large language models are pretrained.

### Reinforcement Learning

An **agent** takes actions in an **environment**, observes the resulting **state**, and receives a **reward** signal. For a program learning to play a game, the agent is the player, the environment is the game, the state is the board, an action is a move, and the reward is points won or lost. Nobody tells the agent the correct move. It learns a **policy**, a strategy for choosing actions, that maximizes the total reward it collects over time.

{% include figure.html id="ml-rl-loop" %}

Two things make reinforcement learning harder than supervised learning. Rewards can arrive long after the actions that earned them, as when a game is won or lost only at the end, so the agent has to work out which earlier moves deserve credit. And the agent has to balance exploiting moves it knows pay off against exploring moves that might pay off more.

### State Values and the Bellman Equation

To choose well, an agent needs to know how good each state is. A state's **value** is the total reward the agent can expect from that state onward if it acts well from there. A **discount factor**, written `γ` (gamma) and set between 0 and 1, makes a reward that arrives one step later worth less than the same reward now.

Consider a small grid where the agent moves one cell per step and receives +10 for reaching the goal and nothing for any other move. With `γ = 0.9`, a cell next to the goal is worth 10, a cell two steps away is worth 0.9 × 10 = 9, three steps away 0.9 × 9 = 8.1, and so on.

{% include figure.html id="ml-gridworld-values" %}

Every cell's value is the reward for its best move plus the discounted value of the cell that move leads to. The wall makes the top-left cells worth little even though they're close to the goal in a straight line, because the way around the wall is long. Once the values are known, the policy follows directly. The agent moves toward the neighbor with the highest value.

That recursive definition is the **Bellman equation**, from Richard Bellman's work on dynamic programming in the 1950s. The grid is deterministic, so each move has one outcome. Most environments are random, so the general form weighs every possible outcome of an action by its probability. The optimality form, as written in [Sutton and Barto's *Reinforcement Learning*](http://incompleteideas.net/book/the-book-2nd.html){:target="_blank" rel="noopener noreferrer"}, is:

```
V*(s) = max over actions a of  Σ  p(s', r | s, a) × [ r + γ · V*(s') ]
                              s',r
```

Here `V*(s)` is the best achievable value of state `s`, and `p(s', r | s, a)` is the probability of reaching state `s'` with reward `r` after taking action `a` in state `s`. The bracket is the grid calculation, reward plus discounted next value, and the sum averages it over every outcome the action could have. A related form defines Q-values, the value of taking a specific action in a state, which algorithms like Q-learning estimate directly.

**Deep reinforcement learning** uses neural networks to approximate these value functions or the policy itself, which matters when there are far too many states to list in a grid. DeepMind's AlphaGo combined networks trained partly through self-play reinforcement learning with tree search to beat top human Go players. Beyond games, reinforcement learning is applied to robotics control, resource allocation, and recommendation, and a variant that learns from human preference judgments is used to fine-tune large language models.

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

Holding out a separate validation set wastes data when data is scarce. **K-fold cross-validation** splits the non-test data into k parts, trains k times on k−1 of the parts, and validates on the remaining part each time, so every example is used for validation exactly once. The reported score is the average across folds, which is also more stable than a single validation split. The test set still stays held out for the final check.

{% include figure.html id="ml-data-splits" %}

Random splitting assumes examples are independent. For time series, validation data has to come after the training data in time, or the model gets to learn from the future.

### Data Leakage

**Data leakage** occurs, in [scikit-learn's words](https://scikit-learn.org/stable/common_pitfalls.html){:target="_blank" rel="noopener noreferrer"}, "when information that would not be available at prediction time is used when building the model." It produces evaluation scores that look excellent and a model that disappoints in production. It happens in a few recurring ways:

- **Preprocessing before splitting.** Fitting a scaler, feature selector, or imputer on the full dataset lets statistics from the test data shape the training data. Split first, fit preprocessing on the training set only, and apply the same fitted transform to the test set. Pipelines that bundle preprocessing with the model enforce this automatically.
- **Features that encode the answer.** A churn model that uses "account closure date" as a feature will look brilliant, because that field only exists for customers who already churned.
- **Duplicates across splits.** Near-identical records in both training and test sets let the model score well by recognition rather than generalization.

### Underfitting and Overfitting

A model can miss in two opposite directions, and the validation set is what tells them apart. The figure fits three models of increasing flexibility to the same training points, with held-out validation points drawn hollow.

{% include figure.html id="ml-fit-spectrum" %}

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

The two pull against each other, which is often described as the bias-variance trade-off. A simple model makes consistent but systematically wrong predictions (high bias), like the straight line that can never follow the curve. A very flexible model fits each training set closely but would change a lot if trained on a different sample (high variance), like the curve that bends to hit every point.

**Regularization** adds a penalty for complexity to the loss, so the model only grows large weights when they reduce the error enough to pay for themselves. L2 regularization (ridge) shrinks all weights toward zero, L1 (lasso) can drive some weights exactly to zero and so drops features, and elastic net combines the two. **Early stopping** ends training when the validation loss starts rising even as training loss keeps falling, which is the point where the model has started fitting noise in the training set.

### Choosing a Metric

The metric decides what "good" means, and the default one is often the wrong one. Classification metrics are easiest to see in a **confusion matrix**, which sorts every prediction by what the model said and what was actually true. Consider a fraud model scored on 1,000 transactions, 10 of which are fraudulent:

{% include figure.html id="ml-confusion-matrix" %}

Accuracy counts the whole diagonal as correct and looks excellent at 99.4%, but it hides the part that matters. A model that labels every transaction legitimate is 99% accurate and catches no fraud at all. Precision and recall each look at one edge of the matrix, and they trade against each other through the decision threshold. Lowering the score at which the model says "fraud" moves transactions out of the missed-fraud cell (higher recall) and into the false-alarm cell (lower precision), so picking the threshold is a business decision about which error costs more.

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

The last three are for regression. RMSE is the square root of the loss the house-price line was trained on, which puts it back in the units of the prediction, thousands of dollars rather than squared thousands.

---

## Explainability

### Black Boxes and Interpretable Models

Some models explain themselves. The house-price line's `w` says exactly how much each square meter adds, and a shallow decision tree like the one earlier can be read as a flowchart. Others, like large ensembles and deep neural networks, are **black boxes** that produce predictions without a readable account of why. The more expressive models tend to be the less interpretable ones, so a regulated decision such as a loan approval can favor a slightly less accurate model whose reasoning can be shown to an auditor or the person affected.

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
