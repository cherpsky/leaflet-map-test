import { DrawMarkerComponent } from './draw-marker/draw-marker.component';
import { DrawPolygonComponent } from './draw-polygon/draw-polygon.component';
import { DrawPolylineComponent } from './draw-polyline/draw-polyline.component';
import { DrawToolbarActionsComponent } from './draw-toolbar-actions/draw-toolbar-actions.component';
import { DrawToolbarComponent } from './draw-toolbar/draw-toolbar.component';
import { MapToolComponent } from './map-tool/map-tool.component';

export const LeafletDrawComponents = [
  MapToolComponent,
  DrawToolbarComponent,
  DrawToolbarActionsComponent,
  DrawMarkerComponent,
  DrawPolylineComponent,
  DrawPolygonComponent,
];
