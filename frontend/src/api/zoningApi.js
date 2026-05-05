const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

export function searchAddresses(query) {
  const params = new URLSearchParams({ q: query });
  return requestJson(`/api/addresses/search?${params.toString()}`);
}

export function getZoningByAddress(query) {
  const params = new URLSearchParams({ q: query });
  return requestJson(`/api/zoning/address?${params.toString()}`);
}
