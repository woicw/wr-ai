# `wrs` Skills-Only Redesign

Date: 2026-04-19
Status: Proposed and validated for planning

## Summary

This project will ship a new major version that replaces `wr-ai` with `wrs`.
The new product scope is intentionally narrower:

- Only `skills` synchronization is supported
- Remote repositories may still contain other content, but the CLI ignores it
- Legacy `wr-ai` configuration is not compatible and will not be migrated

The goal is to turn the tool from a general AI config synchronizer into a focused skill sync utility with a smaller command surface and a simpler internal model.

## Goals

- Rename the package and CLI command from `wr-ai` to `wrs`
- Reduce the product surface to `skills` only
- Remove multi-type parsing, selection, merge, and documentation logic
- Keep the sync experience simple for repeat usage
- Preserve the current skill merge behavior where remote content updates same-name files without deleting local-only files

## Non-Goals

- Supporting commands, agents, hooks, MCP, or LSP in the new CLI
- Preserving backward compatibility with `.wr-ai` config directories
- Migrating old config files into `.wrs`
- Redesigning the repository source format beyond ignoring non-skill content
- Adding new dependency packages

## User-Facing Design

### CLI Surface

The new CLI exposes exactly four commands:

- `wrs list`
- `wrs add <skill>`
- `wrs sync`
- `wrs set github <url>`

Removed commands:

- `init`
- `update`
- `install`
- `upgrade`
- `reset`
- `clear`
- `set platform`

Removed syntax and behaviors:

- Type filters such as `command`, `agent`, `hook`, `mcp`, and `lsp`
- Typed names such as `type:name`
- Special selectors such as `@latest`
- All non-skill prompts and help text

### Command Semantics

#### `wrs list`

Lists all available skill names from the remote repository's `skills/` directory.
It does not accept a type argument.
It does not display or mention any non-skill content.

#### `wrs add <skill>`

Synchronizes one named skill into the target AI platform directory.
The argument is always interpreted as a skill name.
If the skill does not exist in the remote repository, the command reports a clear not-found error.

#### `wrs sync`

Acts as the main repeated-use entry point.

Behavior:

- If the current scope already has `lastSelection.skills`, sync those skills immediately
- If there is no stored selection, fetch remote skills, open an interactive multi-select, then sync the selected skills
- After an interactive selection, store the selected skill names for future `sync` runs in the same scope

This command replaces the old `init` and `update` batch flows.

#### `wrs set github <url>`

Sets the global GitHub repository source in `~/.wrs/config.json`.
This setting is global-only and does not write project-local source configuration.

### Options

The CLI keeps only options that are still meaningful for skills sync:

- `-g, --global`
- `-p, --platform <platform>`

No other previous options remain.

## Configuration Design

### Config Locations

Global configuration directory:

- `~/.wrs/config.json`

Project-local configuration directory:

- `<project>/.wrs/config.json`

Legacy locations are ignored:

- `~/.wr-ai/config.json`
- `<project>/.wr-ai/config.json`

The new version does not read these files and does not attempt migration.

### Config Model

Global config stores durable global settings and optional global last selection:

```json
{
  "origin": "https://github.com/example/ai-config.git",
  "platform": "claude",
  "lastSelection": {
    "skills": ["code-review", "nextjs"],
    "timestamp": "2026-04-19T00:00:00.000Z"
  }
}
```

Project-local config stores project-specific last selection:

```json
{
  "lastSelection": {
    "skills": ["code-review", "nextjs"],
    "timestamp": "2026-04-19T00:00:00.000Z"
  }
}
```

Field rules:

- `origin` exists only as a global setting and is managed by `wrs set github`
- `platform` remains an internal default fallback value and is not user-configurable through a command
- `lastSelection.skills` is the only selection list the product stores
- No fields remain for commands, agents, hooks, MCP servers, or LSP services

### Scope Rules

`wrs set github <url>` always writes to global config.

For `wrs add` and `wrs sync`:

- With `--global`, read and write `lastSelection` in `~/.wrs/config.json`
- Without `--global`, read and write `lastSelection` in `<project>/.wrs/config.json`

`wrs list` reads the global `origin`.

## Source Repository Rules

The source repository contract becomes skill-focused without requiring repository cleanup.

Rules:

