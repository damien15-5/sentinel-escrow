# Validation record

Verified on November 16, 2026 in Linux with Node.js 24.22.1, npm 11.9.0 and solc 0.8.29.

## Completed

| Check | Result |
| --- | --- |
| Solidity compilation | Passed; compiler standard JSON and ABI/bytecode artifacts included |
| Contract regression tests | 18 passed |
| HTTP API + dashboard DOM integration tests | 2 passed |
| Model tests | 5 passed |
| Full local demo | Normal clears; risky and ambiguous freeze; six receipts per run |
| Real worker job handler | Reads local on-chain job, verifies listing, runs inference, commits score |
| Restart safety | Submission failure followed by retry retains exact original report bytes |
| Dashboard interaction | High-risk run → refund; custom normal input → release; model/evidence views |
| Markup handling | Listing HTML rendered as text in evidence |
| Clean dependency install | `npm ci` succeeded from copied package + corrected lockfile in an empty directory |
| Deterministic training | Regenerated weights identical byte-for-byte |
| Held-out synthetic probes | 11/12 matched; known miss preserved in `evidence/model-probes.json` |

`evidence/test-results.txt` contains the final named regression-test output. Local simulator artifacts use chain IDs 31337 and 31338; production scripts only allow 84532 and 5318007.

## Not verified / not done

- No real Base Sepolia/Lasna deployments, callbacks, fee billing, source verification or public-chain evidence.
- A read-only RPC preflight attempt timed out in this environment; public RPC availability and documented contract behavior must be checked when deploying.
- No real-network latency measurement. Local elapsed milliseconds are development-run timing only.
- No rendered browser or mobile-device visual review: the environment's supported browser preview tooling was unavailable. Dashboard interactions were tested with JSDOM against the actual local HTTP API and compiled contracts; JSDOM does not validate pixel layout.
- No production security audit, real-world ML validation or decentralized proof of inference.
- No registration, public repository, hosted demo video or event submission, per the requested ZIP-only handoff.

## Re-run

```sh
npm ci
npm test
npm run demo
node model/evaluate.mjs
npm start
```

The HTTP/DOM tests need localhost loopback networking. On restricted execution sandboxes, allow localhost traffic for the test process. No test sends a public blockchain transaction. Local demo data and `.state` runtime files are disposable; generated public-testnet reports must be backed up when you run the live deployment later.

The bundled macOS-only `fsevents` entry under Ganache is explicitly optional in the lockfile to avoid npm's `EBADPLATFORM` error on Linux. Native µWS binaries are optional; their JavaScript fallback is what was tested here.
