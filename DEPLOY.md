# Render deployment

Create one Render **Web Service** from the repository root with these settings:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Node.js version:** `24.21.0` (also pinned in `.node-version`)
- **Health check path:** `/api/health`

The production server serves `dist/` and the API from the same origin. Render supplies `PORT`; the server binds to `0.0.0.0` in production. Set these environment variable names in Render (the two `VITE_` values must be available during the build):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `AI_PROVIDER`
- `AI_MODEL`
- `GEMINI_API_KEY`

Production rate limits use the Render/Cloudflare `CF-Connecting-IP` client address (with `X-Forwarded-For` as fallback); local development uses the socket address.

For Supabase Auth, open **Authentication → URL Configuration**. Set the Site URL to the deployed app origin, such as `https://your-service.onrender.com`, and add that origin to Redirect URLs. For local development, use `http://localhost:5173` and `http://127.0.0.1:5173` as allowed redirect URLs. Add any custom production domain you use. Keep the existing Supabase origin in the app CSP; do not add broader origins.

Public registration creates student accounts. Assign teacher access manually by setting the user's `app_metadata` role to `teacher`; never use editable `user_metadata` for authorization.
