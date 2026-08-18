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

// px — trigger zone for status bar reveal
const BOTTOM_SENTINEL_WIDTH = 180;

// Exit margin below the last revealed top element before hiding
const EDGE_HIDE_PAD = 25;

/**
 * Detects cursor proximity to viewport edges and manages revealing/hiding of UI elements accordingly.
 */
export class HoverDetector {
  // Tracks which sides (left, top, bottom) currently have their elements revealed.
  // The right sidebar is not tracked here: its open/closed state is delegated
  // directly to main.ts via the onSideReveal/onSideHide callbacks.
  private shownSides = new Set<Side>();

  // Callbacks to notify plugin when sides are revealed/hidden
  onSideReveal: ((side: Side) => void) | null = null;
  onSideHide: ((side: Side) => void) | null = null;

  // Whether view-header hover detection is active
  viewHeaderEnabled = false;

  // Whether top bar hiding is active (for zone linking)
  topBarEnabled = false;

  ribbonEnabled = false;
  statusBarEnabled = false;
  leftSidebarEnabled = false;
  rightSidebarEnabled = false;

  // Timer for delayed sidebar hide (prevents false triggers on tree resize)
  private sidebarHideTimer: ReturnType<typeof setTimeout> | null = null;
  private sidebarListenersAttached = false;
  private sidebarCleanups: Array<() => void> = [];

  // Whether an Obsidian context menu (.menu) is currently open.
  // While true, mouseleave on sidebars is suppressed.
  private menuOpen = false;

  private menuObserver: MutationObserver | null = null;

  // Sentinel elements for catching fast mouse entries, one pair per tracked document
  // (main window + each popout). Each frameless window has its own top drag-region
  // dead zone where native mousemove never reaches the DOM without an overlay.
  private sentinels = new Map<Document, { top: HTMLDivElement; bottom: HTMLDivElement }>();

  // Tracked documents (main + popout windows)
  private trackedDocs = new Set<Document>();

  constructor() {}

  /**
   * Starts hover detection by adding mousemove listener and creating sentinels.
   */
  start(): void {
    this.addDocument(document);
    this.attachSidebarListeners();
    this.startMenuObserver();
  }

  /**
   * Stops hover detection on all documents.
   */
  stop(): void {
    this.clearAllRevealed();
    this.trackedDocs.forEach((doc) => this.detachListeners(doc));
    this.trackedDocs.clear();
    this.removeAllSentinels();
    this.detachSidebarListeners();
    this.stopMenuObserver();
    if (this.sidebarHideTimer) {
      clearTimeout(this.sidebarHideTimer);
      this.sidebarHideTimer = null;
    }
    this.shownSides.clear();
  }

  /** Registers an additional document (popout window) so hover detection works across all open windows. */
  addDocument(doc: Document): void {
    if (this.trackedDocs.has(doc)) return;
    this.trackedDocs.add(doc);
    this.attachListeners(doc);
    this.createSentinelsForDoc(doc);
  }

  /** Unregisters a popout document. */
  removeDocument(doc: Document): void {
    this.detachListeners(doc);
    this.trackedDocs.delete(doc);
    this.removeSentinelsForDoc(doc);
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
   * Creates the top/bottom sentinel strips for one document.
   * In a frameless window, the hidden top bar sits over the native OS drag
   * region, which swallows mousemove before it reaches the DOM. The sentinel
   * is a plain, non-drag element pinned over that region, so entering it
   * always fires a real mouseenter event, in every tracked window.
   */
  private createSentinelsForDoc(doc: Document): void {
    if (this.sentinels.has(doc)) return;

    const top = doc.createElement('div');
    Object.assign(top.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: `${EDGE_THRESHOLD}px`,
      zIndex: '99999',
      pointerEvents: 'all',
      opacity: '0'
    });
    top.addEventListener('mouseenter', () => {
      if (this.topBarEnabled) this.revealSide(Side.top, doc);
    });
    doc.body.appendChild(top);

    const bottom = doc.createElement('div');
    Object.assign(bottom.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      width: `${BOTTOM_SENTINEL_WIDTH}px`,
      height: `${EDGE_THRESHOLD}px`,
      zIndex: '99999',
      pointerEvents: 'all',
      opacity: '0'
    });
    bottom.addEventListener('mouseenter', () => {
      if (this.statusBarEnabled) {
        const sb = doc.querySelector(STATUS_BAR_SELECTOR) as HTMLElement | null;
        if (sb) {
          const rect = sb.getBoundingClientRect();
          if (rect.width > 0) bottom.style.width = `${rect.width}px`;
          if (rect.height > 0) bottom.style.height = `${rect.height}px`;
        }
        this.revealSide(Side.bottom, doc);
      }
    });
    doc.body.appendChild(bottom);

