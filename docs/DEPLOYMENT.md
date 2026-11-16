# Deploy to Base Sepolia + Lasna

No public deployment was performed in this delivery. All addresses and transaction hashes in `evidence/local-demo.json` belong to ephemeral local simulators.

## 1. Prepare

Use Node 22+ and dedicated **testnet-only** wallets. Install dependencies with `npm ci` and run `npm test`.

Copy `.env.example` to `.env` and edit it locally. Never paste keys into a chat, commit them, or reuse a wallet holding real assets. Set:

```dotenv
BASE_RPC_URL=https://sepolia.base.org
REACTIVE_RPC_URL=https://lasna-rpc.rnk.dev
DEPLOYER_PRIVATE_KEY=YOUR_TESTNET_DEPLOYER_KEY
REPORTER_ADDRESS=YOUR_TESTNET_REPORTER_ADDRESS
REPORTER_PRIVATE_KEY=YOUR_TESTNET_REPORTER_KEY
BUYER_PRIVATE_KEY=YOUR_TESTNET_BUYER_KEY
```

These are placeholders, not usable keys. Use an RPC provider you trust if the public endpoints throttle requests. The same deployer address is used on both networks; it needs Base Sepolia ETH and Lasna REACT. Reporter and buyer need Base Sepolia ETH. A seller can be a different address you control.

## 2. Fund both fee budgets

Official network parameters and faucet instructions: [Reactive Mainnet / Lasna Testnet](https://dev.reactive.network/reactive-mainnet).

The documented Lasna faucet is funded using Sepolia ETH, not a free HTTP endpoint:

- Base Sepolia faucet contract: `0x2afaFD298b23b62760711756088F75B7409f5967`.
- Ethereum Sepolia faucet contract: `0x9b9BB25f1A81078C544C829c5EB7822d747Cf434`.
- Published conversion: 1 test ETH → 100 test REACT; do not send more than the published 5 ETH per-transaction cap.
- Recheck the official page before sending, especially if returning to this project later.

Deployment defaults put **1 test REACT** into `SentinelReactive` and **0.003 test ETH** into `AssessmentGateway`, plus deployment gas. These are configurable starting balances, not a promise of a particular number of runs. `EscrowVault` receives buyer principal only. Keep additional ETH for the reporter and buyer transactions.

## 3. Verify network and deploy

```sh
npm run preflight
npm run deploy:testnet
```

The scripts reject any network pair other than 84532/5318007 and check code at the documented Omni system and Base callback proxy. They do not infer compatibility solely from a successful RPC connection; contract behavior still needs an actual deployed loop.

The deployment writes `.state/deployment.json` after each successful contract creation. Re-running it resumes existing addresses and completes one-time wiring. It checks the configured owner, reporter, threshold and model hash against the persisted manifest. If a transaction was broadcast but the process crashed **before the receipt was saved**, inspect your deployer's explorer history before rerunning; this is not a replacement for transaction reconciliation. Do not overwrite a manifest for an entry whose evidence you want to preserve.

For a new model/threshold/reporter, choose a fresh `DEPLOYMENT_FILE`. Regenerating weights before or during an existing deployment changes the model hash and makes the worker refuse it. The public contract names and addresses are under `contracts` in the manifest; no private keys are written there.

## 4. Start the model worker

In terminal A:

```sh
npm run worker
```

Leave it running. It verifies the key matches the gateway's reporter and the local model matches the pinned hash. It waits for confirmed `AssessmentRequested` events, fetches their original listing, verifies the commitment, executes the model and submits `reportRisk`.

Checkpoint files and exact report bytes are in `.state/`. **Back up the reports for your demo runs**. The evidence collector will require them. Never commit the whole `.state` directory; copy the sanitized deployment manifest and verified evidence JSONs to a public `deployments/` or `evidence/` directory instead.

## 5. Create a normal and risky trade

In terminal B:

```sh
node scripts/open-escrow.mjs safe YOUR_SELLER_ADDRESS
node scripts/open-escrow.mjs risky YOUR_SELLER_ADDRESS
```

Each uses `BUYER_PRIVATE_KEY`, deposits 0.0001 test ETH and sets a one-hour timestamp deadline. The seller must differ from the buyer. Save the printed IDs and origin hashes. Wait for both Reactive stages and callbacks; there is no fabricated one-second end-to-end guarantee.

```sh
node scripts/manage.mjs release SAFE_ESCROW_ID
node scripts/manage.mjs refund RISKY_ESCROW_ID
```

The first requires a cleared, unexpired trade; the second requires a frozen trade or expired pending/cleared trade. All releases/refunds must be sent by the original buyer. Reverts do not imply a successful settlement.

## 6. Collect verifiable proof

```sh
npm run evidence -- SAFE_ESCROW_ID
npm run evidence -- RISKY_ESCROW_ID
```

Open `evidence/testnet-ID.json`. A complete bundle has `mode: "testnet"` and `complete: true`. The collector checks:

1. Origin `EscrowOpened` receipt.
2. Lasna `AssessmentRouted` and its exact origin transaction hash.
3. Base `AssessmentRequested` callback.
4. Base `RiskReported` plus model/report commitments.
5. Lasna `DecisionRouted` and its exact report transaction hash.
6. Base `AssessmentApplied` with the expected score and threshold result.
7. Successful system `getCallbacks` records linking both Reactive transactions to their respective destination receipts.
8. Exact worker JSON matching the committed report hash.

Pending or mismatched evidence is written with `complete: false`, an error, and a nonzero exit code. If callbacks are still arriving, rerun after they complete. The collector uses bounded `eth_getLogs` chunks and may take time on old deployments. It deliberately does not treat transaction status alone as proof of a successful state transition.

## 7. Recover an interrupted run

```sh
node scripts/health.mjs
```

Check both fee balances, reserves and debt. A balance top-up alone does not necessarily clear existing debt. Call the contract's `coverDebt()` after topping it up, or call the service provider's `depositTo(target)` with the correct target. Current fee mechanics: [Reactive economy](https://dev.reactive.network/economy).

If a previously requested callback failed, restore the fee balance/debt, then:

```sh
node scripts/manage.mjs retry ESCROW_ID
```

This uses the deployer on Lasna, waits at least 30 seconds between retries, and only resends the stored request or decision before the deadline. If the worker was stopped, restart it; confirmed logs are scanned from its checkpoint. If the deadline has elapsed, use the buyer refund path and open a new demo trade.

## 8. Verify source and publish

Use the generated `artifacts/compiler-input.json` standard JSON with the explorer's verification form. Compiler: `v0.8.29+commit.ab55807c`; optimizer enabled, 200 runs; EVM target `shanghai`. Constructor arguments are recorded by the deployment script's source/config and must match your actual deployment. Publish source and sanitized evidence, never private keys or `.env`.

The local dashboard remains a simulator. Use explorers and terminal scripts to demonstrate actual testnet execution, clearly labeling which environment the viewer is seeing.
