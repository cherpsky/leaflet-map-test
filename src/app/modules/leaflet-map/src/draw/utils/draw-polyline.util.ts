import { LatLng, LatLngExpression, Map as LeafletMap, LineUtil, Point, Polyline } from 'leaflet';
import { GeometryUtil } from './draw-geometry.util';
import { DrawLineUtil } from './draw-line.util';

export class DrawPolylineUtil {
  static getLatLngBetweenInLineMarkers(latLngs: LatLng[]): LatLng[] {
    const result: LatLng[] = [];
    const endIndex = latLngs.length - 1;
    for (let index = 0; index < endIndex; index++) {
      const latLng1 = latLngs[index];
      const latLng2 = latLngs[index + 1];
      const midLatLng = GeometryUtil.getMidPoint(latLng1, latLng2);
      result.push(latLng1, midLatLng);
    }
    result.push(latLngs[endIndex]);
    return result;
  }

  static intersects(map: LeafletMap, polyline: Polyline): boolean {
    const points = this.getProjectedPoints(polyline, map);
    const len = points ? points.length : 0;
    let i;
    let p1;
    let p2;

    if (this.tooFewPointsForIntersection(0, map, polyline)) return false;

    for (i = len - 1; i >= 3; i--) {
      p1 = points[i - 1];
      p2 = points[i];
      if (this.lineSegmentsIntersectsRange(p1, p2, i - 2, map, polyline)) return true;
    }

    return false;
  }

  static newLatLngIntersects(map: LeafletMap, latlng: LatLng, skipFirst: boolean, polyline: Polyline): boolean {
    return this.newPointIntersects(map.latLngToLayerPoint(latlng), skipFirst, map, polyline);
  }

  static newPointIntersects(newPoint: Point, skipFirst: boolean, map: LeafletMap, polyline: Polyline): boolean {
    const points = this.getProjectedPoints(polyline, map);
    const len = points ? points.length : 0;
    const lastPoint = points ? points[len - 1] : null;
    // The previous previous line segment. Previous line segment doesn't need testing.
    const maxIndex = len - 2;
    if (this.tooFewPointsForIntersection(1, map, polyline)) return false;
    if (!lastPoint) return false;
    return this.lineSegmentsIntersectsRange(lastPoint, newPoint, maxIndex, map, polyline, skipFirst ? 1 : 0);
  }

  static filterLatLngsInSameLine(latLngs: LatLng[]): LatLng[] {
    if (!latLngs.length || latLngs.length < 2) return [];
    const result: LatLng[] = [];
    const endIndex = latLngs.length - 1;
    const startLatLng = latLngs[0];
    let lastIndexAdded = 0;
    let indexToVerify = 1;
    result.push(startLatLng);
    while (lastIndexAdded != endIndex) {
      const latLngToVerify = latLngs[indexToVerify];
      if (indexToVerify + 1 > endIndex || !GeometryUtil.isLatLngInMiddle(latLngs[lastIndexAdded], latLngToVerify, latLngs[indexToVerify + 1])) {
        result.push(latLngToVerify);
        lastIndexAdded = indexToVerify;
      }
      indexToVerify++;
    }
    return result;
  }

  private static tooFewPointsForIntersection(extraPoints: number, map: LeafletMap, polyline: Polyline): boolean {
    const points = this.getProjectedPoints(polyline, map);
    let len = points ? points.length : 0;
    // Increment length by extraPoints if present
    len += extraPoints;
    return !points || len <= 3;
  }

  private static lineSegmentsIntersectsRange(p: Point, p1: Point, maxIndex: number, map: LeafletMap, polyline: Polyline, minIndex?: number): boolean {
    const points = this.getProjectedPoints(polyline, map);
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

  private static getProjectedPoints(polyline: Polyline, map: LeafletMap): Point[] {
    const points = [];
    const shape = this.defaultShape(polyline);
    for (let i = 0; i < shape.length; i++) points.push(map.latLngToLayerPoint(shape[i]));
    return points;
  }

  private static defaultShape(polyline: Polyline): LatLng[] {
    return (LineUtil.isFlat(polyline.getLatLngs() as LatLngExpression[]) ? polyline.getLatLngs() : polyline.getLatLngs()[0]) as LatLng[];
  }
}
