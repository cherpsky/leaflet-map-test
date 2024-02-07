import { DrawMarkerHandler } from './draw-marker.handler';
import { DrawPolygonHandler } from './draw-polygon.handler';
import { DrawPolylineHandler } from './draw-polyline.handler';

export type DrawHandler = DrawPolylineHandler | DrawPolygonHandler | DrawMarkerHandler;
export { DrawPolylineHandler, DrawPolygonHandler, DrawMarkerHandler };
