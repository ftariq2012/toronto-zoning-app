import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bbox, centroid } from "@turf/turf";
import { divIcon, geoJSON } from "leaflet";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  Tooltip,
  TileLayer,
  useMap,
} from "react-leaflet";
import MunicipalitySelector from "./MunicipalitySelector.jsx";
import SearchBar from "./SearchBar.jsx";
import {
  getBramptonOverlays,
  getBramptonZoningGeoJson,
  getMunicipalityZoningByPoint,
  searchMunicipalityAddresses,
} from "../api/zoningApi.js";
import { getMunicipalityConfig } from "../config/municipalities.js";
import {
  buildSelectedZoneFromPoint,
  findContainingFeature,
  findOverlayMatches,
} from "../utils/spatialMatching.js";
import {
  cleanDisplayValue,
  doesFeatureMatchFilters,
  parseDisplayNumber,
} from "../utils/zoningFormatters.js";
import { normalizeZoningFeature } from "../utils/municipalityNormalizers.js";

const TORONTO_DATA_URL = "/data/zoning_area_clean.geojson";
const TORONTO_ADDRESS_INDEX_URL = "/data/address_points_index.json";
const BBOX_PADDING_DEGREES = 0.00035;

const TORONTO_OVERLAY_DATASETS = [
  ["height", "/data/zoning_height_overlay_clean.geojson"],
  ["parking", "/data/parking_zone_overlay_clean.geojson"],
  ["policy_area", "/data/zoning_policy_area_overlay_clean.geojson"],
  ["policy_road", "/data/zoning_policy_road_overlay_clean.geojson"],
  ["priority_retail", "/data/zoning_priority_retail_street_overlay_clean.geojson"],
  ["rooming_house", "/data/zoning_rooming_house_overlay_clean.geojson"],
  ["lot_coverage", "/data/zoning_lot_coverage_overlay_clean.geojson"],
  ["building_setback", "/data/zoning_building_setback_overlay_clean.geojson"],
];

const baseStyle = {
  color: "#2563eb",
  fillColor: "#60a5fa",
  fillOpacity: 0.16,
  opacity: 0.72,
  weight: 1,
};

const bramptonBaseStyle = {
  color: "#7c3aed",
  fillColor: "#a78bfa",
  fillOpacity: 0.18,
  opacity: 0.78,
  weight: 1,
};

const hoverStyle = {
  color: "#111827",
  fillColor: "#f59e0b",
  fillOpacity: 0.34,
  opacity: 1,
  weight: 2,
};

const selectedStyle = {
  color: "#b45309",
  fillColor: "#f59e0b",
  fillOpacity: 0.46,
  opacity: 1,
  weight: 3,
};

const filterMatchStyle = {
  color: "#0f766e",
  fillColor: "#14b8a6",
  fillOpacity: 0.38,
  opacity: 1,
  weight: 2,
};

const filterDimStyle = {
  color: "#94a3b8",
  fillColor: "#cbd5e1",
  fillOpacity: 0.04,
  opacity: 0.28,
  weight: 1,
};

const addressIcon = divIcon({
  className: "address-pin",
  html: "<span></span>",
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -30],
});

const EMPTY_FILTERS = {
  zone: "",
  minDensity: "",
  minHeight: "",
  parkingZone: "",
  minLotWidth: "",
  hasException: false,
};

function FitBounds({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) return;

    const bounds = geoJSON(data).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [data, map]);

  return null;
}

function MunicipalityMapController({ municipalityId }) {
  const map = useMap();
  const municipality = getMunicipalityConfig(municipalityId);

  useEffect(() => {
    map.flyTo(municipality.center, municipality.zoom, { duration: 0.8 });
  }, [map, municipality.center, municipality.zoom]);

  return null;
}

