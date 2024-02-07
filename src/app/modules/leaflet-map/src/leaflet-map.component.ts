import {
  AfterViewInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  Control,
  ControlPosition,
  LatLng,
  LatLngBounds,
  LatLngExpression,
  LayersControlEvent,
  LeafletMouseEvent,
  Map,
  MapOptions,
  Marker,
  Polygon,
  TileLayer,
  map,
  tileLayer,
} from 'leaflet';
import 'leaflet.markercluster';
import { MeasurementControlComponent } from './controls';
import { DrawControl } from './draw';
import {
  DrawMarkerEvents,
  DrawPolygonEvents,
  DrawPolylineEvents,
} from './draw/enums';
import {
  DrawMarkerArray,
  DrawMarkerResult,
  DrawPolygonArray,
  DrawPolygonResult,
  DrawPolylineArray,
  DrawPolylineResult,
} from './draw/types';
import { MeasurementHandler } from './handlers';
import { DrawCircleHandler } from './handlers/draw-circle.handler';
import { DrawRectangleHandler } from './handlers/draw-rectangle.handler';
import { LeafletMapDrawOptions, LeafletMapLayer } from './leaflet-map.type';
import { LeafletControl } from './types';
import { MapLayers } from 'common/map-layers.enum';
@Component({
  selector: 'app-leaflet-map',
  templateUrl: './leaflet-map.component.html',
  styleUrls: ['./leaflet-map.component.scss'],
})
export class LeafletMapComponent implements AfterViewInit, OnChanges {
  @Input() useGoogle = false;
  @Input() mapOptions: MapOptions | undefined;
  @Input() drawOptions: LeafletMapDrawOptions | undefined;
  @Input() zoomControlPosition: ControlPosition | 'none' = 'topleft';
  @Input() layerControlPosition: ControlPosition = 'topright';
  @Input() mapLayers: MapLayers[] = [
    MapLayers.OPEN_STREET_MAP,
    MapLayers.GOOGLE_MAPS,
  ];

  @Output() mapClicked = new EventEmitter<LeafletMouseEvent>();
  @Output() markerEdited = new EventEmitter<DrawMarkerArray>();
  @Output() markerPlaced = new EventEmitter<Marker>();
  @Output() polylineEdited = new EventEmitter<DrawPolylineArray>();
  @Output() polygonEdited = new EventEmitter<DrawPolygonArray>();
  @Output() polygonClosed = new EventEmitter<Polygon>();
  @Output() mapReady = new EventEmitter();

  @ViewChild('map') mapElement: HTMLDivElement | undefined;
  @ViewChild(MeasurementControlComponent)
  measurementControl?: MeasurementControlComponent;

  @ContentChildren('control') projectedControls:
    | QueryList<LeafletControl>
    | undefined;

  private map: Map | undefined;
  private drawControl: DrawControl | undefined;
  private openStreetLayer: TileLayer | undefined;
  private trafficLayer: TileLayer | undefined;
  private zoomControl: Control.Zoom | undefined;
  private baseLayers: TileLayer[] = [];
  private mainLayer: TileLayer | undefined;

  private readonly defaultCenter: LatLngExpression = new LatLng(
    39.8282,
    -98.5795
  );
  private readonly layerControl: Control.Layers;

  constructor(
    private readonly viewRef: ViewContainerRef,
    private readonly zone: NgZone
  ) {
    this.layerControl = new Control.Layers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const drawOptionsChanges = changes['drawOptions'];
    const mapOptionsChanges = changes['mapOptions'];
    const zoomControlPositionChanged = changes['zoomControlPosition'];
    const layerControlPositionChanged = changes['layerControlPosition'];
    const mapLayersChanged = changes['mapLayers'];
    if (drawOptionsChanges) this.updateDrawControl();
    if (mapOptionsChanges && !mapOptionsChanges.firstChange)
      this.mapOptionsChange();
    if (zoomControlPositionChanged) this.zoomControlPositionChanged();
    if (layerControlPositionChanged) this.layerControlPositionChanged();
    if (mapLayersChanged) this.addBaseLayers();
  }

  ngAfterViewInit(): void {
    this.callInitMap();
  }

  addLayer(layer: LeafletMapLayer): void {
    if (!this.map) return;
    this.layerControl.addOverlay(layer.layer, layer.name);
    this.map.addLayer(layer.layer);
  }

  fitBounds(bounds: LatLngBounds): void {
    if (!this.map) return;
    this.map.fitBounds(bounds, { animate: true, padding: [50, 50] });
  }

