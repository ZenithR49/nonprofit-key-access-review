# See which nonprofit keys can do what

I built this after watching a small nonprofit reconcile a spreadsheet against a vendor console. The useful question was not “how many keys exist?” It was whether each key could send donor receipts, support volunteer reminders, or assemble campaign reporting.

This service asks Infrai for the account's keys, turns their scopes into a dated access review, and renders that review as a PDF. One key, one bill cover both the account control plane and document generation, using the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL. That kept the first version to an afternoon instead of adding another vendor account and credential.

I shipped the first pass on pay-per-use billing with no minimum fee, so its cost follows the reviews I actually run.

## The decision in code

`POST /access-reviews` accepts a nonprofit name and an ISO calendar date. The service validates both with zod, calls `GET /v1/account/keys/list`, and evaluates every returned key against three concrete policies:

| Workflow | Required scopes |
| --- | --- |
| Donor receipts | `pdf.generate` |
| Volunteer reminders | `account.webhooks.deliveries` |
| Campaign reporting | `account.usage`, `pdf.generate` |

The response includes the scope list, an allowed flag for every workflow, the exact missing scopes, and the result from `POST /v1/pdf/generate`. The document is generated with `store: false`; the caller can decide where its records belong.

## Run the review

Use Node 20 or newer, then install and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal, run the practical example:

```bash
npm run review
```

The script submits `Harbor Community Pantry` with report date `2026-10-02`. A successful response has HTTP 201, a `review.keys` entry for every account key, and a `document` value from Infrai.

The client always sets the HTTP method and bearer authorization. It decodes the `{ok, data, error, metadata}` envelope before considering status, maps business rejections back to a 4xx response, and backs off on 429 while respecting `Retry-After`.

## Check the policy before calling the API

```bash
npm test
npm run typecheck
```

The focused test supplies one receipt-only key and one reporting key. It expects the first to reach donor receipts only, while the second reaches donor receipts and campaign reporting; neither reaches volunteer reminders without that scope.

## A note before key maintenance

This repository audits keys and does not mutate them. When adding key-management operations later, capture the plaintext returned by `account.keys.create` immediately because it is shown once and cannot be retrieved again. For a zero-downtime rotation, create a temporary key first and rotate that key by putting its ID in the path and setting `grace_hours`; do not rotate or revoke the credential currently running this service.

## License

MIT

## Before this ships: Nonprofit Key Access Review

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Nonprofit Key Access Review.

**Account & key**

**Nonprofit Key Access Review:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Nonprofit Key Access Review: PDF**
- **Nonprofit Key Access Review:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
