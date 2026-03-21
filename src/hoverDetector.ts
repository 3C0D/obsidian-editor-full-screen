import { Side } from './types.ts';
import { ElementManager } from './elementManager.ts';
import {
	VIEW_HEADER_SELECTOR,
	TAB_HEADER_SELECTOR,
} from './constants.ts';

// px from viewport edge that triggers element reveal
const EDGE_THRESHOLD = 40;

// Trigger zone for left side: ribbon width or fallback px
const LEFT_TRIGGER_MAX = 40;

// Extra bottom offset: avoids triggering status bar when Windows taskbar captures cursor
const BOTTOM_EXTRA_MARGIN = 40;

/**
 * Detects cursor proximity to viewport edges and manages revealing/hiding of UI elements accordingly.
 *
 * @param manager - The ElementManager instance to control element visibility and get positions.
 */
export class HoverDetector {
	// Tracks which sides currently have their elements shown.
	// Used for elements managed by elementManager (left, top, bottom).
	// Note: Right sidebar is NOT in elementManager's activeKeys, so we track
	// its open state separately via rightSidebarOpen below.
	private shownSides = new Set<Side>();

	// Callbacks to notify plugin when sides are revealed/hidden
	onSideReveal: ((side: Side) => void) | null = null;
	onSideHide: ((side: Side) => void) | null = null;

	// Tracks whether the right sidebar is currently open.
	// Separate from shownSides because right sidebar is handled via Obsidian API
	// (WorkspaceSidedock.expand/collapse), not by elementManager.
	private rightSidebarOpen = false;

	// Whether view-header hover detection is active
	viewHeaderEnabled = false;

	// Whether top bar hiding is active (for zone linking)
	topBarEnabled = false;

	// Currently revealed view-headers (managed via CSS class)
	private revealedHeaders = new Set<HTMLElement>();

	// Currently revealed tab headers (managed via CSS class)
	private revealedTabHeaders = new Set<HTMLElement>();

	// Sentinel elements for catching fast mouse entries
	private sentinelTop: HTMLDivElement | null = null;

	constructor(private manager: ElementManager) {}

	/**
	 * Starts hover detection by adding mousemove listener and creating sentinels.
	 */
	start(): void {
		document.addEventListener('mousemove', this.handleMouseMove);
		document.addEventListener('dragover', this.handleDragOver);
		this.createSentinels();
	}

	/**
	 * Stops hover detection by removing mousemove listener and sentinels, and resetting state.
	 */
	stop(): void {
		document.removeEventListener('mousemove', this.handleMouseMove);
		document.removeEventListener('dragover', this.handleDragOver);
		this.removeSentinels();
		this.shownSides.clear();
		this.rightSidebarOpen = false;
		this.clearRevealedHeaders();
		this.clearRevealedTabHeaders();
	}

