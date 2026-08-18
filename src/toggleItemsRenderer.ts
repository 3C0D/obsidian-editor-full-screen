import type { ToggleComponent } from 'obsidian';
import { Setting } from 'obsidian';
import type { EditorFullScreenPlugin } from './types.ts';
import { TOGGLE_ITEMS } from './constants.ts';

/**
 * Renders the shared TOGGLE_ITEMS list into a container (modal or settings tab),
 * wiring up the hideLeftSidebar → hideRibbon forcing rule and live reapply.
 */
export function renderToggleItems(
  containerEl: HTMLElement,
  plugin: EditorFullScreenPlugin
): void {
  let ribbonToggle: ToggleComponent | null = null;

  TOGGLE_ITEMS.forEach(({ key, label, desc }) => {
    new Setting(containerEl)
      .setName(label)
      .setDesc(desc)
      .addToggle((toggle) => {
        if (key === 'hideRibbon') ribbonToggle = toggle;
        toggle.setValue(plugin.settings[key]).onChange(async (value) => {
          plugin.settings[key] = value;

          // Enabling hide left sidebar forces hide ribbon on
          if (key === 'hideLeftSidebar' && value) {
            plugin.settings.hideRibbon = true;
            ribbonToggle?.setValue(true);
          }

          await plugin.saveSettings();

          if (plugin.isFullScreen) {
            plugin.reapplyMode();
          }
        });
      });
  });
}