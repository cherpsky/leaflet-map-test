import { DivIcon, DomEvent, Handler, LayerGroup, Map as LeafMap, LeafletMouseEvent, Marker, Polyline } from 'leaflet';
import { MeasurementEvents } from './handler.events';

export class MeasurementHandler extends Handler {
  private map: LeafMap;
  private measurementLayer: LayerGroup = new LayerGroup();
  private markers: Marker[] = [];
  private polyline: Polyline | undefined;
  private tempPolyline: Polyline | undefined;
  private tempInfoMarker: Marker | undefined;

  constructor(map: LeafMap) {
    super(map);
    this.map = map;
  }

  override addHooks(): void {
    this.map.on('click', this.onClick.bind(this));
    this.map.on('mousemove', this.addTempPolyline.bind(this));
    this.map.on('contextmenu', this.finishMeasurement.bind(this));
    this.measurementLayer.addTo(this.map);
  }

  override removeHooks(): void {
    this.map.off('click');
    this.map.off('mousemove');
    this.map.off('contextmenu');
    this.removeLayers();
  }

  removeLayers(): void {
    this.map.removeLayer(this.measurementLayer);
    this.markers = [];
    this.polyline = undefined;
    this.tempPolyline = undefined;
    this.tempInfoMarker = undefined;
    this.measurementLayer = new LayerGroup();
  }

  onClick(event: LeafletMouseEvent): void {
    const marker = new Marker(event.latlng, { icon: this.getDivIcon() });
    this.markers.push(marker);
    marker.addTo(this.measurementLayer);

    if (this.polyline) this.measurementLayer.removeLayer(this.polyline);
    this.polyline = new Polyline(
      this.markers.map((mark) => mark.getLatLng()),
      { noClip: true },
    );
    this.polyline.addTo(this.measurementLayer);

    if (this.markers.length > 1) {
      const data = this.calculateDistance();
      this.addDistanceTooltip(data);
      this.map.fireEvent(MeasurementEvents.POLYLINE_MEASURED, { data });
    }
  }

  addTempPolyline(event: LeafletMouseEvent): void {
    const lastMarker = this.markers[this.markers.length - 1];
    if (!lastMarker || this.markers.length === 0) return;
    if (this.tempPolyline) this.measurementLayer.removeLayer(this.tempPolyline);
    this.tempPolyline = new Polyline([lastMarker.getLatLng(), event.latlng], { dashArray: [10, 10] });
    this.tempPolyline.addTo(this.measurementLayer);

    this.addTempInfoMarker(event);
  }

  finishMeasurement(event: LeafletMouseEvent): void {
    DomEvent.preventDefault(event.originalEvent);
    this.onClick(event);
    this.map.fireEvent(MeasurementEvents.FINISHED_MEASUREMENT, { data: this.markers, distance: this.calculateDistance() });
    this.removeHooks();
  }

  addTempInfoMarker(event: LeafletMouseEvent): void {
    const icon = new DivIcon({ html: this.getIconHtml(), className: '' });
    if (this.tempInfoMarker) this.measurementLayer.removeLayer(this.tempInfoMarker);
    this.tempInfoMarker = new Marker([event.latlng.lat, event.latlng.lng], { icon, bubblingMouseEvents: true });
    this.tempInfoMarker.bindTooltip('Press right click to finish measuring', { offset: [0, -20], direction: 'top' });

    this.measurementLayer.addLayer(this.tempInfoMarker);
  }

  private getDivIcon(): DivIcon {
    return new DivIcon({ html: this.getIconHtml(), iconSize: [6, 6], iconAnchor: [3, 3], className: '' });
  }

  private addDistanceTooltip(distance: number): void {
    const lastMarker = this.markers[this.markers.length - 1];
    if (!lastMarker) return;
    lastMarker.bindTooltip(`${(distance / 1000).toFixed(1)} Km`, { permanent: true, direction: 'top' });
  }

  private getIconHtml(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.width = '6px';
    div.style.height = '6px';
    div.style.borderRadius = '3px';
    div.style.border = '2px solid blue';
    div.style.backgroundColor = 'white';

    return div;
  }

  private calculateDistance(): number {
    let distance = 0;
    for (let i = 0; i < this.markers.length - 1; i++) {
      const currentLatLng = this.markers[i].getLatLng();
      const nextLatLng = this.markers[i + 1].getLatLng();
      distance += currentLatLng.distanceTo(nextLatLng);
    }
    return distance;
  }
}
