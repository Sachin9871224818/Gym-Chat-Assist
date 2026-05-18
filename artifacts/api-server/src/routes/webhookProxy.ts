import { Router } from "express";

const router = Router();

const N8N_BASE = "https://n8n.grindoverdreams.in/webhook";
const API_KEY = "skgym2026";

router.post("/webhook-proxy/:path", async (req, res) => {
  const { path } = req.params;
  const targetUrl = `${N8N_BASE}/${path}`;
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    res.status(502).json({ error: "Webhook proxy failed", detail: String(err) });
  }
});

export default router;
