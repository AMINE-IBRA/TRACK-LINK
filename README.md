# PhoneTrack — Link Generator & Device Info

Generate a shareable link. When someone opens it on their phone, you see their device information.

## Quick start

```bash
npm install
npm start
```

Open **http://localhost:3000** in your browser.

## How it works

1. **Create a link** — Enter a name (optional) and click "Generate link".
2. **Share the link** — Copy the URL and send it via WhatsApp, SMS, email, etc.
3. **They tap it** — The person sees a simple "Loading…" page (looks like normal content).
4. **View results** — Open your dashboard to see their phone info.

## Information collected

When someone opens your link, the app records:

| Category | Details |
|----------|---------|
| **Device** | Type (Mobile/Tablet/Desktop), phone model, OS version |
| **Browser** | Chrome, Safari, Firefox, Edge, etc. |
| **Screen** | Resolution, viewport, pixel ratio, orientation |
| **System** | Language, timezone, CPU cores, RAM |
| **Network** | IP address, connection type, online status |
| **Other** | Touch support, battery level (if available), referrer |

## Pages

| URL | Purpose |
|-----|---------|
| `/` | Create links and see all your links |
| `/t/{id}` | Tracking page (what you share) |
| `/dashboard/{id}` | View visits and device info for a link |

## Share on the internet

To share links outside your computer, deploy the app (e.g. Render, Railway, Vercel) or use a tunnel:

```bash
npx localtunnel --port 3000
```

Use the public URL it gives you instead of `localhost`.

## Important

Use this tool responsibly and only with consent. Tracking someone without their knowledge may violate privacy laws.
