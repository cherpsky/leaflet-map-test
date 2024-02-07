import {
  Browser,
  divIcon,
  DivIcon,
  DomEvent,
  DomUtil,
  FeatureGroup,
  Handler,
  LatLng,
  LeafletEvent,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
  Point,
  Polygon,
  Polyline,
  Util,
} from 'leaflet';
import { DrawPolygonOptions, TooltipText } from '../draw-control.type';
import { DrawTooltip } from '../draw-tooltip';
import { DrawPolygonEvents } from '../enums';
import {
  DrawPolygonContext,
  DrawPolygonEditContext,
  DrawPolygonEventContext,
  DrawPolygonLayers,
  DrawPolygonPreserveData,
  DrawPolygonSettings,
} from '../types';
import { DrawPolygonUtil, DrawPolylineUtil, GeometryUtil } from '../utils';

export class DrawPolygonHandler extends Handler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hideErrorTimeout: any | undefined = undefined;

  private disableMarkers = false;
  private drawContext: DrawPolygonContext;
  private editContext: DrawPolygonEditContext;
  private eventContext: DrawPolygonEventContext;
  private layerVisible = false;
  private layers!: DrawPolygonLayers;
  private maxPoints = 0;
  private mouseMarker: Marker | undefined;
  private preserveData!: DrawPolygonPreserveData;
  private preserveDataBeforeEdit: DrawPolygonPreserveData | undefined;
  private settings: DrawPolygonSettings;

  constructor(private readonly map: LeafletMap, private featureGroup: FeatureGroup, private options: DrawPolygonOptions) {
    super(map);
    this.initLayers();
    this.settings = this.getDefaultSettings();
    this.initPreserveData();
    this.editContext = { previousLocation: undefined, errorShown: false };
    this.drawContext = this.getNewDrawContext();
    this.eventContext = this.getNewEventContext();
    this.layerVisible = this.map.hasLayer(this.featureGroup);
    this.map.on('overlayadd', () => this.layerVisibilityChange());
    this.map.on('overlayremove', () => this.layerVisibilityChange());
  }

  override addHooks(): void {
    if (!this.options.draw && (!this.options.edit || !this.options.edit.polygon.length)) return;
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
    this.map.fire(DrawPolygonEvents.DRAW_POLYGON_DISABLED);
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
    this.map.fire(DrawPolygonEvents.DRAW_POLYGON_ENABLED);
    return this;
  }

  finishShape(): void {
    if (!this.drawContext || !this.drawContext.polygon) return;
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
    this.map.fire(DrawPolygonEvents.DRAW_POLYGON_SAVE, {
      polygonArray: this.preserveData.polygonArray.map((poly) => (poly ? new Polygon(poly.getLatLngs() as LatLng[][]) : undefined)),
    });
    this.removeHooks();
  }

  private addAreaTxtToAllCompletePolygons(): void {
    this.preserveData.polygonArray.forEach((polygon, index) => {
      if (polygon) this.addAreaTxtToCompletePolygon(polygon, index);
    });
  }

  private addAreaTxtToCompletePolygon(polygon: Polygon, toolTipIndex: number): void {
    const polygonLatLngs = (polygon.getLatLngs() as LatLng[][])[0];
    const totalDistance = GeometryUtil.geodesicArea(polygonLatLngs);
    const txt: TooltipText = { text: 'Distance', subText: GeometryUtil.readableArea(totalDistance, 2) };
    if (!polygonLatLngs[0]) return;
    this.preserveData.tooltipArray[toolTipIndex]?.updatePosition(polygonLatLngs[0]);
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
    if (!this.drawContext || !this.drawContext.markers || !this.drawContext.polygon || !this.drawContext.polyline) return;
    const markersLength = this.drawContext.markers.length ?? 0;
    if (markersLength >= 2 && this.drawContext.polygon && this.isNewPointValidVaseOnIntersect(latLng)) return;
    else if (this.eventContext.errorShown) this.hideErrorTooltip();
    const marker = this.createMarker(latLng, this.settings.icon);
    this.drawContext.markers.push(marker);
    if (this.drawContext.markers.length == 3) this.map.fire(DrawPolygonEvents.DRAW_POLYGON_START);
    marker.addTo(this.layers.drawLayer);
    this.drawContext.polygon.addLatLng(latLng);
    this.drawContext.polyline.addLatLng(latLng);
    const currentLatLngs = (this.drawContext.polygon.getLatLngs() as LatLng[][])[0];
    if (currentLatLngs.length === 2) this.layers.drawLayer.addLayer(this.drawContext.polyline);
    if (currentLatLngs.length === 3) this.layers.drawLayer.addLayer(this.drawContext.polygon);
    this.lastVertexChanged();
  }

  private calculateFinishDistance(potentialLatLng: LatLng): number {
    let lastPtDistance: number;
    if (this.drawContext.markers && this.drawContext.markers.length > 0) {
      const finishMarker = this.drawContext.markers[this.drawContext.markers.length - 1];
      lastPtDistance = finishMarker.getLatLng().distanceTo(potentialLatLng);
    } else lastPtDistance = Infinity;
    return lastPtDistance;
  }

  private cancelDraw(): void {
    this.initDrawMode();
  }

  private cancelEdit(): void {
    this.clearLayers();
    this.preserveData = this.preserveDataBeforeEdit ? this.preserveDataBeforeEdit : { markersArray: [], polygonArray: [], tooltipArray: [] };
    this.preserveDataBeforeEdit = undefined;
    this.initEditMode();
  }

  private changePreserveDataToDrawMode(): void {
    this.clearLayers();
    this.preserveData.polygonArray.forEach((polygon, index) => {
      if (!polygon) return;
      const polygonLatLngs = (polygon.getLatLngs() as LatLng[][])[0];
      const newLatLngs = DrawPolylineUtil.filterLatLngsInSameLine(polygonLatLngs);
      const newPolygon = new Polygon(newLatLngs);
      const markers = newLatLngs.map((latLng) => {
        const marker = this.createMarker(latLng, this.settings.icon);
        marker.addTo(this.layers.markersLayers);
        return marker;
      });
      newPolygon.addTo(this.layers.polygonsLayers);
      this.preserveData.polygonArray[index] = newPolygon;
      this.preserveData.tooltipArray[index]?.addTo(this.layers.tooltipLayers);
      this.preserveData.markersArray[index] = markers;
    });
    this.addAreaTxtToAllCompletePolygons();
  }

  private changePreserveDataToEditMode(): void {
    this.clearLayers();
    this.preserveData.polygonArray.forEach((polygon, index) => {
      if (!polygon) return;
      const polygonLatLngs = (polygon.getLatLngs() as LatLng[][])[0];
      const newLatLngs = DrawPolylineUtil.getLatLngBetweenInLineMarkers(polygonLatLngs);
      const markers = newLatLngs.map((latLng) => {
        const marker = this.createEditableMarker(latLng, this.settings.icon, index);
        marker.addTo(this.layers.markersLayers);
        return marker;
      });
      polygon = new Polygon(newLatLngs, this.options.shapeOptions);
      polygon.addTo(this.layers.polygonsLayers);
      this.preserveData.polygonArray[index] = polygon;
      this.preserveData.tooltipArray[index]?.addTo(this.layers.tooltipLayers);
      this.preserveData.markersArray[index] = markers;
    });
    this.addAreaTxtToAllCompletePolygons();
  }

  private clearDrawLayer(): void {
    this.layers.drawLayer.clearLayers();
  }

  private clearHideErrorTimeout(): void {
    if (!this.hideErrorTimeout) return;
    clearTimeout(this.hideErrorTimeout);
    this.hideErrorTimeout = undefined;
  }

  private clearGuides(): void {
    if (!this.drawContext || !this.drawContext.guidesContainer) return;
    while (this.drawContext.guidesContainer.firstChild) this.drawContext.guidesContainer.removeChild(this.drawContext.guidesContainer.firstChild);
  }

  private clearLayers(): void {
    this.clearDrawLayer();
    this.clearPolygonLayers();
    this.clearMarkerLayers();
    this.clearTooltipLayers();
  }

  private clearMarkerLayers(): void {
    this.layers.markersLayers.clearLayers();
  }

  private clearPolygonLayers(): void {
    this.layers.polygonsLayers.clearLayers();
  }

  private clearTooltipLayers(): void {
    this.preserveData.tooltipArray.forEach((tooltip) => tooltip?.dispose());
  }

  private createEditableMarker(latLng: LatLng, icon: DivIcon, polygonIndex: number): Marker {
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

  private createMarker(latLng: LatLng, icon: DivIcon): Marker {
    return new Marker(latLng, { icon, zIndexOffset: this.settings.zIndexOffset * 2 });
  }

  private disableNewMarkers(): void {
    this.disableMarkers = true;
  }

  private drawGuide(pointA: Point, pointB: Point): void {
    if (!this.drawContext || !this.layers.drawLayer) return;
    const length = Math.floor(Math.sqrt(Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)));
    const guidelineDistance = this.settings.guidelineDistance;
    const maxGuideLineLength = this.settings.maxGuideLineLength;
    let currentDrawDistance = length > maxGuideLineLength ? length - maxGuideLineLength : guidelineDistance;
    let fraction: number;
    let dashPoint: Point;
    let dash: HTMLDivElement;
    if (!this.drawContext.guidesContainer)
      this.drawContext.guidesContainer = DomUtil.create('div', 'leaflet-draw-guides', this.layers.drawLayer.getPane());
    for (; currentDrawDistance < length; currentDrawDistance += this.settings.guidelineDistance) {
      fraction = currentDrawDistance / length;
      dashPoint = new Point(Math.floor(pointA.x * (1 - fraction) + fraction * pointB.x), Math.floor(pointA.y * (1 - fraction) + fraction * pointB.y));
      dash = DomUtil.create('div', 'leaflet-draw-guide-dash', this.drawContext.guidesContainer);
      dash.style.backgroundColor = !this.eventContext.errorShown
        ? this.options.shapeOptions?.color || this.settings.shapeOptions.color
        : this.settings.drawError.color;
      DomUtil.setPosition(dash, dashPoint);
    }
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
    if (this.shouldFinishShapeByMaxPoint()) this.finishShapeByMaxPointsReached(event);
    else {
      const dragCheckDistance = new Point(clientX, clientY).distanceTo(this.eventContext.mouseDownOrigin);
      const lastPtDistance = this.calculateFinishDistance(event.latlng);
      if (lastPtDistance < 10 && Browser.touch) this.finishShape();
      else if (Math.abs(dragCheckDistance) < 9 * (window.devicePixelRatio || 1)) this.addVertex(event.latlng);
    }
    this.enableNewMarkers(); // after a short pause, enable new markers
    this.eventContext.mouseDownOrigin = undefined;
  }

  private finishShapeByMaxPointsReached(event: LeafletMouseEvent): void {
    this.addVertex(event.latlng);
    this.finishShape();
  }

  private fireCreatedEvent(): void {
    if (!this.drawContext.polygon) return;
    const poly = new Polygon(this.drawContext.polygon.getLatLngs() as LatLng[][], this.options.shapeOptions);
    this.map.fire(DrawPolygonEvents.DRAW_POLYGON_END, { polygon: poly });
  }

  private fireEditEvent(index: number): void {
    const polygon = this.preserveData.polygonArray[index];
    const poly = polygon ? new Polygon(polygon.getLatLngs() as LatLng[][], this.options.shapeOptions) : undefined;
    this.map.fire(DrawPolygonEvents.DRAW_POLYGON_EDITED, { polygon: poly });
  }

  private getClonePreserveData(): DrawPolygonPreserveData {
    const data: DrawPolygonPreserveData = { markersArray: [], polygonArray: [], tooltipArray: [] };
    this.preserveData.markersArray.forEach((markers) =>
      data.markersArray.push(markers?.map((marker) => this.createMarker(marker.getLatLng(), this.settings.icon))),
    );
    data.polygonArray = this.preserveData.polygonArray.map((polygon) => (polygon ? new Polygon((polygon.getLatLngs() as LatLng[][])[0]) : undefined));
    data.tooltipArray = this.preserveData.tooltipArray.map(() => new DrawTooltip(this.map, true));
    return data;
  }

  private getDefaultSettings(): DrawPolygonSettings {
    return {
      drawError: {
        color: '#b00b00',
        timeout: 2500,
        message: '<strong>Error:</strong> shape edges cannot cross!',
      },
      guidelineDistance: 20,
      icon: new DivIcon({
        iconSize: new Point(8, 8),
        className: 'leaflet-div-icon leaflet-editing-icon',
      }),
      maxGuideLineLength: 4000,
      preserveIcon: new DivIcon({
        iconSize: new Point(8, 8),
        className: 'leaflet-div-icon',
      }),
      showArea: false,
      showLength: false,
      shapeOptions: {
        stroke: true,
        color: '#3388ff',
        weight: 4,
        opacity: 0.5,
        fill: true,
        fillColor: '#3388ff',
        fillOpacity: 0.2,
      },
      zIndexOffset: 2000,
      precision: 2,
    };
  }

  private getNewDrawContext(): DrawPolygonContext {
    if (this.drawContext) {
      this.drawContext.guidesContainer?.remove();
      this.clearDrawLayer();
      this.drawContext.tooltip?.dispose();
      this.clearGuides();
      if (this.drawContext.markers && this.drawContext.markers.length) {
        this.drawContext.markers[0].off();
        this.drawContext.markers[this.drawContext.markers.length - 1].off();
      }
    }
    return {
      currentLatLng: undefined,
      guidesContainer: undefined,
      markers: [],
      polygon: undefined,
      polyline: undefined,
      tooltip: undefined,
      editMode: false,
    };
  }

  private getNewEventContext(): DrawPolygonEventContext {
    return { clickHandled: false, errorShown: false, mouseDownOrigin: undefined, touchHandled: false };
  }

  private getPotentialAreaString(): string {
    if (!this.drawContext.markers || !this.drawContext.markers.length || !this.drawContext.currentLatLng) return '';
    const currentLatLng = this.drawContext.currentLatLng;
    const latLngs = (this.drawContext.polygon?.getLatLngs() as LatLng[][])[0];
    const distance = GeometryUtil.geodesicArea([...latLngs, currentLatLng]);
    return GeometryUtil.readableArea(distance, 2);
  }

  private getTooltipText(): TooltipText {
    let labelText: TooltipText;
    if (!this.drawContext.markers || this.drawContext.markers.length === 0) labelText = { text: 'Click to start drawing shape.' };
    else {
      if (this.drawContext.markers.length <= 2)
        labelText = {
          text: 'Click to continue drawing shape.',
          subText: '',
        };
      else
        labelText = {
          text: 'Click first point to finish shape.',
          subText: this.getPotentialAreaString(),
        };
    }
    return labelText;
  }

  private hideErrorTooltip(): void {
    this.eventContext.errorShown = false;
    if (!this.drawContext.tooltip) return;
    this.clearHideErrorTimeout();

    // Revert tooltip
    this.drawContext.tooltip.removeError().updateContent(this.getTooltipText());

    // Revert shape
    this.updateGuideColor(this.options.shapeOptions?.color ?? this.settings.shapeOptions.color);
    this.drawContext.polygon?.setStyle({ color: this.options.shapeOptions?.color ?? this.settings.shapeOptions.color });
  }

  private initDrawMode(): void {
    this.drawContext = this.getNewDrawContext();
    this.changePreserveDataToDrawMode();
    this.drawContext.markers = [];
    this.drawContext.polygon = new Polygon([], {
      ...this.settings.shapeOptions,
      color: this.options.shapeOptions?.color || this.settings.shapeOptions.color,
    });
    this.drawContext.polyline = new Polyline([], {});
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
      polygonsLayers: new FeatureGroup(),
      tooltipLayers: new FeatureGroup(),
    };
    this.layers.drawLayer.addTo(this.featureGroup);
    this.layers.markersLayers.addTo(this.featureGroup);
    this.layers.polygonsLayers.addTo(this.featureGroup);
    this.layers.tooltipLayers.addTo(this.featureGroup);
  }

  private initPreserveData(): void {
    const markersArray: Marker[][] = [];
    const polygonArray: Polygon[] = [];
    const tooltipArray: DrawTooltip[] = [];
    if (this.options.edit && this.options.edit.polygon)
      this.options.edit.polygon.forEach((polygon) => {
        const latLngs = (polygon.getLatLngs() as LatLng[][])[0];
        markersArray.push(latLngs.map((latLng) => this.createMarker(latLng, this.settings.icon)));
        const tooltip = new DrawTooltip(this.map, true);
        polygonArray.push(new Polygon(latLngs, { color: this.options.shapeOptions?.color || this.settings.shapeOptions.color }));
        tooltipArray.push(tooltip);
      });
    this.preserveData = { markersArray, polygonArray, tooltipArray };
  }

  private isNewPointValidVaseOnIntersect(newPointLatLng: LatLng): boolean {
    if (!this.drawContext || !this.drawContext.polygon) return false;
    if (this.options.allowIntersection) return true;
    const intersects = DrawPolygonUtil.newLatLngIntersects(this.map, newPointLatLng, false, this.drawContext.polygon);
    if (intersects) this.showErrorTooltip();
    return intersects;
  }

  private lastVertexChanged(): void {
    this.updateFinishHandler();
    this.clearGuides();
    this.updateTooltip();
  }

  private layerVisibilityChange(): void {
    if (!this.layers.drawLayer) return;
    const newValue = this.map.hasLayer(this.layers.drawLayer);
    if (newValue && !this.layerVisible) {
      this.addAreaTxtToAllCompletePolygons();
      this.drawContext.tooltip?.addTo(this.layers.drawLayer);
    }
    this.layerVisible = newValue;
    if (this.layerVisible) return;
    this.clearGuides();
    this.preserveData.tooltipArray.forEach((tooltip) => tooltip?.onMouseOut());
    if (this.drawContext.tooltip) this.drawContext.tooltip.onMouseOut();
  }

  private onMarkerDrag(event: LeafletEvent, polygonIndex: number): void {
    const actPolygon = this.preserveData.polygonArray[polygonIndex];
    const actMarkers = this.preserveData.markersArray[polygonIndex];
    const actTooltip = this.preserveData.tooltipArray[polygonIndex];
    if (!actPolygon || !actMarkers || !actTooltip) return;
    let newPolygon = new Polygon(
      actMarkers.map((marker) => marker.getLatLng()),
      this.options.shapeOptions,
    );
    if (!this.options.allowIntersection && DrawPolygonUtil.intersects(this.map, newPolygon)) {
      (event.target as Marker).setLatLng(this.editContext.previousLocation!);
      newPolygon = new Polygon(
        actMarkers.map((marker) => marker.getLatLng()),
        this.options.shapeOptions,
      );
      this.showEditError(polygonIndex);
    } else {
      if (this.editContext.errorShown) actTooltip.removeError();
      this.addAreaTxtToCompletePolygon(newPolygon, polygonIndex);
    }

    actPolygon.remove();
    this.preserveData.polygonArray[polygonIndex] = newPolygon;
    newPolygon.addTo(this.layers.polygonsLayers);
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
    this.updateGuide(newPos);
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
    if (this.drawContext.markers && this.layerVisible) this.updateGuide();
    this.updatePreserveTooltipsPosition();
  }

  private preserveCurrentDrawContext(): void {
    this.preserveMarkers();
    this.preservePolygon();
    this.preserveTooltip();
  }

  private preserveMarkers(): void {
    if (!this.drawContext.markers) return;
    const markersToPreserve = this.drawContext.markers.map((marker) => {
      const newMarker = this.createMarker(marker.getLatLng(), this.settings.preserveIcon);
      marker.addTo(this.layers.markersLayers);
      return newMarker;
    });
    this.preserveData.markersArray.push(markersToPreserve);
  }

  private preservePolygon(): void {
    if (!this.drawContext.polygon) return;
    const polylineToPreserve = new Polygon([], { color: this.options.shapeOptions?.color || this.settings.shapeOptions.color });
    polylineToPreserve.setLatLngs(this.drawContext.polygon.getLatLngs());
    polylineToPreserve.addTo(this.layers.polygonsLayers);
    this.preserveData.polygonArray.push(polylineToPreserve);
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
    this.preserveData.markersArray.forEach((markers) => markers?.forEach((marker) => this.removeEditMarkerListener(marker)));
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

  private shouldFinishShapeByMaxPoint(): boolean {
    return this.maxPoints > 2 && !!this.drawContext.markers && this.maxPoints == this.drawContext.markers.length + 1;
  }

  private showEditError(polygonIndex: number): void {
    if (this.editContext.errorShown) return;
    this.editContext.errorShown = true;
    const tooltip = this.preserveData.tooltipArray[polygonIndex];
    tooltip?.showAsError().updateContent({ text: this.settings.drawError.message });
    setTimeout(() => {
      tooltip?.removeError();
      this.addAreaTxtToCompletePolygon(this.preserveData.polygonArray[polygonIndex]!, polygonIndex);
      this.editContext.errorShown = false;
    }, 2000);
  }

  private showErrorTooltip(): void {
    this.eventContext.errorShown = true;

    // Update tooltip
    if (!this.drawContext.tooltip || !this.drawContext.polygon) return;
    this.drawContext.tooltip.showAsError().updateContent({ text: this.settings.drawError.message });

    // Update shape
    this.updateGuideColor(this.settings.drawError.color);
    this.drawContext.polygon.setStyle({ color: this.settings.drawError.color });

    // Hide the error after 2 seconds
    this.clearHideErrorTimeout();
    this.hideErrorTimeout = setTimeout(Util.bind(this.hideErrorTooltip, this), this.settings.drawError.timeout);
  }

  private shouldDisable(): boolean {
    return (
      !this.options.multiple &&
      this.preserveData.polygonArray.length > 0 &&
      this.preserveData.polygonArray.length != this.options.edit?.polygon.length
    );
  }

  private startPoint(clientX: number, clientY: number): void {
    this.eventContext.mouseDownOrigin = new Point(clientX, clientY);
  }

  private updateFinishHandler(): void {
    if (!this.drawContext.markers) return;

    const markerCount = this.drawContext.markers.length;
    if (markerCount == 1) this.drawContext.markers[markerCount - 1].on('click', this.finishShape, this);
    if (markerCount > 2) {
      this.drawContext.markers[markerCount - 1].on('dblclick', this.finishShape, this);
      if (markerCount > 3) this.drawContext.markers[markerCount - 2].off('dblclick', this.finishShape, this);
    }
  }

  private updateGuide(newPos?: Point): void {
    const markerCount = this.drawContext.markers ? this.drawContext.markers.length : 0;
    if (newPos) this.drawContext.currentLatLng = this.map.layerPointToLatLng(newPos);
    if (markerCount <= 0 || !this.drawContext.currentLatLng) return;
    const pos = newPos || this.map.latLngToLayerPoint(this.drawContext.currentLatLng);
    this.clearGuides();
    if (this.drawContext.markers) this.drawGuide(this.map.latLngToLayerPoint(this.drawContext.markers[markerCount - 1].getLatLng()), pos);
  }

  private updateGuideColor(color: string): void {
    if (!this.drawContext.guidesContainer) return;
    for (let i = 0, l = this.drawContext.guidesContainer.childNodes.length; i < l; i++)
      (this.drawContext.guidesContainer.childNodes[i] as unknown as ChildNode & { style: { backgroundColor: string } }).style.backgroundColor = color;
  }

  private updatePreserveTooltipsPosition(): void {
    this.preserveData.polygonArray.forEach((polygon, index) => {
      const tooltip = this.preserveData.tooltipArray[index];
      if (polygon && tooltip) tooltip.updatePosition((polygon.getLatLngs() as LatLng[][])[0][polygon.getLatLngs().length - 1]);
    });
  }

  private updateTooltip(latLng?: LatLng): void {
    const text = this.getTooltipText();
    if (latLng && this.drawContext.tooltip) this.drawContext.tooltip.updatePosition(latLng);
    if (!this.eventContext.errorShown && this.drawContext.tooltip) this.drawContext.tooltip.updateContent(text);
  }
}
