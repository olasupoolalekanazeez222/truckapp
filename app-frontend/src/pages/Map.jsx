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
// routing machine CSS is imported globally in main.jsx

// fix default marker icons (important)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl: iconShadow,
});

// Basic location search (Nominatim)
function LocationSearch({ label, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}`
        );
        const data = await res.json();
        if (alive) setResults(data);
      } catch (e) {
        console.error("Nominatim error", e);
      }
    })();
    return () => (alive = false);
  }, [query]);

  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
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
            maxHeight: 180,
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

// small helper to invalidate size when center changes so map isn't grey
function MapAutoResize({ center }) {
  const map = useMap();
  useEffect(() => {
    // center can be [lat, lon]
    if (!map) return;
    map.invalidateSize();
    if (center) {
      map.setView(center);
    }
    // slight delay to ensure tiles load
    // eslint-disable-next-line
  }, [center, map]);
  return null;
}

export default function Map() {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);

  const [currentPos, setCurrentPos] = useState(null);
  const [positions, setPositions] = useState([]);

  // motion tracking refs (persisted to localStorage)
  const lastPos = useRef(null);
  const motionStart = useRef(null);
  const nonMotionStart = useRef(null);
  const motionIntervals = useRef([]);
  const nonMotionIntervals = useRef([]);
  const journeyStart = useRef(Date.now());

  // load saved
  useEffect(() => {
    const sM = localStorage.getItem("motionIntervals");
    const sN = localStorage.getItem("nonMotionIntervals");
    const sJ = localStorage.getItem("journeyStart");
    if (sM) motionIntervals.current = JSON.parse(sM);
    if (sN) nonMotionIntervals.current = JSON.parse(sN);
    if (sJ) journeyStart.current = parseInt(sJ, 10);
  }, []);

  // persist periodically
  useEffect(() => {
    const id = setInterval(() => {
      localStorage.setItem("motionIntervals", JSON.stringify(motionIntervals.current));
      localStorage.setItem("nonMotionIntervals", JSON.stringify(nonMotionIntervals.current));
      localStorage.setItem("journeyStart", String(journeyStart.current));
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // geolocation watch & motion detection
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const motionThreshold = 10; // meters
    const nonMotionMin = 15 * 60 * 1000; // 15 minutes

    function distanceMeters(p1, p2) {
      const R = 6371e3;
      const φ1 = (p1.lat * Math.PI) / 180;
      const φ2 = (p2.lat * Math.PI) / 180;
      const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
      const Δλ = ((p2.lon - p1.lon) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    function updateIntervals(motionSec, nonMotionSec) {
      const elapsedMs = Date.now() - journeyStart.current;
      const dayIdx = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
      while (motionIntervals.current.length <= dayIdx) motionIntervals.current.push(0);
      while (nonMotionIntervals.current.length <= dayIdx) nonMotionIntervals.current.push(0);
      motionIntervals.current[dayIdx] += motionSec / 3600;
      nonMotionIntervals.current[dayIdx] += nonMotionSec / 3600;
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

        const d = distanceMeters(lastPos.current, newPos);
        const now = Date.now();

        if (!motionStart.current && !nonMotionStart.current) {
          motionStart.current = now;
          nonMotionStart.current = null;
        } else {
          if (d >= motionThreshold) {
            // moved
            if (nonMotionStart.current) {
              const nmDur = now - nonMotionStart.current;
              if (nmDur >= nonMotionMin) updateIntervals(0, nmDur / 1000);
              nonMotionStart.current = null;
            }
            motionStart.current = now;
          } else {
            // stationary
            if (motionStart.current) {
              const mDur = now - motionStart.current;
              updateIntervals(mDur / 1000, 0);
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
        console.error("geolocation err", err);
      },
      { enableHighAccuracy: true, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // center fallback
  const center = pickup ? [pickup.lat, pickup.lon] : currentPos ? [currentPos.lat, currentPos.lon] : [0, 0];

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 12 }}>
      <h2>Leaflet OSM Journey Tracker</h2>

      <div style={{ maxWidth: 480 }}>
        <LocationSearch label="Pickup" onSelect={setPickup} />
        {pickup && <div>Pickup: {pickup.name}</div>}
        <LocationSearch label="Dropoff" onSelect={setDropoff} />
        {dropoff && <div>Dropoff: {dropoff.name}</div>}
      </div>

      <div style={{ marginTop: 12 }}>
        <MapContainer center={center} zoom={13} style={{ height: "450px", width: "100%" }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pickup && <Marker position={[pickup.lat, pickup.lon]} />}
          {dropoff && <Marker position={[dropoff.lat, dropoff.lon]} />}
          {currentPos && <Marker position={[currentPos.lat, currentPos.lon]} />}
          {positions.length > 1 && (
            <Polyline positions={positions.map((p) => [p.lat, p.lng])} pathOptions={{ color: "red" }} />
          )}

          <MapAutoResize center={center} />

          {/* RoutingControl: lazy load leaflet-routing-machine in the browser */}
          {pickup && dropoff && <RoutingControl pickup={pickup} dropoff={dropoff} />}
        </MapContainer>
      </div>
    </div>
  );
}

// Component that lazy-loads leaflet-routing-machine to avoid SSR/bundle issues
function RoutingControl({ pickup, dropoff }) {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!pickup || !dropoff || !map) return;

    let active = true;
    // dynamic import so Vite doesn't try to bundle it server-side wrongly
    import("leaflet-routing-machine")
      .then(() => {
        if (!active) return;
        // create control (L.Routing available globally after import)
        routingRef.current = L.Routing.control({
          waypoints: [L.latLng(pickup.lat, pickup.lon), L.latLng(dropoff.lat, dropoff.lon)],
          lineOptions: { styles: [{ color: "blue", weight: 4 }] },
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          showAlternatives: false,
        }).addTo(map);
      })
      .catch((err) => {
        console.error("Error loading routing machine:", err);
      });

    return () => {
      active = false;
      if (routingRef.current && map) map.removeControl(routingRef.current);
    };
  }, [pickup, dropoff, map]);

  return null;
}
