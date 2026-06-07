export const getCountryCode = (countryName: string) => { if (!countryName) return " tbd\; return countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); };
