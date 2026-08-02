import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ fleet: [], quadTreeNodesCount: 16 });
  const [radiusKm, setRadiusKm] = useState(3);
  const [searchResults, setSearchResults] = useState(null);

  const fetchFleet = async () => {
    try {
      const res = await fetch("http://localhost:5013/api/fleet");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleRadiusSearch = async () => {
    try {
      const res = await fetch("http://localhost:5013/api/fleet/radius-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerLat: 37.7749, centerLng: -122.4194, radiusKm: Number(radiusKm) }),
      });
      const result = await res.json();
      if (result.success) setSearchResults(result);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="geo-container">
      <header>
        <div>
          <h1>📍 Geo-Spatial QuadTree & Fleet Location Tracker</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Geohash Precision Indexing & Real-Time Moving Vehicle GPS Updates
          </p>
        </div>
      </header>

      {/* Interactive Map Visualizer Canvas */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>2D Map Fleet Coordinates (San Francisco Region)</h3>
        <div className="map-canvas">
          {/* QuadTree Bounding Box Dividers */}
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px stroke #21262d", borderStyle: "dashed" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px stroke #21262d", borderStyle: "dashed" }} />

          {/* Center Radius Circle */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: `${radiusKm * 60}px`, height: `${radiusKm * 60}px`, border: "2px solid #58a6ff", borderRadius: "50%", backgroundColor: "rgba(88, 166, 255, 0.15)" }} />

          {/* Vehicle Markers */}
          {data.fleet.map((v) => {
            const x = ((v.lng + 122.44) / 0.08) * 100;
            const y = ((37.79 - v.lat) / 0.04) * 100;
            return (
              <div
                key={v.id}
                style={{ position: "absolute", left: `${Math.max(5, Math.min(90, x))}%`, top: `${Math.max(5, Math.min(90, y))}%`, transform: "translate(-50%, -50%)", textAlign: "center" }}
              >
                <div style={{ width: "16px", height: "16px", backgroundColor: v.status === "AVAILABLE" ? "#238636" : v.status === "ON_TRIP" ? "#f59e0b" : "#8b949e", borderRadius: "50%", margin: "0 auto", border: "2px solid #fff" }} />
                <div style={{ fontSize: "0.7rem", color: "#c9d1d9", fontWeight: "bold" }}>{v.id}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        {/* Radius Spatial Search Tool */}
        <div className="card">
          <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>🔍 Spatial Radius Query ("Find Drivers")</h3>
          <label style={{ fontSize: "0.8rem", color: "#8b949e" }}>Search Radius (km)</label>
          <input
            type="number"
            className="btn"
            style={{ background: "#0d1117", border: "1px solid #30363d", color: "#fff", width: "100%", marginBottom: "1rem" }}
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value)}
          />
          <button className="btn" style={{ width: "100%" }} onClick={handleRadiusSearch}>
            Execute Spatial QuadTree Search
          </button>

          {searchResults && (
            <div style={{ marginTop: "1rem", padding: "0.8rem", background: "#0d1117", borderRadius: "6px", fontSize: "0.85rem" }}>
              <div style={{ color: "#238636", fontWeight: "bold" }}>Found {searchResults.vehiclesFound} drivers within {radiusKm} km radius</div>
            </div>
          )}
        </div>

        {/* Fleet Roster Table */}
        <div className="card">
          <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Fleet Roster & Geohash Grid</h3>
          {data.fleet.map((v) => (
            <div key={v.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <div>
                <strong>{v.id}</strong> ({v.driver})
                <div style={{ color: "#8b949e", fontSize: "0.75rem" }}>Geohash: {v.geohash}</div>
              </div>
              <span style={{ color: v.status === "AVAILABLE" ? "#238636" : "#f59e0b", fontWeight: "bold" }}>{v.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
