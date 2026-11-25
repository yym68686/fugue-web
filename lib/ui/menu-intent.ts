export type Point = { x: number; y: number };

export function followsSubmenu(
  point: Point,
  origin: Point,
  bounds: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
) {
  const edge = Math.abs(bounds.left - origin.x) < Math.abs(bounds.right - origin.x)
    ? bounds.left
    : bounds.right;
  const distance = edge - origin.x;
  if (distance === 0) return false;
  const progress = (point.x - origin.x) / distance;
  if (progress < 0 || progress > 1) return false;
  const top = origin.y + (bounds.top - origin.y) * progress;
  const bottom = origin.y + (bounds.bottom - origin.y) * progress;
  return point.y >= top && point.y <= bottom;
}
