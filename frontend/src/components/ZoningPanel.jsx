import React from "react";
import Disclaimer from "./Disclaimer.jsx";
import {
  buildPlainEnglishSummary,
  cleanDisplayValue,
  formatLabel,
  formatParsedZoning,
  formatParkingOverlay,
  getHeightOverlayText,
  getZoneName,
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

function DetailRow({ label, value }) {
  const displayValue = cleanDisplayValue(value);
  if (!displayValue) {
    return null;
  }

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{displayValue}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="panel-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function KeyValueList({ rows }) {
  const visibleRows = rows.filter(([, value]) => isDisplayableValue(value));

  if (!visibleRows.length) {
    return <p className="no-match">No displayable values found.</p>;
  }

  return (
    <dl className="detail-list">
      {visibleRows.map(([label, value]) => (
        <DetailRow key={label} label={label} value={value} />
      ))}
    </dl>
  );
}

function readableOverlayFacts(overlayKey, properties) {
  if (overlayKey === "height") {
    return [getHeightOverlayText(properties)].filter(Boolean);
  }

  if (overlayKey === "lot_coverage") {
    return [parseLotCoverageOverlay(properties)].filter(Boolean);
  }

  if (overlayKey === "parking") {
    return [formatParkingOverlay(properties)].filter(Boolean);
  }

  return [];
}

function OverlayMatch({ properties, index, overlayKey }) {
  const readableFacts = readableOverlayFacts(overlayKey, properties);
  const entries = Object.entries(properties ?? {}).filter(
    ([key, value]) => key !== "geometry" && isDisplayableValue(value),
  );

  if (!entries.length && !readableFacts.length) {
    return null;
  }

  return (
    <div className="overlay-match">
      <h3>Match {index + 1}</h3>
      {readableFacts.map((fact) => (
        <p className="readable-fact" key={fact}>
          {fact}
        </p>
      ))}
      {entries.length ? (
        <details className="mini-details">
          <summary>Raw matched fields</summary>
          <RawProperties properties={properties} />
        </details>
      ) : null}
    </div>
  );
}

function OverlaySection({ title, matches, overlayKey }) {
  const visibleMatches = (matches ?? []).filter((properties) =>
    Object.entries(properties ?? {}).some(
      ([key, value]) => key !== "geometry" && isDisplayableValue(value),
    ),
  );

  return (
    <section className="overlay-section">
      <h3>{title}</h3>
      {visibleMatches.length ? (
        visibleMatches.map((properties, index) => (
          <OverlayMatch
            key={`${title}-${index}`}
            properties={properties}
            index={index}
            overlayKey={overlayKey}
          />
        ))
      ) : (
        <p className="no-match">No matching overlay found.</p>
      )}
    </section>
  );
}

function AdvancedRawDetails({ mainProperties, overlays }) {
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

function EmptyPanel() {
  return (
    <div className="empty-state">
      <p>
        Search a Toronto address or click a zoning polygon to combine the main
        zoning record with matching zoning overlays at that point.
      </p>

      <section className="start-guide">
        <h2>Main zoning area</h2>
        <ul>
          <li>Plain-English zoning summary</li>
          <li>Readable zone name and raw zone code</li>
          <li>Parsed density, frontage, lot area, units, and exceptions</li>
          <li>By-law chapter, section, and exception reference</li>
        </ul>
      </section>

      <section className="start-guide">
        <h2>Overlay data checked</h2>
        <ul>
          <li>Height Overlay, including maximum permitted height</li>
          <li>Lot Coverage Overlay, including maximum lot coverage</li>
          <li>Parking Zone Overlay</li>
          <li>Policy Area and Policy Road overlays</li>
          <li>Priority Retail Street and Rooming House overlays</li>
          <li>Building Setback Overlay</li>
        </ul>
      </section>
    </div>
  );
}

export default function ZoningPanel({ zone }) {
  const properties = zone?.main?.properties;
  const parsedZoning = parseZoningString(properties?.zone_string);
  const parsedRows = formatParsedZoning(parsedZoning);
  const zoneCode = cleanDisplayValue(properties?.zone_code || parsedZoning.zoneCode);
  const zoneName = getZoneName(zoneCode);
  const summary = properties
    ? buildPlainEnglishSummary(properties, zone?.overlays ?? {})
    : "";

  return (
    <aside className="zoning-panel" aria-label="Selected zoning details">
      <div className="panel-header">
        <p className="eyebrow">Toronto zoning lookup</p>
        <h1>{zoneCode ? `${zoneCode} - ${zoneName}` : "Select a location"}</h1>
      </div>

      {zone?.selected_address ? (
        <div className="selected-address">
          Selected address: {zone.selected_address.address_label}
        </div>
      ) : null}

      {zone?.no_result ? (
        <>
          <Section title="No zoning polygon found">
            <p className="no-result">
              No zoning polygon was found for this address point. Try another
              nearby address or click the map directly.
            </p>
          </Section>
          <SharedFooter />
        </>
      ) : properties ? (
        <>
          <Section title="Plain-English Summary">
            <div className="summary-box">
              <p>{summary}</p>
            </div>
          </Section>

          <Section title="Main Zoning">
            <KeyValueList
              rows={[
                ["Zone code", zoneCode ? `${zoneCode} - ${zoneName}` : ""],
                ["Full zoning string", properties.zone_string],
              ]}
            />
          </Section>

          <Section title="Parsed Zoning Rules">
            <KeyValueList rows={parsedRows} />
          </Section>

          <Section title="Lot/Building Standards">
            <KeyValueList
              rows={[
                ["Minimum frontage field", properties.frontage ? `${properties.frontage} m` : ""],
                ["Minimum lot area field", properties.lot_area ? `${properties.lot_area} m²` : ""],
                ["Coverage", properties.coverage],
              ]}
            />
          </Section>

          <Section title="Overlays">
            <div className="overlay-sections">
              {OVERLAY_SECTIONS.map(([key, title]) => (
                <OverlaySection
                  key={key}
                  title={title}
                  overlayKey={key}
                  matches={zone.overlays?.[key]}
                />
              ))}
            </div>
          </Section>

          <Section title="By-law References">
            <KeyValueList
              rows={[
                ["By-law chapter", properties.bylaw_chapter],
                ["By-law section", properties.bylaw_section],
                ["Exception number", parsedZoning.exceptionNumber || properties.exception_number],
                ["Exception reference", properties.exception_reference],
              ]}
            />
          </Section>

          <div className="clicked-point">
            Selected point: {zone.clicked_point.lat.toFixed(6)},{" "}
            {zone.clicked_point.lng.toFixed(6)}
          </div>

          <AdvancedRawDetails
            mainProperties={properties}
            overlays={zone.overlays}
          />

          <SharedFooter />
        </>
      ) : (
        <>
          <EmptyPanel />
          <SharedFooter />
        </>
      )}
    </aside>
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
