import { Point } from 'leaflet';

export class DrawLineUtil {
  static segmentsIntersect(p: Point, p1: Point, p2: Point, p3: Point): boolean {
    return (
      this.checkCounterclockwise(p, p2, p3) !== this.checkCounterclockwise(p1, p2, p3) &&
      this.checkCounterclockwise(p, p1, p2) !== this.checkCounterclockwise(p, p1, p3)
    );
  }

  // check to see if points are in counterclockwise order
  static checkCounterclockwise(p: Point, p1: Point, p2: Point): boolean {
    return (p2.y - p.y) * (p1.x - p.x) > (p1.y - p.y) * (p2.x - p.x);
  }
}
