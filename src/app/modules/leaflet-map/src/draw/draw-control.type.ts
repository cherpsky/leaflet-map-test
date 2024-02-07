import {
  Circle,
  CircleOptions,
  Control,
  ControlOptions,
  Map as LeafletMap,
  Marker,
  MarkerOptions,
  PathOptions,
  Polygon,
  Polyline,
  PolylineOptions,
} from 'leaflet';
import { DrawPolygonHandler, DrawPolylineHandler } from './handlers';
import { DrawMarkerHandler } from './handlers/draw-marker.handler';
import { MapDrawTools } from './map-draw-tools.enum';

export type DrawControlOptions = {
  layerControl: Control.Layers;
  draw?: DrawOptions;
  map: LeafletMap;
} & ControlOptions;

export type DrawOptions = {
  [MapDrawTools.POLYLINE]?: DrawPolylineOptions;
  [MapDrawTools.SQUARE]?: DrawSquareOptions;
  [MapDrawTools.ADD_LOCATION]?: DrawMarkerOptions;
  [MapDrawTools.CIRCLE]?: DrawCircleOptions;
  [MapDrawTools.POLYGON]?: DrawPolygonOptions;
  open?: MapDrawTools;
};

export type DrawPolylineOptions = {
  multiple: boolean;
  draw: boolean;
  edit?: { polyline: Polyline[] };
  allowIntersection?: boolean;
  shapeOptions?: PathOptions;
};

export type DrawSquareOptions = {
  multiple: boolean;
  draw: boolean;
  edit?: { squares: Polygon[] };
  allowIntersection?: boolean;
  shapeOptions?: PolylineOptions;
};

export type DrawMarkerOptions = {
  multiple: boolean;
  draw: boolean;
  edit?: { markers: Marker[] };
  allowIntersection?: boolean;
  shapeOptions?: MarkerOptions;
};

export type DrawCircleOptions = {
  multiple: boolean;
  draw: boolean;
  edit?: { circles: Circle[] };
  allowIntersection?: boolean;
  shapeOptions?: CircleOptions;
};

export type DrawPolygonOptions = {
  multiple: boolean;
  draw: boolean;
  edit?: { polygon: Polygon[] };
  allowIntersection?: boolean;
  shapeOptions?: PolylineOptions;
};

export type TooltipText = { text: string; subText?: string };

export type DrawToolBarOption =
  | { handler: DrawPolygonHandler; tool: MapDrawTools.POLYGON }
  | { handler: DrawPolylineHandler; tool: MapDrawTools.POLYLINE }
  | { handler: DrawMarkerHandler; tool: MapDrawTools.ADD_LOCATION };
