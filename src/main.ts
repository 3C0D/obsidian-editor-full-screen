import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, EFSSettingTab, type EFSSettings } from "./settings.ts";

enum Shown {
	left,
	right,
	bottom,
	top,
	null
}

interface ElementConfig {
	selector: string;
	side: Shown;
	threshold: number;
}

export default class EditorFullScreen extends Plugin {
	isActive = false;
	isZenMode = false;
	shown: Shown = Shown.null;
	hovered: Element | null = null;
	settings: EFSSettings;

	elementsToToggle: { [key: string]: ElementConfig } = {
		ribbon: { selector: ".workspace-ribbon", side: Shown.left, threshold: 20 },
		header: { selector: ".mod-root .workspace-tabs .workspace-tab-header-container", side: Shown.top, threshold: 20 },
		viewHeader: { selector: ".mod-root .workspace-leaf-content > .view-header", side: Shown.top, threshold: 20 },
		titleBar: { selector: ".titlebar", side: Shown.top, threshold: 20 },
		statusBar: { selector: ".status-bar", side: Shown.bottom, threshold: 20 }
	};

	commonElements = ["ribbon", "header", "titleBar"];
	fullscreenElements = ["viewHeader", "statusBar"];

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new EFSSettingTab(this.app, this));
		this.addCommand({
			id: "editor-full-screen",
			name: "Full screen mode",
			callback: () => this.toggleMode(false)
		});
		this.addCommand({
			id: "editor-zen-mode",
			name: "Zen mode",
			callback: () => this.toggleMode(true),
		});
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.modeAtStart !== 'normal') {
				this.activateMode(this.settings.modeAtStart === 'zen');
			}
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	toggleMode(zen: boolean): void {
		if (this.isActive) {
			this.deactivateMode();
		} else {
			this.activateMode(zen);
		}
	}

	activateMode(zen: boolean): void {
		this.isActive = true;
		this.isZenMode = zen;
		const elementsToHide = [...this.commonElements, ...(zen ? [] : this.fullscreenElements)];
		this.toggleElements(elementsToHide, true);
		document.body.classList.add(zen ? 'zen-mode' : 'full-screen-mode');
		document.addEventListener("mousemove", this.handleMouseMove);
	}

	deactivateMode(): void {
		this.isActive = false;
		this.isZenMode = false;
		const allElements = [...this.commonElements, ...this.fullscreenElements];
		this.toggleElements(allElements, false);
		document.body.classList.remove('zen-mode', 'full-screen-mode');
		document.removeEventListener("mousemove", this.handleMouseMove);
		this.shown = Shown.null;
		this.hovered = null;
	}

	toggleElements(elementKeys: string[], hide: boolean): void {
		elementKeys.forEach(key => {
			const element = document.querySelector(this.elementsToToggle[key].selector);
			if (element) {
				element.classList.toggle('hide-el', hide);
			}
		});
	}

	handleMouseMove = (e: MouseEvent): void => {
		if (!this.isActive) return;
	
		const elementsToCheck = [...this.commonElements, ...(this.isZenMode ? [] : this.fullscreenElements)];
	
		if (this.isMouseNearEdge(e, 20)) {
			// Show elements when mouse is near the edge
			for (const key of elementsToCheck) {
				const config = this.elementsToToggle[key];
				const element = document.querySelector(config.selector) as HTMLElement;
				if (!element) continue;
				
				if (this.isNearSide(e, config.side, config.threshold)) {
					if (config.side === Shown.top) {
						// Special handling for top elements: show all top elements together
						elementsToCheck.forEach(k => {
							const el = document.querySelector(this.elementsToToggle[k].selector) as HTMLElement;
							if (el && this.elementsToToggle[k].side === Shown.top) {
								el.classList.remove('hide-el');
							}
						});
					} else {
						element.classList.remove('hide-el');
					}
					this.shown = config.side;
					this.hovered = element;
				}
			}
		} else if (this.shown !== Shown.null){
			// Performance optimization: Only check for hiding elements when returning from an edge
			const topElements = elementsToCheck.filter(key => this.elementsToToggle[key].side === Shown.top);
			const otherElements = elementsToCheck.filter(key => this.elementsToToggle[key].side !== Shown.top);
			
			// Handle top elements together
			if (this.shown === Shown.top) {
				const topRect = this.getCombinedRect(topElements);
				if (this.isMouseOutsideElement(e, Shown.top, topRect)) {
					topElements.forEach(key => {
						const element = document.querySelector(this.elementsToToggle[key].selector) as HTMLElement;
						if (element) element.classList.add('hide-el');
					});
					this.shown = Shown.null;
					this.hovered = null;
				}
			}
			
			// Handle other elements individually
			otherElements.forEach(key => {
				const config = this.elementsToToggle[key];
				const element = document.querySelector(config.selector) as HTMLElement;
				if (!element || element.classList.contains('hide-el')) return;
	
				const rect = element.getBoundingClientRect();
				if (this.isMouseOutsideElement(e, config.side, rect)) {
					element.classList.add('hide-el');
					if (this.hovered === element) {
						this.shown = Shown.null;
						this.hovered = null;
					}
				}
			});
		}
	};
	
	// New helper method to get combined rectangle of top elements
	getCombinedRect(topElementKeys: string[]): DOMRect {
		let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
		topElementKeys.forEach(key => {
			const element = document.querySelector(this.elementsToToggle[key].selector) as HTMLElement;
			if (element) {
				const rect = element.getBoundingClientRect();
				left = Math.min(left, rect.left);
				top = Math.min(top, rect.top);
				right = Math.max(right, rect.right);
				bottom = Math.max(bottom, rect.bottom);
			}
		});
		return new DOMRect(left, top, right - left, bottom - top);
	}

	isNearSide(e: MouseEvent, side: Shown, threshold: number): boolean {
		switch (side) {
			case Shown.left: return e.clientX <= threshold;
			case Shown.right: return e.clientX >= window.innerWidth - threshold;
			case Shown.top: return e.clientY <= threshold;
			case Shown.bottom: return e.clientY >= window.innerHeight - threshold;
			default: return false;
		}
	}

	isMouseNearEdge(e: MouseEvent, threshold: number): boolean {
		return e.clientX <= threshold || e.clientX >= window.innerWidth - threshold || e.clientY <= threshold || e.clientY >= window.innerHeight - threshold;
	}

	isMouseOutsideElement(e: MouseEvent, side: Shown, rect: DOMRect): boolean {
		switch (side) {
			case Shown.left: return e.clientX > rect.width;
			case Shown.right: return e.clientX < rect.left;
			case Shown.top: return e.clientY > rect.height;
			case Shown.bottom: return e.clientY < rect.top;
			default: return false;
		}
	}
}