import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import config from '../../../lib/config'
import { featureToPolygon } from '../utils/boundaryValidation'
import './MapView.css'

const DEFAULT_CENTER = [77.209, 28.6139]
const DEFAULT_ZOOM = 11

const polygonFeature = (boundary) => ({
  type: 'Feature',
  properties: {},
  geometry: boundary,
})

const fitBoundary = (map, boundary) => {
  const coordinates = boundary?.coordinates?.[0]
  if (!coordinates?.length) return
  const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
  coordinates.forEach((coordinate) => bounds.extend(coordinate))
  map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 })
}

export default function MapView({
  boundary = null,
  drawingEnabled = false,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  onPolygonChange,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const drawRef = useRef(null)
  const boundaryRef = useRef(boundary)
  const initialBoundaryRef = useRef(boundary)
  const callbackRef = useRef(onPolygonChange)
  const [status, setStatus] = useState(config.mapboxToken ? 'loading' : 'missing-token')
  const [message, setMessage] = useState('')

  useEffect(() => {
    callbackRef.current = onPolygonChange
  }, [onPolygonChange])

  useEffect(() => {
    if (!config.mapboxToken || !containerRef.current) return undefined

    let disposed = false
    mapboxgl.accessToken = config.mapboxToken
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: true,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const handleError = () => {
      if (!disposed) {
        setStatus('error')
        setMessage('Mapbox could not load this map. Check the public Mapbox token and try again.')
      }
    }

    map.on('error', handleError)
    map.once('load', () => {
      if (disposed) return
      if (drawingEnabled) {
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: { polygon: true, trash: true },
          defaultMode: initialBoundaryRef.current ? 'simple_select' : 'draw_polygon',
        })
        drawRef.current = draw
        map.addControl(draw, 'top-left')
        if (initialBoundaryRef.current) {
          const feature = draw.add(polygonFeature(initialBoundaryRef.current))[0]
          boundaryRef.current = initialBoundaryRef.current
          draw.changeMode('simple_select', { featureIds: [feature] })
          fitBoundary(map, initialBoundaryRef.current)
        }

        const handleDraw = (event) => {
          const feature = event.features?.find((item) => item.geometry?.type === 'Polygon')
          const nextBoundary = featureToPolygon(feature)
          boundaryRef.current = nextBoundary
          callbackRef.current(nextBoundary)
        }
        const handleDelete = () => {
          boundaryRef.current = null
          callbackRef.current(null)
        }
        map.on('draw.create', handleDraw)
        map.on('draw.update', handleDraw)
        map.on('draw.delete', handleDelete)
        map.once('remove', () => {
          map.off('draw.create', handleDraw)
          map.off('draw.update', handleDraw)
          map.off('draw.delete', handleDelete)
        })
      } else if (initialBoundaryRef.current) {
        map.addSource('site-boundary', {
          type: 'geojson',
          data: polygonFeature(initialBoundaryRef.current),
        })
        map.addLayer({ id: 'site-boundary-fill', type: 'fill', source: 'site-boundary', paint: { 'fill-color': '#9cc94a', 'fill-opacity': 0.3 } })
        map.addLayer({ id: 'site-boundary-line', type: 'line', source: 'site-boundary', paint: { 'line-color': '#35634d', 'line-width': 3 } })
        fitBoundary(map, initialBoundaryRef.current)
      }
      map.resize()
      setStatus('ready')
    })

    return () => {
      disposed = true
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
      drawRef.current = null
    }
  }, [drawingEnabled, initialCenter, initialZoom])

  useEffect(() => {
    if (!drawingEnabled || !drawRef.current) return
    if (JSON.stringify(boundaryRef.current) === JSON.stringify(boundary)) return
    const draw = drawRef.current
    draw.deleteAll()
    boundaryRef.current = boundary
    if (boundary) {
      const feature = draw.add(polygonFeature(boundary))[0]
      draw.changeMode('simple_select', { featureIds: [feature] })
      fitBoundary(mapRef.current, boundary)
    }
  }, [boundary, drawingEnabled])

  if (status === 'missing-token') {
    return <div className="map-message" role="alert"><strong>Mapbox is not configured.</strong><span>Set VITE_MAPBOX_ACCESS_TOKEN and restart the Vite server.</span></div>
  }

  if (status === 'error') {
    return <div className="map-message" role="alert"><strong>Map unavailable</strong><span>{message}</span></div>
  }

  return <div className="map-frame"><div ref={containerRef} className="map-container" aria-label={drawingEnabled ? 'Interactive polygon map' : 'Read-only site boundary map'} />{status === 'loading' && <div className="map-loading" role="status">Loading map...</div>}{drawingEnabled && status === 'ready' && <div className="map-instructions">Draw a polygon with the map control. Select it to edit, or use the trash control to clear it.</div>}</div>
}
