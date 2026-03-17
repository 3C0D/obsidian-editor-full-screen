import { Side } from "./types.ts";
import { ELEMENT_CONFIGS } from "./constants.ts";

/**
 * Manages the visibility of UI elements in the full screen mode.
 * Handles showing/hiding elements individually or by side (left, right, top, bottom).
 * Provides utilities for computing combined bounding rects and exit padding for hover detection.
 */
export class ElementManager {
	/** Active element keys. */
	private activeKeys: string[] = [];

	// Snapshot of element heights taken before hiding, used for exit detection
	// when elements are collapsed to height:0 by CSS.
	private naturalHeights: Map<string, number> = new Map();

	/** Updates the active element keys. */
	setActiveKeys(keys: string[]): void {
		this.activeKeys = keys;
	}

	/** Returns the active element keys. */
	getActiveKeys(): string[] {
		return this.activeKeys;
	}

	/** Hides all active elements. */
	hideAll(): void {
		// Snapshot natural heights before hiding (needed for top/bottom exit detection)
		this.activeKeys.forEach((key) => {
			const el = this.getEl(key);
			if (el && !this.naturalHeights.has(key)) {
				this.naturalHeights.set(key, el.getBoundingClientRect().height);
			}
		});
		this.activeKeys.forEach((key) => this.hide(key));
	}

	/** Shows all known elements (for clean state on deactivate). */
	showAll(): void {
		Object.keys(ELEMENT_CONFIGS).forEach((key) => this.show(key));
		this.naturalHeights.clear(); // reset on full show
	}

	/** Adds hide-el class to element. */
	hide(key: string): void {
		this.getEl(key)?.classList.add("hide-el");
	}

	/** Removes hide-el class from element. */
	show(key: string): void {
		this.getEl(key)?.classList.remove("hide-el");
	}

	/** Shows all elements on given side. */
	showBySide(side: Side): void {
		this.activeKeys
			.filter((k) => ELEMENT_CONFIGS[k].side === side)
			.forEach((k) => this.show(k));
	}

	/** Hides all elements on given side. */
	hideBySide(side: Side): void {
		this.activeKeys
			.filter((k) => ELEMENT_CONFIGS[k].side === side)
			.forEach((k) => this.hide(k));
	}

	/** Returns true if all elements on side are hidden. */
	allHiddenOnSide(side: Side): boolean {
		return this.activeKeys
			.filter((k) => ELEMENT_CONFIGS[k].side === side)
			.every((k) => this.getEl(k)?.classList.contains("hide-el") ?? true);
	}

	/** Returns combined bounding rect for elements on side. Works even when elements are hidden (uses getBoundingClientRect which returns layout dimensions, not visual). */
	getCombinedRect(side: Side): DOMRect | null {
		const keys = this.activeKeys.filter(
			(k) => ELEMENT_CONFIGS[k].side === side,
		);
		if (keys.length === 0) return null;

		let left = Infinity,
			top = Infinity,
			right = -Infinity,
			bottom = -Infinity;
		keys.forEach((key) => {
			const el = this.getEl(key);
			if (!el) return;
			const r = el.getBoundingClientRect();
			const naturalHeight = this.naturalHeights.get(key) ?? r.height;

			left = Math.min(left, r.left);
			top = Math.min(top, r.top);
			right = Math.max(right, r.right);
			// Use natural height so hidden (height:0) elements don't collapse the exit zone
			bottom = Math.max(bottom, r.top + naturalHeight);
		});

		return new DOMRect(left, top, right - left, bottom - top);
	}

	/** Returns max exit padding for elements on side. */
	getExitPadding(side: Side): number {
		const pads = this.activeKeys
			.filter((k) => ELEMENT_CONFIGS[k].side === side)
			.map((k) => ELEMENT_CONFIGS[k].exitPadding);
		return pads.length ? Math.max(...pads) : 10;
	}

	/** Returns DOM element by key, or null. */
	private getEl(key: string): HTMLElement | null {
		return document.querySelector(
			ELEMENT_CONFIGS[key]?.selector,
		) as HTMLElement | null;
	}
}
