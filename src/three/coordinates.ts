import type { Point } from '../../shared/world';

// Keep the existing authoritative room protocol. Only the presentation changes.
export const METRES_X = .04;
export const METRES_Z = .07;
export function toWorld(p: Point) { return { x: (p.x - 600) * METRES_X, z: (p.y - 575) * METRES_Z }; }
export function toProtocol(x: number, z: number): Point { return { x: x / METRES_X + 600, y: z / METRES_Z + 575 }; }
