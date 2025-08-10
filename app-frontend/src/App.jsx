import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Map from "./pages/Map";
import Log from "./pages/Log";
import Gmap from "./pages/Gmap";
export default function App() {
  return (
    <Router>
      <nav>
        <Link to="/">Home</Link> |{" "}
        <Link to="/map">Map</Link> |{" "}
        <Link to="/log">Log</Link>
        <Link to="/gmap">Gmap</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/log" element={<Log />} />
        <Route path="/gmap" element={<Gmap />} />
      </Routes>
    </Router>
  );
}

