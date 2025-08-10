import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";

const HOURS = 24;
const PX_PER_HOUR = 50; // 1200px grid width
const GRID_WIDTH = HOURS * PX_PER_HOUR;
const TOTALS_COL_X = GRID_WIDTH + 20;
const TOTALS_COL_WIDTH = 160;
const SVG_WIDTH = TOTALS_COL_X + TOTALS_COL_WIDTH + 20;
const SECTION_HEIGHT = 80;
const SECTIONS = ["Off Duty", "Sleeper Berth", "Driving", "On Duty"];
const STORAGE_KEY = "svgLogSegments_v3";
const FONT_FAMILY = "Arial";
const REMARK_FONT_SIZE = 12;
const REMARK_ROW_HEIGHT = 18;
const REMARK_TOP_GAP = 18; // gap below grid before remarks start
const EPS = 0.001;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function eq(a, b) {
  return Math.abs(a - b) < EPS;
}
function snapTo15(hour, min) {
  const total = hour * 60 + min;
  const snapped = Math.round(total / 15) * 15;
  const s = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60);
  return { h: Math.floor(s / 60), m: s % 60 };
}
function timeToX(h, m) {
  return (h + m / 60) * PX_PER_HOUR;
}
function formatHHMMDecimal(decHours) {
  const totalM = Math.round(decHours * 60);
  const hh = Math.floor(totalM / 60);
  const mm = totalM % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function createSVGElement(tag, attrs = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const el = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export default function Log() {
  // State
  const [segments, setSegments] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [formData, setFormData] = useState({
    fromHour: "",
    fromMin: "0",
    toHour: "",
    toMin: "0",
    section: "0",
    remark: "",
  });

  const [meta, setMeta] = useState({
    logDate: "",
    fromLocation: "",
    toLocation: "",
    milesDriving: "",
    totalMileage: "",
    carrierName: "",
    truckNumber: "",
    mainOffice: "",
    homeTerminal: "",
    remarksOutside: "",
    shippingDoc: "",
    shipperCommodity: "",
  });

  const svgRef = useRef(null);
  const printableRef = useRef(null);

  // Save segments to localStorage when updated
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Functions to draw on SVG

  function drawGrid(svg, gridHeight) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("width", SVG_WIDTH);
    svg.setAttribute("height", gridHeight + 200);

    svg.appendChild(
      createSVGElement("rect", { x: 0, y: 0, width: GRID_WIDTH, height: gridHeight, fill: "#fff" })
    );

    SECTIONS.forEach((label, i) => {
      const y = i * SECTION_HEIGHT;
      svg.appendChild(
        createSVGElement("rect", { x: 0, y, width: GRID_WIDTH, height: SECTION_HEIGHT, fill: "none", stroke: "#000" })
      );
      const t = createSVGElement("text", { x: 6, y: y + 16, "font-size": 14, "font-family": FONT_FAMILY });
      t.textContent = label;
      svg.appendChild(t);
    });

    for (let h = 0; h <= HOURS; h++) {
      const x = h * PX_PER_HOUR;
      svg.appendChild(
        createSVGElement("line", { x1: x, y1: 0, x2: x, y2: gridHeight, stroke: "#000", "stroke-width": 1 })
      );
      const lab = createSVGElement("text", { x: x + 2, y: gridHeight + 16, "font-size": 12, "font-family": FONT_FAMILY });
      lab.textContent = h % 24;
      svg.appendChild(lab);

      if (h < HOURS) {
        for (let s = 1; s < 4; s++) {
          const subX = x + PX_PER_HOUR * (s / 4);
          const isMid = s === 2;
          svg.appendChild(
            createSVGElement("line", {
              x1: subX,
              y1: 0,
              x2: subX,
              y2: gridHeight,
              stroke: "#888",
              "stroke-width": isMid ? 1.2 : 0.5,
            })
          );
        }
      }
    }

    const col = createSVGElement("rect", {
      x: TOTALS_COL_X,
      y: 0,
      width: TOTALS_COL_WIDTH,
      height: gridHeight,
      fill: "none",
      stroke: "#000",
    });
    svg.appendChild(col);
    SECTIONS.forEach((label, i) => {
      const y = i * SECTION_HEIGHT;
      svg.appendChild(
        createSVGElement("text", {
          x: TOTALS_COL_X + 8,
          y: y + 18,
          "font-size": 13,
          "font-family": FONT_FAMILY,
        })
      ).textContent = label;
      svg.appendChild(
        createSVGElement("text", {
          id: `total-${i}`,
          x: TOTALS_COL_X + 8,
          y: y + 38,
          "font-size": 14,
          "font-family": FONT_FAMILY,
          "font-weight": "bold",
        })
      );
    });
    svg.appendChild(
      createSVGElement("text", {
        id: "grand-total",
        x: TOTALS_COL_X + 8,
        y: gridHeight - 8,
        "font-size": 14,
        "font-family": FONT_FAMILY,
        "font-weight": "bold",
      })
    );
  }

  function computeTotals(svg) {
    const totals = [0, 0, 0, 0];
    segments.forEach((seg) => {
      const hoursSpan = (seg.toX - seg.fromX) / PX_PER_HOUR;
      if (!isNaN(hoursSpan) && hoursSpan > 0) totals[seg.sectionIndex] += hoursSpan;
    });
    totals.forEach((val, i) => {
      const el = svg.querySelector(`#total-${i}`);
      if (el) el.textContent = formatHHMMDecimal(val);
    });
    const grand = totals.reduce((a, b) => a + b, 0);
    const ge = svg.querySelector("#grand-total");
    if (ge) ge.textContent = `Total: ${formatHHMMDecimal(grand)}`;
  }

  function drawAll() {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const gridHeight = SECTIONS.length * SECTION_HEIGHT;
    drawGrid(svg, gridHeight);

    // Draw segments lines
    segments.forEach((seg) => {
      const y = seg.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
      const hLine = createSVGElement("line", {
        x1: seg.fromX,
        y1: y,
        x2: seg.toX,
        y2: y,
        stroke: "red",
        "stroke-width": 3,
      });
      svg.appendChild(hLine);
    });

    // Draw vertical connectors between segments that end/start at the same X
    for (let a = 0; a < segments.length; a++) {
      for (let b = 0; b < segments.length; b++) {
        if (a === b) continue;
        const segA = segments[a],
          segB = segments[b];
        if (eq(segA.toX, segB.fromX) && !eq(segA.toX, segA.fromX)) {
          const y1 = segA.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
          const y2 = segB.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
          const v = createSVGElement("line", {
            x1: segA.toX,
            y1: y1,
            x2: segA.toX,
            y2: y2,
            stroke: "red",
            "stroke-width": 3,
          });
          svg.appendChild(v);
        }
      }
    }

    // Place remarks below grid, avoiding overlaps
    const remarkItems = segments.map((seg, idx) => ({ x: seg.toX, text: seg.remark || "", idx }));
    const rows = [];

    function measureText(text) {
      const t = createSVGElement("text", {
        x: 0,
        y: 0,
        "font-size": REMARK_FONT_SIZE,
        "font-family": FONT_FAMILY,
        style: "visibility:hidden",
      });
      t.textContent = text || "";
      svg.appendChild(t);
      const bbox = t.getBBox();
      svg.removeChild(t);
      return { w: bbox.width || (text ? text.length * 7 : 8), h: bbox.height || REMARK_FONT_SIZE + 2 };
    }

    remarkItems.sort((a, b) => a.x - b.x);

    const gridBottomY = gridHeight;
    const remarkBaseY = gridBottomY + REMARK_TOP_GAP;

    const placed = [];

    remarkItems.forEach((item) => {
      const meas = measureText(item.text);
      const width = meas.w;
      let centerX = clamp(item.x, 4 + width / 2, GRID_WIDTH - 4 - width / 2);
      let left = centerX - width / 2;
      let right = centerX + width / 2;
      let foundRow = -1;
      const PAD = 6;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        let overlap = row.some((rr) => !(right + PAD < rr.left || left - PAD > rr.right));
        if (!overlap) {
          foundRow = r;
          break;
        }
      }
      if (foundRow === -1) {
        foundRow = rows.length;
        rows.push([]);
      }
      rows[foundRow].push({ left, right });
      const textX = left;
      const textY = remarkBaseY + foundRow * REMARK_ROW_HEIGHT + meas.h;
      placed.push({ idx: item.idx, text: item.text, x: item.x, textX, textY, width, row: foundRow, textHeight: meas.h });
    });

    const remarkRows = rows.length || 0;
    const requiredHeight = gridBottomY + REMARK_TOP_GAP + remarkRows * REMARK_ROW_HEIGHT + 40;
    svg.setAttribute("height", Math.max(requiredHeight, svg.getAttribute("height")));

    placed.forEach((p) => {
      const textTop = p.textY - p.textHeight;
      const v = createSVGElement("line", {
        x1: p.x,
        y1: gridBottomY,
        x2: p.x,
        y2: textTop - 4,
        stroke: "#00f",
        "stroke-width": 1,
      });
      svg.appendChild(v);
      const t = createSVGElement("text", {
        x: p.textX,
        y: p.textY,
        "font-size": REMARK_FONT_SIZE,
        "font-family": FONT_FAMILY,
        fill: "#00f",
      });
      t.textContent = p.text;
      svg.appendChild(t);
    });

    computeTotals(svg);
  }

  // Add segment from form inputs
  function addSegmentFromForm({ fromHour, fromMin, toHour, toMin, section, remark }) {
    const sFrom = snapTo15(+fromHour, +fromMin);
    const sTo = snapTo15(+toHour, +toMin);
    let fromX = timeToX(sFrom.h, sFrom.m);
    let toX = timeToX(sTo.h, sTo.m);

    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      fromX = last.toX;
    }

    const END_OF_DAY = GRID_WIDTH;

    let newSegments = [...segments];

    if (toX >= fromX) {
      newSegments.push({ fromX, toX, sectionIndex: +section, remark });
    } else {
      newSegments.push({ fromX, toX: END_OF_DAY, sectionIndex: +section, remark });
      newSegments.push({ fromX: 0, toX, sectionIndex: +section, remark });
    }

    setSegments(newSegments);
  }

  // Handle form input change for segment form
  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData((fd) => ({ ...fd, [name]: value }));
  }

  // Handle segment form submission
  function handleSubmit(e) {
    e.preventDefault();
    const { fromHour, fromMin, toHour, toMin, section, remark } = formData;

    if (isNaN(fromHour) || fromHour === "" || isNaN(toHour) || toHour === "") {
      alert("Please provide valid hours");
      return;
    }
    addSegmentFromForm({ fromHour, fromMin, toHour, toMin, section, remark: remark.trim() });
    setFormData((fd) => ({ ...fd, fromHour: "", toHour: "", remark: "" }));
  }

  // Handle meta input change
  function handleMetaChange(e) {
    const { name, value } = e.target;
    setMeta((m) => ({ ...m, [name]: value }));
  }

  // Export entire printable area using html2canvas
  async function handleExport() {
    if (!printableRef.current) return;
    try {
      const canvas = await html2canvas(printableRef.current, { scale: 2, useCORS: true });
      const link = document.createElement("a");
      const filename = "drivers_daily_log_" + Date.now() + ".png";
      link.download = filename;
      link.href = canvas.toDataURL();
      link.click();

      // Clear local storage and reset
      localStorage.removeItem(STORAGE_KEY);
      setSegments([]);
      drawAll();
      alert("Exported " + filename + " and cleared saved logs.");
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  }

  // Clear all segments
  function handleClear() {
    if (!window.confirm("Clear all entries?")) return;
    setSegments([]);
    localStorage.removeItem(STORAGE_KEY);
    drawAll();
  }

  // On component mount, draw current segments
  useEffect(() => {
    drawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "22px auto", fontFamily: FONT_FAMILY, padding: 18, backgroundColor: "#fff", borderRadius: 6, boxShadow: "0 4px 18px rgba(0,0,0,0.06)" }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 20, letterSpacing: "0.5px" }}>Drivers Daily Log</h1>
        <p style={{ margin: "6px 0 0", color: "#666", fontSize: 13 }}>
          (24 hours) — Original: File at home terminal — Duplicate: Driver retains in his/her possession
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0 18px", alignItems: "start" }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12, alignItems: "end" }}>
            <div>
              <label>Date (month / day / year)</label>
              <input
                type="date"
                name="logDate"
                value={meta.logDate}
                onChange={handleMetaChange}
                style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
              />
            </div>
            <div>
              <label>From</label>
              <input
                type="text"
                placeholder="From location"
                name="fromLocation"
                value={meta.fromLocation}
                onChange={handleMetaChange}
                style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
              />
            </div>
            <div>
              <label>To</label>
              <input
                type="text"
                placeholder="To location"
                name="toLocation"
                value={meta.toLocation}
                onChange={handleMetaChange}
                style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label>Total Miles Driving Today</label>
                <input
                  type="number"
                  name="milesDriving"
                  value={meta.milesDriving}
                  onChange={handleMetaChange}
                  style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Total Mileage Today</label>
                <input
                  type="number"
                  name="totalMileage"
                  value={meta.totalMileage}
                  onChange={handleMetaChange}
                  style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Carrier</label>
            <input
              type="text"
              name="carrierName"
              value={meta.carrierName}
              onChange={handleMetaChange}
              style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Truck/Tractor & Trailer</label>
            <input
              type="text"
              name="truckNumber"
              value={meta.truckNumber}
              onChange={handleMetaChange}
              style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Main Office Address</label>
            <input
              type="text"
              name="mainOffice"
              value={meta.mainOffice}
              onChange={handleMetaChange}
              style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Home Terminal Address</label>
            <input
              type="text"
              name="homeTerminal"
              value={meta.homeTerminal}
              onChange={handleMetaChange}
              style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 4, border: "1px solid #bbb" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Segment input form */}
          <form onSubmit={handleSubmit} style={{ padding: 12, border: "1px solid #ccc", borderRadius: 6 }}>
            <h2 style={{ marginTop: 0 }}>Add Log Segment</h2>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <label>From</label>
              <input
                type="number"
                min="0"
                max="23"
                placeholder="Hour"
                name="fromHour"
                value={formData.fromHour}
                onChange={handleFormChange}
                style={{ width: 60, padding: 6 }}
                required
              />
              <select
                name="fromMin"
                value={formData.fromMin}
                onChange={handleFormChange}
                style={{ padding: 6 }}
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <label>To</label>
              <input
                type="number"
                min="0"
                max="23"
                placeholder="Hour"
                name="toHour"
                value={formData.toHour}
                onChange={handleFormChange}
                style={{ width: 60, padding: 6 }}
                required
              />
              <select
                name="toMin"
                value={formData.toMin}
                onChange={handleFormChange}
                style={{ padding: 6 }}
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <label>Section</label>
              <select
                name="section"
                value={formData.section}
                onChange={handleFormChange}
                style={{ padding: 6 }}
              >
                {SECTIONS.map((sec, i) => (
                  <option key={i} value={i}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Remark (optional)</label>
              <input
                type="text"
                name="remark"
                value={formData.remark}
                onChange={handleFormChange}
                style={{ width: "100%", padding: 6 }}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: 10,
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Add Segment
            </button>
          </form>

          <button
            onClick={handleClear}
            style={{
              padding: "8px 12px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            Clear All Entries
          </button>
        </div>
      </div>

      {/* SVG LOG */}
      <div
        style={{
          border: "1px solid #444",
          borderRadius: 6,
          overflow: "auto",
          marginTop: 16,
          backgroundColor: "#fff",
        }}
      >
        <svg ref={svgRef} style={{ display: "block", maxWidth: "100%" }} />
      </div>

      {/* Remarks outside grid */}
      <div style={{ marginTop: 24 }}>
        <label style={{ fontWeight: "bold" }}>Remarks Outside:</label>
        <textarea
          rows={4}
          style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #bbb" }}
          name="remarksOutside"
          value={meta.remarksOutside}
          onChange={handleMetaChange}
          placeholder="Enter remarks outside the grid..."
        />
      </div>

      {/* Shipping section */}
      <div style={{ marginTop: 20 }}>
        <h2>Shipping</h2>
        <textarea
          rows={4}
          style={{ width: "100%", padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #bbb" }}
          name="shippingDoc"
          value={meta.shippingDoc}
          onChange={handleMetaChange}
          placeholder="Enter shipping document details..."
        />
        <textarea
          rows={4}
          style={{ width: "100%", marginTop: 10, padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #bbb" }}
          name="shipperCommodity"
          value={meta.shipperCommodity}
          onChange={handleMetaChange}
          placeholder="Enter shipper/commodity info..."
        />
      </div>

      {/* Export button */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <button
          onClick={handleExport}
          style={{
            padding: "12px 30px",
            fontSize: 16,
            fontWeight: "bold",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Export Entire Log as Image
        </button>
      </div>

      {/* The printable area reference */}
      <div
        ref={printableRef}
        style={{ position: "fixed", top: -10000, left: -10000, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <div
          style={{
            fontFamily: FONT_FAMILY,
            width: SVG_WIDTH + 40,
            backgroundColor: "white",
            padding: 20,
          }}
        >
          <h1>Drivers Daily Log</h1>
          <p>
            (24 hours) — Original: File at home terminal — Duplicate: Driver retains in his/her possession
          </p>

          <svg
            width={SVG_WIDTH}
            height={SECTIONS.length * SECTION_HEIGHT + REMARK_TOP_GAP + 100}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Grid + segments drawn for export */}
            {/* We draw grid + segments + remarks */}
            {/* Build grid */}
            {[...Array(SECTIONS.length).keys()].map((i) => {
              const y = i * SECTION_HEIGHT;
              return (
                <g key={`grid-row-${i}`}>
                  <rect x={0} y={y} width={GRID_WIDTH} height={SECTION_HEIGHT} fill="none" stroke="#000" />
                  <text x={6} y={y + 16} fontSize={14} fontFamily={FONT_FAMILY}>
                    {SECTIONS[i]}
                  </text>
                </g>
              );
            })}

            {/* Vertical hour lines */}
            {[...Array(HOURS + 1).keys()].map((h) => {
              const x = h * PX_PER_HOUR;
              return (
                <g key={`vert-line-${h}`}>
                  <line x1={x} y1={0} x2={x} y2={SECTIONS.length * SECTION_HEIGHT} stroke="#000" strokeWidth={1} />
                  <text x={x + 2} y={SECTIONS.length * SECTION_HEIGHT + 16} fontSize={12} fontFamily={FONT_FAMILY}>
                    {h % 24}
                  </text>
                  {[1, 2, 3].map((s) => {
                    if (h === HOURS) return null;
                    const subX = x + PX_PER_HOUR * (s / 4);
                    return (
                      <line
                        key={`sub-line-${h}-${s}`}
                        x1={subX}
                        y1={0}
                        x2={subX}
                        y2={SECTIONS.length * SECTION_HEIGHT}
                        stroke="#888"
                        strokeWidth={s === 2 ? 1.2 : 0.5}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Totals column */}
            <rect
              x={TOTALS_COL_X}
              y={0}
              width={TOTALS_COL_WIDTH}
              height={SECTIONS.length * SECTION_HEIGHT}
              fill="none"
              stroke="#000"
            />
            {SECTIONS.map((label, i) => (
              <g key={`total-label-${i}`}>
                <text x={TOTALS_COL_X + 8} y={i * SECTION_HEIGHT + 18} fontSize={13} fontFamily={FONT_FAMILY}>
                  {label}
                </text>
                <text
                  x={TOTALS_COL_X + 8}
                  y={i * SECTION_HEIGHT + 38}
                  fontSize={14}
                  fontWeight="bold"
                  fontFamily={FONT_FAMILY}
                >
                  {/* Calculate total hours per section */}
                  {(() => {
                    const val = segments
                      .filter((seg) => seg.sectionIndex === i)
                      .reduce((acc, s) => acc + (s.toX - s.fromX) / PX_PER_HOUR, 0);
                    return formatHHMMDecimal(val);
                  })()}
                </text>
              </g>
            ))}

            {/* Grand total */}
            <text
              x={TOTALS_COL_X + 8}
              y={SECTIONS.length * SECTION_HEIGHT - 8}
              fontSize={14}
              fontWeight="bold"
              fontFamily={FONT_FAMILY}
            >
              Total:{" "}
              {formatHHMMDecimal(
                segments.reduce((acc, s) => acc + (s.toX - s.fromX) / PX_PER_HOUR, 0)
              )}
            </text>

            {/* Segments lines */}
            {segments.map((seg, i) => {
              const y = seg.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
              return (
                <line
                  key={`seg-line-${i}`}
                  x1={seg.fromX}
                  y1={y}
                  x2={seg.toX}
                  y2={y}
                  stroke="red"
                  strokeWidth={3}
                />
              );
            })}

            {/* Connectors */}
            {segments.map((segA, aIdx) => {
              return segments.map((segB, bIdx) => {
                if (aIdx === bIdx) return null;
                if (eq(segA.toX, segB.fromX) && !eq(segA.toX, segA.fromX)) {
                  const y1 = segA.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
                  const y2 = segB.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
                  return (
                    <line
                      key={`connector-${aIdx}-${bIdx}`}
                      x1={segA.toX}
                      y1={y1}
                      x2={segA.toX}
                      y2={y2}
                      stroke="red"
                      strokeWidth={3}
                    />
                  );
                }
                return null;
              });
            })}

            {/* Remarks outside grid */}
            {(() => {
              // Calculate remarks placement like in drawAll
              let remarkItems = segments
                .map((seg, idx) => ({ x: seg.toX, text: seg.remark || "", idx }))
                .filter((item) => item.text);
              remarkItems.sort((a, b) => a.x - b.x);

              const placed = [];
              const rows = [];

              function measureTextSVG(text) {
                // Approximate width: 7px per char
                return text.length * 7;
              }

              remarkItems.forEach((item) => {
                const width = measureTextSVG(item.text);
                let centerX = clamp(item.x, 4 + width / 2, GRID_WIDTH - 4 - width / 2);
                let left = centerX - width / 2;
                let right = centerX + width / 2;
                let foundRow = -1;
                const PAD = 6;
                for (let r = 0; r < rows.length; r++) {
                  const row = rows[r];
                  let overlap = row.some((rr) => !(right + PAD < rr.left || left - PAD > rr.right));
                  if (!overlap) {
                    foundRow = r;
                    break;
                  }
                }
                if (foundRow === -1) {
                  foundRow = rows.length;
                  rows.push([]);
                }
                rows[foundRow].push({ left, right });
                placed.push({ ...item, left, right, row: foundRow, width });
              });

              const remarkBaseY = SECTIONS.length * SECTION_HEIGHT + REMARK_TOP_GAP;

              return placed.map(({ text, left, row, idx }) => {
                const y = remarkBaseY + row * REMARK_ROW_HEIGHT + REMARK_FONT_SIZE;
                return (
                  <g key={"remark-" + idx}>
                    <line
                      x1={segments[idx].toX}
                      y1={SECTIONS.length * SECTION_HEIGHT}
                      x2={segments[idx].toX}
                      y2={y - 4}
                      stroke="#00f"
                      strokeWidth={1}
                    />
                    <text x={left} y={y} fontSize={REMARK_FONT_SIZE} fill="#00f" fontFamily={FONT_FAMILY}>
                      {text}
                    </text>
                  </g>
                );
              });
            })()}
          </svg>

          <div style={{ marginTop: 20, fontSize: 14 }}>
            <strong>Remarks Outside:</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{meta.remarksOutside || "(none)"}</p>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3>Shipping</h3>
            <p><strong>Shipping Document:</strong><br />{meta.shippingDoc || "(none)"}</p>
            <p><strong>Shipper/Commodity:</strong><br />{meta.shipperCommodity || "(none)"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
