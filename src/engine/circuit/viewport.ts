/**
 * @file viewport.ts
 * Canvas viewport transformations, coordinate mapping, and fixed-point zooming.
 */

/** Minimum permitted viewport zoom factor */
export const MIN_ZOOM = 0.25;

/** Maximum permitted viewport zoom factor */
export const MAX_ZOOM = 3.0;

/**
 * 2D point coordinate in Cartesian plane.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * 2D dimensional size.
 */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * 2D Axis-Aligned Bounding Box (AABB).
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Interactive canvas viewport transformation state.
 */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/**
 * Transforms screen pixels (e.g. mouse cursor) to world coordinates.
 *
 * @param screen Screen coordinate point
 * @param viewport Current canvas viewport
 * @returns Point in world coordinates
 */
export function screenToWorld(screen: Point, viewport: Viewport): Point {
  return {
    x: (screen.x - viewport.x) / viewport.zoom,
    y: (screen.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Transforms world coordinates to screen pixel coordinates.
 *
 * @param world World coordinate point
 * @param viewport Current canvas viewport
 * @returns Point in screen coordinates
 */
export function worldToScreen(world: Point, viewport: Viewport): Point {
  return {
    x: world.x * viewport.zoom + viewport.x,
    y: world.y * viewport.zoom + viewport.y,
  };
}

/**
 * Computes an updated viewport while zooming in/out anchored at a fixed screen point.
 *
 * @param viewport Current viewport
 * @param screenPoint Anchor screen coordinate
 * @param factor Relative zoom scale factor
 * @param minZoom Minimum permitted zoom (defaults to MIN_ZOOM = 0.25)
 * @param maxZoom Maximum permitted zoom (defaults to MAX_ZOOM = 3.0)
 * @returns New transformed viewport
 */
export function zoomAt(
  viewport: Viewport,
  screenPoint: Point,
  factor: number,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM
): Viewport {
  const newZoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * factor));
  if (newZoom === viewport.zoom) return viewport;

  const worldX = (screenPoint.x - viewport.x) / viewport.zoom;
  const worldY = (screenPoint.y - viewport.y) / viewport.zoom;

  return {
    zoom: newZoom,
    x: screenPoint.x - worldX * newZoom,
    y: screenPoint.y - worldY * newZoom,
  };
}
