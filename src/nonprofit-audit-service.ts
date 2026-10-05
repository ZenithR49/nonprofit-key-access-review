import { createServer } from "node:http";
import { ZodError } from "zod";
import { buildAccessReview, reviewMarkdown, reviewRequestSchema } from "./access-review.js";
import { InfraiClient, InfraiError } from "./infrai-client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const infrai = new InfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/access-reviews") {
    return json(response, 404, { error: "Route not found" });
  }

  try {
    const input = reviewRequestSchema.parse(await readJson(request));
    const keyData = await infrai.listKeys();
    const review = buildAccessReview(keyData, input.nonprofitName, input.reportDate);
    const document = await infrai.generateReview(reviewMarkdown(review));
    return json(response, 201, { review, document });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json(response, 400, { error: "Invalid request body" });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.code });
    }
    console.error(error);
    return json(response, 502, { error: "Upstream request failed" });
  }
}).listen(port, () => {
  console.log(`Nonprofit access review service listening on http://localhost:${port}`);
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
