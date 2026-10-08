---
layout: post
title: "Learning Platforms Sell Badges, Not Skills"
date: 2025-08-27
tags: [learning, career, productivity, software-engineering]
description: "Once you know a topic's basics, building real projects teaches more than passive learning platforms. Real capability comes from doing, failing, and fixing, not collecting completion checkmarks."
author: steven-stuart
sources:
  - title: "Codecademy, \"Keep the Streak Alive\" (2012)"
    url: "https://www.codecademy.com/resources/blog/?p=5065"
  - title: "Codecademy Help Center, \"Codecademy Certificates\""
    url: "https://help.codecademy.com/hc/en-us/articles/12943864221851-Codecademy-Certificates"
  - title: "Deslauriers et al., \"Measuring actual learning versus feeling of learning in response to being actively engaged in the classroom\" (PNAS, 2019)"
    url: "https://pubmed.ncbi.nlm.nih.gov/31484770/"
  - title: "Anthropic, \"How AI assistance impacts the formation of coding skills\" (2026)"
    url: "https://www.anthropic.com/research/AI-assistance-coding-skills"
  - title: "Kirschner, Sweller, and Clark, \"Why Minimal Guidance During Instruction Does Not Work\" (Educational Psychologist, 2006)"
    url: "https://caseresources.hsph.harvard.edu/resource/why-minimal-guidance-during-instruction-does-not-work"
  - title: "Kalyuga, Ayres, Chandler, and Sweller, \"The Expertise Reversal Effect\" (Educational Psychologist, 2003)"
    url: "https://ro.uow.edu.au/edupapers/136"
  - title: "The Rust Programming Language (the Rust book)"
    url: "https://doc.rust-lang.org/book/"
  - title: "Kubernetes Documentation, \"Tutorials\""
    url: "https://kubernetes.io/docs/tutorials/"
---

I cancelled all my learning platform subscriptions a while back, and I haven't looked back. Not because those platforms are worthless, but because I realized they were optimizing for the wrong outcome. They sell completion badges and the feeling of progress, and neither one is actual capability.

<blockquote class="pull-quote">
<p>Real learning happens when you're forced to set up your own environment, debug obscure errors, and ship something that people might actually use.</p>
</blockquote>

That green checkmark feels good, but it doesn't mean you can build something without the training wheels. Passive consumption creates the illusion of progress while keeping you dependent on structured guidance.

## Platforms Remove the Struggle That Builds Skill

Interactive platforms like Codecademy add some local-setup lessons and portfolio projects, but they're built around in-browser lessons, sanitized playgrounds where everything just works. No dependency conflicts, no environment setup, no deployment challenges. You follow the prompts, run the tests, and get that satisfying checkmark. But when you leave the playground and try to build something on your own, you realize you don't know how to start. Real development doesn't have guard rails.

Video platforms like Udemy and Pluralsight have a different problem. Watching someone else code, without then writing it yourself, doesn't teach you to code, just like watching diving competitions doesn't teach you to swim. You might understand the concepts intellectually, but understanding isn't the same as being able to do.

The deeper issue is what these platforms can measure. Capability shows up in messy, non-linear work outside the product, and completion is what a platform can count, so the rewards it surfaces measure finishing. Codecademy counts your streak of consecutive days and awards badges and, for paying members, certificates of completion. When Codecademy introduced the streak in its 2012 post "Keep the Streak Alive," a day counted if you completed at least one exercise, so the reward asks for the smallest unit of finishing, and an easy lesson keeps it alive as well as a hard project does. None of those tells you whether you could build the thing without the scaffolding. Hands-on labs and skill assessments get closer, but they grade you on tasks someone else scoped, with an answer already known, while building starts with deciding what the task is.

Feeling productive and becoming capable are different things. A 2019 study of Harvard introductory physics students by Louis Deslauriers and colleagues measured that gap directly. Students taught by polished lectures felt they had learned more than students taught through active problem-solving, yet the active group scored higher on the tests. The study compared live classes, not platforms, but the mechanism carries over. A video course feels fluent for the same reason a polished lecture does, because someone else is doing the hard part. In-browser exercises are active, which the study favors, but they still hand you the setup and the decisions, so the effort they ask for is narrower than the work. You can use a platform actively by coding along and then extending the project on your own, but the streak, the badge, and the certificate pay out the same for the fluent version.

