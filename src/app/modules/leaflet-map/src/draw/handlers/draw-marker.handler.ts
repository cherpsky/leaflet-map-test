import {
  divIcon,
  DivIcon,
  DomEvent,
  FeatureGroup,
  Handler,
  Icon,
  LatLng,
  LeafletEvent,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
  Point,
} from 'leaflet';
import { DrawMarkerOptions, TooltipText } from '../draw-control.type';
import { DrawTooltip } from '../draw-tooltip';
import { DrawMarkerEvents } from '../enums';
import {
  DrawMarkerContext,
  DrawMarkerEditContext,
  DrawMarkerEventContext,
  DrawMarkerLayers,
  DrawMarkerPreserveData,
  DrawMarkerResult,
  DrawMarkerSettings,
} from '../types';

export class DrawMarkerHandler extends Handler {
  private disableMarkers = false;
  private drawContext: DrawMarkerContext;
  private editContext: DrawMarkerEditContext;
  private eventContext: DrawMarkerEventContext;
  private layerVisible = false;
  private layers!: DrawMarkerLayers;
  private mouseMarker: Marker | undefined;
  private preserveData!: DrawMarkerPreserveData;
  private preserveDataBeforeEdit: DrawMarkerPreserveData | undefined;
  private settings: DrawMarkerSettings;

  constructor(private readonly map: LeafletMap, private featureGroup: FeatureGroup, private options: DrawMarkerOptions) {
    super(map);
    this.initLayers();
    this.settings = this.getDefaultSettings();
    this.initPreserveData();
    this.editContext = { previousLocation: undefined };
    this.drawContext = this.getNewDrawContext();
    this.eventContext = this.getNewEventContext();
    this.layerVisible = this.map.hasLayer(this.featureGroup);
    this.map.on('overlayadd', () => this.layerVisibilityChange());
    this.map.on('overlayremove', () => this.layerVisibilityChange());
  }

  override addHooks(): void {
    if (!this.options.draw && (!this.options.edit || !this.options.edit.markers.length)) return;
    if (this.options.draw && !this.drawContext.editMode) this.initDrawMode();
    else this.initEditMode();

    if (this.shouldDisable()) {
      this.disable();
      this.drawContext = this.getNewDrawContext();
      this.removeMouseMaker();
      this.changePreserveDataToDrawMode();
    }
    this.map.on('mousemove', this.onMouseMove, this);
    this.map.on('zoomlevelschange', this.onZoomEnd, this);
    this.map.on('zoomend', this.onZoomEnd, this);
  }

  override disable(): this {
    super.disable();
    this.map.fire(DrawMarkerEvents.DRAW_MARKER_DISABLED);
    return this;
  }

  cancel(): void {
    if (!this.drawContext.editMode) this.cancelDraw();
    else this.cancelEdit();
  }

  changeEditMode(): void {
    if (this.drawContext.editMode && this.options.draw) {
      this.initDrawMode();
      this.removeEditMarkersListener();
    } else this.initEditMode();
  }

  override enable(): this {
    super.enable();
    this.map.fire(DrawMarkerEvents.DRAW_MARKER_ENABLED);
    return this;
  }

  finishShape(): void {
    if (!this.drawContext || !this.drawContext.marker) return;
    if (!this.shapeIsValid()) return;
    this.fireCreatedEvent();
    this.preserveCurrentDrawContext();
    this.disable();
    if (this.options.multiple) this.enable();
    else {
      this.drawContext = this.getNewDrawContext();
      this.removeMouseMaker();
      this.changePreserveDataToDrawMode();
    }
  }

  getEditMode(): boolean {
    return this.drawContext.editMode;
  }

  getDrawAvailable(): boolean {
    return this.options.draw;
  }

  getMap(): LeafletMap {
    return this.map;
  }

