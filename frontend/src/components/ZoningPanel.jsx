import React from "react";
import Disclaimer from "./Disclaimer.jsx";
import {
  cleanDisplayValue,
  formatLabel,
  formatParkingOverlay,
  formatParsedZoning,
  getDensity,
  getExceptionNumber,
  getLotCoverage,
  getMaxHeight,
  getParkingZone,
  getZoneTitle,
  isDisplayableValue,
  parseLotCoverageOverlay,
  parseZoningString,
} from "../utils/zoningFormatters.js";
import {
  buildMunicipalitySummary,
  getNormalizedZoneTitle,
  normalizeZoningFeature,
} from "../utils/municipalityNormalizers.js";
import { getMunicipalityConfig } from "../config/municipalities.js";

const SOURCE_URL = "https://open.toronto.ca/dataset/zoning-by-law/";
const OVERLAY_SECTIONS = [
  ["height", "Height Overlay"],
  ["parking", "Parking Zone Overlay"],
  ["policy_area", "Policy Area Overlay"],
  ["policy_road", "Policy Road Overlay"],
  ["priority_retail", "Priority Retail Street Overlay"],
  ["rooming_house", "Rooming House Overlay"],
  ["lot_coverage", "Lot Coverage Overlay"],
  ["building_setback", "Building Setback Overlay"],
];
const BRAMPTON_OVERLAY_SECTIONS = [
  ["height", "Height Schedule Overlay"],
  ["density", "Density / FSI Schedule Overlay"],
  ["lot_width", "Lot Width Schedule Overlay"],
  ["parking", "Parking Regulation Area Overlay"],
  ["driveway", "Driveway Regulation Overlay"],
];

