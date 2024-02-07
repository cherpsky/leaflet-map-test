import { ComponentRef, ViewContainerRef } from '@angular/core';
import { Control, FeatureGroup, Map as LeafletMap } from 'leaflet';
import { DrawToolbarComponent } from './components/draw-toolbar/draw-toolbar.component';
import { DrawControlOptions, DrawToolBarOption } from './draw-control.type';
import { DrawHandler, DrawPolygonHandler, DrawPolylineHandler, DrawMarkerHandler } from './handlers';
import { MapDrawTools } from './map-draw-tools.enum';

export class DrawControl extends Control {
  override options: DrawControlOptions;
  private toolBar: ComponentRef<DrawToolbarComponent> | undefined;

  private currentTools: MapDrawTools[] | undefined;

  private readonly mapHandlers: Map<MapDrawTools, DrawHandler>;
  private readonly mapLayers: Map<MapDrawTools, FeatureGroup>;
  private readonly toolTxt: Map<MapDrawTools, string>;

  constructor(private readonly mapViewContainer: ViewContainerRef, options: DrawControlOptions) {
    super(options);
    this.options = options;
    this.toolBar = this.mapViewContainer.createComponent(DrawToolbarComponent);
    this.mapLayers = new Map();
    this.toolTxt = new Map();
    this.mapHandlers = new Map();
    this.initTxtMap();
  }

  override onAdd(map: LeafletMap): HTMLElement {
    map;
    if (!this.toolBar) return document.createElement('div');
    this.currentTools = this.getToolsToCreate();
    this.createToolsLayers();
    this.addLayers();
    this.initHandlerMap(map);
    this.setToolBarInput(this.toolBar);
    return this.toolBar.instance.getContent().nativeElement;
  }

  override onRemove(map: LeafletMap): void {
    map;
    this.removeHandlers();
    this.removeLayers();
    this.mapViewContainer.clear();
  }

  private setToolBarInput(toolBar: ComponentRef<DrawToolbarComponent>): void {
    toolBar.setInput(
      'tools',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.currentTools?.map((tool): DrawToolBarOption => ({ tool: tool as any, handler: this.mapHandlers.get(tool)! as any })),
    );
    toolBar.setInput('position', this.getPosition().includes('right') ? 'right' : 'left');
    toolBar.setInput('open', this.options.draw?.open);
  }

  private addLayers(): void {
    this.mapLayers.forEach((layer, key) => {
      this.options.layerControl.addOverlay(layer, this.toolTxt.get(key) ?? 'NONE');
      this.options.map.addLayer(layer);
    });
  }

  private createToolsLayers(): void {
    if (!this.currentTools) return;
    this.currentTools.forEach((tool) => this.mapLayers.set(tool, new FeatureGroup()));
  }

  private getToolsToCreate(): MapDrawTools[] {
    const { draw } = this.options;
    if (!draw) return [];
    const { open, ...tools } = draw;
    open;
    if (!tools) return [];
    const keys: Set<MapDrawTools> = new Set();
    Object.keys(tools)
      .filter((key) => tools[key as MapDrawTools])
      .forEach((val) => keys.add(val as MapDrawTools));
    return Array.from(keys);
  }

  private initTxtMap(): void {
    this.toolTxt.set(MapDrawTools.CIRCLE, 'Draw CIRCLE');
    this.toolTxt.set(MapDrawTools.SQUARE, 'Draw SQUARE');
    this.toolTxt.set(MapDrawTools.POLYGON, 'Draw POLYGON');
    this.toolTxt.set(MapDrawTools.POLYLINE, 'Draw POLYLINE');
    this.toolTxt.set(MapDrawTools.ADD_LOCATION, 'Draw MARKER');
  }

  private initHandlerMap(map: LeafletMap): void {
    const polylineOptions = this.options.draw ? this.options.draw[MapDrawTools.POLYLINE] : undefined;
    const polygonOptions = this.options.draw ? this.options.draw[MapDrawTools.POLYGON] : undefined;
    const markerOptions = this.options.draw ? this.options.draw[MapDrawTools.ADD_LOCATION] : undefined;
    if (this.mapLayers.get(MapDrawTools.POLYLINE) && polylineOptions)
      this.mapHandlers.set(MapDrawTools.POLYLINE, new DrawPolylineHandler(map, this.mapLayers.get(MapDrawTools.POLYLINE)!, polylineOptions));
    if (this.mapLayers.get(MapDrawTools.POLYGON) && polygonOptions)
      this.mapHandlers.set(MapDrawTools.POLYGON, new DrawPolygonHandler(map, this.mapLayers.get(MapDrawTools.POLYGON)!, polygonOptions));
    if (this.mapLayers.get(MapDrawTools.ADD_LOCATION) && markerOptions)
      this.mapHandlers.set(MapDrawTools.ADD_LOCATION, new DrawMarkerHandler(map, this.mapLayers.get(MapDrawTools.ADD_LOCATION)!, markerOptions));
  }

  private removeHandlers(): void {
    this.mapHandlers.forEach((handler) => handler.removeHooks());
  }

  private removeLayers(): void {
    this.mapLayers.forEach((layer) => {
      this.options.layerControl.removeLayer(layer);
      this.options.map.removeLayer(layer);
    });

    this.mapLayers.clear();
  }
}
