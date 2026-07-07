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

<div class="guides-search-sticky">
    <div class="guides-search-wrapper">
        <svg class="guides-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="search" id="searchInput" class="guides-search-input"
               placeholder="Search by title or subtitle — press Enter to add as filter"
               autocomplete="off" spellcheck="false">
    </div>
</div>

<div id="activeFiltersBar" class="active-filters-bar" style="display:none">
    <div class="active-filter-chips" id="activeFilterChips"></div>
    <button id="clearAllFilters" class="clear-all-link" type="button">Clear all</button>
</div>

{% assign category_order = "success,failure,design" | split: "," %}
{% assign category_labels = "Optimization & Migration Wins,Failure Analysis,Architecture & Design" | split: "," %}

{% assign case_study_authors = "" | split: "" %}
{% for case_study in site.case_studies %}
    {% if case_study.author %}
        {% unless case_study_authors contains case_study.author %}
            {% assign case_study_authors = case_study_authors | push: case_study.author %}
        {% endunless %}
    {% endif %}
{% endfor %}
{% assign case_study_authors = case_study_authors | sort %}

<div class="resource-category-filters" id="caseStudyCategoryFilters">
    <button class="resource-category-pill" data-category="" type="button">All Categories</button>
    {% for cat in category_order %}
    <button class="resource-category-pill" data-category="{{ cat }}" type="button">{{ category_labels[forloop.index0] }}</button>
    {% endfor %}
</div>

{% if case_study_authors.size > 1 %}
<div class="author-filters" id="authorFilters">
    <button class="author-pill" data-author="" type="button">All Authors</button>
    {% for author_key in case_study_authors %}
    {% assign author_data = site.data.authors[author_key] %}
    <button class="author-pill" data-author="{{ author_key }}" type="button">{{ author_data.name | default: author_key }}</button>
    {% endfor %}
</div>
{% endif %}

<div class="guides-result-bar">
    <span id="resultCount" class="result-count"></span>
</div>

{% assign featured_studies = site.case_studies | where: "featured", true | sort: 'date' | reverse %}
{% assign all_studies = site.case_studies | sort: 'date' | reverse %}

{% if featured_studies.size > 0 %}
<section class="category-section" data-section="featured">
  <h2 class="section-heading">Featured</h2>
  <div class="case-studies-grid">
  {% for case_study in featured_studies %}
    <article class="case-study-card filterable-item {% if case_study.category %}category-{{ case_study.category }}{% endif %}"
             data-title="{{ case_study.title | downcase }}"
             data-description="{{ case_study.subtitle | downcase }}"
             data-category="{{ case_study.category }}"
             data-author="{{ case_study.author }}">
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

{% for cat in category_order %}
  {% assign cat_studies = all_studies | where: "category", cat %}
  {% if cat_studies.size > 0 %}
  <section class="category-section" data-section="{{ cat }}">
    <h2 class="section-heading">{{ category_labels[forloop.index0] }}</h2>
    <div class="case-studies-grid">
    {% for case_study in cat_studies %}
      <article class="case-study-card filterable-item {% if case_study.category %}category-{{ case_study.category }}{% endif %}"
               data-title="{{ case_study.title | downcase }}"
               data-description="{{ case_study.subtitle | downcase }}"
               data-category="{{ case_study.category }}"
               data-author="{{ case_study.author }}">
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

<div id="noResults" class="no-results" style="display: none;">
    <p>No case studies match your filters.</p>
    <button id="clearNoResults" class="clear-filters-btn" type="button">Clear filters</button>
</div>

<script src="{{ '/assets/js/case-studies-browser.js' | relative_url }}"></script>
