const ZONE_NAMES = {
  R: "Residential Zone",
  RD: "Residential Detached Zone",
  RM: "Residential Multiple Dwelling Zone",
  RT: "Residential Townhouse Zone",
  RS: "Residential Semi-Detached Zone",
  CR: "Commercial Residential Zone",
  CRE: "Commercial Residential Employment Zone",
  CL: "Commercial Local Zone",
  EL: "Employment Light Industrial Zone",
  E: "Employment Industrial Zone",
  I: "Institutional Zone",
  O: "Open Space Zone",
  ON: "Open Space Natural Zone",
  UT: "Utility and Transportation Zone",
};

export function isDisplayableValue(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  if (typeof value === "number") {
    return !Number.isNaN(value) && value !== -1;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && trimmed.toLowerCase() !== "nan" && trimmed !== "-1";
  }

  return true;
}

export function getZoneName(zoneCode) {
  if (!isDisplayableValue(zoneCode)) {
    return "";
  }

  return ZONE_NAMES[String(zoneCode).trim().toUpperCase()] ?? "Unmapped Zone";
}

export function parseZoningString(zoneString) {
  if (!isDisplayableValue(zoneString)) {
    return {};
  }

  const text = String(zoneString);

  return {
    density: findTokenValue(text, "d"),
    frontage: findTokenValue(text, "f"),
    lotArea: findTokenValue(text, "a"),
    exceptionNumber: findTokenValue(text, "x"),
  };
}

export function formatParsedZoning(parsed) {
  return [
    parsed.density
      ? ["Density / FSI", `${parsed.density}`]
      : null,
    parsed.frontage
      ? ["Minimum frontage", `${parsed.frontage} m`]
      : null,
    parsed.lotArea
      ? ["Minimum lot area", `${parsed.lotArea} m2`]
      : null,
    parsed.exceptionNumber
      ? ["Site-specific exception", `Exception ${parsed.exceptionNumber}`]
      : null,
  ].filter(Boolean);
}

export function getHeightOverlayText(heightProperties) {
  const heightValue =
    heightProperties?.height_stories ??
    parseHeightValue(heightProperties?.height_string) ??
    parseHeightValue(heightProperties?.height_label);

  if (!isDisplayableValue(heightValue)) {
    return "";
  }

  return `Maximum permitted height: ${heightValue} m.`;
}

export function formatLabel(key) {
  return key
    .replace(/^_+/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function findTokenValue(text, token) {
  const match = text.match(new RegExp(`(?:^|[\\s(;])${token}(-?\\d+(?:\\.\\d+)?)`, "i"));
  return match?.[1] ?? "";
}

function parseHeightValue(value) {
  if (!isDisplayableValue(value)) {
    return "";
  }

  const match = String(value).match(/HT\s*(-?\d+(?:\.\d+)?)/i);
  return match?.[1] ?? "";
}
