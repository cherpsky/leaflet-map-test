import { AfterViewInit, Component, Input } from '@angular/core';

@Component({
  selector: 'app-map-tool',
  templateUrl: './map-tool.component.html',
  styleUrls: ['./map-tool.component.scss'],
})
export class MapToolComponent implements AfterViewInit {
  @Input() matIcon?: string;
  @Input() svgIcon?: string;
  @Input() active = false;

  ready: boolean | undefined;

  ngAfterViewInit(): void {
    setTimeout(() => (this.ready = true), 1000);
  }
}
