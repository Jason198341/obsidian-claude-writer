#!/usr/bin/env node
/**
 * Claude Bridge Server for Termux
 * Obsidian 모바일 → localhost:3456 → Claude CLI
 *
 * 설치: pkg install nodejs && npm i -g @anthropic-ai/claude-code
 * 실행: node bridge.mjs
 */

import { createServer } from "http";
import { spawn } from "child_process";

const PORT = parseInt(process.env.BRIDGE_PORT || "3456", 10);

const server = createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Claude Bridge" }));
    return;
  }

  // Main endpoint
  if (req.method === "POST" && req.url === "/ask") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { prompt, model, timeout } = JSON.parse(body);
        if (!prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "prompt required" }));
          return;
        }

        const args = [
          "-p",
          "--output-format", "text",
          "--model", model || "haiku",
          "--no-session-persistence",
          "--effort", "low",
        ];

        const child = spawn("claude", args, {
          shell: true,
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        const timeoutMs = timeout || 120000;

        const timer = setTimeout(() => {
          child.kill();
          res.writeHead(504, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `timeout (${timeoutMs}ms)` }));
        }, timeoutMs);

        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));

        child.on("close", (code) => {
          clearTimeout(timer);
          if (code === 0) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ response: stdout.trim() }));
          } else {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `exit ${code}: ${stderr.slice(0, 300)}` }));
          }
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        });

        if (child.stdin) {
          child.stdin.write(prompt);
          child.stdin.end();
        }
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `parse error: ${err.message}` }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Claude Bridge Server running at http://127.0.0.1:${PORT}`);
  console.log(`   POST /ask  { prompt, model, timeout }`);
  console.log(`   GET  /     health check`);
  console.log(`   Ctrl+C to stop`);
});
