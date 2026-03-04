# Project Notes

## Token forwarding from parent page to iframe

Agents generate per-lead tokens (e.g. `?token=ukgw6rvqsr`) for authentication. The map already handles token auth. The open question is embedding — agents have a static iframe on their website (e.g. cpi.mx) pointing to la-la.land/cpi/index.html.

**Problem:** iframe src is static, token can't get in automatically.

**Solution (one-time setup on agent's website):**
```js
const token = new URLSearchParams(location.search).get('token');
if (token) {
  const iframe = document.querySelector('iframe'); // or a more specific selector
  iframe.src += '?token=' + token;
}
```

Agent shares `cpi.mx?token=ukgw6rvqsr` with each lead. The snippet forwards the token into the iframe src. One-time install, zero per-lead maintenance.

**NOT YET BUILT** — this was discussed and agreed upon but not implemented as of 2026-03-04.

---

## Porting features between clients (inverta, cpi, agora)

The production files (index.html, index-administrativo.html, client-config.js) are structurally identical across client folders. When porting changes from one client to another:

1. Get the diff of what changed in the source client
2. Bulk find-and-replace the same patterns across target files — no reading sections one by one, no subagents, no re-analyzing the code
3. Batch all replacements in one pass (sed or similar)
4. Treat it as a mechanical copy job, not a research task
