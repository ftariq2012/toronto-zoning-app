import React from "react";
import Disclaimer from "./Disclaimer.jsx";
import {
  buildPlainEnglishSummary,
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
  if (overlayKey === "parking") {
    return [formatParkingOverlay(properties)].filter(Boolean);
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

function AdvancedRawData({ mainProperties, overlays }) {
  return (
    <details className="advanced-details">
      <summary>Advanced raw data</summary>
      <div className="advanced-section">
        <h3>Main zoning raw fields</h3>
        <RawProperties properties={mainProperties} />
      </div>
      {OVERLAY_SECTIONS.map(([key, title]) => (
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
      ))}
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

function SharedFooter() {
  return (
    <>
      <div className="source-box">
        <span>Source</span>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer">
          City of Toronto Zoning By-law Open Data
        </a>
      </div>
      <Disclaimer />
    </>
  );
}

function EmptyPanel() {
  return (
    <div className="empty-state">
      <p>
        Search a Toronto address or click a zoning polygon to see zoning
        requirements, overlays, by-law references, and raw data.
      </p>
    </div>
  );
}

export default function ZoningPanel({ zone }) {
  const properties = zone?.main?.properties;

  if (zone?.no_result) {
    return (
      <aside className="zoning-panel" aria-label="Selected zoning details">
        <div className="panel-header">
          <p className="eyebrow">Toronto zoning lookup</p>
          <h1 className="zoning-title">No zoning polygon found</h1>
        </div>
        {zone.selected_address ? (
          <div className="selected-address">
            Selected address: {zone.selected_address.address_label}
          </div>
        ) : null}
        <SectionCard title="Result">
          <p className="no-result">
            No zoning polygon was found for this point. Try another address or
            click a nearby zoning polygon.
          </p>
        </SectionCard>
        <SharedFooter />
      </aside>
    );
  }

  if (!properties) {
    return (
      <aside className="zoning-panel" aria-label="Selected zoning details">
        <div className="panel-header">
          <p className="eyebrow">Toronto zoning lookup</p>
          <h1 className="zoning-title">Select a location</h1>
        </div>
        <EmptyPanel />
        <SharedFooter />
      </aside>
    );
  }

  const overlays = zone?.overlays ?? {};
  const parsed = parseZoningString(properties.zone_string);
  const zoneTitle = getZoneTitle(properties);
  const density = getDensity(properties);
  const maxHeight = getMaxHeight(overlays);
  const parkingZone = getParkingZone(overlays);
  const exceptionNumber = getExceptionNumber(properties);
  const lotCoverage = getLotCoverage(overlays);
  const parkingDisplay = parkingZone
    ? parkingZone.toLowerCase().startsWith("zone")
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
  ];
  const bylawRows = [
    ["Chapter", properties.bylaw_chapter],
    ["Section", properties.bylaw_section],
    ["Exception reference", properties.exception_reference],
  ];
  const hasParsedRows = parsedRows.some(([, value]) => isDisplayableValue(value));
  const hasLotRows = lotRows.some(([, value]) => isDisplayableValue(value));
  const hasBylawRows = bylawRows.some(([, value]) => isDisplayableValue(value));
  const hasMatchedOverlay = OVERLAY_SECTIONS.some(([key]) =>
    (overlays[key] ?? []).some(
      (item) => getUsefulOverlayFacts(key, item).length > 0,
    ),
  );

  return (
    <aside className="zoning-panel" aria-label="Selected zoning details">
      <div className="panel-header">
        <p className="eyebrow">Toronto zoning lookup</p>
        <h1 className="zoning-title">{zoneTitle}</h1>
      </div>

      {zone?.selected_address ? (
        <div className="selected-address">
          Selected address: {zone.selected_address.address_label}
        </div>
      ) : null}

      <section className="zoning-summary-card">
        <h2>Summary</h2>
        <p>{buildPlainEnglishSummary(properties, overlays)}</p>
      </section>

      <SectionCard title="Key Requirements / Development Snapshot">
        <div className="requirements-grid">
          <RequirementCard label="Zone" value={zoneTitle} />
          <RequirementCard label="Density" value={density ? `${density} FSI` : ""} />
          <RequirementCard
            label="Maximum Height"
            value={maxHeight ? `${maxHeight} m` : ""}
          />
          <RequirementCard
            label="Parking Zone"
            value={parkingDisplay}
          />
          <RequirementCard
            label="Site-specific Exception"
            value={exceptionNumber}
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
            {OVERLAY_SECTIONS.map(([key, title]) => (
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

      <AdvancedRawData mainProperties={properties} overlays={overlays} />
      <SharedFooter />
    </aside>
  );
}
