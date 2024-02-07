import { DivIcon, FeatureGroup, LatLng, Marker, Point, Polyline } from 'leaflet';
import { DrawTooltip } from '../draw-tooltip';
import { LineString } from 'geojson';

export type DrawPolylineContext = {
  polyline: Polyline | undefined;
  markers: Marker[] | undefined;
  totalDistance: number;
  tooltip: DrawTooltip | undefined;
  currentLatLng: LatLng | undefined;
  guidesContainer: HTMLDivElement | undefined;
  editMode: boolean;
};

export type DrawPolylinePreserveData = {
  polylineArray: (Polyline<LineString> | undefined)[];
  tooltipArray: (DrawTooltip | undefined)[];
  markersArray: (Marker[] | undefined)[];
};

export type DrawPolylineSettings = {
  defaultColor: string;
  drawError: {
    color: string;
    timeout: 2500;
    message: string;
  };
  guidelineDistance: number;
  icon: DivIcon;
  maxGuideLineLength: number;
  preserveIcon: DivIcon;
  zIndexOffset: number;
};

export type DrawPolylineEventContext = {
  errorShown: boolean;
  clickHandled: boolean;
  mouseDownOrigin: Point | undefined;
  touchHandled: boolean;
};

export type DrawPolylineLayers = {
  markersLayers: FeatureGroup;
  polylineLayers: FeatureGroup;
  drawLayer: FeatureGroup;
  tooltipLayers: FeatureGroup;
};

export type DrawPolylineEditContext = {
  previousLocation: LatLng | undefined;
  errorShown: boolean;
};

export type DrawPolylineResult = {
  polylineArray: DrawPolylineArray;
};

export type DrawPolylineArray = (Polyline<LineString> | undefined)[];