  getCurrentPosition(): { center: LatLng; zoom: number } | undefined {
    if (!this.map) return undefined;
    return { center: this.map.getCenter(), zoom: this.map.getZoom() };
  }

  handleProjectedControls(): void {
    if (!this.map) return;
    this.projectedControls?.forEach((control) => {
      control.addTo(this.map!);
    });
  }

  subscribeToProjectedControls(): void {
    if (!this.projectedControls || !this.map) return;
    this.projectedControls.changes.subscribe(
      (list: QueryList<LeafletControl>) => {
        list.forEach((control) => control.addTo(this.map!));
      }
    );
  }

  setPosition(position: { center: LatLng; zoom?: number }): void {
    if (!this.map) return undefined;
    this.map.setView(position.center, position.zoom);
  }

  removeLayer(layer: LeafletMapLayer): void {
    this.layerControl.removeLayer(layer.layer);
  }

  private addDefaultHandlers(): void {
    this.map?.addHandler('polyDistance', MeasurementHandler);
    this.map?.addHandler('drawCircle', DrawCircleHandler);
    this.map?.addHandler('drawRectangle', DrawRectangleHandler);
  }

  private addListenersToMap(): void {
    if (!this.map) return;
    this.map.on(DrawPolylineEvents.DRAW_POLYLINE_SAVE, (data) =>
      this.polylineEdited.emit(
        (data as unknown as DrawPolylineResult).polylineArray
      )
    );
    this.map.on(DrawPolygonEvents.DRAW_POLYGON_SAVE, (data) =>
      this.polygonEdited.emit(
        (data as unknown as DrawPolygonResult).polygonArray
      )
    );
    this.map.on(DrawPolygonEvents.DRAW_POLYGON_END, (data) =>
      this.polygonClosed.emit((data as unknown as { polygon: Polygon }).polygon)
    );
    this.map.on(DrawPolygonEvents.DRAW_POLYGON_EDITED, (data) =>
      this.polygonClosed.emit((data as unknown as { polygon: Polygon }).polygon)
    );
    this.map.on(DrawMarkerEvents.DRAW_MARKER_SAVE, (data) =>
      this.markerEdited.emit((data as unknown as DrawMarkerResult).markersArray)
    );
    this.map.on(DrawMarkerEvents.DRAW_MARKER_EDITED, (data) => {
      const markersArray: DrawMarkerArray = [
        (data as unknown as { marker: Marker }).marker,
      ];
      this.markerEdited.emit(markersArray);
    });
    this.map.on(DrawMarkerEvents.DRAW_MARKER_END, (data) =>
      this.markerPlaced.emit((data as unknown as { marker: Marker }).marker)
    );
  }

