import { Side } from "./types.ts";
import type { ElementConfig, EFSSettings } from "./types.ts";

// NOTE: verify .workspace-sidedock.mod-left in Obsidian DevTools if left sidebar doesn't hide
export const ELEMENT_CONFIGS: Record<string, ElementConfig> = {
	ribbon: {
		selector: ".workspace-ribbon.side-dock-ribbon.mod-left",
		side: Side.left,
		exitPadding: 10,
	},
	tabHeader: {
		// Tab strip at the top of the editor pane
		selector: ".mod-root .workspace-tabs .workspace-tab-header-container",
		side: Side.top,
		exitPadding: 10,
	},
	titleBar: {
		// OS-level title bar
		selector: ".titlebar",
		side: Side.top,
		exitPadding: 10,
	},
	viewHeader: {
		// Per-leaf header (breadcrumb / file title inside editor)
		selector: ".mod-root .workspace-leaf-content > .view-header",
		side: Side.top,
		exitPadding: 10,
	},
	statusBar: {
		selector: ".status-bar",
		side: Side.bottom,
		// Extra padding: Windows taskbar sits close to this area
		exitPadding: 30,
	},
	leftSidebar: {
		// Left panel (file explorer, search, etc.)
		// Managed via Obsidian API (collapse/expand), not CSS opacity.
		// selector is kept for reference only — not used for hide/show.
		selector: ".workspace-sidedock.mod-left",
		side: Side.left,
		exitPadding: 10,
	},
	leftToggleBtn: {
		// Sidebar toggle button visible when ribbon is collapsed
		selector: ".sidebar-toggle-button.mod-left",
		side: Side.top,
		exitPadding: 10,
	},
};

export const DEFAULT_SETTINGS: EFSSettings = {
	modeAtStart: true,
	wasActive: false,
	hideRibbon: true,
	hideTopBar: true,
	hideViewHeader: false,
	hideStatusBar: true,
	hideLeftSidebar: false,
};