    this.sentinels.set(doc, { top, bottom });
  }

  /** Removes the sentinel pair for one document. */
  private removeSentinelsForDoc(doc: Document): void {
    const pair = this.sentinels.get(doc);
    if (!pair) return;
    pair.top.remove();
    pair.bottom.remove();
    this.sentinels.delete(doc);
  }

  /** Removes sentinel elements from every tracked document. */
  private removeAllSentinels(): void {
    this.sentinels.forEach((_pair, doc) => this.removeSentinelsForDoc(doc));
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
   */
  private checkReveal(e: MouseEvent): void {
    const evtDoc = (e.target as Node)?.ownerDocument ?? document;
    const isMainDoc = evtDoc === document;

    // Left sidebar: only trigger from main window
    if (isMainDoc && (this.ribbonEnabled || this.leftSidebarEnabled)) {
      const ribbonEl = evtDoc.querySelector(RIBBON_SELECTOR) as HTMLElement | null;
      const triggerWidth = ribbonEl
        ? Math.min(ribbonEl.getBoundingClientRect().width, LEFT_TRIGGER_MAX)
        : LEFT_TRIGGER_MAX;
      if (e.clientX <= triggerWidth) this.revealSide(Side.left, evtDoc);
    }

    // Top: handles upward swipe in any tracked window
    if (e.clientY <= EDGE_THRESHOLD && this.topBarEnabled) {
      this.revealSide(Side.top, evtDoc);
    }
  }

  /**
   * Checks if the cursor has moved outside currently shown sides to hide them.
   */
  private checkHide(e: MouseEvent): void {
    const evtDoc = (e.target as Node)?.ownerDocument ?? document;
    this.shownSides.forEach((side) => {
      if (this.isOutside(e, side, evtDoc)) {
        this.hideSide(side, evtDoc);
      }
    });
  }

  /**
   * Updates the left toggle button visibility based on currently shown sides.
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
   * Reveals the element(s) for a given side.
   */
  private revealSide(side: Side, doc: Document = document): void {
    if (!this.shownSides.has(side)) {
      this.shownSides.add(side);

      switch (side) {
        case Side.left:
          doc
            .querySelectorAll(RIBBON_SELECTOR)
            .forEach((el) => el.classList.add('efs-revealed'));
          this.updateToggleBtn(doc);
          break;
        case Side.top: {
          const topSentinel = this.sentinels.get(doc)?.top;
          if (topSentinel) topSentinel.style.pointerEvents = 'none';
          this.updateToggleBtn(doc);
          break;
        }
        case Side.bottom: {
          const bottomSentinel = this.sentinels.get(doc)?.bottom;
          if (bottomSentinel) bottomSentinel.style.pointerEvents = 'none';
          doc
            .querySelectorAll(STATUS_BAR_SELECTOR)
            .forEach((el) => el.classList.add('efs-revealed'));
          break;
        }
      }

      this.onSideReveal?.(side);
    }
  }

  private hideSide(side: Side, doc: Document = document): void {
    if (this.shownSides.has(side)) {
      this.shownSides.delete(side);

      switch (side) {
        case Side.left:
          doc
            .querySelectorAll(RIBBON_SELECTOR)
            .forEach((el) => el.classList.remove('efs-revealed'));
          this.updateToggleBtn(doc);
          break;
        case Side.top: {
          const topSentinel = this.sentinels.get(doc)?.top;
          if (topSentinel) topSentinel.style.pointerEvents = 'all';
          this.updateToggleBtn(doc);
          break;
        }
        case Side.bottom: {
          const bottomSentinel = this.sentinels.get(doc)?.bottom;
          if (bottomSentinel) bottomSentinel.style.pointerEvents = 'all';
          doc
            .querySelectorAll(STATUS_BAR_SELECTOR)
            .forEach((el) => el.classList.remove('efs-revealed'));
          break;
        }
      }

      this.onSideHide?.(side);
    }
  }

  /**
   * Determines if the cursor has moved outside the bounds of a given side's element area.
   */
  private isOutside(e: MouseEvent, side: Side, doc: Document = document): boolean {
    switch (side) {
      case Side.left:
      case Side.right:
        return false;
      case Side.top:
        let topBottom = 0;
        const btn = doc.querySelector(LEFT_TOGGLE_BTN_SELECTOR) as HTMLElement | null;
        if (btn) topBottom = btn.getBoundingClientRect().bottom;
        // Extend exit zone to include revealed elements in this document
        doc.querySelectorAll<HTMLElement>(
          '.view-header.efs-revealed, .workspace-tab-header-container.efs-revealed, .titlebar.efs-revealed'
        ).forEach((el) => {
          const b = el.getBoundingClientRect();
          if (b.bottom > topBottom) topBottom = b.bottom;
        });
        return e.clientY > topBottom + EDGE_HIDE_PAD;

      case Side.bottom:
        let bottomTop = doc.defaultView?.innerHeight ?? window.innerHeight;
        const sb = doc.querySelector(STATUS_BAR_SELECTOR) as HTMLElement | null;
        if (sb && this.statusBarEnabled) bottomTop = sb.getBoundingClientRect().top;
        const padBottom = 30;
        return e.clientY < bottomTop - padBottom;
      default:
        return false;
    }
  }

  /**
   * Checks all view-headers in the target window.
   */
  private checkViewHeaderReveal(e: MouseEvent): void {
    const evtDoc = (e.target as Node)?.ownerDocument ?? document;
    const headers = evtDoc.querySelectorAll<HTMLElement>(VIEW_HEADER_SELECTOR);
    const topShown = this.shownSides.has(Side.top);

    headers.forEach((header) => {
      const parent = header.closest('.workspace-leaf-content') as HTMLElement | null;
      if (!parent) return;

      const pr = parent.getBoundingClientRect();
      const inX = e.clientX >= pr.left && e.clientX <= pr.right;
      const tabGroup = header.closest('.workspace-tabs');
      const tabEl = tabGroup?.querySelector(TAB_HEADER_SELECTOR) as HTMLElement | null;
      const adjacent = tabEl
        ? tabEl.getBoundingClientRect().top < EDGE_THRESHOLD
        : pr.top < EDGE_THRESHOLD * 2;

      const nearHeader = inX && e.clientY >= pr.top && e.clientY <= pr.top + EDGE_THRESHOLD;
      const linkedReveal = topShown && adjacent && inX && e.clientY <= pr.top + EDGE_THRESHOLD;

      const group = header.closest('.workspace-tabs');
      let cursorNearGroupTab = false;
      if (group) {
        const tab = group.querySelector(TAB_HEADER_SELECTOR) as HTMLElement | null;
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

      const keepLinked = adjacent && topShown && !this.isOutside(e, Side.top, evtDoc);
      const hRect = header.getBoundingClientRect();
      const keepRevealed =
        inX &&
        header.classList.contains('efs-revealed') &&
        e.clientY <= hRect.bottom + EDGE_HIDE_PAD;

      if (nearHeader || linkedReveal || cursorNearGroupTab || keepLinked || keepRevealed) {
        header.classList.add('efs-revealed');
        if (adjacent && this.topBarEnabled) {
          this.revealSide(Side.top, evtDoc);
        }
      } else {
        header.classList.remove('efs-revealed');
      }
    });
  }

  /**
   * Checks all tab header containers and titlebars in the target window.
   */
  private checkTabHeaderReveal(e: MouseEvent): void {
    const evtDoc = (e.target as Node)?.ownerDocument ?? document;
    const tabs = evtDoc.querySelectorAll<HTMLElement>(TAB_HEADER_SELECTOR);
    const topShown = this.shownSides.has(Side.top);
    let anyTabRevealed = false;

    tabs.forEach((tab) => {
      const tr = tab.getBoundingClientRect();
      const inX = e.clientX >= tr.left && e.clientX <= tr.right;
      const adjacent = tr.top < EDGE_THRESHOLD * 2;

      const nearTab = inX && e.clientY >= tr.top && e.clientY <= tr.bottom + EDGE_THRESHOLD;
      const linkedTop = topShown && adjacent && inX;

      const group = tab.closest('.workspace-tabs');
      const groupLinked =
        group !== null &&
        Array.from(group.querySelectorAll<HTMLElement>('.view-header')).some((h) =>
          h.classList.contains('efs-revealed')
        );

      if (nearTab || linkedTop || groupLinked) {
        tab.classList.add('efs-revealed');
        anyTabRevealed = true;
        if (adjacent) {
          this.revealSide(Side.top, evtDoc);
        }
      } else {
        tab.classList.remove('efs-revealed');
      }
    });

    // Reveal titlebar in the event's window
    const titlebars = evtDoc.querySelectorAll<HTMLElement>('.titlebar');
    titlebars.forEach((tb) => {
      const tbRect = tb.getBoundingClientRect();
      const cursorNearTitlebar =
        e.clientX >= tbRect.left &&
        e.clientX <= tbRect.right &&
        e.clientY >= tbRect.top &&
        e.clientY <= tbRect.bottom + EDGE_THRESHOLD;

      if (anyTabRevealed || cursorNearTitlebar) {
        tb.classList.add('efs-revealed');
      } else {
        tb.classList.remove('efs-revealed');
      }
    });

    // Sentinel: disable pointer-events for this window's top sentinel while its
    // top elements are visible, so it stops intercepting clicks meant for them.
    const topSentinel = this.sentinels.get(evtDoc)?.top;
    if (topSentinel) {
      topSentinel.style.pointerEvents = anyTabRevealed || topShown ? 'none' : 'all';
    }
  }

  private scheduleHide(fn: () => void): void {
    // While a context menu is open, do not schedule sidebar hide.
    // The menu observer will retrigger evaluation once the menu closes.
    if (this.menuOpen) return;
    if (this.sidebarHideTimer) clearTimeout(this.sidebarHideTimer);
    this.sidebarHideTimer = setTimeout(fn, 200);
  }

  /** Attaches mouseleave on sidebars and status bar as fallback for when
   *  mousemove stops firing (cursor inside an iframe). Each triggers the
   *  same hide logic as checkHide, delayed to absorb file tree resize events. */
  private attachSidebarListeners(): void {
    if (this.sidebarListenersAttached) return;
    this.sidebarListenersAttached = true;

    const cancel = (): void => {
      if (this.sidebarHideTimer) {
        clearTimeout(this.sidebarHideTimer);
        this.sidebarHideTimer = null;
      }
    };

    // Left sidebar + ribbon: treat as one zone
    const leftEl = document.querySelector('.mod-left-split') as HTMLElement | null;
    const ribbonEl = document.querySelector(RIBBON_SELECTOR) as HTMLElement | null;

    const onLeftLeave = (): void => {
      // If a context menu is open, keep the sidebar visible.
      if (this.menuOpen) return;
      this.scheduleHide(() => {
        this.hideSide(Side.left);
      });
    };

    if (leftEl) {
      leftEl.addEventListener('mouseleave', onLeftLeave);
      leftEl.addEventListener('mouseenter', cancel);
      this.sidebarCleanups.push(() => {
        leftEl.removeEventListener('mouseleave', onLeftLeave);
        leftEl.removeEventListener('mouseenter', cancel);
      });
    }
    if (ribbonEl) {
      ribbonEl.addEventListener('mouseleave', onLeftLeave);
      ribbonEl.addEventListener('mouseenter', cancel);
      this.sidebarCleanups.push(() => {
        ribbonEl.removeEventListener('mouseleave', onLeftLeave);
        ribbonEl.removeEventListener('mouseenter', cancel);
      });
    }

    // Right sidebar: auto-close on mouseleave (no mouseenter cancel needed)
    const rightEl = document.querySelector('.mod-right-split') as HTMLElement | null;
    if (rightEl) {
      const onRightLeave = (): void => {
        // If a context menu is open, keep the sidebar visible.
        if (this.menuOpen) return;
        this.scheduleHide(() => {
          if (this.rightSidebarEnabled) {
            this.onSideHide?.(Side.right);
          }
        });
      };
      const onRightEnter = cancel;
      rightEl.addEventListener('mouseleave', onRightLeave);
      rightEl.addEventListener('mouseenter', onRightEnter);
      this.sidebarCleanups.push(() => {
        rightEl.removeEventListener('mouseleave', onRightLeave);
        rightEl.removeEventListener('mouseenter', onRightEnter);
      });
    }

    // Status bar: hide on mouseleave, no mouseenter needed (sentinel handles reveal)
    const statusEls = document.querySelectorAll(STATUS_BAR_SELECTOR);
    statusEls.forEach((el) => {
      const onStatusLeave = (): void =>
        this.scheduleHide(() => this.hideSide(Side.bottom));
      el.addEventListener('mouseleave', onStatusLeave);
      this.sidebarCleanups.push(() => {
        el.removeEventListener('mouseleave', onStatusLeave);
      });
    });
  }

  private detachSidebarListeners(): void {
    this.sidebarCleanups.forEach((cleanup) => cleanup());
    this.sidebarCleanups = [];
    this.sidebarListenersAttached = false;
  }

  /**
   * Observes the DOM for Obsidian context menus (.menu) and modals (.modal-container).
   * Sets menuOpen=true when a menu is open, and toggles efs-has-modal on document.body.
   */
  private startMenuObserver(): void {
    if (this.menuObserver) return;

    const updateState = (): void => {
      this.menuOpen = !!document.querySelector('.menu');

      const hasModal = !!document.querySelector('.modal-container');
      document.body.classList.toggle('efs-has-modal', hasModal);
    };

    this.menuObserver = new MutationObserver(updateState);
    this.menuObserver.observe(document.body, { childList: true, subtree: true });
    updateState();
  }

  private stopMenuObserver(): void {
    this.menuObserver?.disconnect();
    this.menuObserver = null;
    this.menuOpen = false;
    document.body.classList.remove('efs-has-modal');
  }

  /**
   * Removes the efs-revealed class from every managed element (view-headers,
   * tab headers, titlebars) across all tracked documents. Replaces the old
   * Set-based tracking, which the refactor to per-document classList toggling
   * left unpopulated.
   */
  private clearAllRevealed(): void {
    const selector = `${VIEW_HEADER_SELECTOR}.efs-revealed, ${TAB_HEADER_SELECTOR}.efs-revealed, .titlebar.efs-revealed`;
    this.trackedDocs.forEach((doc) => {
      doc
        .querySelectorAll<HTMLElement>(selector)
        .forEach((el) => el.classList.remove('efs-revealed'));
    });
  }
}
