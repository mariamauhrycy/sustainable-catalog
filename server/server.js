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

  if (url === "/products") {
    return sendJson(res, 200, {
      updatedAt: new Date().toISOString(),
      count: sampleProducts.length,
      products: sampleProducts
    });
  }

  return sendJson(res, 404, { error: "Not found", path: url });
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});
