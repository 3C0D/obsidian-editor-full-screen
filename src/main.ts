import { Plugin, Menu } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants.ts";
import type { EFSSettings } from "./types.ts";
import { Side } from "./types.ts";
import { EFSSettingTab } from "./settings.ts";
import { EFSModal } from "./modal.ts";
import { ElementManager } from "./elementManager.ts";
import { HoverDetector } from "./hoverDetector.ts";
import {
	collapseSidebar,
	expandSidebar,
	updateSidebarVisibility,
} from "./sidebarUtils.ts";

/**
 * Main plugin class for Editor Full Screen.
 * Manages the full screen mode for the Obsidian editor,
 * providing toggle functionality and element visibility control.
 */
export default class EditorFullScreen extends Plugin {
	// Tracks whether full screen mode is currently active
	isActive = false;
	settings: EFSSettings;

	private elementManager: ElementManager;
	private hoverDetector: HoverDetector;

	/**
	 * Initializes the plugin on load.
	 */
	async onload(): Promise<void> {
		await this.loadSettings();

		this.elementManager = new ElementManager();
		this.hoverDetector = new HoverDetector(this.elementManager);

		this.addSettingTab(new EFSSettingTab(this.app, this));

		this.addCommand({
			id: "efs-toggle",
			name: "Toggle full screen mode",
			callback: () => this.toggleMode(),
		});

		this.addCommand({
			id: "efs-open-modal",
			name: "Full screen: open element settings",
			callback: () => new EFSModal(this.app, this).open(),
		});

		// Context menu on right-click in editor
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu) => {
				menu.addItem((item) =>
					item
						.setTitle("Full screen settings")
						.setIcon("layout")
						.onClick(() => new EFSModal(this.app, this).open()),
				);
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.modeAtStart && this.settings.wasActive) {
				this.activateMode();
			}
		});
	}

	/**
	 * Cleans up when the plugin is unloaded.
	 */
	onunload(): void {
		if (this.isActive) this.deactivateMode();
	}

	/**
	 * Loads settings from persistent storage and merges with defaults.
	 */
	async loadSettings(): Promise<void> {
		this.settings = {
			...DEFAULT_SETTINGS,
			...(await this.loadData()),
		};
	}

	/**
	 * Saves current settings to persistent storage.
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Toggles full screen mode on or off.
	 */
	toggleMode(): void {
		if (this.isActive) {
			this.deactivateMode();
		} else {
			this.activateMode();
		}
		// Persist last active state so modeAtStart can restore it
		this.settings.wasActive = this.isActive;
		this.saveSettings();
	}

	/**
	 * Activates full screen mode by hiding UI elements and setting up hover detection.
	 */
	activateMode(): void {
		this.isActive = true;
		this.elementManager.setActiveKeys(this.buildActiveKeys());

		// Collapse sidebars if enabled in settings
		if (this.settings.hideLeftSidebar) {
			collapseSidebar(this.app, "left");
		}
		if (this.settings.hideRightSidebar) {
			collapseSidebar(this.app, "right");
		}

		// Set up callbacks for sidebar expand/collapse on hover
		this.hoverDetector.onSideReveal = (side: Side): void => {
			if (side === Side.left && this.settings.hideLeftSidebar) {
				expandSidebar(this.app, "left");
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				expandSidebar(this.app, "right");
			}
		};
		this.hoverDetector.onSideHide = (side: Side): void => {
			if (
				side === Side.left &&
				this.settings.hideLeftSidebar &&
				this.hoverDetector.sidesHave(Side.left)
			) {
				collapseSidebar(this.app, "left");
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				collapseSidebar(this.app, "right");
			}
		};

		this.elementManager.hideAll();
		document.body.classList.add("efs-active");
		this.hoverDetector.start();
	}

	/**
	 * Deactivates full screen mode by restoring UI elements and stopping hover detection.
	 */
	deactivateMode(): void {
		this.isActive = false;
		this.hoverDetector.stop();

		// Clear callbacks
		this.hoverDetector.onSideReveal = null;
		this.hoverDetector.onSideHide = null;

		// Restore sidebars on deactivate
		if (this.settings.hideLeftSidebar) {
			expandSidebar(this.app, "left");
		}
		if (this.settings.hideRightSidebar) {
			expandSidebar(this.app, "right");
		}

		this.elementManager.showAll();
		document.body.classList.remove("efs-active");
	}

	/**
	 * Reapplies the current mode after settings changes.
	 * Shows all elements first so removed ones become visible again.
	 */
	reapplyMode(): void {
		this.elementManager.showAll();
		this.elementManager.setActiveKeys(this.buildActiveKeys());
		this.elementManager.hideAll();

		// Update sidebar visibility based on current settings
		updateSidebarVisibility(this);
	}

	/**
	 * Builds the list of element keys to manage based on current settings.
	 * @returns Array of element keys to hide in full screen mode.
	 */
	private buildActiveKeys(): string[] {
		const keys: string[] = [];
		if (this.settings.hideTopBar) keys.push("tabHeader", "titleBar");
		if (this.settings.hideRibbon) keys.push("ribbon", "leftToggleBtn");
		if (this.settings.hideViewHeader) keys.push("viewHeader");
		if (this.settings.hideStatusBar) keys.push("statusBar");
		// leftSidebar is handled via API in activateMode/deactivateMode, not via elementManager
		return keys;
	}
}
