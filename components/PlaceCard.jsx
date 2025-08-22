// components/PlaceCard.jsx
export default function PlaceCard({
  place,
  checked,
  weight = 1,
  onToggle,
  onBlacklist,
  onWeight,
}) {
  const {
    name,
    rating,
    user_ratings_total,
    price_level,
    address,
    types,
    open_now,
  } = place;

  function priceText(p) {
    if (p == null) return "";
    return "$".repeat(Math.min(4, Math.max(1, p + 1)));
  }

  return (
    <div className="wrap">
      <label className="card">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ marginRight: "10px" }}
        />
        <div className="content">
          <div className="row">
            <strong>{name}</strong>
            <span className="meta">
              {open_now === true && (
                <span className="badge open">Open now</span>
              )}
              {open_now === false && (
                <span className="badge closed">Closed</span>
              )}{" "}
              {rating != null
                ? `★ ${rating.toFixed(1)} (${user_ratings_total})`
                : "—"}
              {price_level != null ? ` · ${priceText(price_level)}` : ""}
            </span>
          </div>
          <div className="addr">{address}</div>
          <div className="tags">
            {types?.slice(0, 4).map((t) => (
              <span key={t} className="tag">
                {t.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        </div>
      </label>

      <div className="actions">
        <button
          className="chip danger"
          onClick={onBlacklist}
          title="Never suggest this again"
        >
          Blacklist ⛔
        </button>
        <label className="chip">
          Weight:&nbsp;
          <select
            value={weight}
            onChange={(e) => onWeight?.(Number(e.target.value))}
          >
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={3}>3×</option>
          </select>
        </label>
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .card {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: var(--card);
          color: var(--ink);
        }
        .content {
          flex: 1;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }
        .meta {
          color: var(--muted);
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .addr {
          color: var(--muted);
          font-size: 12px;
          margin-top: 4px;
        }
        .tags {
          margin-top: 6px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tag {
          font-size: 11px;
          background: var(--chip);
          border: 1px solid var(--line);
          padding: 2px 6px;
          border-radius: 999px;
        }
        .badge {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 999px;
          border: 1px solid var(--line);
        }
        .badge.open {
          background: #dcfce7;
          border-color: #86efac;
          color: #14532d;
        }
        .badge.closed {
          background: #fee2e2;
          border-color: #fecaca;
          color: #7f1d1d;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-left: 30px;
        }
        .chip {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--chip);
          color: var(--ink);
        }
        .chip.danger {
          background: #fee2e2;
          border-color: #fecaca;
          color: #7f1d1d;
        }
        select {
          background: var(--card);
          color: var(--ink);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 2px 6px;
        }
      `}</style>
    </div>
  );
}