	/**
	 * Creates sentinel elements at viewport edges to detect fast mouse entries that mousemove might miss.
	 * Thin transparent strips pinned to viewport edges.
	 *
	 * When the cursor moves very quickly from outside the window toward the top edge,
	 * the mousemove event may not fire in time to detect the entry. The sentinel acts as a
	 * safety net: the cursor can jump from outside the window straight into the sentinel
	 * strip before any mousemove event reaches the document handler.
	 */
	private createSentinels(): void {
		this.sentinelTop = document.createElement('div');
		Object.assign(this.sentinelTop.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			width: '100%',
			height: `${EDGE_THRESHOLD}px`,
			zIndex: '99999',
			pointerEvents: 'all',
			opacity: '0',
		});
		this.sentinelTop.addEventListener('mouseenter', () => this.revealSide(Side.top));
		document.body.appendChild(this.sentinelTop);
	}

	/**
	 * Removes sentinel elements from the DOM and cleans up references.
	 */
	private removeSentinels(): void {
		this.sentinelTop?.remove();
		this.sentinelTop = null;
	}

	/**
	 * Handles mouse movement events to check for reveal and hide conditions.
	 * @param e - The mouse event from the mousemove listener.
	 */
	private handleMouseMove = (e: MouseEvent): void => {
		this.checkReveal(e);
		this.checkHide(e);
		if (this.viewHeaderEnabled) {
			this.checkViewHeaderReveal(e);
		}
		if (this.topBarEnabled) {
			this.checkTabHeaderReveal(e);
		}
	};

	/**
	 * During drag & drop, mousemove does not fire.
	 * Use dragover to reveal top bar + tab headers
	 * when dragging near the top edge.
	 */
	private handleDragOver = (e: DragEvent): void => {
		if (e.clientY <= EDGE_THRESHOLD) {
			this.revealSide(Side.top);
		}
		if (this.topBarEnabled) {
			this.checkTabHeaderReveal(e);
		}
		if (this.viewHeaderEnabled) {
			this.checkViewHeaderReveal(e);
		}
	};

	/**
	 * Checks if the cursor is near viewport edges to reveal corresponding sides.
	 * Evaluates left, top, bottom edges, right sidebar (with Shift), and position-based elements.
	 * @param e - The mouse event containing cursor position.
	 */
	private checkReveal(e: MouseEvent): void {
		// Use actual ribbon width if available, capped to avoid accidental triggers
		const ribbonEl = document.querySelector(
			'.workspace-ribbon.side-dock-ribbon.mod-left'
		) as HTMLElement | null;
		const triggerWidth = ribbonEl
			? Math.min(ribbonEl.getBoundingClientRect().width, LEFT_TRIGGER_MAX)
			: LEFT_TRIGGER_MAX;
		if (e.clientX <= triggerWidth) this.revealSide(Side.left);

		// Top: generous threshold handles fast upward swipes
		if (e.clientY <= EDGE_THRESHOLD) this.revealSide(Side.top);

		// Bottom: pull trigger zone up to stay above Windows taskbar
		if (e.clientY >= window.innerHeight - EDGE_THRESHOLD - BOTTOM_EXTRA_MARGIN)
			this.revealSide(Side.bottom);

		// Right sidebar: Shift + near right edge → open once, then wait for editor return
		if (!this.rightSidebarOpen && e.shiftKey) {
			const editorRight = this.getEditorRight();
			if (editorRight !== null && e.clientX >= editorRight - EDGE_THRESHOLD) {
				this.rightSidebarOpen = true;
				this.onSideReveal?.(Side.right);
			}
		}

	}

	/**
	 * Checks if the cursor has moved outside currently shown sides to hide them,
	 * or if it has returned to the editor area to hide sidebars.
	 * @param e - The mouse event containing cursor position.
	 */
	private checkHide(e: MouseEvent): void {
		this.shownSides.forEach(side => {
			if (this.isOutside(e, side)) {
				this.manager.hideBySide(side);
				this.shownSides.delete(side);
				// Re-enable sentinel when top is hidden
				if (side === Side.top && this.sentinelTop)
					this.sentinelTop.style.pointerEvents = 'all';
				// Update toggle button
				this.updateToggleBtn();
				this.onSideHide?.(side);
			}
		});

		// Hide right sidebar when cursor moves away from it
		if (this.rightSidebarOpen) {
			const sidebarLeft = this.getRightSidebarLeft();
			if (e.clientX < sidebarLeft - EDGE_THRESHOLD) {
				this.rightSidebarOpen = false;
				this.onSideHide?.(Side.right);
			}
		}

		// Hide left side when cursor moves away from sidebar
		if (this.shownSides.has(Side.left)) {
			const sidebarRight = this.getLeftSidebarRight();
			if (e.clientX > sidebarRight + EDGE_THRESHOLD) {
				this.manager.hideBySide(Side.left);
				this.shownSides.delete(Side.left);
				this.updateToggleBtn();
				this.onSideHide?.(Side.left);
			}
		}


	}

