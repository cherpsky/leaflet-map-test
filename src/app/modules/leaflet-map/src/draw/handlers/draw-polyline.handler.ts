import { LineString } from 'geojson';
import {
  Browser,
  DivIcon,
  divIcon,
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
  Polyline,
  Util,
} from 'leaflet';
import { DrawPolylineOptions, TooltipText } from '../draw-control.type';
import { DrawTooltip } from '../draw-tooltip';
import { DrawPolylineEvents } from '../enums';
import {
  DrawPolylineContext,
  DrawPolylineEditContext,
  DrawPolylineEventContext,
  DrawPolylineLayers,
  DrawPolylinePreserveData,
  DrawPolylineSettings,
} from '../types';
import { DrawPolylineUtil, GeometryUtil } from '../utils';

export class DrawPolylineHandler extends Handler {
  private eventContext: DrawPolylineEventContext;
  private settings: DrawPolylineSettings;
  private disableMarkers = false;
  private maxPoints = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hideErrorTimeout: any | undefined = undefined;

  private layerVisible = false;
  private drawContext: DrawPolylineContext;
  private editContext: DrawPolylineEditContext;
  private mouseMarker: Marker | undefined;

  private preserveData!: DrawPolylinePreserveData;
  private preserveDataBeforeEdit: DrawPolylinePreserveData | undefined;
  private layers!: DrawPolylineLayers;

