import { Side } from './types.ts';
import type { ElementConfig, EFSSettings, ToggleItem } from './types.ts';

/** Configuration items for the settings modal. */
export const TOGGLE_ITEMS: ToggleItem[] = [
	{
		key: 'hideTopBar',
		label: 'Top bar',
		desc: 'Title bar + tab strip',
	},
	{
		key: 'hideViewHeader',
		label: 'View header',
		desc: 'File title bar inside the editor pane',
	},
	{
		key: 'hideLeftSidebar',
		label: 'Left sidebar',
		desc: 'Toggles on ribbon hover, closes on editor return',
	},
	{
		key: 'hideRightSidebar',
		label: 'Right sidebar',
		desc: 'Shift + hover right edge to toggle',
	},
	{
		key: 'hideRibbon',
		label: 'Ribbon',
		desc: 'Left icon ribbon (auto-enabled with left sidebar)',
	},
	{ key: 'hideStatusBar', label: 'Status bar', desc: 'Bottom status bar' },
];

/**
 * Selector for view-header elements inside editor panes.
 * Used by HoverDetector for multi-split position-based reveal.
 * Not in ELEMENT_CONFIGS — managed via CSS body class instead.
 */
export const VIEW_HEADER_SELECTOR =
	'.mod-root .workspace-leaf-content > .view-header';

export const TAB_HEADER_SELECTOR =
	'.mod-root .workspace-tabs .workspace-tab-header-container';

/** Configuration for UI elements to be hidden/shown on hover. */
export const ELEMENT_CONFIGS: Record<string, ElementConfig> = {
	ribbon: {
		selector: '.workspace-ribbon.side-dock-ribbon.mod-left',
		side: Side.left,
		exitPadding: 10,
	},
	// tabHeader + titleBar removed — managed via CSS body class
	// (efs-hide-topbar) to support multiple splits + popouts.
	// viewHeader removed — managed via CSS body class
	// (efs-hide-viewheader) to support multiple splits.
	statusBar: {
		selector: '.status-bar',
		side: Side.bottom,
		// Extra padding: Windows taskbar sits close to this area
		exitPadding: 30,
	},
	leftSidebar: {
		// Managed via Obsidian API (collapse/expand).
		// selector is kept for reference only — not used for hide/show.
		selector: '.workspace-sidedock.mod-left',
		side: Side.left,
	},
	leftToggleBtn: {
		// Sidebar toggle button, we need it when ribbon is collapsed
		selector: '.sidebar-toggle-button.mod-left',
		side: Side.top,
		exitPadding: 10,
	},
	rightSidebar: {
		selector: '.mod-right-split',
		side: Side.right,
	},
};

export const DEFAULT_SETTINGS: EFSSettings = {
	modeAtStart: true,
	lastFullScreen: false,
	hideRibbon: true,
	hideTopBar: true,
	hideViewHeader: false,
	hideStatusBar: true,
	hideLeftSidebar: false,
	hideRightSidebar: false,
};
