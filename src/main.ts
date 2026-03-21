import { Plugin, WorkspaceWindow } from 'obsidian';
import { DEFAULT_SETTINGS } from './constants.ts';
import type { EFSSettings } from './types.ts';
import { Side } from './types.ts';
import { EFSSettingTab } from './settings.ts';
import { EFSModal } from './modal.ts';
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

	private hoverDetector: HoverDetector;

	// Sidebar state saved before activation
	private leftWasCollapsed = false;
	private rightWasCollapsed = false;

	// Track popout window documents for multi-window support
	private popoutDocs = new Set<Document>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.hoverDetector = new HoverDetector();

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

		// Save sidebar state before collapsing
		const leftDock = this.app.workspace.leftSplit as
			import('obsidian').WorkspaceSidedock;
		const rightDock = this.app.workspace.rightSplit as
			import('obsidian').WorkspaceSidedock;
		this.leftWasCollapsed = leftDock.collapsed;
		this.rightWasCollapsed = rightDock.collapsed;

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
			if (side === Side.left && this.settings.hideLeftSidebar) {
				collapseSidebar(this.app, 'left');
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				collapseSidebar(this.app, 'right');
			}
		};

		// CSS-based toggle sets
		document.body.classList.add('efs-active');
		
		this.applyBodyClasses();

		this.hoverDetector.viewHeaderEnabled =
			this.settings.hideViewHeader;
		this.hoverDetector.topBarEnabled =
			this.settings.hideTopBar;
		this.hoverDetector.ribbonEnabled =
			this.settings.hideRibbon;
		this.hoverDetector.statusBarEnabled =
			this.settings.hideStatusBar;
		this.hoverDetector.leftSidebarEnabled =
			this.settings.hideLeftSidebar;
		this.hoverDetector.rightSidebarEnabled =
			this.settings.hideRightSidebar;

		this.hoverDetector.start();

		// Apply body classes to all windows
		this.applyBodyClasses();

		// Set up existing popout windows
		this.app.workspace.iterateAllLeaves(leaf => {
			const doc =
				leaf.view?.containerEl?.ownerDocument;
			if (doc && doc !== document) {
				this.registerPopout(doc);
			}
		});

		// Track future popout windows
		this.registerEvent(
			this.app.workspace.on(
				'window-open',
				(win: WorkspaceWindow) => {
					const w = win.getContainer();
					const doc = (w as unknown as Window)
						?.document;
					if (doc) this.registerPopout(doc);
				}
			)
		);
		this.registerEvent(
			this.app.workspace.on(
				'window-close',
				(win: WorkspaceWindow) => {
					const w = win.getContainer();
					const doc = (w as unknown as Window)
						?.document;
					if (doc) this.unregisterPopout(doc);
				}
			)
		);
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

		// Restore sidebars to pre-activation state
		if (
			this.settings.hideLeftSidebar &&
			!this.leftWasCollapsed
		) {
			expandSidebar(this.app, 'left');
		}
		if (
			this.settings.hideRightSidebar &&
			!this.rightWasCollapsed
		) {
			expandSidebar(this.app, 'right');
		}

		// Remove body classes from all windows
		this.removeBodyClasses(document);
		this.popoutDocs.forEach(doc => {
			this.removeBodyClasses(doc);
			this.hoverDetector.removeDocument(doc);
		});
		this.popoutDocs.clear();
	}

	/**
	 * Reapplies the current mode after settings changes.
	 * Shows all elements first so removed ones become visible again.
	 */
	reapplyMode(): void {
		// Update flags and body classes
		this.applyBodyClasses();
		
		this.hoverDetector.viewHeaderEnabled =
			this.settings.hideViewHeader;
		this.hoverDetector.topBarEnabled =
			this.settings.hideTopBar;
		this.hoverDetector.ribbonEnabled =
			this.settings.hideRibbon;
		this.hoverDetector.statusBarEnabled =
			this.settings.hideStatusBar;
		this.hoverDetector.leftSidebarEnabled =
			this.settings.hideLeftSidebar;
		this.hoverDetector.rightSidebarEnabled =
			this.settings.hideRightSidebar;

		// Update sidebar visibility based on current settings
		updateSidebarVisibility(this);
	}



	/** Registers a popout window for full-screen management. */
	private registerPopout(doc: Document): void {
		if (this.popoutDocs.has(doc)) return;
		this.popoutDocs.add(doc);
		this.applyBodyClasses(doc);
		this.hoverDetector.addDocument(doc);
	}

	/** Unregisters a popout window. */
	private unregisterPopout(doc: Document): void {
		this.removeBodyClasses(doc);
		this.hoverDetector.removeDocument(doc);
		this.popoutDocs.delete(doc);
	}

	/** Applies relevant CSS body classes to a document. */
	private applyBodyClasses(
		doc: Document = document
	): void {
		doc.body.classList.add('efs-active');
		
		// Reset all managed classes first to handle reapplyMode state changes
		this.removeBodyClasses(doc, true);
		
		if (this.settings.hideTopBar)
			doc.body.classList.add('efs-hide-topbar');
		if (this.settings.hideViewHeader)
			doc.body.classList.add('efs-hide-viewheader');
		if (this.settings.hideRibbon) {
			doc.body.classList.add('efs-hide-ribbon');
			if (this.settings.hideTopBar) {
				doc.body.classList.add('efs-hide-lefttogglebtn');
			}
		}
		if (this.settings.hideStatusBar)
			doc.body.classList.add('efs-hide-statusbar');
	}

	/** Removes CSS body classes from a document. */
	private removeBodyClasses(doc: Document, keepActive: boolean = false): void {
		if (!keepActive) doc.body.classList.remove('efs-active');
		doc.body.classList.remove(
			'efs-hide-topbar',
			'efs-hide-viewheader',
			'efs-hide-ribbon',
			'efs-hide-lefttogglebtn',
			'efs-hide-statusbar'
		);
	}
}
