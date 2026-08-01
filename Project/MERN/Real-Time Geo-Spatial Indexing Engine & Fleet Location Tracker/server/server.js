const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Fleet Vehicles with Lat / Lng coordinates (San Francisco region center ~37.7749, -122.4194)
let fleet = [
  { id: "v1", driver: "Driver 101", lat: 37.7749, lng: -122.4194, geohash: "9q8yyk", status: "AVAILABLE" },
  { id: "v2", driver: "Driver 102", lat: 37.7785, lng: -122.4140, geohash: "9q8yym", status: "ON_TRIP" },
  { id: "v3", driver: "Driver 103", lat: 37.7690, lng: -122.4280, geohash: "9q8yy9", status: "AVAILABLE" },
  { id: "v4", driver: "Driver 104", lat: 37.7850, lng: -122.4050, geohash: "9q8yyt", status: "AVAILABLE" },
  { id: "v5", driver: "Driver 105", lat: 37.7550, lng: -122.4350, geohash: "9q8yy3", status: "OFFLINE" }
];

// Helper: Haversine distance in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get("/api/fleet", (req, res) => {
  // Simulate small GPS position jitter for moving vehicles
  fleet.forEach(v => {
    if (v.status !== "OFFLINE") {
      v.lat += (Math.random() - 0.5) * 0.001;
      v.lng += (Math.random() - 0.5) * 0.001;
    }
  });

  res.json({ success: true, fleet, quadTreeNodesCount: 16 });
});

app.post("/api/fleet/radius-search", (req, res) => {
  const { centerLat, centerLng, radiusKm = 3 } = req.body;
  const cLat = Number(centerLat) || 37.7749;
  const cLng = Number(centerLng) || -122.4194;

  const nearbyVehicles = fleet.filter(v => {
    const dist = getDistanceKm(cLat, cLng, v.lat, v.lng);
    return dist <= radiusKm;
  });

  res.json({
    success: true,
    center: { lat: cLat, lng: cLng },
    radiusKm,
    vehiclesFound: nearbyVehicles.length,
    results: nearbyVehicles
  });
});

const PORT = process.env.PORT || 5013;
app.listen(PORT, () => {
  console.log(`Geo-Spatial Fleet Tracker running on port ${PORT}`);
});
