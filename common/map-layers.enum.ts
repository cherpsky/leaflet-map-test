export enum MapLayers {
  GOOGLE_MAPS = 'GOOGLE_MAPS',
  OPEN_STREET_MAP = 'OPEN_STREET_MAP',
}

export const mapLayersMap = new Map<MapLayers, string>();
mapLayersMap.set(MapLayers.GOOGLE_MAPS, 'Google Maps');
mapLayersMap.set(MapLayers.OPEN_STREET_MAP, 'Open Street Map');
