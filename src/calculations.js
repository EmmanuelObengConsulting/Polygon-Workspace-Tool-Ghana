/**
 * Pure calculation functions for land polygon coordinates
 */

/**
 * Calculate mean coordinates from polygon points
 * Formula: X = Σ(xi) / n where x is Eastings(E) or Northings(N)
 * Mean of E (eastings) and Mean of N (northings)
 * @param {Array<{easting: number, northing: number}>} polygonPoints - Array of coordinate objects
 * @returns {{easting: number, northing: number, formatted: string, ga: string}} - Mean coordinates
 */
export function calculateMeanCoordinates(polygonPoints) {
  if (!polygonPoints || polygonPoints.length === 0) {
    return { easting: 0, northing: 0, formatted: '0.000000, 0.000000', ga: 'GA0-000000' };
  }

  const n = polygonPoints.length;
  
  // Calculate sum of Eastings (E) and Northings (N)
  const sum = polygonPoints.reduce(
    (acc, point) => ({
      easting: acc.easting + parseFloat(point.easting || 0),
      northing: acc.northing + parseFloat(point.northing || 0),
    }),
    { easting: 0, northing: 0 }
  );

  // Mean = Σ(xi) / n
  const meanEasting = sum.easting / n;
  const meanNorthing = sum.northing / n;
  
  // GA = concatenate integer parts of mean E and mean N
  const meanEInt = Math.round(meanEasting);
  const meanNInt = Math.round(meanNorthing);
  const formattedGA = `GA${meanEInt}-${meanNInt}`;

  return {
    easting: meanEasting,
    northing: meanNorthing,
    formatted: `E: ${meanEasting.toFixed(6)}, N: ${meanNorthing.toFixed(6)}`,
    ga: formattedGA,
  };
}

/**
 * Generate a job code based on GAPA number and timestamp
 * @param {string} gapaNumber - GAPA number input
 * @returns {string} - Generated job code
 */
export function generateJobCode(gapaNumber) {
  if (!gapaNumber) {
    return '';
  }
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `JOB-${gapaNumber}-${timestamp}-${randomSuffix}`;
}

/**
 * Parse pasted coordinate text into structured array
 * Supports two formats:
 * 1. WKT POLYGON format: "POLYGON((E1 N1, E2 N2, E3 N3, ..., En Nn, E1 N1))"
 * 2. Line-by-line format: "E1 N1\nE2 N2\n..." or "E1, N1\nE2, N2\n..."
 * E = Eastings, N = Northings
 * @param {string} text - Raw pasted text
 * @returns {Array<{easting: number, northing: number}>} - Parsed coordinates
 */
export function parseCoordinateText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const trimmedText = text.trim();

  // Check if input is WKT POLYGON format
  const polygonMatch = trimmedText.match(/POLYGON\s*\(\s*\((.*?)\)\s*\)/i);
  
  if (polygonMatch) {
    // Parse WKT POLYGON format
    const coordString = polygonMatch[1];
    const coordinates = [];
    
    // Split by comma to get individual coordinate pairs
    const pairs = coordString.split(',');
    
    for (const pair of pairs) {
      const trimmedPair = pair.trim();
      if (!trimmedPair) continue;
      
      // Split by whitespace to get E and N
      const parts = trimmedPair.split(/\s+/);
      
      if (parts.length >= 2) {
        const easting = parseFloat(parts[0]);
        const northing = parseFloat(parts[1]);
        
        if (!isNaN(easting) && !isNaN(northing)) {
          coordinates.push({ easting, northing });
        }
      }
    }
    
    return coordinates;
  }

  // Fall back to line-by-line format
  const lines = trimmedText.split('\n');
  const coordinates = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Try comma-separated first
    let parts = trimmedLine.split(',').map(p => p.trim());
    
    // If no comma, try space/tab separated
    if (parts.length < 2) {
      parts = trimmedLine.split(/\s+/);
    }

    if (parts.length >= 2) {
      const easting = parseFloat(parts[0]);
      const northing = parseFloat(parts[1]);
      
      if (!isNaN(easting) && !isNaN(northing)) {
        coordinates.push({ easting, northing });
      }
    }
  }

  return coordinates;
}

/**
 * Format polygon coordinates for display and QR code
 * Format: POLYGON((E1 N1, E2 N2, E3 N3, ..., En Nn, E1 N1))
 * @param {Array<{easting: number, northing: number}>} points - Coordinate points
 * @returns {string} - Formatted polygon string
 */
export function formatPolygonCoordinates(points) {
  if (!points || points.length === 0) {
    return 'No coordinates';
  }

  const coordPairs = points.map(p => `${p.easting.toFixed(6)} ${p.northing.toFixed(6)}`);
  
  // Close the polygon by adding first point at the end
  if (points.length > 0) {
    const firstPoint = points[0];
    coordPairs.push(`${firstPoint.easting.toFixed(6)} ${firstPoint.northing.toFixed(6)}`);
  }
  
  return `POLYGON((${coordPairs.join(', ')}))`;
}

/**
 * Format polygon coordinates for readable display
 * @param {Array<{easting: number, northing: number}>} points - Coordinate points
 * @returns {string} - Formatted string
 */
export function formatPolygonForDisplay(points) {
  if (!points || points.length === 0) {
    return 'No coordinates';
  }

  return points
    .map((point, index) => `Point ${index + 1}: E ${point.easting.toFixed(6)}, N ${point.northing.toFixed(6)}`)
    .join('\n');
}
