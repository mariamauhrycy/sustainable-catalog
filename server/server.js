const http = require("http");

const port = process.env.PORT || 4000;

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

const server = http.createServer((req, res) => {
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

    let filtered = sampleProducts.slice();

    if (q) {
      filtered = filtered.filter(
        p =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q)
      );
    }

    if (brand) {
      filtered = filtered.filter(p =>
        (p.brand || "").toLowerCase().includes(brand)
      );
    }

    if (tag) {
      filtered = filtered.filter(
        p => Array.isArray(p.tags) && p.tags.includes(tag)
      );
    }

    if (minPrice !== null && !Number.isNaN(minPrice)) {
      filtered = filtered.filter(
        p => typeof p.price === "number" && p.price >= minPrice
      );
    }

    if (maxPrice !== null && !Number.isNaN(maxPrice)) {
      filtered = filtered.filter(
        p => typeof p.price === "number" && p.price <= maxPrice
      );
    }

    return sendJson(res, 200, {
      updatedAt: new Date().toISOString(),
      count: filtered.length,
      filters: {
        q: q || null,
        brand: brand || null,
        tag: tag || null,
        minPrice: minPriceRaw || null,
        maxPrice: maxPriceRaw || null
      },
      products: filtered
    });
  }

  if (url.startsWith("/import/google")) {
    const fullUrl = new URL(url, `http://localhost:${port}`);
    const feedUrl = fullUrl.searchParams.get("url");

    if (!feedUrl) {
      return sendJson(res, 400, {
        error: "Missing url parameter",
        example: "/import/google?url=https://example.com/google-shopping.xml"
      });
    }

    return sendJson(res, 200, {
      note: "Importer scaffold is ready. Next step is parsing the XML feed into products.",
      feedUrl
    });
  }



  return sendJson(res, 404, { error: "Not found", path: url });
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});
