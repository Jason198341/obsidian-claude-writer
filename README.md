# Claude Writer

AI writing assistant for Obsidian, powered by [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code).

Transform your notes with Claude's intelligence — directly inside Obsidian's sidebar.

## Features

### Writing Commands
| Command | Description |
|---------|-------------|
| **Rewrite** | Polish grammar and style while preserving meaning |
| **Restructure** | Convert messy notes/keywords into structured documents |
| **Summarize** | Extract key points as bullet points |
| **KR→EN** | Korean to natural English translation |
| **EN→KR** | English to natural Korean translation |
| **Formalize EN** | Convert Korean tech docs to formal English reports |
| **Insight** | Extract one core insight (Zettelkasten style) |
| **Explain** | Deep explanation at 4 levels (elementary → expert) |
| **Visualize** | AI-recommended Mermaid diagrams & tables |
| **Custom** | Free-form instructions |

### Smart Context
- **Template-aware**: Detects frontmatter `template:` field and auto-applies matching prompts (11 templates)
- **Document context**: Scans `[[wikilinks]]` up to 3 levels deep for richer AI understanding
- **Surrounding text**: Sends text before/after selection so results fit naturally in your document

### Flexible Insert Options
Every result can be inserted in 6 ways:
- **Replace** — swap selected text
- **Below** — insert right after selection
- **Callout** — foldable `> [!info]-` block
- **New Note** — create linked note with `[[wikilink]]`
- **End of Doc** — append to document
- **Copy** — clipboard

### Explain Mode (4 Levels)
| Level | Audience | Style |
|-------|----------|-------|
| 1 | Elementary | Analogies, simple words |
| 2 | High School | Concepts → principles → examples |
| 3 | General | Background → mechanism → relationships |
| 4 | Expert | Technical depth, trade-offs, English terminology |

### Visualize Mode
1. Select text → click Visualize
2. AI analyzes content and recommends 3 visualization techniques
3. Pick one → generates Obsidian-ready Mermaid diagram or Markdown table

Supports: flowchart, mindmap, sequence, timeline, pie, gantt, ER, state, class, quadrant, table.

## Requirements

- **Claude Code CLI** must be installed and authenticated
  - Install: `npm install -g @anthropic-ai/claude-code`
  - Login: `claude auth login`
- **Obsidian** v1.5.0+
- **Desktop only** (uses local CLI process)

## Installation

### From Community Plugins
1. Open Obsidian Settings → Community Plugins
2. Search for "Claude Writer"
3. Install and enable

### Manual
1. Download `main.js`, `styles.css`, `manifest.json` from [Releases](https://github.com/jasonmoon-dev/obsidian-claude-writer/releases)
2. Create folder: `<vault>/.obsidian/plugins/claude-writer/`
3. Copy the 3 files into the folder
4. Restart Obsidian and enable the plugin

## Usage

1. Select text in any note
2. Click the ✏️ pen icon in the ribbon (or use the sidebar)
3. Choose a command
4. Review the result → pick how to insert it

### Right-Click Menu
Select text → right-click → Claude: Rewrite / Restructure / Summarize / Translate / Formalize

### Keyboard
All commands are available via Obsidian's command palette (`Ctrl/Cmd + P`).

## Settings

| Setting | Description |
|---------|-------------|
| Claude CLI Path | Auto-detected, or set manually |
| Default Model | Haiku (fast) / Sonnet (balanced) / Opus (best) |
| Default Tone | Auto / Formal / Technical / Content / Analytical |
| Character Limit | 0 = unlimited |

## How It Works

Claude Writer bridges Obsidian and Claude Code CLI using `child_process.spawn`. Your text is processed locally through the CLI — no API keys needed, uses your existing Claude subscription (Max/Team/Enterprise).

**No data leaves your machine except to Anthropic's API** through the official CLI.

## License

MIT

---

Built by [jasonmoon](https://jasonmoon.dev) — Full-stack developer, AI-native tools & creative automation.