- The CLI reads only the `skills/` directory from the resolved source path
- Other repository content may exist, but the CLI ignores it
- A skill is still represented as a directory under `skills/<name>/`

This keeps the repository format flexible while making the product boundary explicit.

## Sync and Merge Semantics

### Target Directory Resolution

The target AI platform resolution remains intentionally familiar:

- Prefer already-existing known AI platform directories such as `.claude/` and `.codex/`
- If no known platform directory exists, use `--platform` when provided
- If neither exists, fall back to the internal default platform value

This preserves the practical behavior users already rely on while removing unrelated product surface.

### Skill Merge Rules

Skill sync remains non-destructive for local-only content.

For a same-name skill:

- Remote same-name files overwrite local same-name files
- Remote new files are copied into the local skill directory
- Local-only files are preserved
- The sync does not delete files that are absent remotely

This behavior applies to both `add` and `sync`.

## Internal Architecture Design

### Entry Point

`src/index.js` should be reduced to the four supported commands and updated branding:

- Program name becomes `wrs`
- Help and descriptions mention only skills
- The package bin entry also becomes `wrs`

### Parser and Selection Layer

The current multi-type parser model should be removed.

Replace broad utilities with skills-specific ones:

- `readConfigLists` becomes a `readSkillList` style utility
- Selection parsing stores only selected skill names
- Type normalization, type aliases, and prefixed selection constants are removed

### Command Handlers

The new handlers should have narrow responsibilities:

- `list`: fetch source, read remote skills, print skill list
- `add`: validate one remote skill name, sync it to targets, update scoped last selection if appropriate
- `sync`: load scoped last selection or run interactive skill selection, then sync those skills and persist the selection
- `set github`: update global origin only

### Config Layer

Config helpers should be simplified to match the new scope:

- Use `.wrs` paths
- Separate global origin handling from scoped last-selection handling
- Remove any read/write logic for obsolete selection fields

### Merge Layer

The current generic merge helpers should be narrowed or replaced with explicit skill-sync helpers.

Desired direction:

- Keep a dedicated directory copy primitive for skills
- Remove branches for commands, agents, hooks, MCP, and LSP
- Use naming that matches actual behavior, such as `syncSkills` or `copySkillDirectory`

The implementation should prefer deletion over retaining generic abstractions that no longer match the product.

## Error Handling

The redesigned CLI should keep error behavior simple and direct:

- Missing global `origin` should produce a clear message pointing to `wrs set github <url>`
- Missing remote skill should produce a clear not-found message
- Empty or missing remote `skills/` should produce a skills-specific empty-state message
- Interactive selection cancellation should exit cleanly without partial state writes

## Testing Strategy

The major-version redesign should replace broad legacy coverage with focused tests around the new contract.

Minimum verification coverage:

1. Remote parsing reads only `skills/` and ignores other repository content
2. `wrs add <skill>` succeeds for existing skills and fails clearly for missing ones
3. `wrs sync` uses stored `lastSelection.skills` when present
4. `wrs sync` enters selection mode when no stored skill selection exists and then persists that selection
5. Config read/write paths use `.wrs` rather than `.wr-ai`
6. Legacy `.wr-ai` config is not consulted
7. Same-name skill merge preserves local-only files while overwriting same-name files

## Documentation Changes

README should be rewritten around the new product:

- Project name becomes `wrs`
- Installation examples use `wrs`
- Only skills are documented
- The main repeated workflow is `wrs sync`
- Global source configuration is documented via `wrs set github`
- The breaking-change note explicitly states that `.wr-ai` config is not compatible

## Release Impact

This is a breaking release and should increment the major version.

The release note should communicate:

- New CLI name: `wrs`
- Skills-only scope
- Removed commands and removed multi-type support
- New config directory: `~/.wrs`
- No compatibility or migration for old `.wr-ai` config

## Rationale

The previous product accumulated a broad sync surface that made the CLI, config model, and merge logic much wider than the skill-sync use case actually needs.
This redesign makes the product narrower on purpose.
The user experience becomes easier to understand, and the internal architecture can finally match the real product boundary.

## Open Questions Resolved

- Batch entry point uses `sync`, not `init`
- `sync` defaults to replaying the last selection and only asks interactively when no selection exists
- `set github` is retained
- `set platform` is removed
- Source repositories may still contain non-skill content, but the CLI ignores it
- Legacy `wr-ai` config is intentionally unsupported
