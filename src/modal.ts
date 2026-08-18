import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';
import type { EditorFullScreenPlugin } from './types.ts';
import { renderToggleItems } from './toggleItemsRenderer.ts';

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
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Full Screen — Elements' });

    renderToggleItems(contentEl, this.plugin);

    new Setting(contentEl).addButton((btn) =>
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
