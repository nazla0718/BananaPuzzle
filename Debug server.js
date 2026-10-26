
const http = require("http");

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "POST" && req.url === "/log") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const log = JSON.parse(body);
        console.log("[GAME DEBUG]", JSON.stringify(log, null, 2));
      } catch (error) {
        console.log("[GAME DEBUG] Invalid log:", body);
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Log received");
    });

    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Banana Puzzle debug server is running!\n");
});

server.listen(3002, () => {
  console.log("Debug server running at http://localhost:3002");
});

