import type { Plugin } from "obsidian";

/** Keys for boolean settings in EFSSettings. */
export type BooleanSettingKey =
	| "hideRibbon"
	| "hideTopBar"
	| "hideViewHeader"
	| "hideStatusBar"
	| "hideLeftSidebar"
	| "hideRightSidebar";

/** Configuration for a toggle setting item. */
export interface ToggleItem {
	key: BooleanSettingKey;
	label: string;
	desc: string;
}

/** Which viewport edge an element is anchored to. */
export enum Side {
	left,
	right,
	bottom,
	top,
	none,
}

/** Configuration for a hideable UI element. */
export interface ElementConfig {
	selector: string;
	side: Side;
	// Extra px beyond element rect before triggering hide (prevents jitter).
	exitPadding: number;
}

export interface EFSSettings {
	modeAtStart: boolean;
	// Tracks last active state for modeAtStart restoration.
	wasActive: boolean;
	hideRibbon: boolean;
	// Controls tab-header-container + titlebar.
	hideTopBar: boolean;
	hideViewHeader: boolean;
	hideStatusBar: boolean;
	hideLeftSidebar: boolean;
	hideRightSidebar: boolean;
}

export interface EditorFullScreenPlugin extends Plugin {
	isActive: boolean;
	settings: EFSSettings;
	saveSettings(): Promise<void>;
	reapplyMode(): void;
}
