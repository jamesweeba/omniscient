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

## Security headers (set them where the app is hosted)

The login token lives in `localStorage`, so the page must not run anyone else's script or be
framed. Serve `index.html` and the assets with:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob: data: <API origin>; media-src 'self' blob:; frame-src 'self' blob: https://www.openstreetmap.org; connect-src 'self' <API origin>; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Replace `<API origin>` with the API's address (what `VITE_API_BASE_URL` points at), and
never expose `npm run dev` to the internet (`--host`): it is a development server.
