import {
  booleanPointInPolygon,
  point as turfPoint,
  pointToLineDistance,
} from "@turf/turf";

const LINE_MATCH_TOLERANCE_KM = 0.025;

export function toTurfPoint(point) {
  return turfPoint([point.lng, point.lat]);
}

export function findContainingFeature(point, featureCollection) {
  return findContainingFeatures(point, featureCollection)[0] ?? null;
}

export function findContainingFeatures(point, featureCollection) {
  const turfPointFeature = toTurfPoint(point);
  return (featureCollection?.features ?? []).filter((feature) =>
    featureMatchesPoint(feature, turfPointFeature),
  );
}

export function buildSelectedZoneFromPoint(
  point,
  zoningData,
  overlayData,
  selectedAddress = null,
) {
  const mainFeature = findContainingFeature(point, zoningData);
  const overlayMatches = findOverlayMatches(point, overlayData);

  return {
    main: mainFeature ? { properties: mainFeature.properties ?? {} } : null,
    overlays: overlayMatches,
    clicked_point: {
      lat: point.lat,
      lng: point.lng,
    },
    selected_address: selectedAddress,
    no_result: !mainFeature,
  };
}

export function findOverlayMatches(point, overlayData) {
  return Object.entries(overlayData ?? {}).reduce((matches, [key, data]) => {
    matches[key] = findContainingFeatures(point, data).map(
      (feature) => feature.properties ?? {},
    );
    return matches;
  }, {});
}

function featureMatchesPoint(feature, turfPointFeature) {
  const geometryType = feature?.geometry?.type;

  if (!geometryType) {
    return false;
  }

  try {
    if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
      return booleanPointInPolygon(turfPointFeature, feature);
    }

    if (geometryType === "LineString") {
      return (
        pointToLineDistance(turfPointFeature, feature, {
          units: "kilometers",
        }) <= LINE_MATCH_TOLERANCE_KM
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
          pointToLineDistance(turfPointFeature, lineFeature, {
            units: "kilometers",
          }) <= LINE_MATCH_TOLERANCE_KM
        );
      });
    }
  } catch (error) {
    console.warn("Skipping spatial match after Turf error", error);
  }

  return false;
}
