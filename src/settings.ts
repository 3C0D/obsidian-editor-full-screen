import { PluginSettingTab, App, Setting } from "obsidian";
import EditorFullScreen from "./main";


export const DEFAULT_SETTINGS: EFSSettings = {
    hideStatusBar: true,
    modeAtStart: 'normal',
}

export interface EFSSettings {
    hideStatusBar: boolean
    modeAtStart: 'normal' | 'zen' | 'full'
}

export class EFSSettingTab extends PluginSettingTab {
    plugin: EditorFullScreen;

    constructor(app: App, plugin: EditorFullScreen) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Hide status bar in full screen')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.hideStatusBar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Mode at start & after this change')
            .addDropdown(dropdown => dropdown
                .addOption('normal', 'Normal')
                .addOption('zen', 'Zen')
                .addOption('full', 'Full')
                .setValue(this.plugin.settings.modeAtStart)
                .onChange(async (value) => {
                    const mode = value
                    if (mode === 'normal') this.plugin.toggleMode()
                    else {
                        const prev = this.plugin.settings.modeAtStart
                        if (prev === 'normal') this.plugin.toggleMode(true)
                        else {
                            this.plugin.toggleMode(mode === 'zen')
                            this.plugin.toggleMode(mode === 'zen')
                        }
                    }

                    this.plugin.settings.modeAtStart = value as EFSSettings['modeAtStart'];
                    await this.plugin.saveSettings();
                }));
    }
}