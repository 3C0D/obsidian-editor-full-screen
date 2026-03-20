import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS } from './constants.ts';
import type { EFSSettings } from './types.ts';
import { Side } from './types.ts';
import { EFSSettingTab } from './settings.ts';
import { EFSModal } from './modal.ts';
import { ElementManager } from './elementManager.ts';
import { HoverDetector } from './hoverDetector.ts';
import { collapseSidebar, expandSidebar, updateSidebarVisibility } from './sidebarUtils.ts';
import { registerMenus } from './menuManager.ts';

/**
 * Main plugin class for Editor Full Screen.
 * Manages the full screen mode for the Obsidian editor,
 * providing toggle functionality and element visibility control.
 */
export default class EditorFullScreen extends Plugin {
	isFullScreen = false;
	settings: EFSSettings;

	private elementManager: ElementManager;
	private hoverDetector: HoverDetector;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.elementManager = new ElementManager();
		this.hoverDetector = new HoverDetector(this.elementManager);

		this.addSettingTab(new EFSSettingTab(this.app, this));

		this.addCommand({
			id: 'efs-toggle',
			name: 'Toggle full screen mode',
			callback: () => this.toggleMode(),
		});

		this.addCommand({
			id: 'efs-open-modal',
			name: 'Configure hidden elements',
			callback: () => new EFSModal(this.app, this).open(),
		});

		// Register context menus
		registerMenus(this);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.modeAtStart && this.settings.lastFullScreen) {
				this.activateMode();
			}
		});
	}

	onunload(): void {
		if (this.isFullScreen) this.deactivateMode();
	}

	async loadSettings(): Promise<void> {
		this.settings = {
			...DEFAULT_SETTINGS,
			...(await this.loadData()),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Toggles full screen mode on or off.
	 */
	toggleMode(): void {
		if (this.isFullScreen) {
			this.deactivateMode();
		} else {
			this.activateMode();
		}
		// Persist last active state so modeAtStart can restore it
		this.settings.lastFullScreen = this.isFullScreen;
		this.saveSettings();
	}

	/**
	 * Activates full screen mode by hiding UI elements and setting up hover detection.
	 */
	activateMode(): void {
		this.isFullScreen = true;
		this.elementManager.setManagedKeys(this.buildManagedKeys());

		// Collapse sidebars if enabled in settings
		if (this.settings.hideLeftSidebar) {
			collapseSidebar(this.app, 'left');
		}
		if (this.settings.hideRightSidebar) {
			collapseSidebar(this.app, 'right');
		}

		// Set up callbacks for sidebar expand/collapse on hover
		this.hoverDetector.onSideReveal = (side: Side): void => {
			if (side === Side.left && this.settings.hideLeftSidebar) {
				expandSidebar(this.app, 'left');
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				expandSidebar(this.app, 'right');
			}
		};
		this.hoverDetector.onSideHide = (side: Side): void => {
			if (
				side === Side.left &&
				this.settings.hideLeftSidebar &&
				this.hoverDetector.sidesHave(Side.left)
			) {
				collapseSidebar(this.app, 'left');
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				collapseSidebar(this.app, 'right');
			}
		};

		this.elementManager.hideManaged();
		document.body.classList.add('efs-active');
		this.hoverDetector.start();
	}

	/**
	 * Deactivates full screen mode by restoring UI elements and stopping hover detection.
	 */
	deactivateMode(): void {
		this.isFullScreen = false;
		this.hoverDetector.stop();

		// Clear callbacks
		this.hoverDetector.onSideReveal = null;
		this.hoverDetector.onSideHide = null;

		// Restore sidebars on deactivate
		if (this.settings.hideLeftSidebar) {
			expandSidebar(this.app, 'left');
		}
		if (this.settings.hideRightSidebar) {
			expandSidebar(this.app, 'right');
		}

		this.elementManager.showAllElements();
		document.body.classList.remove('efs-active');
	}

	/**
	 * Reapplies the current mode after settings changes.
	 * Shows all elements first so removed ones become visible again.
	 */
	reapplyMode(): void {
		this.elementManager.showAllElements();
		this.elementManager.setManagedKeys(this.buildManagedKeys());
		this.elementManager.hideManaged();

		// Update sidebar visibility based on current settings
		updateSidebarVisibility(this);
	}

	/**
	 * Builds the list of element keys to manage based on current settings.
	 * @returns Array of element keys to hide in full screen mode.
	 */
	private buildManagedKeys(): string[] {
		const keys: string[] = [];
		if (this.settings.hideTopBar) keys.push('tabHeader', 'titleBar');
		if (this.settings.hideRibbon) keys.push('ribbon', 'leftToggleBtn');
		if (this.settings.hideViewHeader) keys.push('viewHeader');
		if (this.settings.hideStatusBar) keys.push('statusBar');
		// leftSidebar is handled via API in activateMode/deactivateMode, not via elementManager
		return keys;
	}
}
