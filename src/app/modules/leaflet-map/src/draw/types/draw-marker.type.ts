import { DivIcon, FeatureGroup, LatLng, Marker, Point } from 'leaflet';
import { DrawTooltip } from '../draw-tooltip';

export type DrawMarkerContext = {
  marker: Marker | undefined;
  tooltip: DrawTooltip | undefined;
  currentLatLng: LatLng | undefined;
  editMode: boolean;
};

export type DrawMarkerPreserveData = {
  tooltipArray: (DrawTooltip | undefined)[];
  markersArray: (Marker | undefined)[];
};

export type DrawMarkerLayers = {
  markersLayers: FeatureGroup;
  drawLayer: FeatureGroup;
  tooltipLayers: FeatureGroup;
};

export type DrawMarkerEventContext = {
  clickHandled: boolean;
  mouseDownOrigin: Point | undefined;
  touchHandled: boolean;
};

export type DrawMarkerEditContext = {
  previousLocation: LatLng | undefined;
};

export type DrawMarkerSettings = {
  drawError: {
    color: string;
    timeout: 2500;
    message: string;
  };
  icon: DivIcon;
  preserveIcon: DivIcon;
  zIndexOffset: number;
};

export type DrawMarkerResult = {
  markersArray: DrawMarkerArray;
};

export type DrawMarkerArray = (Marker | undefined)[];
