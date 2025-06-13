import { PluginSettingTab, App, Setting } from "obsidian";
import EditorFullScreen from "./main.ts";

export interface EFSSettings {
    modeAtStart: 'normal' | 'zen' | 'full';
}

export const DEFAULT_SETTINGS: EFSSettings = {
    modeAtStart: 'normal',
};

export class EFSSettingTab extends PluginSettingTab {
    constructor(app: App, public plugin: EditorFullScreen) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Mode at start')
            .setDesc('Choose which mode to activate when Obsidian starts')
            .addDropdown(dropdown => dropdown
                .addOption('normal', 'Normal')
                .addOption('zen', 'Zen')
                .addOption('full', 'Full Screen')
                .setValue(this.plugin.settings.modeAtStart)
                .onChange(async (value) => {
                    this.plugin.settings.modeAtStart = value as EFSSettings['modeAtStart'];
                    await this.plugin.saveSettings();
                    
                    // Apply the new mode immediately
                    if (value !== 'normal') {
                        this.plugin.toggleMode(value === 'zen');
                    } else if (this.plugin.isActive) {
                        this.plugin.toggleMode(this.plugin.isZenMode);
                    }
                }));
    }
}