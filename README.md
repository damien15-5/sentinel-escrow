# Sentinel Escrow

**A live neural model assesses a trade. Reactive Omni enforces the decision. The buyer controls the money.**

Built from scratch on November 16, 2026 for the **Reactive Meets AI** track. It is **live on Reactive Lasna + Ethereum Sepolia**, with four complete, independently verified loops (see [Live testnet deployment](#live-testnet-deployment)). It has not yet been published or submitted to DoraHacks.

## Start here

Install **Node.js 22 LTS or newer** (tested with Node 24.22.1) and npm. Unzip this directory, open a terminal in it, then:

```sh
npm ci
npm test
npm start
```

Open **http://localhost:3000**. Select a normal or high-risk listing, run the escrow, inspect the six transaction receipts, then release or refund the local deposit. No wallet, faucet, paid AI API, or external RPC is needed for this local demo. Keep the terminal running. Ctrl+C stops the server.

The checked-in model weights are ready to use. `node_modules` is intentionally excluded from the ZIP; `npm ci` downloads the pinned dependencies. On some Node/platform versions Ganache prints a native µWS warning and uses its working JavaScript fallback. The lockfile explicitly marks Ganache's bundled macOS-only `fsevents` package optional so clean Linux installs work; preserve the provided lockfile.

```sh
npm run demo              # Three complete local EVM runs; writes evidence/local-demo.json
npm run compile           # Solidity 0.8.29, Shanghai EVM, optimizer 200 runs
npm run train             # Reproduce the neural weights from the fixed training seed
node model/evaluate.mjs   # Held-out synthetic probe report, including failures
```

## What you get

| Component | Behavior |
| --- | --- |
| `EscrowVault.sol` | Holds buyer ETH; blocks payout while pending/frozen; buyer-only release; immediate frozen refund or timestamp timeout |
| `SentinelReactive.sol` | Omni event subscriptions, origin validation, immutable threshold, two callback stages, controlled retry |
| `AssessmentGateway.sol` | Authenticates proxy AND reactive sender; creates AI jobs; accepts one report from the pinned reporter |
| `src/worker.mjs` | Reads confirmed jobs, verifies listing commitments, executes neural inference, stores exact reports and commits hashes |
| `model/` | Reproducible 145-parameter MLP, checked-in weights, feature extractor and transparent evaluation |
| `web/` + local API | Responsive control room, custom inputs, transaction trace, evidence downloads, buyer release/refund controls |
| `scripts/` | Compile, deployment/resume, network checks, fee health, sample trades, operations and testnet evidence collection |
| `test/` | Contract authorization, state transitions, malicious inputs, replay/reentrancy protection, model and dashboard/API tests |
| `docs/` | Research, architecture, threat model, deployment guide, submission draft and a timed demo script |

## The actual loop

```mermaid
sequenceDiagram
    participant Buyer
    participant Vault as EscrowVault / Sepolia
    participant Reactive as SentinelReactive / Lasna
    participant Gateway as AssessmentGateway / Sepolia
    participant AI as Live neural worker
    Buyer->>Vault: 1. open(seller, duration, listing) + ETH
    Note over Vault: Deposit stays Pending
    Vault-->>Reactive: EscrowOpened subscription
    Reactive->>Reactive: 2. validate source + store request
    Reactive->>Gateway: 3. requestAssessment via Omni callback
    Gateway-->>AI: AssessmentRequested
    AI->>AI: Verify content hash + live neural forward pass
    AI->>Gateway: 4. reportRisk(score, reportHash)
    Gateway-->>Reactive: RiskReported subscription
    Reactive->>Reactive: 5. score >= threshold(deposit size) ? freeze : clear
    Reactive->>Gateway: 6. deliverDecision via Omni callback
    Gateway->>Vault: Apply Cleared or Frozen
    Buyer->>Vault: Release cleared deposit OR refund frozen deposit
```

Both chain transports are **mocked only in the local lab**; the deployed contracts use Omni's current `requestCallbackV_1_0` interface and system contract. Local runs execute compiled Solidity on two distinct EVM instances, with six transaction receipts and live inference. They do not prove Lasna delivery, actual service fees, validator behavior or public-network latency.

## Why Reactive is essential

The model worker has permission to **report a score**, not change escrow state. Reactive initiates the job and applies the threshold. The destination accepts instructions only from the configured callback proxy and reactive contract. Removing Reactive leaves deposits pending until timeout. A low score never automatically pays a seller; the buyer still confirms release.

## Model and trust limits

The neural network is `10 features → 12 tanh neurons → sigmoid`, trained on 1,800 synthetic text examples. It runs for each job; AI is not limited to code generation. The model bytes and exact report JSON are hashed and checked against on-chain commitments.

This is a demonstration text-risk model, **not a validated fraud detector**. Features use a small English vocabulary; evasive phrasing and fabricated benign details can defeat it. The included 12 handwritten held-out probes produced **11 matching decisions and 1 miss**; this is not a real-world accuracy claim. See [MODEL_CARD.md](docs/MODEL_CARD.md).

Reports are trusted attestations from one configured reporter. Hashes prove which report was committed, not that a remote worker faithfully performed inference. There is no zkML, TEE or decentralized oracle claim. All listing text is public in transaction logs; do not enter secrets or personal data.

## Live testnet deployment

The deployment uses the **Ethereum Sepolia (11155111)** origin/destination and **Reactive Lasna (5318007)**. The official Sepolia callback proxy `0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4` and system contract `0x8888…8888` were checked against [Origins & Destinations](https://dev.reactive.network/origins-and-destinations) on 2026-11-16. Every hash below was produced by `scripts/collect-evidence.mjs` (`complete: true`) and `scripts/live-run.mjs` from chain receipts. The bundles are in `evidence/testnet-*.json`, the exact worker reports are in `evidence/reports/`, and the deployment manifest is in `deployments/`.

<!-- LIVE:START -->
| Contract | Chain | Address |
|---|---|---|
| SentinelReactive | Reactive Lasna (5318007) | [0x0bFA2E632818E2d152b8135fAb683DDC10922954](https://lasna.reactscan.net/address/0x0bFA2E632818E2d152b8135fAb683DDC10922954) |
| EscrowVault | ethereum-sepolia (11155111) | [0x07129A520b7B4703F948b0c874D858389B2F27B1](https://sepolia.etherscan.io/address/0x07129A520b7B4703F948b0c874D858389B2F27B1) |
| AssessmentGateway | ethereum-sepolia (11155111) | [0xbFFdFb18931111C1dafce8A8323568cf7874b611](https://sepolia.etherscan.io/address/0xbFFdFb18931111C1dafce8A8323568cf7874b611) |
| Callback proxy (official) | ethereum-sepolia | `0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4` |

Policy: freeze if score ≥ 6500 bps, or ≥ 5000 bps for deposits ≥ 0.001 ETH. Model hash `0x768da47313adbb5756f103a09c25027aa775fd0e71ff2cf6142f1b2cc4c8c531`.

| Escrow | Listing / deposit | Score → threshold | 1 EscrowOpened | 2 Reactive request | 3 AI job callback | 4 AI report | 5 Reactive decision | 6 Decision callback | Result | Wall-clock total |
|---|---|---|---|---|---|---|---|---|---|---|
| #1 | safe / 0.0001 ETH | 0 → 6500 | [`0x8e251077…ef2b4d`](https://sepolia.etherscan.io/tx/0x8e251077c4898b05316d1e1ecc32df3f3297c8c379c4b0a2719c2c1a5def2b4d) | [`0xd85b6f02…301d33`](https://lasna.reactscan.net/tx/0xd85b6f02ff634198243a4d47065d9f49e85dde91a246c5f2fd35dd8782301d33) | [`0xdd1fa21b…8be130`](https://sepolia.etherscan.io/tx/0xdd1fa21bc3bac1cd64286400d28051b3f3501dc467379ff8103543646c8be130) | [`0xcbf4f5cf…3c0158`](https://sepolia.etherscan.io/tx/0xcbf4f5cf5b01ab6cf5d051ebf0a038df1a814002614b5dfb7de26b5dc63c0158) | [`0xe4185379…446c19`](https://lasna.reactscan.net/tx/0xe4185379671904c63caed1bc447cbbb11750bf6f8f8cbcd62185cd4d34446c19) | [`0xb793eb50…a91b3c`](https://sepolia.etherscan.io/tx/0xb793eb505564f688e9919dedfffd30cc51a28a092d5a2f071426e2eee3a91b3c) | **Cleared** | 72.793 s |
| #2 | risky / 0.0001 ETH | 10000 → 6500 | [`0x2ce8dbd4…7db885`](https://sepolia.etherscan.io/tx/0x2ce8dbd44a9edf82ddf1397938a868b0605d55fb1a67630bd773e42ba97db885) | [`0x19d9d128…71156e`](https://lasna.reactscan.net/tx/0x19d9d128fac4ec0a32fe8a0f34ca5bad3ed10bb407b66e30b6f005783971156e) | [`0x16bc6833…6e7492`](https://sepolia.etherscan.io/tx/0x16bc683306f745d6d903dbb785bed0cf6fa00e084c1f7e0ab41ebe5d2b6e7492) | [`0x40c40589…08f20e`](https://sepolia.etherscan.io/tx/0x40c405897227b1b9653fa2cbda30cf8b977b7249855000717d0f6c530308f20e) | [`0xb9541992…ecbd14`](https://lasna.reactscan.net/tx/0xb95419929dd5129c7a83bbdbf52fa60ad686f5721e61737fbb02b34879ecbd14) | [`0x6c6cf92b…2aaddc`](https://sepolia.etherscan.io/tx/0x6c6cf92b34ab91598ef1c31b62c6fefb83f473e7e8256ac7babb2f361c2aaddc) | **Frozen** | 58.973 s |
| #3 | borderline / 0.0001 ETH | 6134 → 6500 | [`0x6aabcfa2…22c07d`](https://sepolia.etherscan.io/tx/0x6aabcfa2b16426bf1dfa40864973be6bf425b5dc2cb5bc58831c422d7622c07d) | [`0xaf2c2a25…c7f400`](https://lasna.reactscan.net/tx/0xaf2c2a25f5cec44a8db1ca568f583e159a6553621beed9ca08937a47adc7f400) | [`0x8788ab92…e813fc`](https://sepolia.etherscan.io/tx/0x8788ab92fe722d86979063430a5c0df45870ca1a18d978c9d35057ca9de813fc) | [`0xf78e5d70…9daebf`](https://sepolia.etherscan.io/tx/0xf78e5d70b5c587e5c2811a8dcbc96d45a6cd57b57453b2d9cc5e6866ec9daebf) | [`0xf379aa01…71d4a2`](https://lasna.reactscan.net/tx/0xf379aa01b76c01cabc9a6ace22e426f0be90e57aadeeef6ce6469aa12f71d4a2) | [`0x9e3f2179…028f45`](https://sepolia.etherscan.io/tx/0x9e3f217928103db4da102667cb3fd70fbc977c42b73218e8409d3be130028f45) | **Cleared** | 60.757 s |
| #4 | borderline / 0.001 ETH | 6134 → 5000 | [`0x106cd310…82716b`](https://sepolia.etherscan.io/tx/0x106cd31034891d33bdc9f31ff28e8ec226f70888c3fbc025d086339a2982716b) | [`0xe6bf9052…88a55b`](https://lasna.reactscan.net/tx/0xe6bf9052a83aca3b7243f5c06722d6f4c034e97a1089096b373e54934188a55b) | [`0x449ada71…a4f3be`](https://sepolia.etherscan.io/tx/0x449ada71c7506d7061d00fbbb883813bb79cd2b60a5b1ed9ab43346feba4f3be) | [`0x24c9b7ce…e12566`](https://sepolia.etherscan.io/tx/0x24c9b7ced6ce3731e570b3b236c325f983622ae37eda7a56282b05f012e12566) | [`0xac2b20d5…987d40`](https://lasna.reactscan.net/tx/0xac2b20d5f5bfdb24c3851e8592714b9bb98cdbf3fed26346e026e0a1f8987d40) | [`0xffdad6f8…9891f1`](https://sepolia.etherscan.io/tx/0xffdad6f80adb6b5ab5d7faf46d58c4076011e622e43ab9bb6e3404e0399891f1) | **Frozen** | 60.601 s |

Wall-clock legs (seconds after the previous stage was seen; 1 s RPC polling):

| Escrow | → Reactive request | → AI job callback | → AI report (incl. confirmations + inference) | → Reactive decision | → decision callback |
|---|---|---|---|---|---|
| #1 | 1.003 | 11.595 | 35.696 | 1.147 | 23.352 |
| #2 | 1.059 | 11.792 | 35.096 | 1.343 | 9.683 |
| #3 | 1.035 | 11.702 | 34.059 | 1.286 | 12.675 |
| #4 | 1.192 | 10.588 | 37.979 | 1.337 | 9.505 |

Buyer settlements: release of cleared #1 [`0x9956291f…128cd9`](https://sepolia.etherscan.io/tx/0x9956291fdf653f67221ea26ff85323c1b9db8ba72ce382c6ee684ef69c128cd9), refund of frozen #2 [`0xafaed4da…70a114`](https://sepolia.etherscan.io/tx/0xafaed4da3c2f12bc2fca0960e30a29d911d35a1145345238a04ef2ffda70a114). Escrows #3 (Cleared) and #4 (Frozen) were left open for the demo video.
<!-- LIVE:END -->

**Size-aware policy.** Escrows #3 and #4 carry the *same* listing, and the live model scored both at 6134 bps. Reactive cleared the 0.0001 ETH deposit at the base threshold of 6500 and froze the 0.001 ETH deposit at the stricter 5000. The threshold is chosen inside `SentinelReactive.react()` from the deposit amount in `EscrowOpened` and stored with the request, so a retry can never change it.

**Reading the latency.** About 60 s end to end. The two Reactive legs, origin event → Lasna tx and AI report → Lasna tx, each took about 1 s. Each Lasna → Sepolia callback lands in the next one or two Sepolia blocks (12 s blocks). The largest leg, about 35 s, is the worker deliberately waiting for `CONFIRMATIONS=2` Sepolia blocks before it trusts the job. Inference itself takes well under 1 ms.

**Callback provenance.** The evidence collector first asks the system contract's `getCallbacks(txHash)`. On Lasna this currently returns no records: we found no `CallbackPosted` events from `0x8888…` in the last 9,000 blocks, so validators don't appear to be storing them. In that case the collector proves each callback another way. It checks that the Reactive tx emitted `CallbackRequest(origin, SentinelReactive, AssessmentGateway)` from the system contract, that the destination tx was sent by the Reactive signer to the **official callback proxy**, and that its calldata carries the exact requested payload. The bundle records which method was used.

Supported origins: **Ethereum Sepolia (11155111)** and **Base Sepolia (84532)**. Set `ORIGIN_RPC_URL`; `BASE_RPC_URL` is still accepted. No mainnet path is provided. Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md) with dedicated testnet accounts.

The public-chain evidence collector refuses to mark a bundle complete without matching origin events, two Reactive transactions, two callbacks, a committed model/report, and successful system callback records. Existing `evidence/local-demo.json` is explicitly local and must not be submitted as public testnet proof.

Read [RESEARCH.md](docs/RESEARCH.md) for verified rules and unresolved questions, and [SUBMISSION.md](docs/SUBMISSION.md) for the remaining external steps.

## Reproducibility and delivery

- Direct dependencies are pinned in `package.json`; transitive dependencies in `package-lock.json`.
- Model generation uses a fixed PRNG seed; weights are included.
- Compiler standard JSON input and ABI/bytecode artifacts are included in the download and regenerated by `npm run compile`.
- Local chains use ephemeral accounts and reset when the server exits. Archived runs are labeled and cannot be settled.
- Fresh current-session runs are recorded under ignored `.state/`; preserve downloaded evidence before restarting.
- The ZIP has no wallet keys, `.env`, dependencies, runtime checkpoints or false deployment addresses.
- See [VALIDATION.md](docs/VALIDATION.md) for performed checks and verification boundaries.

MIT license. This is an unaudited hackathon prototype; its testnet-first scope is intentional.
