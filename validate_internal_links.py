#!/usr/bin/env python3
"""
Validate internal links in Jekyll markdown files.

This script scans all markdown files and checks that internal links point to existing files.
It understands Jekyll's permalink structure for study guides and blog posts.
"""

import os
import re
from pathlib import Path
from typing import List, Tuple, Set

# Jekyll permalink patterns from _config.yml and front matter
STUDY_GUIDE_PERMALINK = "/study-guides/"
BLOG_PERMALINK_PREFIX = "/blog/"

def get_all_markdown_files(root_dir: str) -> List[Path]:
    """Get all markdown files in the repository."""
    root = Path(root_dir)
    markdown_files = []

    # Scan for .md files, excluding _site directory
    for pattern in ["**/*.md"]:
        for path in root.glob(pattern):
            if "_site" not in str(path):
                markdown_files.append(path)

    return markdown_files

def extract_internal_links(content: str, file_path: Path) -> List[Tuple[str, int]]:
    """
    Extract internal links from markdown content.
    Returns list of (link, line_number) tuples.

    Internal links include:
    - Relative paths: [text](../file.html)
    - Root-relative paths: [text](/study-guides/file.html)
    - Anchor-only links are excluded (they reference the same page)
    """
    links = []

    # Regex to match markdown links: [text](url)
    # Matches both inline links and reference-style links
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

    for line_num, line in enumerate(content.split('\n'), start=1):
        for match in link_pattern.finditer(line):
            url = match.group(2)

            # Skip external links (http://, https://, mailto:, etc.)
            if '://' in url or url.startswith('mailto:'):
                continue

            # Skip anchor-only links (same page references)
            if url.startswith('#'):
                continue

            # This is an internal link
            links.append((url, line_num))

    return links

def resolve_link_to_filesystem(link: str, current_file: Path, root_dir: Path) -> Path:
    """
    Resolve a link to its filesystem location.

    Handles:
    - Relative links (../file.html, file.html)
    - Root-relative links (/study-guides/path/file.html, /blog/yyyy/mm/dd/title.html)
    - Anchor fragments (#section, file.html#section)
    """
    # Remove anchor fragment if present
    if '#' in link:
        link = link.split('#')[0]

    # Remove query parameters if present
    if '?' in link:
        link = link.split('?')[0]

    # Skip empty links (anchor-only after stripping)
    if not link:
        return None

    # Handle root-relative links (start with /)
    if link.startswith('/'):
        # Study guide permalinks: /study-guides/:path.html
        if link.startswith(STUDY_GUIDE_PERMALINK):
            # Extract the path after /study-guides/
            guide_path = link[len(STUDY_GUIDE_PERMALINK):]

            # Remove .html extension and add .md
            if guide_path.endswith('.html'):
                guide_path = guide_path[:-5] + '.md'

            # Study guides are in _guides/ directory
            resolved = root_dir / '_guides' / guide_path
            return resolved

        # Blog permalinks: /blog/:year/:month/:day/:title.html
        if link.startswith(BLOG_PERMALINK_PREFIX):
            # Extract the path: /blog/2025/11/13/title.html -> 2025-11-13-title.md
            blog_path = link[len(BLOG_PERMALINK_PREFIX):]

            if blog_path.endswith('.html'):
                blog_path = blog_path[:-5]  # Remove .html

            # Convert /yyyy/mm/dd/title to yyyy-mm-dd-title
            parts = blog_path.split('/')
            if len(parts) >= 4:
                year, month, day, title = parts[0], parts[1], parts[2], '/'.join(parts[3:])
                post_filename = f"{year}-{month}-{day}-{title}.md"
                resolved = root_dir / '_posts' / post_filename
                return resolved

        # Other root-relative links (pages, assets, etc.)
        # Remove leading slash and resolve from root
        resolved = root_dir / link[1:]
        return resolved

    # Handle relative links (no leading slash)
    # Resolve relative to the current file's directory
    current_dir = current_file.parent
    resolved = (current_dir / link).resolve()

    # If link ends with .html, try replacing with .md
    if resolved.suffix == '.html':
        md_version = resolved.with_suffix('.md')
        if md_version.exists():
            return md_version

    return resolved

def validate_links(root_dir: str) -> List[Tuple[Path, str, int, str]]:
    """
    Validate all internal links in markdown files.

    Returns list of broken links as (file, link, line_number, reason) tuples.
    """
    root = Path(root_dir)
    broken_links = []

    markdown_files = get_all_markdown_files(root_dir)

    for md_file in markdown_files:
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Warning: Could not read {md_file}: {e}")
            continue

        links = extract_internal_links(content, md_file)

        for link, line_num in links:
            # Resolve the link to a filesystem path
            target = resolve_link_to_filesystem(link, md_file, root)

            if target is None:
                # Anchor-only link or empty after processing
                continue

            # Check if the target exists
            if not target.exists():
                # Try alternative: if .md doesn't exist, try .html
                if target.suffix == '.md':
                    html_version = target.with_suffix('.html')
                    if html_version.exists():
                        continue  # HTML version exists, link is fine

                reason = f"Target does not exist: {target}"
                broken_links.append((md_file, link, line_num, reason))

    return broken_links

def main():
    """Main entry point."""
    script_dir = Path(__file__).parent
    root_dir = script_dir

    print(f"Scanning for broken internal links in: {root_dir}\n")

    broken_links = validate_links(str(root_dir))

    if not broken_links:
        print("[OK] No broken internal links found!")
        return 0

    print(f"[ERROR] Found {len(broken_links)} broken internal link(s):\n")

    # Group by file for cleaner output
    by_file = {}
    for file, link, line_num, reason in broken_links:
        if file not in by_file:
            by_file[file] = []
        by_file[file].append((link, line_num, reason))

    for file, issues in sorted(by_file.items()):
        print(f"{file.relative_to(root_dir)}:")
        for link, line_num, reason in issues:
            print(f"  Line {line_num}: [{link}]")
            print(f"    -> {reason}")
        print()

    return 1

if __name__ == '__main__':
    exit(main())
