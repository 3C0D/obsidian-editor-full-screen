import { Menu } from 'obsidian';
import type EditorFullScreen from './main.ts';
import { EFSModal } from './modal.ts';

/**
 * Registers all context menus for the plugin.
 * Handles both editor context menu and reading mode context menu.
 */
export function registerMenus(plugin: EditorFullScreen): void {
	// Editor context menu (right-click in edit mode)
	plugin.registerEvent(
		plugin.app.workspace.on('editor-menu', (menu: Menu) => {
			addEditorMenuItems(plugin, menu);
		})
	);

	// Reading mode context menu (right-click in reading mode)
	plugin.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		// Only in reading mode, and no text selected
		if (!target.closest('.markdown-reading-view')) return;
		if (window.getSelection()?.toString()) return;

		e.preventDefault();
		const menu = new Menu();
		addReadingModeMenuItems(plugin, menu);
		menu.showAtMouseEvent(e);
	});
}

/**
 * Adds menu items to the editor context menu (edit mode right-click).
 * Provides toggle full screen and settings options.
 */
export function addEditorMenuItems(plugin: EditorFullScreen, menu: Menu): void {
	menu.addItem(item => {
		item.setTitle('Full screen').setIcon('expand');

		const sub = (item as any).setSubmenu();
		sub.addItem((i: any) =>
			i
				.setTitle('Toggle')
				.setIcon('expand')
				.onClick(() => plugin.toggleMode())
		);
		sub.addItem((i: any) =>
			i
				.setTitle('Settings')
				.setIcon('layout')
				.onClick(() => new EFSModal(plugin.app, plugin).open())
		);
	});
}

/**
 * Adds menu items to the reading mode context menu.
 * Provides toggle full screen and settings options when right-clicking
 * in reading mode without text selection.
 */
export function addReadingModeMenuItems(plugin: EditorFullScreen, menu: Menu): void {
	menu.addItem(item =>
		item
			.setTitle('Toggle full screen')
			.setIcon('expand')
			.onClick(() => plugin.toggleMode())
	);
	menu.addItem(item =>
		item
			.setTitle('Configure hidden elements')
			.setIcon('layout')
			.onClick(() => new EFSModal(plugin.app, plugin).open())
	);
}
