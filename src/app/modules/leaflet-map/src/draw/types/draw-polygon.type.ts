import { LineString } from 'geojson';
import { DivIcon, FeatureGroup, LatLng, Marker, Point, Polygon } from 'leaflet';
import { DrawTooltip } from '../draw-tooltip';

export type DrawPolygonContext = {
  polygon: Polygon | undefined;
  polyline: Polygon<LineString> | undefined;
  markers: Marker[] | undefined;
  tooltip: DrawTooltip | undefined;
  currentLatLng: LatLng | undefined;
  guidesContainer: HTMLDivElement | undefined;
  editMode: boolean;
};

export type DrawPolygonPreserveData = {
  polygonArray: (Polygon | undefined)[];
  tooltipArray: (DrawTooltip | undefined)[];
  markersArray: (Marker[] | undefined)[];
};

export type DrawPolygonLayers = {
  markersLayers: FeatureGroup;
  polygonsLayers: FeatureGroup;
  drawLayer: FeatureGroup;
  tooltipLayers: FeatureGroup;
};

export type DrawPolygonEventContext = {
  errorShown: boolean;
  clickHandled: boolean;
  mouseDownOrigin: Point | undefined;
  touchHandled: boolean;
};

export type DrawPolygonEditContext = {
  previousLocation: LatLng | undefined;
  errorShown: boolean;
};

export type DrawPolygonSettings = {
  drawError: {
    color: string;
    timeout: 2500;
    message: string;
  };
  guidelineDistance: number;
  icon: DivIcon;
  maxGuideLineLength: number;
  preserveIcon: DivIcon;
  showArea: boolean;
  showLength: boolean;
  shapeOptions: {
    stroke: boolean;
    color: string;
    weight: number;
    opacity: number;
    fill: boolean;
    fillColor: string; //same as color by default
    fillOpacity: number;
  };
  zIndexOffset: number;
  // Defines the precision for each type of unit (e.g. {km: 2, ft: 0}
  precision: number;
};

export type DrawPolygonResult = {
  polygonArray: DrawPolygonArray;
};

export type DrawPolygonArray = (Polygon | undefined)[];
