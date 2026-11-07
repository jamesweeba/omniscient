# MarketiX web app

The vendor app and the MarketiX admin app, in React 19 + Vite. It talks to the MarketiX API
(the `whatsAppFlows` repo).

## Run it

```bash
npm install
npm run dev     # http://localhost:5173; /api goes to the API on localhost:3000
npm run build   # type-check and build to dist/
npm run lint
```

## API docs

The API repo owns the API docs, so there is one copy to keep up to date:

- `UI_API_GUIDE.md`: every endpoint the web app calls.
- `VENDOR_ONBOARDING_API.md`: vendor sign-up and onboarding.
- `VIDEO_SPEC.md`, `PROMOTERS_SPEC.md`: product videos and promoters.
