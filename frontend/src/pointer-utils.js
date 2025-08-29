// Utilities for pointer / outline computations (mirrors backend logic simplified)

// Collect all coordinate points from a GeoJSON geometry
export function collectCoords(geometry, collector) {
  if (!geometry) return;
  const type = geometry.type;
  const coords = geometry.coordinates;
  switch (type) {
    case 'Point':
      collector.push(coords);
      break;
    case 'MultiPoint':
      coords.forEach(c => collector.push(c));
      break;
    case 'LineString':
    case 'MultiLineString':
      coords.flat().forEach(c => collector.push(c));
      break;
    case 'Polygon':
      // Only exterior ring for outline purposes
      if (Array.isArray(coords[0])) coords[0].forEach(c => collector.push(c));
      break;
    case 'MultiPolygon':
      coords.forEach(poly => {
        if (Array.isArray(poly[0])) poly[0].forEach(c => collector.push(c));
      });
      break;
    default:
      return;
  }
}

// Build convex hull polygon (Monotone chain) from lon/lat points
export function buildOutlinePolygon(points) {
  if (!points || points.length < 3) return null;
  // Deduplicate
  const uniqMap = new Map();
  for (const p of points) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const key = p[0] + ':' + p[1];
    if (!uniqMap.has(key)) uniqMap.set(key, p);
  }
  const uniq = Array.from(uniqMap.values());
  if (uniq.length < 3) return null;
  uniq.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  if (hull.length < 3) return null;
  const ring = hull.concat([hull[0]]); // close
  return { type: 'Polygon', coordinates: [ring] };
}

export function computeFurthestPoints(points) {
  if (!points || points.length === 0) return [];
  let west = points[0], east = points[0], north = points[0], south = points[0];
  for (const p of points) {
    if (!p) continue;
    if (p[0] < west[0]) west = p;
    if (p[0] > east[0]) east = p;
    if (p[1] > north[1]) north = p; // lat
    if (p[1] < south[1]) south = p;
  }
  return [west, east, north, south];
}

// Build pointer metadata for a set of GeoJSON Features
export function buildUserDatasetPointer(features, name) {
  const allPts = [];
  features.forEach(f => {
    if (f && f.geometry) collectCoords(f.geometry, allPts);
  });
  const outline = buildOutlinePolygon(allPts);
  const furthestPoints = computeFurthestPoints(allPts);
  // Basic bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  allPts.forEach(p => { if (!p) return; if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
  const bbox = [minX, minY, maxX, maxY];
  return {
    name: name || 'user_dataset',
    count: features.length,
    outline,
    furthestPoints,
    bbox,
    userDataset: true,
  };
}
