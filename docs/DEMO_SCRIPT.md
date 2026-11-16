# Demo script — target 2 minutes 40 seconds

Deployment is live (Lasna + Ethereum Sepolia; addresses and every hash are in README → Live testnet deployment). Completed loops are ready to show: #1 Cleared → released, #2 Frozen → refunded, #3 Cleared (borderline, small), #4 Frozen (borderline, large). Escrow #4 is **still Frozen**, and the buyer can refund it at any time on camera. Escrow #3 is Cleared, but its release window closes at 19:27 UTC on 2026-11-16 (after that only a refund works). To show a release on camera, first run a fresh `live-run.mjs safe` loop, then release it. A fresh live loop takes about 60 s, so either start one at 0:20 and return to it, or show the completed receipts. Never present a local run as Lasna execution.

Commands, with the env loaded from the secrets file:
- Live loop: `node scripts/live-run.mjs risky .0001`
- Release: `node scripts/manage.mjs release 3`
- Frozen recovery: `node scripts/manage.mjs refund 4`
- Proof: `npm run evidence -- 4`
Keep `npm run worker` running in a visible terminal.

| Time | Screen and narration |
| --- | --- |
| 0:00–0:15 | Title and problem. “Suspicious listings can pressure buyers into paying before they understand the risk. Sentinel holds the deposit, runs an assessment, and lets Reactive enforce the result.” |
| 0:15–0:35 | Architecture diagram. “There are two Reactive stages. First it requests inference; then it applies the threshold. The worker only reports a score.” |
| 0:35–1:05 | Normal trade #1 on Etherscan + worker log line. “The model ran on this listing; the report and model hash are committed. The trade cleared, but only the buyer can release.” Show release tx 0x9956291f…128cd9, or release a freshly cleared escrow live. |
| 1:05–1:40 | Risky trade #2 (score 10000): Frozen, then refund tx 0xafaed4da…70a114. Then #3 vs #4: “Same listing, same score 6134. Reactive cleared the small deposit at 6500 and froze the large one at 5000. The policy lives in the reactive contract.” Refund #4 live. |
| 1:40–2:10 | Show `evidence/testnet-ID.json`, origin hash, both Lasna route hashes and callback hashes in explorers. Show `complete: true` and `callbackRecords` (CallbackRequest from 0x8888 → official proxy tx with the exact payload; Lasna's getCallbacks store is currently empty, which the bundle notes). “These receipts prove the full loop, rather than just a UI animation.” |
| 2:10–2:30 | Show tests and model card. “The local demo is reproducible without API keys. The small neural model uses synthetic training and is not a production fraud detector. A single reporter is trusted; the report hash is not proof of inference.” |
| 2:30–2:40 | Repo link and closing. “Model-assisted, contract-enforced, buyer-controlled.” |

## Local rehearsal

1. `npm start`, open the local dashboard.
2. Select “High risk”, click “Run protected escrow”, inspect all six receipts.
3. Click “Buyer: refund deposit”.
4. Run a normal listing and release it.
5. Download evidence and inspect the model tab.

Label this rehearsal **local simulation**. The dashboard is a local tool; the final testnet demo should use actual explorers and worker logs alongside it. This ZIP includes the script, not a fabricated submission video.
