---
layout: page
title: Case Studies
description: "Real-world architecture challenges, solutions, and results from production systems"
permalink: /case-studies.html
---

<div class="case-studies-hero">
  <p class="hero-tagline">Real systems. Real decisions. Real outcomes.</p>
  <p class="hero-description">Deep dives into production architecture: the problems faced, decisions made, tradeoffs accepted, and lessons learned. Some succeeded. Some failed. All taught something worth sharing.</p>
</div>

{% assign featured_studies = site.case_studies | where: "featured", true | sort: 'date' | reverse %}
{% assign all_studies = site.case_studies | sort: 'date' | reverse %}

{% if featured_studies.size > 0 %}
<section class="category-section">
  <h2 class="section-heading">Featured</h2>
  <div class="case-studies-grid">
  {% for case_study in featured_studies %}
    <article class="case-study-card {% if case_study.category %}category-{{ case_study.category }}{% endif %}">
      <a href="{{ case_study.url | relative_url }}" class="case-study-link">
        <div class="card-header">
          {% if case_study.category_label %}
          <span class="category-badge category-{{ case_study.category }}">{{ case_study.category_label }}</span>
          {% endif %}
          <span class="case-study-date">{{ case_study.date | date: "%Y" }}</span>
        </div>
        <h3 class="card-title">{{ case_study.title }}</h3>
        {% if case_study.subtitle %}
        <p class="card-subtitle">{{ case_study.subtitle }}</p>
        {% endif %}
        {% if case_study.headline_metric %}
        <div class="headline-metric">
          <span class="metric-value">{{ case_study.headline_metric }}</span>
          {% if case_study.headline_detail %}
          <span class="metric-detail"> · {{ case_study.headline_detail }}</span>
          {% endif %}
        </div>
        {% endif %}
        {% if case_study.technologies %}
        <div class="tech-pills">
          {% for tech in case_study.technologies limit:4 %}
          <span class="tech-pill">{{ tech }}</span>
          {% endfor %}
          {% if case_study.technologies.size > 4 %}
          <span class="tech-pill tech-more">+{{ case_study.technologies.size | minus: 4 }}</span>
          {% endif %}
        </div>
        {% endif %}
        <span class="read-more">Read case study <span class="arrow">→</span></span>
      </a>
    </article>
  {% endfor %}
  </div>
</section>
{% endif %}

{% assign category_order = "success,failure,design" | split: "," %}
{% assign category_labels = "Optimization & Migration Wins,Failure Analysis,Architecture & Design" | split: "," %}

{% for cat in category_order %}
  {% assign cat_studies = all_studies | where: "category", cat %}
  {% if cat_studies.size > 0 %}
  <section class="category-section">
    <h2 class="section-heading">{{ category_labels[forloop.index0] }}</h2>
    <div class="case-studies-grid">
    {% for case_study in cat_studies %}
      <article class="case-study-card {% if case_study.category %}category-{{ case_study.category }}{% endif %}">
        <a href="{{ case_study.url | relative_url }}" class="case-study-link">
          <div class="card-header">
            {% if case_study.category_label %}
            <span class="category-badge category-{{ case_study.category }}">{{ case_study.category_label }}</span>
            {% endif %}
            <span class="case-study-date">{{ case_study.date | date: "%Y" }}</span>
          </div>
          <h3 class="card-title">{{ case_study.title }}</h3>
          {% if case_study.subtitle %}
          <p class="card-subtitle">{{ case_study.subtitle }}</p>
          {% endif %}
          {% if case_study.headline_metric %}
          <div class="headline-metric">
            <span class="metric-value">{{ case_study.headline_metric }}</span>
            {% if case_study.headline_detail %}
            <span class="metric-detail"> · {{ case_study.headline_detail }}</span>
            {% endif %}
          </div>
          {% endif %}
          {% if case_study.technologies %}
          <div class="tech-pills">
            {% for tech in case_study.technologies limit:4 %}
            <span class="tech-pill">{{ tech }}</span>
            {% endfor %}
            {% if case_study.technologies.size > 4 %}
            <span class="tech-pill tech-more">+{{ case_study.technologies.size | minus: 4 }}</span>
            {% endif %}
          </div>
          {% endif %}
          <span class="read-more">Read case study <span class="arrow">→</span></span>
        </a>
      </article>
    {% endfor %}
    </div>
  </section>
  {% endif %}
{% endfor %}

