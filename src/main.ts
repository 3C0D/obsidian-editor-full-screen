import { Plugin, View, WorkspaceSidedock } from "obsidian";
import { DEFAULT_SETTINGS, EFSSettingTab, EFSSettings } from "./settings";

export default class EditorFullScreen extends Plugin {
	fullScreen = false;
	zen = false;
	settings: EFSSettings;
	isRightSideOpen = false;
	isLeftSideOpen = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new EFSSettingTab(this.app, this));
		this.addCommand({
			id: "editor-full-screen",
			name: "Full screen mode",
			callback: () => this.toggleMode()
		});
		this.addCommand({
			id: "editor-zen-mode",
			name: "Zen mode",
			callback: () => this.toggleMode(true),
		});
		this.app.workspace.onLayoutReady(() => {
			const mode = this.settings.modeAtStart;
			if (mode === 'normal') return
			this.toggleMode(mode === 'zen');
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	toggleMode(zen = false) {
		this.fullScreen = !this.fullScreen;
		this.zen = zen;
		const elements = getOtherEl(this);
		conditionalToggle(this, this.fullScreen, zen, elements);

		const actionsOnMove = (event: MouseEvent) => {
			onMouseMove(event, this, elements);
		}
		if (this.fullScreen) {
			document.addEventListener("mousemove", actionsOnMove);
		} else {
			document.removeEventListener("mousemove", actionsOnMove);
		}
	}
}

function conditionalToggle(plugin: EditorFullScreen, isfullscreen: boolean, zen: boolean, elements: Elements) {
	toggleSibebars(plugin, isfullscreen)
	toggleEls(isfullscreen, elements)

	const { viewHeader, titleBar, statusBar } = elements
	
	if (zen) {
		viewHeader?.classList.add('zen-mode')
	} else {
		viewHeader?.classList.toggle('hide-el', isfullscreen);
		titleBar?.classList.toggle('hide-el', isfullscreen);
		if (plugin.settings.hideStatusBar) {
			statusBar?.classList.toggle('hide-el', isfullscreen);
		}
	}
	if (!isfullscreen) {
		viewHeader?.classList.remove('zen-mode')
		viewHeader?.classList.remove('hide-el')
		titleBar?.classList.toggle('hide-el', isfullscreen);
		plugin.isRightSideOpen = false;
		plugin.isLeftSideOpen = false;
		statusBar?.classList.remove('hide-el')
	}
}

function toggleSibebars(plugin: EditorFullScreen, fullScreen: boolean) {
	if (fullScreen) {
		plugin.isLeftSideOpen = isOpen(getLeftSplit(plugin));
		plugin.isRightSideOpen = isOpen(getRightSplit(plugin));
		getLeftSplit(plugin).collapse();
		getRightSplit(plugin).collapse();
	} else {
		if (plugin.isLeftSideOpen) {
			getLeftSplit(plugin).expand();
		}
		if (plugin.isRightSideOpen) {
			getRightSplit(plugin).expand();
		}
	}
}

function toggleEls(value: boolean, elements: Elements) {
	const { ribbon, rootHeader, titleBar} = elements
	ribbon?.classList.toggle('hide-el', value);
	rootHeader?.classList.toggle('hide-el', value);
	titleBar?.classList.toggle('hide-el', value);
}

let leftEdgeThreshold = 20;
let upEdgeThreshold = 20;
const bottomEdgeThreshold = 200;
const rightEdgeThreshold = 350;
function onMouseMove(e: MouseEvent, plugin: EditorFullScreen, elements: Elements) {
	const { leafContent, ribbon, rootHeader, viewHeader, titleBar, statusBar } = elements
	if (!leafContent) return

	const xPosition = e.clientX;
	const yPosition = e.clientY;


	if (plugin.fullScreen) {
		if (ribbon && xPosition <= leftEdgeThreshold) {
			ribbon.classList.remove('hide-el');
			leftEdgeThreshold = 50
		}
		else {
			if (ribbon && !this.fullScreen) {
				ribbon.classList.add('hide-el');
			}
			leftEdgeThreshold = 15
		}
		if (yPosition <= upEdgeThreshold) {
			rootHeader?.classList.remove('hide-el');
			titleBar?.classList.remove('hide-el');
			if (!plugin.zen) {
				leafContent.classList.remove('zen-mode');
				viewHeader?.classList.remove('hide-el');
			}
			upEdgeThreshold = 140;
		} else {
			if (!plugin.zen) {
				viewHeader?.classList.add('hide-el');
				leafContent.classList.add('zen-mode');
			}
			if (rootHeader && !this.fullScreen) {
				rootHeader.classList.add('hide-el');
				titleBar?.classList.add('hide-el');
			}
			upEdgeThreshold = 20;
		}
		if (statusBar && !plugin.zen && yPosition >= (window.innerHeight - bottomEdgeThreshold) && xPosition >= (window.innerWidth - rightEdgeThreshold)) {
			statusBar.classList.remove('hide-el');
		} else {
			if (statusBar && !plugin.zen && !this.fullScreen) {
				statusBar.classList.add('hide-el');
			}
		}
	}
}

interface Elements {
	leafContent: HTMLElement | null;
	ribbon: Element | null;
	leftSplit: Element | null;
	rightSplit: Element | null;
	rootHeader: Element | null;
	titleBar: Element | null;
	workspaceLeafContent: Element | null;
	viewHeader: Element | null;
	statusBar: Element | null;
}

function getOtherEl(plugin: EditorFullScreen): Elements {
	const activeView = plugin.app.workspace.getActiveViewOfType(View)
	const leafContent = activeView?.containerEl ?? null;
	console.log("leafContent", leafContent)
	const ribbon = document.querySelector(".workspace-ribbon") ?? null;
	const leftSplit = document.querySelector(".mod-left-split") ?? null;
	const rightSplit = document.querySelector(".mod-right-split") ?? null;
	const root = document?.querySelector(".mod-root") ?? null;
	const rootHeader = root?.querySelector(".workspace-tabs .workspace-tab-header-container") ?? null;
	console.log("rootHeader", rootHeader)
	const titleBar = document?.querySelector(".titlebar") ?? null;
	console.log("titleBar", titleBar)
	const viewHeader = leafContent?.firstElementChild ?? null;
	console.log("viewHeader", viewHeader)
	const workspaceLeafContent = root?.querySelector(".workspace-leaf-content") ?? null;
	console.log("workspaceLeafContent", workspaceLeafContent)
	const statusBar = document.querySelector(".status-bar") ?? null;
	console.log("statusBar", statusBar)

	return {
		leafContent,
		ribbon,
		leftSplit,
		rightSplit,
		rootHeader,
		titleBar,
		workspaceLeafContent,
		viewHeader,
		statusBar,
	};
}

function getLeftSplit(plugin: EditorFullScreen) {
	return plugin.app.workspace.leftSplit;
}

function getRightSplit(plugin: EditorFullScreen) {
	return plugin.app.workspace.rightSplit;
}

function isOpen(side: WorkspaceSidedock) {
	return !side.collapsed
}

