import React, { useState } from "react";
import MapView from "./components/MapView.jsx";
import ZoningPanel from "./components/ZoningPanel.jsx";
import { DEFAULT_MUNICIPALITY_ID } from "./config/municipalities.js";

export default function App() {
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(
    DEFAULT_MUNICIPALITY_ID,
  );

  const handleMunicipalityChange = (municipalityId) => {
    setSelectedMunicipality(municipalityId);
    setSelectedZone(null);
  };

  return (
    <main className="app-shell">
      <section className="map-section" aria-label="Municipal zoning map">
        <MapView
          selectedMunicipality={selectedMunicipality}
          onMunicipalityChange={handleMunicipalityChange}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
        />
      </section>
      <ZoningPanel
        zone={selectedZone}
        selectedMunicipality={selectedMunicipality}
      />
    </main>
  );
}
