---
layout: post
title: "Coverage Measures What Ran, Not What Was Checked"
description: "Code coverage counts the lines a test suite executed, not whether any test would notice those lines being wrong, and once suite size is held constant its correlation with fault detection falls to low or moderate. Surviving mutants show the specific behavior no test checks, and a diff-based mutation run turns them into code review findings instead of another score to game."
tags: [testing, code-coverage, mutation-testing, test-quality, dotnet]
author: steven-stuart
sources:
  - title: "Schuler and Zeller: Assessing Oracle Quality with Checked Coverage (ICST 2011)"
    url: "https://www.st.cs.uni-saarland.de/publications/files/schuler-icst-2011.pdf"
  - title: "Niedermayr, Juergens, and Wagner: Will My Tests Tell Me If I Break This Code? (CSED 2016)"
    url: "https://arxiv.org/abs/1611.07163"
  - title: "Inozemtseva and Holmes: Coverage Is Not Strongly Correlated with Test Suite Effectiveness (ICSE 2014)"
    url: "https://www.cs.ubc.ca/~rtholmes/papers/icse_2014_inozemtseva.pdf"
  - title: "Kochhar, Thung, and Lo: Code Coverage and Test Suite Effectiveness: Empirical Study with Real Bugs in Large Systems (SANER 2015)"
    url: "https://doi.org/10.1109/SANER.2015.7081877"
  - title: "Stryker Mutator: Mutant States and Metrics"
    url: "https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/"
  - title: "Just et al.: Are Mutants a Valid Substitute for Real Faults in Software Testing? (FSE 2014)"
    url: "https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014.pdf"
  - title: "Papadakis, Shin, Yoo, and Bae: Are Mutation Scores Correlated with Real Fault Detection? (ICSE 2018)"
    url: "https://coinse.github.io/publications/pdfs/Papadakis2018hi.pdf"
  - title: "Petrović and Ivanković: State of Mutation Testing at Google (ICSE-SEIP 2018)"
    url: "https://research.google.com/pubs/archive/46584.pdf"
  - title: "Petrović, Ivanković, Fraser, and Just: Does Mutation Testing Improve Testing Practices? (ICSE 2021)"
    url: "https://arxiv.org/abs/2103.07189"
  - title: "Stryker.NET Configuration"
    url: "https://stryker-mutator.io/docs/stryker-net/configuration/"
  - title: "Testing Strategy & Architecture"
    url: "/study-guides/architecture/testing-strategy-architecture.html"
  - title: "Unit Testing in .NET"
    url: "/study-guides/dotnet/c-sharp/tooling/unit-testing-in-dotnet.html"
---

A suite reports 90% coverage. Delete every assertion in it and, for most tests written in the arrange, act, assert shape, the number barely moves. The act line runs the code, and the coverage tool records that it ran. It has no way to record whether anything checked the result.

I think most developers already suspect coverage is a weak target. Many pipelines gate on it anyway, and I'd guess that's because nobody has offered a number to put in its place. The research on this question is more than a decade old and more useful than its reputation. It says coverage mostly measures how big a suite is. It also says the obvious replacement, mutation score, shares that problem when it's read as a single number. What does work is using surviving mutants as findings. Each one points at a specific behavior no test checks, and they're now cheap enough to generate for every pull request.

## Coverage Counts Execution

A coverage tool instruments the code under test and records which lines, branches, or methods executed while the tests ran. It can't see the test's side of the exchange, so a test that calls a method and throws the result away earns the same credit as one that checks every field.

### A Line Runs Whether or Not Anything Checks It

Consider a small pricing rule and the test for it:

```csharp
public static decimal ApplyLoyaltyDiscount(decimal total, int loyaltyYears)
{
    if (loyaltyYears > 5)
        return total * 0.90m;

    return total;
}

[Fact]
public void Long_term_customer_gets_ten_percent_off()
{
    var result = Pricing.ApplyLoyaltyDiscount(100m, loyaltyYears: 6);

    Assert.Equal(90m, result);
}
```

Delete the `Assert.Equal` line and the coverage report is identical, because the call on the line above still runs the condition and the discounted return. Add a second test for a two-year customer, with or without its assertion, and the method reaches 100%.

David Schuler and Andreas Zeller measured this directly in "Assessing Oracle Quality with Checked Coverage" (ICST 2011). They removed a quarter, half, three quarters, and then all of the assertions from the test suites of seven open-source Java projects. Statement coverage was the least sensitive of the measures they tracked, and for AspectJ it didn't change at all, because none of that suite's assertions contained computation. Where coverage did fall, it was mostly because some assertions called the code under test themselves, as in `Assert.Equal(5, Max(5, 4))`. Their proposed fix was checked coverage, which counts only the statements whose results flow into an assertion. The title of this post is their distinction.

