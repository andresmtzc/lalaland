# Project Notes

## Porting features between clients (inverta, cpi, agora)

The production files (index.html, index-administrativo.html, client-config.js) are structurally identical across client folders. When porting changes from one client to another:

1. Get the diff of what changed in the source client
2. Bulk find-and-replace the same patterns across target files — no reading sections one by one, no subagents, no re-analyzing the code
3. Batch all replacements in one pass (sed or similar)
4. Treat it as a mechanical copy job, not a research task
