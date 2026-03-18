import { WorkspaceSidedock } from "obsidian";
import type { EditorFullScreenPlugin } from "./types.ts";

/**
 * Collapses the specified sidebar.
 * @param app - The Obsidian app instance.
 * @param side - Which sidebar to collapse ('left' or 'right').
 */
export function collapseSidebar(
	app: EditorFullScreenPlugin["app"],
	side: "left" | "right",
): void {
	const split =
		side === "left" ? app.workspace.leftSplit : app.workspace.rightSplit;
	const dock = split as WorkspaceSidedock;
	if (!dock.collapsed) {
		dock.collapse();
	}
}

/**
 * Expands the specified sidebar.
 * @param app - The Obsidian app instance.
 * @param side - Which sidebar to expand ('left' or 'right').
 */
export function expandSidebar(
	app: EditorFullScreenPlugin["app"],
	side: "left" | "right",
): void {
	const split =
		side === "left" ? app.workspace.leftSplit : app.workspace.rightSplit;
	const dock = split as WorkspaceSidedock;
	if (dock.collapsed) {
		dock.expand();
	}
}

/**
 * Updates sidebar visibility based on current settings.
 * Only collapses sidebars when the corresponding setting is enabled.
 * Does not expand sidebars when settings are disabled (user must do it manually).
 * Only operates when the full screen mode is active.
 * @param plugin - The EditorFullScreen plugin instance.
 */
export function updateSidebarVisibility(plugin: EditorFullScreenPlugin): void {
	if (!plugin.isActive) {
		return;
	}

	const { app, settings } = plugin;

	// Collapse left sidebar if setting is enabled
	if (settings.hideLeftSidebar) {
		collapseSidebar(app, "left");
	}

	// Collapse right sidebar if setting is enabled
	if (settings.hideRightSidebar) {
		collapseSidebar(app, "right");
	}
}
