# Editor Full Screen

Full screen mode with configurable hidden elements via modal - including sidebars. Hidden elements appear on hover.

### Features

- **Single full screen mode** with individually configurable hidden elements
- **Hover-to-reveal**: move cursor to viewport edges to temporarily show hidden elements
- **Left sidebar**: collapses on activation, reveals on ribbon hover, hides again on editor return
- **Right sidebar**: reveals with Shift + hover near right editor edge, hides on editor return
- **Persistent state**: remembers whether full screen was active when Obsidian was closed

### Hidden elements (configurable)

| Element | Hover zone |
| --- | --- |
| Title bar + tab strip | Top edge |
| View header (file title inside editor) | Its natural position |
| Ribbon | Left edge |
| Status bar | Bottom edge |
| Left sidebar | Revealed with ribbon on left hover |
| Right sidebar | Shift + right editor edge |

When the ribbon is hidden, the sidebar toggle button remains visible in the top-left corner and appears with the tab strip on top hover.

### Settings

Access via the plugin settings tab or the **quick modal** (right-click in editor → "Full screen settings"):

- **Persistent full screen**: restore full screen mode on restart if it was active when Obsidian closed
- Per-element toggles (changes apply immediately if mode is active)
- Enabling **left sidebar** also enables **ribbon** hiding automatically

### Usage

Toggle full screen via the command palette (`Toggle full screen mode`) or assign a hotkey in Obsidian settings.

Open element settings via the command palette (`Full screen: open element settings`) or right-click in the editor.

---

## Development

This plugin uses a template that automates the development and publication processes on GitHub, including releases. You can develop either inside or outside your Obsidian vault.

### Environment Setup

#### File Structure

```
src/
  types.ts          — enums, interfaces
  constants.ts      — element configs, default settings
  elementManager.ts — DOM show/hide logic
  hoverDetector.ts  — mouse movement + edge detection
  modal.ts          — quick-settings modal
  settings.ts       — PluginSettingTab
main.ts
styles.css
```

> **Note:** If `styles.css` is accidentally placed in the root folder instead of `src`, it will be automatically moved to the correct location when running any development command. After building, a copy of `styles.css` will appear in the root folder as part of the normal release process.

#### Development Options

1. **Inside the vault's plugins folder:**
   - Delete the `.env` file
   - Run npm commands as usual

2. **Outside the vault:**
   - Set the paths in the `.env` file:
     - `TestVault` for development
     - `RealVault` for production simulation
   - Necessary files will be automatically copied to the targeted vault

### Available Commands

- `npm run start`: Opens VS Code, runs `npm install`, then `npm run dev`
- `npm run dev`: For development
- `npm run build`: Builds the project
- `npm run real`: Simulates a traditional plugin installation in your REAL vault
- `npm run bacp`: Builds, adds, commits, and pushes (prompts for commit message)
- `npm run acp`: Adds, commits, and pushes (without building)
- `npm run version`: Updates version, modifies relevant files, then adds, commits, and pushes
- `npm run release`: Creates a GitHub release (prompts for release title, can be multiline using `\n`)

### Recommended Workflow

1. `npm run start`
2. `npm run bacp`
3. `npm run version`
4. `npm run release`

### Additional Features

- **obsidian-typings**: This template automatically includes obsidian-typings, providing access to additional types not present in the official API.
