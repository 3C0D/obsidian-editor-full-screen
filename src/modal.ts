import { Modal, App, Setting } from "obsidian";
import type { EditorFullScreenPlugin } from "./types.ts";
import { TOGGLE_ITEMS } from "./constants.ts";

/**
 * Modal for configuring which elements to hide in full screen mode.
 */
export class EFSModal extends Modal {
	/**
	 * @param app - The Obsidian app instance.
	 * @param plugin - The EditorFullScreen plugin instance.
	 */
	constructor(
		app: App,
		private plugin: EditorFullScreenPlugin,
	) {
		super(app);
	}

	/**
	 * Called when the modal is opened.
	 */
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

	/**
	 * Called when the modal is closed.
	 */
	onClose(): void {
		this.contentEl.empty();
	}
}
