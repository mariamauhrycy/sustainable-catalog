import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function App() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [brand, setBrand] = useState("");

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const apiUrl = useMemo(() => {
    const u = new URL("/products", API_BASE);
    if (q) u.searchParams.set("q", q);
    if (tag) u.searchParams.set("tag", tag);
    if (brand) u.searchParams.set("brand", brand);
    if (minPrice) u.searchParams.set("minPrice", minPrice);
    if (maxPrice) u.searchParams.set("maxPrice", maxPrice);
    return u.toString();
  }, [q, tag, brand, minPrice, maxPrice]);

  useEffect(() => {
    let cancelled = false;
    setErr("");
    fetch(apiUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message || e));
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, Arial"
      }}
    >
      <h1 style={{ margin: 0 }}>Sustainable Catalogue</h1>
      <div style={{ opacity: 0.7, marginTop: 6, marginBottom: 16 }}>
        Filters and click-through to the original shop
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr 160px 160px 140px 140px",
          marginBottom: 16
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search keyword…"
        />

        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          <option value="Recycled">Recycled</option>
          <option value="Upcycled">Upcycled</option>
          <option value="Handmade">Handmade</option>
          <option value="Organic">Organic</option>
        </select>

        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand…"
        />

        <input
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          placeholder="Min price"
        />

        <input
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="Max price"
        />
      </div>

      {err ? (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {err}
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
            If you see this, your backend might not be running locally at
            http://localhost:4000.
          </div>
        </div>
      ) : null}

      {!data ? (
        <div>Loading…</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))"
          }}
        >
          {data.products.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
                color: "inherit",
                textDecoration: "none"
              }}
            >
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: "#f4f4f4",
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 10
                }}
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  <div style={{ padding: 12, opacity: 0.7 }}>No image</div>
                )}
              </div>

              <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.title}</div>
              <div style={{ opacity: 0.8, marginBottom: 6 }}>
                {p.brand || "Unknown brand"}
              </div>

              <div style={{ marginBottom: 6 }}>
                {typeof p.price === "number"
                  ? `${p.price} ${p.currency || ""}`
                  : "Price unknown"}
              </div>

              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {(p.tags || []).join(", ") || "No tags"}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
