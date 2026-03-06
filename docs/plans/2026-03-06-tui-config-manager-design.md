# TUI Configuration Manager Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Terminal UI (TUI) for managing wr-ai configurations with visual feedback and interactive operations

**Architecture:** ink-based React TUI with reusable components, integrating existing config/merger utilities

**Tech Stack:**
- ink + React (TUI framework)
- ink-table (table display)
- ink-select-input (selection)
- ink-text-input (search)
- Existing utilities (config.js, merger.js, filesystem.js)

---

## 1. Overview

### Problem
Current CLI commands (init, update, sync) require users to remember command syntax and options. There's no easy way to:
- View all installed configurations at a glance
- Compare what's installed vs available
- Manage configurations interactively
- Preview configuration details before operations

### Solution
Add `wr-ai manage` command that launches a TUI with:
- Table view of all installed configs (commands, skills, agents, hooks, MCP, LSP)
- Interactive navigation and operations (install, update, delete)
- Real-time detail preview panel
- Search/filter capabilities

---

## 2. Architecture

### Directory Structure
```
src/
  commands/
    manage.js          # Command entry point
  ui/
    components/
      ConfigTable.jsx  # Main table component
      DetailPanel.jsx  # Bottom detail panel
      ActionBar.jsx    # Keyboard shortcuts bar
      SearchInput.jsx  # Search filter input
    App.jsx            # Root TUI application
    store.js           # State management
    scanner.js         # Config scanning utilities
```

### Component Hierarchy
```
App
├── Header (title + quit hint)
├── ConfigTable (main list)
├── ActionBar (keyboard shortcuts)
└── DetailPanel (selected item details)
```

### State Management
```javascript
{
  configs: [
    {
      type: 'command' | 'skill' | 'agent' | 'hook' | 'mcp' | 'lsp',
      name: string,
      status: 'installed' | 'available' | 'outdated',
      location: string,
      description: string,
      source: string,
      lastModified: Date
    }
  ],
  selectedIndex: number,
  searchQuery: string,
  view: 'list' | 'install' | 'confirm',
  loading: boolean,
  error: string | null
}
```

---

## 3. UI Layout

### Main View
```
┌─────────────────────────────────────────────────────────┐
│ wr-ai Configuration Manager                    [q] Quit │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Type    Name              Status    Location          │
│  ────────────────────────────────────────────────────   │
│  🔧 CMD  commit            ✓ Installed  ~/.claude      │
│  🧠 SKL  test-driven-dev   ✓ Installed  ~/.claude      │
│  🤖 AGT  code-reviewer     ✓ Installed  ~/.claude      │
│  🪝 HK   pre-commit        ✓ Installed  ~/.claude      │
│  📡 MCP  filesystem        ✓ Installed  ~/.claude      │
│                                                         │
│  [↑↓] Navigate  [Enter] Details  [i] Install           │
│  [u] Update  [d] Delete  [/] Search                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Details: commit                                         │
│ Description: Create git commits with best practices    │
│ Source: ~/.claude/commands/commit.md                   │
│ Last Modified: 2026-03-05                              │
└─────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts
- `↑/↓` or `j/k`: Navigate list
- `Enter`: Toggle detail expansion
- `i`: Install new configuration
- `u`: Update selected item
- `d`: Delete selected item
- `/`: Focus search input
- `Esc`: Clear search / Go back
- `q`: Quit application

---

## 4. Data Flow

### Initialization
1. Scan local config directories (~/.claude, ~/.codex, ~/.cursor)
2. Read metadata from each config file
3. Parse and normalize into unified format
4. Render to table component

### Operations

#### Install Flow
1. Press `i` → Switch to remote config list view
2. Navigate and select items
3. Press `Enter` → Show confirmation dialog
4. Confirm → Call existing `mergeFileConfigs` / `mergeMcpConfig`
5. Refresh list → Show success message

#### Update Flow
1. Select item with "outdated" status
2. Press `u` → Show confirmation with changes
3. Confirm → Call sync logic
4. Refresh list → Show success message

#### Delete Flow
1. Select installed item
2. Press `d` → Show confirmation dialog
3. Confirm → Delete files from filesystem
4. Refresh list → Show success message

### Search/Filter
1. Press `/` → Show search input at top
2. Type query → Filter list in real-time
3. Press `Esc` → Clear search and show all

---

## 5. Error Handling

### Config Read Errors
- Display warning icon (⚠️) in status column
- Show error message in detail panel
- Provide "Retry" option

### Network Errors (Remote Fetch)
- Degrade to local-only mode
- Show "⚠️ Offline Mode" in header
- Provide "Reconnect" button

### Operation Conflicts
- Check dependencies before delete
- Show confirmation with impact list
- Provide "Force" and "Cancel" options

### Terminal Size
- Detect width < 80 or height < 20
- Show friendly message: "Please resize terminal"
- Provide simplified view (list only, no details)

### User Interruption (Ctrl+C)
- Catch SIGINT signal
- Save current state (search query, position)
- Exit gracefully with "Operation cancelled"

---

## 6. Testing Strategy

### Unit Tests
- State management logic (store.js)
- Config scanning and parsing (scanner.js)
- Operation functions (install, delete, update)

### Integration Tests
- Use ink-testing-library for component rendering
- Simulate keyboard input
- Verify navigation and operations
- Test different terminal sizes

### E2E Tests
- Test in real terminal environment
- Verify compatibility with existing commands
- Test actual file read/write operations

### Coverage Targets
- Core logic: > 80%
- UI components: > 60%

---

## 7. Implementation Phases

### Phase 1: Foundation (Priority 1)
- Set up ink project structure
- Create basic App component with header
- Implement config scanner
- Display static table with mock data

### Phase 2: Navigation (Priority 1)
- Add keyboard navigation (↑↓/jk)
- Implement selection highlighting
- Add detail panel with selected item info
- Handle quit (q) and escape (Esc)

### Phase 3: Operations (Priority 2)
- Implement delete operation with confirmation
- Add install flow (switch to remote list)
- Integrate with existing merger utilities
- Show success/error messages

### Phase 4: Search (Priority 2)
- Add search input component
- Implement real-time filtering
- Handle search focus/blur

### Phase 5: Polish (Priority 3)
- Add update detection (compare with remote)
- Improve error handling
- Add loading states
- Optimize performance

---

## 8. Dependencies

### New Dependencies
```json
{
  "ink": "^5.0.0",
  "react": "^18.3.0",
  "ink-table": "^3.1.0",
  "ink-select-input": "^6.0.0",
  "ink-text-input": "^6.0.0"
}
```

### Reuse Existing
- src/lib/config.js (getConfig, saveConfig)
- src/lib/filesystem.js (resolveTargetDirectories)
- src/utils/merger.js (mergeFileConfigs, mergeMcpConfig)
- src/utils/parser.js (readConfigLists)

---

## 9. Success Criteria

### Functional
- ✅ Display all installed configs in table format
- ✅ Navigate with keyboard (↑↓/jk)
- ✅ Show details for selected item
- ✅ Install new configs interactively
- ✅ Delete configs with confirmation
- ✅ Search/filter configs
- ✅ Handle errors gracefully

### Non-Functional
- ✅ Responsive to terminal resize
- ✅ < 500ms initial load time
- ✅ Smooth navigation (no lag)
- ✅ Clear visual feedback for all operations
- ✅ Accessible keyboard shortcuts

---

## 10. Future Enhancements (Out of Scope)

- Remote update detection (compare versions)
- Batch operations (select multiple items)
- Configuration diff view
- Export/import configuration sets
- Integration with package managers (npm, brew)

