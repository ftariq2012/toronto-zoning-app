export const MUNICIPALITIES = {
  toronto: {
    id: "toronto",
    name: "Toronto",
    province: "ON",
    center: [43.6532, -79.3832],
    zoom: 11,
    supportsAddressSearch: true,
    supportsFeatureFilters: true,
    supportsAdvancedFilters: true,
    sourceName: "City of Toronto Zoning By-law Open Data",
    sourceUrl: "https://open.toronto.ca/dataset/zoning-by-law/",
  },
  brampton: {
    id: "brampton",
    name: "Brampton",
    province: "ON",
    center: [43.7315, -79.7624],
    zoom: 11,
    supportsAddressSearch: true,
    supportsFeatureFilters: true,
    supportsAdvancedFilters: false,
    sourceName: "City of Brampton Zoning By-law 270-2004",
    sourceUrl:
      "https://www.brampton.ca/EN/residents/Building-Permits/Zoning",
    zoningSourceUrl:
      "https://mapsdev.brampton.ca/arcgis/rest/services/COB/Zoning_New/MapServer/6/query?where=1%3D1&outFields=*&f=geojson",
  },
};

export const DEFAULT_MUNICIPALITY_ID = "toronto";

export function getMunicipalityConfig(municipalityId) {
  return MUNICIPALITIES[municipalityId] ?? MUNICIPALITIES[DEFAULT_MUNICIPALITY_ID];
}
