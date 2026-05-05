import React from "react";
import Disclaimer from "./Disclaimer.jsx";
import {
  formatLabel,
  formatParsedZoning,
  getHeightOverlayText,
  getZoneName,
  isDisplayableValue,
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

function displayValue(value, fallback = "Not listed") {
  return isDisplayableValue(value) ? value : fallback;
}

function DetailRow({ label, value }) {
  if (!isDisplayableValue(value)) {
    return null;
  }

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{displayValue(value)}</dd>
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

function OverlayMatch({ properties, index, isHeight }) {
  const heightText = isHeight ? getHeightOverlayText(properties) : "";
  const entries = Object.entries(properties ?? {}).filter(
    ([key, value]) => key !== "geometry" && isDisplayableValue(value),
  );

  if (!entries.length && !heightText) {
    return null;
  }

  return (
    <div className="overlay-match">
      <h3>Match {index + 1}</h3>
      {heightText ? <p className="readable-fact">{heightText}</p> : null}
      {entries.length ? (
        <dl className="overlay-list">
          {entries.map(([key, value]) => (
            <div className="overlay-row" key={key}>
              <dt>{formatLabel(key)}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
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
            isHeight={overlayKey === "height"}
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
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="no-match">No displayable values found.</p>
      )}
    </div>
  );
}

export default function ZoningPanel({ zone }) {
  const properties = zone?.main?.properties;
  const parsedZoning = parseZoningString(properties?.zone_string);
  const parsedRows = formatParsedZoning(parsedZoning);
  const zoneName = getZoneName(properties?.zone_code);
  const heightMatches = zone?.overlays?.height ?? [];
  const heightText = heightMatches.map(getHeightOverlayText).find(Boolean);

  return (
    <aside className="zoning-panel" aria-label="Selected zoning details">
      <div className="panel-header">
        <p className="eyebrow">Toronto zoning lookup</p>
        <h1>
          {properties?.zone_code
            ? `${properties.zone_code} - ${zoneName}`
            : "Select a zoning area"}
        </h1>
      </div>

      {properties ? (
        <>
          <Section title="Summary">
            <div className="summary-box">
              <p>
                This point is in the {zoneName}{" "}
                <strong>({properties.zone_code})</strong>.
              </p>
              {properties.zone_string ? (
                <p>Full zoning string: {properties.zone_string}</p>
              ) : null}
              {parsedRows.length ? (
                <ul className="summary-list">
                  {parsedRows.map(([label, value]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
              {heightText ? <p>{heightText}</p> : null}
            </div>
          </Section>

          <Section title="Main Zoning">
            <KeyValueList
              rows={[
                ["Zone code", `${properties.zone_code} - ${zoneName}`],
                ["Full zoning string", properties.zone_string],
              ]}
            />
          </Section>

          <Section title="Lot/Building Standards">
            <KeyValueList
              rows={[
                ["Density / FSI from zoning string", parsedZoning.density],
                ["Minimum frontage from zoning string", parsedZoning.frontage ? `${parsedZoning.frontage} m` : ""],
                ["Minimum lot area from zoning string", parsedZoning.lotArea ? `${parsedZoning.lotArea} m2` : ""],
                ["Minimum frontage field", properties.frontage ? `${properties.frontage} m` : ""],
                ["Minimum lot area field", properties.lot_area ? `${properties.lot_area} m2` : ""],
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
            Clicked point: {zone.clicked_point.lat.toFixed(6)},{" "}
            {zone.clicked_point.lng.toFixed(6)}
          </div>

          <AdvancedRawDetails
            mainProperties={properties}
            overlays={zone.overlays}
          />

          <div className="source-box">
            <span>Source</span>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              City of Toronto Zoning By-law Open Data
            </a>
          </div>

          <Disclaimer />
        </>
      ) : (
        <div className="empty-state">
          <p>
            Click a zoning polygon on the map to combine the main zoning area
            record with matching zoning overlays at that point.
          </p>

          <section className="start-guide">
            <h2>Main zoning area</h2>
            <ul>
              <li>Readable zone name and raw zone code</li>
              <li>Full zoning string</li>
              <li>Parsed density / FSI</li>
              <li>Parsed minimum frontage</li>
              <li>Parsed minimum lot area</li>
              <li>Parsed site-specific exception</li>
              <li>By-law chapter, section, and exception reference</li>
            </ul>
          </section>

          <section className="start-guide">
            <h2>Overlay data checked</h2>
            <ul>
              <li>Height Overlay, including maximum permitted height</li>
              <li>Parking Zone Overlay</li>
              <li>Policy Area Overlay</li>
              <li>Policy Road Overlay</li>
              <li>Priority Retail Street Overlay</li>
              <li>Rooming House Overlay</li>
              <li>Lot Coverage Overlay</li>
              <li>Building Setback Overlay</li>
            </ul>
          </section>

          <div className="source-box">
            <span>Source</span>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              City of Toronto Zoning By-law Open Data
            </a>
          </div>
          <Disclaimer />
        </div>
      )}
    </aside>
  );
}
