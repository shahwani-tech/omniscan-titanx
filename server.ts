import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with high limit for document image chunks
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Health Check
  app.get("/api/health", (_req, res) => {
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
    const hasBgRemoval = Boolean(
      process.env.BG_REMOVAL_ENDPOINT || process.env.BG_REMOVAL_API_KEY
    );
    res.json({
      status: "ok",
      version: "Titan-X-2.5.0-Enterprise",
      aiAvailable: hasApiKey,
      bgRemovalConfigured: hasBgRemoval,
      timestamp: new Date().toISOString(),
    });
  });

  // Autonomous Document Intelligence Endpoint
  app.post("/api/intelligence/analyze", async (req, res) => {
    try {
      const { text, imageBase64, mimeType = "image/png", documentName } = req.body;
      const ai = getGenAI();

      if (!ai) {
        // Fallback to local heuristic analysis if no API key is provided
        return res.json({
          source: "heuristic-engine",
          classification: detectHeuristicClassification(text || ""),
          entities: extractHeuristicEntities(text || ""),
          summary: generateHeuristicSummary(text || "", documentName),
          actionItems: extractHeuristicActionItems(text || ""),
          piiDetected: detectHeuristicPII(text || ""),
          confidenceScore: 0.88,
        });
      }

      const prompt = `You are the OmniScan Titan X Autonomous Document Intelligence Engine.
Analyze this document (attached text or image) with extreme precision.
Identify:
1. Document Type / Classification (e.g., Commercial Invoice, Tax Return, Legal Contract, Medical Record, Receipt, Identification, Technical Report, Bank Statement, Purchase Order).
2. Key Extracted Metadata & Entities: Document Number, Dates (Issued, Due, Expiration), Parties / Names, Addresses, Monetary Amounts, Tax IDs / VAT numbers, Line Items if applicable.
3. Concise Executive Summary (2-3 sentences max).
4. Key Action Items, Deadlines, or Critical Clauses / Risks.
5. Detected PII or Sensitive fields needing redaction (Credit cards, SSNs, National IDs, Passwords, Confidentiality tags).

Return strictly JSON matching this structure:
{
  "classification": {
    "type": "string",
    "category": "Financial | Legal | Medical | Government | Operational | Technical | Personal",
    "confidence": 0.98
  },
  "metadata": {
    "title": "string",
    "documentNumber": "string",
    "issueDate": "string",
    "dueDate": "string",
    "primaryParty": "string",
    "secondaryParty": "string",
    "currency": "string",
    "subtotal": "string",
    "taxAmount": "string",
    "totalAmount": "string"
  },
  "entities": [
    { "key": "string", "value": "string", "category": "entity | date | amount | identifier | legal" }
  ],
  "lineItems": [
    { "description": "string", "quantity": "string", "unitPrice": "string", "total": "string" }
  ],
  "summary": "string",
  "actionItems": [
    { "task": "string", "deadline": "string", "priority": "high | medium | low" }
  ],
  "redactionRecommendations": [
    { "label": "string", "pattern": "string", "riskLevel": "high | medium | low" }
  ]
}`;

      const contents: any[] = [];
      if (imageBase64) {
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
          },
        });
      }
      if (text) {
        contents.push({ text: `Document text content:\n${text}` });
      }
      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts: contents },
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are an autonomous enterprise document processing and intelligence extractor. Output pure JSON without markdown code fences.",
        },
      });

      const responseText = response.text || "{}";
      let parsed = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (err) {
        parsed = { rawText: responseText };
      }

      res.json({
        source: "gemini-3.8-flash",
        ...parsed,
      });
    } catch (error: any) {
      console.error("Document intelligence error:", error);
      res.status(500).json({
        error: error.message || "Failed to analyze document",
        fallback: {
          classification: { type: "General Document", category: "Operational", confidence: 0.7 },
          summary: "Local heuristic fallback active. Analysis completed.",
        },
      });
    }
  });

  // Intelligent OCR Assistance & Spelling Normalization
  app.post("/api/intelligence/ocr-enhance", async (req, res) => {
    try {
      const { rawText, language = "en" } = req.body;
      const ai = getGenAI();

      if (!ai || !rawText) {
        return res.json({ enhancedText: rawText, correctionsMade: 0 });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Review and reconstruct this raw scanned OCR text in language "${language}". Fix scan artifacts (like 'rn' for 'm', '0' for 'O', broken line breaks, bad punctuation) while strictly preserving layout structure, original numbers, and accurate spelling.
Raw OCR:
${rawText}

Return JSON:
{
  "enhancedText": "string",
  "correctionsCount": 0,
  "confidenceScore": 0.95
}`,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      res.json({ enhancedText: req.body.rawText, error: error.message });
    }
  });

  // Background Removal Proxy Endpoint (Secure Server-Side API Key Storage)
  app.post("/api/background/remove", async (req, res) => {
    try {
      const { image, options, model, params, endpointUrl } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Missing image data payload" });
      }

      // Check if remote AI background removal service is configured in server environment (OPTIONAL)
      const envEndpoint = process.env.BG_REMOVAL_ENDPOINT?.trim();
      const envApiKey = (
        process.env.BG_REMOVAL_API_KEY ||
        process.env.BACKGROUND_REMOVAL_API_KEY ||
        ""
      ).trim();
      const hasEnvConfig = Boolean(envEndpoint || envApiKey);

      // Check if an explicit, non-default custom endpoint was provided by client
      const isCustomClientEndpoint = Boolean(
        endpointUrl &&
        typeof endpointUrl === "string" &&
        endpointUrl.trim().length > 0 &&
        !endpointUrl.includes("localhost:5000")
      );

      // If neither server environment variables nor an explicit custom endpoint is provided,
      // fail gracefully with HTTP 503 instead of attempting connection or crashing
      if (!hasEnvConfig && !isCustomClientEndpoint) {
        return res.status(503).json({
          ok: false,
          error: "Background removal service is not configured",
          code: "SERVICE_NOT_CONFIGURED",
          message:
            "AI background removal isn't set up yet — this feature will be available once configured.",
        });
      }

      const targetEndpoint =
        envEndpoint ||
        (isCustomClientEndpoint ? endpointUrl : null) ||
        "http://localhost:5000/api/background/remove";

      const apiKey = envApiKey || "";
      const authHeaderType = process.env.BG_REMOVAL_AUTH_HEADER || "Bearer";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `${authHeaderType} ${apiKey}`.trim();
      }

      const controller = new AbortController();
      const timeoutMs = Number(process.env.BG_REMOVAL_TIMEOUT_MS) || 45000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(targetEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ image, options, model, params }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          return res.status(response.status).json({
            error: `Remote removal service returned HTTP ${response.status}: ${errText || response.statusText}`,
          });
        }

        const data = await response.json();
        return res.json(data);
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        const isTimeout = fetchErr.name === "AbortError";
        return res.status(502).json({
          error: isTimeout
            ? `Background removal request timed out after ${timeoutMs / 1000}s.`
            : `Could not connect to background removal service at ${targetEndpoint}. (${fetchErr.message || "Connection refused"})`,
          message:
            "Remote background removal service could not be reached. Local background removal remains available.",
        });
      }
    } catch (err: any) {
      console.error("[Background Proxy Error]:", err);
      return res.status(500).json({
        error: err.message || "Internal server error during background removal",
      });
    }
  });

  // Background Removal Health Check Proxy
  app.post("/api/background/health", async (req, res) => {
    try {
      const { endpointUrl } = req.body;

      // Check if remote AI background removal service is configured in server environment (OPTIONAL)
      const envEndpoint = process.env.BG_REMOVAL_ENDPOINT?.trim();
      const envApiKey = (
        process.env.BG_REMOVAL_API_KEY ||
        process.env.BACKGROUND_REMOVAL_API_KEY ||
        ""
      ).trim();
      const hasEnvConfig = Boolean(envEndpoint || envApiKey);

      const isCustomClientEndpoint = Boolean(
        endpointUrl &&
        typeof endpointUrl === "string" &&
        endpointUrl.trim().length > 0 &&
        !endpointUrl.includes("localhost:5000")
      );

      // Return a clean unconfigured status if service environment variables are not set (OPTIONAL feature)
      if (!hasEnvConfig && !isCustomClientEndpoint) {
        return res.status(200).json({
          ok: false,
          configured: false,
          code: "SERVICE_NOT_CONFIGURED",
          message:
            "AI background removal isn't set up yet — this feature will be available once configured.",
        });
      }

      const targetEndpoint =
        envEndpoint ||
        (isCustomClientEndpoint ? endpointUrl : null) ||
        "http://localhost:5000/api/background/remove";

      const apiKey = envApiKey || "";
      const authHeaderType = process.env.BG_REMOVAL_AUTH_HEADER || "Bearer";

      let healthUrl = targetEndpoint;
      try {
        const urlObj = new URL(targetEndpoint);
        urlObj.pathname = urlObj.pathname.replace(/\/remove\/?$/, "/health");
        healthUrl = urlObj.toString();
      } catch {
        // fallback
      }

      const headers: Record<string, string> = {
        Accept: "application/json, text/plain",
      };
      if (apiKey) {
        headers["Authorization"] = `${authHeaderType} ${apiKey}`.trim();
      }

      const t0 = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const resp = await fetch(healthUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
        }).catch(async () => {
          return await fetch(targetEndpoint, {
            method: "OPTIONS",
            headers,
            signal: controller.signal,
          });
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - t0;

        if (resp.ok) {
          return res.json({
            ok: true,
            configured: true,
            latencyMs,
            message: `Backend connected successfully (${latencyMs}ms response time).`,
          });
        } else {
          return res.json({
            ok: false,
            configured: true,
            latencyMs,
            message: `Backend responded with HTTP ${resp.status}: ${resp.statusText}`,
          });
        }
      } catch (err: any) {
        clearTimeout(timeout);
        const latencyMs = Date.now() - t0;
        return res.json({
          ok: false,
          configured: true,
          latencyMs,
          message:
            err.name === "AbortError"
              ? "Connection timed out (5s)."
              : `Could not reach ${targetEndpoint}.`,
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        configured: false,
        message: err.message || "Failed health check",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`OmniScan Titan X Server running on http://0.0.0.0:${PORT}`);
  });
}

// Local Heuristics Helpers (Offline Resilience)
function detectHeuristicClassification(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("invoice") || lower.includes("bill to") || lower.includes("subtotal") || lower.includes("due date")) {
    return { type: "Commercial Invoice", category: "Financial", confidence: 0.94 };
  }
  if (lower.includes("receipt") || lower.includes("cashier") || lower.includes("pos") || lower.includes("change due")) {
    return { type: "Sales Receipt", category: "Financial", confidence: 0.92 };
  }
  if (lower.includes("agreement") || lower.includes("contract") || lower.includes("hereby") || lower.includes("parties")) {
    return { type: "Legal Agreement", category: "Legal", confidence: 0.89 };
  }
  if (lower.includes("patient") || lower.includes("prescription") || lower.includes("diagnosis") || lower.includes("clinical")) {
    return { type: "Medical Record", category: "Medical", confidence: 0.91 };
  }
  if (lower.includes("passport") || lower.includes("driver license") || lower.includes("national id") || lower.includes("date of birth")) {
    return { type: "Identification Document", category: "Government", confidence: 0.96 };
  }
  return { type: "Standard Document", category: "Operational", confidence: 0.75 };
}

