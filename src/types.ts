import type { Plugin, Menu, MenuItem } from 'obsidian';

/** Keys for boolean settings in EFSSettings. */
export type BooleanSettingKey =
  | 'hideRibbon'
  | 'hideTopBar'
  | 'hideViewHeader'
  | 'hideStatusBar'
  | 'hideLeftSidebar'
  | 'hideRightSidebar';

/** Configuration for a toggle setting item. */
export interface ToggleItem {
  key: BooleanSettingKey;
  label: string;
  desc: string;
}

/**
 * Shared menu key for reading mode context menu.
 * Multiple plugins can add items to the same menu using this convention.
 */
export const SHARED_READING_MENU_KEY = '_sharedReadingMenu' as const;

/**
 * Extended MenuItem type exposing the undocumented submenu API.
 * Not part of the official Obsidian type definitions.
 */
export interface MenuItemWithSubmenu extends MenuItem {
  setSubmenu(): Menu;
}

/**
 * Window augmented with the shared reading menu key,
 * used to coordinate context menu contributions across plugins.
 */
export type SharedMenuWindow = Window & {
  [SHARED_READING_MENU_KEY]?: Menu;
};

/** Which viewport edge an element is anchored to. */
export enum Side {
  left,
  right,
  bottom,
  top,
  none
}

export interface EFSSettings {
  modeAtStart: boolean;
  // Tracks last active state for modeAtStart restoration.
  lastFullScreen: boolean;
  hideRibbon: boolean;
  // Controls tab-header-container + titlebar.
  hideTopBar: boolean;
  hideViewHeader: boolean;
  hideStatusBar: boolean;
  hideLeftSidebar: boolean;
  hideRightSidebar: boolean;
}

export interface EditorFullScreenPlugin extends Plugin {
  isFullScreen: boolean;
  settings: EFSSettings;
  saveSettings(): Promise<void>;
  reapplyMode(): void;
}