Rainer Niedermayr, Elmar Juergens, and Stefan Wagner tested the same gap from the code's side in "Will My Tests Tell Me If I Break This Code?" (2016). They took each covered method in 14 Java projects, replaced its body with an empty one or a default return value, and reran the tests. A method whose removal no test noticed was "pseudo-tested." It counted toward coverage while nothing checked it. Unit test suites averaged 11% pseudo-tested methods. System tests, which execute large parts of the application per test, averaged 35% and reached 72%. Their conclusion was that method coverage is a fair approximation for unit tests and not a valid indicator for system tests. That's the part a coverage gate hides, since one end-to-end test can light up hundreds of lines while checking a status code.

### Coverage Tracks Suite Size

Coverage does correlate with how many faults a suite catches. The question Laura Inozemtseva and Reid Holmes asked in "Coverage Is Not Strongly Correlated with Test Suite Effectiveness" (ICSE 2014) was why. A bigger suite runs more code and catches more faults, so coverage could be tracking fault detection or just tracking size.

They took five Java projects of up to 724,000 lines, including Apache POI, the Closure Compiler, and Joda Time, and built 31,000 test suites by randomly sampling each project's own tests at fixed sizes. They measured statement, decision, and modified condition coverage, and measured fault detection by how many mutants each suite killed. With size ignored, coverage correlated with fault detection moderately to highly in most projects. Holding size constant always lowered the correlation, usually to low or moderate. For Joda Time it fell from about 0.8 to roughly zero. The type of coverage made little difference, and the three kinds correlated with each other at 0.9 or more, so they were measuring the same thing.

The authors didn't conclude that coverage is useless. Low coverage points at code no test runs, and the paper says so. Their conclusion was that high coverage doesn't indicate an effective suite, and that "using a fixed coverage value as a quality target is unlikely to produce an effective test suite."

The study has limits. It measured fault detection with mutants rather than real bugs, and its suites were random samples rather than suites a team built on purpose. Pavneet Singh Kochhar, Ferdian Thung, and David Lo repeated the question with 159 real bugs from Apache HttpClient and Mozilla Rhino (SANER 2015) and found moderate to strong correlations. Their suites were generated by a random test generator, though, and they reported size and coverage separately rather than holding size fixed, so their result doesn't separate the two. The later studies I found don't show the strong size-independent correlation that would overturn the 2014 result.

### A Coverage Gate Pays for Execution

A gate rewards whatever raises the number most cheaply, and the cheapest way to raise coverage is a test that runs code without checking it. Inozemtseva and Holmes saw what that looks like in HSQLDB. Measured as mutants killed per line covered, HSQLDB's higher-coverage suites were worse, because the tests that added the most coverage ran a lot of code and checked little of it.

None of this needs bad faith. A developer under an 80% gate, looking at an uncovered error path, can write a test that reaches it and asserts nothing about what happens there, and every tool in the pipeline reports progress.

## Surviving Mutants Show What No Test Checks

Mutation testing asks the question coverage can't. A tool such as Stryker.NET makes one small change to the code, called a mutant, and reruns the tests that cover it. If a test fails, the mutant is killed. If every test passes, it survived, and the report shows the exact line and the exact change no test noticed.

### Each Survivor Is a Specific Hole

Run Stryker.NET against the pricing rule and its default mutators produce changes like these:

```csharp
if (loyaltyYears >= 5)      // equality mutator: > becomes >=
if (loyaltyYears < 5)       // equality mutator: > becomes <
return total / 0.90m;       // arithmetic mutator: * becomes /
```

The six-year test kills the second and third. It can't kill the first, because six years passes both `> 5` and `>= 5`. That survivor says nothing tests a customer with exactly five years, and a boundary is where a rule like this tends to break. With the assertions deleted, every mutant in the method survives and coverage still reads 100%.

Stryker's HTML report shows two scores. The mutation score divides detected mutants by all valid ones. The score on covered code divides detected mutants by the ones some test executed, which isolates the gap this post is about. It's the share of code the suite runs that the suite also checks.

Not every survivor is a hole. Some mutants are equivalent, meaning the change doesn't alter behavior, and no test could kill them. In Inozemtseva and Holmes's projects, mutants the full suite never killed ran from 0.4% to 35% of the total, and they had to assume those were equivalent. Reading a survivor takes judgment, and treating each one as a demand for a new test would waste time. Killed mutants aren't all the work of assertions either. In Schuler and Zeller's experiment, suites with every assertion removed still killed 43% of mutants on average, because a mutant that throws an exception fails the test without any check.

