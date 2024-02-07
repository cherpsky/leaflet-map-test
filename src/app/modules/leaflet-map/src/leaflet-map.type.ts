import { ControlPosition, FeatureGroup, LatLng } from 'leaflet';
import { DrawOptions } from './draw';

export type LeafletMapOptions = {
  center: LatLng;
  zoom: number;
};

export type LeafletMapDrawOptions = {
  position: ControlPosition;
  draw?: DrawOptions;
};
export type LeafletMapLayer = {
  name: string;
  layer: FeatureGroup;
};