  constructor(private readonly map: LeafletMap, private featureGroup: FeatureGroup, private options: DrawPolylineOptions) {
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
    if (!this.options.draw && (!this.options.edit || !this.options.edit.polyline.length)) return;
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

  cancel(): void {
    if (!this.drawContext.editMode) this.cancelDraw();
    else this.cancelEdit();
  }

  changeEditMode(): void {
    if (this.drawContext.editMode) {
      this.initDrawMode();
      this.removeEditMarkersListener();
    } else this.initEditMode();
  }

  override disable(): this {
    super.disable();
    this.map.fire(DrawPolylineEvents.DRAW_POLYLINE_DISABLED);
    return this;
  }

  override enable(): this {
    super.enable();
    this.map.fire(DrawPolylineEvents.DRAW_POLYLINE_ENABLED);
    return this;
  }

  finishShape(): void {
    if (!this.drawContext || !this.drawContext.polyline) return;
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

  getDrawAvailable(): boolean {
    return this.options.draw;
  }

  getEditMode(): boolean {
    return this.drawContext.editMode;
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
    this.map.fire(DrawPolylineEvents.DRAW_POLYLINE_SAVE, {
      polylineArray: this.preserveData.polylineArray.map((poly) => (poly ? new Polyline(poly.getLatLngs() as LatLng[]) : undefined)),
    });
    this.removeHooks();
  }

  private addDistanceTxtToAllCompletePolyline(): void {
    this.preserveData.polylineArray.forEach((polyline, index) => {
      if (polyline) this.addDistanceTxtToCompletePolyline(polyline, index);
    });
  }

  private addDistanceTxtToCompletePolyline(polyline: Polyline, toolTipIndex: number): void {
    const polylineLatLngs = polyline.getLatLngs() as LatLng[];
    let totalDistance = 0;
    let lastLatLng: LatLng | undefined;
    for (const latLng of polylineLatLngs) {
      if (lastLatLng) totalDistance += lastLatLng.distanceTo(latLng);
      lastLatLng = latLng;
    }
    const txt: TooltipText = { text: 'Distance', subText: GeometryUtil.readableDistance(totalDistance, 2) };
    if (!lastLatLng) return;
    this.preserveData.tooltipArray[toolTipIndex]?.updatePosition(lastLatLng);
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
    if (!this.drawContext || !this.drawContext.markers || !this.drawContext.polyline) return;
    const markersLength = this.drawContext.markers.length ?? 0;
    if (markersLength >= 2 && this.drawContext.polyline && this.isNewPointValidVaseOnIntersect(latLng)) return;
    else if (this.eventContext.errorShown) this.hideErrorTooltip();
    const marker = this.createMarker(latLng, this.settings.icon);
    this.drawContext.markers.push(marker);
    if (this.drawContext.markers.length == 2) this.map.fire(DrawPolylineEvents.DRAW_POLYLINE_START);
    marker.addTo(this.layers.drawLayer);
    this.drawContext.polyline.addLatLng(latLng);
    if (this.drawContext.polyline.getLatLngs().length === 2) this.layers.drawLayer.addLayer(this.drawContext.polyline);
    this.lastVertexChanged(latLng, true);
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
    this.preserveData = this.preserveDataBeforeEdit ? this.preserveDataBeforeEdit : { markersArray: [], polylineArray: [], tooltipArray: [] };
    this.preserveDataBeforeEdit = undefined;
    this.initEditMode();
  }

  private changePreserveDataToDrawMode(): void {
    this.clearLayers();
    this.preserveData.polylineArray.forEach((polyline, index) => {
      if (!polyline) return;
      const polylineLatLngs = polyline.getLatLngs() as LatLng[];
      const newLatLngs = DrawPolylineUtil.filterLatLngsInSameLine(polylineLatLngs);

      const newPolyline = new Polyline<LineString>(newLatLngs);
      const markers = newLatLngs.map((latLng) => {
        const marker = this.createMarker(latLng, this.settings.icon);
        marker.addTo(this.layers.markersLayers);
        return marker;
      });
      newPolyline.addTo(this.layers.polylineLayers);
      this.preserveData.polylineArray[index] = newPolyline;
      this.preserveData.tooltipArray[index]?.addTo(this.layers.tooltipLayers);
      this.preserveData.markersArray[index] = markers;
    });
    this.addDistanceTxtToAllCompletePolyline();
  }

  private changePreserveDataToEditMode(): void {
    this.clearLayers();
    this.preserveData.polylineArray.forEach((polyline, index) => {
      if (!polyline) return;
      const polylineLatLngs = polyline.getLatLngs() as LatLng[];
      const newLatLngs = DrawPolylineUtil.getLatLngBetweenInLineMarkers(polylineLatLngs);
      const markers = newLatLngs.map((latLng) => {
        const marker = this.createEditableMarker(latLng, this.settings.icon, index);
        marker.addTo(this.layers.markersLayers);
        return marker;
      });
      polyline = new Polyline(newLatLngs);
      polyline.addTo(this.layers.polylineLayers);
      this.preserveData.polylineArray[index] = polyline;
      this.preserveData.tooltipArray[index]?.addTo(this.layers.tooltipLayers);
      this.preserveData.markersArray[index] = markers;
    });
    this.addDistanceTxtToAllCompletePolyline();
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
    this.clearPolylineLayers();
    this.clearMarkerLayers();
    this.clearTooltipLayers();
  }

  private clearMarkerLayers(): void {
    this.layers.markersLayers.clearLayers();
  }

  private clearPolylineLayers(): void {
    this.layers.polylineLayers.clearLayers();
  }

  private clearTooltipLayers(): void {
    this.preserveData.tooltipArray.forEach((tooltip) => tooltip?.dispose());
  }

  private createEditableMarker(latLng: LatLng, icon: DivIcon, polylineIndex: number): Marker {
    const marker = new Marker(latLng, {
      icon,
      zIndexOffset: this.settings.zIndexOffset * 2,
      draggable: true,
    });
    marker.on('dragstart', (event) => this.onMarkerDragStart(event));
    marker.on('drag', (event) => this.onMarkerDrag(event, polylineIndex));
    marker.on('dragend', () => this.onMarkerDragEnd(polylineIndex));
    marker.on('touchend', () => this.fireEditEvent(polylineIndex), this);
    marker.on('MSPointerUp', () => this.fireEditEvent(polylineIndex), this);
    return marker;
  }

  private createMarker(latLng: LatLng, icon: DivIcon): Marker {
    return new Marker(latLng, { icon, zIndexOffset: this.settings.zIndexOffset * 2 });
  }

  // disable new markers temporarily; this is to prevent duplicated touch/click events
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
        ? this.options.shapeOptions?.color || this.settings.defaultColor
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
    if (!this.drawContext.polyline) return;
    const poly = new Polyline(this.drawContext.polyline.getLatLngs() as LatLng[], this.options.shapeOptions);
    this.map.fire(DrawPolylineEvents.DRAW_POLYLINE_END, { polyline: poly });
  }

  private fireEditEvent(index: number): void {
    const polyline = this.preserveData.polylineArray[index];
    const poly = polyline ? new Polyline(polyline.getLatLngs() as LatLng[], this.options.shapeOptions) : undefined;
    this.map.fire(DrawPolylineEvents.DRAW_POLYLINE_EDITED, { polyline: poly });
  }

  private getClonePreserveData(): DrawPolylinePreserveData {
    const data: DrawPolylinePreserveData = { markersArray: [], polylineArray: [], tooltipArray: [] };
    this.preserveData.markersArray.forEach((markers) =>
      data.markersArray.push(markers?.map((marker) => this.createMarker(marker.getLatLng(), this.settings.icon))),
    );
    data.polylineArray = this.preserveData.polylineArray.map((polyline) =>
      polyline ? new Polyline<LineString>(polyline.getLatLngs() as LatLng[]) : undefined,
    );
    data.tooltipArray = this.preserveData.tooltipArray.map(() => new DrawTooltip(this.map, true));
    return data;
  }

  private getDefaultSettings(): DrawPolylineSettings {
    return {
      defaultColor: '#3388ff',
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
      zIndexOffset: 2000,
    };
  }

  private getNewDrawContext(): DrawPolylineContext {
    if (this.drawContext) {
      this.drawContext.guidesContainer?.remove();
      this.clearDrawLayer();
      this.drawContext.tooltip?.dispose();
      this.clearGuides();
    }
    return {
      currentLatLng: undefined,
      guidesContainer: undefined,
      markers: [],
      totalDistance: 0,
      polyline: undefined,
      tooltip: undefined,
      editMode: false,
    };
  }

  private getNewEventContext(): DrawPolylineEventContext {
    return { clickHandled: false, errorShown: false, mouseDownOrigin: undefined, touchHandled: false };
  }

  private getPotentialDistanceString(): string {
    if (!this.drawContext.markers) return '';
    const currentLatLng = this.drawContext.currentLatLng;
    const previousLatLng = this.drawContext.markers[this.drawContext.markers.length - 1].getLatLng();
    // Calculate the distance from the last fixed point to the mouse position
    const distance =
      previousLatLng && currentLatLng && currentLatLng.distanceTo
        ? this.drawContext.totalDistance + currentLatLng.distanceTo(previousLatLng)
        : this.drawContext.totalDistance || 0;
    return GeometryUtil.readableDistance(distance, 2);
  }

  private getTooltipText(): TooltipText {
    let labelText: TooltipText;
    let distanceStr: string;
    if (!this.drawContext.markers || this.drawContext.markers.length === 0) labelText = { text: 'Click to start drawing line.' };
    else {
      distanceStr = this.getPotentialDistanceString();
      if (this.drawContext.markers.length === 1)
        labelText = {
          text: 'Click to continue drawing line.',
          subText: distanceStr,
        };
      else
        labelText = {
          text: 'Click last point to finish line.',
          subText: distanceStr,
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
    this.updateGuideColor(this.options.shapeOptions?.color ?? this.settings.defaultColor);
    this.drawContext.polyline?.setStyle({ color: this.options.shapeOptions?.color ?? this.settings.defaultColor });
  }

  private initDrawMode(): void {
    this.drawContext = this.getNewDrawContext();
    this.changePreserveDataToDrawMode();
    this.drawContext.markers = [];
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
      polylineLayers: new FeatureGroup(),
      tooltipLayers: new FeatureGroup(),
    };
    this.layers.drawLayer.addTo(this.featureGroup);
    this.layers.markersLayers.addTo(this.featureGroup);
    this.layers.polylineLayers.addTo(this.featureGroup);
    this.layers.tooltipLayers.addTo(this.featureGroup);
  }

  private initPreserveData(): void {
    const markersArray: Marker[][] = [];
    const polylineArray: Polyline<LineString>[] = [];
    const tooltipArray: DrawTooltip[] = [];
    if (this.options.edit && this.options.edit.polyline)
      this.options.edit.polyline.forEach((polyline) => {
        const latLngs = polyline.getLatLngs() as LatLng[];
        markersArray.push(latLngs.map((latLng) => this.createMarker(latLng, this.settings.icon)));
        const tooltip = new DrawTooltip(this.map, true);
        polylineArray.push(new Polyline(latLngs));
        tooltipArray.push(tooltip);
      });
    this.preserveData = { markersArray, polylineArray, tooltipArray };
  }

  private isNewPointValidVaseOnIntersect(newPointLatLng: LatLng): boolean {
    if (!this.drawContext || !this.drawContext.polyline) return false;
    if (this.options.allowIntersection) return true;
    const intersects = DrawPolylineUtil.newLatLngIntersects(this.map, newPointLatLng, false, this.drawContext.polyline);
    if (intersects) this.showErrorTooltip();
    return intersects;
  }

  private lastVertexChanged(latlng: LatLng, added: boolean): void {
    this.updateFinishHandler();
    this.updateRunningMeasure(latlng, added);
    this.clearGuides();
    this.updateTooltip();
  }

  private layerVisibilityChange(): void {
    if (!this.layers.drawLayer) return;
    const newValue = this.map.hasLayer(this.layers.drawLayer);
    if (newValue && !this.layerVisible) {
      this.addDistanceTxtToAllCompletePolyline();
      this.drawContext.tooltip?.addTo(this.layers.drawLayer);
    }
    this.layerVisible = newValue;
    if (this.layerVisible) return;
    this.clearGuides();
    this.preserveData.tooltipArray.forEach((tooltip) => tooltip?.onMouseOut());
    if (this.drawContext.tooltip) this.drawContext.tooltip.onMouseOut();
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

  private onMarkerDrag(event: LeafletEvent, polylineIndex: number): void {
    const actPolyline = this.preserveData.polylineArray[polylineIndex];
    const actMarkers = this.preserveData.markersArray[polylineIndex];
    const actTooltip = this.preserveData.tooltipArray[polylineIndex];
    if (!actPolyline || !actMarkers || !actTooltip) return;
    let newPolyline = new Polyline<LineString>(actMarkers.map((marker) => marker.getLatLng()));
    if (!this.options.allowIntersection && DrawPolylineUtil.intersects(this.map, newPolyline)) {
      (event.target as Marker).setLatLng(this.editContext.previousLocation!);
      newPolyline = new Polyline<LineString>(actMarkers.map((marker) => marker.getLatLng()));
      this.showEditError(polylineIndex);
    } else {
      if (this.editContext.errorShown) actTooltip.removeError();
      this.addDistanceTxtToCompletePolyline(newPolyline, polylineIndex);
    }

    actPolyline.remove();
    this.preserveData.polylineArray[polylineIndex] = newPolyline;
    newPolyline.addTo(this.layers.polylineLayers);
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
    this.preservePolyline();
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

  private preservePolyline(): void {
    if (!this.drawContext.polyline) return;
    const polylineToPreserve = new Polyline<LineString>(this.drawContext.polyline.getLatLngs() as LatLng[]);
    polylineToPreserve.addTo(this.layers.polylineLayers);
    this.preserveData.polylineArray.push(polylineToPreserve);
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
    return this.maxPoints > 1 && !!this.drawContext.markers && this.maxPoints == this.drawContext.markers.length + 1;
  }

  private showEditError(polylineIndex: number): void {
    if (this.editContext.errorShown) return;
    this.editContext.errorShown = true;
    const tooltip = this.preserveData.tooltipArray[polylineIndex];
    tooltip?.showAsError().updateContent({ text: this.settings.drawError.message });
    setTimeout(() => {
      tooltip?.removeError();
      this.addDistanceTxtToCompletePolyline(this.preserveData.polylineArray[polylineIndex]!, polylineIndex);
      this.editContext.errorShown = false;
    }, 2000);
  }

  private showErrorTooltip(): void {
    this.eventContext.errorShown = true;

    // Update tooltip
    if (!this.drawContext.tooltip || !this.drawContext.polyline) return;
    this.drawContext.tooltip.showAsError().updateContent({ text: this.settings.drawError.message });

    // Update shape
    this.updateGuideColor(this.settings.drawError.color);
    this.drawContext.polyline.setStyle({ color: this.settings.drawError.color });

    // Hide the error after 2 seconds
    this.clearHideErrorTimeout();
    this.hideErrorTimeout = setTimeout(Util.bind(this.hideErrorTooltip, this), this.settings.drawError.timeout);
  }

  private shouldDisable(): boolean {
    return (
      !this.options.multiple &&
      this.preserveData.polylineArray.length > 0 &&
      this.preserveData.polylineArray.length != this.options.edit?.polyline.length
    );
  }

  private startPoint(clientX: number, clientY: number): void {
    this.eventContext.mouseDownOrigin = new Point(clientX, clientY);
  }

  private updateGuide(newPos?: Point): void {
    const markerCount = this.drawContext.markers ? this.drawContext.markers.length : 0;
    if (newPos) this.drawContext.currentLatLng = this.map.layerPointToLatLng(newPos);
    if (markerCount <= 0 || !this.drawContext.currentLatLng) return;
    const pos = newPos || this.map.latLngToLayerPoint(this.drawContext.currentLatLng);
    this.clearGuides();
    if (this.drawContext.markers) this.drawGuide(this.map.latLngToLayerPoint(this.drawContext.markers[markerCount - 1].getLatLng()), pos);
  }

  private updateFinishHandler(): void {
    if (!this.drawContext.markers) return;
    const markerCount = this.drawContext.markers.length;
    if (markerCount > 1) this.drawContext.markers[markerCount - 1].on('click', this.finishShape, this);
    if (markerCount > 2) this.drawContext.markers[markerCount - 2].off('click', this.finishShape, this);
  }

  private updateGuideColor(color: string): void {
    if (!this.drawContext.guidesContainer) return;
    for (let i = 0, l = this.drawContext.guidesContainer.childNodes.length; i < l; i++)
      (this.drawContext.guidesContainer.childNodes[i] as unknown as ChildNode & { style: { backgroundColor: string } }).style.backgroundColor = color;
  }

  private updatePreserveTooltipsPosition(): void {
    this.preserveData.polylineArray.forEach((polyline, index) => {
      const tooltip = this.preserveData.tooltipArray[index];
      if (polyline && tooltip) tooltip.updatePosition((polyline.getLatLngs() as LatLng[])[polyline.getLatLngs().length - 1]);
    });
  }

  private updateRunningMeasure(latlng: LatLng, added: boolean): void {
    if (!this.drawContext.markers) return;
    const markersLength = this.drawContext.markers.length;
    let previousMarkerIndex: number;
    let distance: number;
    if (this.drawContext.markers.length === 1) this.drawContext.totalDistance = 0;
    else {
      previousMarkerIndex = markersLength - (added ? 2 : 1);
      distance = latlng.distanceTo(this.drawContext.markers[previousMarkerIndex].getLatLng());
      this.drawContext.totalDistance += distance * (added ? 1 : -1);
    }
  }

  private updateTooltip(latLng?: LatLng): void {
    const text = this.getTooltipText();
    if (latLng && this.drawContext.tooltip) this.drawContext.tooltip.updatePosition(latLng);
    if (!this.eventContext.errorShown && this.drawContext.tooltip) this.drawContext.tooltip.updateContent(text);
  }
}
