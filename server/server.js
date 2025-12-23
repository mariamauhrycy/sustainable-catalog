const http = require("http");
const { Pool } = require("pg");

const port = process.env.PORT || 4000;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false
    })
  : null;

async function initDb() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      price NUMERIC NULL,
      currency TEXT NULL,
      brand TEXT NULL,
      tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      url TEXT NOT NULL,
      image TEXT NULL,
      source_feed TEXT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feeds (
      id SERIAL PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

const sampleProducts = [
  {
    id: "p1",
    title: "Upcycled denim tote bag",
    price: 24.99,
    currency: "EUR",
    brand: "EcoStitch",
    tags: ["Upcycled", "Handmade"],
    url: "https://example.com/product/p1",
    image: "https://via.placeholder.com/600x600.png?text=Upcycled+Tote"
  },
  {
    id: "p2",
    title: "Recycled glass water bottle",
    price: 18.5,
    currency: "EUR",
    brand: "GreenSip",
    tags: ["Recycled"],
    url: "https://example.com/product/p2",
    image: "https://via.placeholder.com/600x600.png?text=Recycled+Bottle"
  }
];

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(text);
}

function detectSustainabilityTags(text) {
  const t = String(text || "").toLowerCase();
  const tags = new Set();
  const has = (...phrases) => phrases.some((p) => t.includes(p));

  if (
    has(
      "recycled",
      "post-consumer",
      "post consumer",
      "pre-consumer",
      "pre consumer",
      "rpet",
      "reclaimed plastic",
      "recycled plastic",
      "recycled polyester",
      "recycled cotton",
      "recycled nylon",
      "recycled aluminum",
      "recycled aluminium",
      "recycled glass",
      "recycled paper",
      "recycled cardboard",
      "ocean plastic",
      "recycled steel",
      "recycled rubber"
    )
  )
    tags.add("Recycled");

  if (
    has(
      "upcycled",
      "upcycle",
      "repurposed",
      "reworked",
      "re-made",
      "remade",
      "reclaimed fabric",
      "reclaimed textile",
      "made from scraps",
      "made from offcuts",
      "made from off-cuts",
      "deadstock",
      "leftover fabric",
      "surplus fabric"
    )
  )
    tags.add("Upcycled");

  if (
    has(
      "handmade",
      "hand made",
      "hand-stitched",
      "hand stitched",
      "handcrafted",
      "artisan",
      "made by hand",
      "hand-poured",
      "hand poured",
      "small batch",
      "small-batch",
      "made to order",
      "made-to-order",
      "one of a kind",
      "one-of-a-kind"
    )
  )
    tags.add("Handmade");

  if (
    has(
      "organic",
      "organic cotton",
      "organic linen",
      "gots",
      "cosmos organic",
      "soil association organic",
      "usda organic",
      "ecocert"
    )
  ) {
    if (
      !has(
        "organic traffic",
        "organic reach",
        "organic growth",
        "organic shapes",
        "organic shape"
      )
    ) {
      tags.add("Organic");
    }
  }

  return Array.from(tags);
}

