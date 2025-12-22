const port = process.env.PORT || 3000;

require("http")
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Backend is running\n");
  })
  .listen(port, () => console.log(`Listening on ${port}`));
