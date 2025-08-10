import React, { useEffect, useRef, useState } from "react";

const Log = () => {
  const SVG = useRef(null);

  const HOURS = 24;
  const PX_PER_HOUR = 50; // 50px per hour => GRID_WIDTH = 1200
  const GRID_WIDTH = HOURS * PX_PER_HOUR; // 1200
  const TOTALS_COL_X = GRID_WIDTH + 20;
  const TOTALS_COL_WIDTH = 160;
  const SVG_WIDTH = TOTALS_COL_X + TOTALS_COL_WIDTH + 20;
  const SECTION_HEIGHT = 80;
  const SECTIONS = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty'];
  const STORAGE_KEY = 'svgLogSegments_v3';
  const FONT_FAMILY = 'Arial';
  const REMARK_FONT_SIZE = 12;
  const REMARK_ROW_HEIGHT = 18;
  const REMARK_TOP_GAP = 18; // gap below grid before remarks start
  const EPS = 0.001;

  const [segments, setSegments] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Helper function to create SVG elements
  function createSVG(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // Save segments to localStorage and state
  function save(newSegments) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSegments));
    setSegments(newSegments);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function eq(a, b) { return Math.abs(a - b) < EPS; }

  function snapTo15(hour, min) {
    const total = hour * 60 + min;
    const snapped = Math.round(total / 15) * 15;
    const s = ((snapped % (24 * 60)) + (24 * 60)) % (24 * 60);
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
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  // Drawing the grid, totals, segments, connectors, remarks inside SVG
  function drawAll(currentSegments = segments) {
    const svgElem = SVG.current;
    if (!svgElem) return;

    const gridHeight = SECTIONS.length * SECTION_HEIGHT;
    while (svgElem.firstChild) svgElem.removeChild(svgElem.firstChild);

    svgElem.setAttribute('width', SVG_WIDTH);
    svgElem.setAttribute('height', gridHeight + 200);

    svgElem.appendChild(createSVG('rect', { x: 0, y: 0, width: GRID_WIDTH, height: gridHeight, fill: '#fff' }));

    SECTIONS.forEach((label, i) => {
      const y = i * SECTION_HEIGHT;
      svgElem.appendChild(createSVG('rect', { x: 0, y, width: GRID_WIDTH, height: SECTION_HEIGHT, fill: 'none', stroke: '#000' }));
      const t = createSVG('text', { x: 6, y: y + 16, 'font-size': 14, 'font-family': FONT_FAMILY });
      t.textContent = label;
      svgElem.appendChild(t);
    });

    for (let h = 0; h <= HOURS; h++) {
      const x = h * PX_PER_HOUR;
      svgElem.appendChild(createSVG('line', { x1: x, y1: 0, x2: x, y2: gridHeight, stroke: '#000', 'stroke-width': 1 }));
      const lab = createSVG('text', { x: x + 2, y: gridHeight + 16, 'font-size': 12, 'font-family': FONT_FAMILY });
      lab.textContent = h % 24;
      svgElem.appendChild(lab);

      if (h < HOURS) {
        for (let s = 1; s < 4; s++) {
          const subX = x + (PX_PER_HOUR * (s / 4));
          const isMid = (s === 2);
          svgElem.appendChild(createSVG('line', { x1: subX, y1: 0, x2: subX, y2: gridHeight, stroke: '#888', 'stroke-width': isMid ? 1.2 : 0.5 }));
        }
      }
    }

    const col = createSVG('rect', { x: TOTALS_COL_X, y: 0, width: TOTALS_COL_WIDTH, height: gridHeight, fill: 'none', stroke: '#000' });
    svgElem.appendChild(col);
    SECTIONS.forEach((label, i) => {
      const y = i * SECTION_HEIGHT;
      svgElem.appendChild(createSVG('text', { x: TOTALS_COL_X + 8, y: y + 18, 'font-size': 13, 'font-family': FONT_FAMILY })).textContent = label;
      svgElem.appendChild(createSVG('text', { id: `total-${i}`, x: TOTALS_COL_X + 8, y: y + 38, 'font-size': 14, 'font-family': FONT_FAMILY, 'font-weight': 'bold' }));
    });
    svgElem.appendChild(createSVG('text', { id: 'grand-total', x: TOTALS_COL_X + 8, y: gridHeight - 8, 'font-size': 14, 'font-family': FONT_FAMILY, 'font-weight': 'bold' }));

    // Draw segments
    currentSegments.forEach((seg) => {
      const y = seg.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
      const hLine = createSVG('line', { x1: seg.fromX, y1: y, x2: seg.toX, y2: y, stroke: 'red', 'stroke-width': 3 });
      svgElem.appendChild(hLine);
    });

    // Draw vertical connectors
    for (let a = 0; a < currentSegments.length; a++) {
      for (let b = 0; b < currentSegments.length; b++) {
        if (a === b) continue;
        const segA = currentSegments[a], segB = currentSegments[b];
        if (eq(segA.toX, segB.fromX) && !eq(segA.toX, segA.fromX)) {
          const y1 = segA.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
          const y2 = segB.sectionIndex * SECTION_HEIGHT + SECTION_HEIGHT / 2;
          const v = createSVG('line', { x1: segA.toX, y1: y1, x2: segA.toX, y2: y2, stroke: 'red', 'stroke-width': 3 });
          svgElem.appendChild(v);
        }
      }
    }

    // Draw remarks below grid
    const remarkItems = currentSegments.map((seg, idx) => ({ x: seg.toX, text: seg.remark || '', idx }));
    const rows = [];
    const placed = [];

    function measureText(text) {
      const t = createSVG('text', { x: 0, y: 0, 'font-size': REMARK_FONT_SIZE, 'font-family': FONT_FAMILY, style: 'visibility:hidden' });
      t.textContent = text || '';
      svgElem.appendChild(t);
      const bbox = t.getBBox();
      svgElem.removeChild(t);
      return { w: bbox.width || (text ? text.length * 7 : 8), h: bbox.height || REMARK_FONT_SIZE + 2 };
    }

    remarkItems.sort((a, b) => a.x - b.x);

    const gridBottomY = gridHeight;
    const remarkBaseY = gridBottomY + REMARK_TOP_GAP;

    remarkItems.forEach(item => {
      const meas = measureText(item.text);
      const width = meas.w;
      let centerX = clamp(item.x, 4 + width / 2, GRID_WIDTH - 4 - width / 2);
      let left = centerX - width / 2;
      let right = centerX + width / 2;
      let foundRow = -1;
      const PAD = 6;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        let overlap = row.some(rr => !(right + PAD < rr.left || left - PAD > rr.right));
        if (!overlap) { foundRow = r; break; }
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
    svgElem.setAttribute('height', Math.max(requiredHeight, svgElem.getAttribute('height')));

    placed.forEach(p => {
      const textTop = p.textY - p.textHeight;
      const v = createSVG('line', { x1: p.x, y1: gridBottomY, x2: p.x, y2: textTop - 4, stroke: '#00f', 'stroke-width': 1 });
      svgElem.appendChild(v);
      const t = createSVG('text', { x: p.textX, y: p.textY, 'font-size': REMARK_FONT_SIZE, 'font-family': FONT_FAMILY, fill: '#00f' });
      t.textContent = p.text;
      svgElem.appendChild(t);
    });

    computeTotals(currentSegments);
  }

  function computeTotals(currentSegments) {
    const svgElem = SVG.current;
    if (!svgElem) return;

    const totals = [0, 0, 0, 0];
    currentSegments.forEach(seg => {
      const hoursSpan = (seg.toX - seg.fromX) / PX_PER_HOUR;
      if (!isNaN(hoursSpan) && hoursSpan > 0) totals[seg.sectionIndex] += hoursSpan;
    });
    totals.forEach((val, i) => {
      const el = svgElem.querySelector(`#total-${i}`);
      if (el) el.textContent = formatHHMMDecimal(val);
    });
    const grand = totals.reduce((a, b) => a + b, 0);
    const ge = svgElem.querySelector('#grand-total');
    if (ge) ge.textContent = `Total: ${formatHHMMDecimal(grand)}`;
  }

  // Add new segment
  function addSegmentFromForm(fromH, fromM, toH, toM, sectionIndex, remark) {
    const sFrom = snapTo15(fromH, fromM);
    const sTo = snapTo15(toH, toM);
    let fromX = timeToX(sFrom.h, sFrom.m);
    let toX = timeToX(sTo.h, sTo.m);

    let newSegments = [...segments];
    if (newSegments.length > 0) {
      const last = newSegments[newSegments.length - 1];
      fromX = last.toX;
    }

    const END_OF_DAY = GRID_WIDTH;

    if (toX >= fromX) {
      newSegments.push({ fromX, toX, sectionIndex, remark });
    } else {
      newSegments.push({ fromX, toX: END_OF_DAY, sectionIndex, remark });
      newSegments.push({ fromX: 0, toX: toX, sectionIndex, remark });
    }

    save(newSegments);
  }

  // Clear all entries
  function clearAll() {
    if (!window.confirm('Clear all entries?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setSegments([]);
  }

  // Handle form submit
  function onSubmit(e) {
    e.preventDefault();
    const fromH = parseInt(e.target.fromHour.value, 10);
    const fromM = parseInt(e.target.fromMin.value, 10);
    const toH = parseInt(e.target.toHour.value, 10);
    const toM = parseInt(e.target.toMin.value, 10);
    const sectionIndex = parseInt(e.target.section.value, 10);
    const remark = e.target.remark.value.trim();

    if (isNaN(fromH) || isNaN(toH)) {
      alert('Please provide valid hours');
      return;
    }
    addSegmentFromForm(fromH, fromM, toH, toM, sectionIndex, remark);
    e.target.reset();
  }

  // Export to PNG (using canvas)
  function exportToPNG() {
    const svgElem = SVG.current;
    if (!svgElem) return;

    const printable = document.getElementById('printableArea');

    // Serialize SVG with remarks
    const serializer = new XMLSerializer();
    const cloneSVG = svgElem.cloneNode(true);
    cloneSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    cloneSVG.setAttribute('width', SVG_WIDTH);
    cloneSVG.setAttribute('height', svgElem.getAttribute('height') || (SECTIONS.length * SECTION_HEIGHT + 200));
    const svgSource = '<?xml version="1.0" standalone="no"?>\r\n' + serializer.serializeToString(cloneSVG);

    function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
    const imgSrc = 'data:image/svg+xml;base64,' + utf8ToBase64(svgSource);

    const img = new Image();

    img.onload = () => {
      const headerHeight = 160;
      const remarksHeight = 140;
      const canvasWidth = SVG_WIDTH + 40;
      const canvasHeight = headerHeight + img.height + remarksHeight + 40;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.fillStyle = '#111';
      ctx.font = '20px Arial';
      ctx.fillText('Drivers Daily Log', 20, 30);

      ctx.font = '14px Arial';
      ctx.fillText('(24 hours) — Original: File at home terminal — Duplicate: Driver retains in his/her possession', 20, 60);

      ctx.font = '13px Arial';
      const metaFields = [
        ['Date:', document.getElementById('logDate').value],
        ['From:', document.getElementById('fromLocation').value],
        ['To:', document.getElementById('toLocation').value],
        ['Miles Driving Today:', document.getElementById('milesDriving').value],
        ['Total Mileage Today:', document.getElementById('totalMileage').value],
        ['Carrier:', document.getElementById('carrierName').value],
        ['Truck/Tractor & Trailer:', document.getElementById('truckNumber').value],
        ['Main Office Address:', document.getElementById('mainOffice').value],
        ['Home Terminal Address:', document.getElementById('homeTerminal').value]
      ];
      let yMeta = 90;
      metaFields.forEach(([label, val]) => {
        ctx.fillText(`${label} ${val}`, 20, yMeta);
        yMeta += 18;
      });

      ctx.drawImage(img, 20, headerHeight);

      ctx.fillStyle = '#111';
      ctx.font = '14px Arial';
      ctx.fillText('Remarks:', 20, headerHeight + img.height + 30);
      ctx.font = '13px Arial';
      const remarksText = document.getElementById('remarksOutside').value.trim() || '(none)';
      const maxWidth = canvasWidth - 40;
      const lineHeight = 18;
      const words = remarksText.split(/\s+/);
      let line = '';
      let y = headerHeight + img.height + 55;
      words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          ctx.fillText(line, 20, y);
          line = word + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      });
      if (line) {
        ctx.fillText(line, 20, y);
      }

      const link = document.createElement('a');
      const filename = 'drivers_daily_log_' + Date.now() + '.png';
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();

      localStorage.removeItem(STORAGE_KEY);
      setSegments([]);
      drawAll([]);

      alert('Exported ' + filename + ' and cleared saved logs.');
    };

    img.onerror = () => {
      alert('Export failed: Could not load SVG as image.');
    };

    img.src = imgSrc;
  }

  useEffect(() => {
    // Make sure to sync and draw when segments change
    drawAll(segments);
  }, [segments]);

  useEffect(() => {
    // On mount, normalize segments loaded from storage
    const normalized = segments.map(s => ({
      fromX: Number(s.fromX),
      toX: Number(s.toX),
      sectionIndex: Number(s.sectionIndex),
      remark: s.remark || ''
    }));
    setSegments(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        /* === Existing Styles + Responsive Enhancements === */
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f8f8f8;
          margin: 0;
          padding: 0;
        }

        .container {
          max-width: 1100px;
          margin: 22px auto;
          background: #fff;
          border-radius: 6px;
          padding: 18px;
          box-shadow: 0 4px 18px rgba(0,0,0,0.06);
        }

        #controls {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          margin-bottom: 16px;
          gap: 12px;
        }

        form {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        label {
          display: flex;
          flex-direction: column;
          font-size: 13px;
          min-width: 60px;
          margin-bottom: 4px;
        }

        input[type="text"],
        input[type="number"],
        select,
        textarea,
        input[type="date"] {
          padding: 6px 8px;
          border: 1px solid #bbb;
          border-radius: 4px;
          font-size: 14px;
          font-family: Arial, Helvetica, sans-serif;
          width: 100%;
          box-sizing: border-box;
        }

        textarea {
          resize: vertical;
          min-height: 60px;
        }

        button {
          cursor: pointer;
          background: #111;
          color: #fff;
          border: none;
          padding: 8px 14px;
          border-radius: 5px;
          font-size: 14px;
          white-space: nowrap;
        }

        button:hover {
          background: #333;
        }

        #logSVG {
          width: 100% !important;
          height: auto !important;
          max-width: 1200px;
          background: #fff;
          display: block;
          margin-top: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }

        /* Mobile responsiveness */
        @media (max-width: 700px) {
          #controls {
            flex-direction: column;
            align-items: stretch;
          }
          form {
            flex-direction: column;
            gap: 12px;
          }
          label {
            min-width: auto;
          }
          button {
            width: 100%;
          }
        }
      `}</style>

      <div className="container" id="printableArea">
        <h1>Drivers Daily Log</h1>

        <div id="controls">
          <form onSubmit={onSubmit} aria-label="Add log segment form">
            <label>
              From Hour
              <input type="number" name="fromHour" min="0" max="23" defaultValue="0" required />
            </label>
            <label>
              From Minute
              <input type="number" name="fromMin" min="0" max="59" step="15" defaultValue="0" required />
            </label>
            <label>
              To Hour
              <input type="number" name="toHour" min="0" max="23" defaultValue="1" required />
            </label>
            <label>
              To Minute
              <input type="number" name="toMin" min="0" max="59" step="15" defaultValue="0" required />
            </label>
            <label>
              Section
              <select name="section" defaultValue="0" required>
                {SECTIONS.map((sec, i) => (
                  <option key={i} value={i}>{sec}</option>
                ))}
              </select>
            </label>
            <label>
              Remark
              <input type="text" name="remark" maxLength="60" placeholder="Optional" />
            </label>
            <button type="submit">Add Segment</button>
          </form>

          <button onClick={clearAll} aria-label="Clear all entries">Clear All</button>
          <button onClick={exportToPNG} aria-label="Export log as PNG">Export PNG</button>
        </div>

        {/* Meta info inputs for export */}
        <div style={{ marginBottom: '16px' }}>
          <label>
            Date:
            <input type="date" id="logDate" defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label>
            From:
            <input type="text" id="fromLocation" placeholder="Starting Location" />
          </label>
          <label>
            To:
            <input type="text" id="toLocation" placeholder="Destination" />
          </label>
          <label>
            Miles Driving Today:
            <input type="text" id="milesDriving" />
          </label>
          <label>
            Total Mileage Today:
            <input type="text" id="totalMileage" />
          </label>
          <label>
            Carrier:
            <input type="text" id="carrierName" />
          </label>
          <label>
            Truck/Tractor & Trailer:
            <input type="text" id="truckNumber" />
          </label>
          <label>
            Main Office Address:
            <input type="text" id="mainOffice" />
          </label>
          <label>
            Home Terminal Address:
            <input type="text" id="homeTerminal" />
          </label>
        </div>

        <textarea
          id="remarksOutside"
          placeholder="Remarks outside the box (will be added to exported PNG)"
          style={{ width: '100%', minHeight: '60px', marginBottom: '18px' }}
        ></textarea>

        <svg id="logSVG" ref={SVG} />
      </div>
    </>
  );
};

export default Log;
