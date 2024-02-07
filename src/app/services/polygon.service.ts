import { Injectable } from '@angular/core';
import { FeatureGroup, LatLng, Polygon } from 'leaflet';
import { ProductionUnit } from '../models/production-unit.model';

@Injectable({ providedIn: 'root' })
export class ProductionUnitsPolygonService {
  private readonly productionUnitsLayer: FeatureGroup = new FeatureGroup();
  private readonly productionUnits: Map<number, Polygon> = new Map();
  private selectedGeofences: Set<number> | undefined;

  setSelectedGeofences(ids: Set<number>): void {
    this.selectedGeofences = ids;
  }

  getSelectedGeofences(): Set<number> | undefined {
    return this.selectedGeofences;
  }

  getGeofenceLayer(): FeatureGroup {
    return this.productionUnitsLayer;
  }

  updateGeofencesLayer(units: ProductionUnit[]): void {
    const geoMap = new Map<number, ProductionUnit>(
      units.map((unit) => [unit.id, unit])
    );
    for (const [id] of this.productionUnits)
      if (!geoMap.has(id)) this.removeGeofenceFromLayer(id);
    for (const [, geofence] of geoMap) this.addGeofenceToLayer(geofence);
  }

  private addGeofenceToLayer(units: ProductionUnit): void {
    const latLngs = units.polygon.coordinates[0].map(
      (position) => new LatLng(position[1], position[0])
    );
    const actGeofence = this.productionUnits.get(units.id);
    if (actGeofence) {
      actGeofence.setLatLngs(latLngs);
      actGeofence.setStyle({ color: units.color });
    } else {
      const poly = new Polygon(latLngs, { color: units.color });
      poly
        .bindTooltip(units.name, { permanent: true, direction: 'center' })
        .openTooltip();
      this.productionUnitsLayer.addLayer(poly);
      this.productionUnits.set(units.id, poly);
    }
  }

  private removeGeofenceFromLayer(productionUnitId: number): void {
    const geofence = this.productionUnits.get(productionUnitId);
    if (!geofence) return;
    this.productionUnitsLayer.removeLayer(geofence);
    this.productionUnits.delete(productionUnitId);
  }
}
