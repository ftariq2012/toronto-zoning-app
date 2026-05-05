import React, { useEffect, useMemo, useRef, useState } from "react";
import { bbox } from "@turf/turf";
import { geoJSON } from "leaflet";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import SearchBar from "./SearchBar.jsx";
import {
  buildSelectedZoneFromPoint,
  findOverlayMatches,
} from "../utils/spatialMatching.js";

const TORONTO_CENTER = [43.6532, -79.3832];
const MAIN_DATA_URL = "/data/zoning_area_clean.geojson";
const ADDRESS_INDEX_URL = "/data/address_points_index.json";
const BBOX_PADDING_DEGREES = 0.00035;

const OVERLAY_DATASETS = [
  ["height", "/data/zoning_height_overlay_clean.geojson"],
  ["parking", "/data/parking_zone_overlay_clean.geojson"],
  ["policy_area", "/data/zoning_policy_area_overlay_clean.geojson"],
  ["policy_road", "/data/zoning_policy_road_overlay_clean.geojson"],
  [
    "priority_retail",
    "/data/zoning_priority_retail_street_overlay_clean.geojson",
  ],
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

function FitBounds({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!data?.features?.length) {
      return;
    }

    const bounds = geoJSON(data).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [data, map]);

  return null;
}

function AddressMapController({ selectedAddress }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedAddress) {
      return;
    }

    map.setView([selectedAddress.lat, selectedAddress.lng], 17);
  }, [map, selectedAddress]);

  return null;
}

export default function MapView({ onSelectZone }) {
  const [zoningData, setZoningData] = useState(null);
  const [overlayData, setOverlayData] = useState({});
  const [addressIndex, setAddressIndex] = useState([]);
  const [addressStatus, setAddressStatus] = useState("idle");
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [overlayLoadState, setOverlayLoadState] = useState("loading");
  const selectedLayerRef = useRef(null);

  const indexedOverlayData = useMemo(() => {
    return Object.entries(overlayData).reduce((indexed, [key, data]) => {
      indexed[key] = (data?.features ?? []).map((feature) => {
        try {
          return {
            feature,
            bounds: bbox(feature),
          };
        } catch (error) {
          console.warn("Skipping overlay feature bbox", error);
          return {
            feature,
            bounds: null,
          };
        }
      });

      return indexed;
    }, {});
  }, [overlayData]);

  useEffect(() => {
    let isMounted = true;

    fetch(MAIN_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${MAIN_DATA_URL}`);
        }
        return response.json();
      })
      .then((data) => {
        if (isMounted) {
          setZoningData(data);
          setLoadState(data.features?.length ? "ready" : "empty");
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    Promise.all(
      OVERLAY_DATASETS.map(([key, url]) =>
        fetch(url).then((response) => {
          if (!response.ok) {
            throw new Error(`Could not load ${url}`);
          }
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
      .catch(() => {
        if (isMounted) {
          setOverlayLoadState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const loadAddressIndex = () => {
    if (addressStatus !== "idle") {
      return;
    }

    setAddressStatus("loading");
    fetch(ADDRESS_INDEX_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Address search data not found.");
        }
        return response.json();
      })
      .then((data) => {
        setAddressIndex(Array.isArray(data) ? data : []);
        setAddressStatus(Array.isArray(data) && data.length ? "ready" : "missing");
      })
      .catch((error) => {
        console.warn(
          "Address search data not found. Run the data preparation scripts.",
          error,
        );
        setAddressStatus("missing");
      });
  };

  const pointIsNearBounds = (latlng, bounds) => {
    if (!bounds) {
      return true;
    }

    const [minLng, minLat, maxLng, maxLat] = bounds;

    return (
      latlng.lng >= minLng - BBOX_PADDING_DEGREES &&
      latlng.lng <= maxLng + BBOX_PADDING_DEGREES &&
      latlng.lat >= minLat - BBOX_PADDING_DEGREES &&
      latlng.lat <= maxLat + BBOX_PADDING_DEGREES
    );
  };

  const findIndexedOverlayMatches = (latlng) => {
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
  };

  const handleAddressSelect = (address) => {
    const point = {
      lat: Number(address.lat),
      lng: Number(address.lng),
    };
    const selectedResult = buildSelectedZoneFromPoint(
      point,
      zoningData,
      overlayData,
      address,
    );

    setSelectedAddress(address);
    onSelectZone(selectedResult);
  };

  const onEachFeature = (feature, layer) => {
    const zoneCode = feature?.properties?.zone_code ?? "Zoning area";
    layer.bindTooltip(`Zone ${zoneCode}`, { sticky: true });

    layer.on({
      click: (event) => {
        if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
          selectedLayerRef.current.setStyle(baseStyle);
        }

        selectedLayerRef.current = layer;
        layer.setStyle(selectedStyle);
        layer.bringToFront();
        setSelectedAddress(null);

        const clickedPoint = {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        };

        onSelectZone({
          main: {
            properties: feature.properties,
          },
          overlays: findIndexedOverlayMatches(clickedPoint),
          clicked_point: clickedPoint,
          selected_address: null,
          no_result: false,
        });
      },
      mouseover: () => {
        if (selectedLayerRef.current !== layer) {
          layer.setStyle(hoverStyle);
        }
        layer.bringToFront();
      },
      mouseout: () => {
        layer.setStyle(
          selectedLayerRef.current === layer ? selectedStyle : baseStyle,
        );
      },
    });
  };

  return (
    <div className="map-wrap">
      <SearchBar
        addresses={addressIndex}
        status={addressStatus}
        onRequestAddresses={loadAddressIndex}
        onSelectAddress={handleAddressSelect}
      />

      <MapContainer
        center={TORONTO_CENTER}
        zoom={11}
        minZoom={10}
        preferCanvas
        className="map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {zoningData?.features?.length ? (
          <>
            <FitBounds data={zoningData} />
            <GeoJSON
              key="zoning-layer"
              data={zoningData}
              style={baseStyle}
              onEachFeature={onEachFeature}
            />
          </>
        ) : null}

        <AddressMapController selectedAddress={selectedAddress} />
        {selectedAddress ? (
          <CircleMarker
            center={[selectedAddress.lat, selectedAddress.lng]}
            radius={7}
            pathOptions={{
              color: "#991b1b",
              fillColor: "#ef4444",
              fillOpacity: 0.9,
              weight: 2,
            }}
          />
        ) : null}
      </MapContainer>

      {loadState !== "ready" ? (
        <div className="map-status" role="status">
          {loadState === "loading" ? "Loading zoning areas..." : null}
          {loadState === "empty"
            ? "Run the data preparation script to populate zoning areas."
            : null}
          {loadState === "error"
            ? "Could not load the zoning GeoJSON file."
            : null}
        </div>
      ) : null}

      {loadState === "ready" && overlayLoadState !== "ready" ? (
        <div className="map-status map-status-secondary" role="status">
          {overlayLoadState === "loading" ? "Loading zoning overlays..." : null}
          {overlayLoadState === "error"
            ? "Could not load one or more zoning overlay files."
            : null}
        </div>
      ) : null}
    </div>
  );
}
