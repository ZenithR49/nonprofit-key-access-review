import { z } from "zod";

export const reviewRequestSchema = z.object({
  nonprofitName: z.string().trim().min(1).max(120),
  reportDate: z.string().date()
}).strict();

const keySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  scopes: z.array(z.string()).default([])
}).passthrough();

const accountKeySchema = z.object({
  key_id: z.string(),
  name: z.string().optional(),
  scopes: z.array(z.string()).default([])
}).passthrough().transform(({ key_id, ...key }) => ({ id: key_id, ...key }));

const keyListSchema = z.union([
  z.array(keySchema),
  z.object({ keys: z.array(keySchema) }),
  z.object({ items: z.array(accountKeySchema) })
]);

const workflows = [
  { name: "Donor receipts", requiredScopes: ["pdf.generate"] },
  { name: "Volunteer reminders", requiredScopes: ["account.webhooks.deliveries"] },
  { name: "Campaign reporting", requiredScopes: ["account.usage", "pdf.generate"] }
] as const;

export type AccessReview = ReturnType<typeof buildAccessReview>;

export function buildAccessReview(rawKeys: unknown, nonprofitName: string, reportDate: string) {
  const parsed = keyListSchema.parse(rawKeys);
  const keys = Array.isArray(parsed) ? parsed : "keys" in parsed ? parsed.keys : parsed.items;

  return {
    nonprofitName,
    reportDate,
    keys: keys.map((key) => ({
      id: key.id,
      name: key.name ?? "Unnamed key",
      scopes: key.scopes,
      reach: workflows.map((workflow) => {
        const missingScopes = workflow.requiredScopes.filter((scope) => !key.scopes.includes(scope));
        return {
          workflow: workflow.name,
          allowed: missingScopes.length === 0,
          missingScopes
        };
      })
    }))
  };
}

export function reviewMarkdown(review: AccessReview): string {
  const sections = review.keys.map((key) => {
    const rows = key.reach.map((item) =>
      `| ${item.workflow} | ${item.allowed ? "Allowed" : "Not allowed"} | ${item.missingScopes.join(", ") || "-"} |`
    );
    return `## ${key.name}\n\nKey ID: \`${key.id}\`\n\nScopes: ${key.scopes.join(", ") || "None"}\n\n| Workflow | Reach | Missing scopes |\n| --- | --- | --- |\n${rows.join("\n")}`;
  });

  return `# ${review.nonprofitName} access review\n\nReport date: ${review.reportDate}\n\n${sections.join("\n\n")}`;
}