function AddressMapController({ selectedAddress }) {
  const map = useMap();

  useEffect(() => {
    const lat = Number(selectedAddress?.lat);
    const lng = Number(selectedAddress?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    map.flyTo([lat, lng], 17, { duration: 0.7 });
  }, [map, selectedAddress]);

  return null;
}

export default function MapView({
  selectedMunicipality,
  onMunicipalityChange,
  onSelectZone,
}) {
  const municipality = getMunicipalityConfig(selectedMunicipality);
  const isToronto = selectedMunicipality === "toronto";
  const [zoningData, setZoningData] = useState(null);
  const [overlayData, setOverlayData] = useState({});
  const [addressIndex, setAddressIndex] = useState([]);
  const [addressStatus, setAddressStatus] = useState("ready");
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [overlayLoadState, setOverlayLoadState] = useState("ready");
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const selectedLayerRef = useRef(null);

  useEffect(() => {
    selectedLayerRef.current = null;
    setSelectedAddress(null);
    setFilterDraft(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setAddressStatus("ready");
  }, [selectedMunicipality]);

  useEffect(() => {
    let isMounted = true;
    setLoadState("loading");
    setZoningData(null);

    const loadZoning = async () => {
      if (isToronto) {
        const response = await fetch(TORONTO_DATA_URL);
        if (!response.ok) throw new Error(`Could not load ${TORONTO_DATA_URL}`);
        return response.json();
      }

      try {
        return await getBramptonZoningGeoJson();
      } catch (error) {
        console.warn("Brampton backend proxy unavailable; trying direct ArcGIS URL.", error);
        const response = await fetch(municipality.zoningSourceUrl);
        if (!response.ok) throw new Error("Could not load Brampton zoning GeoJSON.");
        return response.json();
      }
    };

    loadZoning()
      .then((data) => {
        if (isMounted) {
          setZoningData(data);
          setLoadState(data.features?.length ? "ready" : "empty");
        }
      })
      .catch((error) => {
        console.warn("Municipality zoning load failed.", error);
        if (isMounted) setLoadState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [isToronto, municipality.zoningSourceUrl, selectedMunicipality]);

  useEffect(() => {
    let isMounted = true;
    setOverlayData({});

    if (!isToronto) {
      setOverlayLoadState("loading");
      getBramptonOverlays()
        .then((data) => {
          if (isMounted) {
            setOverlayData(data ?? {});
            setOverlayLoadState("ready");
          }
        })
        .catch((error) => {
          console.warn("Brampton overlay load failed.", error);
          if (isMounted) {
            setOverlayData({});
            setOverlayLoadState("error");
          }
        });
      return () => {
        isMounted = false;
      };
    }

    setOverlayLoadState("loading");
    Promise.all(
      TORONTO_OVERLAY_DATASETS.map(([key, url]) =>
        fetch(url).then((response) => {
          if (!response.ok) throw new Error(`Could not load ${url}`);
          return response.json().then((data) => [key, data]);
        }),
      ),
    )
      .then((entries) => {
        if (isMounted) {
          setOverlayData(Object.fromEntries(entries));
          setOverlayLoadState("ready");
        }
      })
      .catch((error) => {
        console.warn("Toronto overlay load failed.", error);
        if (isMounted) setOverlayLoadState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [isToronto]);

  const loadTorontoAddressIndex = useCallback(async () => {
    if (addressIndex.length) return addressIndex;

    const data = await fetch(TORONTO_ADDRESS_INDEX_URL).then((response) => {
      if (!response.ok) throw new Error("Address search data not found.");
      return response.json();
    });
    const addresses = Array.isArray(data) ? data : [];
    setAddressIndex(addresses);
    return addresses;
  }, [addressIndex]);

  const pointIsNearBounds = (latlng, bounds) => {
    if (!bounds) return true;
    const [minLng, minLat, maxLng, maxLat] = bounds;

    return (
      latlng.lng >= minLng - BBOX_PADDING_DEGREES &&
      latlng.lng <= maxLng + BBOX_PADDING_DEGREES &&
      latlng.lat >= minLat - BBOX_PADDING_DEGREES &&
      latlng.lat <= maxLat + BBOX_PADDING_DEGREES
    );
  };

  const indexedOverlayData = useMemo(() => {
    return Object.entries(overlayData).reduce((indexed, [key, data]) => {
      indexed[key] = (data?.features ?? []).map((feature) => {
        try {
          return { feature, bounds: bbox(feature) };
        } catch (error) {
          console.warn("Skipping overlay feature bbox", error);
          return { feature, bounds: null };
        }
      });

      return indexed;
    }, {});
  }, [overlayData]);

  const findIndexedOverlayMatches = useCallback(
    (latlng) => {
      const candidateOverlayData = Object.entries(indexedOverlayData).reduce(
        (data, [key, indexedFeatures]) => {
          data[key] = {
            type: "FeatureCollection",
            features: indexedFeatures
              .filter(({ bounds }) => pointIsNearBounds(latlng, bounds))
              .map(({ feature }) => feature),
          };
          return data;
        },
        {},
      );

      return findOverlayMatches(latlng, candidateOverlayData);
    },
    [indexedOverlayData],
  );

  const activeFilters = useMemo(
    () =>
      Boolean(
        cleanDisplayValue(appliedFilters.zone) ||
          (isToronto && cleanDisplayValue(appliedFilters.minDensity)) ||
          (isToronto && cleanDisplayValue(appliedFilters.minHeight)) ||
          (isToronto && cleanDisplayValue(appliedFilters.parkingZone)) ||
          (isToronto && appliedFilters.hasException) ||
          (!isToronto && cleanDisplayValue(appliedFilters.minDensity)) ||
          (!isToronto && cleanDisplayValue(appliedFilters.minHeight)) ||
          (!isToronto && cleanDisplayValue(appliedFilters.parkingZone)) ||
          (!isToronto && cleanDisplayValue(appliedFilters.minLotWidth)) ||
          (!isToronto && appliedFilters.hasException),
      ),
    [appliedFilters, isToronto],
  );

  const featureMatchesFilters = useCallback(
    (feature) => {
      if (!isToronto) {
        const query = cleanDisplayValue(appliedFilters.zone).toLowerCase();
        const properties = feature?.properties ?? {};
        const [lng, lat] = centroid(feature).geometry.coordinates;
        const overlays = findIndexedOverlayMatches({ lat, lng });
        const normalized = normalizeZoningFeature(
          { main: { properties }, overlays },
          "brampton",
        );
        const haystack = [
          properties.ZONE_CODE,
          properties.MZO_ZONE_CODE,
          properties.CATEGORY,
          properties.TYPE,
          properties.SPECIAL_SECTION,
          normalized.maxHeight,
          normalized.density,
          normalized.parkingZone,
          normalized.lotWidth,
        ]
          .map((value) => cleanDisplayValue(value).toLowerCase())
          .join(" ");
        if (query && !haystack.includes(query)) return false;

        const minDensity = parseDisplayNumber(appliedFilters.minDensity);
        if (minDensity !== null) {
          const density = parseDisplayNumber(normalized.density);
          if (density === null || density < minDensity) return false;
        }

        const minHeight = parseDisplayNumber(appliedFilters.minHeight);
        if (minHeight !== null) {
          const height = parseDisplayNumber(normalized.maxHeight);
          if (height === null || height < minHeight) return false;
        }

        const parkingQuery = cleanDisplayValue(appliedFilters.parkingZone).toLowerCase();
        if (
          parkingQuery &&
          !cleanDisplayValue(normalized.parkingZone)
            .toLowerCase()
            .includes(parkingQuery)
        ) {
          return false;
        }

        const minLotWidth = parseDisplayNumber(appliedFilters.minLotWidth);
        if (minLotWidth !== null) {
          const lotWidth = parseDisplayNumber(normalized.lotWidth);
          if (lotWidth === null || lotWidth < minLotWidth) return false;
        }

        if (appliedFilters.hasException && !normalized.specialSection) {
          return false;
        }

        return true;
      }

      const [lng, lat] = centroid(feature).geometry.coordinates;
      const overlayMatches = findIndexedOverlayMatches({ lat, lng });
      return doesFeatureMatchFilters(feature, appliedFilters, overlayMatches);
    },
    [appliedFilters, findIndexedOverlayMatches, isToronto],
  );

  const filteredFeatures = useMemo(() => {
    if (!activeFilters || !zoningData?.features?.length) return null;
    return zoningData.features.filter(featureMatchesFilters);
  }, [activeFilters, featureMatchesFilters, zoningData]);

  const filteredFeatureSet = useMemo(
    () => (filteredFeatures ? new Set(filteredFeatures) : null),
    [filteredFeatures],
  );

  const styleForFeature = useCallback(
    (feature) => {
      if (!activeFilters) {
        return isToronto ? baseStyle : bramptonBaseStyle;
      }
      return filteredFeatureSet?.has(feature) ? filterMatchStyle : filterDimStyle;
    },
    [activeFilters, filteredFeatureSet, isToronto],
  );

  const applyFilters = () => setAppliedFilters(filterDraft);

  const clearFilters = () => {
    setFilterDraft(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const searchAddressSuggestions = useCallback(
    async (query) => {
      try {
        const response = await searchMunicipalityAddresses(selectedMunicipality, query);
        setAddressStatus(response.message ? "partial" : "ready");
        return response.results ?? [];
      } catch (error) {
        console.warn("Municipality address search unavailable.", error);
        if (!isToronto) {
          setAddressStatus("missing");
          return [];
        }

        try {
          const addresses = await loadTorontoAddressIndex();
          setAddressStatus("fallback");
          return addresses
            .filter((address) => address.search_text?.includes(query.toLowerCase()))
            .slice(0, 10);
        } catch (fallbackError) {
          console.warn("Local Toronto address fallback unavailable.", fallbackError);
          setAddressStatus("missing");
          return [];
        }
      }
    },
    [isToronto, loadTorontoAddressIndex, selectedMunicipality],
  );

  const buildLocalSelection = useCallback(
    (point, address = null) => {
      const selectedFeature = findContainingFeature(point, zoningData);
      if (!selectedFeature) {
        return {
          found: false,
          main: null,
          overlays: {},
          clicked_point: point,
          selected_address: address,
          municipality_id: selectedMunicipality,
          no_result: true,
        };
      }

      if (!isToronto) {
        const overlays = findIndexedOverlayMatches(point);
        return {
          found: true,
          main: { properties: selectedFeature.properties ?? {} },
          overlays,
          clicked_point: point,
          selected_address: address,
          municipality_id: selectedMunicipality,
          no_result: false,
          source: {
            name: municipality.sourceName,
            url: municipality.sourceUrl,
          },
        };
      }

      return {
        ...buildSelectedZoneFromPoint(point, zoningData, overlayData, address),
        municipality_id: selectedMunicipality,
      };
    },
    [
      isToronto,
      findIndexedOverlayMatches,
      municipality.sourceName,
      municipality.sourceUrl,
      overlayData,
      selectedMunicipality,
      zoningData,
    ],
  );

  const handleAddressSelect = async (address) => {
    const point = {
      lat: Number(address.lat),
      lng: Number(address.lng),
    };

    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      setSelectedAddress(null);
      onSelectZone({
        found: false,
        no_result: true,
        municipality_id: selectedMunicipality,
        selected_address: address,
        message:
          selectedMunicipality === "brampton"
            ? "Selected Brampton address did not include map coordinates. Try clicking the map near the property."
            : "Selected address did not include map coordinates.",
      });
      return;
    }

    setSelectedAddress(address);

    if (!isToronto) {
      onSelectZone(buildLocalSelection(point, address));
      return;
    }

    try {
      const response = await getMunicipalityZoningByPoint(
        selectedMunicipality,
        point.lat,
        point.lng,
      );
      onSelectZone({
        ...response,
        municipality_id: selectedMunicipality,
        selected_address: address,
        no_result: !response.found,
      });
    } catch (error) {
      console.warn("Backend zoning lookup unavailable; using local fallback.", error);
      onSelectZone(buildLocalSelection(point, address));
    }
  };

  const clearAddressSearch = () => setSelectedAddress(null);

  const getFeatureZoneLabel = (feature) => {
    const properties = feature?.properties ?? {};
    return isToronto
      ? properties.zone_code ?? "Zoning area"
      : properties.ZONE_CODE ||
          properties.MZO_ZONE_CODE ||
          properties.CATEGORY ||
          "Brampton zoning area";
  };

  const onEachFeature = (feature, layer) => {
    const zoneCode = getFeatureZoneLabel(feature);
    layer.bindTooltip(`Zone ${zoneCode}`, { sticky: true });

    layer.on({
      click: async (event) => {
        if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
          selectedLayerRef.current.setStyle(styleForFeature(feature));
        }

        selectedLayerRef.current = layer;
        layer.setStyle(selectedStyle);
        layer.bringToFront();
        setSelectedAddress(null);

        const clickedPoint = {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        };

        if (!isToronto) {
          const overlays = findIndexedOverlayMatches(clickedPoint);
          onSelectZone({
            found: true,
            main: { properties: feature.properties ?? {} },
            overlays,
            clicked_point: clickedPoint,
            selected_address: null,
            municipality_id: selectedMunicipality,
            no_result: false,
            source: {
              name: municipality.sourceName,
              url: municipality.sourceUrl,
            },
          });
          return;
        }

        try {
          const response = await getMunicipalityZoningByPoint(
            selectedMunicipality,
            clickedPoint.lat,
            clickedPoint.lng,
          );
          onSelectZone({
            ...response,
            municipality_id: selectedMunicipality,
            selected_address: null,
            no_result: !response.found,
          });
        } catch (error) {
          console.warn("Backend zoning lookup unavailable; using local fallback.", error);
          onSelectZone({
            main: { properties: feature.properties ?? {} },
            overlays: findIndexedOverlayMatches(clickedPoint),
            clicked_point: clickedPoint,
            selected_address: null,
            municipality_id: selectedMunicipality,
            no_result: false,
          });
        }
      },
      mouseover: () => {
        if (selectedLayerRef.current !== layer) layer.setStyle(hoverStyle);
        layer.bringToFront();
      },
      mouseout: () => {
        layer.setStyle(
          selectedLayerRef.current === layer ? selectedStyle : styleForFeature(feature),
        );
      },
    });
  };

  return (
    <div className="map-wrap">
      <div className="control-panel">
        <MunicipalitySelector
          selectedMunicipality={selectedMunicipality}
          onMunicipalityChange={onMunicipalityChange}
        />
        <SearchBar
          key={`search-${selectedMunicipality}`}
          municipalityName={municipality.name}
          status={addressStatus}
          onSearchAddresses={searchAddressSuggestions}
          onSelectAddress={handleAddressSelect}
          onClearSearch={clearAddressSearch}
        />
      </div>

      <div className="feature-filter-panel">
        <details>
          <summary>Filter by Zoning Features</summary>
          <div className="filter-content">
            <label className="filter-row">
              <span>Zone code/category</span>
              <input
                value={filterDraft.zone}
                onChange={(event) =>
                  setFilterDraft({ ...filterDraft, zone: event.target.value })
                }
                placeholder={isToronto ? "R, RD, Residential" : "R1, Commercial"}
              />
            </label>
            {isToronto ? (
              <>
                <label className="filter-row">
                  <span>Minimum density</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterDraft.minDensity}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        minDensity: event.target.value,
                      })
                    }
                    placeholder="0.6"
                  />
                </label>
                <label className="filter-row">
                  <span>Minimum height</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterDraft.minHeight}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        minHeight: event.target.value,
                      })
                    }
                    placeholder="11"
                  />
                </label>
                <label className="filter-row">
                  <span>Parking zone</span>
                  <input
                    value={filterDraft.parkingZone}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        parkingZone: event.target.value,
                      })
                    }
                    placeholder="A, B, C"
                  />
                </label>
                <label className="filter-toggle">
                  <input
                    type="checkbox"
                    checked={filterDraft.hasException}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        hasException: event.target.checked,
                      })
                    }
                  />
                  <span>Has site-specific exception</span>
                </label>
              </>
            ) : (
              <>
                <label className="filter-row">
                  <span>Minimum height</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterDraft.minHeight}
                    disabled={overlayLoadState !== "ready"}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        minHeight: event.target.value,
                      })
                    }
                    placeholder="5"
                  />
                </label>
                <label className="filter-row">
                  <span>Minimum density / FSI</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterDraft.minDensity}
                    disabled={overlayLoadState !== "ready"}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        minDensity: event.target.value,
                      })
                    }
                    placeholder="2"
                  />
                </label>
                <label className="filter-row">
                  <span>Parking regulation area</span>
                  <input
                    value={filterDraft.parkingZone}
                    disabled={overlayLoadState !== "ready"}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        parkingZone: event.target.value,
                      })
                    }
                    placeholder="1, 2"
                  />
                </label>
                <label className="filter-row">
                  <span>Minimum lot width</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filterDraft.minLotWidth}
                    disabled={overlayLoadState !== "ready"}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        minLotWidth: event.target.value,
                      })
                    }
                    placeholder="12"
                  />
                </label>
                <label className="filter-toggle">
                  <input
                    type="checkbox"
                    checked={filterDraft.hasException}
                    onChange={(event) =>
                      setFilterDraft({
                        ...filterDraft,
                        hasException: event.target.checked,
                      })
                    }
                  />
                  <span>Has special section</span>
                </label>
                {overlayLoadState === "loading" ? (
                  <p className="filter-note">Loading Brampton overlay filters...</p>
                ) : null}
                {overlayLoadState === "error" ? (
                  <p className="filter-note">
                    Brampton overlay filters are unavailable. Zone filtering still works.
                  </p>
                ) : null}
              </>
            )}
            <div className="filter-actions">
              <button type="button" onClick={applyFilters}>
                Apply Filters
              </button>
              <button type="button" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
            {activeFilters ? (
              filteredFeatures?.length ? (
                <p className="result-count">
                  {filteredFeatures.length} matching zones found.
                </p>
              ) : (
                <p className="no-results-message">
                  No matching zoning areas found for these filters.
                </p>
              )
            ) : null}
          </div>
        </details>
      </div>

      <MapContainer
        center={municipality.center}
        zoom={municipality.zoom}
        minZoom={9}
        preferCanvas
        className="map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MunicipalityMapController municipalityId={selectedMunicipality} />

        {zoningData?.features?.length ? (
          <>
            <FitBounds data={zoningData} />
            <GeoJSON
              key={`zoning-layer-${selectedMunicipality}-${JSON.stringify(appliedFilters)}`}
              data={zoningData}
              style={styleForFeature}
              onEachFeature={onEachFeature}
            />
          </>
        ) : null}

        <AddressMapController selectedAddress={selectedAddress} />
        {selectedAddress ? (
          <Marker
            position={[Number(selectedAddress.lat), Number(selectedAddress.lng)]}
            icon={addressIcon}
          >
            <Popup>
              <span className="address-marker-popup">
                {selectedAddress.address_label || selectedAddress.displayAddress}
              </span>
            </Popup>
            <Tooltip direction="top" offset={[0, -30]} permanent>
              {selectedAddress.address_label || selectedAddress.displayAddress}
            </Tooltip>
          </Marker>
        ) : null}
      </MapContainer>

      {loadState !== "ready" ? (
        <div className="map-status" role="status">
          {loadState === "loading"
            ? `Loading ${municipality.name} zoning areas...`
            : null}
          {loadState === "empty"
            ? `No ${municipality.name} zoning polygons were found.`
            : null}
          {loadState === "error"
            ? `Could not load ${municipality.name} zoning polygons.`
            : null}
        </div>
      ) : null}

      {loadState === "ready" && overlayLoadState !== "ready" ? (
        <div className="map-status map-status-secondary" role="status">
          {overlayLoadState === "loading"
            ? `Loading ${municipality.name} zoning overlays...`
            : null}
          {overlayLoadState === "error"
            ? `Could not load one or more ${municipality.name} zoning overlay files.`
            : null}
        </div>
      ) : null}
    </div>
  );
}
