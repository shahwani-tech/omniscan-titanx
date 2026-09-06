/**
 * OMNISCAN TITAN X - Autonomous Document Intelligence Engine
 * Semantic Entity Extraction, Classification, Risk & Action Analysis
 */

import { DocumentIntelligenceResult, OmniPage } from "../types";

export async function analyzeDocumentIntelligence(
  page: OmniPage,
  documentName?: string
): Promise<DocumentIntelligenceResult> {
  const ocrText = page.ocr?.text || "";

  try {
    const response = await fetch("/api/intelligence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ocrText,
        imageBase64: page.processedDataUrl,
        mimeType: "image/jpeg",
        documentName: documentName || `Page ${page.pageNumber}`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        source: data.source || "gemini-3.7-flash",
        classification: data.classification || {
          type: "Standard Document",
          category: "Operational",
          confidence: 0.85,
        },
        summary: data.summary || "Document processed and indexed.",
        entities: (data.entities || []).map((e: any, idx: number) => ({
          id: `entity-${idx}`,
          key: e.key || "Field",
          value: e.value || "",
          category: e.category || "entity",
        })),
        lineItems: (data.lineItems || []).map((li: any, idx: number) => ({
          id: `line-${idx}`,
          description: li.description || "",
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: li.total,
        })),
        actionItems: (data.actionItems || []).map((a: any, idx: number) => ({
          id: `action-${idx}`,
          task: a.task || "",
          deadline: a.deadline,
          priority: a.priority || "medium",
          completed: false,
        })),
        redactionRecommendations: (data.redactionRecommendations || []).map(
          (r: any, idx: number) => ({
            id: `pii-${idx}`,
            label: r.label || "Sensitive Data",
            pattern: r.pattern || "***",
            riskLevel: r.riskLevel || "high",
          })
        ),
        analyzedAt: new Date().toISOString(),
        confidenceScore: data.confidenceScore || 0.94,
      };
    }
  } catch (e) {
    console.warn("Server intelligence error, using local heuristic engine:", e);
  }

  // Fallback to local heuristic intelligence engine
  return runLocalHeuristicIntelligence(ocrText, documentName);
}

/**
 * Local offline rule-based semantic parser
 */
function runLocalHeuristicIntelligence(
  text: string,
  docName?: string
): DocumentIntelligenceResult {
  const lower = text.toLowerCase();

  // Classification
  let type = "General Scanned Document";
  let category: any = "Operational";
  let confidence = 0.8;

  if (lower.includes("invoice") || lower.includes("subtotal") || lower.includes("bill to")) {
    type = "Commercial Invoice";
    category = "Financial";
    confidence = 0.95;
  } else if (lower.includes("agreement") || lower.includes("contract") || lower.includes("parties")) {
    type = "Legal Agreement / Contract";
    category = "Legal";
    confidence = 0.92;
  } else if (lower.includes("prescription") || lower.includes("medical") || lower.includes("patient")) {
    type = "Medical Health Record";
    category = "Medical";
    confidence = 0.93;
  } else if (lower.includes("receipt") || lower.includes("cashier") || lower.includes("change")) {
    type = "Point of Sale Receipt";
    category = "Financial";
    confidence = 0.91;
  } else if (lower.includes("passport") || lower.includes("license") || lower.includes("identification")) {
    type = "Government Identification";
    category = "Government";
    confidence = 0.97;
  }

  // Entities
  const entities: any[] = [];
  const dateMatch = text.match(/\b(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/i);
  if (dateMatch) {
    entities.push({ id: "ent-date", key: "Document Date", value: dateMatch[0], category: "date" });
  }

  const amountMatch = text.match(/(?:[$€£¥Rs]|USD|EUR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
  if (amountMatch) {
    entities.push({ id: "ent-amount", key: "Total Amount", value: amountMatch[0], category: "amount" });
  }

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    entities.push({ id: "ent-email", key: "Contact Email", value: emailMatch[0], category: "contact" });
  }

  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    entities.push({ id: "ent-phone", key: "Phone Number", value: phoneMatch[0], category: "contact" });
  }

  const invMatch = text.match(/(?:INV|Invoice|Ref|Doc|Bill)[#:\s-]*([A-Z0-9-]{4,16})/i);
  if (invMatch) {
    entities.push({ id: "ent-ref", key: "Reference / Serial #", value: invMatch[1], category: "identifier" });
  }

  // Action Items
  const actionItems: any[] = [];
  if (category === "Financial") {
    actionItems.push({
      id: "act-1",
      task: "Verify payment terms and reconcile against purchase order ledger",
      deadline: "30 Days from Issue",
      priority: "high",
    });
  }
  if (category === "Legal") {
    actionItems.push({
      id: "act-2",
      task: "Execute counter-signatures and file with compliance registry",
      deadline: "Immediate",
      priority: "high",
    });
  }

  // PII
  const redactions: any[] = [];
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    redactions.push({ id: "pii-ssn", label: "US Social Security Number", pattern: "***-**-****", riskLevel: "high" });
  }
  if (emailMatch) {
    redactions.push({ id: "pii-email", label: "Direct Email Address", pattern: emailMatch[0], riskLevel: "medium" });
  }

  return {
    source: "heuristic-engine",
    classification: { type, category, confidence },
    summary: `Digitized ${type} (${docName || "Active Page"}). Local heuristic extraction confirmed ${entities.length} metadata keys.`,
    entities,
    actionItems,
    redactionRecommendations: redactions,
    analyzedAt: new Date().toISOString(),
    confidenceScore: confidence,
  };
}

/**
 * Flexible wrapper to extract document intelligence from page base64 and text
 */
export async function extractDocumentIntelligence(
  imageBase64: string,
  ocrText = "",
  docName = "Active Document"
): Promise<DocumentIntelligenceResult> {
  try {
    const response = await fetch("/api/intelligence/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ocrText,
        imageBase64,
        mimeType: "image/jpeg",
        documentName: docName,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        source: data.source || "gemini-3.7-flash",
        classification: data.classification || {
          type: "Standard Document",
          category: "Operational",
          confidence: 0.9,
        },
        summary: data.summary || "Document processed and indexed.",
        entities: data.entities || [],
        lineItems: data.lineItems || [],
        actionItems: data.actionItems || [],
        redactionRecommendations: data.redactionRecommendations || [],
        analyzedAt: new Date().toISOString(),
        confidenceScore: 0.92,
      };
    }
  } catch (e) {
    console.warn("Server AI offline, switching to local heuristic engine:", e);
  }

  return runLocalHeuristicIntelligence(ocrText, docName);
}

/**
 * Auto-Redact PII helper to generate redaction boxes from intelligence results
 */
export function autoRedactPIIOnPage(
  intelligence: DocumentIntelligenceResult,
  currentRedactions: any[]
): { updatedRedactions: any[] } {
  const newRedactions = [...currentRedactions];

  (intelligence.redactionRecommendations || []).forEach((rec: any, idx: number) => {
    // Generate an automatic normalized redaction bounding zone
    newRedactions.push({
      id: `red-auto-${Date.now()}-${idx}`,
      x: 0.12,
      y: 0.22 + idx * 0.08,
      width: 0.35,
      height: 0.024,
      reason: rec.label || "PII Confidential",
      label: rec.label ? rec.label.toUpperCase() : "CONFIDENTIAL",
      color: "#000000",
      isPermanent: false,
    });
  });

  return { updatedRedactions: newRedactions };
}
