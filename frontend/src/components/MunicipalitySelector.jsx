import React from "react";
import { MUNICIPALITIES } from "../config/municipalities.js";

export default function MunicipalitySelector({
  selectedMunicipality,
  onMunicipalityChange,
}) {
  return (
    <div className="municipality-selector">
      <label htmlFor="municipality-select">Municipality</label>
      <select
        id="municipality-select"
        className="municipality-select"
        value={selectedMunicipality}
        onChange={(event) => onMunicipalityChange(event.target.value)}
      >
        {Object.values(MUNICIPALITIES).map((municipality) => (
          <option key={municipality.id} value={municipality.id}>
            {municipality.name}
          </option>
        ))}
      </select>
    </div>
  );
}