  override removeHooks(): void {
    this.removeMouseMaker();
    this.drawContext = this.getNewDrawContext();
    this.clearLayers();
    this.map.off('mousemove', this.onMouseMove, this);
    this.map.off('zoomlevelschange', this.onZoomEnd, this);
    this.map.off('zoomend', this.onZoomEnd, this);
  }

  save(): void {
    if (this.drawContext.editMode) this.preserveDataBeforeEdit = this.getClonePreserveData();
    const result: DrawMarkerResult = { markersArray: this.preserveData.markersArray };
    this.map.fire(DrawMarkerEvents.DRAW_MARKER_SAVE, result);
    this.removeHooks();
  }

  private addLatLngTxtToAllMarkers(): void {
    this.preserveData.markersArray.forEach((marker, index) => {
      if (marker) this.addLatLngTxtToMarker(marker, index);
    });
  }

  private addLatLngTxtToMarker(marker: Marker, toolTipIndex: number): void {
    const latLngTxt = `${marker.getLatLng().lat}, ${marker.getLatLng().lng}`;
    const txt: TooltipText = { text: 'Lat, Lng', subText: latLngTxt };
    this.preserveData.tooltipArray[toolTipIndex]?.updatePosition(marker.getLatLng());
    this.preserveData.tooltipArray[toolTipIndex]?.updateContent(txt);
  }

  private addMouseMarker(): void {
    if (this.mouseMarker) return;
    this.mouseMarker = new Marker(this.map.getCenter(), {
      icon: divIcon({
        className: 'leaflet-mouse-marker',
        iconAnchor: [20, 20],
        iconSize: [40, 40],
      }),
      opacity: 0,
      zIndexOffset: this.settings.zIndexOffset,
    });

    this.mouseMarker.on('mouseout', this.onMouseOut, this);
    this.mouseMarker.on('mousemove', this.onMouseMove, this);
    this.mouseMarker.on('mousedown', this.onMouseDown, this);
    this.mouseMarker.on('mouseup', this.onMouseUp, this);
    this.mouseMarker.addTo(this.map);
  }

  private addVertex(latLng: LatLng): void {
    if (!this.drawContext || this.drawContext.marker) return;
    this.drawContext.marker = this.createMarker(latLng, this.settings.icon);
    this.drawContext.marker.addTo(this.layers.drawLayer);
    this.finishShape();
  }

  private cancelDraw(): void {
    this.initDrawMode();
  }

  private cancelEdit(): void {
    this.clearLayers();
    this.preserveData = this.preserveDataBeforeEdit ? this.preserveDataBeforeEdit : { markersArray: [], tooltipArray: [] };
    this.preserveDataBeforeEdit = undefined;
    this.initEditMode();
  }

  private changePreserveDataToDrawMode(): void {
    this.clearLayers();
    this.preserveData.markersArray.forEach((marker, index) => {
      if (!marker) return;
      const markerN = this.createMarker(marker.getLatLng(), this.settings.icon);
      markerN.addTo(this.layers.markersLayers);
      this.preserveData.tooltipArray[index]?.addTo(this.layers.tooltipLayers);
      this.preserveData.markersArray[index] = markerN;
    });
    this.addLatLngTxtToAllMarkers();
  }

  private changePreserveDataToEditMode(): void {
    this.clearLayers();
    this.preserveData.markersArray.forEach((marker, index) => {
      if (!marker) return;
      const markerN = this.createEditableMarker(marker.getLatLng(), this.settings.icon, index);
      markerN.addTo(this.layers.markersLayers);
      this.preserveData.tooltipArray[index]?.addTo(this.layers.tooltipLayers);
      this.preserveData.markersArray[index] = markerN;
    });
    this.addLatLngTxtToAllMarkers();
  }

  private clearDrawLayer(): void {
    this.layers.drawLayer.clearLayers();
  }

  private clearLayers(): void {
    this.clearDrawLayer();
    this.clearMarkerLayers();
    this.clearTooltipLayers();
  }

