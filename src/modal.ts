import { Modal, App, Setting, ToggleComponent } from 'obsidian';
import type { EditorFullScreenPlugin } from './types.ts';
import { TOGGLE_ITEMS } from './constants.ts';

/**
 * Modal for configuring which elements to hide in full screen mode.
 */
export class EFSModal extends Modal {
	constructor(
		app: App,
		private plugin: EditorFullScreenPlugin
	) {
		super(app);
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		let ribbonToggle: ToggleComponent | null = null;
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Full Screen — Elements' });

		TOGGLE_ITEMS.forEach(({ key, label, desc }) => {
			new Setting(contentEl)
				.setName(label)
				.setDesc(desc)
				.addToggle(toggle => {
					if (key === 'hideRibbon') ribbonToggle = toggle;
					toggle.setValue(this.plugin.settings[key]).onChange(async value => {
						this.plugin.settings[key] = value;

						// Enabling hide left sidebar forces hide ribbon on
						if (key === 'hideLeftSidebar' && value) {
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

		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText('Close')
				.setCta()
				.onClick(() => this.close())
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
