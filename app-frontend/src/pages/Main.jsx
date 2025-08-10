import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // or your App entry file
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "./index.css"; // your global styles (optional)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

