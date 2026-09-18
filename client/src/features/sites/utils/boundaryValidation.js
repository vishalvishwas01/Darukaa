export function validatePolygonBoundary(boundary) {
  if (!boundary || typeof boundary !== 'object') return 'Draw a polygon before saving.'
  if (boundary.type !== 'Polygon') return 'Only Polygon boundaries are supported.'

  const ring = boundary.coordinates?.[0]
  if (!Array.isArray(ring) || ring.length < 4) {
    return 'The outer ring needs at least four coordinates.'
  }

  const first = ring[0]
  const last = ring[ring.length - 1]
  if (JSON.stringify(first) !== JSON.stringify(last)) {
    return 'The polygon ring must be closed.'
  }

  for (const coordinate of ring) {
    if (!Array.isArray(coordinate) || coordinate.length !== 2 || !coordinate.every(Number.isFinite)) {
      return 'Each coordinate must be a finite [longitude, latitude] pair.'
    }
    const [longitude, latitude] = coordinate
    if (longitude < -180 || longitude > 180) return 'Longitude must be between -180 and 180.'
    if (latitude < -90 || latitude > 90) return 'Latitude must be between -90 and 90.'
  }

  return null
}

export function featureToPolygon(feature) {
  if (!feature || feature.geometry?.type !== 'Polygon') return null
  return {
    type: 'Polygon',
    coordinates: feature.geometry.coordinates,
  }
}
