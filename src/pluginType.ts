import type { Plugin } from "obsidian";
import type { EFSSettings } from "./types.ts";

export interface EditorFullScreenPlugin extends Plugin {
	isActive: boolean;
	settings: EFSSettings;
	app: import("obsidian").App;
	loadSettings(): Promise<void>;
	saveSettings(): Promise<void>;
	activateMode(): void;
	deactivateMode(): void;
	reapplyMode(): void;
}
