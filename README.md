# Editor Full Screen

- Full screen mode: only the file content is shown. by default the status bar is hidden (see settings) (hotkey suggestion ctrl+alt+f)

- Zen Mode: the navigation bar is still visible. (hotkey suggestion alt+f) 

>**Behavior**:  
To show the ribbon go to the left edge  
To show headers go to the top edge

It fits to the window content. So you can split, resize your OS window it will fit in

![demo](cool.gif)

## Development

This plugin uses a template that automates the development and publication processes on GitHub, including releases. You can develop either inside or outside your Obsidian vault.

### Environment Setup

#### File Structure
- All source files must be in the `src` folder:
  - `main.ts`
  - `styles.css`

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