/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChangeDetectorRef, Component, ElementRef } from '@angular/core';
import { Circle, Control, LayerGroup, Map as LeafMap, Marker, Polyline, Rectangle } from 'leaflet';
import { MeasurementEvents } from '../../handlers';
import { DrawCircleEvents, DrawRectangleEvents } from '../../handlers/handler.events';
import { GeometryUtil } from '../../draw/utils';

@Component({
  selector: 'app-measurement-control',
  templateUrl: './measurement-control.component.html',
  styleUrls: ['./measurement-control.component.scss'],
})
export class MeasurementControlComponent extends Control {
  private map: LeafMap | undefined;
  private measurementLayer: LayerGroup = new LayerGroup();
  public measuringDistance = false;
  public measuringCircleArea = false;
  public measuringRectArea = false;

  private lineColor = this.getRandomColor();
  private circleColor = this.getRandomColor();
  private rectColor = this.getRandomColor();

  constructor(private elementRef: ElementRef, private changeRef: ChangeDetectorRef) {
    super();
  }

  override onAdd(map: LeafMap): HTMLElement {
    this.map = map;
    if (!this.map.hasLayer(this.measurementLayer)) this.measurementLayer.addTo(this.map);
    return this.elementRef.nativeElement;
  }

  override onRemove(): void {
    this.removeHandlers();
    this.removeMapListeners();
  }

  private removeHandlers(): void {
    (this.map as any).polyDistance?.disable();
  }

  private addMapListeners(): void {
    if (!this.map) return;
    this.map.on(MeasurementEvents.FINISHED_MEASUREMENT, (event: any) => {
      const data = <Marker[]>event.data;
      const distance = <number>event.distance;
      this.addMeasurementPolyline(data, distance);
      this.measuringDistance = false;
      this.disableDistanceMeasuring();
      this.changeRef.detectChanges();
    });
  }

  private addDrawCircleListeners(): void {
    if (!this.map) return;
    this.map.on(DrawCircleEvents.FINISHED_CIRCLE, (event: any) => {
      const circle = <Circle>event.data;
      this.addCircleToMap(circle);
      this.measuringCircleArea = false;
      this.disableMeasuringCircleArea();
      this.changeRef.detectChanges();
    });
  }

  private addDrawRectangleListeners(): void {
    if (!this.map) return;
    this.map.on(DrawRectangleEvents.FINISHED_RECTANGLE, (event: any) => {
      const rectangle = <Rectangle>event.data;
      this.addRectangleToMap(rectangle);
      this.measuringRectArea = false;
      this.disableMeasuringRectArea();
      this.changeRef.detectChanges();
    });
  }

  private addRectangleToMap(rectangle: Rectangle): void {
    if (!this.map) return;
    const bounds = rectangle.getBounds();

    const area =
      GeometryUtil.geodesicArea([bounds.getSouthWest(), bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthEast(), bounds.getSouthWest()]) /
      1000000;

    rectangle.setStyle({ color: this.rectColor });
    rectangle.bindTooltip(`Area: ${area.toFixed(1)} Km²`, { permanent: true, direction: 'center' });
    rectangle.addTo(this.measurementLayer);
  }

  private addCircleToMap(circle: Circle): void {
    if (!this.map) return;
    const area = (((Math.PI * circle.getRadius()) / 1000) * circle.getRadius()) / 1000;
    circle.setStyle({ color: this.circleColor });
    circle.addTo(this.measurementLayer!).bindTooltip(`Area: ${area.toFixed(1)} Km²`, { permanent: true, direction: 'center' });
  }

  private addMeasurementPolyline(markers: Marker[], distance: number): void {
    if (!this.map) return;
    new Polyline(
      markers.map((marker) => marker.getLatLng()),
      { color: this.lineColor },
    )
      .bindTooltip(`${(distance / 1000).toFixed(1)} Km`, { permanent: true, direction: 'center' })
      .addTo(this.measurementLayer!);
  }

  public clearLayer(event?: Event): void {
    if (event) event.stopImmediatePropagation();
    if (!this.measurementLayer || !this.map) return;
    this.measurementLayer.clearLayers();
  }

  private removeMapListeners(): void {
    if (!this.map) return;
    this.map.off(MeasurementEvents.POLYLINE_MEASURED);
    this.map.off(DrawCircleEvents.FINISHED_CIRCLE);
  }

  public toggleTool(type: 'distance' | 'circleArea' | 'rectArea', event?: Event): void {
    event?.stopImmediatePropagation();
    this.onRemove();
    if (type === 'distance') {
      this.measuringDistance = !this.measuringDistance;
      this.measuringCircleArea = false;
      this.measuringRectArea = false;
      if (this.measuringDistance) {
        this.disableMeasuringCircleArea();
        this.disableMeasuringRectArea();
        this.enableDistanceMeasuring();
      } else this.disableDistanceMeasuring();
    } else if (type === 'circleArea') {
      this.measuringCircleArea = !this.measuringCircleArea;
      this.measuringDistance = false;
      this.measuringRectArea = false;
      if (this.measuringCircleArea) {
        this.disableMeasuringRectArea();
        this.disableDistanceMeasuring();
        this.enableMeasuringCircleArea();
      } else this.disableMeasuringCircleArea();
    } else if (type === 'rectArea') {
      this.measuringRectArea = !this.measuringRectArea;
      this.measuringDistance = false;
      this.measuringCircleArea = false;
      if (this.measuringRectArea) {
        this.disableDistanceMeasuring();
        this.disableMeasuringCircleArea();
        this.enableMeasuringRectArea();
      } else this.disableMeasuringRectArea();
    }
  }

  private enableDistanceMeasuring(): void {
    (this.map as any).polyDistance?.enable();
    this.addMapListeners();
    this.disableMeasuringCircleArea();
  }

  private disableDistanceMeasuring(): void {
    (this.map as any).polyDistance?.disable();
    this.map?.off(MeasurementEvents.FINISHED_MEASUREMENT);
  }

  private enableMeasuringCircleArea(): void {
    (this.map as any).drawCircle?.enable(true);
    this.addDrawCircleListeners();
  }

  private disableMeasuringCircleArea(): void {
    (this.map as any).drawCircle?.disable();
    this.map?.off(DrawCircleEvents.FINISHED_CIRCLE);
  }

  private enableMeasuringRectArea(): void {
    (this.map as any).drawRectangle?.enable(true);
    this.addDrawRectangleListeners();
  }

  private disableMeasuringRectArea(): void {
    (this.map as any).drawRectangle?.disable();
    this.map?.off(DrawRectangleEvents.FINISHED_RECTANGLE);
  }

  private getRandomColor(): string {
    const hue = Math.floor(Math.random() * 361);
    const saturation = 80;
    const lightness = 40 + Math.random() * 10;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }
}
