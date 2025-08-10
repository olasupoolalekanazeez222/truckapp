import React, { useState, useEffect, useRef } from "react";

const GOOGLE_API_KEY = "AIzaSyBTKT9pnFOyo2Pp-GamlSw1hrcRjIVdrgk"; // <-- replace with your actual key

export default function Map() {
  const [pickupPlace, setPickupPlace] = useState(null);
  const [dropoffPlace, setDropoffPlace] = useState(null);
  const [currentLocation, setCurrentLocation] = useState("");
  const [status, setStatus] = useState("");
  const [journeyInfo, setJourneyInfo] = useState("");
  const [startDisabled, setStartDisabled] = useState(false);
  const [stopDisabled, setStopDisabled] = useState(true);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const directionsService = useRef(null);
  const directionsRenderer = useRef(null);
  const currentMarker = useRef(null);
  const pickupMarker = useRef(null);
  const dropoffMarker = useRef(null);
  const polyline = useRef(null);
  const watchId = useRef(null);

  // Tracking states
  const lastPosition = useRef(null);
  const motionStartTime = useRef(null);
  const nonMotionStartTime = useRef(null);
  const motionIntervals = useRef([]);
  const nonMotionIntervals = useRef([]);
  const journeyStartTime = useRef(null);

  // Google Autocomplete refs
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);
  const pickupAutocomplete = useRef(null);
  const dropoffAutocomplete = useRef(null);

  // Load Google Maps script dynamically
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => {
        initAutocomplete();
        fetchCurrentLocation();
        loadJourneyState();
      };
      document.head.appendChild(script);
    } else {
      initAutocomplete();
      fetchCurrentLocation();
      loadJourneyState();
    }
    // Save state on unload
    window.addEventListener("beforeunload", saveJourneyState);
    return () => {
      window.removeEventListener("beforeunload", saveJourneyState);
      stopTracking();
    };
  }, []);

  // Initialize Places Autocomplete
  function initAutocomplete() {
    if (!window.google || !window.google.maps) return;

    if (pickupInputRef.current) {
      pickupAutocomplete.current = new window.google.maps.places.Autocomplete(
        pickupInputRef.current
      );
      pickupAutocomplete.current.addListener("place_changed", () => {
        const place = pickupAutocomplete.current.getPlace();
        if (!place.geometry) {
          alert("Please select a valid pickup location from suggestions.");
          setPickupPlace(null);
          return;
        }
        setPickupPlace(place);
        localStorage.setItem("pickupPlace", JSON.stringify(place));
      });
    }

    if (dropoffInputRef.current) {
      dropoffAutocomplete.current = new window.google.maps.places.Autocomplete(
        dropoffInputRef.current
      );
      dropoffAutocomplete.current.addListener("place_changed", () => {
        const place = dropoffAutocomplete.current.getPlace();
        if (!place.geometry) {
          alert("Please select a valid dropoff location from suggestions.");
          setDropoffPlace(null);
          return;
        }
        setDropoffPlace(place);
        localStorage.setItem("dropoffPlace", JSON.stringify(place));
      });
    }
  }

  // Fetch current location and update state
  function fetchCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      setCurrentLocation("Not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      },
      () => {
        setCurrentLocation("Permission denied or unavailable");
      }
    );
  }

  // Initialize map centered on given coords
  function initMap(lat, lng) {
    const center = { lat, lng };
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      zoom: 14,
      center,
    });

    directionsService.current = new window.google.maps.DirectionsService();
    directionsRenderer.current = new window.google.maps.DirectionsRenderer({
      map: mapInstance.current,
    });

    currentMarker.current = new window.google.maps.Marker({
      position: center,
      map: mapInstance.current,
      title: "Current Location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#00f",
        fillOpacity: 0.8,
        strokeColor: "#00f",
        strokeWeight: 2,
      },
    });

    polyline.current = new window.google.maps.Polyline({
      path: [center],
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 1.0,
      strokeWeight: 6,
      map: mapInstance.current,
    });
  }

  // Place markers for pickup and dropoff
  function placePickupAndDropoffMarkers() {
    if (pickupMarker.current) pickupMarker.current.setMap(null);
    if (dropoffMarker.current) dropoffMarker.current.setMap(null);

    if (pickupPlace?.geometry?.location) {
      pickupMarker.current = new window.google.maps.Marker({
        position: pickupPlace.geometry.location,
        map: mapInstance.current,
        title: "Pickup Location",
        icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
      });
    }
    if (dropoffPlace?.geometry?.location) {
      dropoffMarker.current = new window.google.maps.Marker({
        position: dropoffPlace.geometry.location,
        map: mapInstance.current,
        title: "Dropoff Location",
        icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
      });
    }
  }

  // Draw route from pickup to dropoff
  function drawRoute() {
    if (!pickupPlace || !dropoffPlace) return;
    directionsService.current.route(
      {
        origin: pickupPlace.geometry.location,
        destination: dropoffPlace.geometry.location,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK") {
          directionsRenderer.current.setDirections(response);
        } else {
          alert("Directions request failed due to " + status);
        }
      }
    );
  }

  // Calculate distance in meters between two points
  function distanceMeters(pos1, pos2) {
    const R = 6371e3; // meters
    const φ1 = (pos1.lat * Math.PI) / 180;
    const φ2 = (pos2.lat * Math.PI) / 180;
    const Δφ = ((pos2.lat - pos1.lat) * Math.PI) / 180;
    const Δλ = ((pos2.lng - pos1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Update motion and non-motion intervals in localStorage & state
  function updateIntervals(motionSeconds, nonMotionSeconds) {
    const motionHours = motionSeconds / 3600;
    const nonMotionHours = nonMotionSeconds / 3600;

    if (!journeyStartTime.current) return;

    const elapsedMs = Date.now() - journeyStartTime.current;
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

    while (motionIntervals.current.length <= elapsedDays)
      motionIntervals.current.push(0);
    while (nonMotionIntervals.current.length <= elapsedDays)
      nonMotionIntervals.current.push(0);

    motionIntervals.current[elapsedDays] += motionHours;
    nonMotionIntervals.current[elapsedDays] += nonMotionHours;

    localStorage.setItem("motion", JSON.stringify(motionIntervals.current));
    localStorage.setItem("nonMotion", JSON.stringify(nonMotionIntervals.current));

    updateJourneyInfo();
  }

  // Update journey info display state
  function updateJourneyInfo() {
    if (!journeyStartTime.current) return;

    const elapsedMs = Date.now() - journeyStartTime.current;
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

    const motionToday =
      motionIntervals.current[elapsedDays]?.toFixed(2) || "0.00";
    const nonMotionToday =
      nonMotionIntervals.current[elapsedDays]?.toFixed(2) || "0.00";

    setJourneyInfo(
      <>
        <p>
          <strong>Journey Duration:</strong>{" "}
          {(elapsedMs / 3600000).toFixed(2)} hours
        </p>
        <p>
          <strong>Day index:</strong> {elapsedDays + 1}
        </p>
        <p>
          <strong>Motion hours today:</strong> {motionToday}
        </p>
        <p>
          <strong>Non-motion hours today:</strong> {nonMotionToday}
        </p>
      </>
    );
  }

  // Handle position update from geolocation
  function onPositionUpdate(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const newPos = { lat, lng };

    setCurrentLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    if (currentMarker.current) currentMarker.current.setPosition(newPos);

    if (polyline.current) {
      const path = polyline.current.getPath();
      path.push(new window.google.maps.LatLng(lat, lng));
    }

    const dist = lastPosition.current ? distanceMeters(lastPosition.current, newPos) : 0;
    const now = Date.now();
    const motionThreshold = 10; // meters

    if (!motionStartTime.current && !nonMotionStartTime.current) {
      motionStartTime.current = now;
      nonMotionStartTime.current = null;
    } else {
      if (dist >= motionThreshold) {
        // User moved
        if (nonMotionStartTime.current) {
          const nonMotionDuration = now - nonMotionStartTime.current;
          if (nonMotionDuration >= 15 * 60 * 1000) {
            updateIntervals(0, nonMotionDuration / 1000);
          }
          nonMotionStartTime.current = null;
          motionStartTime.current = now;
        }
      } else {
        // User stationary
        if (motionStartTime.current) {
          const motionDuration = now - motionStartTime.current;
          updateIntervals(motionDuration / 1000, 0);
          motionStartTime.current = null;
          nonMotionStartTime.current = now;
        } else if (!nonMotionStartTime.current) {
          nonMotionStartTime.current = now;
        }
      }
    }

    lastPosition.current = newPos;

    localStorage.setItem("lastPosition", JSON.stringify(lastPosition.current));

    updateJourneyInfo();
  }

  // Start geolocation tracking
  function startTracking() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported.");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      onPositionUpdate,
      (err) => {
        alert("Error getting location: " + err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }

  // Stop geolocation tracking
  function stopTracking() {
    if (watchId.current !== undefined) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = undefined;
    }
  }

  // Save entire journey state
  function saveJourneyState() {
    if (journeyStartTime.current)
      localStorage.setItem("journeyStartTime", journeyStartTime.current);
    localStorage.setItem("motion", JSON.stringify(motionIntervals.current));
    localStorage.setItem("nonMotion", JSON.stringify(nonMotionIntervals.current));
    localStorage.setItem("lastPosition", JSON.stringify(lastPosition.current));
    localStorage.setItem(
      "pickupPlace",
      pickupPlace ? JSON.stringify(pickupPlace) : ""
    );
    localStorage.setItem(
      "dropoffPlace",
      dropoffPlace ? JSON.stringify(dropoffPlace) : ""
    );
  }

  // Load journey state from localStorage
  function loadJourneyState() {
    const storedStart = localStorage.getItem("journeyStartTime");
    if (storedStart) journeyStartTime.current = parseInt(storedStart);

    const storedMotion = localStorage.getItem("motion");
    if (storedMotion) motionIntervals.current = JSON.parse(storedMotion);
    else motionIntervals.current = [];

    const storedNonMotion = localStorage.getItem("nonMotion");
    if (storedNonMotion) nonMotionIntervals.current = JSON.parse(storedNonMotion);
    else nonMotionIntervals.current = [];

    const storedLastPos = localStorage.getItem("lastPosition");
    if (storedLastPos) lastPosition.current = JSON.parse(storedLastPos);

    const storedPickup = localStorage.getItem("pickupPlace");
    if (storedPickup) {
      try {
        const p = JSON.parse(storedPickup);
        if (p.geometry && p.geometry.location) {
          p.geometry.location = new window.google.maps.LatLng(
            p.geometry.location.lat,
            p.geometry.location.lng
          );
        }
        setPickupPlace(p);
      } catch {
        setPickupPlace(null);
      }
    }

    const storedDropoff = localStorage.getItem("dropoffPlace");
    if (storedDropoff) {
      try {
        const d = JSON.parse(storedDropoff);
        if (d.geometry && d.geometry.location) {
          d.geometry.location = new window.google.maps.LatLng(
            d.geometry.location.lat,
            d.geometry.location.lng
          );
        }
        setDropoffPlace(d);
      } catch {
        setDropoffPlace(null);
      }
    }

    // If journey is ongoing, initialize map & tracking
    if (journeyStartTime.current && lastPosition.current) {
      initMap(lastPosition.current.lat, lastPosition.current.lng);
      placePickupAndDropoffMarkers();
      drawRoute();
      setStartDisabled(true);
      setStopDisabled(false);
      startTracking();
      setStatus("Journey resumed.");
      updateJourneyInfo();
    }
  }

  // Handle start button
  function handleStart() {
    if (!pickupPlace || !pickupPlace.geometry || !dropoffPlace || !dropoffPlace.geometry) {
      alert("Please select valid pickup and dropoff locations from suggestions.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        journeyStartTime.current = Date.now();
        localStorage.clear();

        motionIntervals.current = [];
        nonMotionIntervals.current = [];
        lastPosition.current = { lat: latitude, lng: longitude };
        motionStartTime.current = null;
        nonMotionStartTime.current = null;

        initMap(latitude, longitude);
        placePickupAndDropoffMarkers();
        drawRoute();
        startTracking();

        setStatus("Journey started.");
        setStartDisabled(true);
        setStopDisabled(false);

        saveJourneyState();
        updateJourneyInfo();
      },
      (err) => {
        alert("Unable to get current location: " + err.message);
      }
    );
  }

  // Handle stop button
  function handleStop() {
    stopTracking();
    updateIntervals(0, 0);
    setStatus("Journey stopped.");
    setStartDisabled(false);
    setStopDisabled(true);
    saveJourneyState();
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Full Journey Tracker with Motion & Route</h2>
      <form style={styles.form} onSubmit={(e) => e.preventDefault()}>
        <label style={styles.label}>Current Location (auto detected):</label>
        <input
          style={styles.input}
          type="text"
          readOnly
          value={currentLocation}
          placeholder="Fetching current location..."
        />

        <label style={styles.label}>Pickup Location:</label>
        <input
          ref={pickupInputRef}
          style={styles.input}
          type="text"
          placeholder="Enter pickup location"
          defaultValue={pickupPlace?.name || ""}
        />

        <label style={styles.label}>Dropoff Location:</label>
        <input
          ref={dropoffInputRef}
          style={styles.input}
          type="text"
          placeholder="Enter dropoff location"
          defaultValue={dropoffPlace?.name || ""}
        />

        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={handleStart}
            disabled={startDisabled}
            style={styles.button}
          >
            Start Journey
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={stopDisabled}
            style={{ ...styles.button, backgroundColor: "#a00" }}
          >
            Stop Journey
          </button>
        </div>
      </form>

      <div style={styles.status}>{status}</div>
      <div style={styles.journeyInfo}>{journeyInfo}</div>
      <div ref={mapRef} style={styles.map} />

      <style>{`
        @media (max-width: 600px) {
          div, form, input, button {
            width: 100% !important;
            box-sizing: border-box;
          }
          input {
            font-size: 16px !important;
          }
          button {
            font-size: 18px !important;
            margin-top: 10px !important;
          }
          form {
            padding: 0 10px;
          }
          div#map {
            height: 300px !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    padding: 20,
    maxWidth: 600,
    margin: "auto",
  },
  title: {
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  label: {
    marginTop: 10,
  },
  input: {
    padding: 8,
    fontSize: 16,
    width: 300,
    maxWidth: "100%",
  },
  buttonGroup: {
    display: "flex",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  button: {
    padding: "10px 20px",
    fontSize: 16,
    cursor: "pointer",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    borderRadius: 4,
  },
  status: {
    marginTop: 10,
    fontWeight: "bold",
  },
  journeyInfo: {
    marginTop: 15,
  },
  map: {
    width: "100%",
    height: 450,
    marginTop: 20,
  },
};
