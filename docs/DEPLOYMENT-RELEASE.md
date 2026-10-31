# Deployment and operating guide

## Hosted applications

- Web workspace: https://tensorstudio-workbench.vercel.app
- Standalone explorer: https://tensorscan.vercel.app/scan?network=test
- Backend: https://tensorstudio-runner.onrender.com

Workbench pages, model choices and bounded AI actions are public without native authentication dialogs. Private runner sessions and execution require owner access through `/owner`, using a secure HttpOnly cookie. Public AI requests have best-effort per-instance demo limits. Contact the workspace owner for access; do not put credentials in issues, README files or screenshots.

## Runtime configuration

The web app runs on Vercel using the compiled Remix server adapter in `apps/web/server/vercel-studio.mjs`. The Python backend runs on Render. Packaging is performed by `scripts/package-studio-vercel.mjs`; it includes compiled client/server artifacts, not workspace environment files.

Set the following server-side values when operating a hosted installation:

| Service | Configuration |
| --- | --- |
| Web | `PUBLIC_ORIGIN`, `STUDIO_ACCESS_PASSWORD`, `RUNNER_PUBLIC_URL`, `RUNNER_SESSION_SECRET` |
| Web inference | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` or supported alternative-provider settings |
| Runner access | `BITCODE_WEB_ORIGIN` and matching `RUNNER_SESSION_SECRET` |
| Miner inference | `BITCODE_MODEL_BASE_URL`, `BITCODE_MODEL_API_KEY`, `BITCODE_MODEL_ID` |
| Chain | Explicit `CHAIN_WS` appropriate to the selected environment |

Consult the runner's environment example and authentication implementation for exact variable names. Generate secrets independently for your own installation; never copy credentials from another deployment. Hosted runner sessions are short-lived, scoped and origin-checked.

## Hosting constraints

Render Free can sleep after inactivity and resets local files/process state on restarts. Reassemble projects and relaunch processes after such a reset. The demonstration has no persistent disk or private development chain bundled with it.

For a durable production service, plan persistent storage, backups, restart/recovery, monitoring, quotas and per-tenant isolation. The owner console executes trusted code and must not be exposed as an unauthenticated public sandbox.

## Verification boundaries

Public network observation, offline fixture evaluation, model inference and process startup are independent capabilities. Registration, on-chain endpoint serving, accepted weights, rewards and wallet signing need separate end-to-end acceptance. Public testnet is not a private development chain. Mainnet writes are outside the hosted demonstration.

The project presents configurable inference rather than asserting that a registered TensorStudio subnet serves the hosted assistant. A subnet inference deployment should document the netuid, service endpoint, authentication and a verified request.
