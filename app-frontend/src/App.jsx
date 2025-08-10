import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Map from "./pages/Map";
import Gmap from "./pages/Gmap";
import Log from "./pages/Log";
export default function App() {
  return (
    <Router>
      <nav>
        <Link to="/">Home</Link> |{" "}
        <Link to="/map">Map</Link> |{" "}
        <Link to="/gmap">Gmap</Link> |{" "}
        <Link to="/log">Log</Link>

      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/gmap" element={<Gmap />} />
        <Route path="/log" element={<Log />} />
      
      </Routes>
    </Router>
  );
}

