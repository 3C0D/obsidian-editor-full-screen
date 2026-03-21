import { Side } from './types.ts';
import type { EFSSettings, ToggleItem } from './types.ts';

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

export const RIBBON_SELECTOR = '.workspace-ribbon.side-dock-ribbon.mod-left';
export const STATUS_BAR_SELECTOR = '.status-bar';
export const LEFT_SIDEBAR_SELECTOR = '.workspace-sidedock.mod-left';
export const LEFT_TOGGLE_BTN_SELECTOR = '.sidebar-toggle-button.mod-left';
export const RIGHT_SIDEBAR_SELECTOR = '.mod-right-split';

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