/**
 * Updates the left toggle button visibility based on currently shown sides.
 * Shows the button if left or top side is revealed, hides it otherwise.
 */
	private updateToggleBtn(): void {
		if (!this.manager.getManagedKeys().includes('leftToggleBtn')) return;
		if (this.shownSides.has(Side.left) || this.shownSides.has(Side.top)) {
			this.manager.show('leftToggleBtn');
		} else {
			this.manager.hide('leftToggleBtn');
		}
	}

	/**
	 * Reveals the element(s) for a given side and triggers the reveal callback.
	 * Avoids redundant operations if the side is already shown.
	 * @param side - The side to reveal (left, top, bottom, or right).
	 */
	private revealSide(side: Side): void {
		if (!this.shownSides.has(side)) {
			this.manager.showBySide(side);
			this.shownSides.add(side);
			if (side === Side.top && this.sentinelTop)
				this.sentinelTop.style.pointerEvents = 'none';
			if (side === Side.left) this.updateToggleBtn();
			this.onSideReveal?.(side);
		}
	}

	/**
	 * Determines if the cursor has moved outside the bounds of a given side's element area.
	 * @param e - The mouse event containing cursor position.
	 * @param side - The side to check against.
	 * @returns True if the cursor is outside the side's bounds (considering padding), false otherwise.
	 */
	private isOutside(e: MouseEvent, side: Side): boolean {
		const rect = this.manager.getCombinedRect(side);
		if (!rect) return false;
		const pad = this.manager.getExitPadding(side);

		switch (side) {
			case Side.left:
				// Handled by position check in checkHide
				return false;
			case Side.right:
				// Handled by position check in checkHide
				return false;
			case Side.top:
				// Zone linking: if an adjacent header is
				// revealed, extend the stay-open zone to
				// include the header area.
				if (this.viewHeaderEnabled) {
					for (const h of this.revealedHeaders) {
						const p = h.closest(
							'.workspace-leaf-content'
						) as HTMLElement | null;
						if (!p) continue;
						const pt = p.getBoundingClientRect();
						if (pt.top >= EDGE_THRESHOLD * 2) continue;
						// Adjacent: keep top bar while cursor
						// is above header bottom + pad
						const hb = h.getBoundingClientRect();
						if (
							e.clientY <= hb.bottom + pad &&
							e.clientX >= pt.left &&
							e.clientX <= pt.right
						) {
							return false;
						}
					}
				}
				return e.clientY > rect.bottom + pad;
			case Side.bottom:
				return e.clientY < rect.top - pad;
			default:
				return false;
		}
	}

	/**
	 * Checks all view-headers across every split pane.
	 * Uses the parent .workspace-leaf-content position
	 * (always in layout) to detect cursor proximity,
	 * then toggles .efs-revealed on individual headers.
	 */
	private checkViewHeaderReveal(e: MouseEvent): void {
		const headers = document.querySelectorAll(
			VIEW_HEADER_SELECTOR
		) as NodeListOf<HTMLElement>;

		const nowRevealed = new Set<HTMLElement>();
		const topShown = this.shownSides.has(Side.top);

		headers.forEach(header => {
			const parent = header.closest(
				'.workspace-leaf-content'
			) as HTMLElement | null;
			if (!parent) return;

			const pr = parent.getBoundingClientRect();
			const inX =
				e.clientX >= pr.left &&
				e.clientX <= pr.right;
			const adjacent =
				pr.top < EDGE_THRESHOLD * 2;

			// Standard: cursor near header top
			const nearHeader =
				inX &&
				e.clientY >= pr.top &&
				e.clientY <= pr.top + EDGE_THRESHOLD;

			// Linked: top bar shown + adjacent
			const linkedReveal =
				topShown &&
				adjacent &&
				inX &&
				e.clientY <=
					pr.top + EDGE_THRESHOLD;

			if (nearHeader || linkedReveal) {
				header.classList.add('efs-revealed');
				nowRevealed.add(header);
				if (adjacent && this.topBarEnabled) {
					this.revealSide(Side.top);
				}
			}
		});

		// Remove reveal from headers no longer hovered
		this.revealedHeaders.forEach(h => {
			if (!nowRevealed.has(h)) {
				h.classList.remove('efs-revealed');
			}
		});
		this.revealedHeaders = nowRevealed;
	}

	/**
	 * Checks all tab header containers.
	 * Reveals them by proximity or when their group's
	 * view-header is already revealed.
	 */
	private checkTabHeaderReveal(e: MouseEvent): void {
		const tabs = document.querySelectorAll(
			TAB_HEADER_SELECTOR
		) as NodeListOf<HTMLElement>;

		const nowRevealed = new Set<HTMLElement>();
		const topShown = this.shownSides.has(Side.top);

		tabs.forEach(tab => {
			const tr = tab.getBoundingClientRect();
			const inX =
				e.clientX >= tr.left &&
				e.clientX <= tr.right;
			const adjacent =
				tr.top < EDGE_THRESHOLD * 2;

			// Near tab header rect
			const nearTab =
				inX &&
				e.clientY >= tr.top &&
				e.clientY <= tr.bottom + EDGE_THRESHOLD;

			// Linked: top bar shown + adjacent
			const linkedTop =
				topShown && adjacent && inX;

			// Group link: view-header in same group
			const group = tab.closest(
				'.workspace-tabs'
			);
			const groupLinked =
				group !== null &&
				[...this.revealedHeaders].some(
					h =>
						h.closest('.workspace-tabs') ===
						group
				);

			if (nearTab || linkedTop || groupLinked) {
				tab.classList.add('efs-revealed');
				nowRevealed.add(tab);
				if (adjacent) {
					this.revealSide(Side.top);
				}
			}
		});

		this.revealedTabHeaders.forEach(h => {
			if (!nowRevealed.has(h)) {
				h.classList.remove('efs-revealed');
			}
		});
		this.revealedTabHeaders = nowRevealed;
	}

	/** Clears all revealed view-headers. */
	private clearRevealedHeaders(): void {
		this.revealedHeaders.forEach(h =>
			h.classList.remove('efs-revealed')
		);
		this.revealedHeaders.clear();
	}

	/** Clears all revealed tab headers. */
	private clearRevealedTabHeaders(): void {
		this.revealedTabHeaders.forEach(h =>
			h.classList.remove('efs-revealed')
		);
		this.revealedTabHeaders.clear();
	}

	/**
	 * The right edge of the editor scroll area.
	 * Note: .cm-scroller shrinks when the right sidebar is open,
	 * so this value changes depending on sidebar state.
	 * @returns The right coordinate of the editor, or null if not found.
	 */
	private getEditorRight(): number | null {
		const el = document.querySelector('.cm-scroller');
		return el ? el.getBoundingClientRect().right : null;
	}

/**
 * Returns the left edge of the right sidebar panel.
 * Used to determine when the cursor has moved far enough left to close the sidebar.
 */
	private getRightSidebarLeft(): number {
		const el = document.querySelector('.mod-right-split') as HTMLElement | null;
		return el ? el.getBoundingClientRect().left : window.innerWidth;
	}

/**
 * Returns the right edge of the left sidebar panel.
 * Used to determine when the cursor has moved far enough right to close the sidebar.
 */
	private getLeftSidebarRight(): number {
		const el = document.querySelector('.mod-left-split') as HTMLElement | null;
		return el ? el.getBoundingClientRect().right : 0;
	}
}