  private clearMarkerLayers(): void {
    this.layers.markersLayers.clearLayers();
  }

  private clearTooltipLayers(): void {
    this.preserveData.tooltipArray.forEach((tooltip) => tooltip?.dispose());
  }

  private createEditableMarker(latLng: LatLng, icon: DivIcon | Icon, polygonIndex: number): Marker {
    const marker = new Marker(latLng, {
      icon,
      zIndexOffset: this.settings.zIndexOffset * 2,
      draggable: true,
    });
    marker.on('dragstart', (event) => this.onMarkerDragStart(event));
    marker.on('drag', (event) => this.onMarkerDrag(event, polygonIndex));
    marker.on('dragend', () => this.onMarkerDragEnd(polygonIndex));
    marker.on('touchend', () => this.fireEditEvent(polygonIndex), this);
    marker.on('MSPointerUp', () => this.fireEditEvent(polygonIndex), this);
    return marker;
  }

  private createMarker(latLng: LatLng, icon: DivIcon | Icon): Marker {
    return new Marker(latLng, { icon, zIndexOffset: this.settings.zIndexOffset * 2 });
  }

  private disableNewMarkers(): void {
    this.disableMarkers = true;
  }

  private enableNewMarkers(): void {
    setTimeout(
      ((): void => {
        this.disableMarkers = false;
      }).bind(this),
      50,
    );
  }

  private endPoint(clientX: number, clientY: number, event: LeafletMouseEvent): void {
    if (!this.eventContext.mouseDownOrigin) return;
    else {
      const dragCheckDistance = new Point(clientX, clientY).distanceTo(this.eventContext.mouseDownOrigin);
      if (Math.abs(dragCheckDistance) < 9 * (window.devicePixelRatio || 1)) this.addVertex(event.latlng);
    }
    this.enableNewMarkers(); // after a short pause, enable new markers
    this.eventContext.mouseDownOrigin = undefined;
  }

  private fireCreatedEvent(): void {
    if (!this.drawContext.marker) return;
    const marker = new Marker(this.drawContext.marker.getLatLng(), this.options.shapeOptions);
    this.map.fire(DrawMarkerEvents.DRAW_MARKER_END, { marker: marker });
  }

  private fireEditEvent(index: number): void {
    const marker = this.preserveData.markersArray[index];
    const newMarker = marker ? new Marker(marker.getLatLng(), this.options.shapeOptions) : undefined;
    this.map.fire(DrawMarkerEvents.DRAW_MARKER_EDITED, { marker: newMarker });
  }

  private getClonePreserveData(): DrawMarkerPreserveData {
    const data: DrawMarkerPreserveData = { markersArray: [], tooltipArray: [] };
    this.preserveData.markersArray.forEach((marker) =>
      data.markersArray.push(marker ? this.createMarker(marker.getLatLng(), this.settings.icon) : undefined),
    );
    data.tooltipArray = this.preserveData.tooltipArray.map(() => new DrawTooltip(this.map, true));
    return data;
  }

  private getDefaultSettings(): DrawMarkerSettings {
    return {
      drawError: {
        color: '#b00b00',
        timeout: 2500,
        message: '<strong>Error:</strong> shape edges cannot cross!',
      },
      icon: new Icon({
        iconUrl: 'leaflet-map/assets/map-icons/marker-icon.png',
        shadowUrl: 'leaflet-map/assets/map-icons/marker-shadow.png',
        iconAnchor: [12, 41],
      }),
      preserveIcon: new Icon({
        iconUrl: 'leaflet-map/assets/map-icons/marker-icon.png',
        shadowUrl: 'leaflet-map/assets/map-icons/marker-shadow.png',
        iconAnchor: [12, 41],
      }),
      zIndexOffset: 2000,
    };
  }

