import { Plugin, Menu, WorkspaceSidedock } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants.ts";
import type { EFSSettings } from "./types.ts";
import { Side } from "./types.ts";
import { EFSSettingTab } from "./settings.ts";
import { EFSModal } from "./modal.ts";
import { ElementManager } from "./elementManager.ts";
import { HoverDetector } from "./hoverDetector.ts";

export default class EditorFullScreen extends Plugin {
	isActive = false;
	settings: EFSSettings;

	private elementManager: ElementManager;
	private hoverDetector: HoverDetector;

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

	onunload(): void {
		if (this.isActive) this.deactivateMode();
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

	activateMode(): void {
		this.isActive = true;
		this.elementManager.setActiveKeys(this.buildActiveKeys());

		// Collapse left sidebar via API if enabled in settings
		if (this.settings.hideLeftSidebar) {
			const left = this.app.workspace.leftSplit as WorkspaceSidedock;
			left.collapse();
		}

		// Collapse right sidebar via API if enabled in settings
		if (this.settings.hideRightSidebar) {
			const right = this.app.workspace.rightSplit as WorkspaceSidedock;
			right.collapse();
		}

		// Set up callbacks for sidebar expand/collapse on hover
		this.hoverDetector.onSideReveal = (side) => {
			if (side === Side.left && this.settings.hideLeftSidebar) {
				const left = this.app.workspace.leftSplit as WorkspaceSidedock;
				if (left.collapsed) {
					left.expand();
				}
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				const right = this.app.workspace
					.rightSplit as WorkspaceSidedock;
				if (right.collapsed) {
					right.expand();
				}
			}
		};
		this.hoverDetector.onSideHide = (side) => {
			if (
				side === Side.left &&
				this.settings.hideLeftSidebar &&
				this.hoverDetector.sidesHave(Side.left)
			) {
				const left = this.app.workspace.leftSplit as WorkspaceSidedock;
				left.collapse();
			}
			if (side === Side.right && this.settings.hideRightSidebar) {
				const right = this.app.workspace
					.rightSplit as WorkspaceSidedock;
				right.collapse();
			}
		};

		this.elementManager.hideAll();
		document.body.classList.add("efs-active");
		this.hoverDetector.start();
	}

	deactivateMode(): void {
		this.isActive = false;
		this.hoverDetector.stop();

		// Clear callbacks
		this.hoverDetector.onSideReveal = null;
		this.hoverDetector.onSideHide = null;

		// Restore left sidebar on deactivate
		if (this.settings.hideLeftSidebar) {
			const left = this.app.workspace.leftSplit as WorkspaceSidedock;
			left.expand();
		}

		// Restore right sidebar on deactivate
		if (this.settings.hideRightSidebar) {
			const right = this.app.workspace.rightSplit as WorkspaceSidedock;
			right.expand();
		}

		this.elementManager.showAll();
		document.body.classList.remove("efs-active");
	}

	// Called from modal after settings change, without full deactivate/activate cycle.
	// Must show ALL first so elements removed from activeKeys become visible again.
	reapplyMode(): void {
		this.elementManager.showAll();
		this.elementManager.setActiveKeys(this.buildActiveKeys());
		this.elementManager.hideAll();
	}

	// Build list of element keys from current settings
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
