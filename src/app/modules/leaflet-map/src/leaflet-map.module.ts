import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LeafletDrawComponents } from './draw';
import { LeafletMapComponent } from './leaflet-map.component';
import { MeasurementControlComponent } from './controls';
import { MapToolComponent } from './draw/components/map-tool/map-tool.component';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [
    LeafletMapComponent,
    ...LeafletDrawComponents,
    MeasurementControlComponent,
  ],
  exports: [LeafletMapComponent, MapToolComponent],
  imports: [CommonModule, MatIconModule],
})
export class LeafletMapModule {}
