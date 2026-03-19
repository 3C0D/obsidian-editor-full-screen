// ELEMENT_CONFIGS: object mapping element keys to their config (selector, side, exitPadding)
import { ELEMENT_CONFIGS } from './constants.ts';
import { Side } from './types.ts';

/**
 * Manages the visibility of UI elements in the full screen mode.
 * Handles showing/hiding elements individually or by side (left, right, top, bottom).
 * Provides utilities for computing combined bounding rects and exit padding for hover detection.
 */
export class ElementManager {
	// Managed element keys (controlled by plugin settings).
	private managedKeys: string[] = [];

	// Snapshot of element rects taken before hiding, used for position-based reveal detection
	// and exit detection when elements are collapsed to height:0 by CSS.
	private preHideRects: Map<string, DOMRect> = new Map();

	/** Updates the managed element keys. */
	setManagedKeys(keys: string[]): void {
		this.managedKeys = keys;
	}

	/** Returns the managed element keys. */
	getManagedKeys(): string[] {
		return this.managedKeys;
	}

	/** Hides all hidable active elements. */
	hideManaged(): void {
		// Snapshot all elements before hiding any - DOM layout recalculates live,
		// so hiding then snapshotting would cause already-hidden elements to affect
		// the layout of subsequent elements in the same pass.
		this.managedKeys.forEach(key => {
			const el = this.getEl(key);
			if (el && !this.preHideRects.has(key)) {
				this.preHideRects.set(key, el.getBoundingClientRect());
			}
		});
		this.managedKeys.forEach(key => this.hide(key));
	}

	/** Shows all known elements (for clean state on deactivate). */
	showAllElements(): void {
		Object.keys(ELEMENT_CONFIGS).forEach(key => this.show(key));
		this.preHideRects.clear(); // reset on full show
	}

	/** Adds hide-el class to element. */
	hide(key: string): void {
		this.getEl(key)?.classList.add('hide-el');
	}

	/** Removes hide-el class from element. */
	show(key: string): void {
		this.getEl(key)?.classList.remove('hide-el');
	}

	/** Shows all elements on given side. */
	showBySide(side: Side): void {
		this.getKeysBySide(side).forEach(k => this.show(k));
	}

	/** Hides all elements on given side. */
	hideBySide(side: Side): void {
		this.getKeysBySide(side).forEach(k => this.hide(k));
	}

	/** Returns true if all elements on side are hidden. */
	allHiddenOnSide(side: Side): boolean {
		return this.getKeysBySide(side).every(
			k => this.getEl(k)?.classList.contains('hide-el') ?? true
		);
	}

	/** Returns combined bounding rect for elements on the same side. Works even when elements are hidden (uses getBoundingClientRect which returns layout dimensions, not visual). */
	getCombinedRect(side: Side): DOMRect | null {
		const keys = this.getKeysBySide(side);
		if (keys.length === 0) return null;

		let left = Infinity,
			top = Infinity,
			right = -Infinity,
			bottom = -Infinity;
		keys.forEach(key => {
			const el = this.getEl(key);
			if (!el) return;
			const r = el.getBoundingClientRect();
			const preHideRect = this.preHideRects.get(key);
			const preHideTop = preHideRect?.top ?? r.top;
			const preHideHeight = preHideRect?.height ?? r.height;

			left = Math.min(left, r.left);
			top = Math.min(top, preHideTop);
			right = Math.max(right, r.right);
			// Use natural rect so hidden (height:0) elements don't collapse the exit zone
			bottom = Math.max(bottom, preHideTop + preHideHeight);
		});

		return new DOMRect(left, top, right - left, bottom - top);
	}

	/** Returns max exit padding for elements on side. */
	getExitPadding(side: Side): number {
		const pads = this.getKeysBySide(side).map(k => ELEMENT_CONFIGS[k].exitPadding);
		return pads.length ? Math.max(...pads) : 10;
	}

	/** Returns the snapshotted rect of an element (taken before hiding). */
	getOriginalRect(key: string): DOMRect | null {
		return this.preHideRects.get(key) ?? null;
	}

	/** Returns DOM element by key, or null. */
	private getEl(key: string): HTMLElement | null {
		return document.querySelector(ELEMENT_CONFIGS[key]?.selector) as HTMLElement | null;
	}

	/** Returns managed element keys that belong to the given side. */
	private getKeysBySide(side: Side): string[] {
		return this.managedKeys.filter(k => ELEMENT_CONFIGS[k].side === side);
	}
}
