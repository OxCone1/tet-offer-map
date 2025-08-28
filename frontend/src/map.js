import L from 'leaflet';
import { DataUtils } from './utils.js';

/**
 * Map management class for handling Leaflet map and data visualization
 */
export class MapManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.tetLayer = null;
    this.userLayer = null;
    this.sectorsLayer = null;
    this.sectorsVisible = false;
    this.typeFilters = new Set(); // empty => show all
    this._autoLogBounds = false; // disabled by default; can be toggled for prototyping
    this.init();
  }

  /**
   * Initialize the map
   */
  init() {
    // Initialize map centered on Riga, Latvia
    this.map = L.map(this.containerId, {
      center: [57.018526, 24.263647],
      zoom: 14,
      zoomControl: true,
      zoomDelta: 1,
      zoomSnap: 1
    });

    // Testing: log current zoom level on init
    // if (this.map && this.map.getZoom) {
    //   console.log('Map zoom level (init):', this.map.getZoom());
    // }

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.map.zoomControl.setPosition('bottomright');

    // Initialize layer groups
    this.tetLayer = L.layerGroup().addTo(this.map);
    this.userLayer = L.layerGroup().addTo(this.map);
    this.sectorsLayer = L.layerGroup().addTo(this.map);

    // Fix for Leaflet default markers
    this.fixLeafletMarkers();

    // Re-style on zoom changes and log current zoom for testing
    this.map.on('zoomend', () => {
      const z = this.map.getZoom ? this.map.getZoom() : null;
      console.log('Map zoom changed:', z);
      this._restyleVisibleLayers();
      if (this._autoLogBounds) this.logVisibleBounds('zoomend');
    });

    // Log bounds after finished moving (panning or programmatic setView/fitBounds)
    this.map.on('moveend', () => {
      if (this._autoLogBounds) this.logVisibleBounds('moveend');
    });

    // Expose lightweight debug helpers for prototyping (non-production)
    if (typeof window !== 'undefined') {
      // On-demand logging of current visible bounds
      window.logMapBounds = () => this.logVisibleBounds();
      // Structured access for deeper inspection
      window.__mapDebug = {
        logBounds: () => this.logVisibleBounds(),
        getBounds: () => this.getVisibleBounds(),
        map: this.map,
        manager: this,
        enableAutoBounds: () => { this.setAutoLogBounds(true); },
        disableAutoBounds: () => { this.setAutoLogBounds(false); },
        toggleAutoBounds: () => { this.setAutoLogBounds(!this._autoLogBounds); }
      };
    }
  }

  /**
   * Fix Leaflet default marker icons
   */
  fixLeafletMarkers() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }

  /**
   * Add TET data to map
   */
  addTETData(data) {
    this.tetLayer.clearLayers();
    this.tetDataCache = data;

    data.forEach(property => {
      if (!property.geometry || !property.offers) return;

      // Use the first offer for coloring (or could aggregate multiple offers)
      const primaryOffer = property.offers[0];
      const norm = DataUtils.normalizeConnectionType(primaryOffer.connectionType);
      if (!this._passesFilter(norm)) return;
      const color = DataUtils.getConnectionColor(norm, false);
      const layer = this.createPropertyLayer(property, color, false);

      if (layer) {
        this.tetLayer.addLayer(layer);
      }
    });
  }

  /**
   * Add user data to map
   */
  addUserData(data) {
    this.userLayer.clearLayers();
    this.userDataCache = data;

    data.forEach(feature => {
      if (!DataUtils.isValidGeoJSONFeature(feature)) return;
      const norm = DataUtils.normalizeConnectionType(feature.properties.connection_type);
      if (!this._passesFilter(norm)) return;
      const color = DataUtils.getConnectionColor(norm, true);
      const layer = this.createFeatureLayer(feature, color, true);

      if (layer) {
        this.userLayer.addLayer(layer);
      }
    });
  }

  /**
   * Create a layer for a property with offers
   */
  createPropertyLayer(property, color, isUserData) {
    const { geometry } = property;
    const styleOpts = this._styleForGeometry(geometry, color);

    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      // Convert TET property to valid GeoJSON Feature
      const geoJsonFeature = {
        type: "Feature",
        geometry: geometry,
        properties: {
          ...property.properties,
          id: property.id,
          address: property.address,
          offers: property.offers,
          scrapedAt: property.scrapedAt,
          source: property.source
        }
      };

      return L.geoJSON(geoJsonFeature, {
        style: styleOpts.polygon,
        onEachFeature: (feature, layer) => {
          layer.on('click', () => {
            if (this.showPropertyDetails) {
              this.showPropertyDetails(property, isUserData);
            }
          });
        }
      });
    } else if (geometry.type === 'Point') {
      const coords = geometry.coordinates;
      return L.circleMarker([coords[1], coords[0]], styleOpts.point).on('click', () => {
        if (this.showPropertyDetails) {
          this.showPropertyDetails(property, isUserData);
        }
      });
    }

    return null;
  }

  /**
   * Create a layer for a generic user GeoJSON Feature
   */
  createFeatureLayer(feature, color, isUserData) {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) return null;
    const { geometry } = feature;
    const styleOpts = this._styleForGeometry(geometry, color);

    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      return L.geoJSON(feature, {
        style: styleOpts.polygon,
        onEachFeature: (feat, layer) => {
          layer.on('click', () => {
            if (this.showPropertyDetails) {
              // Pass the feature properties; mark as user data
              this.showPropertyDetails(feat.properties, isUserData);
            }
          });
        }
      });
    } else if (geometry.type === 'Point') {
      const coords = geometry.coordinates;
      return L.circleMarker([coords[1], coords[0]], styleOpts.point).on('click', () => {
        if (this.showPropertyDetails) {
          this.showPropertyDetails(feature.properties, isUserData);
        }
      });
    }
    return null;
  }

  /**
   * Show property details (will be implemented by the main app)
   */
  showPropertyDetails(properties, isUserData) {
    // This will be overridden by the main application
    console.log('Property details:', properties, 'User data:', isUserData);
  }

  /**
   * Toggle TET data visibility
   */
  toggleTETData(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.tetLayer)) {
        this.map.addLayer(this.tetLayer);
      }
    } else {
      if (this.map.hasLayer(this.tetLayer)) {
        this.map.removeLayer(this.tetLayer);
      }
      // Also clear the layer content when hiding
      this.tetLayer.clearLayers();
    }
  }

  /**
   * Toggle user data visibility
   */
  toggleUserData(visible) {
    if (visible) {
      if (!this.map.hasLayer(this.userLayer)) {
        this.map.addLayer(this.userLayer);
      }
    } else {
      if (this.map.hasLayer(this.userLayer)) {
        this.map.removeLayer(this.userLayer);
      }
      // Also clear the layer content when hiding
      this.userLayer.clearLayers();
    }
  }

  /** Set connection type filters (array of canonical types). Empty => show all */
  setTypeFilters(types) {
    this.typeFilters = new Set(types || []);
    // Re-render by rebuilding layers only if they should be visible
    if (this.tetDataCache && this.map.hasLayer(this.tetLayer)) {
      this.addTETData(this.tetDataCache);
    }
    if (this.userDataCache && this.map.hasLayer(this.userLayer)) {
      this.addUserData(this.userDataCache);
    }
    // Also refresh sectors if used
    if (this.sectorsVisible) {
      this.updateSectors(this._lastSectorsOpts || {});
    }
  }

  /**
   * Toggle sectors overlay visibility
   */
  toggleSectors(visible) {
    this.sectorsVisible = visible;
    if (visible) {
      if (!this.map.hasLayer(this.sectorsLayer)) {
        this.map.addLayer(this.sectorsLayer);
      }
    } else {
      if (this.map.hasLayer(this.sectorsLayer)) {
        this.map.removeLayer(this.sectorsLayer);
      }
    }
  }

  /**
   * Update sectors overlay from provided data
   * @param {{tet: any[], user: any[], includeTet: boolean, includeUser: boolean, epsMeters: number, minPts: number}} opts
   */
  updateSectors(opts) {
    if (!opts) return;
    const { tet = [], user = [], includeTet = true, includeUser = true, epsMeters = 180, minPts = 5 } = opts;
    this._lastSectorsOpts = opts;

    this.sectorsLayer.clearLayers();
    if (!this.sectorsVisible) return;

    // 1) Collect points with connection type
    const points = [];

    if (includeTet) {
      tet.forEach((p) => {
        if (!p || !p.geometry || !p.offers || !p.offers[0]) return;
        const norm = DataUtils.normalizeConnectionType(p.offers[0].connectionType);
        if (!this._passesFilter(norm)) return;
        const c = this._geometryCenter(p.geometry);
        if (!c) return;
        points.push({ lat: c[0], lng: c[1], type: norm });
      });
    }

    if (includeUser) {
      user.forEach((f) => {
        if (!f || !f.geometry || !f.properties) return;
        const norm = DataUtils.normalizeConnectionType(f.properties.connection_type);
        if (!this._passesFilter(norm)) return;
        const c = this._geometryCenter(f.geometry);
        if (!c) return;
        points.push({ lat: c[0], lng: c[1], type: norm });
      });
    }

    if (points.length === 0) return;

    // 2) Group points by connection type and run clustering per type
    const byType = points.reduce((acc, p) => {
      if (!p.type) return acc;
      (acc[p.type] ||= []).push(p);
      return acc;
    }, {});

    Object.entries(byType).forEach(([type, pts]) => {
      if (pts.length === 0) return;
      const clusters = this._dbscan(pts, epsMeters, minPts);
      clusters.forEach((cluster) => {
        if (cluster.length < 1) return;
        const color = DataUtils.getConnectionColor(type, false);
        if (cluster.length < 3) {
          // Draw buffered circle around centroid for tiny clusters
          const center = this._centroid(cluster);
          L.circle(center, {
            radius: Math.max(epsMeters * 0.9, 60),
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
            opacity: 0.9
          }).addTo(this.sectorsLayer);
        } else {
          const hull = this._convexHull(cluster);
          if (hull && hull.length >= 3) {
            L.polygon(hull, {
              color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.15,
              opacity: 0.9
            }).addTo(this.sectorsLayer);
          }
        }
      });
    });
  }

  // ---------------------- Helpers ----------------------
  /** Return [lat, lng] for a geometry's visual center */
  _geometryCenter(geometry) {
    if (!geometry) return null;
    if (geometry.type === 'Point') {
      return [geometry.coordinates[1], geometry.coordinates[0]];
    }
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0];
      const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      return [lat, lng];
    }
    if (geometry.type === 'MultiPolygon') {
      // Use first polygon's centroid
      const first = geometry.coordinates[0]?.[0];
      if (!first) return null;
      const lat = first.reduce((s, c) => s + c[1], 0) / first.length;
      const lng = first.reduce((s, c) => s + c[0], 0) / first.length;
      return [lat, lng];
    }
    return null;
  }

  /** Naive DBSCAN implementation tailored for small/medium point sets */
  _dbscan(points, epsMeters, minPts) {
    const clusters = [];
    const visited = new Array(points.length).fill(false);
    const assigned = new Array(points.length).fill(false);

    const dist = (a, b) => this.map.distance([a.lat, a.lng], [b.lat, b.lng]);

    const regionQuery = (idx) => {
      const p = points[idx];
      const neighbors = [];
      for (let j = 0; j < points.length; j++) {
        if (dist(p, points[j]) <= epsMeters) neighbors.push(j);
      }
      return neighbors;
    };

    for (let i = 0; i < points.length; i++) {
      if (visited[i]) continue;
      visited[i] = true;
      const neighbors = regionQuery(i);
      if (neighbors.length < minPts) {
        continue; // noise
      }
      const clusterIdxs = [];
      const queue = [...neighbors];
      assigned[i] = true;
      while (queue.length) {
        const idx = queue.shift();
        if (!visited[idx]) {
          visited[idx] = true;
          const n2 = regionQuery(idx);
          if (n2.length >= minPts) {
            // density-reachable: merge
            for (const n of n2) if (!queue.includes(n)) queue.push(n);
          }
        }
        if (!assigned[idx]) {
          assigned[idx] = true;
        }
        clusterIdxs.push(idx);
      }
      // materialize cluster points
      clusters.push(clusterIdxs.map((k) => points[k]));
    }
    return clusters;
  }

  /** Compute centroid from array of {lat,lng} */
  _centroid(pts) {
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return [lat, lng];
  }

  /** Andrew's monotone chain convex hull. Returns array of [lat,lng] */
  _convexHull(points) {
    if (!points || points.length < 3) return null;
    // Use projected coordinates to avoid lat/lng distortion at small scale
    const projected = points.map((p) => {
      const pt = this.map.project([p.lat, p.lng], this.map.getZoom());
      return { x: pt.x, y: pt.y, ref: p };
    });
    projected.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of projected) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    const upper = [];
    for (let i = projected.length - 1; i >= 0; i--) {
      const p = projected[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    const hullProj = lower.slice(0, -1).concat(upper.slice(0, -1));
    // Back-project to lat/lng
    return hullProj.map((hp) => {
      const ll = this.map.unproject([hp.x, hp.y], this.map.getZoom());
      return [ll.lat, ll.lng];
    });
  }

  // ---------------------- Internal helpers ----------------------
  _styleForGeometry(geometry, color) {
    const z = this.map.getZoom ? this.map.getZoom() : 13;
    // Scale radius/weights with zoom: larger when zoomed in, smaller when out
    const scale = (z) => {
      // map zoom 10..19 -> factor ~0.6..1.6
      return Math.max(0.2, Math.min(1.6, (z - 10) * 0.15 + 0.6));
    };
    const f = scale(z);
    return {
      point: {
        radius: Math.round(7 * f),
        color,
        weight: Math.max(1, Math.round(2 * f)),
        fillColor: color,
        fillOpacity: 0.75,
        opacity: 1.0,
      },
      polygon: {
        color,
        weight: Math.max(1, Math.round(2 * f)),
        fillColor: color,
        fillOpacity: 0.6,
        opacity: 1.0,
      }
    };
  }

  _restyleVisibleLayers() {
    // Recreate styles based on current zoom
    const applyToLayerGroup = (group) => {
      group.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
          const opts = this._styleForGeometry({ type: 'Point' }, layer.options.color);
          layer.setStyle(opts.point);
        } else if (layer instanceof L.GeoJSON) {
          layer.setStyle((feat) => {
            const color = (layer.options && layer.options.style && layer.options.style.color) || '#888';
            const s = this._styleForGeometry(feat.geometry, color).polygon;
            return s;
          });
        } else if (layer.setStyle && layer.getLatLng) {
          // generic vector
          const opts = this._styleForGeometry({ type: 'Point' }, layer.options.color);
          layer.setStyle(opts.point);
        }
      });
    };
    applyToLayerGroup(this.tetLayer);
    applyToLayerGroup(this.userLayer);
  }

  _passesFilter(normType) {
    // If no filters set, show all
    if (!this.typeFilters || this.typeFilters.size === 0) return true;
    return this.typeFilters.has(normType);
  }

  /**
   * Fit map to show all data
   */
  fitToData() {
    const group = L.featureGroup([this.tetLayer, this.userLayer]);
    if (group.getLayers().length > 0) {
      this.map.fitBounds(group.getBounds(), { padding: [20, 20] });
    }
  }

  /**
   * Center map on specific coordinates
   */
  centerOn(lat, lng, zoom = 16) {
    this.map.setView([lat, lng], zoom);
  }

  /**
   * Add a temporary marker to highlight search result
   */
  highlightLocation(feature) {
    // Remove existing highlight
    if (this.highlightMarker) {
      this.map.removeLayer(this.highlightMarker);
    }

    const { geometry } = feature;
    let center;

    if (geometry.type === 'Point') {
      center = [geometry.coordinates[1], geometry.coordinates[0]];
    } else if (geometry.type === 'Polygon') {
      // Calculate centroid of polygon
      const coords = geometry.coordinates[0];
      const lat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
      const lng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
      center = [lat, lng];
    }

    if (center) {
      this.highlightMarker = L.marker(center, {
        icon: L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          shadowSize: [41, 41]
        })
      }).addTo(this.map);

      this.centerOn(center[0], center[1]);

      // Remove highlight after 5 seconds
      setTimeout(() => {
        if (this.highlightMarker) {
          this.map.removeLayer(this.highlightMarker);
          this.highlightMarker = null;
        }
      }, 5000);
    }
  }

  /**
   * Register a map move event handler
   * @param {Function} handler - Function to call on map move
   */
  onMapMove(handler) {
    if (this.map && typeof handler === 'function') {
      this.map.on('move', handler);
    }
  }

  /**
   * Remove a map move event handler
   * @param {Function} handler - Function to remove
   */
  offMapMove(handler) {
    if (this.map && typeof handler === 'function') {
      this.map.off('move', handler);
    }
  }

  /**
   * Return detailed information about current visible map bounds.
   * Useful for prototyping dynamic data loading based on viewport.
   * @returns {object|null} bounds info or null if map not ready
   */
  getVisibleBounds() {
    if (!this.map) return null;
    const b = this.map.getBounds();
    return {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
      northWest: b.getNorthWest(),
      northEast: b.getNorthEast(),
      southWest: b.getSouthWest(),
      southEast: b.getSouthEast(),
      center: b.getCenter(),
      zoom: this.map.getZoom()
    };
  }

  /**
   * Console-log current map bounds & corners in a compact structured format.
   * Returns same object as getVisibleBounds() for chaining / inspection.
   * @param {string} tag optional label
   */
  logVisibleBounds(tag = 'MapBounds') {
    const info = this.getVisibleBounds();
    if (!info) {
      console.log(`${tag}: map not initialized`);
      return null;
    }
    const payload = {
      bbox: { west: info.west, south: info.south, east: info.east, north: info.north },
      corners: {
        nw: info.northWest,
        ne: info.northEast,
        sw: info.southWest,
        se: info.southEast
      },
      center: info.center,
      zoom: info.zoom
    };
    console.log(tag + ':', payload);
    return info;
  }

  /** Enable/disable automatic bounds logging on move/zoom */
  setAutoLogBounds(enabled) {
    this._autoLogBounds = !!enabled;
    console.log('Auto bounds logging:', this._autoLogBounds ? 'ENABLED' : 'DISABLED');
    if (this._autoLogBounds) this.logVisibleBounds('init');
  }
}
