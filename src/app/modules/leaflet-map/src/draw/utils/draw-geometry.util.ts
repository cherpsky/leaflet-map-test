import { LatLng, Util } from 'leaflet';

export class GeometryUtil {
  static defaultPrecision = {
    km: 2,
    ha: 2,
    m: 0,
    mi: 2,
    ac: 2,
    yd: 0,
    ft: 0,
    nm: 2,
  };

  static formattedNumber(num: number, precision: number): string {
    return parseFloat(num.toString()).toFixed(precision);
  }

  static geodesicArea(latLngs: LatLng[]): number {
    const pointsCount = latLngs.length;
    let area = 0;
    const d2r = Math.PI / 180;
    let p1;
    let p2;

    if (pointsCount > 2) {
      for (let i = 0; i < pointsCount; i++) {
        p1 = latLngs[i];
        p2 = latLngs[(i + 1) % pointsCount];
        area += (p2.lng - p1.lng) * d2r * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
      }
      area = (area * 6378137.0 * 6378137.0) / 2.0;
    }

    return Math.abs(area);
  }

  static getMidPoint(pointA: LatLng, pointB: LatLng): LatLng {
    const lat = (pointA.lat + pointB.lat) / 2;
    const lng = (pointA.lng + pointB.lng) / 2;
    return new LatLng(lat, lng);
  }

  static isLatLngInMiddle(latLng1: LatLng, latLng2: LatLng, latLng3: LatLng): boolean {
    const m = (latLng1.lat - latLng3.lat) / (latLng1.lng - latLng3.lng);
    const xValue = m * (latLng2.lng - latLng1.lng) + latLng1.lat;
    return latLng2.lat == xValue;
  }

  static readableArea(area: number, precision: number): string {
    let areaStr: string;
    const newPrecision = Util.extend({}, this.defaultPrecision, precision);
    if (area >= 1000000) areaStr = this.formattedNumber(area * 0.000001, newPrecision['km']) + ' km²';
    else areaStr = this.formattedNumber(area, newPrecision['m']) + ' m²';
    return areaStr;
  }

  static readableDistance(distance: number, precision: number): string {
    let distanceStr;
    const newPrecision = Util.extend({}, this.defaultPrecision, precision);

    // show metres when distance is < 1km, then show km
    if (distance > 1000) distanceStr = GeometryUtil.formattedNumber(distance / 1000, newPrecision['km']) + ' km';
    else distanceStr = GeometryUtil.formattedNumber(distance, newPrecision['m']) + ' m';
    return distanceStr;
  }
}
