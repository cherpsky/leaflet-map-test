import { Polygon } from 'geojson';

export class ProductionUnit {
  id: number;
  name: string;
  description: string;
  color: string;
  polygon: Polygon;
  classId: number;
  clientId: number;
  label: string;

  constructor(
    fence: Pick<
      ProductionUnit,
      | 'id'
      | 'name'
      | 'description'
      | 'classId'
      | 'clientId'
      | 'polygon'
      | 'color'
    >
  ) {
    this.id = fence.id;
    this.name = fence.name;
    this.description = fence.description;
    this.color = fence.color;
    this.polygon = fence.polygon;
    this.classId = fence.classId;
    this.clientId = fence.clientId;
    this.label = `${fence.id}. ${fence.name}`;
  }
}
