import { PluginSettingTab, App, Setting } from "obsidian";
import type { EditorFullScreenPlugin } from "./types.ts";
import { TOGGLE_ITEMS } from "./constants.ts";

/**
 * Settings tab for the Editor Full Screen plugin.
 * Provides UI for configuring full screen mode persistence and default behaviors.
 */
export class EFSSettingTab extends PluginSettingTab {
	plugin: EditorFullScreenPlugin;

	/**
	 * @param app - The Obsidian app instance.
	 * @param plugin - The EditorFullScreen plugin instance.
	 */
	constructor(app: App, plugin: EditorFullScreenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Renders the settings UI.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Persistent full screen")
			.setDesc(
				"Restore full screen mode on restart if it was active when Obsidian closed",
			)
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.modeAtStart)
					.onChange(async (v) => {
						this.plugin.settings.modeAtStart = v;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "Elements to hide" });

		TOGGLE_ITEMS.forEach(({ key, label, desc }) => {
			new Setting(containerEl)
				.setName(label)
				.setDesc(desc)
				.addToggle((t) =>
					t
						.setValue(this.plugin.settings[key])
						.onChange(async (v) => {
							this.plugin.settings[key] = v;
							if (key === "hideLeftSidebar" && v) {
								this.plugin.settings.hideRibbon = true;
							}
							await this.plugin.saveSettings();
							this.display(); // refresh to show auto-changes

							if (this.plugin.isActive) {
								this.plugin.reapplyMode();
							}
						}),
				);
		});
	}
}
