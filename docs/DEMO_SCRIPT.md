# Demo script — target 2 minutes 40 seconds

Record **after** public testnet deployment. Have a normal and risky completed testnet loop ready in case network delivery is slower than the recording window. Use their real explorer receipts; do not present a prerecorded local run as live Lasna execution.

| Time | Screen and narration |
| --- | --- |
| 0:00–0:15 | Title and problem. “Suspicious listings can pressure buyers into paying before they understand the risk. Sentinel holds the deposit, runs an assessment, and lets Reactive enforce the result.” |
| 0:15–0:35 | Architecture diagram. “There are two Reactive stages. First it requests inference; then it applies the threshold. The worker only reports a score.” |
| 0:35–1:05 | Show real testnet normal trade, the worker's report and callback state. “The model ran on this listing; the report and model hash are committed. The trade cleared, but only the buyer can release.” Submit buyer release or show its existing receipt. |
| 1:05–1:40 | Show the credential-extraction listing, held state and refund transaction. “This request crossed the threshold. A seller cannot withdraw. The buyer recovers the deposit.” |
| 1:40–2:10 | Show `evidence/testnet-ID.json`, origin hash, both Lasna route hashes and callback hashes in explorers. Show `complete: true` and the two successful system callback records. “These receipts prove the full loop, rather than just a UI animation.” |
| 2:10–2:30 | Show tests and model card. “The local demo is reproducible without API keys. The small neural model uses synthetic training and is not a production fraud detector. A single reporter is trusted; the report hash is not proof of inference.” |
| 2:30–2:40 | Repo link and closing. “Model-assisted, contract-enforced, buyer-controlled.” |

## Local rehearsal

1. `npm start`, open the local dashboard.
2. Select “High risk”, click “Run protected escrow”, inspect all six receipts.
3. Click “Buyer: refund deposit”.
4. Run a normal listing and release it.
5. Download evidence and inspect the model tab.

Label this rehearsal **local simulation**. The dashboard is a local tool; the final testnet demo should use actual explorers and worker logs alongside it. This ZIP includes the script, not a fabricated submission video.
