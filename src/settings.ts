import { PluginSettingTab, App, Setting } from "obsidian";
import type { EditorFullScreenPlugin } from "./types.ts";

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

		const items = [
			{
				key: "hideTopBar" as const,
				label: "Top bar",
				desc: "Title bar + tab strip",
			},
			{
				key: "hideViewHeader" as const,
				label: "View header",
				desc: "File title bar inside the editor pane",
			},
			{
				key: "hideLeftSidebar" as const,
				label: "Left sidebar",
				desc: "Toggles on ribbon hover, closes on editor return",
			},
			{
				key: "hideRightSidebar" as const,
				label: "Right sidebar",
				desc: "Shift + hover right edge to toggle",
			},
			{
				key: "hideRibbon" as const,
				label: "Ribbon",
				desc: "Left icon ribbon",
			},
			{
				key: "hideStatusBar" as const,
				label: "Status bar",
				desc: "Bottom status bar",
			},
		];

		items.forEach(({ key, label, desc }) => {
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
						}),
				);
		});
	}
}
