export interface ResolvedAddress {
  zip: string;
  city: string;
  state: string;
  isValidZip: boolean;
  isResidential: boolean;
  hasDock: boolean;
  zoningType: 'COMMERCIAL' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'LIMITED_ACCESS';
  suggestedAccessorials: string[];
}

export class AddressResolver {
  private static readonly ZIP_DATABASE: Record<
    string,
    { city: string; state: string; zoning: 'COMMERCIAL' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'LIMITED_ACCESS'; hasDock: boolean }
  > = {
    '90001': { city: 'Los Angeles', state: 'CA', zoning: 'INDUSTRIAL', hasDock: true },
    '90015': { city: 'Los Angeles', state: 'CA', zoning: 'COMMERCIAL', hasDock: true },
    '90210': { city: 'Beverly Hills', state: 'CA', zoning: 'RESIDENTIAL', hasDock: false },
    '60601': { city: 'Chicago', state: 'IL', zoning: 'COMMERCIAL', hasDock: true },
    '60611': { city: 'Chicago', state: 'IL', zoning: 'COMMERCIAL', hasDock: false },
    '75201': { city: 'Dallas', state: 'TX', zoning: 'COMMERCIAL', hasDock: true },
    '75247': { city: 'Dallas', state: 'TX', zoning: 'INDUSTRIAL', hasDock: true },
    '30301': { city: 'Atlanta', state: 'GA', zoning: 'COMMERCIAL', hasDock: true },
    '30309': { city: 'Atlanta', state: 'GA', zoning: 'RESIDENTIAL', hasDock: false },
    '98101': { city: 'Seattle', state: 'WA', zoning: 'COMMERCIAL', hasDock: true },
    '33101': { city: 'Miami', state: 'FL', zoning: 'COMMERCIAL', hasDock: true },
    '10001': { city: 'New York', state: 'NY', zoning: 'COMMERCIAL', hasDock: false },
    '77001': { city: 'Houston', state: 'TX', zoning: 'INDUSTRIAL', hasDock: true },
    '02108': { city: 'Boston', state: 'MA', zoning: 'COMMERCIAL', hasDock: false },
    '85001': { city: 'Phoenix', state: 'AZ', zoning: 'INDUSTRIAL', hasDock: true },
    '48201': { city: 'Detroit', state: 'MI', zoning: 'INDUSTRIAL', hasDock: true },
    '37201': { city: 'Nashville', state: 'TN', zoning: 'COMMERCIAL', hasDock: true },
    '19102': { city: 'Philadelphia', state: 'PA', zoning: 'COMMERCIAL', hasDock: true },
    '28202': { city: 'Charlotte', state: 'NC', zoning: 'COMMERCIAL', hasDock: true },
    '63101': { city: 'St. Louis', state: 'MO', zoning: 'COMMERCIAL', hasDock: true },
    '80202': { city: 'Denver', state: 'CO', zoning: 'COMMERCIAL', hasDock: true },
    '55401': { city: 'Minneapolis', state: 'MN', zoning: 'COMMERCIAL', hasDock: true },
    '70112': { city: 'New Orleans', state: 'LA', zoning: 'COMMERCIAL', hasDock: true },
    '97201': { city: 'Portland', state: 'OR', zoning: 'COMMERCIAL', hasDock: true },
    '84101': { city: 'Salt Lake City', state: 'UT', zoning: 'COMMERCIAL', hasDock: true },
  };

  /**
   * Resolve and Validate 5-Digit US Postal Code
   */
  public static resolvePostalCode(
    zip: string,
    fallbackCity?: string | null,
    fallbackState?: string | null
  ): ResolvedAddress {
    const cleanZip = zip.replace(/[^\d]/g, '').slice(0, 5);
    const isValidFormat = /^\d{5}$/.test(cleanZip);

    const lookup = this.ZIP_DATABASE[cleanZip];

    if (lookup) {
      const isResidential = lookup.zoning === 'RESIDENTIAL';
      const suggestedAccessorials: string[] = [];

      if (isResidential) {
        suggestedAccessorials.push('RESIDENTIAL', 'LIFTGATE');
      }
      if (!lookup.hasDock) {
        suggestedAccessorials.push('LIFTGATE');
      }
      if (lookup.zoning === 'LIMITED_ACCESS') {
        suggestedAccessorials.push('LIMITED_ACCESS');
      }

      return {
        zip: cleanZip,
        city: lookup.city,
        state: lookup.state,
        isValidZip: true,
        isResidential,
        hasDock: lookup.hasDock,
        zoningType: lookup.zoning,
        suggestedAccessorials: Array.from(new Set(suggestedAccessorials)),
      };
    }

    // Default resolution for unindexed ZIP
    const isLikelyResidential = false;
    return {
      zip: cleanZip || zip,
      city: fallbackCity || 'Unknown City',
      state: fallbackState ? fallbackState.toUpperCase() : 'US',
      isValidZip: isValidFormat,
      isResidential: isLikelyResidential,
      hasDock: true,
      zoningType: 'COMMERCIAL',
      suggestedAccessorials: [],
    };
  }
}
