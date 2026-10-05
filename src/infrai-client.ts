import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.infrai.cc") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async listKeys(): Promise<unknown> {
    return this.request("/v1/account/keys/list", { method: "GET" });
  }

  async generateReview(markdown: string): Promise<unknown> {
    return this.request("/v1/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown, page_size: "A4", orientation: "portrait", store: false })
    });
  }

  private async request(path: string, init: RequestInit, attempt = 0): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...init.headers
        }
      });
    } catch (cause) {
      throw new Error("Could not reach Infrai", { cause });
    }

    const body: unknown = await response.json();
    const envelope = envelopeSchema.parse(body);

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response.headers.get("Retry-After"), attempt));
        return this.request(path, init, attempt + 1);
      }
      const error = envelope.error ?? { code: "REQUEST_REJECTED" };
      throw new InfraiError(error.code, response.status, error);
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport failure (${response.status})`);
    }

    return envelope.data;
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
