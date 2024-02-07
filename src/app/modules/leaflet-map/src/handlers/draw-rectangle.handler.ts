import { Handler, LatLng, LayerGroup, Map as LeafMap, LeafletMouseEvent, Rectangle } from 'leaflet';
import { DrawRectangleEvents } from './handler.events';

export class DrawRectangleHandler extends Handler {
  private map: LeafMap;
  private startingLatLng: LatLng | undefined;
  private tempLayer: LayerGroup | undefined;
  private tempRectangle: Rectangle | undefined;

  constructor(map: LeafMap) {
    super(map);
    this.map = map;
  }

  override addHooks(): void {
    this.map.on('click', this.onClick.bind(this));
  }

  override removeHooks(): void {
    this.map.off('click');
    this.map.off('mousemove');
  }

  private onClick(event: LeafletMouseEvent): void {
    if (!this.startingLatLng) {
      this.startingLatLng = event.latlng;
      this.map.on('mousemove', this.onMouseMove.bind(this));
    } else {
      this.tempRectangle?.removeFrom(this.map);
      this.tempRectangle = undefined;
      this.map.fireEvent(DrawRectangleEvents.FINISHED_RECTANGLE, {
        data: new Rectangle([
          [this.startingLatLng.lat, this.startingLatLng.lng],
          [event.latlng.lat, event.latlng.lng],
        ]),
      });
      this.startingLatLng = undefined;
      this.map.off('mousemove');
    }
  }

  private onMouseMove(event: LeafletMouseEvent): void {
    if (!this.startingLatLng) return;
    this.tempRectangle?.removeFrom(this.map);
    this.tempRectangle = new Rectangle([
      [this.startingLatLng.lat, this.startingLatLng.lng],
      [event.latlng.lat, event.latlng.lng],
    ]);

    this.tempRectangle.addTo(this.map);
  }
}
