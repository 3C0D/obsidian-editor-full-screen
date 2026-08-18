import type { App } from 'obsidian';
import { PluginSettingTab, Setting } from 'obsidian';
import type { EditorFullScreenPlugin } from './types.ts';
import { renderToggleItems } from './toggleItemsRenderer.ts';

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
      .setName('Persistent full screen')
      .setDesc(
        'Restore full screen mode on restart if it was active when Obsidian closed'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.modeAtStart).onChange(async (value) => {
          this.plugin.settings.modeAtStart = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl('h3', { text: 'Elements to hide' });

    renderToggleItems(containerEl, this.plugin);
  }
}
