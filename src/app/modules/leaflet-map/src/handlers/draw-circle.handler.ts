import { Handler, Map as LeafMap, LeafletMouseEvent, Circle, DivIcon, Marker, LayerGroup } from 'leaflet';
import { DrawCircleEvents } from './handler.events';

export class DrawCircleHandler extends Handler {
  private map: LeafMap;
  private center: Marker | undefined;
  private tempCircle: Circle | undefined;
  private tempLayer: LayerGroup | undefined;

  constructor(map: LeafMap) {
    super(map);
    this.map = map;
  }

  override addHooks(): void {
    this.map.on('click', this.onClick.bind(this));
  }

  private onClick(event: LeafletMouseEvent): void {
    if (!this.center) {
      if (!this.tempLayer) {
        this.tempLayer = new LayerGroup();
        this.tempLayer.addTo(this.map);
      }

      this.center = new Marker(event.latlng, { icon: this.getCenterIcon() });
      this.center.addTo(this.tempLayer);
      this.map.on('mousemove', this.onMouseMove.bind(this));
    } else {
      const radius = this.center.getLatLng().distanceTo(event.latlng);
      const circle = new Circle(this.center.getLatLng(), { radius });
      this.tempCircle?.removeFrom(this.map);
      this.map.off('mousemove');
      this.center.removeFrom(this.map);
      this.center = undefined;

      this.map.fireEvent(DrawCircleEvents.FINISHED_CIRCLE, { data: circle });
    }
  }

  private onMouseMove(event: LeafletMouseEvent): void {
    this.tempCircle?.removeFrom(this.map);
    const radius = this.center!.getLatLng().distanceTo(event.latlng);
    this.tempCircle = new Circle(this.center!.getLatLng(), { radius, color: 'red' });

    this.tempCircle.addTo(this.map);
  }

  override removeHooks(): void {
    this.map.off('click');
    this.map.off('mousemove');
  }

  private getCenterIcon(): DivIcon {
    const html = document.createElement('div');
    const size = 10;
    html.setAttribute(
      'style',
      `
      width: ${size}px;
      height: ${size}px;
      background-color: blue,
      border-radius: ${size / 2}px,
      box-shadow: 0px 2px 10px blue,
    `,
    );

    return new DivIcon({ html, iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: '' });
  }
}
