#!/usr/bin/env python3
"""
Content linter for blog posts and study guides.
Checks for violations of writing standards defined in CLAUDE.md.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple


class ContentViolation:
    def __init__(self, line_num: int, rule: str, text: str, suggestion: str = "", is_style=False):
        self.line_num = line_num
        self.rule = rule
        self.text = text
        self.suggestion = suggestion
        self.is_style = is_style

    def __str__(self):
        result = f"Line {self.line_num}: {self.rule}\n  \"{self.text}\""
        if self.suggestion:
            result += f"\n  → {self.suggestion}"
        return result


class ContentLinter:
    def __init__(self):
        self.violations: List[ContentViolation] = []

        # AI-tell phrases to avoid
        self.ai_tell_phrases = [
            r"\bthe key insight\b",
            r"\bthe insight\b(?! into)",  # "the insight" but not "the insight into"
            r"\bthe takeaway\b",
            r"\bit'?s important to note\b",
            r"\bit'?s worth noting\b",
            r"\bit should be noted\b",
            r"\bin conclusion\b",
            r"\bin summary\b",
            r"\bfinal version\b",
            r"\bfinal conclusion\b",
            r"\bultimately\b",
            r"\bessentially\b",
            r"\bfundamentally\b",
            r"\bat the end of the day\b",
            r"\bthe bottom line is\b",
            r"\b(is|are|was|were)\s+real\b(?!-)",  # predicate "X is/are real" — filler; state specifically what that means
            r"\b\w+\s+real\s+(?:output|work|value|results?|impact|progress|problems?|issues?|cost|benefit|change|difference|data|code|tests?|features?|improvements?|gains?|savings?|performance|quality|effort|time|speed|scale)\b",
            r"\bsomething (?:real|genuine|tangible|meaningful)\b",  # vague qualifier; state what it actually is
            r"\bthe \w[\w -]* is understandable\b",
            r"\bthe question isn'?t\b",
            r"\bthe question is\b",
            r"\bworth\s+\w+ing\b",  # "worth noting/examining/sitting/stating/naming/investigating" — often meta-commentary; state the point directly
            r"\bis reasonable\b",  # vague filler; state specifically what makes it reasonable
            r"\bdistinction matters\b",  # announcement rather than stating the distinction directly
            r"\bfailure modes?\b",  # AI tell; describe the specific failure instead
        ]

        # AI-tell colon constructions
        self.ai_tell_colons = [
            r"What's converging:",
            r"A critical distinction:",
            r"The difference:",
            r"The key:",
            r"The point:",
            r"Here's why:",
        ]

        # Choppy opening patterns (noun-heavy without articles)
        self.choppy_openings = [
            (r"^Lack of [a-z]+ creates", "When X doesn't exist, it creates..."),
            (r"^Absence of [a-z]+ leads", "When X is absent, it leads to..."),
            (r"^Presence of [a-z]+ indicates", "When X is present, it indicates..."),
        ]

        # Missing article patterns (common cases)
        self.missing_article_patterns = [
            (r"\bmasquerading as process\b", "masquerading as a process"),
            (r"\breconsolidate agreement\b", "reconsolidate the agreement"),
        ]

        # Lazy parenthetical patterns (using parentheses as definition shortcut)
        # Pattern: noun/phrase followed immediately by opening paren with definition/explanation
        # Example: "The cure for spam (algorithmic gatekeeping) became worse"
        # Good parentheticals flow with narrative: "the way people think (or think out loud)"
        self.lazy_parentheticals = [
            # Pattern: Complete noun phrase followed by (definition/explanation) mid-sentence
            # Looks for: word(s) followed by ( with 3+ words inside ) continuing with verb
            r'\b([A-Z][a-z]+(?:\s+[a-z]+){0,3})\s+\(([a-z][^)]{15,})\)\s+(became|created|locked|is|was|are|were|become|becomes)',
        ]

    def lint_file(self, filepath: Path) -> List[ContentViolation]:
        """Lint a markdown file and return list of violations."""
        self.violations = []

        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        self._lint_lines(lines)
        return self.violations

    def lint_text(self, text: str) -> List[ContentViolation]:
        """Lint raw text and return list of violations."""
        self.violations = []
        lines = text.splitlines(keepends=True)
        self._lint_lines(lines)
        return self.violations

    def _lint_lines(self, lines: List[str]):
        """Internal method to lint a list of lines."""
        in_frontmatter = False
        frontmatter_ended = False
        in_code_block = False

        # Track consecutive short sentences for choppy flow detection
        short_sentence_buffer = []

        for line_num, line in enumerate(lines, start=1):
            # Skip YAML frontmatter (only at start of file)
            if line.strip() == '---':
                if line_num == 1:
                    # First line with --- starts frontmatter
                    in_frontmatter = True
                    continue
                elif in_frontmatter and not frontmatter_ended:
                    # Second --- ends frontmatter
                    in_frontmatter = False
                    frontmatter_ended = True
                    continue
                # Any other --- is just content (horizontal rule)

            if in_frontmatter:
                continue

            # Skip code blocks
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                continue

            # Skip bullet points and headers for some checks
            # Bullet points start with "- " or "* " (with space), not just "-" or "*"
            stripped = line.strip()
            is_bullet = (stripped.startswith('- ') or
                        stripped.startswith('* ') or
                        (len(stripped) >= 2 and stripped[0] in '-*' and stripped[1] in ' \t'))
            is_header = stripped.startswith('#')

            # Check for AI-tell phrases
            self._check_ai_tell_phrases(line_num, line)

            # Check for AI-tell colon constructions
            self._check_ai_tell_colons(line_num, line)

            # Check for em-dashes in sentences (not in headers; bullets are checked
            # because the em-dash character is distinct from the bullet hyphen)
            if not is_header:
                self._check_em_dashes(line_num, line)

            # Check for missing articles
            self._check_missing_articles(line_num, line)

            # Check for run-on sentences
            if not is_bullet and not is_header:
                self._check_run_on_sentences(line_num, line)

            # Check for choppy sentence patterns
            if not is_bullet and not is_header:
                self._check_choppy_sentences(line_num, line)

            # Check for narrative flow issues (Phase 1 detectors)
            if not is_bullet and not is_header:
                self._check_consecutive_short_sentences(line_num, line, short_sentence_buffer)
                self._check_missing_conjunctions(line_num, line)
                self._check_sequential_examples(line_num, line)
                self._check_colon_list_constructions(line_num, line)
                self._check_choppy_openings(line_num, line)
                self._check_semicolon_quote_pattern(line_num, line)
                self._check_command_style_paragraphs(line_num, line)
                self._check_lazy_parentheticals(line_num, line)

            # Check for missing link attributes on external links
            self._check_external_link_attributes(line_num, line)

    def _check_ai_tell_phrases(self, line_num: int, line: str):
        """Check for AI-tell phrases."""
        for phrase_pattern in self.ai_tell_phrases:
            if re.search(phrase_pattern, line, re.IGNORECASE):
                match = re.search(phrase_pattern, line, re.IGNORECASE)
                self.violations.append(ContentViolation(
                    line_num,
                    "AI-tell phrase detected",
                    line.strip(),
                    f"Remove '{match.group()}' and state directly"
                ))

    def _check_ai_tell_colons(self, line_num: int, line: str):
        """Check for AI-tell colon constructions."""
        for pattern in self.ai_tell_colons:
            if re.search(pattern, line, re.IGNORECASE):
                self.violations.append(ContentViolation(
                    line_num,
                    "AI-tell colon construction",
                    line.strip(),
                    "State the point directly without meta-commentary"
                ))

    def _check_em_dashes(self, line_num: int, line: str):
        """Check for em-dashes and hyphen-dash substitutes in prose sentences."""
        # Check for actual em-dash character
        if '—' in line:
            self.violations.append(ContentViolation(
                line_num,
                "Em-dash in sentence",
                line.strip(),
                "Use semicolon, comma, or period instead"
            ))

        # Check for hyphen used as em-dash substitute
        # Pattern: word/punctuation followed by space-hyphen-space followed by word
        # Exclude cases where it's clearly not a dash substitute:
        # - List items starting with "- "
        # - Markdown links with " - " as separator
        # - Short phrases like "a - b" comparisons
        if not line.strip().startswith('-'):  # Not a bullet point
            # Look for space-hyphen-space pattern with substantial text on both sides
            # Pattern allows for markdown formatting (**, *, `, etc.) before/after the hyphen
            # Must have at least 15 chars of context before the hyphen
            context_pattern = r'.{15,}\s+-\s+\w'
            if re.search(context_pattern, line):
                self.violations.append(ContentViolation(
                    line_num,
                    "Hyphen used as em-dash substitute",
                    line.strip(),
                    "Use semicolon, comma, or period instead of ' - '"
                ))

    def _check_missing_articles(self, line_num: int, line: str):
        """Check for common missing article patterns."""
        for pattern, suggestion in self.missing_article_patterns:
            if re.search(pattern, line, re.IGNORECASE):
                self.violations.append(ContentViolation(
                    line_num,
                    "Missing article",
                    line.strip(),
                    f"Consider: '{suggestion}'"
                ))

    def _check_run_on_sentences(self, line_num: int, line: str):
        """Check for potential run-on sentences."""
        # Skip short lines
        if len(line.strip()) < 100:
            return

        # Split line into sentences (by periods followed by space and capital letter)
        # This handles cases where multiple sentences are on one line
        sentences = re.split(r'\.\s+(?=[A-Z])', line.strip())

        # Check each sentence individually
        for sentence in sentences:
            # Skip short sentences
            if len(sentence) < 100:
                continue

            # Count semicolons and commas in THIS sentence
            semicolons = sentence.count(';')
            commas = sentence.count(',')

            # Flag if sentence has 2+ semicolons - this is almost always too complex
            if semicolons >= 2:
                self.violations.append(ContentViolation(
                    line_num,
                    "Possible run-on sentence (multiple semicolons)",
                    sentence[:80] + "...",
                    "Consider breaking into separate sentences"
                ))
            elif semicolons >= 1 and commas >= 3:
                # Check if it's excessively long with multiple clauses
                if len(sentence) > 150:
                    # Check if this is a parallel structure (do X, do Y, and do Z)
                    # Parallel structures use commas to list similar items and are easy to parse
                    # Pattern: "verb X, verb Y, and verb Z" or "does X, adds Y, and doesn't Z"

                    # Look for parallel verb patterns after each comma
                    parts = sentence.split(',')
                    if len(parts) >= 3:
                        # Check if parts follow parallel structure (similar grammatical form)
                        # Simple heuristic: if most comma-separated parts start with similar patterns,
                        # it's likely a parallel list rather than nested clauses
                        starts_similar = self._check_parallel_structure(parts)

                        # If it's parallel structure, it's easier to parse - don't flag it
                        if starts_similar:
                            continue

                    self.violations.append(ContentViolation(
                        line_num,
                        "Possible run-on sentence (length + complexity)",
                        sentence[:80] + "...",
                        "Reader may need to buffer too much context; consider breaking up"
                    ))

    def _check_parallel_structure(self, parts: list) -> bool:
        """Check if comma-separated parts follow parallel grammatical structure."""
        if len(parts) < 3:
            return False

        # Extract the words after common conjunctions and leading spaces
        # Look for patterns like: "creates X, adds Y, and doesn't Z"
        cleaned_parts = []
        for part in parts:
            # Remove leading/trailing whitespace
            cleaned = part.strip()
            # Remove leading conjunctions (as whole words, not character stripping)
            for conj in ['and ', 'or ', 'but ']:
                if cleaned.startswith(conj):
                    cleaned = cleaned[len(conj):]
                    break
            if cleaned:
                cleaned_parts.append(cleaned)

        if len(cleaned_parts) < 3:
            return False

        # Check if parts start with similar grammatical forms
        # Common parallel patterns:
        # - All start with verbs: "creates X, adds Y, doesn't Z"
        # - All start with nouns/adjectives: "chatty traffic, complex behavior, unsolved issues"

        # Get first 1-2 words from each part
        first_words = []
        for part in cleaned_parts[:4]:  # Check first 4 parts
            words = part.split()
            if words:
                first_words.append(words[0].lower())

        # Simple heuristic: if 2+ parts share similar verb forms or start patterns,
        # it's likely parallel structure
        if len(first_words) >= 3:
            # Check for repeated first words (e.g., "creates", "adds", "doesn't")
            first_word_counts = {}
            for fw in first_words:
                first_word_counts[fw] = first_word_counts.get(fw, 0) + 1

            # If any first word appears 2+ times, it's parallel
            if any(count >= 2 for count in first_word_counts.values()):
                return True

            # Also check for verb patterns (ends with 's' indicating present tense verbs)
            # Pattern: "creates", "adds", "doesn't" all have similar verb form
            verb_like = [fw for fw in first_words if len(fw) > 2 and fw.endswith('s')]
            if len(verb_like) >= 2:
                return True

        return False

    def _check_choppy_sentences(self, line_num: int, line: str):
        """Check for choppy sentence patterns."""
        # Pattern: Telegraphic parallel structures (check first - more specific)
        # "X says Y. The other says Z." or "X does Y. Another does Z."
        parallel_patterns = [
            # Question followed by parallel structure (most specific)
            (r'[A-Z][^.?]{10,40}\?\s+One side [^.]{10,50}\.\s+The other [^.]{10,50}\.',
             "Combine parallel thoughts with conjunctions: 'One side says X and the other says Y'"),
            # One side... The other...
            (r'One side [^.]{10,50}\.\s+The other [^.]{10,50}\.',
             "Consider: 'One side X and the other Y' for better flow"),
            # Some... Others...
            (r'Some [^.]{10,50}\.\s+Others [^.]{10,50}\.',
             "Consider: 'Some X while others Y' for better flow"),
            # One... Another...
            (r'One [^.]{10,50}\.\s+Another [^.]{10,50}\.',
             "Consider using 'while' or 'whereas' to connect the thoughts"),
        ]

        # Track whether we've flagged this line to avoid duplicates
        flagged = False
        for pattern, suggestion in parallel_patterns:
            if re.search(pattern, line.strip()):
                self.violations.append(ContentViolation(
                    line_num,
                    "Telegraphic parallel structure",
                    line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                    suggestion
                ))
                flagged = True
                break

        # Pattern: General choppy sentences (only if not already flagged)
        # Looking for: "Word. Word" pattern where both are very short
        if not flagged:
            pattern = r'^([A-Z][^.!?]{5,30})\.(\s+)([A-Z][^.!?]{5,30})\.'
            if re.search(pattern, line.strip()):
                self.violations.append(ContentViolation(
                    line_num,
                    "Possibly choppy sentences",
                    line.strip()[:80],
                    "Consider combining with comma or semicolon for better flow"
                ))

    def _check_consecutive_short_sentences(self, line_num: int, line: str, buffer: list):
        """Check for 3+ consecutive short sentences (choppy flow)."""
        # Split line into sentences (basic split on ". ")
        sentences = [s.strip() for s in line.split('. ') if s.strip()]

        for sent in sentences:
            # Consider sentences under 60 chars as "short"
            if len(sent) < 60 and sent.endswith('.'):
                buffer.append((line_num, sent))
            else:
                # Reset buffer if we hit a longer sentence
                if len(buffer) >= 3:
                    # Flag the choppy sequence
                    first_line = buffer[0][0]
                    combined_text = '. '.join([s for _, s in buffer])
                    self.violations.append(ContentViolation(
                        first_line,
                        "Choppy flow: consecutive short sentences",
                        combined_text[:100] + ("..." if len(combined_text) > 100 else ""),
                        "Consider connecting related ideas with connectors (while, and, as) for better flow",
                        is_style=True
                    ))
                buffer.clear()

    def _check_missing_conjunctions(self, line_num: int, line: str):
        """Check for contrasting statements without conjunctions."""
        # Patterns: Sentence ending with period followed by contrastive starter
        contrast_triggers = [
            (r'([Ff]eature teams [^.]{10,50})\.\s+([Pp]latform teams [^.]{10,50}\.)', 'while'),
            (r'([Ss]ome teams [^.]{10,50})\.\s+([Oo]ther teams [^.]{10,50}\.)', 'while'),
            (r'([Ss]ometimes [^.]{10,50})\.\s+([Ss]ometimes [^.]{10,50}\.)', 'while other times'),
        ]

        for pattern, connector in contrast_triggers:
            match = re.search(pattern, line.strip())
            if match:
                self.violations.append(ContentViolation(
                    line_num,
                    f"Missing conjunction in contrast",
                    line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                    f"Consider connecting with '{connector}' for better flow",
                    is_style=True
                ))
                break

    def _check_sequential_examples(self, line_num: int, line: str):
        """Check for sequential examples that could combine."""
        # Pattern: Multiple sentences with "might/could/can take/be/have" within same line
        example_pattern = r'(might|could|can) (take|be|have|deliver)'
        matches = list(re.finditer(example_pattern, line, re.IGNORECASE))

        # If we find 3+ examples in separate sentences on the same line
        if len(matches) >= 3:
            # Check they're in different sentences
            sentences = line.split('. ')
            example_sentences = [s for s in sentences if re.search(example_pattern, s, re.IGNORECASE)]

            if len(example_sentences) >= 3:
                self.violations.append(ContentViolation(
                    line_num,
                    "Sequential examples could flow together",
                    line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                    "Consider combining examples with commas and 'and': 'X might take 3 days, Y might take 6 weeks, and Z might take 3 months'",
                    is_style=True
                ))

    def _check_colon_list_constructions(self, line_num: int, line: str):
        """Check for colon-based or em-dash list constructions in prose."""
        # Pattern: word/phrase followed by em-dash or colon, then list items, then em-dash or continuation
        # Example: "signals—X, Y, Z—to" or "platforms: X, Y, Z provide"
        dash_list_pattern = r'\w+—[A-Z][^—]{10,}—\w+'
        colon_list_pattern = r'\w+:\s+[A-Z][^.]{20,},'  # Colon followed by capitalized list with commas

        if re.search(dash_list_pattern, line):
            self.violations.append(ContentViolation(
                line_num,
                "Em-dash list construction in prose",
                line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                "Use natural connectors like 'such as' or 'like' instead of em-dashes for lists",
                is_style=True
            ))

        if re.search(colon_list_pattern, line):
            # Make sure it's not a legitimate colon use (after complete clause)
            # Simple heuristic: if there are multiple commas after the colon in the same sentence
            colon_idx = line.find(':')
            if colon_idx > 0:
                after_colon = line[colon_idx:].split('.')[0]
                if after_colon.count(',') >= 2:
                    self.violations.append(ContentViolation(
                        line_num,
                        "Colon list construction in prose",
                        line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                        "Consider using 'like', 'such as', or 'including' for natural flow",
                        is_style=True
                    ))

        # Pattern: Bare comma-separated list without natural connector
        # Example: "publish on platforms. Medium, LinkedIn, and X provide"
        # Detect: Period followed by capital letter, then commas without preceding "like/such as/including"
        # This catches lists that appear after a period without a connector
        bare_list_pattern = r'\.\s+([A-Z][^,]{3,}),\s+([A-Z][^,]{3,}),?\s+(and\s+)?([A-Z][^.]{3,})\s+(provide|that|which|offer|enable)'

        if re.search(bare_list_pattern, line):
            # Make sure it doesn't already have a connector before the list
            # Check the context before the period
            period_match = re.search(bare_list_pattern, line)
            if period_match:
                # Find what comes before this pattern
                pattern_start = period_match.start()
                # Look at the 30 chars before the period to see if there's already a connector
                context_before = line[max(0, pattern_start - 30):pattern_start].lower()

                # If no connector found in the context, flag it
                if not any(connector in context_before for connector in ['like', 'such as', 'including', 'for example']):
                    self.violations.append(ContentViolation(
                        line_num,
                        "Bare list without natural connector",
                        line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                        "Insert 'like', 'such as', or 'that' before the list for natural flow",
                        is_style=True
                    ))

    def _check_choppy_openings(self, line_num: int, line: str):
        """Check for choppy noun-heavy opening constructions."""
        for pattern, suggestion in self.choppy_openings:
            if re.search(pattern, line.strip(), re.IGNORECASE):
                self.violations.append(ContentViolation(
                    line_num,
                    "Choppy opening construction",
                    line.strip(),
                    f"Consider more natural flow: {suggestion}",
                    is_style=True
                ))

    def _check_semicolon_quote_pattern(self, line_num: int, line: str):
        """Check for awkward semicolon + quote patterns."""
        # Pattern: semicolon followed by space and opening quote
        pattern = r';\s+["\']'
        if re.search(pattern, line):
            self.violations.append(ContentViolation(
                line_num,
                "Awkward semicolon + quote pattern",
                line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                "Consider breaking into separate sentences instead of using semicolon before quotes",
                is_style=True
            ))

    def _check_command_style_paragraphs(self, line_num: int, line: str):
        """Check for command-style paragraphs (multiple imperative sentences)."""
        # Pattern: Multiple sentences starting with imperative verbs
        sentences = [s.strip() for s in line.split('. ') if s.strip()]

        # Common imperative verbs at start of sentences
        imperative_verbs = [
            r'^(Define|State|Evaluate|Identify|Consider|Create|Build|Test|Measure|Document|Review|Analyze)',
        ]

        imperative_count = 0
        for sent in sentences:
            for verb_pattern in imperative_verbs:
                if re.search(verb_pattern, sent):
                    imperative_count += 1
                    break

        # Flag if 3+ consecutive imperative sentences
        if len(sentences) >= 3 and imperative_count >= 3:
            self.violations.append(ContentViolation(
                line_num,
                "Command-style paragraph (multiple imperatives)",
                line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                "Consider using bold headers with explanatory follow-ups instead of command-style lists",
                is_style=True
            ))

    def _check_lazy_parentheticals(self, line_num: int, line: str):
        """Check for lazy parentheticals used as definition shortcuts."""
        for pattern in self.lazy_parentheticals:
            match = re.search(pattern, line)
            if match:
                # Extract the subject and parenthetical content
                subject = match.group(1)
                paren_content = match.group(2)
                verb = match.group(3)

                self.violations.append(ContentViolation(
                    line_num,
                    "Lazy parenthetical (definition shortcut)",
                    line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                    f"Integrate '{paren_content}' naturally into the sentence instead of using parentheses as a shortcut. Break into separate sentences if needed.",
                    is_style=True
                ))
                break  # Only flag once per line

    def _check_external_link_attributes(self, line_num: int, line: str):
        """Check for external links missing target and rel attributes."""
        # Pattern: markdown link to http/https without {:target attribute following
        # Match: ](http...) not followed by {:target
        link_pattern = r'\]\((https?://[^\)]+)\)(?!\{:target)'

        matches = re.finditer(link_pattern, line)
        for match in matches:
            url = match.group(1)
            # Ignore localhost and relative URLs
            if 'localhost' not in url and not url.startswith('/'):
                self.violations.append(ContentViolation(
                    line_num,
                    "External link missing attributes",
                    line.strip()[:100] + ("..." if len(line.strip()) > 100 else ""),
                    'Add {:target="_blank" rel="noopener noreferrer"} after external links',
                    is_style=True
                ))


def main():
    if len(sys.argv) < 2:
        print("Usage: python lint_content.py <markdown_file>")
        print("       python lint_content.py --text <text_content>")
        sys.exit(1)

    linter = ContentLinter()

    # Check if using --text flag for raw string input
    if sys.argv[1] == '--text':
        if len(sys.argv) < 3:
            print("Error: --text flag requires text content argument")
            sys.exit(1)

        text_content = sys.argv[2]
        violations = linter.lint_text(text_content)
        source_name = "provided text"
    else:
        filepath = Path(sys.argv[1])

        if not filepath.exists():
            print(f"Error: File not found: {filepath}")
            sys.exit(1)

        violations = linter.lint_file(filepath)
        source_name = filepath.name

    # Separate violations from style suggestions
    errors = [v for v in violations if not v.is_style]
    style_suggestions = [v for v in violations if v.is_style]

    # Use UTF-8 encoding for output
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    # Print errors (blocking violations)
    if errors:
        print(f"VIOLATIONS FOUND in {source_name}:\n")
        for violation in errors:
            print(violation)
            print()
        print(f"Total violations: {len(errors)}\n")

    # Print style suggestions (informational)
    if style_suggestions:
        print(f"STYLE SUGGESTIONS for {source_name}:\n")
        for suggestion in style_suggestions:
            print(suggestion)
            print()
        print(f"Total style suggestions: {len(style_suggestions)}\n")

    # Exit with error only if there are actual violations (not just style)
    if not errors and not style_suggestions:
        print(f"OK: No violations found in {source_name}")
        sys.exit(0)
    elif not errors:
        print("Note: Only style suggestions found (not blocking)")
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
