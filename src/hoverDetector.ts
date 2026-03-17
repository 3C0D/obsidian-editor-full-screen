import { Side } from "./types.ts";
import { ElementManager } from "./elementManager.ts";

// px from viewport edge that triggers element reveal
// Set to 40 (vs original 20) to catch fast cursor movements reaching the edge in one frame
const EDGE_THRESHOLD = 40;

// Extra bottom offset: avoids triggering status bar when Windows taskbar captures cursor
const BOTTOM_EXTRA_MARGIN = 40;

export class HoverDetector {
	// Tracks which sides currently have their elements shown
	private shownSides = new Set<Side>();

	private sentinelTop: HTMLDivElement | null = null;

	constructor(private manager: ElementManager) {}

	start(): void {
		document.addEventListener("mousemove", this.handleMouseMove);
		this.createSentinels();
	}

	stop(): void {
		document.removeEventListener("mousemove", this.handleMouseMove);
		this.removeSentinels();
		this.shownSides.clear();
	}

	// Thin transparent strips pinned to viewport edges.
	// They catch fast cursor entries that mousemove misses because
	// the cursor jumps from outside the window straight into the strip
	// before any mousemove fires on document.
	private createSentinels(): void {
		this.sentinelTop = document.createElement("div");
		Object.assign(this.sentinelTop.style, {
			position: "fixed",
			top: "0",
			left: "0",
			width: "100%",
			height: `${EDGE_THRESHOLD}px`,
			zIndex: "99999",
			pointerEvents: "all",
			opacity: "0",
		});
		this.sentinelTop.addEventListener("mouseenter", () =>
			this.revealSide(Side.top),
		);
		document.body.appendChild(this.sentinelTop);
	}

	private removeSentinels(): void {
		this.sentinelTop?.remove();
		this.sentinelTop = null;
	}

	private handleMouseMove = (e: MouseEvent): void => {
		this.checkReveal(e);
		this.checkHide(e);
	};

	private checkReveal(e: MouseEvent): void {
		if (e.clientX <= EDGE_THRESHOLD) this.revealSide(Side.left);

		// Top: generous threshold handles fast upward swipes
		if (e.clientY <= EDGE_THRESHOLD) this.revealSide(Side.top);

		// Bottom: pull trigger zone up to stay above Windows taskbar
		if (
			e.clientY >=
			window.innerHeight - EDGE_THRESHOLD - BOTTOM_EXTRA_MARGIN
		)
			this.revealSide(Side.bottom);

		// Right: anchor to editor right edge (cm-scroller), not viewport.
		// This keeps the zone stable whether the right sidebar is open or not.
		const editorRight = this.getEditorRight();
		if (editorRight !== null && e.clientX >= editorRight - EDGE_THRESHOLD)
			this.revealSide(Side.right);
	}

	private checkHide(e: MouseEvent): void {
		this.shownSides.forEach((side) => {
			if (this.isOutside(e, side)) {
				this.manager.hideBySide(side);
				this.shownSides.delete(side);
			}
		});
	}

	private revealSide(side: Side): void {
		// Avoid redundant classList ops if already shown
		if (!this.shownSides.has(side)) {
			this.manager.showBySide(side);
			this.shownSides.add(side);
		}
	}

	private isOutside(e: MouseEvent, side: Side): boolean {
		const rect = this.manager.getCombinedRect(side);
		if (!rect) return false;
		const pad = this.manager.getExitPadding(side);

		switch (side) {
			case Side.left:
				return e.clientX > rect.right + pad;
			case Side.right:
				return e.clientX < rect.left - pad;
			case Side.top:
				return e.clientY > rect.bottom + pad;
			case Side.bottom:
				return e.clientY < rect.top - pad;
			default:
				return false;
		}
	}

	// The right edge of the editor scroll area.
	// .cm-scroller does not change width when right sidebar toggles.
	private getEditorRight(): number | null {
		const el = document.querySelector(".cm-scroller");
		return el ? el.getBoundingClientRect().right : null;
	}
}
