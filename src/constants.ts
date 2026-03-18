import { Side } from "./types.ts";
import type { ElementConfig, EFSSettings, ToggleItem } from "./types.ts";

export const TOGGLE_ITEMS: ToggleItem[] = [
	{ key: "hideTopBar", label: "Top bar", desc: "Title bar + tab strip" },
	{
		key: "hideViewHeader",
		label: "View header",
		desc: "File title bar inside the editor pane",
	},
	{
		key: "hideLeftSidebar",
		label: "Left sidebar",
		desc: "Toggles on ribbon hover, closes on editor return",
	},
	{
		key: "hideRightSidebar",
		label: "Right sidebar",
		desc: "Shift + hover right edge to toggle",
	},
	{
		key: "hideRibbon",
		label: "Ribbon",
		desc: "Left icon ribbon (auto-enabled with left sidebar)",
	},
	{ key: "hideStatusBar", label: "Status bar", desc: "Bottom status bar" },
];

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
		// OS-window buttons
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
		// Managed via Obsidian API (collapse/expand).
		// selector is kept for reference only — not used for hide/show.
		selector: ".workspace-sidedock.mod-left",
		side: Side.left,
		exitPadding: 10,
	},
	leftToggleBtn: {
		// Sidebar toggle button, we need it when ribbon is collapsed
		selector: ".sidebar-toggle-button.mod-left",
		side: Side.top,
		exitPadding: 10,
	},
	rightSidebar: {
		selector: ".workspace-sidedock.mod-right",
		side: Side.right,
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
	hideRightSidebar: false,
};
