---
description: Procedures for shipping to production.
---

1. Run full type and lint check before deployment:
// turbo
   ```bash
   npm run typecheck && npm run lint
   ```

// turbo
2. Execute the deployment script:
   ```bash
   sh deploy.sh
   ```

3. Monitor the standard production ports (port 3006 for this application).
