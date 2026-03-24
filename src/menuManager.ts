import { Menu } from 'obsidian';
import type EditorFullScreen from './main.ts';
import { EFSModal } from './modal.ts';

/**
 * Shared menu key for reading mode context menu.
 * Multiple plugins can add items to the same menu using this convention.
 */
const SHARED_READING_MENU_KEY = '_sharedReadingMenu';

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
	// Uses shared menu pattern to allow multiple plugins to add items
	plugin.app.workspace.onLayoutReady(() => {
		plugin.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest('.markdown-reading-view')) return;
			if (window.getSelection()?.toString()) return;

			e.preventDefault();
			const w = window as any;

			if (w[SHARED_READING_MENU_KEY]) {
				addReadingModeMenuItems(plugin, w[SHARED_READING_MENU_KEY]);
				return;
			}

			w[SHARED_READING_MENU_KEY] = new Menu();
			setTimeout(() => {
				const menu = w[SHARED_READING_MENU_KEY];
				delete w[SHARED_READING_MENU_KEY];
				menu.showAtMouseEvent(e);
			}, 0);

			addReadingModeMenuItems(plugin, w[SHARED_READING_MENU_KEY]);
		});
	});

	// Non-editor views context menu (canvas, graph, etc.)
	// Shows menu for any view that is not a markdown reading view or editor
	plugin.app.workspace.onLayoutReady(() => {
		plugin.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest('.markdown-reading-view')) return;
			if (target.closest('.cm-editor')) return;

			const menu = new Menu();
			addReadingModeMenuItems(plugin, menu);
			menu.showAtPosition({ x: e.clientX - 220, y: e.clientY });
		});
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
