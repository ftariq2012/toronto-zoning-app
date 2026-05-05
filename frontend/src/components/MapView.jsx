import React, { useEffect, useMemo, useRef, useState } from "react";
import { geoJSON } from "leaflet";
import { GeoJSON, MapContainer, TileLayer, useMap } from "react-leaflet";
import {
  bbox,
  booleanPointInPolygon,
  point,
  pointToLineDistance,
} from "@turf/turf";

const TORONTO_CENTER = [43.6532, -79.3832];
const MAIN_DATA_URL = "/data/zoning_area_clean.geojson";
const LINE_MATCH_TOLERANCE_KM = 0.025;
const BBOX_PADDING_DEGREES = 0.00035;

const OVERLAY_DATASETS = [
  {
    key: "height",
    url: "/data/zoning_height_overlay_clean.geojson",
  },
  {
    key: "parking",
    url: "/data/parking_zone_overlay_clean.geojson",
  },
  {
    key: "policy_area",
    url: "/data/zoning_policy_area_overlay_clean.geojson",
  },
  {
    key: "policy_road",
    url: "/data/zoning_policy_road_overlay_clean.geojson",
  },
  {
    key: "priority_retail",
    url: "/data/zoning_priority_retail_street_overlay_clean.geojson",
  },
  {
    key: "rooming_house",
    url: "/data/zoning_rooming_house_overlay_clean.geojson",
  },
  {
    key: "lot_coverage",
    url: "/data/zoning_lot_coverage_overlay_clean.geojson",
  },
  {
    key: "building_setback",
    url: "/data/zoning_building_setback_overlay_clean.geojson",
  },
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

export default function MapView({ selectedZone, onSelectZone }) {
  const [zoningData, setZoningData] = useState(null);
  const [overlayData, setOverlayData] = useState({});
  const [loadState, setLoadState] = useState("loading");
  const [overlayLoadState, setOverlayLoadState] = useState("loading");
  const selectedLayerRef = useRef(null);

  const indexedOverlayData = useMemo(() => {
    return OVERLAY_DATASETS.reduce((indexed, dataset) => {
      const features = overlayData[dataset.key]?.features ?? [];

      indexed[dataset.key] = features.map((feature) => {
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
      OVERLAY_DATASETS.map((dataset) =>
        fetch(dataset.url).then((response) => {
          if (!response.ok) {
            throw new Error(`Could not load ${dataset.url}`);
          }
          return response.json().then((data) => [dataset.key, data]);
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

  const featureMatchesPoint = (feature, turfPoint) => {
    const geometryType = feature?.geometry?.type;

    if (!geometryType) {
      return false;
    }

    try {
      if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
        return booleanPointInPolygon(turfPoint, feature);
      }

      if (geometryType === "LineString") {
        return (
          pointToLineDistance(turfPoint, feature, { units: "kilometers" }) <=
          LINE_MATCH_TOLERANCE_KM
        );
      }

      if (geometryType === "MultiLineString") {
        return feature.geometry.coordinates.some((coordinates) => {
          const lineFeature = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates,
            },
          };

          return (
            pointToLineDistance(turfPoint, lineFeature, {
              units: "kilometers",
            }) <= LINE_MATCH_TOLERANCE_KM
          );
        });
      }
    } catch (error) {
      console.warn("Skipping overlay feature match after Turf error", error);
      return false;
    }

    return false;
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

  const findOverlayMatches = (latlng) => {
    const turfPoint = point([latlng.lng, latlng.lat]);

    return OVERLAY_DATASETS.reduce((matches, dataset) => {
      const indexedFeatures = indexedOverlayData[dataset.key] ?? [];

      matches[dataset.key] = indexedFeatures
        .filter(({ bounds }) => pointIsNearBounds(latlng, bounds))
        .filter(({ feature }) => featureMatchesPoint(feature, turfPoint))
        .map(({ feature }) => feature.properties ?? {});

      return matches;
    }, {});
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

        const selectedResult = {
          main: {
            properties: feature.properties,
          },
          overlays: {},
          clicked_point: {
            lat: event.latlng.lat,
            lng: event.latlng.lng,
          },
        };

        try {
          selectedResult.overlays = findOverlayMatches(event.latlng);
        } catch (error) {
          console.warn("Could not complete overlay matching", error);
        }

        onSelectZone({
          ...selectedResult,
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