function SectionCard({ title, children, className = "" }) {
  return (
    <section className={`zoning-section ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DetailRow({ label, value }) {
  const displayValue = cleanDisplayValue(value);
  if (!displayValue) return null;

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{displayValue}</dd>
    </div>
  );
}

function RequirementCard({ label, value }) {
  const displayValue = cleanDisplayValue(value);
  if (!displayValue) return null;

  return (
    <div className="requirement-card">
      <span className="requirement-label">{label}</span>
      <strong className="requirement-value">{displayValue}</strong>
    </div>
  );
}

function DetailList({ rows }) {
  const visibleRows = rows.filter(([, value]) => isDisplayableValue(value));
  if (!visibleRows.length) return null;

  return (
    <dl className="detail-list">
      {visibleRows.map(([label, value]) => (
        <DetailRow key={label} label={label} value={value} />
      ))}
    </dl>
  );
}

function getUsefulOverlayFacts(overlayKey, properties) {
  if (overlayKey === "height") {
    const value = cleanDisplayValue(properties?.HEIGHT_MAX_ST);
    if (value) return [`Maximum height: ${value} storeys`];
  }

  if (overlayKey === "density") {
    const value = cleanDisplayValue(properties?.DENSITY_MAX_FSI);
    if (value) return [`Density / FSI: ${value} FSI`];
  }

  if (overlayKey === "lot_width") {
    const value = cleanDisplayValue(properties?.LOT_WIDTH);
    if (value) return [`Lot width: ${value} m`];
  }

  if (overlayKey === "driveway") {
    const value =
      cleanDisplayValue(properties?.DRIVEWAY_REGULATION) ||
      cleanDisplayValue(properties?.DRIVEWAY) ||
      cleanDisplayValue(properties?.REGULATION);
    if (value) return [`Driveway regulation: ${value}`];
  }

  if (overlayKey === "parking") {
    const bramptonParking = cleanDisplayValue(properties?.PRA);
    return [
      bramptonParking
        ? `Parking regulation area: ${bramptonParking}`
        : formatParkingOverlay(properties),
    ].filter(Boolean);
  }

  if (overlayKey === "lot_coverage") {
    return [parseLotCoverageOverlay(properties)].filter(Boolean);
  }

  return Object.entries(properties ?? {})
    .filter(([key, value]) => key !== "geometry" && isDisplayableValue(value))
    .slice(0, 4)
    .map(([key, value]) => `${formatLabel(key)}: ${cleanDisplayValue(value)}`);
}

function MatchedOverlay({ title, overlayKey, matches }) {
  const usefulMatches = (matches ?? [])
    .map((properties) => getUsefulOverlayFacts(overlayKey, properties))
    .filter((facts) => facts.length);

  if (!usefulMatches.length) return null;

  return (
    <div className="overlay-section">
      <h3>{title}</h3>
      {usefulMatches.map((facts, index) => (
        <ul className="overlay-facts" key={`${title}-${index}`}>
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function AdvancedRawData({ mainProperties, overlays, municipalityId }) {
  const overlayEntries = Object.entries(overlays ?? {});
  const shouldShowTorontoOverlayNotes = municipalityId === "toronto";

  return (
    <details className="advanced-details">
      <summary>Advanced raw data</summary>
      <div className="advanced-section">
        <h3>Main zoning raw fields</h3>
        <RawProperties properties={mainProperties} />
      </div>
      {shouldShowTorontoOverlayNotes
        ? OVERLAY_SECTIONS.map(([key, title]) => (
            <div className="advanced-section" key={key}>
              <h3>{title}</h3>
              {(overlays?.[key] ?? []).length ? (
                overlays[key].map((properties, index) => (
                  <RawProperties
                    key={`${key}-${index}`}
                    title={`Match ${index + 1}`}
                    properties={properties}
                  />
                ))
              ) : (
                <p className="no-match">No matching overlay found.</p>
              )}
            </div>
          ))
        : overlayEntries.map(([key, matches]) =>
            matches?.length ? (
              <div className="advanced-section" key={key}>
                <h3>{formatLabel(key)}</h3>
                {matches.map((properties, index) => (
                  <RawProperties
                    key={`${key}-${index}`}
                    title={`Match ${index + 1}`}
                    properties={properties}
                  />
                ))}
              </div>
            ) : null,
          )}
    </details>
  );
}

function RawProperties({ properties, title }) {
  const entries = Object.entries(properties ?? {}).filter(
    ([key, value]) => key !== "geometry" && isDisplayableValue(value),
  );

  return (
    <div className="raw-block">
      {title ? <h4>{title}</h4> : null}
      {entries.length ? (
        <dl className="overlay-list">
          {entries.map(([key, value]) => (
            <div className="overlay-row" key={key}>
              <dt>{formatLabel(key)}</dt>
              <dd>{cleanDisplayValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="no-match">No displayable values found.</p>
      )}
    </div>
  );
}

function SharedFooter({ municipalityName, sourceName, sourceUrl }) {
  return (
    <>
      <div className="source-box">
        <span>Source</span>
        <a href={sourceUrl || SOURCE_URL} target="_blank" rel="noreferrer">
          {sourceName || "City of Toronto Zoning By-law Open Data"}
        </a>
      </div>
      <Disclaimer municipalityName={municipalityName} />
    </>
  );
}

function EmptyPanel({ municipalityName }) {
  return (
    <div className="empty-state">
      <p>
        Search a {municipalityName} address or click a zoning polygon to see zoning
        requirements, overlays, by-law references, and raw data.
      </p>
    </div>
  );
}

export default function ZoningPanel({ zone, selectedMunicipality = "toronto" }) {
  const municipalityId = zone?.municipality_id ?? selectedMunicipality;
  const municipality = getMunicipalityConfig(municipalityId);
  const properties = zone?.main?.properties;

  if (zone?.no_result) {
    return (
      <aside className="zoning-panel" aria-label="Selected zoning details">
        <div className="panel-header">
          <p className="eyebrow">{municipality.name} zoning lookup</p>
          <h1 className="zoning-title">No zoning polygon found</h1>
        </div>
        {zone.selected_address ? (
          <div className="selected-address">
            Selected address: {zone.selected_address.address_label}
          </div>
        ) : null}
        <SectionCard title="Result">
          <p className="no-result">
            {zone.message ||
              "No zoning polygon was found for this point. Try another address or click a nearby zoning polygon."}
          </p>
        </SectionCard>
        <SharedFooter
          municipalityName={municipality.name}
          sourceName={municipality.sourceName}
          sourceUrl={municipality.sourceUrl}
        />
      </aside>
    );
  }

  if (!properties) {
    return (
      <aside className="zoning-panel" aria-label="Selected zoning details">
        <div className="panel-header">
          <p className="eyebrow">{municipality.name} zoning lookup</p>
          <h1 className="zoning-title">Select a location</h1>
        </div>
        <EmptyPanel municipalityName={municipality.name} />
        <SharedFooter
          municipalityName={municipality.name}
          sourceName={municipality.sourceName}
          sourceUrl={municipality.sourceUrl}
        />
      </aside>
    );
  }

  const overlays = zone?.overlays ?? {};
  const normalized = normalizeZoningFeature(zone, municipalityId);
  const parsed = parseZoningString(properties.zone_string);
  const zoneTitle =
    municipalityId === "brampton"
      ? getNormalizedZoneTitle(normalized)
      : getZoneTitle(properties);
  const density = normalized.density || getDensity(properties);
  const maxHeight = normalized.maxHeight || getMaxHeight(overlays);
  const parkingZone = normalized.parkingZone || getParkingZone(overlays);
  const exceptionNumber = normalized.exceptionNumber || getExceptionNumber(properties);
  const lotCoverage = getLotCoverage(overlays);
  const parkingDisplay = parkingZone
    ? municipalityId === "brampton"
      ? parkingZone
      : parkingZone.toLowerCase().startsWith("zone")
      ? parkingZone
      : `Zone ${parkingZone}`
    : "";
  const parsedRows = formatParsedZoning(parsed);
  const lotRows = [
    ["Minimum lot area", parsed.lotArea ? `${parsed.lotArea} m²` : ""],
    ["Lot area field", properties.lot_area ? `${properties.lot_area} m²` : ""],
    ["Minimum frontage", parsed.frontage ? `${parsed.frontage} m` : ""],
    ["Frontage field", properties.frontage ? `${properties.frontage} m` : ""],
    ["Coverage", properties.coverage],
    ["Lot coverage", lotCoverage ? `${lotCoverage}%` : ""],
    [
      "Lot width",
      normalized.lotWidth && municipalityId === "brampton"
        ? `${normalized.lotWidth} m`
        : normalized.lotWidth,
    ],
    ["Driveway regulation", normalized.drivewayRegulation],
  ];
  const bylawRows = [
    ["Chapter", normalized.bylawChapter || properties.bylaw_chapter],
    ["Section", normalized.bylawSection || properties.bylaw_section],
    ["Reference", normalized.bylawReference || properties.exception_reference],
  ];
  const hasParsedRows = parsedRows.some(([, value]) => isDisplayableValue(value));
  const hasLotRows = lotRows.some(([, value]) => isDisplayableValue(value));
  const hasBylawRows = bylawRows.some(([, value]) => isDisplayableValue(value));
  const activeOverlaySections =
    municipalityId === "brampton" ? BRAMPTON_OVERLAY_SECTIONS : OVERLAY_SECTIONS;
  const hasMatchedOverlay = activeOverlaySections.some(([key]) =>
    (overlays[key] ?? []).some(
      (item) => getUsefulOverlayFacts(key, item).length > 0,
    ),
  );

  return (
    <aside className="zoning-panel" aria-label="Selected zoning details">
      <div className="panel-header">
        <p className="eyebrow">{municipality.name} zoning lookup</p>
        <p className="municipality-kicker">{municipality.name}</p>
        <h1 className="zoning-title">{zoneTitle}</h1>
      </div>

      {zone?.selected_address ? (
        <div className="selected-address">
          Selected address: {zone.selected_address.address_label}
        </div>
      ) : null}

      <section className="zoning-summary-card">
        <h2>Summary</h2>
        <p>{buildMunicipalitySummary(normalized, overlays)}</p>
      </section>

      <SectionCard title="Key Requirements / Development Snapshot">
        <div className="requirements-grid">
          <RequirementCard label="Zone" value={zoneTitle} />
          <RequirementCard label="Category" value={normalized.zoneCategory} />
          <RequirementCard
            label={municipalityId === "brampton" ? "Density / FSI" : "Density"}
            value={density ? `${density} FSI` : ""}
          />
          <RequirementCard
            label="Maximum Height"
            value={
              maxHeight
                ? municipalityId === "brampton"
                  ? `${maxHeight} storeys`
                  : `${maxHeight} m`
                : ""
            }
          />
          <RequirementCard
            label={
              municipalityId === "brampton"
                ? "Parking Regulation Area"
                : "Parking Zone"
            }
            value={parkingDisplay}
          />
          <RequirementCard
            label="Site-specific Exception"
            value={exceptionNumber}
          />
          <RequirementCard
            label="Special Section"
            value={municipalityId === "brampton" ? normalized.bylawReference : ""}
          />
          <RequirementCard
            label="Lot Width"
            value={
              municipalityId === "brampton" && normalized.lotWidth
                ? `${normalized.lotWidth} m`
                : ""
            }
          />
          <RequirementCard
            label="Driveway Regulation"
            value={normalized.drivewayRegulation}
          />
        </div>
      </SectionCard>

      {hasParsedRows ? (
        <SectionCard title="Parsed Zoning Rules">
          <DetailList rows={parsedRows} />
        </SectionCard>
      ) : null}

      {hasLotRows ? (
        <SectionCard title="Lot / Building Standards">
          <DetailList rows={lotRows} />
        </SectionCard>
      ) : null}

      {hasBylawRows ? (
        <SectionCard title="By-law References">
          <DetailList rows={bylawRows} />
        </SectionCard>
      ) : null}

      {hasMatchedOverlay ? (
        <SectionCard title="Matched Overlays">
          <div className="overlay-sections">
            {activeOverlaySections.map(([key, title]) => (
              <MatchedOverlay
                key={key}
                title={title}
                overlayKey={key}
                matches={overlays[key]}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {municipalityId === "brampton" ? (
        <section className="overlay-source-note">
          Some Brampton height, density, parking, and lot-width values come from
          Brampton CZBL schedule overlay layers. Verify with official City of
          Brampton zoning sources.
        </section>
      ) : null}

      <AdvancedRawData
        mainProperties={properties}
        overlays={overlays}
        municipalityId={municipalityId}
      />
      <SharedFooter
        municipalityName={municipality.name}
        sourceName={normalized.sourceName}
        sourceUrl={normalized.sourceUrl}
      />
    </aside>
  );
}
