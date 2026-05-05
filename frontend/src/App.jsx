import React, { useState } from "react";
import MapView from "./components/MapView.jsx";
import ZoningPanel from "./components/ZoningPanel.jsx";

export default function App() {
  const [selectedZone, setSelectedZone] = useState(null);

  return (
    <main className="app-shell">
      <section className="map-section" aria-label="Toronto zoning map">
        <MapView selectedZone={selectedZone} onSelectZone={setSelectedZone} />
      </section>
      <ZoningPanel zone={selectedZone} />
    </main>
  );
}
