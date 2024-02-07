import { LatLng, LatLngBounds, Marker, MarkerOptions } from 'leaflet';
import { MarkerAnimationOptions } from '../types';

export class TeleintMarker extends Marker {
  private animateOpt: MarkerAnimationOptions;
  private follow = false;
  private setLatLngCalledFromAnimate = false;
  private startTime = 0;
  private startLatLng: LatLng;
  private tempDuration: number;
  private targetLatLng: LatLng;
  constructor(latlng: LatLng, options?: MarkerOptions, animateOpt: MarkerAnimationOptions = { animate: false, duration: 1000 }) {
    super(latlng, options);
    this.animateOpt = animateOpt;
    this.startLatLng = latlng;
    this.tempDuration = animateOpt.duration;
    this.targetLatLng = latlng;
  }

  setAnimatedLocation(latlng: LatLng, duration?: number, follow?: boolean): void {
    this.startLatLng = this.getLatLng();
    this.targetLatLng = latlng;
    this.startTime = Date.now();
    this.tempDuration = duration || this.animateOpt.duration;
    this.follow = follow || false;
    this.animate();
  }

  private animate(): void {
    this.setLatLngCalledFromAnimate = true;
    const elapsed = Date.now() - this.startTime;
    const progress = elapsed / this.tempDuration;
    if (progress > 1) {
      this.setLatLng(this.targetLatLng);
      if (this.follow) this._map.fitBounds(new LatLngBounds(this.targetLatLng, this.targetLatLng), { animate: true, padding: [50, 50] });
      this.follow = false;
    } else {
      const lat = this.startLatLng.lat + (this.targetLatLng.lat - this.startLatLng.lat) * progress;
      const lng = this.startLatLng.lng + (this.targetLatLng.lng - this.startLatLng.lng) * progress;
      const latLng = new LatLng(lat, lng);
      this.setLatLng(latLng);
      if (this.follow) this._map.fitBounds(new LatLngBounds(latLng, latLng), { animate: true, padding: [50, 50] });
      requestAnimationFrame(this.animate.bind(this));
    }
    this.setLatLngCalledFromAnimate = false;
  }
}
