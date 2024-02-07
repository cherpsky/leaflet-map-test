import { DomUtil, FeatureGroup, LatLng, Map as LeafletMap } from 'leaflet';
import { TooltipText } from './draw-control.type';

export class DrawTooltip {
  private popUpPane: HTMLElement | undefined;
  private visible: boolean;
  private container: HTMLDivElement | undefined;
  private singleLineLabel: boolean;

  constructor(private readonly map: LeafletMap, private permanent?: boolean) {
    this.visible = false;
    this.singleLineLabel = false;
  }

  addTo(layer: FeatureGroup): void {
    this.dispose();
    this.popUpPane = layer.getPane();
    if (!this.popUpPane) return;
    this.container = DomUtil.create('div', 'leaflet-draw-tooltip', this.popUpPane);
    if (!this.permanent) this.map.on('mouseout', this.onMouseOut, this);
  }

  dispose(): void {
    if (!this.permanent) this.map.off('mouseout', this.onMouseOut, this);
    if (!this.container || !this.popUpPane) return;
    this.popUpPane.removeChild(this.container);
    this.container = undefined;
  }

  updateContent(labelText: TooltipText): DrawTooltip {
    if (!this.container) return this;
    labelText.subText = labelText.subText || '';
    if (labelText.subText.length === 0 && !this.singleLineLabel) {
      DomUtil.addClass(this.container, 'leaflet-draw-tooltip-single');
      this.singleLineLabel = true;
    } else if (labelText.subText.length > 0 && this.singleLineLabel) {
      DomUtil.removeClass(this.container, 'leaflet-draw-tooltip-single');
      this.singleLineLabel = false;
    }

    this.container.innerHTML =
      (labelText.subText.length > 0 ? '<span class="leaflet-draw-tooltip-subtext">' + labelText.subText + '</span>' + '<br />' : '') +
      '<span>' +
      labelText.text +
      '</span>';

    if (!labelText.text && !labelText.subText) {
      this.visible = false;
      this.container.style.visibility = 'hidden';
    } else {
      this.visible = true;
      this.container.style.visibility = 'inherit';
    }

    return this;
  }

  updatePosition(latLng: LatLng): DrawTooltip {
    if (!this.container) return this;
    const pos = this.map.latLngToLayerPoint(latLng);
    const tooltipContainer = this.container;
    if (!this.container) return this;
    if (this.visible) tooltipContainer.style.visibility = 'inherit';
    DomUtil.setPosition(tooltipContainer, pos);
    return this;
  }

  showAsError(): DrawTooltip {
    if (this.container) DomUtil.addClass(this.container, 'leaflet-draw-error-tooltip');
    return this;
  }

  removeError(): DrawTooltip {
    if (this.container) DomUtil.removeClass(this.container, 'leaflet-draw-error-tooltip');
    return this;
  }

  onMouseOut(): void {
    if (!this.container) return;
    this.container.style.visibility = 'hidden';
  }
}
