// Writes the app's built-in pages (the offline screen) with the site address baked in
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emulatorOnly, serverUrl } from '../server-url.mjs';

const www = fileURLToPath(new URL('../www/', import.meta.url));
mkdirSync(www, { recursive: true });

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<style>
  :root { --paper:#f5f6f3; --ink:#18213a; --ink2:#4b556c; --accent:#2b44c9; --accentInk:#fff; }
  @media (prefers-color-scheme: dark) { :root { --paper:#11141b; --ink:#e7e9ef; --ink2:#a6adbd; --accent:#8295ff; --accentInk:#0c0f14; } }
  html, body { margin:0; height:100%; background:var(--paper); color:var(--ink); font-family:system-ui, -apple-system, Roboto, sans-serif; }
  main { min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:32px; box-sizing:border-box; }
  h1 { font-size:24px; margin:24px 0 8px; }
  p { color:var(--ink2); max-width:320px; line-height:1.5; margin:0; }
  button { margin-top:28px; border:0; border-radius:10px; padding:12px 22px; font-size:16px; font-weight:600; background:var(--accent); color:var(--accentInk); }
  small { margin-top:16px; color:var(--ink2); opacity:.8; }
</style>
</head>
<body><main>${body}</main></body>
</html>
`;

const SITE = JSON.stringify(serverUrl);
writeFileSync(
  `${www}offline.html`,
  page(
    "Can't reach Hackcrew",
    `<svg width="64" height="52" viewBox="0 0 22 18" aria-hidden="true"><rect x="0" y="1" width="12" height="4" rx="2" fill="#8295ff"/><rect x="5" y="7" width="15" height="4" rx="2" fill="currentColor"/><rect x="2" y="13" width="9" height="4" rx="2" fill="#7c8598"/></svg>
  <h1>Can't reach Hackcrew</h1>
  <p>Check your internet connection. Hackcrew opens by itself as soon as you are back online.</p>
  <p style="margin-top:12px;font-size:13px">This app opens <b id="site"></b>.${
    emulatorOnly
      ? ' That address only works in the Android emulator: rebuild the app with HACKCREW_URL set to your site.'
      : serverUrl.startsWith('http://')
        ? ' Make sure this phone is on the same Wi-Fi as that computer and the Hackcrew dev server is running.'
        : ''
  }</p>
  <button type="button" id="retry">Try again</button>
  <small id="status" role="status"></small>
  <script>
    var site = ${SITE};
    document.getElementById('site').textContent = site.replace(/^https?:\/\//, '');
    function retry() {
      document.getElementById('status').textContent = 'Connecting…';
      fetch(site + '/api/auth/me', { cache: 'no-store' }).then(function () { location.replace(site + '/dashboard'); })
        .catch(function () { document.getElementById('status').textContent = 'Still offline. Try again in a moment.'; });
    }
    document.getElementById('retry').addEventListener('click', retry);
    window.addEventListener('online', retry);
  </script>`
  )
);
// Only used if the app ever starts without a site address
writeFileSync(`${www}index.html`, page('Hackcrew', `<p>Opening Hackcrew…</p><script>location.replace(${SITE});</script>`));
console.log(`Hackcrew app will open ${serverUrl}`);
if (emulatorOnly) {
  console.warn(
    [
      '',
      '  ⚠  No HACKCREW_URL set: this build only works in the Android EMULATOR (10.0.2.2 is the emulator\'s',
      '     name for your computer). On a real phone it will show "Can\'t reach Hackcrew".',
      '     For a phone, build with your site, for example:',
      '       HACKCREW_URL=https://your-site.example.com npm run android:build',
      '     or, to test against this computer over Wi-Fi (see "Try it before deploying" in the README):',
      '       HACKCREW_URL=http://<this computer\'s Wi-Fi IP>:5173 npm run android:build',
      '',
    ].join('\n')
  );
}
