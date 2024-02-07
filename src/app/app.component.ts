import { Component, OnInit } from '@angular/core';
import {
  DrawPolygonArray,
  LeafletMapDrawOptions,
} from './modules/leaflet-map/src';
import { Polygon } from 'leaflet';
import { ProductionUnitsPolygonService } from './services/polygon.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'map-test';
  drawOptions?: LeafletMapDrawOptions = undefined;

  constructor(
    private productionUnitPolygonService: ProductionUnitsPolygonService
  ) {}

  ngOnInit(): void {
    this.setPolygonControl();
  }

  setPolygonControl(): void {
    setTimeout(() => {
      console.log('SETTING');
      this.drawOptions = {
        position: 'topright',
        draw: {
          polygon: { draw: true, multiple: true, allowIntersection: false },
        },
      };
    }, 2000);
  }

  polygonClosed(polygon: Polygon): void {
    console.log('POLYGON', polygon);
  }

  polygonEdited(polygon: DrawPolygonArray): void {
    console.log('EDITED', polygon);
  }
}
