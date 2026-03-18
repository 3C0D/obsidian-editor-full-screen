import { PluginSettingTab, App, Setting, ToggleComponent } from 'obsidian';
import type { EditorFullScreenPlugin } from './types.ts';
import { TOGGLE_ITEMS } from './constants.ts';

export class EFSSettingTab extends PluginSettingTab {
	plugin: EditorFullScreenPlugin;

	constructor(app: App, plugin: EditorFullScreenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let ribbonToggle: ToggleComponent | null = null;
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Persistent full screen')
			.setDesc('Restore full screen mode on restart if it was active when Obsidian closed')
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.modeAtStart).onChange(async value => {
					this.plugin.settings.modeAtStart = value;
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl('h3', { text: 'Elements to hide' });

		TOGGLE_ITEMS.forEach(({ key, label, desc }) => {
			new Setting(containerEl)
				.setName(label)
				.setDesc(desc)
				.addToggle(toggle => {
					if (key === 'hideRibbon') ribbonToggle = toggle;
					toggle.setValue(this.plugin.settings[key]).onChange(async value => {
						this.plugin.settings[key] = value;
						if (key === 'hideLeftSidebar' && value) {
							// Also hide the ribbon
							this.plugin.settings.hideRibbon = true;
							ribbonToggle?.setValue(true);
						}
						await this.plugin.saveSettings();

						if (this.plugin.isFullScreen) {
							this.plugin.reapplyMode();
						}
					});
				});
		});
	}
}
