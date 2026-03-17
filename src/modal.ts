import { Modal, App, Setting } from "obsidian";
import type { EditorFullScreenPlugin } from "./pluginType.ts";

type BooleanSettingKey =
	| "hideRibbon"
	| "hideTopBar"
	| "hideViewHeader"
	| "hideStatusBar"
	| "hideLeftSidebar";

interface ToggleItem {
	key: BooleanSettingKey;
	label: string;
	desc: string;
}

const TOGGLE_ITEMS: ToggleItem[] = [
	{ key: "hideTopBar", label: "Top bar", desc: "Title bar + tab strip" },
	{
		key: "hideViewHeader",
		label: "View header",
		desc: "File title bar inside the editor pane",
	},
	{
		key: "hideRibbon",
		label: "Ribbon",
		desc: "Left icon ribbon (auto-enabled with left sidebar)",
	},
	{ key: "hideStatusBar", label: "Status bar", desc: "Bottom status bar" },
	{
		key: "hideLeftSidebar",
		label: "Left sidebar",
		desc: "File explorer, search, etc. Also enables ribbon hiding",
	},
];

export class EFSModal extends Modal {
	constructor(
		app: App,
		private plugin: EditorFullScreenPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Full Screen — Elements" });

		TOGGLE_ITEMS.forEach(({ key, label, desc }) => {
			new Setting(contentEl)
				.setName(label)
				.setDesc(desc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings[key])
						.onChange(async (value) => {
							this.plugin.settings[key] = value;

							// Enabling left sidebar forces ribbon on (ribbon hides the sidebar toggle button)
							if (key === "hideLeftSidebar" && value) {
								this.plugin.settings.hideRibbon = true;
								this.render(); // refresh to reflect auto-change
							}

							await this.plugin.saveSettings();

							if (this.plugin.isActive) {
								this.plugin.reapplyMode();
							}
						}),
				);
		});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Close")
				.setCta()
				.onClick(() => this.close()),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
