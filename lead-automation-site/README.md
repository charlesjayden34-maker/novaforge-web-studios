# Lead Automation Site

Standalone website dedicated to:

- discovering businesses with no listed website
- generating personalized outreach emails
- exporting CSV templates for campaign workflows
- pulling next eligible draft from `/api/campaign/next-email` for chat-based sending

## Local run

Because this site is plain HTML/CSS/JS, you can serve it with any static server.

Example:

```bash
npx serve lead-automation-site -l 5180
```

Then open:

`http://localhost:5180`

## Production deploy

`render.yaml` includes a static service:

- `lead-automation-web` (root: `lead-automation-site/`)

After deploy, set your API base URL in the app to your live backend domain.
