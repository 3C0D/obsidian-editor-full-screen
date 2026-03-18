import { WorkspaceSidedock, App } from 'obsidian';
import type { EditorFullScreenPlugin } from './types.ts';

/**
 * Collapses the specified sidebar.
 */
export function collapseSidebar(app: App, side: 'left' | 'right'): void {
	const split = side === 'left' ? app.workspace.leftSplit : app.workspace.rightSplit;
	const dock = split as WorkspaceSidedock;
	if (!dock.collapsed) {
		dock.collapse();
	}
}

/**
 * Expands the specified sidebar.
 */
export function expandSidebar(app: App, side: 'left' | 'right'): void {
	const split = side === 'left' ? app.workspace.leftSplit : app.workspace.rightSplit;
	const dock = split as WorkspaceSidedock;
	if (dock.collapsed) {
		dock.expand();
	}
}

/**
 * Updates sidebar visibility based on current settings.
 * Collapses sidebars when the corresponding hide setting is enabled.
 * Only operates when the full screen mode is active.
 */
export function updateSidebarVisibility(plugin: EditorFullScreenPlugin): void {
	if (!plugin.isFullScreen) {
		return;
	}

	const { app, settings } = plugin;

	// Collapse left sidebar if setting is enabled
	if (settings.hideLeftSidebar) {
		collapseSidebar(app, 'left');
	}

	// Collapse right sidebar if setting is enabled
	if (settings.hideRightSidebar) {
		collapseSidebar(app, 'right');
	}
}
