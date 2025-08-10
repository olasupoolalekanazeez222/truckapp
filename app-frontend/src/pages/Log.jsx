import React, { useEffect, useRef, useState } from "react";

export default function Log() {
  /* ===== Refs for DOM elements (we keep original IDs for parity) ===== */
  const svgRef = useRef(null);
  const printableRef = useRef(null);
  const formRef = useRef(null);

  const logDateRef = useRef(null);
  const fromLocationRef = useRef(null);
  const toLocationRef = useRef(null);
  const milesDrivingRef = useRef(null);
  const totalMileageRef = useRef(null);
  const carrierNameRef = useRef(null);
  const truckNumberRef = useRef(null);
  const mainOfficeRef = useRef(null);
  const homeTerminalRef = useRef(null);
  const remarkInputRef = useRef(null);
  const remarksOutsideRef = useRef(null);
  const shippingDocRef = useRef(null);
  const shipperCommodityRef = useRef(null);

  /* ===== Constants (mirrors original) ===== */
  const HOURS = 24;
  const PX_PER_HOUR = 50;
  const GRID_WIDTH = HOURS * PX_PER_HOUR; // 1200
  const TOTALS_COL_X = GRID_WIDTH + 20;
  const TOTALS_COL_WIDTH = 160;
  const SVG_WIDTH = TOTALS_COL_X + TOTALS_COL_WIDTH + 20;
  const SECTION_HEIGHT = 80;
  const SECTIONS = ["Off Duty", "Sleeper Berth", "Driving", "On Duty"];
  const STORAGE_KEY = "svgLogSegments_v3";
  const FONT_FAMILY = "Arial";
  const REMARK_FONT_SIZE = 12;
  const REMARK_ROW_HEIGHT = 18;
  const REMARK_TOP_GAP = 18;
  const EPS = 0.001;

  /* ===== State ===== */
  const [segments, setSegments] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.map((s) => ({
        fromX: Number(s.fromX),
        toX: Number(s.toX),
        sectionIndex: Number(s.sectionIndex),
        remark: s.remark || "",
      }));
    } catch (e) {
      return [];
    }
  });

  /* ===== Helpers ===== */
  function createSVG(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => {
      el.setAttribute(k, v);
    });
    return el;
  }

  function saveSegments(localSegments) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localSegments));
    } catch (e) {
      console.warn("Failed to save segments", e);
    }
  }

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
  function xToTime(x) {
    const totalH = x / PX_PER_HOUR;
    const h = Math.floor(totalH) % 24;
    const m = Math.round((totalH - Math.floor(totalH)) * 60);
    return { h, m };
  }
  function formatHHMMDecimal(decHours) {
    const totalM = Math.round(decHours * 60);
    const hh = Math.floor(totalM / 60);
    const mm = totalM % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  /* ===== Drawing routines ===== */
  function drawGrid(gridHeight) {
    const SVG = svgRef.current;
    if (!SVG) return;
    // Clear
    while (SVG.firstChild) SVG.removeChild(SVG.firstChild);
    SVG.setAttribute("width", SVG_WIDTH);
    SVG.setAttribute("height", gridHeight + 200);

    SVG.appendChild(
      createSVG("rect", { x: 0, y: 0, width: GRID_WIDTH, height: gridHeight, fill: "#fff" })
    );

    SECTIONS.forEach((label, i) => {
      const y = i * SECTION_HEIGHT;
      SVG.appendChild(
        createSVG("rect", { x: 0, y, width: GRID_WIDTH, height: SECTION_HEIGHT, fill: "none", stroke: "#000" })
      );
      const t = createSVG("text", {
        x: 6,
        y: y + 16,
        "font-size": 14,
        "font-family": FONT_FAMILY,
      });
      t.textContent = label;
      SVG.appendChild(t);
    });

    for (let h = 0; h <= HOURS; h++) {
      const x = h * PX_PER_HOUR;
      SVG.appendChild(
        createSVG("line", { x1: x, y1: 0, x2: x, y2: gridHeight, stroke: "#000", "stroke-width": 1 })
      );
      const lab = createSVG("text", {
        x: x + 2,
        y: gridHeight + 16,
        "font-size": 12,
        "font-family": FONT_FAMILY,
      });
      lab.textContent = h % 24;
      SVG.appendChild(lab);

      if (h < HOURS) {
        for (let s = 1; s < 4; s++) {
          const subX = x + PX_PER_HOUR * (s / 4);
          const isMid = s === 2;
          SVG.appendChild(
            createSVG("line", {
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

    const col = createSVG("rect", {
      x: TOTALS_COL_X,
      y: 0,
      width: TOTALS_COL_WIDTH,
      height: gridHeight,
      fill: "none",
      stroke: "#000",
    });
    SVG.appendChild(col);
    SECTIONS.forEach((label, i) => {
      const y = i * SECTION_HEIGHT;
      SVG.appendChild(
        createSVG("text", {
          x: TOTALS_COL_X + 8,
          y: y + 18,
          "font-size": 13,
          "font-family": FONT_FAMILY,
        })
      ).textContent = label;
      SVG.appendChild(
        createSVG("text", {
          id: `total-${i}`,
          x: TOTALS_COL_X + 8,
          y: y + 38,
          "font-size": 14,
          "font-family": FONT_FAMILY,
          "font-weight": "bold",
        })
      );
    });
    SVG.appendChild(
      createSVG("text", {
        id: "grand-total",
        x: TOTALS_COL_X + 8,
        y: gridHeight - 8,
        "font-size": 14,
        "font-family": FONT_FAMILY,
        "font-weight": "bold",
      })
    );
  }

  function computeTotals(localSegments = segments) {
    const SVG = svgRef.current;
    if (!SVG) return;
    const totals = [0, 0, 0, 0];
    localSegments.forEach((seg) => {
      const hoursSpan = (seg.toX - seg.fromX) / PX_PER_HOUR;
      if (!isNaN(hoursSpan) && hoursSpan > 0) totals[seg.sectionIndex] += hoursSpan;
    });
    totals.forEach((val, i) => {
      const el = SVG.querySelector(`#total-${i}`);
      if (el) el.textContent = formatHHMMDecimal(val);
    });
    const grand = totals.reduce((a, b) => a + b, 0);
    const ge = SVG.querySelector("#grand-total");
    if (ge) ge.textContent = `Total: ${formatHHMMDecimal(grand)}`;
  }

  function drawAll(localSegments = segments) {
    const SVG = svgRef.current;
    if (!SVG) return;
    const gridHeight = SECTIONS.length * SECTION_HEIGHT;
    drawGrid(gridHeight);

    // DRAW horizontal segments
    localSegments.forEach((seg) => {
      const y = seg.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
      const hLine = createSVG("line", {
        x1: seg.fromX,
        y1: y,
        x2: seg.toX,
        y2: y,
        stroke: "red",
        "stroke-width": 3,
      });
      SVG.appendChild(hLine);
    });

    // DRAW inside connectors (red vertical) when segA.toX == segB.fromX
    for (let a = 0; a < localSegments.length; a++) {
      for (let b = 0; b < localSegments.length; b++) {
        if (a === b) continue;
        const segA = localSegments[a],
          segB = localSegments[b];
        if (eq(segA.toX, segB.fromX) && !eq(segA.toX, segA.fromX)) {
          const y1 = segA.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
          const y2 = segB.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
          const v = createSVG("line", {
            x1: segA.toX,
            y1: y1,
            x2: segA.toX,
            y2: y2,
            stroke: "red",
            "stroke-width": 3,
          });
          SVG.appendChild(v);
        }
      }
    }

    // REMARKS placement
    const remarkItems = localSegments.map((seg, idx) => ({ x: seg.toX, text: seg.remark || "", idx }));
    const rows = [];
    const placed = [];

    function measureText(text) {
      const t = createSVG("text", { x: 0, y: 0, "font-size": REMARK_FONT_SIZE, "font-family": FONT_FAMILY, style: "visibility:hidden" });
      t.textContent = text || "";
      SVG.appendChild(t);
      let bbox;
      try {
        bbox = t.getBBox();
      } catch (e) {
        bbox = { width: (text ? text.length * 7 : 8), height: REMARK_FONT_SIZE + 2 };
      }
      SVG.removeChild(t);
      return { w: bbox.width || (text ? text.length * 7 : 8), h: bbox.height || REMARK_FONT_SIZE + 2 };
    }

    remarkItems.sort((a, b) => a.x - b.x);

    const gridBottomY = gridHeight;
    const remarkBaseY = gridBottomY + REMARK_TOP_GAP;

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
    const currentH = Number(SVG.getAttribute("height")) || 0;
    SVG.setAttribute("height", Math.max(requiredHeight, currentH));

    placed.forEach((p) => {
      const textTop = p.textY - p.textHeight;
      const v = createSVG("line", { x1: p.x, y1: gridBottomY, x2: p.x, y2: textTop - 4, stroke: "#00f", "stroke-width": 1 });
      SVG.appendChild(v);
      const t = createSVG("text", {
        x: p.textX,
        y: p.textY,
        "font-size": REMARK_FONT_SIZE,
        "font-family": FONT_FAMILY,
        fill: "#00f",
      });
      t.textContent = p.text;
      SVG.appendChild(t);
    });

    computeTotals(localSegments);
  }

  /* ===== Add segment behavior (form use) ===== */
  function addSegmentFromForm(fromH, fromM, toH, toM, sectionIndex, remark) {
    const sFrom = snapTo15(fromH, fromM);
    const sTo = snapTo15(toH, toM);
    let fromX = timeToX(sFrom.h, sFrom.m);
    let toX = timeToX(sTo.h, sTo.m);

    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      fromX = last.toX;
    }

    const END_OF_DAY = GRID_WIDTH;
    const newSegments = [...segments];

    if (toX >= fromX) {
      newSegments.push({ fromX, toX, sectionIndex, remark });
    } else {
      newSegments.push({ fromX, toX: END_OF_DAY, sectionIndex, remark });
      newSegments.push({ fromX: 0, toX: toX, sectionIndex, remark });
    }

    setSegments(newSegments);
    saveSegments(newSegments);
    // drawAll will be invoked by useEffect reacting to segments change
  }

  /* ===== Handlers ===== */
  useEffect(() => {
    // redraw whenever segments change
    drawAll(segments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  useEffect(() => {
    // initial draw
    drawAll(segments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmitForm(e) {
    e.preventDefault();
    const fromH = parseInt(document.getElementById("fromHour").value, 10);
    const fromM = parseInt(document.getElementById("fromMin").value, 10);
    const toH = parseInt(document.getElementById("toHour").value, 10);
    const toM = parseInt(document.getElementById("toMin").value, 10);
    const sectionIndex = parseInt(document.getElementById("section").value, 10);
    const remark = (document.getElementById("remark").value || "").trim();

    if (isNaN(fromH) || isNaN(toH)) {
      alert("Please provide valid hours");
      return;
    }
    addSegmentFromForm(fromH, fromM, toH, toM, sectionIndex, remark);
    if (formRef.current) formRef.current.reset();
  }

  function onExportClick() {
    const SVG = svgRef.current;
    if (!SVG) {
      alert("No SVG to export");
      return;
    }

    // Clone SVG and serialize
    const serializer = new XMLSerializer();
    const cloneSVG = SVG.cloneNode(true);
    cloneSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    cloneSVG.setAttribute("width", SVG_WIDTH);
    cloneSVG.setAttribute("height", SVG.getAttribute("height") || SECTIONS.length * SECTION_HEIGHT + 200);
    const svgSource = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(cloneSVG);

    function utf8ToBase64(str) {
      return btoa(unescape(encodeURIComponent(str)));
    }
    const imgSrc = "data:image/svg+xml;base64," + utf8ToBase64(svgSource);

    const img = new Image();
    img.onload = () => {
      const headerHeight = 160;
      const remarksHeight = 140;
      const canvasWidth = SVG_WIDTH + 40;
      const canvasHeight = headerHeight + img.height + remarksHeight + 40;

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext("2d");

      // White background
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw header text
      ctx.fillStyle = "#111";
      ctx.font = "20px Arial";
      ctx.fillText("Drivers Daily Log", 20, 30);

      ctx.font = "14px Arial";
      ctx.fillText(
        "(24 hours) — Original: File at home terminal — Duplicate: Driver retains in his/her possession",
        20,
        60
      );

      // Draw meta info
      ctx.font = "13px Arial";
      const metaFields = [
        ["Date:", document.getElementById("logDate") ? document.getElementById("logDate").value : ""],
        ["From:", document.getElementById("fromLocation") ? document.getElementById("fromLocation").value : ""],
        ["To:", document.getElementById("toLocation") ? document.getElementById("toLocation").value : ""],
        ["Miles Driving Today:", document.getElementById("milesDriving") ? document.getElementById("milesDriving").value : ""],
        ["Total Mileage Today:", document.getElementById("totalMileage") ? document.getElementById("totalMileage").value : ""],
        ["Carrier:", document.getElementById("carrierName") ? document.getElementById("carrierName").value : ""],
        ["Truck/Tractor & Trailer:", document.getElementById("truckNumber") ? document.getElementById("truckNumber").value : ""],
        ["Main Office Address:", document.getElementById("mainOffice") ? document.getElementById("mainOffice").value : ""],
        ["Home Terminal Address:", document.getElementById("homeTerminal") ? document.getElementById("homeTerminal").value : ""],
      ];
      let yMeta = 90;
      metaFields.forEach(([label, val]) => {
        ctx.fillText(`${label} ${val}`, 20, yMeta);
        yMeta += 18;
      });

      // Draw SVG beneath meta
      ctx.drawImage(img, 20, headerHeight);

      // Draw outside remarks
      ctx.fillStyle = "#111";
      ctx.font = "14px Arial";
      ctx.fillText("Remarks:", 20, headerHeight + img.height + 30);
      ctx.font = "13px Arial";
      const remarksText = (document.getElementById("remarksOutside") ? document.getElementById("remarksOutside").value : "").trim() || "(none)";

      // Wrap text
      const maxWidth = canvasWidth - 40;
      const lineHeight = 18;
      const words = remarksText.split(/\s+/);
      let line = "";
      let y = headerHeight + img.height + 55;
      words.forEach((word) => {
        const testLine = line + word + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          ctx.fillText(line, 20, y);
          line = word + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line) ctx.fillText(line, 20, y);

      // Save image
      const link = document.createElement("a");
      const filename = "drivers_daily_log_" + Date.now() + ".png";
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();

      // Clear storage and segments
      localStorage.removeItem(STORAGE_KEY);
      setSegments([]);
      alert("Exported " + filename + " and cleared saved logs.");
    };

    img.onerror = () => {
      alert("Export failed: Could not load SVG as image.");
    };

    img.src = imgSrc;
  }

  function onClearClick() {
    if (!window.confirm("Clear all entries?")) return;
    setSegments([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ===== The component JSX (keeps IDs and layout as original) ===== */
  return (
    <div>
      <style>{`
        :root{
          --accent:#111;
          --muted:#666;
          --field-bg:#fff;
          --border: #bbb;
          font-family: Arial, Helvetica, sans-serif;
        }
        html,body{margin:0;padding:0;background:#f4f6f8;color:#111}
        .container{
          max-width:1100px;
          margin:22px auto;
          background:#fff;
          border-radius:6px;
          padding:18px;
          box-shadow:0 4px 18px rgba(0,0,0,0.06);
        }
        header h1{margin:0;font-size:20px;letter-spacing:0.5px}
        .meta{display:grid;grid-template-columns: 1fr 1fr;gap:12px;margin:12px 0 18px;align-items:start}
        .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        label{font-size:13px;color:var(--muted);display:block;margin-bottom:6px}
        input[type="text"], input[type="date"], .small-input, textarea{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:4px;box-sizing:border-box;background:var(--field-bg);font-size:14px}
        .half{width:48%}
        .third{width:32%}
        .quarter{width:23%}
        .small-input{width:120px;}
        .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .top-fields{display:grid;grid-template-columns: 1fr 1fr 1fr;gap:10px;margin-bottom:12px;align-items:end}
        .miles-boxes{display:flex;gap:8px;align-items:center}
        .miles-boxes .box{border:1px solid var(--border);padding:8px 10px;border-radius:4px;background:#fafafa}

        /* New SVG Tracker styles */
        #svgLogContainer { margin-top: 16px; border: 1px solid var(--border); border-radius: 6px; padding: 10px; background: #fafafa; }
        #controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 10px; }
        #controls form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        #controls label { font-size: 13px; color: var(--muted); display: flex; flex-direction: column; min-width: 130px; }
        #controls input, #controls select, #controls textarea, #controls button { padding: 6px; font-size: 13px; font-family: Arial, sans-serif; border: 1px solid var(--border); border-radius: 4px; }
        #controls textarea { resize: vertical; }
        #controls button { cursor: pointer; background: var(--accent); color: #fff; border: none; }
        #controls button:hover { background: #333; }
        #info { margin-top: 6px; color: var(--muted); font-size: 12px; }
        svg { display: block; margin-top: 10px; background: #fff; }

        /* Remarks & Shipping */
        .two-col{ display:grid; grid-template-columns: 2fr 1fr; gap:12px; margin-top:14px; }
        textarea{ min-height:120px; resize:vertical }

        /* Recap */
        .recap{ margin-top:16px; border:1px solid var(--border); border-radius:6px; padding:10px; background:#fafafa; }
        .recap table{ width:100%; border-collapse:collapse; font-size:13px }
        .recap th, .recap td{ border:1px solid #ddd; padding:8px; text-align:center }
        .recap th{ background:#eee; font-weight:700 }

        /* Responsive */
        @media (max-width:900px){
          .meta{grid-template-columns:1fr}
          .top-fields{grid-template-columns:1fr}
          .two-col{grid-template-columns:1fr}
        }

        /* Print-friendly tweaks */
        @media print{
          body{background:#fff}
          .container{box-shadow:none;border:none}
          svg { border:none !important; }
        }

        .btn {
          padding:6px 8px;
          border-radius:4px;
          background:var(--accent);
          color:#fff;
          border:none;
          cursor:pointer;
        }
      `}</style>

      <div className="container" id="printableArea" ref={printableRef}>
        <header>
          <h1>Drivers Daily Log</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
            (24 hours) — Original: File at home terminal — Duplicate: Driver retains in his/her possession
          </p>
        </header>

        <div className="meta">
          <div className="left">
            <div className="top-fields">
              <div>
                <label>Date (month / day / year)</label>
                <input type="date" id="logDate" ref={logDateRef} />
              </div>
              <div>
                <label>From</label>
                <input type="text" placeholder="From location" id="fromLocation" ref={fromLocationRef} />
              </div>
              <div>
                <label>To</label>
                <input type="text" placeholder="To location" id="toLocation" ref={toLocationRef} />
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label>Total Miles Driving Today</label>
                  <input type="text" placeholder="Miles driving today" id="milesDriving" ref={milesDrivingRef} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Total Mileage Today</label>
                  <input type="text" placeholder="Total mileage today" id="totalMileage" ref={totalMileageRef} />
                </div>
                <div style={{ flex: 2 }}>
                  <label>Name of Carrier or Carriers</label>
                  <input type="text" placeholder="Carrier name" id="carrierName" ref={carrierNameRef} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label>Truck/Tractor and Trailer Numbers / License Plate(s)</label>
                  <input type="text" placeholder="Truck/Tractor / Trailer # / Plate" id="truckNumber" ref={truckNumberRef} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Main Office Address</label>
                  <input type="text" placeholder="Main office address" id="mainOffice" ref={mainOfficeRef} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Home Terminal Address</label>
                  <input type="text" placeholder="Home terminal address" id="homeTerminal" ref={homeTerminalRef} />
                </div>
              </div>
            </div>
          </div>

          <div className="right" style={{ paddingLeft: 6 }}>
            <div style={{ border: "1px solid var(--border)", padding: 10, borderRadius: 4, background: "#fafafa" }}>
              <strong>Original / Duplicate</strong>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12 }}>
                Keep original at home terminal. Driver retains duplicate for 8 days.
              </p>
            </div>
          </div>
        </div>

        <section id="svgLogContainer" aria-label="24 hour activity log tracker">
          <div id="controls">
            <form id="logForm" ref={formRef} onSubmit={onSubmitForm}>
              <label>
                From Hour:
                <input type="number" id="fromHour" min="0" max="23" required />
              </label>
              <label>
                From Min:
                <select id="fromMin" defaultValue="0">
                  <option>0</option>
                  <option>15</option>
                  <option>30</option>
                  <option>45</option>
                </select>
              </label>
              <label>
                To Hour:
                <input type="number" id="toHour" min="0" max="23" required />
              </label>
              <label>
                To Min:
                <select id="toMin" defaultValue="0">
                  <option>0</option>
                  <option>15</option>
                  <option>30</option>
                  <option>45</option>
                </select>
              </label>
              <label>
                Section:
                <select id="section" defaultValue="2">
                  <option value="0">Off Duty</option>
                  <option value="1">Sleeper Berth</option>
                  <option value="2">Driving</option>
                  <option value="3">On Duty</option>
                </select>
              </label>
              <label style={{ flexGrow: 1, minWidth: 220 }}>
                Remark:
                <textarea id="remark" rows="1" cols="28" placeholder="Enter remark (will appear below grid)" ref={remarkInputRef}></textarea>
              </label>
              <button className="btn" type="submit" style={{ flexShrink: 0 }}>
                Save
              </button>
            </form>

            <div>
              <button id="exportBtn" className="btn" type="button" onClick={onExportClick}>
                Export → PNG (clear)
              </button>
              <button id="clearBtn" className="btn" type="button" onClick={onClearClick} style={{ marginLeft: 8 }}>
                Clear All
              </button>
            </div>
          </div>

          <div id="info">Notes: times snap to nearest 15 minutes. Remarks are placed below the grid and won't overlap (auto-rows). Vertical connectors are drawn at matching end/start times inside the grid.</div>

          <svg id="logSVG" ref={svgRef} xmlns="http://www.w3.org/2000/svg"></svg>
        </section>

        <div className="two-col">
          <div>
            <label>Remarks</label>
            <textarea placeholder="Enter any remarks, locations, and details here..." id="remarksOutside" ref={remarksOutsideRef}></textarea>
          </div>

          <div>
            <label>Shipping Documents</label>
            <input type="text" placeholder="DVIR or Manifest No." style={{ marginBottom: 8 }} id="shippingDoc" ref={shippingDocRef} />
            <input type="text" placeholder="Shipper & Commodity" id="shipperCommodity" ref={shipperCommodityRef} />
          </div>
        </div>

        <section className="recap" aria-label="recap">
          <h3 style={{ margin: "0 0 8px 0" }}>Recap (Complete at end of day)</h3>
          <table>
            <thead>
              <tr>
                <th>Drivers</th>
                <th>On duty hours today</th>
                <th>A. Total hours on duty last 7 days (incl. today)</th>
                <th>B. Total hours available tomorrow</th>
                <th>C. Total hours on duty last 8 days (incl. today)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input type="text" placeholder="Driver A" /></td>
                <td><input type="text" placeholder="0" /></td>
                <td><input type="text" placeholder="0" /></td>
                <td><input type="text" placeholder="0" /></td>
                <td><input type="text" placeholder="0" /></td>
                <td><input type="text" placeholder="Remarks" /></td>
              </tr>
            </tbody>
          </table>
        </section>

        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => window.print()} style={{ padding: "8px 14px", borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