  private getNewDrawContext(): DrawMarkerContext {
    if (this.drawContext) {
      this.clearDrawLayer();
      this.drawContext.tooltip?.dispose();
    }
    return {
      currentLatLng: undefined,
      marker: undefined,
      tooltip: undefined,
      editMode: false,
    };
  }

  private getNewEventContext(): DrawMarkerEventContext {
    return { clickHandled: false, mouseDownOrigin: undefined, touchHandled: false };
  }

  private getPotentialLatLngString(): string {
    if (!this.drawContext || !this.drawContext.currentLatLng) return '';
    const currentLatLng = this.drawContext.currentLatLng;
    return `${currentLatLng.lat}, ${currentLatLng.lng}`;
  }

  private getTooltipText(): TooltipText {
    let labelText: TooltipText;
    if (!this.drawContext.marker) labelText = { text: 'Click to start add marker.', subText: this.getPotentialLatLngString() };
    else labelText = { text: 'Click save or edit.' };
    return labelText;
  }

  private initDrawMode(): void {
    this.drawContext = this.getNewDrawContext();
    this.changePreserveDataToDrawMode();
    this.drawContext.marker = undefined;
    this.drawContext.tooltip = new DrawTooltip(this.map);
    if (this.layerVisible) this.drawContext.tooltip.addTo(this.layers.drawLayer);
    this.addMouseMarker();
  }

  private initEditMode(): void {
    this.drawContext = this.getNewDrawContext();
    this.removeMouseMaker();
    this.drawContext.editMode = true;
    this.preserveDataBeforeEdit = this.getClonePreserveData();
    this.changePreserveDataToEditMode();
  }

  private initLayers(): void {
    this.layers = {
      drawLayer: new FeatureGroup(),
      markersLayers: new FeatureGroup(),
      tooltipLayers: new FeatureGroup(),
    };
    this.layers.drawLayer.addTo(this.featureGroup);
    this.layers.markersLayers.addTo(this.featureGroup);
    this.layers.tooltipLayers.addTo(this.featureGroup);
  }

  private initPreserveData(): void {
    const markersArray: Marker[] = [];
    const tooltipArray: DrawTooltip[] = [];
    if (this.options.edit && this.options.edit.markers)
      this.options.edit.markers.forEach((marker) => {
        const latLng = marker.getLatLng();
        markersArray.push(this.createMarker(latLng, this.settings.icon));
        const tooltip = new DrawTooltip(this.map, true);
        tooltipArray.push(tooltip);
      });
    this.preserveData = { markersArray, tooltipArray };
  }

  private layerVisibilityChange(): void {
    if (!this.layers.drawLayer) return;
    const newValue = this.map.hasLayer(this.layers.drawLayer);
    if (newValue && !this.layerVisible) {
      this.addLatLngTxtToAllMarkers();
      this.drawContext.tooltip?.addTo(this.layers.drawLayer);
    }
    this.layerVisible = newValue;
    if (this.layerVisible) return;
    this.preserveData.tooltipArray.forEach((tooltip) => tooltip?.onMouseOut());
    if (this.drawContext.tooltip) this.drawContext.tooltip.onMouseOut();
  }

  private onMarkerDrag(event: LeafletEvent, markerIndex: number): void {
    const actMarkers = this.preserveData.markersArray[markerIndex];
    const actTooltip = this.preserveData.tooltipArray[markerIndex];
    event;
    if (!actMarkers || !actTooltip) return;
    this.addLatLngTxtToMarker(actMarkers, markerIndex);
  }

  private onMarkerDragEnd(polylineIndex: number): void {
    this.fireEditEvent(polylineIndex);
    this.editContext.previousLocation = undefined;
  }

  private onMarkerDragStart(event: LeafletEvent): void {
    this.editContext.previousLocation = (event.target as Marker).getLatLng();
  }

