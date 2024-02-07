import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LeafletMapModule } from './modules/leaflet-map/src';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, BrowserAnimationsModule, LeafletMapModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
