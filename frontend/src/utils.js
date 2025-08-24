import Fuse from 'fuse.js';

/**
 * Search utility for fuzzy address searching
 */
export class AddressSearch {
  constructor(data) {
    this.setCollection(data);
  }

  search(query) {
    if (!query || query.length < 2) return [];
    const results = this.fuse.search(query);

    // If the user typed a house number, boost exact/startsWith matches
    const numMatch = query.match(/\d+[a-zA-Z]?/);
    let rescored = results;
    if (numMatch) {
      const qNum = numMatch[0].toLowerCase();
      rescored = results.map(r => {
        const hn = (r.item.houseNumber || '').toLowerCase();
        let bonus = 0;
        if (hn === qNum) bonus = 0.35; // strong boost for exact house number
        else if (hn.startsWith(qNum)) bonus = 0.2; // partial boost
        return { ...r, score: Math.max(0, (r.score ?? 0) - bonus) };
      }).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    }

    return rescored.slice(0, 10).map(result => ({
      ...result.item.original, // return original object shape expected by the app
      score: result.score
    }));
  }

  updateData(newData) {
    this.setCollection(newData);
  }

  setCollection(data) {
    this.data = Array.isArray(data) ? data : [];
    // Augment items with parsed address parts for better ranking
    const items = this.data.map((orig) => {
      const address = orig.address || orig.properties?.address || '';
      const parts = this.parseAddress(address);
      return { original: orig, address, ...parts };
    });
    this.fuse = new Fuse(items, {
      keys: [
        { name: 'houseNumber', weight: 0.8 },
        { name: 'address', weight: 0.5 },
        { name: 'street', weight: 0.3 }
      ],
      threshold: 0.35, // a bit stricter
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
      useExtendedSearch: false
    });
  }

  parseAddress(address) {
    if (!address) return { street: '', houseNumber: '' };
    const m = address.match(/^(.*?)[,\s]+(\d+[a-zA-Z]?)(.*)?$/); // "Street 12" or "Street, 12"
    if (m) {
      const street = m[1].trim();
      const houseNumber = m[2].trim();
      return { street, houseNumber };
    }
    return { street: address.trim(), houseNumber: '' };
  }
}

/**
 * Utility functions for data processing
 */
export const DataUtils = {
  /** Normalize various connection type strings to canonical keys */
  normalizeConnectionType(type) {
    if (!type) return 'unknown';
    const t = String(type).toLowerCase();
    if (/(fiber|optik)/.test(t)) return 'fiber';
    if (/(vdsl|dsl)/.test(t)) return 'dsl';
    if (/cable/.test(t)) return 'cable';
    if (/(mobile|4g|5g|wireless)/.test(t)) return 'mobile';
    if (/satellite|satelit/.test(t)) return 'satellite';
    return t;
  },
  /**
   * Parse NDJSON data
   */
  parseNDJSON(text) {
    return text
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  },

  /**
   * Validate TET property data
   */
  isValidTETProperty(property) {
    return (
      property &&
      property.id &&
      property.address &&
      property.geometry &&
      property.offers &&
      Array.isArray(property.offers)
    );
  },

  /**
   * Validate GeoJSON feature (for user uploaded data)
   */
  isValidGeoJSONFeature(feature) {
    return (
      feature &&
      feature.type === 'Feature' &&
      feature.geometry &&
      feature.properties &&
      feature.properties.address
    );
  },

  /**
   * Get color based on connection type
   */
  getConnectionColor(connectionType, isUserData = false) {
    // Normalize connection type names
    const normalizedType = connectionType.toLowerCase();
    
    const colors = {
      'fiber': isUserData ? '#059669' : '#2E7D32', // emerald for user, sky for TET (trustworthy blue)
      'fiber (optikas)': isUserData ? '#059669' : '#2E7D32',
      'optikas': isUserData ? '#059669' : '#2E7D32',
      'dsl': isUserData ? '#d97706' : '#4682B4', // amber
      'dsl/vdsl': isUserData ? '#d97706' : '#4682B4',
      'vdsl': isUserData ? '#d97706' : '#4682B4',
      'cable': isUserData ? '#7c3aed' : '#8b5cf6', // violet
      'mobile': isUserData ? '#dc2626' : '#E69A17', // red
      'mobile (4g/5g)': isUserData ? '#dc2626' : '#E69A17',
      '4g': isUserData ? '#dc2626' : '#E69A17',
      '5g': isUserData ? '#dc2626' : '#E69A17',
      'wireless': isUserData ? '#dc2626' : '#E69A17',
      'satellite': isUserData ? '#0891b2' : '#06b6d4' // cyan
    };
    
    return colors[normalizedType] || (isUserData ? '#64748b' : '#94a3b8'); // slate gray fallback
  },

  /**
   * Format speed value from TET data
   */
  formatSpeed(speedObj) {
    if (!speedObj) return 'N/A';
    
    if (typeof speedObj === 'object' && speedObj.minMbit !== undefined) {
      if (speedObj.maxMbit && speedObj.maxMbit !== speedObj.minMbit) {
        return `${speedObj.minMbit}-${speedObj.maxMbit} Mbit/s`;
      } else {
        return `${speedObj.minMbit} Mbit/s`;
      }
    }
    
    if (typeof speedObj === 'string' || typeof speedObj === 'number') {
      return speedObj.toString().includes('Mbit') || speedObj.toString().includes('Gbit') 
        ? speedObj 
        : `${speedObj} Mbit/s`;
    }
    
    return 'N/A';
  },

  /**
   * Format price value from TET data
   */
  formatPrice(pricePerMonth = 'EUR') {
    if (!pricePerMonth && pricePerMonth !== 0) return 'N/A';
    const numPrice = parseFloat(pricePerMonth);
    return isNaN(numPrice) ? pricePerMonth : `€${numPrice.toFixed(2)}/mēn.`;
  }
};
