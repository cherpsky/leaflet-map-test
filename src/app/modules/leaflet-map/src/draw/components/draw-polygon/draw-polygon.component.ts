import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { DrawPolygonEvents } from '../../enums';
import { DrawPolygonHandler } from '../../handlers';
import { Map as LeafletMap } from 'leaflet';

@Component({
  selector: 'app-draw-polygon',
  templateUrl: './draw-polygon.component.html',
  styleUrls: ['./draw-polygon.component.scss'],
})
export class DrawPolygonComponent implements AfterViewInit {
  @Input() handler: DrawPolygonHandler | undefined;
  @Output() closeTool: EventEmitter<boolean> = new EventEmitter<boolean>();

  isEditActive = false;

  isDrawing = false;

  isDrawingOrEditing = false;

  drawIsAllowed = true;

  private map: LeafletMap | undefined;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.isEditActive = this.handler?.getEditMode() || false;
      this.drawIsAllowed = this.handler?.getDrawAvailable() || false;
    }, 0);
    this.map = this.handler?.getMap();
    this.map?.on(DrawPolygonEvents.DRAW_POLYGON_START, () => this.drawStart());
    this.map?.on(DrawPolygonEvents.DRAW_POLYGON_END, () => this.drawEnd());
    this.map?.on(DrawPolygonEvents.DRAW_POLYGON_EDITED, () => this.polylineEdited());
  }

  cancel(): void {
    this.handler?.cancel();
  }

  change(): void {
    this.handler?.changeEditMode();
    this.isEditActive = this.handler?.getEditMode() || false;
    this.isDrawing = false;
    this.isDrawingOrEditing = false;
  }

  finish(): void {
    this.handler?.finishShape();
  }

  save(): void {
    this.handler?.save();
    this.closeTool.emit(true);
    this.isDrawing = false;
    this.isDrawingOrEditing = false;
  }

  private polylineEdited(): void {
    this.isDrawingOrEditing = true;
  }

  private drawEnd(): void {
    this.isDrawing = false;
    this.isDrawingOrEditing = false;
  }

  private drawStart(): void {
    this.isDrawing = true;
    this.isDrawingOrEditing = true;
  }
}
