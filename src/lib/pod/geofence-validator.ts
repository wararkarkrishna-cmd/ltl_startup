import { z } from 'zod';
import { AddressResolver } from '../geo/address-resolver';

export const EARTH_RADIUS_MILES = 3958.8;

export const GeofenceResultSchema = z.object({
  isWithinGeofence: z.boolean(),
  distanceMiles: z.number().nullable(),
  maxDistanceMiles: z.number(),
  destLatitude: z.number(),
  destLongitude: z.number(),
  destCity: z.string(),
  destState: z.string(),
  destZip: z.string(),
  capturedLatitude: z.number().nullable(),
  capturedLongitude: z.number().nullable(),
  flaggedWarning: z.string().nullable(),
  confidencePenaltyPercent: z.number().min(0).max(100),
});

export type GeofenceResult = z.infer<typeof GeofenceResultSchema>;

export interface DestinationGeoPoint {
  lat: number;
  lon: number;
  city: string;
  state: string;
  zip: string;
}

/**
 * High-Precision Geofence & Delivery Location Validator for Proof of Delivery
 * Uses exact Haversine Great-Circle spherical distance calculations.
 */
export class GeofenceValidator {
  /**
   * Comprehensive US Freight Hub & Postal Centroid Coordinates Database
   */
  private static readonly ZIP_COORDINATES: Record<
    string,
    { lat: number; lon: number; city: string; state: string }
  > = {
    // California & West Coast
    '90001': { lat: 33.9731, lon: -118.2479, city: 'Los Angeles', state: 'CA' },
    '90015': { lat: 34.0396, lon: -118.2668, city: 'Los Angeles', state: 'CA' },
    '90210': { lat: 34.0901, lon: -118.4065, city: 'Beverly Hills', state: 'CA' },
    '91761': { lat: 34.0633, lon: -117.6509, city: 'Ontario', state: 'CA' },
    '94102': { lat: 37.7786, lon: -122.4212, city: 'San Francisco', state: 'CA' },
    '98101': { lat: 47.6101, lon: -122.3344, city: 'Seattle', state: 'WA' },
    '97201': { lat: 45.5118, lon: -122.6845, city: 'Portland', state: 'OR' },
    '89502': { lat: 39.5085, lon: -119.7744, city: 'Reno', state: 'NV' },
    '84101': { lat: 40.7608, lon: -111.8910, city: 'Salt Lake City', state: 'UT' },
    '85001': { lat: 33.4484, lon: -112.0740, city: 'Phoenix', state: 'AZ' },
    '80202': { lat: 39.7541, lon: -104.9978, city: 'Denver', state: 'CO' },

    // Midwest & Central Hubs
    '60601': { lat: 41.8853, lon: -87.6216, city: 'Chicago', state: 'IL' },
    '60611': { lat: 41.8927, lon: -87.6206, city: 'Chicago', state: 'IL' },
    '64120': { lat: 39.1418, lon: -94.5126, city: 'Kansas City', state: 'MO' },
    '63101': { lat: 38.6270, lon: -90.1994, city: 'St. Louis', state: 'MO' },
    '55401': { lat: 44.9866, lon: -93.2707, city: 'Minneapolis', state: 'MN' },
    '46241': { lat: 39.7197, lon: -86.2705, city: 'Indianapolis', state: 'IN' },
    '43228': { lat: 39.9526, lon: -83.1362, city: 'Columbus', state: 'OH' },
    '48201': { lat: 42.3484, lon: -83.0603, city: 'Detroit', state: 'MI' },

    // Texas & South
    '75201': { lat: 32.7876, lon: -96.7997, city: 'Dallas', state: 'TX' },
    '75247': { lat: 32.8136, lon: -96.8837, city: 'Dallas', state: 'TX' },
    '76177': { lat: 32.9691, lon: -97.3117, city: 'Fort Worth', state: 'TX' },
    '77001': { lat: 29.7604, lon: -95.3698, city: 'Houston', state: 'TX' },
    '38118': { lat: 35.0518, lon: -89.9142, city: 'Memphis', state: 'TN' },
    '37201': { lat: 36.1667, lon: -86.7782, city: 'Nashville', state: 'TN' },
    '40213': { lat: 38.1873, lon: -85.7088, city: 'Louisville', state: 'KY' },
    '30301': { lat: 33.7490, lon: -84.3880, city: 'Atlanta', state: 'GA' },
    '30309': { lat: 33.7989, lon: -84.3879, city: 'Atlanta', state: 'GA' },
    '33101': { lat: 25.7743, lon: -80.1937, city: 'Miami', state: 'FL' },
    '28202': { lat: 35.2271, lon: -80.8431, city: 'Charlotte', state: 'NC' },
    '70112': { lat: 29.9584, lon: -90.0759, city: 'New Orleans', state: 'LA' },

    // East Coast & Northeast
    '10001': { lat: 40.7506, lon: -73.9972, city: 'New York', state: 'NY' },
    '02108': { lat: 42.3588, lon: -71.0638, city: 'Boston', state: 'MA' },
    '19102': { lat: 39.9522, lon: -75.1639, city: 'Philadelphia', state: 'PA' },
    '17111': { lat: 40.2600, lon: -76.8197, city: 'Harrisburg', state: 'PA' },
    '20001': { lat: 38.9101, lon: -77.0163, city: 'Washington', state: 'DC' },
  };

