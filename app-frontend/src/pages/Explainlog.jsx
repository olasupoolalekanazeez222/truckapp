export default function Explainlog() {
  const steps = [
    {
      title: '1) At-a-glance — What this file does',
      body: (
        <>
          <p>
            This file implements a 24-hour driver activity tracker using an SVG timeline.
            Users add segments (Off Duty / Sleeper / Driving / On Duty), remarks appear below the grid,
            totals are computed per category, segments are saved to <code>localStorage</code>, and the whole
            SVG can be exported to PNG.
          </p>
        </>
      )
    },
    {
      title: '2) HTML structure & key DOM elements',
      body: (
        <>
          <p>Important DOM elements you interact with from JS:</p>
          <ul>
            <li><code>#printableArea</code> — container used when exporting.</li>
            <li><code>#svgLogContainer</code> — section that holds controls and the SVG tracker.</li>
            <li><code>#logForm</code> — the form that collects from/to times, section, and remark.</li>
            <li><code>#logSVG</code> — the actual SVG element where the grid, segments and remarks are drawn.</li>
            <li>Export / Clear buttons — trigger the PNG export and clearing saved segments.</li>
          </ul>
        </>
      )
    },
    {
      title: '3) CSS & visual layout (brief)',
      body: (
        <>
          <p>
            The file uses a modern, flexible layout with CSS variables and grid/flex for the form and meta fields.
            The SVG is placed in its own container. Print-specific and responsive rules are included.
          </p>
          <p><strong>Mobile-friendly notes:</strong> the code uses media queries to collapse columns when the width is small; the explanation below also uses responsive styling.</p>
        </>
      )
    },
    {
      title: '4) Geometry & constants (how the timeline maps to pixels)',
      body: (
        <>
          <p>Key numeric constants define the timeline:</p>
          <ul>
            <li><code>HOURS = 24</code> — number of hours represented.</li>
            <li><code>PX_PER_HOUR = 50</code> — how many pixels per hour (so 24 * 50 = 1200px grid width).</li>
            <li><code>GRID_WIDTH</code> — computed as hours * px/hour.</li>
            <li><code>SECTION_HEIGHT</code> — height allocated to each activity row (Off Duty / Driving, etc.).</li>
            <li><code>TOTALS_COL_X</code> and <code>SVG_WIDTH</code> — columns for totals and overall svg width.</li>
          </ul>
          <p>This mapping lets the code convert between time (hh:mm) and X coordinates in the SVG.</p>
        </>
      )
    },
    {
      title: '5) State & persistence',
      body: (
        <>
          <p>
            Segments are kept in the `segments` array and persisted to localStorage under the key:
            <code>svgLogSegments_v3</code>. Each stored item has:
          </p>
          <ul>
            <li><code>fromX</code> & <code>toX</code> — pixel positions on the grid.</li>
            <li><code>sectionIndex</code> — integer 0..3 mapping to ['Off Duty','Sleeper Berth','Driving','On Duty'].</li>
            <li><code>remark</code> — optional text shown below the grid.</li>
          </ul>
        </>
      )
    },
    {
      title: '6) Helper utilities',
      body: (
        <>
          <p>The code includes general-purpose helpers:</p>
          <ul>
            <li><code>createSVG(tag, attrs)</code> — convenience to create namespaced SVG elements.</li>
            <li><code>save()</code> — writes segments to localStorage.</li>
            <li><code>snapTo15(h,m)</code> — snaps a time to the nearest 15 minutes (used for inputs).</li>
            <li><code>timeToX(h,m)</code> and <code>xToTime(x)</code> — conversions between time & X position.</li>
            <li><code>formatHHMMDecimal(decHours)</code> — converts decimal hours to "HH:MM" formatted string.</li>
          </ul>
          <pre style={{whiteSpace:'pre-wrap', fontSize:13}}>
{`function snapTo15(hour, min) {
  const total = hour*60 + min;
  const snapped = Math.round(total / 15) * 15;
  const s = ((snapped % (24*60)) + (24*60)) % (24*60);
  return { h: Math.floor(s/60), m: s % 60 };
}`}
          </pre>
        </>
      )
    },
    {
      title: '7) Drawing the grid (`drawGrid`)',
      body: (
        <>
          <p>What <code>drawGrid(gridHeight)</code> does:</p>
          <ol>
            <li>Clears the SVG contents and sets width/height attributes.</li>
            <li>Draws a background rect that becomes the timeline canvas.</li>
            <li>For each section (Off Duty / Driving / etc.) draws a horizontal band and a label.</li>
            <li>Draws vertical hour lines across the 24-hour width. Each hour shows a numeric label.</li>
            <li>Adds lighter quarter-hour sub-lines between hours for quarter marks (15/30/45).</li>
            <li>Renders a right-hand "totals" column with placeholders (<code>#total-0..3</code> &amp; <code>#grand-total</code>).</li>
          </ol>
        </>
      )
    },
    {
      title: '8) Calculating totals (`computeTotals`)',
      body: (
        <>
          <p>
            Totals are computed by summing the pixel-width of each segment for a section and converting to hours:
            <code>hoursSpan = (seg.toX - seg.fromX) / PX_PER_HOUR</code>.
            Each section's total is updated into the corresponding SVG text element and a grand total is shown.
          </p>
        </>
      )
    },
    {
      title: '9) Rendering segments & connectors (`drawAll` — overview)',
      body: (
        <>
          <p><strong>Steps inside <code>drawAll()</code>:</strong></p>
          <ol>
            <li>Call <code>drawGrid()</code> to render baseline lines and the totals column.</li>
            <li>For each segment, draw a horizontal line at the appropriate section row (red thick line).</li>
            <li>Look for pairs of segments where one segment's <code>toX</code> equals another's <code>fromX</code>. For those, draw an internal vertical connector line (red) between the two rows — this shows a direct transition between activity types at the same time.</li>
            <li>Collect remark items (based on segment <code>toX</code>) and arrange them below the grid without overlap (see next step).</li>
          </ol>
        </>
      )
    },
    {
      title: '10) Remarks placement algorithm (avoid overlap)',
      body: (
        <>
          <p>This is an important, slightly sophisticated part:</p>
          <ol>
            <li>Collect all remarks into an array of items with their X coordinate and text.</li>
            <li>Measure the text width by temporarily creating an invisible SVG text node and calling <code>getBBox()</code>. If measurement fails it falls back to a heuristic character width.</li>
            <li>Sort remarks by X coordinate.</li>
            <li>Place each remark into the first row where it does not horizontally overlap any existing remark in that row. If no row fits, create a new row.</li>
            <li>For each placed remark, draw a thin blue vertical connector from the grid bottom up to just above the text, and then render the blue text at the computed X/Y that keeps it inside the grid width.</li>
            <li>Finally, increase the SVG height as needed to make room for the remark rows so they never overlap the grid.</li>
          </ol>
          <p><strong>Why this works:</strong> the algorithm greedily packs non-overlapping labels into the minimal number of rows, so you get tidy stacked remark rows without overlaps.</p>
        </>
      )
    },
    {
      title: '11) Adding a new segment (`addSegmentFromForm`)',
      body: (
        <>
          <p>When the user submits the form, inputs are:</p>
          <ul>
            <li>from hour/min, to hour/min — snapped to 15 minutes</li>
            <li>sectionIndex — which activity row</li>
            <li>remark — text (optional)</li>
          </ul>
          <p>Key behavior:</p>
          <ul>
            <li>Times are snapped using <code>snapTo15</code>.</li>
            <li><strong>Important:</strong> If there are already segments, the code sets the new segment's <code>fromX</code> equal to the last segment's <code>toX</code>, making segments act sequentially by default.</li>
            <li>If the new segment crosses midnight (toX < fromX), it is split into two segments: from current point to END_OF_DAY, and from 0 to the toX (wrap-around).</li>
            <li>Segments are pushed into the state array, saved, and <code>drawAll()</code> is called to refresh the UI.</li>
          </ul>
          <p><em>Note:</em> automatically forcing <code>fromX = last.toX</code> may be intentional (for a linear log) but can also be adjusted if you want arbitrary, independent entries.</p>
        </>
      )
    },
    {
      title: '12) Event handlers (user interaction)',
      body: (
        <>
          <p>Key event handlers wired up in the file:</p>
          <ul>
            <li><code>#logForm submit</code> — prevents default, reads input values, validates, calls <code>addSegmentFromForm</code> and resets the form.</li>
            <li><code>#exportBtn click</code> — serializes the SVG and builds a PNG via a canvas, draws header/meta text + SVG, triggers download, clears localStorage and segments.</li>
            <li><code>#clearBtn click</code> — asks for confirmation and clears all segments + storage + redraws.</li>
          </ul>
        </>
      )
    },
    {
      title: '13) Export to PNG — how it works',
      body: (
        <>
          <p>High level steps:</p>
          <ol>
            <li>Clone the SVG node, serialize it to an SVG string, and base64-encode it to produce a data URI.</li>
            <li>Create an <code>Image</code> and set the <code>src</code> to that data URI.</li>
            <li>Once loaded, create a canvas sized to include header/meta + the svg image + the "remarks outside" box; draw header and meta fields using <code>canvas</code> text APIs, then draw the SVG image.</li>
            <li>Wrap and draw the outside remarks text onto the canvas, then call <code>canvas.toDataURL('image/png')</code>, and initiate a download link click.</li>
          </ol>
          <p><strong>Caveats:</strong> This is a simple, custom export that works well for plain SVGs and textual meta. Complex external styles or web fonts may not render identically in the exported image. For pixel-perfect full-page exports you could integrate <code>html2canvas</code> or server-side rendering.</p>
        </>
      )
    },
    {
      title: '14) Initialization & data migration',
      body: (
        <>
          <p>On load (<code>init()</code>):</p>
          <ul>
            <li>Read segments from <code>localStorage</code>, coerce numeric fields (<code>fromX/toX/sectionIndex</code>), and call <code>drawAll()</code>.</li>
            <li>The conversion ensures any strings saved previously become numbers again (defensive coding).</li>
          </ul>
        </>
      )
    },
    {
      title: '15) Common gotchas & suggested improvements',
      body: (
        <>
          <p><strong>Gotchas</strong></p>
          <ul>
            <li>Because <code>addSegmentFromForm</code> forces <code>fromX = last.toX</code>, you can’t insert a new independent segment at an earlier time without changing the code.</li>
            <li>Text measuring uses <code>getBBox()</code>, which is reliable for SVG but can fail if fonts aren’t loaded — the code provides a fallback heuristic.</li>
            <li>Export might lose external CSS or web fonts; it serializes inline SVG only.</li>
          </ul>
          <p><strong>Improvements you might add</strong></p>
          <ul>
            <li>Allow editing and dragging segments (pointer handlers + updating fromX/toX).</li>
            <li>Make the X scale responsive (use an SVG viewBox or compute PX_PER_HOUR from container width).</li>
            <li>Better export quality by applying <code>window.devicePixelRatio</code> to canvas size.</li>
            <li>Add undo/redo and versioning in localStorage (so <code>v3</code> can migrate automatically).</li>
            <li>Make remark text truncation + tooltip for very long text.</li>
          </ul>
        </>
      )
    }
  ];

  return (
    <div className="explain-wrap">
      <style>{`
        .explain-wrap {
          --card-bg: #fff;
          --muted: #666;
          max-width: 820px;
          margin: 12px auto;
          padding: 10px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          color: #111;
        }
        .explain-wrap h2 {
          margin: 6px 0 12px;
          font-size: 18px;
          letter-spacing: 0.2px;
        }
        .step {
          background: var(--card-bg);
          border-radius: 10px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
          padding: 10px;
          margin-bottom: 12px;
          border: 1px solid #eee;
        }
        details summary {
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          list-style: none;
          outline: none;
          padding: 6px 2px;
        }
        .step-body { margin-top: 8px; font-size: 14px; color: #222; line-height: 1.45; }
        pre { background: #f6f8fa; padding: 10px; border-radius: 6px; overflow:auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace; font-size: 13px; }
        code { background: #f2f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
        ul { margin: 6px 0 10px 18px; }
        @media (max-width: 560px) {
          .explain-wrap { padding: 8px; margin: 6px; }
          .step { padding: 8px; }
          details summary { font-size: 14px; }
        }
      `}</style>

      <h2>Driver’s Daily Log — Step-by-step explanation</h2>

      {steps.map((s, i) => (
        <div key={i} className="step" aria-labelledby={`step-${i}`}>
          <details open={i === 0}>
            <summary id={`step-${i}`}>{s.title}</summary>
            <div className="step-body">{s.body}</div>
          </details>
        </div>
      ))}
    </div>
  );
      }
              
