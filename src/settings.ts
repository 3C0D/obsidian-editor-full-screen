import { PluginSettingTab, App, Setting } from "obsidian";
import type { EditorFullScreenPlugin } from "./pluginType.ts";

export class EFSSettingTab extends PluginSettingTab {
	plugin: EditorFullScreenPlugin;

	constructor(app: App, plugin: EditorFullScreenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Activate on start")
			.setDesc(
				"Automatically enable full screen mode when Obsidian starts",
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
				key: "hideRibbon" as const,
				label: "Ribbon",
				desc: "Left icon ribbon",
			},
			{
				key: "hideStatusBar" as const,
				label: "Status bar",
				desc: "Bottom status bar",
			},
			{
				key: "hideLeftSidebar" as const,
				label: "Left sidebar",
				desc: "File explorer, search, etc. Also forces ribbon hiding",
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
