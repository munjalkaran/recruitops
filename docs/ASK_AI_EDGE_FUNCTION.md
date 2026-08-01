# Ask Telora AI Edge Function contract

The current UI uses `src/services/askRecruitOpsService.js` for safe local interpretation. A future Supabase Edge Function may replace that implementation without changing the Telora panel contract.

Request:

```json
{
  "question": "Show overdue follow-ups",
  "organisation_id": "uuid",
  "context": { "page": "pipeline" }
}
```

Response:

```json
{
  "type": "answer | filter | navigate | clarify | unavailable",
  "message": "Human-readable response grounded in authorised data.",
  "action": null,
  "suggestions": []
}
```

The function must authenticate the caller, resolve the current profile and organisation server-side, enforce role/RLS scope, and never accept candidate data or permissions from the browser as trusted input. Destructive actions must return a confirmation payload and require a second explicit request; the function must not expose provider API keys to the frontend.