## What Builds Capability Instead

**Build real projects, even terrible ones.** That broken todo app you're embarrassed about taught you things about state management, debugging, and problem-solving that a polished tutorial couldn't, because the tutorial had already made those decisions for you. You learn when you're forced to make decisions without a script, when you get stuck and have to figure out why, and when you realize your solution doesn't scale and you need to rethink it. A project only teaches when something tells you what's wrong, so put it in front of real users, a reviewer, or working code to compare against.

**Read official documentation.** Framework creators update their docs as the tools change, which a third-party course can't promise. React's and Vue's official guides teach the way a course does, and they're free. Reference-heavy docs like AWS's tell you what each service does but not how to combine them, which is where the next habit comes in.

**Browse production codebases on GitHub.** Thousands of examples, starter templates, and production codebases are available for free. Quality varies, but learning to evaluate code quality is itself a critical skill. You see how people structure projects, handle edge cases, and make tradeoffs. You also see mistakes, which teaches you what to avoid, and comparing your own project against working code is how you catch the bad habits a solo project can teach.

**Use AI to understand why you're stuck, not to get unstuck for you.** Instead of scrolling through forum posts from 2019 hoping someone had your exact problem, you can ask an assistant to explain the error in minutes. AI works as a rubber duck that talks back, but only if you keep doing the thinking. In a 2026 Anthropic trial, developers learning a new Python library with AI help scored 17 points lower on a follow-up quiz than those who coded by hand, with the widest gap on debugging. Within the AI group, the small, self-selected sets of users who scored well asked for explanations and conceptual answers. The ones who handed the problem over learned the least. That's the same default-path problem platforms have, since the trial's average AI user lost ground. The difference is where the assistant sits. It works inside your own project, so setting up the environment and deciding what to build stay yours, and asking for the explanation instead of the fix keeps the debugging struggle yours too.

## Capability Comes From Failing and Fixing

Real learning is breaking things and fixing them. It's reading error messages until they make sense instead of just copying solutions. It's shipping something people actually use and iterating based on real feedback. It's copying code you don't fully understand, then digging in until you do.

<blockquote class="pull-quote">
<p>The pattern is simple: do something, fail at it, learn why you failed, improve, and repeat. No platform can give it to you because it requires struggle.</p>
</blockquote>

Structure does help at the very start. Paul Kirschner, John Sweller, and Richard Clark reviewed the research on guided versus minimally guided instruction and found that novices learn more with strong guidance, while that advantage fades once learners know enough to guide themselves. That's the place learning platforms have, for discovering new topics or getting a structured overview. Slava Kalyuga, John Sweller, and colleagues documented the other side as the expertise reversal effect. For learners who already know a topic's basics, guidance that helped novices becomes redundant and can lower performance. The classroom study above showed that active work beats passive work, and this is the research case for taking the scaffolding away once you're past the start.

Being a novice is specific to the topic, so a senior developer picking up Rust or Kubernetes is a novice again. But that guided start is now often free and official, in the Rust book, the Kubernetes tutorials, or React's and Vue's guides, and it ends where the creators think you can go on alone. What a subscription adds is a default path that keeps going. Career paths and skill tracks chain many guided courses on the same skill, so the scaffolding continues after you know the basics, and the checkmarks keep coming either way. The objection isn't to guided content, which earns its place at the start, but to guidance with no end built in. Cancelling the subscription doesn't mean never taking a course. For a topic with no good free start, such as distributed systems or cloud architecture, a single book or course bought for that topic ends when you finish it. A subscription has the next course queued and a streak to protect, so stopping is a decision you make against the product's defaults, again each time a course ends. Cancelling is how you make it once.

The stopping rule is whether you could build the course's project without the course. Once you could, the guidance has stopped teaching you, and what's left to learn is how to work without it. If you want to actually get better, cancel the subscriptions and start shipping.
