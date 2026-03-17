// Which viewport edge an element is anchored to
export enum Side {
	left,
	right,
	bottom,
	top,
	none,
}

export interface ElementConfig {
	selector: string;
	side: Side;
	// Extra px beyond element rect before triggering hide (prevents jitter)
	exitPadding: number;
}

export interface EFSSettings {
	modeAtStart: boolean;
	wasActive: boolean; // tracks last active state for modeAtStart restoration
	hideRibbon: boolean;
	hideTopBar: boolean; // controls tab-header-container + titlebar
	hideViewHeader: boolean;
	hideStatusBar: boolean;
	hideLeftSidebar: boolean;
	hideRightSidebar: boolean;
}
