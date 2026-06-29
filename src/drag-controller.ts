import type { ToolbarStateManager } from './state';
import type { DragPosition } from './types';

// Layout constants shared by drag/positioning logic
const EDGE_MARGIN = 20; // px gap kept between the toolbar and the window edge
const TOGGLE_SIZE = 48; // px width/height of the floating toggle icon
const PANEL_WIDTH = 400; // px width of the expanded panel (matches CSS)
const DRAG_THRESHOLD = 4; // px of movement before a pointer-drag begins

const POSITION_CLASSES = [
  'position-top-left',
  'position-top-right',
  'position-bottom-left',
  'position-bottom-right',
  'position-left',
  'position-right',
];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Determine which window edge a dragged toolbar should snap to, and where along
 * that edge it sits. Pure function so it can be unit-tested independently.
 *
 * @param left/top - top-left corner of the dragged element (viewport coords)
 * @param width/height - size of the dragged element
 * @param vw/vh - viewport dimensions
 */
export function computeDragPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  vw: number,
  vh: number,
): DragPosition {
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  const distLeft = centerX;
  const distRight = vw - centerX;
  const distTop = centerY;
  const distBottom = vh - centerY;
  const nearest = Math.min(distLeft, distRight, distTop, distBottom);

  // Offsets are stored as a fraction of the available travel along the edge so
  // the position stays proportional when the window is resized.
  const offsetX = vw > width ? clamp(left / (vw - width), 0, 1) : 0;
  const offsetY = vh > height ? clamp(top / (vh - height), 0, 1) : 0;

  if (nearest === distTop) return { edge: 'top', offset: offsetX };
  if (nearest === distBottom) return { edge: 'bottom', offset: offsetX };
  if (nearest === distLeft) return { edge: 'left', offset: offsetY };
  return { edge: 'right', offset: offsetY };
}

/** Static config the controller needs to position the toolbar */
export interface DragControllerConfig {
  /** Whether the floating icon can be dragged */
  draggable: boolean;
  /** Preset position used when the toolbar has not been dragged */
  position: string;
}

/** Callbacks the controller uses to talk back to the owning UI */
export interface DragControllerCallbacks {
  /** Open the toolbar panel (a plain click on the floating icon) */
  onOpen: () => void;
  /** Ask the owning UI to re-render (after the drag position changes) */
  requestRender: () => void;
}

/**
 * Owns toolbar placement and the drag-to-move interaction for the floating
 * icon. It manipulates the root container's position (preset class or inline
 * coordinates) and tracks pointer state during a drag, then snaps to the
 * nearest window edge on release.
 *
 * It depends only on the root element, the state manager, static config, and a
 * pair of callbacks — so it stays decoupled from the rest of the UI rendering.
 */
