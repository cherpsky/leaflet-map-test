import { AfterViewInit, Component, ElementRef, Input } from '@angular/core';
import { DomEvent } from 'leaflet';
import { DrawToolBarOption } from '../../draw-control.type';
import { MapDrawTools } from '../../map-draw-tools.enum';

@Component({
  selector: 'app-draw-toolbar',
  templateUrl: './draw-toolbar.component.html',
  styleUrls: ['./draw-toolbar.component.scss'],
})
export class DrawToolbarComponent implements AfterViewInit {
  ready: boolean | undefined;

  activeTool: DrawToolBarOption | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeHandler: any;
  availableTools = MapDrawTools;
  @Input() tools: DrawToolBarOption[] = [];
  @Input() open: MapDrawTools | undefined;
  @Input() position: 'right' | 'left' = 'right';

  constructor(private readonly elRef: ElementRef) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.ready = true;
      if (!this.open) return;
      const tool = this.tools.find((toolOpt) => toolOpt.tool == this.open);
      this.changeActiveTool(tool, undefined);
    }, 100);
  }

  changeActiveTool(tool: DrawToolBarOption | undefined, event: Event | undefined): void {
    if (event) DomEvent.preventDefault(event);
    if (tool && this.activeTool == tool) {
      this.activeTool.handler.removeHooks();
      this.activeHandler = undefined;
      this.activeTool = undefined;
    } else {
      this.activeTool = tool;
      this.activeHandler = this.activeTool?.handler;
      if (this.activeTool) this.activeTool.handler.addHooks();
    }
  }

  getContent(): ElementRef {
    return this.elRef;
  }
}
