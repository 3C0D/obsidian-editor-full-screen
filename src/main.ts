import { Plugin, Menu, WorkspaceSidedock } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants.ts";
import type { EFSSettings } from "./types.ts";
import { EFSSettingTab } from "./settings.ts";
import { EFSModal } from "./modal.ts";
import { ElementManager } from "./elementManager.ts";
import { HoverDetector } from "./hoverDetector.ts";

export default class EditorFullScreen extends Plugin {
	isActive = false;
	settings: EFSSettings;

	private elementManager: ElementManager;
	private hoverDetector: HoverDetector;
	private leftSidebarWasOpen = false;

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
			if (this.settings.modeAtStart) this.activateMode();
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
		this.isActive ? this.deactivateMode() : this.activateMode();
	}

	activateMode(): void {
		this.isActive = true;
		this.elementManager.setActiveKeys(this.buildActiveKeys());

		// Collapse left sidebar via API if enabled in settings
		if (this.settings.hideLeftSidebar) {
			const left = (this.app.workspace as any)
				.leftSplit as WorkspaceSidedock;
			this.leftSidebarWasOpen = !left.collapsed;
			if (this.leftSidebarWasOpen) left.collapse();
		}

		this.elementManager.hideAll();
		document.body.classList.add("efs-active");
		this.hoverDetector.start();
	}

	deactivateMode(): void {
		this.isActive = false;
		this.hoverDetector.stop();

		// Restore left sidebar to its previous state
		if (this.settings.hideLeftSidebar && this.leftSidebarWasOpen) {
			const left = (this.app.workspace as any)
				.leftSplit as WorkspaceSidedock;
			left.expand();
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
		if (this.settings.hideRibbon) keys.push("ribbon");
		if (this.settings.hideViewHeader) keys.push("viewHeader");
		if (this.settings.hideStatusBar) keys.push("statusBar");
		// leftSidebar is handled via API in activateMode/deactivateMode, not via elementManager
		return keys;
	}
}
