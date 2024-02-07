import { Component, Input } from '@angular/core';
import { DrawPolylineHandler } from '../../handlers';

@Component({
  selector: 'app-draw-toolbar-actions',
  templateUrl: './draw-toolbar-actions.component.html',
  styleUrls: ['./draw-toolbar-actions.component.scss'],
})
export class DrawToolbarActionsComponent {
  @Input() handler: DrawPolylineHandler | undefined;

  finish(): void {
    if (!this.handler) return;
    this.handler.finishShape();
  }
}
