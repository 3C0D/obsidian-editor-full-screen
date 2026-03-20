import { Side } from './types.ts';
import { ElementManager } from './elementManager.ts';
import { ELEMENT_CONFIGS } from './constants.ts';

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

	// Sentinel elements for catching fast mouse entries at viewport edges (especially top).
	private sentinelTop: HTMLDivElement | null = null;

	constructor(private manager: ElementManager) {}

	/**
	 * Starts hover detection by adding mousemove listener and creating sentinels.
	 */
	start(): void {
		document.addEventListener('mousemove', this.handleMouseMove);
		this.createSentinels();
	}

	/**
	 * Stops hover detection by removing mousemove listener and sentinels, and resetting state.
	 */
	stop(): void {
		document.removeEventListener('mousemove', this.handleMouseMove);
		this.removeSentinels();
		this.shownSides.clear();
		this.rightSidebarOpen = false;
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

		// viewHeader is not at the viewport edge: detect by its stored position
		this.checkPositionReveal('viewHeader', e);
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
				// Re-enable sentinel pointer-events when top is hidden
				if (side === Side.top && this.sentinelTop)
					this.sentinelTop.style.pointerEvents = 'all';
				// Re-hide toggle button only if neither linked side is shown
				if (side === Side.left && !this.shownSides.has(Side.top))
					this.manager.hide('leftToggleBtn');
				if (side === Side.top && !this.shownSides.has(Side.left))
					this.manager.hide('leftToggleBtn');
				this.onSideHide?.(side);
			}
		});

		// Hide left and right sides when cursor returns to editor
		if (this.isOverEditor(e)) {
			if (this.shownSides.has(Side.left)) {
				this.manager.hideBySide(Side.left);
				this.onSideHide?.(Side.left);
				this.shownSides.delete(Side.left);
				if (!this.shownSides.has(Side.top)) this.manager.hide('leftToggleBtn');
			}
			// Right sidebar: close only if cursor was NOT already near the trigger zone
			// (prevents immediate close when opening from editor edge)
			if (this.rightSidebarOpen) {
				const editorRight = this.getEditorRight();
				const wasNearRightEdge =
					editorRight !== null && e.clientX >= editorRight - EDGE_THRESHOLD;
				if (!wasNearRightEdge) {
					this.rightSidebarOpen = false;
					this.onSideHide?.(Side.right);
				}
			}
		}
	}

	/**
	 * Determines if the cursor is currently over the active editor area.
	 * @param e - The mouse event containing cursor position.
	 * @returns True if the cursor is over the active workspace leaf, false otherwise.
	 */
	private isOverEditor(e: MouseEvent): boolean {
		return !!document
			.elementFromPoint(e.clientX, e.clientY)
			?.closest('.workspace-leaf.mod-active');
	}

	/**
	 * Reveals the element(s) for a given side and triggers the reveal callback.
	 * Avoids redundant operations if the side is already shown.
	 * @param side - The side to reveal (left, top, bottom, or right).
	 */
	private revealSide(side: Side): void {
		// Avoid redundant classList ops if already shown
		if (!this.shownSides.has(side)) {
			this.manager.showBySide(side);
			this.shownSides.add(side);
			// Disable sentinel pointer-events when top is shown, so clicks pass through
			if (side === Side.top && this.sentinelTop)
				this.sentinelTop.style.pointerEvents = 'none';
			// Button is a child of ribbon — show it on left hover too
			if (side === Side.left) this.manager.show('leftToggleBtn');
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
				// Left sidebar close is handled by isOverEditor in checkHide
				return false;
			case Side.right:
				// Right sidebar close is handled by isOverEditor in checkHide
				return false;
			case Side.top:
				return e.clientY > rect.bottom + pad;
			case Side.bottom:
				return e.clientY < rect.top - pad;
			default:
				return false;
		}
	}

	/**
	 * For elements not sitting at a viewport edge, reveal their side
	 * when the cursor enters their natural (pre-hide) bounding rect.
	 */
	private checkPositionReveal(key: string, e: MouseEvent): void {
		if (!this.manager.getManagedKeys().includes(key)) return;
		const rect = this.manager.getPreHideRect(key);
		if (!rect) return;
		if (
			e.clientX >= rect.left &&
			e.clientX <= rect.right &&
			e.clientY >= rect.top - EDGE_THRESHOLD &&
			e.clientY <= rect.bottom
		) {
			this.revealSide(ELEMENT_CONFIGS[key].side);
		}
	}

	/**
	 * The right edge of the editor scroll area.
	 * .cm-scroller does not change width when right sidebar toggles.
	 * @returns The right coordinate of the editor, or null if not found.
	 */
	private getEditorRight(): number | null {
		const el = document.querySelector('.cm-scroller');
		return el ? el.getBoundingClientRect().right : null;
	}

	/**
	 * Check if a side currently has its elements shown.
	 */
	sidesHave(side: Side): boolean {
		return this.shownSides.has(side);
	}
}
