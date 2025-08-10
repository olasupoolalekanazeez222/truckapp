import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl: iconShadow,
});

// Autocomplete component (same as before)
function LocationSearch({ label, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    const fetchData = async () => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data);
    };
    fetchData();
  }, [query]);

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      <label>{label}</label>
      <input
        type="text"
        placeholder={`Search ${label}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: "100%", padding: 8, fontSize: 16 }}
      />
      {results.length > 0 && (
        <ul
          style={{
            position: "absolute",
            background: "white",
            border: "1px solid #ccc",
            maxHeight: 150,
            overflowY: "auto",
            width: "100%",
            zIndex: 1000,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {results.map((place) => (
            <li
              key={place.place_id}
              onClick={() => {
                onSelect({
                  name: place.display_name,
                  lat: parseFloat(place.lat),
                  lon: parseFloat(place.lon),
                });
                setQuery(place.display_name);
                setResults([]);
              }}
              style={{ padding: 8, cursor: "pointer" }}
            >
              {place.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Routing({ pickup, dropoff }) {
  const map = useMap();

  useEffect(() => {
    if (!pickup || !dropoff) return;

    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(pickup.lat, pickup.lon),
        L.latLng(dropoff.lat, dropoff.lon),
      ],
      lineOptions: {
        styles: [{ color: "blue", weight: 4 }],
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
    }).addTo(map);

    return () => map.removeControl(routingControl);
  }, [pickup, dropoff, map]);

  return null;
}

// Helper: Calculate distance between two lat/lng points in meters
function distanceMeters(pos1, pos2) {
  const R = 6371e3; // meters
  const φ1 = (pos1.lat * Math.PI) / 180;
  const φ2 = (pos2.lat * Math.PI) / 180;
  const Δφ = ((pos2.lat - pos1.lat) * Math.PI) / 180;
  const Δλ = ((pos2.lon - pos1.lon) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function Map() {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);

  const [currentPos, setCurrentPos] = useState(null);
  const [positions, setPositions] = useState([]);

  // Motion tracking refs
  const lastPos = useRef(null);
  const motionStart = useRef(null);
  const nonMotionStart = useRef(null);
  const motionIntervals = useRef([]);
  const nonMotionIntervals = useRef([]);
  const journeyStart = useRef(Date.now());

  // Load saved intervals and journeyStart on mount
  useEffect(() => {
    const savedMotion = localStorage.getItem("motionIntervals");
    const savedNonMotion = localStorage.getItem("nonMotionIntervals");
    const savedJourneyStart = localStorage.getItem("journeyStart");

    if (savedMotion) motionIntervals.current = JSON.parse(savedMotion);
    if (savedNonMotion) nonMotionIntervals.current = JSON.parse(savedNonMotion);
    if (savedJourneyStart) journeyStart.current = parseInt(savedJourneyStart, 10);
  }, []);

  // Save intervals to localStorage every 10 seconds (or you can do on unload)
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem("motionIntervals", JSON.stringify(motionIntervals.current));
      localStorage.setItem("nonMotionIntervals", JSON.stringify(nonMotionIntervals.current));
      localStorage.setItem("journeyStart", journeyStart.current.toString());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Geolocation tracking: update current position and classify motion/non-motion
  useEffect(() => {
    if (!navigator.geolocation) return;

    const motionThresholdMeters = 10; // distance to count as motion
    const nonMotionMinimumMs = 15 * 60 * 1000; // 15 minutes stationary threshold

    function updateIntervals(motionSec, nonMotionSec) {
      const elapsedMs = Date.now() - journeyStart.current;
      const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

      while (motionIntervals.current.length <= elapsedDays) motionIntervals.current.push(0);
      while (nonMotionIntervals.current.length <= elapsedDays) nonMotionIntervals.current.push(0);

      motionIntervals.current[elapsedDays] += motionSec / 3600; // convert sec to hours
      nonMotionIntervals.current[elapsedDays] += nonMotionSec / 3600;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCurrentPos(newPos);
        setPositions((prev) => [...prev, { lat: newPos.lat, lng: newPos.lon }]);

        if (!lastPos.current) {
          lastPos.current = newPos;
          motionStart.current = Date.now();
          nonMotionStart.current = null;
          return;
        }

        const dist = distanceMeters(lastPos.current, newPos);
        const now = Date.now();

        if (!motionStart.current && !nonMotionStart.current) {
          motionStart.current = now;
          nonMotionStart.current = null;
        } else {
          if (dist >= motionThresholdMeters) {
            // User is moving
            if (nonMotionStart.current) {
              const nonMotionDuration = now - nonMotionStart.current;
              if (nonMotionDuration >= nonMotionMinimumMs) {
                updateIntervals(0, nonMotionDuration / 1000);
              }
              nonMotionStart.current = null;
              motionStart.current = now;
            }
          } else {
            // User stationary
            if (motionStart.current) {
              const motionDuration = now - motionStart.current;
              updateIntervals(motionDuration / 1000, 0);
              motionStart.current = null;
              nonMotionStart.current = now;
            } else if (!nonMotionStart.current) {
              nonMotionStart.current = now;
            }
          }
        }

        lastPos.current = newPos;
      },
      (err) => {
        console.error("Geolocation error:", err);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Center map on pickup, current position, or fallback
  const center = pickup
    ? [pickup.lat, pickup.lon]
    : currentPos
    ? [currentPos.lat, currentPos.lon]
    : [0, 0];

  return (
    <div style={{ maxWidth: 700, margin: "auto", padding: 20 }}>
      <h2>Leaflet OSM Journey Tracker with Motion Tracking</h2>

      <LocationSearch label="Pickup Location" onSelect={setPickup} />
      {pickup && <p>Selected Pickup: {pickup.name}</p>}

      <LocationSearch label="Dropoff Location" onSelect={setDropoff} />
      {dropoff && <p>Selected Dropoff: {dropoff.name}</p>}

      <MapContainer center={center} zoom={13} style={{ height: 450, width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pickup && <Marker position={[pickup.lat, pickup.lon]} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lon]} />}
        {currentPos && <Marker position={[currentPos.lat, currentPos.lon]} />}

        {positions.length > 1 && (
          <Polyline positions={positions.map((p) => [p.lat, p.lng])} color="red" />
        )}

        {pickup && dropoff && <Routing pickup={pickup} dropoff={dropoff} />}
      </MapContainer>
    </div>
  );
}