function pickItems(obj) {
  const rssItems = obj?.rss?.channel?.item;
  if (rssItems) return Array.isArray(rssItems) ? rssItems : [rssItems];

  const atomEntries = obj?.feed?.entry;
  if (atomEntries) return Array.isArray(atomEntries) ? atomEntries : [atomEntries];

  const productsA = obj?.products?.product;
  if (productsA) return Array.isArray(productsA) ? productsA : [productsA];

  const productsB = obj?.productfeed?.product;
  if (productsB) return Array.isArray(productsB) ? productsB : [productsB];

  return [];
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  if (url === "/" || url === "/health") {
    return sendText(res, 200, "Backend is running\n");
  }

  if (url.startsWith("/products")) {
    const fullUrl = new URL(url, `http://localhost:${port}`);
    const q = (fullUrl.searchParams.get("q") || "").toLowerCase().trim();
    const brand = (fullUrl.searchParams.get("brand") || "").toLowerCase().trim();
    const tag = (fullUrl.searchParams.get("tag") || "").trim();

    const minPriceRaw = fullUrl.searchParams.get("minPrice");
    const maxPriceRaw = fullUrl.searchParams.get("maxPrice");
    const minPrice = minPriceRaw ? Number(minPriceRaw) : null;
    const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : null;

    let products = [];

    if (pool) {
      const conditions = [];
      const params = [];
      let i = 1;

      if (q) {
        conditions.push(
          `(LOWER(title) LIKE $${i} OR LOWER(COALESCE(brand,'')) LIKE $${i})`
        );
        params.push(`%${q}%`);
        i++;
      }

      if (brand) {
        conditions.push(`LOWER(COALESCE(brand,'')) LIKE $${i}`);
        params.push(`%${brand}%`);
        i++;
      }

      if (tag) {
        conditions.push(`$${i} = ANY(tags)`);
        params.push(tag);
        i++;
      }

      if (minPrice !== null && !Number.isNaN(minPrice)) {
        conditions.push(`price >= $${i}`);
        params.push(minPrice);
        i++;
      }

      if (maxPrice !== null && !Number.isNaN(maxPrice)) {
        conditions.push(`price <= $${i}`);
        params.push(maxPrice);
        i++;
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `
        SELECT id, title, price, currency, brand, tags, url, image
        FROM products
        ${where}
        ORDER BY imported_at DESC
        LIMIT 200
      `;

      const r = await pool.query(sql, params);
      products = r.rows.map((row) => ({
        ...row,
        price: row.price === null ? null : Number(row.price)
      }));
    } else {
      products = sampleProducts;
    }

    return sendJson(res, 200, {
      updatedAt: new Date().toISOString(),
      count: products.length,
      filters: {
        q: q || null,
        brand: brand || null,
        tag: tag || null,
        minPrice: minPriceRaw || null,
        maxPrice: maxPriceRaw || null
      },
      products
    });
  }

  if (url.startsWith("/import/google")) {
    const { XMLParser } = require("fast-xml-parser");
    const fullUrl = new URL(url, `http://localhost:${port}`);
    const feedUrl = fullUrl.searchParams.get("url");

    if (!feedUrl) {
      return sendJson(res, 400, {
        error: "Missing url parameter",
        example: "/import/google?url=https://example.com/google-shopping.xml"
      });
    }

    try {
      const r = await fetch(feedUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/xml,text/xml,*/*"
        }
      });

      if (!r.ok) {
        return sendJson(res, 502, {
          error: "Failed to fetch feed",
          status: r.status,
          statusText: r.statusText
        });
      }

      const xml = await r.text();

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
      });

      const data = parser.parse(xml);
      const items = pickItems(data);

      const products = items
        .map((it, idx) => {
          const title = it?.title ? String(it.title) : null;
          const link = it?.link ? String(it.link) : null;

          const gId = it?.["g:id"] ? String(it["g:id"]) : null;
          const brand = it?.["g:brand"] ? String(it["g:brand"]) : null;

          const image =
            it?.["g:image_link"] ? String(it["g:image_link"]) :
            it?.["g:additional_image_link"] ? String(it["g:additional_image_link"]) :
            null;

          const priceStr = it?.["g:price"] ? String(it["g:price"]) : null;
          let price = null;
          let currency = null;
          if (priceStr) {
            const m = priceStr.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{3})\s*$/);
            if (m) {
              price = Number(m[1]);
              currency = m[2].toUpperCase();
            }
          }

          if (!title || !link) return null;

          return {
            id: gId || `feed-${idx}`,
            title,
            price: typeof price === "number" && !Number.isNaN(price) ? price : null,
            currency: currency || null,
            brand: brand || null,
            tags: detectSustainabilityTags(`${title} ${brand || ""}`),
            url: link,
            image
          };
        })
        .filter(Boolean);

      if (pool) {
        await pool.query(
          `INSERT INTO feeds (url) VALUES ($1) ON CONFLICT (url) DO NOTHING`,
          [feedUrl]
        );

        const upsert = `
          INSERT INTO products (id, title, price, currency, brand, tags, url, image, source_feed)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            price = EXCLUDED.price,
            currency = EXCLUDED.currency,
            brand = EXCLUDED.brand,
            tags = EXCLUDED.tags,
            url = EXCLUDED.url,
            image = EXCLUDED.image,
            source_feed = EXCLUDED.source_feed,
            imported_at = NOW()
        `;

        for (const p of products) {
          await pool.query(upsert, [
            p.id,
            p.title,
            p.price,
            p.currency,
            p.brand,
            p.tags || [],
            p.url,
            p.image,
            feedUrl
          ]);
        }
      }

      return sendJson(res, 200, {
        feedUrl,
        count: products.length,
        products
      });
    } catch (e) {
      return sendJson(res, 500, {
        error: "Importer crashed",
        message: String(e?.message || e)
      });
    }
  }

  if (url === "/import/all") {
    if (!pool) {
      return sendJson(res, 400, { error: "Database not available" });
    }

    const r = await pool.query(`SELECT url FROM feeds ORDER BY created_at DESC`);
    const feeds = r.rows.map((x) => x.url);

    return sendJson(res, 200, {
      count: feeds.length,
      feeds
    });
  }

  return sendJson(res, 404, { error: "Not found", path: url });
});

initDb()
  .then(() => console.log("DB ready"))
  .catch((e) => console.error("DB init failed", e));

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});
