## RELEASE STEPS
1. Export new icons as new file names with the next version (i.e. v7).
2. Change manifest file name version and update the icon filenames inside.
3. Change the version to this in service-worker.js
```
const CACHE_NAME = "
```
4. Change the version to these in index.html
```
<link rel="manifest" href="manifest.
<link rel="manifest" href="/manifest.
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.
<link rel="icon" href="/favicon.
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.
<link rel="icon" type="image/png" sizes="192x192" href="/web-app-manifest-192x192.
<link rel="icon" type="image/png" sizes="512x512" href="/web-app-manifest-512x512.
Deploy files.
```
5. Open https://ilymmd.com/manifest.NEWVERSION.json and https://ilymmd.com/app-icon-512.NEWVERSION.png in a normal tab to confirm they’re live.
Result: Chrome on Android will pick up the new manifest within its normal refresh window (often much faster than 24h when filenames change) and the installed app’s icon will update on its own—no user action required.


## **WHAT TO EXPECT**
1. Day 0 (you deploy v6):
> New filenames + manifest.v6.json + bump CACHE_NAME in SW.
2. Minutes–hours later:
> Chrome re-fetches the manifest and sees new icon filenames.
3. Within ~24h (often sooner):
> Installed app’s tile icon & splash update automatically on Android.
