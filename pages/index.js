// pages/index.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Wheel from "../components/Wheel";
import PlaceCard from "../components/PlaceCard";
import {
  CATEGORY_GROUPS,
  DEFAULT_RADIUS_METERS,
  DEFAULT_TYPES,
} from "../lib/categories";

// lazy-load confetti (no SSR)
const confettiImport = () => import("canvas-confetti");

export default function Home() {
  const [pos, setPos] = useState({ lat: null, lng: null });
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS);
  const [selectedTypes, setSelectedTypes] = useState(new Set(DEFAULT_TYPES));
  const [openNow, setOpenNow] = useState(false);

  // distance presets for SG (approximate)
  const [travelPreset, setTravelPreset] = useState("walking_10"); // walking_10 | walking_20 | transit_20 | driving_15 | driving_30

  // map preset to radius meters (conservative SG-city assumptions)
  function presetToRadius(preset) {
    switch (preset) {
      case "walking_10":
        return 800; // ~10 min walk
      case "walking_20":
        return 1600; // ~20 min walk
      case "transit_20":
        return 4000; // ~20 min MRT/bus door-to-door
      case "driving_15":
        return 6000; // ~15 min drive
      case "driving_30":
        return 10000; // ~30 min drive
      default:
        return DEFAULT_RADIUS_METERS;
    }
  }

  // whenever preset changes, auto-apply radius
  useEffect(() => {
    setRadius(presetToRadius(travelPreset));
  }, [travelPreset]);

  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [picks, setPicks] = useState(new Set()); // picked place_ids
  const [weights, setWeights] = useState({}); // place_id -> 1|2|3
  const [blacklist, setBlacklist] = useState(new Set()); // place_ids to exclude
  const [winner, setWinner] = useState(null);
  const [lastWinnerId, setLastWinnerId] = useState(null);
  const [history, setHistory] = useState([]); // [{name,address,time,place_id}]
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("light");

  // apply theme on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // geolocation autofill
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (g) => setPos({ lat: g.coords.latitude, lng: g.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const typesCSV = useMemo(
    () => Array.from(selectedTypes).join(","),
    [selectedTypes]
  );

  async function search() {
    setError("");
    setWinner(null);
    if (pos.lat == null || pos.lng == null) {
      setError("Set your location first (auto or manual).");
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({
        lat: String(pos.lat),
        lng: String(pos.lng),
        radius: String(radius),
        types: typesCSV,
        openNow: String(openNow),
      });
      const r = await fetch(`/api/places?${q}`);
      const data = await r.json();
      if (r.ok) {
        const filtered = data.results.filter((p) => !blacklist.has(p.place_id));
        setPlaces(filtered);
        setPicks(new Set());
        setWeights({});
      } else {
        setError(data?.error || "Search failed");
      }
    } catch (e) {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function toggleType(type) {
    const next = new Set(selectedTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setSelectedTypes(next);
  }
  function selectAllCategories() {
    setSelectedTypes(new Set(DEFAULT_TYPES));
  }
  function clearAllCategories() {
    setSelectedTypes(new Set());
  }

  function togglePick(placeId) {
    const next = new Set(picks);
    if (next.has(placeId)) next.delete(placeId);
    else next.add(placeId);
    setPicks(next);
    if (!weights[placeId]) setWeights((prev) => ({ ...prev, [placeId]: 1 }));
  }

  function setWeight(placeId, w) {
    setWeights((prev) => ({ ...prev, [placeId]: w }));
  }

  function addToBlacklist(placeId) {
    const next = new Set(blacklist);
    next.add(placeId);
    setBlacklist(next);
    // remove from current lists
    setPlaces((prev) => prev.filter((p) => p.place_id !== placeId));
    setPicks((prev) => {
      const s = new Set(prev);
      s.delete(placeId);
      return s;
    });
  }

  const pickList = places.filter((p) => picks.has(p.place_id));
  const pickWeights = pickList.map((p) => weights[p.place_id] || 1);

  // Reroll (exclude last winner)
  function rerollExcludeLast() {
    if (!lastWinnerId) return;
    const filtered = pickList.filter((p) => p.place_id !== lastWinnerId);
    const fWeights = filtered.map((p) => weights[p.place_id] || 1);
    setTempSpin({
      items: filtered,
      w: fWeights,
      exclude: lastWinnerId,
      ts: Date.now(),
    });
  }

  // Small trick: pass a "temp spin" once to Wheel to spin a filtered list
  const [tempSpin, setTempSpin] = useState(null);

  // Confetti helper
  const confettiOnce = useRef(null);
  async function fireConfetti() {
    if (!confettiOnce.current) {
      const mod = await confettiImport();
      confettiOnce.current = mod.default;
    }
    const conf = confettiOnce.current;
    conf({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    setTimeout(
      () => conf({ particleCount: 40, spread: 100, origin: { y: 0.6 } }),
      200
    );
  }

  // Share helpers
  async function shareWinner(item) {
    if (!item) return;
    const text = `Winner: ${item.name}\n${item.address || ""}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      item.name + " " + (item.address || "")
    )}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "FunPicker", text, url });
        return;
      } catch {}
    }
    // fallback buttons will also be visible
    window.open(url, "_blank");
  }

  // when the wheel returns a result
  function handleResult(item) {
    setWinner(item);
    setLastWinnerId(item?.place_id || null);
    setHistory((h) =>
      [
        {
          time: new Date().toISOString(),
          place_id: item.place_id,
          name: item.name,
          address: item.address,
        },
        ...h,
      ].slice(0, 10)
    );
    fireConfetti();
  }

  // theme + global colors
  const openMapsHref = winner
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        winner.name + " " + (winner.address || "")
      )}`
    : "#";

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>untitled wheel</h1>
          <p className="muted">idk bro</p>
        </div>
        <button
          className="btn ghost"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      <section className="panel">
        <h2>1) Location</h2>
        <div className="grid2">
          <div>
            <div className="row">
              <label>Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={pos.lat ?? ""}
                onChange={(e) =>
                  setPos({ ...pos, lat: Number(e.target.value) })
                }
                placeholder="1.3521 (SG)"
              />
            </div>
            <div className="row">
              <label>Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={pos.lng ?? ""}
                onChange={(e) =>
                  setPos({ ...pos, lng: Number(e.target.value) })
                }
                placeholder="103.8198 (SG)"
              />
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={openNow}
                onChange={(e) => setOpenNow(e.target.checked)}
              />{" "}
              Open now only
            </label>
            <div className="row">
              <label>Travel mode</label>
              <select
                value={travelPreset}
                onChange={(e) => setTravelPreset(e.target.value)}
              >
                <option value="walking_10">🚶 Walking ~10 min (~0.8 km)</option>
                <option value="walking_20">🚶 Walking ~20 min (~1.6 km)</option>
                <option value="transit_20">🚆 MRT/Bus ~20 min (~4 km)</option>
                <option value="driving_15">🚗 Driving ~15 min (~6 km)</option>
                <option value="driving_30">🚗 Driving ~30 min (~10 km)</option>
              </select>
            </div>
            <small className="muted">
              Tip: presets auto-set the radius; you can still fine-tune with the
              slider.
            </small>
          </div>

          <div>
            <label>
              Search radius: {Math.round(radius)} m (
              {(radius / 1000).toFixed(2)} km)
            </label>
            <input
              type="range"
              min="500"
              max="10000"
              step="100"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <button className="btn" onClick={search} disabled={loading}>
              {loading ? "Searching..." : "Find nearby places"}
            </button>
            {error && <div className="error">{error}</div>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>2) Categories</h2>
          <div className="actions">
            <button className="btn small" onClick={selectAllCategories}>
              Select all
            </button>
            <button className="btn small ghost" onClick={clearAllCategories}>
              Clear all
            </button>
          </div>
        </div>

        <div className="cats">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.id} className="cat-group">
              <h3>{group.label}</h3>
              <div className="chips">
                {group.types.map((t) => (
                  <button
                    key={t}
                    className={`chip ${selectedTypes.has(t) ? "on" : ""}`}
                    onClick={() => toggleType(t)}
                  >
                    {t.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>3) Pick favorites</h2>
        <div className="grid-list">
          {places.length === 0 && (
            <div className="muted">
              No results yet. Hit “Find nearby places”.
            </div>
          )}
          {places.map((p) => (
            <PlaceCard
              key={p.place_id}
              place={p}
              checked={picks.has(p.place_id)}
              weight={weights[p.place_id] || 1}
              onToggle={(e) => {
                e.stopPropagation();
                togglePick(p.place_id);
              }}
              onBlacklist={() => addToBlacklist(p.place_id)}
              onWeight={(w) => setWeight(p.place_id, w)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>4) Spin</h2>
        <div className="spin-area">
          {tempSpin ? (
            <Wheel
              key={tempSpin.ts} // force a one-off reroll render
              items={tempSpin.items}
              weights={tempSpin.w}
              onResult={(item) => {
                setTempSpin(null);
                handleResult(item);
              }}
              theme={theme}
            />
          ) : (
            <Wheel
              items={pickList}
              weights={pickWeights}
              onResult={handleResult}
              theme={theme}
            />
          )}

          <div className="winner">
            {winner ? (
              <div className="win-card">
                <div className="lbl">Winner</div>
                <div className="name">{winner.name}</div>
                <div className="addr">{winner.address}</div>

                <div className="rowbtns">
                  <a
                    className="btn small"
                    href={openMapsHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps ↗
                  </a>
                  <button
                    className="btn small"
                    onClick={() => shareWinner(winner)}
                  >
                    Share
                  </button>
                  <a
                    className="btn small ghost"
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${winner.name}\n${winner.address || ""}\n${openMapsHref}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    className="btn small ghost"
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      openMapsHref
                    )}&text=${encodeURIComponent(
                      `${winner.name}\n${winner.address || ""}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Telegram
                  </a>
                </div>

                <div className="rowbtns">
                  <button
                    className="btn small"
                    onClick={rerollExcludeLast}
                    disabled={!lastWinnerId || pickList.length < 2}
                  >
                    Reroll (exclude last)
                  </button>
                </div>
              </div>
            ) : (
              <div className="muted">Add some picks, then spin the wheel.</div>
            )}

            {history.length > 0 && (
              <div className="history">
                <div className="h-head">
                  <strong>Recent winners</strong>
                  <button
                    className="btn small ghost"
                    onClick={() => setHistory([])}
                  >
                    Clear
                  </button>
                </div>
                <ul>
                  {history.map((h, i) => (
                    <li key={i}>
                      <span className="h-name">{h.name}</span>
                      <span className="h-addr">{h.address}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="support">
          <div className="support-text">
            Enjoying the app? <span className="sparkle">🌚</span>
          </div>
          <a
            className="bmac"
            href="https://buymeacoffee.com/bryanw"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Buy Bryan a coffee"
          >
            <span className="cup">☕</span>
            <span>Buy me a kopi</span>
          </a>
        </div>
        <div className="credit muted">
          Built with Next.js + Places API and my lord and savior Chet Gipeeti.
        </div>
      </footer>

      {/* global theme vars */}
      <style jsx global>{`
        :root {
          --bg: #f8fafc;
          --card: #ffffff;
          --ink: #0f172a;
          --muted: #64748b;
          --line: #e2e8f0;
          --chip: #f1f5f9;
          --chip-on: #dbeafe;
          --chip-on-border: #93c5fd;
          --btn: #ffffff;
          --btn-ink: #0f172a;
          --shadow: 0 8px 24px rgba(2, 6, 23, 0.12);
          --cta-bg: #111827;
          --cta-ink: #ffffff;
          --accent-grad1: #fde68a; /* amber-300 */
          --accent-grad2: #93c5fd; /* blue-300 */
        }
        .dark {
          --bg: #0b1220;
          --card: #0f172a;
          --ink: #e2e8f0;
          --muted: #94a3b8;
          --line: #1f2937;
          --chip: #0b1220;
          --chip-on: #1e293b;
          --chip-on-border: #334155;
          --btn: #111827;
          --btn-ink: #e5e7eb;
          --shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          --cta-bg: #eab308; /* amber-500 */
          --cta-ink: #111827; /* near-black text on amber */
          --accent-grad1: #1e293b; /* slate-800 */
          --accent-grad2: #334155; /* slate-700 */
        }
        html,
        body,
        #__next {
          height: 100%;
        }
        body {
          background: var(--bg);
          color: var(--ink);
        }
        h1,
        h2,
        h3 {
          color: var(--ink);
        }
      `}</style>

      {/* scoped styles */}
      <style jsx>{`
        .container {
          max-width: 980px;
          margin: 24px auto;
          padding: 0 16px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        header h1 {
          margin: 0;
        }
        .muted {
          color: var(--muted);
        }
        .panel {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          box-shadow: var(--shadow);
        }
        .panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 800px) {
          .grid2 {
            grid-template-columns: 1fr;
          }
        }
        .row {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
        }
        .row label {
          width: 100px;
          color: var(--ink);
          opacity: 0.8;
        }
        input[type="number"],
        input[type="text"] {
          flex: 1;
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--bg);
          color: var(--ink);
        }
        select {
          padding: 8px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--bg);
          color: var(--ink);
        }
        input[type="range"] {
          width: 100%;
        }
        .switch {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .btn {
          margin-top: 8px;
          padding: 10px 14px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--btn);
          color: var(--btn-ink);
          cursor: pointer;
          font-weight: 600;
        }
        .btn.small {
          padding: 6px 10px;
          margin-top: 0;
        }
        .btn.ghost {
          background: transparent;
        }
        .error {
          margin-top: 8px;
          color: #ef4444;
        }
        .cats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .cat-group h3 {
          margin: 6px 0;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--chip);
          color: var(--ink);
        }
        .chip.on {
          background: var(--chip-on);
          border-color: var(--chip-on-border);
        }
        .grid-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .grid-list {
            grid-template-columns: 1fr;
          }
        }
        .spin-area {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .spin-area {
            grid-template-columns: 1fr;
          }
        }
        .winner .win-card {
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 12px;
          background: var(--card);
        }
        .winner .lbl {
          font-size: 12px;
          color: var(--muted);
        }
        .winner .name {
          font-size: 16px;
          font-weight: 700;
        }
        .winner .addr {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
        }
        .rowbtns {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        .history {
          margin-top: 12px;
          border-top: 1px solid var(--line);
          padding-top: 8px;
        }
        .history .h-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .history ul {
          margin: 8px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }
        .history li {
          display: flex;
          flex-direction: column;
        }
        .h-name {
          font-weight: 600;
        }
        .h-addr {
          font-size: 12px;
          color: var(--muted);
        }

        .footer {
          margin: 24px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
        .support {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 14px 16px;
          background: linear-gradient(
            135deg,
            var(--accent-grad1),
            var(--accent-grad2)
          );
          border: 1px solid var(--line);
          border-radius: 14px;
          box-shadow: var(--shadow);
        }
        .bmac {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          background: var(--cta-bg);
          color: var(--cta-ink);
          text-decoration: none;
          font-weight: 800;
          letter-spacing: 0.2px;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
          transition: transform 0.12s ease, box-shadow 0.12s ease,
            filter 0.12s ease;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .bmac:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.32);
          filter: brightness(1.05);
        }
        .cup {
          font-size: 18px;
        }
        .sparkle {
          margin-left: 4px;
        }
        .credit {
          text-align: center;
        }
      `}</style>
    </div>
  );
}