  private onMouseMove(event: LeafletMouseEvent): void {
    if (!this.layerVisible) return;
    const newPos = this.map.mouseEventToLayerPoint(event.originalEvent);
    const latLng = this.map.layerPointToLatLng(newPos);
    this.updateTooltip(latLng);
    if (this.mouseMarker) this.mouseMarker.setLatLng(latLng);
    DomEvent.preventDefault(event.originalEvent);
  }

  private onMouseDown(event: LeafletMouseEvent): void {
    if (!this.eventContext.clickHandled && !this.eventContext.touchHandled && !this.disableMarkers && this.layerVisible) {
      this.onMouseMove(event);
      this.eventContext.clickHandled = true;
      this.disableNewMarkers();
      const originalEvent = event.originalEvent;
      const clientX = originalEvent.clientX;
      const clientY = originalEvent.clientY;
      this.startPoint(clientX, clientY);
    }
  }

  private onMouseUp(event: LeafletMouseEvent): void {
    if (!this.layerVisible) return;
    const originalEvent = event.originalEvent;
    const clientX = originalEvent.clientX;
    const clientY = originalEvent.clientY;
    this.endPoint(clientX, clientY, event);
    this.eventContext.clickHandled = false;
  }

  private onMouseOut(event: LeafletMouseEvent): void {
    event;
    if (this.drawContext.tooltip) this.drawContext.tooltip.onMouseOut();
  }

  private onZoomEnd(event: LeafletEvent): void {
    event;
    this.updatePreserveTooltipsPosition();
  }

  private preserveCurrentDrawContext(): void {
    this.preserveMarkers();
    this.preserveTooltip();
  }

  private preserveMarkers(): void {
    if (!this.drawContext.marker) return;
    const newMarker = this.createMarker(this.drawContext.marker.getLatLng(), this.settings.preserveIcon);
    this.drawContext.marker.addTo(this.layers.markersLayers);
    this.preserveData.markersArray.push(newMarker);
  }

  private preserveTooltip(): void {
    const tooltip = new DrawTooltip(this.map, true);
    tooltip.addTo(this.layers.tooltipLayers);
    this.preserveData.tooltipArray.push(tooltip);
  }

  private removeEditMarkerListener(marker: Marker): void {
    marker.off('dragstart');
    marker.off('drag');
    marker.off('dragend');
    marker.off('touchend');
    marker.off('MSPointerUp');
  }

  private removeEditMarkersListener(): void {
    this.preserveData.markersArray.forEach((marker) => (marker ? this.removeEditMarkerListener(marker) : undefined));
  }

  private removeMouseMaker(): void {
    if (!this.mouseMarker) return;
    this.mouseMarker.off('mousedown', this.onMouseDown, this);
    this.mouseMarker.off('mouseout', this.onMouseOut, this);
    this.mouseMarker.off('mouseup', this.onMouseUp, this);
    this.mouseMarker.off('mousemove', this.onMouseMove, this);
    this.map.removeLayer(this.mouseMarker);
    this.mouseMarker = undefined;
  }

  private shapeIsValid(): boolean {
    return true;
  }

  private shouldDisable(): boolean {
    return (
      !this.options.multiple &&
      this.preserveData.markersArray.length > 0 &&
      this.preserveData.markersArray.length != this.options.edit?.markers.length
    );
  }

  private startPoint(clientX: number, clientY: number): void {
    this.eventContext.mouseDownOrigin = new Point(clientX, clientY);
  }

  private updatePreserveTooltipsPosition(): void {
    this.preserveData.markersArray.forEach((marker, index) => {
      const tooltip = this.preserveData.tooltipArray[index];
      if (marker && tooltip) tooltip.updatePosition(marker.getLatLng());
    });
  }

  private updateTooltip(latLng?: LatLng): void {
    const text = this.getTooltipText();
    if (latLng && this.drawContext.tooltip) this.drawContext.tooltip.updatePosition(latLng);
    if (this.drawContext.tooltip) this.drawContext.tooltip.updateContent(text);
  }
}
