import { LatLng, LatLngExpression, LineUtil, Map as LeafletMap, Point, Polygon } from 'leaflet';
import { DrawLineUtil } from './draw-line.util';

export class DrawPolygonUtil {
  static intersects(map: LeafletMap, polygon: Polygon): boolean {
    const points = this.getProjectedPoints(polygon, map);
    const len = points ? points.length : 0;
    let i;
    let p1;
    let p2;

    if (polygon.getLatLngs().length < 3) return false;

    for (i = len - 1; i >= 3; i--) {
      p1 = points[i - 1];
      p2 = points[i];
      if (this.lineSegmentsIntersectsRange(p1, p2, i - 2, map, polygon)) return true;
    }

    return false;
  }

  static newLatLngIntersects(map: LeafletMap, latlng: LatLng, skipFirst: boolean, polygon: Polygon): boolean {
    return this.newPointIntersects(map.latLngToLayerPoint(latlng), skipFirst, map, polygon);
  }

  static newPointIntersects(newPoint: Point, skipFirst: boolean, map: LeafletMap, polygon: Polygon): boolean {
    const points = this.getProjectedPoints(polygon, map);
    const len = points ? points.length : 0;
    const lastPoint = points ? points[len - 1] : null;
    // The previous previous line segment. Previous line segment doesn't need testing.
    const maxIndex = len - 2;
    if (polygon.getLatLngs().length < 3) return false;
    if (!lastPoint) return false;
    return this.lineSegmentsIntersectsRange(lastPoint, newPoint, maxIndex, map, polygon, skipFirst ? 1 : 0);
  }

  private static defaultShape(polygon: Polygon): LatLng[] {
    return (LineUtil.isFlat(polygon.getLatLngs() as LatLngExpression[]) ? polygon.getLatLngs() : polygon.getLatLngs()[0]) as LatLng[];
  }

  private static getProjectedPoints(polygon: Polygon, map: LeafletMap): Point[] {
    const points = [];
    const shape = this.defaultShape(polygon);
    for (let i = 0; i < shape.length; i++) points.push(map.latLngToLayerPoint(shape[i]));
    return points;
  }

  private static lineSegmentsIntersectsRange(p: Point, p1: Point, maxIndex: number, map: LeafletMap, polygon: Polygon, minIndex?: number): boolean {
    const points = this.getProjectedPoints(polygon, map);
    let p2: Point;
    let p3: Point;

    minIndex = minIndex || 0;

    // Check all previous line segments (beside the immediately previous) for intersections
    for (let j = maxIndex; j > minIndex; j--) {
      p2 = points[j - 1];
      p3 = points[j];

      if (DrawLineUtil.segmentsIntersect(p, p1, p2, p3)) return true;
    }

    return false;
  }
}
