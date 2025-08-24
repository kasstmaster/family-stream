Export new icons as new filenames with the next version (i.e. v7).

Change manifest name version and update the icon filenames inside.

In service-worker.js, bump CACHE_NAME → fs-v7.

Change the version to these in index.html
<link rel="manifest" href="manifest.
<link rel="manifest" href="/manifest.
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.
<link rel="icon" href="/favicon.
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.
<link rel="icon" type="image/png" sizes="192x192" href="/web-app-manifest-192x192.
<link rel="icon" type="image/png" sizes="512x512" href="/web-app-manifest-512x512.

Deploy files.

Open https://ilymmd.com/manifest.v7.json and https://ilymmd.com/app-icon-512.v7.png in a normal tab to confirm they’re live.

Result: Chrome on Android will pick up the new manifest within its normal refresh window (often much faster than 24h when filenames change) and the installed app’s icon will update on its own—no user action required.


<img width="1979" height="480" alt="29c6c1f7-9a03-458e-9f23-17d1e64a6a02" src="https://github.com/user-attachments/assets/d02c95df-435e-4f6f-b991-79a4428d1248" />
