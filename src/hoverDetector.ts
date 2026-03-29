import { Side } from './types.ts';
import {
	VIEW_HEADER_SELECTOR,
	TAB_HEADER_SELECTOR,
	RIBBON_SELECTOR,
	STATUS_BAR_SELECTOR,
	LEFT_TOGGLE_BTN_SELECTOR
} from './constants.ts';

// px from viewport edge that triggers element reveal
const EDGE_THRESHOLD = 13;

// Trigger zone for left side: ribbon width or fallback px
const LEFT_TRIGGER_MAX = 40;

// Extra bottom offset: avoids triggering status bar when Windows taskbar captures cursor
const BOTTOM_EXTRA_MARGIN = 40;

// Exit margin below the last revealed top element before hiding
const EDGE_HIDE_PAD = 25;

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

	// Flag to prevent race condition: when sidebar opens, its left edge animates
	// left, which can temporarily trigger the closing condition in checkHide.
	private rightSidebarJustOpened = false;

	// Whether view-header hover detection is active
	viewHeaderEnabled = false;

	// Whether top bar hiding is active (for zone linking)
	topBarEnabled = false;

	ribbonEnabled = false;
	statusBarEnabled = false;
	leftSidebarEnabled = false;
	rightSidebarEnabled = false;

	// Currently revealed view-headers (managed via CSS class)
	private revealedHeaders = new Set<HTMLElement>();

	// Currently revealed tab headers (managed via CSS class)
	private revealedTabHeaders = new Set<HTMLElement>();

	// Sentinel elements for catching fast mouse entries
	private sentinelTop: HTMLDivElement | null = null;

	// Tracked documents (main + popout windows)
	private trackedDocs = new Set<Document>();

	constructor() {}

	/**
	 * Starts hover detection by adding mousemove listener and creating sentinels.
	 */
	start(): void {
		this.addDocument(document);
		this.createSentinels();
	}

	/**
	 * Stops hover detection on all documents.
	 */
	stop(): void {
		this.trackedDocs.forEach((doc) => this.detachListeners(doc));
		this.trackedDocs.clear();
		this.removeSentinels();
		this.shownSides.clear();
		this.rightSidebarOpen = false;
		this.clearRevealedHeaders();
		this.clearRevealedTabHeaders();
	}

	/** Registers a popout document for hover detection. */
	addDocument(doc: Document): void {
		if (this.trackedDocs.has(doc)) return;
		this.trackedDocs.add(doc);
		this.attachListeners(doc);
	}

	/** Unregisters a popout document. */
	removeDocument(doc: Document): void {
		this.detachListeners(doc);
		this.trackedDocs.delete(doc);
	}

	private attachListeners(doc: Document): void {
		doc.addEventListener('mousemove', this.handleMouseMove);
		doc.addEventListener('dragover', this.handleDragOver);
	}

	private detachListeners(doc: Document): void {
		doc.removeEventListener('mousemove', this.handleMouseMove);
		doc.removeEventListener('dragover', this.handleDragOver);
	}

	/** Queries all tracked documents for elements. */
	private queryAllDocs<T extends Element>(selector: string): T[] {
		const results: T[] = [];
		for (const doc of this.trackedDocs) {
			const els = doc.querySelectorAll(selector);
			els.forEach((el) => results.push(el as T));
		}
		return results;
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
			opacity: '0'
		});
		this.sentinelTop.addEventListener('mouseenter', () => {
			if (this.topBarEnabled) this.revealSide(Side.top);
		});
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
		if (e.clientY <= EDGE_THRESHOLD && this.topBarEnabled) {
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
		const isMainDoc = (e.target as Node)?.ownerDocument === document;

		// Left sidebar: only trigger from main window
		if (isMainDoc && (this.ribbonEnabled || this.leftSidebarEnabled)) {
			const ribbonEl = document.querySelector(
				RIBBON_SELECTOR
			) as HTMLElement | null;
			const triggerWidth = ribbonEl
				? Math.min(ribbonEl.getBoundingClientRect().width, LEFT_TRIGGER_MAX)
				: LEFT_TRIGGER_MAX;
			if (e.clientX <= triggerWidth) this.revealSide(Side.left);
		}

		// Top: generous threshold handles fast upward swipes (per-window)
		const evtDoc = (e.target as Node)?.ownerDocument ?? document;
		if (e.clientY <= EDGE_THRESHOLD && this.topBarEnabled)
			this.revealSide(Side.top, evtDoc);

		// Bottom: pull trigger zone up to stay above Windows taskbar (per-window)
		if (
			e.clientY >= window.innerHeight - EDGE_THRESHOLD - BOTTOM_EXTRA_MARGIN &&
			this.statusBarEnabled
		) {
			this.revealSide(Side.bottom, evtDoc);
		}

		// Right sidebar: Shift + near right edge → open once, then wait for editor return (main window only)
		if (isMainDoc && !this.rightSidebarOpen && e.shiftKey) {
			const editorRight = this.getEditorRight();
			if (editorRight !== null && e.clientX >= editorRight - EDGE_THRESHOLD) {
				this.rightSidebarOpen = true;
				this.rightSidebarJustOpened = true;
				setTimeout(() => {
					this.rightSidebarJustOpened = false;
				}, 500);
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
		this.shownSides.forEach((side) => {
			if (this.isOutside(e, side)) {
				this.hideSide(side);
			}
		});

		// Hide right sidebar when cursor moves away from it
		if (this.rightSidebarOpen && !this.rightSidebarJustOpened) {
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
				this.hideSide(Side.left);
			}
		}
	}

	/**
	 * Updates the left toggle button visibility based on currently shown sides.
	 * Shows the button if left or top side is revealed, hides it otherwise.
	 */
	private updateToggleBtn(doc: Document = document): void {
		const btns = doc.querySelectorAll(LEFT_TOGGLE_BTN_SELECTOR);
		if (this.shownSides.has(Side.left) || this.shownSides.has(Side.top)) {
			btns.forEach((b) => b.classList.add('efs-revealed'));
		} else {
			btns.forEach((b) => b.classList.remove('efs-revealed'));
		}
	}

	/**
	 * Reveals the element(s) for a given side and triggers the reveal callback.
	 * Avoids redundant operations if the side is already shown.
	 * @param side - The side to reveal (left, top, bottom, or right).
	 */
	private revealSide(side: Side, doc: Document = document): void {
		if (!this.shownSides.has(side)) {
			this.shownSides.add(side);

			switch (side) {
				case Side.left:
					doc.querySelectorAll(RIBBON_SELECTOR).forEach((el) =>
						el.classList.add('efs-revealed')
					);
					this.updateToggleBtn(doc);
					break;
				case Side.top:
					if (this.sentinelTop) this.sentinelTop.style.pointerEvents = 'none';
					this.updateToggleBtn(doc);
					break;
				case Side.bottom:
					doc.querySelectorAll(STATUS_BAR_SELECTOR).forEach((el) =>
						el.classList.add('efs-revealed')
					);
					break;
			}

			this.onSideReveal?.(side);
		}
	}

	private hideSide(side: Side, doc: Document = document): void {
		if (this.shownSides.has(side)) {
			this.shownSides.delete(side);

			switch (side) {
				case Side.left:
					doc.querySelectorAll(RIBBON_SELECTOR).forEach((el) =>
						el.classList.remove('efs-revealed')
					);
					this.updateToggleBtn(doc);
					break;
				case Side.top:
					if (this.sentinelTop) this.sentinelTop.style.pointerEvents = 'all';
					this.updateToggleBtn(doc);
					break;
				case Side.bottom:
					doc.querySelectorAll(STATUS_BAR_SELECTOR).forEach((el) =>
						el.classList.remove('efs-revealed')
					);
					break;
			}

			this.onSideHide?.(side);
		}
	}

	/**
	 * Determines if the cursor has moved outside the bounds of a given side's element area.
	 * @param e - The mouse event containing cursor position.
	 * @param side - The side to check against.
	 * @returns True if the cursor is outside the side's bounds (considering padding), false otherwise.
	 */
	private isOutside(e: MouseEvent, side: Side): boolean {
		switch (side) {
			case Side.left:
			case Side.right:
				return false;
			case Side.top:
				let topBottom = 0;
				const btn = document.querySelector(
					LEFT_TOGGLE_BTN_SELECTOR
				) as HTMLElement | null;
				if (btn) topBottom = btn.getBoundingClientRect().bottom;
				// Extend exit zone to include revealed view-headers
				if (this.viewHeaderEnabled) {
					for (const h of this.revealedHeaders) {
						const hb = h.getBoundingClientRect();
						if (hb.bottom > topBottom) topBottom = hb.bottom;
					}
				}
				return e.clientY > topBottom + EDGE_HIDE_PAD;

			case Side.bottom:
				let bottomTop = window.innerHeight;
				const sb = document.querySelector(
					STATUS_BAR_SELECTOR
				) as HTMLElement | null;
				if (sb && this.statusBarEnabled)
					bottomTop = sb.getBoundingClientRect().top;
				const padBottom = 30;
				return e.clientY < bottomTop - padBottom;
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
		const headers = this.queryAllDocs<HTMLElement>(VIEW_HEADER_SELECTOR);

		const nowRevealed = new Set<HTMLElement>();
		const topShown = this.shownSides.has(Side.top);
		const evtDoc = (e.target as Node)?.ownerDocument ?? document;

		headers.forEach((header) => {
			const parent = header.closest(
				'.workspace-leaf-content'
			) as HTMLElement | null;
			if (!parent) return;

			const pr = parent.getBoundingClientRect();
			const inX = e.clientX >= pr.left && e.clientX <= pr.right;
			const tabGroup = header.closest('.workspace-tabs');
			const tabEl = tabGroup?.querySelector(
				TAB_HEADER_SELECTOR
			) as HTMLElement | null;
			const adjacent = tabEl
				? tabEl.getBoundingClientRect().top < EDGE_THRESHOLD
				: pr.top < EDGE_THRESHOLD * 2;
			const sameDoc = header.ownerDocument === evtDoc;

			const nearHeader =
				sameDoc &&
				inX &&
				e.clientY >= pr.top &&
				e.clientY <= pr.top + EDGE_THRESHOLD;

			// Linked: top bar shown + adjacent + same window
			const linkedReveal =
				sameDoc &&
				topShown &&
				adjacent &&
				inX &&
				e.clientY <= pr.top + EDGE_THRESHOLD;

			// Reverse group link: cursor is near the tab
			// header of the same group
			const group = header.closest('.workspace-tabs');
			let cursorNearGroupTab = false;
			if (group && sameDoc) {
				const tab = group.querySelector(
					TAB_HEADER_SELECTOR
				) as HTMLElement | null;
				if (tab) {
					const tr = tab.getBoundingClientRect();
					if (
						e.clientX >= tr.left &&
						e.clientX <= tr.right &&
						e.clientY >= tr.top &&
						e.clientY <= tr.bottom + EDGE_THRESHOLD
					) {
						cursorNearGroupTab = true;
					}
				}
			}

			// Keep header revealed while topBar is shown and cursor hasn't crossed exit threshold
			const keepLinked =
				sameDoc && adjacent && topShown && !this.isOutside(e, Side.top);

			// Keep header revealed for EDGE_HIDE_PAD px below its bottom (standalone exit margin)
			const hRect = header.getBoundingClientRect();
			const keepRevealed =
				sameDoc &&
				inX &&
				this.revealedHeaders.has(header) &&
				e.clientY <= hRect.bottom + EDGE_HIDE_PAD;

			if (
				nearHeader ||
				linkedReveal ||
				cursorNearGroupTab ||
				keepLinked ||
				keepRevealed
			) {
				header.classList.add('efs-revealed');
				nowRevealed.add(header);
				if (adjacent && sameDoc && this.topBarEnabled) {
					this.revealSide(Side.top, evtDoc);
				}
			}
		});

		// Remove reveal from headers no longer hovered
		this.revealedHeaders.forEach((h) => {
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
		const tabs = this.queryAllDocs<HTMLElement>(TAB_HEADER_SELECTOR);

		const nowRevealed = new Set<HTMLElement>();
		const topShown = this.shownSides.has(Side.top);
		const evtDoc = (e.target as Node)?.ownerDocument ?? document;

		tabs.forEach((tab) => {
			const tr = tab.getBoundingClientRect();
			const inX = e.clientX >= tr.left && e.clientX <= tr.right;
			const adjacent = tr.top < EDGE_THRESHOLD * 2;
			const sameDoc = tab.ownerDocument === evtDoc;

			const nearTab =
				sameDoc &&
				inX &&
				e.clientY >= tr.top &&
				e.clientY <= tr.bottom + EDGE_THRESHOLD;

			// Link only within same window
			const linkedTop = sameDoc && topShown && adjacent && inX;

			const group = tab.closest('.workspace-tabs');
			const groupLinked =
				group !== null &&
				[...this.revealedHeaders].some(
					(h) => h.closest('.workspace-tabs') === group
				);

			if (nearTab || linkedTop || groupLinked) {
				tab.classList.add('efs-revealed');
				nowRevealed.add(tab);
				if (adjacent && sameDoc) {
					this.revealSide(Side.top, evtDoc);
				}
			}
		});

		// Reveal titlebars only in the event's window
		const titlebars = this.queryAllDocs<HTMLElement>('.titlebar');
		titlebars.forEach((tb) => {
			if (tb.ownerDocument !== evtDoc) return;
			const anyLocal = [...nowRevealed].some((h) => {
				if (h.ownerDocument !== evtDoc) return false;
				const r = h.getBoundingClientRect();
				return r.top < EDGE_THRESHOLD;
			});
			if (anyLocal) {
				tb.classList.add('efs-revealed');
				nowRevealed.add(tb);
			} else {
				tb.classList.remove('efs-revealed');
			}
		});

		this.revealedTabHeaders.forEach((h) => {
			if (!nowRevealed.has(h)) {
				h.classList.remove('efs-revealed');
			}
		});
		this.revealedTabHeaders = nowRevealed;

		// Sentinel: disable when top elements are visible
		if (this.sentinelTop) {
			this.sentinelTop.style.pointerEvents =
				nowRevealed.size > 0 || topShown ? 'none' : 'all';
		}
	}

	/** Clears all revealed view-headers. */
	private clearRevealedHeaders(): void {
		this.revealedHeaders.forEach((h) => h.classList.remove('efs-revealed'));
		this.revealedHeaders.clear();
	}

	/** Clears all revealed tab headers. */
	private clearRevealedTabHeaders(): void {
		this.revealedTabHeaders.forEach((h) => h.classList.remove('efs-revealed'));
		this.revealedTabHeaders.clear();
	}

	/**
	 * The right edge of the active view area.
	 * Uses .cm-scroller for markdown editors, falls back to
	 * .workspace-leaf-content for other view types (canvas, etc.).
	 * @returns The right coordinate of the view, or null if not found.
	 */
	private getEditorRight(): number | null {
		const scroller = document.querySelector('.cm-scroller');
		if (scroller) return scroller.getBoundingClientRect().right;
		const leaf = document.querySelector('.workspace-leaf-content');
		return leaf ? leaf.getBoundingClientRect().right : null;
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
