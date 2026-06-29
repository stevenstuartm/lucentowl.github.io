# Lucent Owl

A dev-focused tech publishing platform at [lucentowl.com](https://lucentowl.com), covering software architecture, system design, and engineering practice. Quality over noise.

## What's Here

- **Articles**: In-depth posts on architecture, distributed systems, DDD, cloud, .NET, and engineering leadership
- **Case Studies**: Real project deep-dives — architectural decisions, trade-offs, and lessons
- **Study Guides**: Comprehensive references across Architecture, Security, AI/ML, DSA, SDLC, and more
- **Tech Radar**: Interactive visualization of technology assessments and recommendations

## Local Development

### Prerequisites

- Ruby (2.7 or higher)
- Bundler gem

### Setup

```bash
git clone https://github.com/stevenstuartm/lucentowl.github.io.git
cd lucentowl.github.io
bundle install
bundle exec jekyll serve
```

Open `http://localhost:4000`.

### Build

```bash
bundle exec jekyll build
```

Output goes to `_site/`.

## Project Structure

```
.
├── _config.yml           # Site configuration
├── _data/                # Structured data (authors.yml)
├── _layouts/             # Page templates
├── _includes/            # Reusable HTML components
├── _posts/               # Articles (YYYY-MM-DD-title.md)
├── _case_studies/        # Case study posts
├── _guides/              # Study guides organized by category
├── pages/                # Site pages (blog, about, study-guides, tech-radar, authors/)
├── assets/
│   ├── css/              # Stylesheets (SCSS)
│   ├── js/               # JavaScript (D3.js, radar visualization)
│   ├── data/             # JSON data files (radar-data, study guides config)
│   └── img/              # Image assets
└── index.md              # Homepage
```

## Technology Stack

- **Framework**: Jekyll (static site generator)
- **Hosting**: GitHub Pages
- **Frontend**: Custom CSS (Luna Owl palette) with D3.js for tech radar
- **Content**: Markdown with YAML front matter

## Deployment

Automatically deployed to GitHub Pages on push to `main`.

**Live site**: [https://lucentowl.com](https://lucentowl.com)

## License

Content © Lucent Owl. All rights reserved.
Code licensed under MIT.
