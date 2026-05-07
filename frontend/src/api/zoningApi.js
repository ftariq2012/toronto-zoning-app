const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001";

async function requestJson(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

export function getZoningByPoint(lat, lng) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return requestJson(`/api/zoning?${params.toString()}`);
}

export function getMunicipalityZoningByPoint(municipalityId, lat, lng) {
  if (municipalityId === "toronto") {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return requestJson(`/api/municipalities/toronto/zoning?${params.toString()}`);
  }

  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return requestJson(
    `/api/municipalities/${municipalityId}/zoning?${params.toString()}`,
  );
}

export function searchAddresses(query) {
  const params = new URLSearchParams({ q: query });
  return requestJson(`/api/addresses/search?${params.toString()}`);
}

export function searchMunicipalityAddresses(municipalityId, query) {
  const params = new URLSearchParams({ q: query });
  return requestJson(
    `/api/municipalities/${municipalityId}/address-search?${params.toString()}`,
  );
}

export function getZoningByAddress(query) {
  const params = new URLSearchParams({ q: query });
  return requestJson(`/api/zoning/address?${params.toString()}`);
}

export function getMunicipalities() {
  return requestJson("/api/municipalities");
}

export function getBramptonZoningGeoJson() {
  return requestJson("/api/municipalities/brampton/zoning-geojson");
}

export function getBramptonOverlays() {
  return requestJson("/api/municipalities/brampton/overlays");
}