  private callInitMap(): void {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        this.initMap();
      }, 1000);
    });
  }

  private initMap(): void {
    if (!this.mapElement) return;
    this.map = map(
      'map',
      this.mapOptions
        ? { ...this.mapOptions, preferCanvas: false }
        : { center: this.defaultCenter, zoom: 3, preferCanvas: false }
    );
    this.mapReady.emit();
    this.addListenersToMap();
    this.addBaseLayers();
    this.addTrafficLayer();
    this.map.addControl(this.layerControl);
    this.map.on('baselayerchange', this.handleBaseLayerChange.bind(this));
    this.addZoomControl();
    this.updateDrawControl();
    this.map.on('click', this.mapClickedFn.bind(this));
    this.removeTag();
    this.measurementControl?.addTo(this.map);
    this.handleProjectedControls();
    this.subscribeToProjectedControls();
    this.addDefaultHandlers();
  }

  private addZoomControl(): void {
    if (this.map && this.zoomControlPosition !== 'none') {
      this.zoomControl = new Control.Zoom({
        position: this.zoomControlPosition,
      });
      this.zoomControl.addTo(this.map);
    }
  }

  private addBaseLayers(): void {
    if (!this.map) return;
    this.removeBaseLayers();
    if (this.useGoogle && this.mapLayers.includes(MapLayers.GOOGLE_MAPS))
      this.addGoogleLayers(true);
    if (
      this.mapLayers.includes(MapLayers.OPEN_STREET_MAP) &&
      !(this.useGoogle && this.mapLayers.includes(MapLayers.GOOGLE_MAPS))
    )
      this.addOpenStreetMapLayer(true);
    else if (this.mapLayers.includes(MapLayers.OPEN_STREET_MAP))
      this.addOpenStreetMapLayer(false);
  }

  private addGoogleLayers(mainLayer: boolean): void {
    if (!this.map) return;
    const street = this.getGoogleStreetViewLayer();
    if (mainLayer) {
      this.mainLayer = street;
      this.mainLayer.addTo(this.map);
    }
    this.baseLayers.push(street);
    this.layerControl.addBaseLayer(street, 'Google Street');
    const terrain = this.getGoogleTerrainLayer();
    this.baseLayers.push(terrain);
    this.layerControl.addBaseLayer(terrain, 'Google Terrain');
    const satellite = this.getGoogleSatelliteLayer();
    this.baseLayers.push(satellite);
    this.layerControl.addBaseLayer(satellite, 'Google Satellite');
  }

  private addOpenStreetMapLayer(mainLayer: boolean): void {
    if (!this.map) return;
    const openStreet = this.getOpenStreetMapLayer();
    if (mainLayer) {
      this.mainLayer = openStreet;
      this.mainLayer.addTo(this.map);
    }
    this.baseLayers.push(openStreet);
    this.layerControl.addBaseLayer(openStreet, 'Open Street');
  }

  private addTrafficLayer(): void {
    if (!this.map) return;
    if (
      this.useGoogle &&
      !this.trafficLayer &&
      this.mapLayers.includes(MapLayers.GOOGLE_MAPS)
    ) {
      this.trafficLayer = this.getGoogleTrafficLayer();
      this.layerControl.addOverlay(this.trafficLayer, 'Traffic');
    }
  }

  private getGoogleStreetViewLayer(): TileLayer {
    return tileLayer(
      'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&style=sv',
      {
        maxZoom: 20,
        minZoom: 3,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    );
  }

  private getGoogleTerrainLayer(): TileLayer {
    return tileLayer(
      'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&style=sv',
      {
        maxZoom: 20,
        minZoom: 3,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    );
  }

  private getGoogleSatelliteLayer(): TileLayer {
    return tileLayer(
      'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&style=sv',
      {
        maxZoom: 20,
        minZoom: 3,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    );
  }

  private getGoogleTrafficLayer(): TileLayer {
    return tileLayer(
      'https://{s}.google.com/vt/lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        minZoom: 3,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    );
  }

  private getOpenStreetMapLayer(): TileLayer {
    this.openStreetLayer = tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 20,
        minZoom: 3,
      }
    );
    return this.openStreetLayer;
  }

  private handleBaseLayerChange(event: LayersControlEvent): void {
    if (event.layer == this.openStreetLayer) this.removeTrafficLayer();
    else this.addTrafficLayer();
    this.removeTag();
  }

  private mapClickedFn(eve: LeafletMouseEvent): void {
    this.mapClicked.emit(eve);
  }

  private mapOptionsChange(): void {
    if (!this.mapOptions) this.map?.setView(this.defaultCenter, 3);
    else this.map?.setView(this.mapOptions.center!, this.mapOptions.zoom);
  }

  private zoomControlPositionChanged(): void {
    if (this.zoomControlPosition !== 'none') {
      if (!this.zoomControl) this.addZoomControl();
      this.zoomControl?.setPosition(this.zoomControlPosition);
    } else if (this.zoomControl) this.map?.removeControl(this.zoomControl);
  }

  private layerControlPositionChanged(): void {
    this.layerControl.setPosition(this.layerControlPosition);
    this.measurementControl?.setPosition(this.layerControlPosition);
  }

  private removeBaseLayers(): void {
    if (!this.map) return;
    for (const layer of this.baseLayers) this.layerControl.removeLayer(layer);
    this.baseLayers = [];
    this.mainLayer?.removeFrom(this.map);
  }

  private removeTrafficLayer(): void {
    if (!this.map) return;
    if (this.trafficLayer) {
      this.layerControl.removeLayer(this.trafficLayer);
      this.map.removeLayer(this.trafficLayer);
      this.trafficLayer = undefined;
    }
  }

  private updateDrawControl(): void {
    console.log('REACHED', this.drawOptions);
    if (!this.map) return;
    if (this.drawControl) this.map.removeControl(this.drawControl);
    if (!this.drawOptions || !this.drawOptions.draw) return;

    this.drawControl = new DrawControl(this.viewRef, {
      position: this.drawOptions.position,
      draw: this.drawOptions.draw,
      layerControl: this.layerControl,
      map: this.map,
    });
    this.map.addControl(this.drawControl);
  }

  private removeTag(): void {
    document.body.querySelector("a[href='https://leafletjs.com']")?.remove();
  }

  public addControl(control: Control): void {
    this.map?.addControl(control);
  }

  public removeControl(control: Control): void {
    this.map?.removeControl(control);
  }
}
