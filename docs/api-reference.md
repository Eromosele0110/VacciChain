# API Reference — VacciChain

Base URL: `http://localhost:4000/v1`

This document lists primary endpoints, request/response schemas, authentication requirements, and examples.

## Authentication

- SEP-10 flow issues a JWT on successful verification.
- Include JWT as `Authorization: Bearer <token>` for protected endpoints.

---

## Rate limiting

Sensitive endpoints are rate limited per trusted client identity. The client
identity is derived from the connection's remote address; forwarding headers
(`X-Forwarded-For`, `X-Real-IP`, `Forwarded`) are only honored when the request
arrives from a configured trusted proxy. Spoofed forwarding headers from
untrusted peers are ignored.

Rate-limited endpoints:

- `POST /auth/sep10`
- `POST /auth/verify`
- `GET /verify/:wallet` (public verification)
- Onboarding endpoints
- `POST /batch/verify` (analytics service)

Every rate-limited response includes:

- `RateLimit-Limit`: maximum requests permitted in the current window
- `RateLimit-Remaining`: requests remaining in the current window
- `RateLimit-Reset`: seconds until the window resets
- `Retry-After`: seconds to wait before retrying (present on 429 responses)

When a limit is exceeded the endpoint returns 429 with a documented body:

```json
{
  "error": "rate_limited",
  "retryAfter": 30
}
```

`retryAfter` is the number of seconds until the client may retry, matching the
`Retry-After` header.

---

## POST /auth/sep10

Generates a SEP-10 challenge transaction for the provided public key.

Request:
```json
{ "public_key": "G..." }
```

Response (200):
```json
{ "challenge": "<base64-xdr>" }
```

Errors:
- 400: missing or invalid `public_key`

---

## POST /auth/verify

Verify signed SEP-10 challenge and return JWT.

Request:
```json
{ "signed_xdr": "<base64-xdr>" }
```

Response (200):
```json
{ "token": "<jwt>", "expires_in": 3600 }
```

Errors:
- 401: invalid signature or expired challenge

---

## POST /vaccination/issue

Mint a vaccination NFT for a patient. Issuer-only action.

Headers:
- `Authorization: Bearer <issuer_jwt>`

Request body:
```json
{
  "patient_wallet": "G...",
  "vaccine": "COVID-19",
  "date": "2026-05-01",
  "batch": "BATCH-123",
  "metadata": { "lot": "L-123" }
}
```

Date and time semantics:

- `date` is a **date-only** field in ISO 8601 calendar form `YYYY-MM-DD`. It
  represents the calendar date of vaccination and carries no time zone; it is
  never converted or shifted between time zones.
- Timestamp fields (e.g. `issued_at`) are **UTC timestamps** in RFC 3339 form
  with an explicit `Z` or numeric offset (e.g. `2026-05-01T12:34:56Z`). They are
  normalized to UTC for storage and indexing.
- Ambiguous values are rejected with 400: date-times supplied for `date`,
  date-only values supplied for timestamp fields, missing offsets on timestamp
  fields, and invalid calendar dates (e.g. `2026-02-30`).
- Leap days (`2024-02-29`) are valid date-only values; non-leap `02-29` is
  rejected.

Response (201):
```json
{
  "token_id": "abc123",
  "contract_tx": "<hash>",
  "issued_at": "2026-05-01T12:34:56Z"
}
```

Errors:
- 400: validation error (missing fields, ambiguous or invalid date/timestamp)
- 403: issuer not authorized
- 409: duplicate record detected
- 429: rate limited (see Rate limiting)

---

## GET /vaccination/:wallet

Fetch all vaccination records for a wallet.

Response (200):
```json
{
  "wallet": "G...",
  "records": [
    { "token_id": "abc123", "vaccine":"COVID-19", "date":"2026-05-01", "issuer":"G..." }
  ]
}
```

Errors:
- 404: wallet not found (no records)

---

## GET /verify/:wallet

Public endpoint returning aggregated verification result.

Response (200):
```json
{
  "wallet": "G...",
  "verified": true,
  "records": [ { "vaccine":"COVID-19", "date":"2026-05-01", "issuer":"G..." } ]
}
```

Errors:
- 400: malformed wallet address
- 429: rate limited (see Rate limiting)

---

## Analytics (Python service)

Base URL: `http://localhost:8001`

### GET /analytics/rates
Response:
```json
{ "by_vaccine": { "COVID-19": 1234 } }
```

### POST /batch/verify
Request: `{"wallets": ["G...", "G..."]}`
Response: `{"results": [{"wallet":"G...","verified":true}]}`

Errors:
- 429: rate limited (see Rate limiting)

---

For full endpoint listings, examples, and error codes, see the `backend/src/routes` implementations and expand this document as needed.
