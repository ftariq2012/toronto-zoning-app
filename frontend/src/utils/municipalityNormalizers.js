import { getMunicipalityConfig } from "../config/municipalities.js";
import {
  cleanDisplayValue,
  getDensity,
  getExceptionNumber,
  getMaxHeight,
  getParkingZone,
  getZoneName,
  parseZoningString,
} from "./zoningFormatters.js";

export function normalizeZoningFeature(featureOrResult, municipalityId = "toronto") {
  const municipality = getMunicipalityConfig(municipalityId);
  const properties =
    featureOrResult?.main?.properties ??
    featureOrResult?.properties ??
    featureOrResult ??
    {};
  const overlays = featureOrResult?.overlays ?? {};

  if (municipality.id === "brampton") {
    return normalizeBrampton(properties, overlays, municipality);
  }

  return normalizeToronto(properties, overlays, municipality);
}

function normalizeToronto(properties, overlays, municipality) {
  const parsed = parseZoningString(properties.zone_string);
  const zoneCode = cleanDisplayValue(properties.zone_code || parsed.zoneCode);
  const zoneName = getZoneName(zoneCode);

  return {
    municipalityId: municipality.id,
    municipalityName: municipality.name,
    zoneCode,
    zoneName,
    zoneCategory: zoneName,
    density: getDensity(properties),
    maxHeight: getMaxHeight(overlays),
    parkingZone: getParkingZone(overlays),
    drivewayRegulation: "",
    exceptionNumber: getExceptionNumber(properties),
    bylawChapter: cleanDisplayValue(properties.bylaw_chapter),
    bylawSection: cleanDisplayValue(properties.bylaw_section),
    bylawReference: cleanDisplayValue(properties.exception_reference),
    sourceName: municipality.sourceName,
    sourceUrl: municipality.sourceUrl,
    rawProperties: properties,
    rawOverlayMatches: overlays,
  };
}

function normalizeBrampton(properties, overlays, municipality) {
  const rawProperties = properties;
  const overlayMatches = overlays;
  const zoneCode = cleanDisplayValue(
    rawProperties.ZONE_CODE || rawProperties.zone_code || rawProperties.MZO_ZONE_CODE,
  );
  const zoneName = cleanDisplayValue(rawProperties.TYPE || rawProperties.type);
  const zoneCategory = cleanDisplayValue(
    rawProperties.CATEGORY || rawProperties.category || zoneName,
  );
  const specialSection = cleanDisplayValue(
    rawProperties.SPECIAL_SECTION || rawProperties.special_section,
  );
  const height = firstOverlayValue(overlays, "height", [
    "HEIGHT_MAX_ST",
    "height_max_st",
  ]);
  const density = firstOverlayValue(overlays, "density", [
    "DENSITY_MAX_FSI",
    "density_max_fsi",
  ]);
  const lotWidth =
    firstOverlayValue(overlays, "lot_width", ["LOT_WIDTH", "lot_width"]) ||
    cleanDisplayValue(rawProperties.LOT_WIDTH || rawProperties.lot_width);
  const parkingZone = firstOverlayValue(overlays, "parking", [
    "PRA",
    "GISPRD_PL_CZBL_PARKING_REG_ARE",
  ]);
  const drivewayRegulation = firstOverlayValue(overlays, "driveway", [
    "DRIVEWAY_REGULATION",
    "DRIVEWAY",
    "REGULATION",
  ]);

  return {
    municipalityId: municipality.id,
    municipalityName: municipality.name,
    zoneCode,
    zoneName,
    zoneCategory,
    density,
    maxHeight: height,
    parkingZone,
    exceptionNumber: "",
    bylawChapter: "",
    bylawSection: "",
    bylawReference: specialSection,
    sourceName: municipality.sourceName,
    sourceUrl: municipality.sourceUrl,
    lotWidth,
    drivewayRegulation,
    specialSection,
    overlaySourceNote:
      "Brampton CZBL schedule overlay data; verify with official City of Brampton zoning sources.",
    rawProperties,
    rawOverlayMatches: overlayMatches,
  };
}

function firstOverlayValue(overlays, key, fieldNames) {
  for (const match of overlays?.[key] ?? []) {
    for (const fieldName of fieldNames) {
      const value = cleanDisplayValue(match?.[fieldName]);
      if (value) {
        return value;
      }
    }
  }
  return "";
}

export function getNormalizedZoneTitle(normalized) {
  const zoneCode = cleanDisplayValue(normalized?.zoneCode);
  const zoneName =
    cleanDisplayValue(normalized?.zoneName) ||
    cleanDisplayValue(normalized?.zoneCategory);

  if (zoneCode && zoneName) {
    return `${zoneCode} - ${zoneName}`;
  }

  return zoneCode || zoneName || "Selected zoning area";
}

export function buildMunicipalitySummary(normalized, overlays = {}) {
  if (normalized?.municipalityId === "brampton") {
    const title = getNormalizedZoneTitle(normalized);
    const zoneText =
      title === "Selected zoning area" ? "a selected zoning area" : title;
    const facts = [];
    if (normalized.maxHeight) facts.push(`maximum height ${normalized.maxHeight}`);
    if (normalized.density) facts.push(`density/FSI ${normalized.density}`);
    if (normalized.parkingZone) {
      facts.push(`parking regulation area ${normalized.parkingZone}`);
    }
    if (normalized.lotWidth) facts.push(`lot width ${normalized.lotWidth} m`);
    if (normalized.drivewayRegulation) {
      facts.push(`driveway regulation ${normalized.drivewayRegulation}`);
    }
    const factSentence = facts.length
      ? ` Available overlay data indicates ${facts.join(", ")}.`
      : "";
    return `This selected area is in Brampton and is zoned ${zoneText}.${factSentence} Verify all zoning details with the City of Brampton.`;
  }

  const facts = [];
  if (normalized?.density) facts.push(`density ${normalized.density} FSI`);
  if (normalized?.maxHeight) {
    facts.push(`maximum permitted height ${normalized.maxHeight} m`);
  }
  if (normalized?.parkingZone) facts.push(`parking zone ${normalized.parkingZone}`);
  if (normalized?.exceptionNumber) {
    facts.push(`site-specific exception ${normalized.exceptionNumber}`);
  }

  const zoneName = normalized?.zoneName || "this zoning area";
  const factSentence = facts.length
    ? ` Available zoning data indicates ${facts.join(", ")}.`
    : "";

  return `This area is zoned ${zoneName}.${factSentence}`;
}