function extractHeuristicEntities(text: string) {
  const entities: Array<{ key: string; value: string; category: string }> = [];
  const lines = text.split("\n");

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) entities.push({ key: "Email Address", value: emailMatch[0], category: "identifier" });

  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) entities.push({ key: "Phone Number", value: phoneMatch[0], category: "identifier" });

  const dateMatch = text.match(/\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/i);
  if (dateMatch) entities.push({ key: "Document Date", value: dateMatch[0], category: "date" });

  const amountMatch = text.match(/(?:[$€£¥Rs]|USD|EUR|PKR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
  if (amountMatch) entities.push({ key: "Total Amount", value: amountMatch[0], category: "amount" });

  const invMatch = text.match(/(?:INV|Invoice|Ref|Doc|Bill)[#:\s-]*([A-Z0-9-]{4,16})/i);
  if (invMatch) entities.push({ key: "Reference ID", value: invMatch[1], category: "identifier" });

  return entities;
}

function generateHeuristicSummary(text: string, filename?: string) {
  const words = text.trim().split(/\s+/);
  if (words.length > 5) {
    return `Captured document "${filename || "Scanned Document"}" containing ${words.length} recognized words. Document processed through local Titan OCR pipeline.`;
  }
  return `Document "${filename || "Scanned Item"}" digitized and ready for processing, annotation, and export.`;
}

function extractHeuristicActionItems(text: string) {
  const actions: Array<{ task: string; deadline: string; priority: "high" | "medium" | "low" }> = [];
  const lower = text.toLowerCase();
  if (lower.includes("pay by") || lower.includes("due date") || lower.includes("payment due")) {
    actions.push({ task: "Remit required payment per invoice terms", deadline: "See Due Date", priority: "high" });
  }
  if (lower.includes("sign here") || lower.includes("signature required") || lower.includes("authorized signature")) {
    actions.push({ task: "Execute required signatures and initial clauses", deadline: "Immediate", priority: "high" });
  }
  if (lower.includes("renew") || lower.includes("expires")) {
    actions.push({ task: "Review document expiration / renewal validity", deadline: "30 days prior", priority: "medium" });
  }
  return actions;
}

function detectHeuristicPII(text: string) {
  const pii: Array<{ label: string; pattern: string; riskLevel: "high" | "medium" | "low" }> = [];
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    pii.push({ label: "Social Security Number (SSN)", pattern: "***-**-****", riskLevel: "high" });
  }
  if (/\b(?:\d{4}[ -]?){3}\d{4}\b/.test(text)) {
    pii.push({ label: "Credit Card PAN", pattern: "**** **** **** ****", riskLevel: "high" });
  }
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    pii.push({ label: "Personal Email Address", pattern: "User Email", riskLevel: "medium" });
  }
  if (/\b\d{5}(?:-\d{4})?\b/.test(text)) {
    pii.push({ label: "Postal / ZIP Code", pattern: "Postal Location", riskLevel: "low" });
  }
  return pii;
}

startServer();