export class DragController {
  private isDragging = false;
  private dragMoved = false;
  private suppressClick = false;
  private dragGrabX = 0;
  private dragGrabY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private snapTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private root: HTMLElement,
    private state: ToolbarStateManager,
    private config: DragControllerConfig,
    private callbacks: DragControllerCallbacks,
  ) {
    // Keep a dragged position on-screen when the window is resized
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private handleResize = (): void => {
    if (!this.isDragging) this.apply();
  };

  /**
   * Apply the toolbar position to the root container. When the user has dragged
   * the toolbar, position via inline coordinates; otherwise fall back to the
   * preset position-* class from the `position` option.
   */
  apply(): void {
    const root = this.root;
    // A persisted drag position only applies while dragging is enabled, so
    // toggling `draggable: false` reverts to the configured preset position.
    const drag = this.config.draggable ? this.state.getDragPosition() : undefined;

    // Reset any inline coordinates before re-applying
    root.style.top = '';
    root.style.bottom = '';
    root.style.left = '';
    root.style.right = '';
    root.classList.remove(...POSITION_CLASSES);

    if (!drag) {
      root.classList.add(`position-${this.config.position}`);
      return;
    }

    // Always position via left/top (never right/bottom) so the snap-to-edge
    // animation moves through a single, continuous coordinate space.
    const { left, top } = this.state.getVisibility()
      ? this.computePanelCoords(drag)
      : this.computeIconCoords(drag);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  }

  /** Inline coordinates for the collapsed floating icon at a dragged position */
  private computeIconCoords(drag: DragPosition): { left: number; top: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const alongX = clamp(
      drag.offset * (vw - TOGGLE_SIZE),
      EDGE_MARGIN,
      vw - TOGGLE_SIZE - EDGE_MARGIN,
    );
    const alongY = clamp(
      drag.offset * (vh - TOGGLE_SIZE),
      EDGE_MARGIN,
      vh - TOGGLE_SIZE - EDGE_MARGIN,
    );

    switch (drag.edge) {
      case 'top':
        return { left: alongX, top: EDGE_MARGIN };
      case 'bottom':
        return { left: alongX, top: vh - TOGGLE_SIZE - EDGE_MARGIN };
      case 'left':
        return { left: EDGE_MARGIN, top: alongY };
      default:
        return { left: vw - TOGGLE_SIZE - EDGE_MARGIN, top: alongY };
    }
  }

  /**
   * Inline coordinates for the expanded panel at a dragged position. The panel
   * hugs the same edge as the icon and is centered near the icon's offset, then
   * clamped so the 400px-wide panel never overflows the viewport.
   */
  private computePanelCoords(drag: DragPosition): { left: number; top: number } {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelHeight = Math.min(700, vh * 0.85);

    const iconLeft = drag.offset * (vw - TOGGLE_SIZE);
    const iconTop = drag.offset * (vh - TOGGLE_SIZE);
    const left = clamp(
      iconLeft + TOGGLE_SIZE / 2 - PANEL_WIDTH / 2,
      EDGE_MARGIN,
      vw - PANEL_WIDTH - EDGE_MARGIN,
    );
    const top = clamp(
      iconTop + TOGGLE_SIZE / 2 - panelHeight / 2,
      EDGE_MARGIN,
      vh - panelHeight - EDGE_MARGIN,
    );

    switch (drag.edge) {
      case 'top':
        return { left, top: EDGE_MARGIN };
      case 'bottom':
        return { left, top: vh - panelHeight - EDGE_MARGIN };
      case 'left':
        return { left: EDGE_MARGIN, top };
      default:
        return { left: vw - PANEL_WIDTH - EDGE_MARGIN, top };
    }
  }

  // --- Floating toggle: click to open + optional drag-to-move ---

  onToggleClick(): void {
    // A drag just finished — swallow the click so it doesn't open the panel
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.callbacks.onOpen();
  }

  onPointerDown(e: PointerEvent): void {
    if (!this.config.draggable || e.button !== 0) return;

    // Cancel any in-flight snap animation so the icon tracks the pointer immediately
    if (this.snapTimer !== undefined) {
      clearTimeout(this.snapTimer);
      this.snapTimer = undefined;
    }
    this.root.classList.remove('ut-snapping');

    const rect = this.root.getBoundingClientRect();
    this.dragGrabX = e.clientX - rect.left;
    this.dragGrabY = e.clientY - rect.top;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.isDragging = true;
    this.dragMoved = false;

    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;

    if (!this.dragMoved) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this.dragMoved = true;
      this.root.classList.add('ut-dragging');
      this.root.classList.remove(...POSITION_CLASSES);
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = clamp(e.clientX - this.dragGrabX, EDGE_MARGIN, vw - TOGGLE_SIZE - EDGE_MARGIN);
    const top = clamp(e.clientY - this.dragGrabY, EDGE_MARGIN, vh - TOGGLE_SIZE - EDGE_MARGIN);

    const root = this.root;
    root.style.right = '';
    root.style.bottom = '';
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  };

  private onPointerUp = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.removeDragListeners();
    this.root.classList.remove('ut-dragging');

    if (!this.dragMoved) return; // treat as a plain click → onToggleClick opens it

    this.suppressClick = true;
    const rect = this.root.getBoundingClientRect();
    const position = computeDragPosition(
      rect.left,
      rect.top,
      rect.width || TOGGLE_SIZE,
      rect.height || TOGGLE_SIZE,
      window.innerWidth,
      window.innerHeight,
    );

    // Animate the snap from the drop point to the edge, then drop the
    // transition class so later renders/resizes reposition instantly.
    this.root.classList.add('ut-snapping');
    this.snapTimer = setTimeout(() => {
      this.root.classList.remove('ut-snapping');
      this.snapTimer = undefined;
    }, 250);

    this.state.setDragPosition(position);
    this.callbacks.requestRender();
  };

  private removeDragListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
  }

  /** Remove all listeners and cancel any pending snap animation */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (this.snapTimer !== undefined) clearTimeout(this.snapTimer);
    this.removeDragListeners();
  }
}
