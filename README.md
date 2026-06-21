<div align="center">

# 🔄 ai-infra-translate

### One project, every AI coding tool.

Stop maintaining four copies of your AI config by hand. Tell the script which tool you're using — it translates your manual, skills, subagents, and hooks into that tool's native format. No generic intermediate files. No copy-paste.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](package.json)
[![Claude Code](https://img.shields.io/badge/Claude_Code-supported-D97757)](#)
[![GitHub Copilot](https://img.shields.io/badge/GitHub_Copilot-supported-6e7681)](#)
[![Codex](https://img.shields.io/badge/Codex-supported-10A37F)](#)
[![Cursor](https://img.shields.io/badge/Cursor-supported-3B82F6)](#)

</div>

<br>
<br>

$ ./adaptar.sh copilot<br>
→ Borrando infraestructura de Copilot anterior...<br>
→ Traduciendo desde Claude Code...<br>
✓ Manual traducido: CLAUDE.md → .github/copilot-instructions.md<br>
✓ 2 skill(s) traducida(s): crear-test, revisar-codigo<br>
✓ 2 subagente(s) traducido(s): revisor-logica, revisor-tests<br>
✓ 2 hook(s) traducido(s)<br>
→ Quitando la infraestructura de Claude Code, ya traducida...<br>

✓ Listo. Ahora solo existe la infraestructura de Copilot.


<br>

## The problem

Your team doesn't all use the same AI coding tool. Some use **Claude Code**, some **GitHub Copilot**, some **Codex**, some **Cursor** — and every single one of them stores its config (instructions, skills, subagents, hooks) in a different place, in a different format.

Maintain that by hand and you get either:
- **Duplication** — the same rules written four times, drifting apart every time someone updates one and forgets the rest
- **A generic intermediate file** nobody's tool actually reads natively, so you lose the features that make each tool good (subagents, hooks, skills)

## The fix

This isn't a generic config layer. Each tool gets its **real, native** infrastructure — `.claude/`, `.github/`, `.codex/`, `.cursor/`. The translator regenerates the target from whatever you currently have active, then removes the source. One format lives in your repo at a time — never four copies drifting out of sync.

\`\`\`bash
./adaptar.sh claude     # regenerate .claude/  from whatever's currently active
./adaptar.sh copilot    # regenerate .github/  from whatever's currently active
./adaptar.sh codex      # regenerate .codex/   from whatever's currently active
./adaptar.sh composer   # regenerate .cursor/  from whatever's currently active
./adaptar.sh estado     # what's active right now
\`\`\`

> Cursor's infrastructure lives under `.cursor/`, but the CLI parameter is `composer` — that's the name of the chat/edit feature inside Cursor that the team building this uses day to day, so the command matches what they actually call it.

Create a new Skill while working in Copilot? Switch to Claude and it's already there, translated.

## What gets translated

| Piece | Claude Code | GitHub Copilot | Codex | Composer (Cursor) |
|---|---|---|---|---|
| Manual | `CLAUDE.md` | `.github/copilot-instructions.md` | `AGENTS.md` | `.cursor/rules/*.mdc` |
| Skills | `.claude/skills/<name>/SKILL.md` | `.github/skills/<name>/SKILL.md` | `.codex/skills/<name>/SKILL.md` | `.cursor/skills/<name>/SKILL.md` |
| Subagents | `.claude/agents/<name>.md` | `.github/agents/<name>.agent.md` | `.codex/agents/<name>.toml` | `.cursor/agents/<name>.md` |
| Hooks | `.claude/settings.json` + scripts | `.github/hooks/config.json` + scripts | `.codex/hooks.json` + scripts | `.cursor/hooks.json` + `.cursor/hooks/<name>.sh` |

`SKILL.md` is a Markdown-plus-YAML-frontmatter standard shared by Claude Code, Copilot, and Codex, so those three translate it directly. Subagents follow the same pattern across Claude Code, Copilot, and Composer — Markdown with YAML frontmatter, just a different file extension and folder per tool. Codex is the one tool here with a structurally different subagent format — `.toml` instead of Markdown frontmatter — so that translation rewrites the file format, not just the folder.

Cursor (Composer) has no native skill or hook system today — its `.cursor/rules/*.mdc` files cover instructions, and `.cursor/agents/*.md` covers subagents, translated the same way as Claude Code's and Copilot's. Skills and hooks translated *into* Composer have nowhere to land; translating *out of* Composer, there's simply nothing there to read. Nothing is silently dropped — there's just nothing to translate for those two pieces.

The hardest part is hooks: Claude Code blocks an action with `exit 2`; Copilot and Codex both block it by printing `{"permissionDecision": "deny"}` to stdout (Codex's hook engine is intentionally close to Claude's here). The translator doesn't rewrite your hook's logic — it generates a thin wrapper that runs your original script and translates its exit code into whatever format the target tool expects.

Model names get translated by **capability tier**, not exact SKU — there's no stable 1:1 mapping between identifiers across tools.

| Tier | Claude Code | Copilot | Codex | Composer (Cursor) |
|---|---|---|---|---|
| Fast | `haiku` | `claude-haiku-4-5` | `gpt-5-mini` | `composer-2.5-fast` |
| Balanced | `sonnet` | `claude-sonnet-4-6` | `gpt-5.2-codex` | `composer-2.5[fast=false]` |
| Powerful | `opus` | `claude-opus-4-7` | `gpt-5.2-codex-max` | `composer-1.5` |

## Quick start

<br>
git clone https://github.com/<your-username>/ai-infra-translate.git <br>
cd ai-infra-translate <br>
chmod +x adaptar.sh <br>

# you already have Claude Code infra (.claude/) set up? translate it: <br>
./adaptar.sh copilot <br>
./adaptar.sh codex <br>
./adaptar.sh composer <br>


Requires Node.js ≥ 18. No external dependencies — the YAML/JSON/TOML parsing is hand-rolled on purpose, so you don't need `jq` or `yq` installed on every machine.

## Why not just bash?

Earlier versions of this used a single shared `AGENTS.md` file copied around with `cat`/`sed`. That broke down the moment translation needed to understand *structure* — YAML frontmatter, nested JSON, TOML tables — not just copy text. Bash regex against arbitrary YAML is fragile in exactly the way you don't want a security hook to be fragile. Node's `JSON.parse` is free; the YAML/TOML handling here is hand-written, dependency-free, and scoped to exactly what this project's frontmatter needs — nothing more.

## Honest limitations

- Hook translation adapts the **communication mechanism** (exit code ↔ JSON), not the hook's internal logic. If your hook leans on tool-specific environment variables, double-check it after translating.
- Copilot and Codex don't have a single canonical model identifier — it varies by surface (VS Code, CLI, cloud agent). Translation is tier-based by design, not exact-SKU.
- Composer (Cursor) translates the manual and subagents, but has no native skill or hook system today — there's nothing to translate to or from for those two pieces.
- If you hand-edit the *translated* file directly instead of the source, that edit won't survive the next translation. Edit the tool you're actively using, then translate forward.

## Contributing

If you hit a real bug, [open an issue](../../issues/new/choose) with the exact command and output; "doesn't work" without a repro is hard to act on.

## License

[MIT](LICENSE) — use it, fork it, ship it.

<br>

<div align="center">

If this saved your team from copy-pasting config four times, a ⭐ helps other people find it.

</div>