### Mutation Score Has a Size Problem Too

It's tempting to replace a coverage gate with a mutation score gate and stop there, but the evidence doesn't support it. René Just and colleagues, Inozemtseva and Holmes among them, checked whether mutants stand in for real faults in "Are Mutants a Valid Substitute for Real Faults in Software Testing?" (FSE 2014). Across 357 real faults in five programs, 73% were coupled to mutants, and mutant detection correlated with real fault detection more strongly than statement coverage did, even with coverage held constant.

Mike Papadakis, Donghwan Shin, Shin Yoo, and Doo-Hwan Bae then asked the size question of mutation score itself in "Are Mutation Scores Correlated with Real Fault Detection?" (ICSE 2018). Using real faults from the CoreBench and Defects4J datasets, they found that "all correlations between mutation scores and real fault detection are weak when controlling for test suite size." But the suites that ranked highest by mutation score found more real faults than random suites of the same size. For the top 10%, the average improvement in fault detection was 11% on Defects4J and 46% on CoreBench. Their conclusion was that mutants "provide good guidance for improving the fault detection of test suites," while the score is a poor measure of effectiveness.

This also qualifies the 2014 coverage result, which used mutants killed as its measure of fault detection. What holds across both studies is that neither number, read on its own at a fixed suite size, predicts real fault detection well. What mutation adds is a pointer to the specific behavior that isn't checked.

That's the reason to use survivors and not the score. A number invites the same gaming a coverage gate does. A survivor on a line in your pull request is a concrete question about one behavior, and answering it produces a test that checks something.

### Google Found the Bugs Coverage Had Already Passed

Goran Petrović and Marko Ivanković described Google's approach in "State of Mutation Testing at Google" (ICSE-SEIP 2018). Mutating a two-billion-line repository wasn't feasible, so the system mutated only the lines a change touched, only lines that tests already covered, and at most one mutant per line. It also skipped lines it classed as uninteresting, like logging calls, based on developer feedback. Survivors appeared as comments in code review, and developers could mark each one "Please fix" or "Not useful." Suppressing the kinds of mutants developers rejected raised the share marked useful from 20% to 80% over time, and across the whole study 75% of the findings that got feedback were marked useful.

A follow-up with Gordon Fraser and René Just, "Does Mutation Testing Improve Testing Practices?" (ICSE 2021), looked at almost 15 million mutants. The more mutants developers had been shown, the more tests they wrote, and the less likely later mutants in the same files were to survive. The coverage of the changed code stayed roughly flat, which suggests they were writing tests to kill mutants, not to raise coverage. Then the authors took 1,502 high-priority bugs and replayed the change that introduced each one. For 70% of them, mutation testing would have reported a live mutant coupled to the bug on that change. Every one of those changes was already covered by tests, so coverage had nothing left to say about them.

## Run Mutants on the Diff and Review the Survivors

Mutating a whole solution is slow, because each mutant means rerunning the tests that cover it. Scoping it to the change makes it cheap. Stryker.NET installs as a .NET tool and runs from the test project's directory:

```bash
dotnet tool install -g dotnet-stryker
dotnet stryker --since:main
```

`--since` uses git to mutate only code changed since the target branch, and by default Stryker runs only the tests that cover each mutant. A pull request that touches three files produces a report about those three files. The `ignore-methods` option excludes calls such as logging, which play the same role as Google's uninteresting lines.

Stryker also has a `break` threshold that fails the build below a given mutation score. It defaults to 0, and the evidence above suggests leaving it there. Put the survivors in front of the reviewer, the way Google does, and let the reviewer decide which ones deserve a test. Keep coverage for the job the research says it does well, which is showing code no test runs at all. The Testing Strategy & Architecture and Unit Testing in .NET guides cover where mutation runs fit in a pipeline and how coverage is collected under each .NET test platform.

## Checking Your Own Suite

For one well-covered module this week:

- Run `dotnet stryker` from its test project, or `dotnet stryker --since:main` on a branch with changes still open
- Count the surviving mutants, and compare the score on covered code with the module's line coverage
- Read five survivors, and for each one, name the behavior no test checks or mark it equivalent
- Look for tests that call code and assert nothing, or assert only that no exception was thrown
- Pick the most important unchecked behavior and write the test that kills its mutant

If the covered-code score comes out well below the coverage number, the gap between them is code your suite runs without checking. The coverage report counted all of it as tested.
