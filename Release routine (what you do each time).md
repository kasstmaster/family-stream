Export new icons as new filenames with the next version (v7).

Change manifest name version and update the icon filenames inside.

Update your <head> to point to manifest.v7.json and the new icon filenames.

In service-worker.js, bump CACHE_NAME → fs-v7.

Deploy files.

Open https://ilymmd.com/manifest.v7.json and https://ilymmd.com/app-icon-512.v7.png in a normal tab to confirm they’re live.

Result: Chrome on Android will pick up the new manifest within its normal refresh window (often much faster than 24h when filenames change) and the installed app’s icon will update on its own—no user action required.


Change these in index.html
<link rel="manifest" href="manifest.v6.json">
<link rel="manifest" href="/manifest.v6.json">