  /**
   * Regional fallback centroids by 1-digit ZIP prefix (0-9)
   */
  private static readonly REGIONAL_PREFIX_CENTROIDS: Record<
    string,
    { lat: number; lon: number; defaultCity: string; state: string }
  > = {
    '0': { lat: 42.2000, lon: -71.5000, defaultCity: 'Boston Metro', state: 'MA' },
    '1': { lat: 40.7500, lon: -73.9800, defaultCity: 'New York Metro', state: 'NY' },
    '2': { lat: 38.8000, lon: -77.1000, defaultCity: 'DC / Mid-Atlantic', state: 'DC' },
    '3': { lat: 33.7500, lon: -84.4000, defaultCity: 'Atlanta Hub', state: 'GA' },
    '4': { lat: 39.9000, lon: -83.0000, defaultCity: 'Ohio Valley Hub', state: 'OH' },
    '5': { lat: 44.9500, lon: -93.2500, defaultCity: 'Upper Midwest', state: 'MN' },
    '6': { lat: 41.8800, lon: -87.6300, defaultCity: 'Chicago Freight Hub', state: 'IL' },
    '7': { lat: 32.8000, lon: -96.8000, defaultCity: 'Texas Hub', state: 'TX' },
    '8': { lat: 39.7500, lon: -105.0000, defaultCity: 'Mountain Hub', state: 'CO' },
    '9': { lat: 34.0500, lon: -118.2500, defaultCity: 'Pacific Hub', state: 'CA' },
  };

  /**
   * Calculate Great-Circle distance using accurate Haversine Formula:
   * $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
   * where r = 3958.8 miles.
   */
  public static calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);

    const sinDeltaPhi = Math.sin(deltaPhi / 2);
    const sinDeltaLambda = Math.sin(deltaLambda / 2);

    const a =
      sinDeltaPhi * sinDeltaPhi +
      Math.cos(phi1) * Math.cos(phi2) * sinDeltaLambda * sinDeltaLambda;

    // Clamp to [0, 1] to prevent NaN floating point artifacts
    const clampedA = Math.max(0, Math.min(1, a));
    const c = 2 * Math.asin(Math.sqrt(clampedA));

    const distanceMiles = EARTH_RADIUS_MILES * c;
    return Math.round(distanceMiles * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Resolve Latitude & Longitude for a US Destination ZIP
   */
  public static resolveCoordinates(
    zip: string,
    fallbackCity?: string | null,
    fallbackState?: string | null
  ): DestinationGeoPoint {
    const cleanZip = (zip || '').replace(/[^\d]/g, '').slice(0, 5);

    // 1. Direct Lookup
    if (this.ZIP_COORDINATES[cleanZip]) {
      const entry = this.ZIP_COORDINATES[cleanZip];
      return {
        lat: entry.lat,
        lon: entry.lon,
        city: entry.city,
        state: entry.state,
        zip: cleanZip,
      };
    }

    // 2. Integration with AddressResolver database
    const resolved = AddressResolver.resolvePostalCode(cleanZip, fallbackCity, fallbackState);
    if (this.ZIP_COORDINATES[resolved.zip]) {
      const entry = this.ZIP_COORDINATES[resolved.zip];
      return {
        lat: entry.lat,
        lon: entry.lon,
        city: resolved.city,
        state: resolved.state,
        zip: resolved.zip,
      };
    }

    // 3. Regional Centroid Fallback based on 1st digit prefix
    const firstDigit = cleanZip.charAt(0);
    const regional = this.REGIONAL_PREFIX_CENTROIDS[firstDigit] || this.REGIONAL_PREFIX_CENTROIDS['6'];

    return {
      lat: regional.lat,
      lon: regional.lon,
      city: resolved.city || fallbackCity || regional.defaultCity,
      state: resolved.state || fallbackState || regional.state,
      zip: cleanZip || '00000',
    };
  }

  /**
   * Validate Delivery Photo Location against Destination Geofence
   * Rule: If distance > maxDistanceMiles (0.5 mi), flag exception.
   */
  public static validateDeliveryLocation(
    destZip: string,
    gpsLat?: number | null,
    gpsLon?: number | null,
    maxDistanceMiles = 0.5
  ): GeofenceResult {
    const dest = this.resolveCoordinates(destZip);

    // Missing GPS Coordinates Handling
    if (gpsLat === null || gpsLat === undefined || gpsLon === null || gpsLon === undefined) {
      return {
        isWithinGeofence: false,
        distanceMiles: null,
        maxDistanceMiles,
        destLatitude: dest.lat,
        destLongitude: dest.lon,
        destCity: dest.city,
        destState: dest.state,
        destZip: dest.zip,
        capturedLatitude: null,
        capturedLongitude: null,
        flaggedWarning: 'No GPS metadata found in photo or mobile payload',
        confidencePenaltyPercent: 30.0,
      };
    }

    // Compute Haversine distance
    const distanceMiles = this.calculateHaversineDistance(
      dest.lat,
      dest.lon,
      gpsLat,
      gpsLon
    );

    const isWithinGeofence = distanceMiles <= maxDistanceMiles;

    let flaggedWarning: string | null = null;
    let confidencePenaltyPercent = 0;

    if (!isWithinGeofence) {
      flaggedWarning = `Photo captured ${distanceMiles.toFixed(2)} miles outside destination geofence`;
      
      // Calculate graded penalty based on distance deviation
      if (distanceMiles > 10.0) {
        confidencePenaltyPercent = 40.0;
      } else if (distanceMiles > 2.0) {
        confidencePenaltyPercent = 25.0;
      } else {
        confidencePenaltyPercent = 15.0;
      }
    }

    return {
      isWithinGeofence,
      distanceMiles,
      maxDistanceMiles,
      destLatitude: dest.lat,
      destLongitude: dest.lon,
      destCity: dest.city,
      destState: dest.state,
      destZip: dest.zip,
      capturedLatitude: gpsLat,
      capturedLongitude: gpsLon,
      flaggedWarning,
      confidencePenaltyPercent,
    };
  }
}
