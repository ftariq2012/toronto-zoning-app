const ZONE_NAMES = {
  R: "Residential Zone",
  RD: "Residential Detached Zone",
  RS: "Residential Semi-Detached Zone",
  RT: "Residential Townhouse Zone",
  RM: "Residential Multiple Dwelling Zone",
  RA: "Residential Apartment Zone",
  CR: "Commercial Residential Zone",
  CRE: "Commercial Residential Employment Zone",
  CL: "Commercial Local Zone",
  EL: "Employment Light Industrial Zone",
  E: "Employment Industrial Zone",
  EH: "Employment Heavy Industrial Zone",
  I: "Institutional Zone",
  O: "Open Space Zone",
  ON: "Open Space Natural Zone",
  OR: "Open Space Recreation Zone",
  OG: "Open Space Golf Zone",
  UT: "Utility and Transportation Zone",
  U: "Utility Zone",
};

export function cleanDisplayValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isNaN(value) || value === -1 ? "" : String(value);
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === "nan" || trimmed === "-1") {
    return "";
  }

  return trimmed;
}

export function isDisplayableValue(value) {
  return cleanDisplayValue(value) !== "";
}

export function parseDisplayNumber(value) {
  const cleaned = cleanDisplayValue(value);
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function getZoneName(zoneCode) {
  const cleanZoneCode = cleanDisplayValue(zoneCode).toUpperCase();
  if (!cleanZoneCode) {
    return "";
  }

  return ZONE_NAMES[cleanZoneCode] ?? `${cleanZoneCode} Zone`;
}

export function parseZoningString(zoneString) {
  const raw = cleanDisplayValue(zoneString);
  if (!raw) {
    return { raw: "", tokens: [] };
  }

  const tokens = raw.match(/[A-Z]{1,4}\d*(?:\.\d+)?|-?\d+(?:\.\d+)?/gi) ?? [];
  const parsed = {
    raw,
    zoneCode: tokens[0] ?? "",
    density: "",
    commercialDensity: "",
    residentialDensity: "",
    frontage: "",
    lotArea: "",
    exceptionNumber: "",
    units: "",
    siteSpecificPolicy: "",
    tokens,
  };

  for (const token of tokens) {
    const normalized = token.toUpperCase();
    const value = token.slice(1);

    if (/^D-?\d+(\.\d+)?$/i.test(token)) {
      parsed.density = value;
    } else if (/^C-?\d+(\.\d+)?$/i.test(token)) {
      parsed.commercialDensity = value;
    } else if (/^R-?\d+(\.\d+)?$/i.test(token)) {
      parsed.residentialDensity = value;
    } else if (/^F-?\d+(\.\d+)?$/i.test(token)) {
      parsed.frontage = value;
    } else if (/^A-?\d+(\.\d+)?$/i.test(token)) {
      parsed.lotArea = value;
    } else if (/^X-?\d+(\.\d+)?$/i.test(token)) {
      parsed.exceptionNumber = value;
    } else if (/^U-?\d+(\.\d+)?$/i.test(token)) {
      parsed.units = value;
    } else if (/^SS\d+$/i.test(token)) {
      parsed.siteSpecificPolicy = normalized;
    }
  }

  return parsed;
}

export function formatParsedZoning(parsed) {
  return [
    parsed?.density ? ["Density", `${parsed.density} FSI`] : null,
    parsed?.commercialDensity
      ? ["Commercial density", `${parsed.commercialDensity} FSI`]
      : null,
    parsed?.residentialDensity
      ? ["Residential density", `${parsed.residentialDensity} FSI`]
      : null,
    parsed?.frontage ? ["Minimum frontage", `${parsed.frontage} m`] : null,
    parsed?.lotArea ? ["Minimum lot area", `${parsed.lotArea} m²`] : null,
    parsed?.exceptionNumber
      ? ["Site-specific exception", parsed.exceptionNumber]
      : null,
    parsed?.units ? ["Units", parsed.units] : null,
    parsed?.siteSpecificPolicy
      ? ["Standards set", parsed.siteSpecificPolicy]
      : null,
  ].filter(Boolean);
}

export function parseHeightOverlay(properties = {}) {
  const heightText =
    cleanDisplayValue(properties.height_string) ||
    cleanDisplayValue(properties.height_label) ||
    cleanDisplayValue(properties.HT_STRING) ||
    cleanDisplayValue(properties.HT_LABEL);
  const heightMatch = heightText.match(/HT\s*(-?\d+(?:\.\d+)?)/i);
  const height = heightMatch?.[1] ?? "";

  const stories =
    cleanDisplayValue(properties.height_stories) ||
    cleanDisplayValue(properties.HT_STORIES);

  return {
    height,
    stories,
    rows: [
      height ? ["Maximum permitted height", `${height} m`] : null,
      stories ? ["Maximum number of storeys", stories] : null,
    ].filter(Boolean),
  };
}

export function getHeightOverlayText(properties = {}) {
  const parsed = parseHeightOverlay(properties);

  if (parsed.height) {
    return `Maximum permitted height: ${parsed.height} m`;
  }

  if (parsed.stories) {
    return `Maximum number of storeys: ${parsed.stories}`;
  }

  return "";
}

export function parseLotCoverageOverlay(properties = {}) {
  const coverage =
    cleanDisplayValue(properties.lot_coverage_percent) ||
    cleanDisplayValue(properties.lot_coverage_string) ||
    cleanDisplayValue(properties.LC_PERCENT) ||
    cleanDisplayValue(properties.LC_STRING) ||
    cleanDisplayValue(properties.PRCNT_CVER);
  const match = coverage.match(/-?\d+(\.\d+)?/);
  const value = match?.[0] ?? coverage;

  return value ? `Maximum lot coverage: ${value}%` : "";
}

export function formatParkingOverlay(properties = {}) {
  const parkingZone =
    cleanDisplayValue(properties.parking_zone) ||
    cleanDisplayValue(properties.ZN_PARKZONE);

  return parkingZone ? `Parking zone: ${parkingZone}` : "";
}

export function getDensity(mainProperties = {}) {
  const parsed = parseZoningString(mainProperties.zone_string);
  return cleanDisplayValue(parsed.density);
}

export function getExceptionNumber(mainProperties = {}) {
  const parsed = parseZoningString(mainProperties.zone_string);
  return (
    cleanDisplayValue(parsed.exceptionNumber) ||
    cleanDisplayValue(mainProperties.exception_number)
  );
}

export function getMaxHeight(overlays = {}) {
  for (const properties of overlays.height ?? []) {
    const parsed = parseHeightOverlay(properties);
    if (parsed.height) {
      return parsed.height;
    }
  }
  return "";
}

export function getParkingZone(overlays = {}) {
  for (const properties of overlays.parking ?? []) {
    const parkingZone =
      cleanDisplayValue(properties.parking_zone) ||
      cleanDisplayValue(properties.ZN_PARKZONE);
    if (parkingZone) {
      return parkingZone;
    }
  }
  return "";
}

export function getLotCoverage(overlays = {}) {
  for (const properties of overlays.lot_coverage ?? []) {
    const text = parseLotCoverageOverlay(properties);
    const value = parseDisplayNumber(text);
    if (value !== null) {
      return String(value);
    }
  }
  return "";
}

export function getZoneTitle(mainProperties = {}) {
  const parsed = parseZoningString(mainProperties.zone_string);
  const zoneCode = cleanDisplayValue(mainProperties.zone_code || parsed.zoneCode);
  const zoneName = getZoneName(zoneCode);
  return zoneCode ? `${zoneCode} - ${zoneName}` : "";
}

export function doesFeatureMatchFilters(feature, filters = {}, overlayMatches = {}) {
  const properties = feature?.properties ?? {};
  const parsed = parseZoningString(properties.zone_string);
  const zoneCode = cleanDisplayValue(properties.zone_code || parsed.zoneCode);
  const zoneName = getZoneName(zoneCode);
  const zoneQuery = cleanDisplayValue(filters.zone).toLowerCase();

  if (
    zoneQuery &&
    !zoneCode.toLowerCase().includes(zoneQuery) &&
    !zoneName.toLowerCase().includes(zoneQuery)
  ) {
    return false;
  }

  const minDensity = parseDisplayNumber(filters.minDensity);
  if (minDensity !== null) {
    const density = parseDisplayNumber(parsed.density);
    if (density === null || density < minDensity) {
      return false;
    }
  }

  const minHeight = parseDisplayNumber(filters.minHeight);
  if (minHeight !== null) {
    const height = parseDisplayNumber(getMaxHeight(overlayMatches));
    if (height === null || height < minHeight) {
      return false;
    }
  }

  const parkingQuery = cleanDisplayValue(filters.parkingZone).toLowerCase();
  if (parkingQuery) {
    const parkingZone = getParkingZone(overlayMatches).toLowerCase();
    if (!parkingZone || !parkingZone.includes(parkingQuery)) {
      return false;
    }
  }

  if (filters.hasException && !getExceptionNumber(properties)) {
    return false;
  }

  return true;
}

export function buildPlainEnglishSummary(mainProperties = {}, overlays = {}) {
  const zoneName = getZoneName(mainProperties.zone_code) || "this zoning area";
  const facts = [];
  const density = getDensity(mainProperties);
  const height = getMaxHeight(overlays);
  const parkingZone = getParkingZone(overlays);
  const exceptionNumber = getExceptionNumber(mainProperties);
  const lotCoverage = getLotCoverage(overlays);

  if (density) facts.push(`density ${density} FSI`);
  if (height) facts.push(`maximum permitted height ${height} m`);
  if (parkingZone) facts.push(`parking zone ${parkingZone}`);
  if (lotCoverage) facts.push(`maximum lot coverage ${lotCoverage}%`);
  if (exceptionNumber) facts.push(`site-specific exception ${exceptionNumber}`);

  const factSentence = facts.length
    ? ` Available zoning data indicates ${facts.join(", ")}.`
    : "";

  return `This area is zoned ${zoneName}.${factSentence}`;
}

export function formatLabel(key) {
  return key
    .replace(/^_+/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
