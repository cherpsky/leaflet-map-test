import { Directive, OnDestroy } from '@angular/core';
import { Control, ControlOptions, Map as LeafMap } from 'leaflet';
import { uniqueId } from 'lodash';

@Directive()
export class LeafletControl extends Control implements OnDestroy {
  private id: string;
  protected map: LeafMap | undefined;
  constructor(options?: ControlOptions) {
    super(options);
    this.id = uniqueId();
  }

  public getId(): string {
    return this.id;
  }

  ngOnDestroy(): void {
    this.map?.removeControl(this);
  }
}
