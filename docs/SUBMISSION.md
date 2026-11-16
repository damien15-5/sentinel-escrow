# Submission package

**Status: local prototype completed; external steps remain with you.**

## Suggested entry

**Name:** Sentinel Escrow

**Track:** Reactive Meets AI

**One line:** Live neural risk assessment, on-chain Reactive enforcement, and buyer-controlled escrow.

**Short description:**

Sentinel holds a buyer's deposit while a live neural model assesses the listing. A Reactive contract observes the deposit event and requests an assessment through an authenticated callback. The worker verifies the listing commitment, runs the pinned model and commits a risk report. Reactive then applies an immutable threshold and sends a second callback to clear or freeze the escrow. A buyer can release a cleared trade or recover a frozen deposit; stalled assessments have a timestamp-based refund path.

Reactive owns both workflow transitions. The AI reporter cannot release funds or call the escrow directly. Fee balances are separate from buyer deposits. The code includes reproducible neural training, adversarial contract tests, a local control room, deployment tooling and an evidence collector that checks cross-chain causality and actual callback records.

The included model is trained on synthetic examples and is intentionally presented as a demonstration, not a production fraud detector. The oracle is a trusted reporter; report commitments do not claim cryptographic proof of inference.

## Before submission

- [ ] Register at [DoraHacks](https://dorahacks.io/hackathon/reactive-omni-buildathon).
- [ ] Confirm exact December 5 deadline **and timezone**; the supplied 9 PM time was not independently verified.
- [ ] Confirm age, country, team-size and prize-payment eligibility.
- [ ] Confirm the synthetic-trained neural model's track fit with organizers.
- [ ] Replace any generic project authorship/team information with your actual details.
- [ ] Create a public GitHub repository and push the source with MIT license.
- [ ] Deploy to Lasna + Base Sepolia using the guide.
- [ ] Run the model worker live and capture normal and risky examples.
- [ ] Save both verified `complete: true` public testnet evidence bundles.
- [ ] Add deployed addresses, explorer links and readable transaction tables to your README.
- [ ] Verify source in explorers if available.
- [ ] Record and host a demo video shorter than 3 minutes.
- [ ] Submit the real repository URL, deployed addresses, hashes and video link.

## Fill with your actual deployment

| Field | Value |
| --- | --- |
| Repository | NOT PUBLISHED |
| Demo video | NOT RECORDED |
| Lasna SentinelReactive | NOT DEPLOYED |
| Base Sepolia EscrowVault | NOT DEPLOYED |
| Base Sepolia AssessmentGateway | NOT DEPLOYED |
| Normal-trade evidence | NOT COLLECTED ON TESTNET |
| Risky-trade evidence | NOT COLLECTED ON TESTNET |

Do not paste the local simulator's addresses/hashes into this table. Local evidence is useful for reproduction, but it does not satisfy the event's public on-chain execution requirement.

## Judging narrative

| Criterion | Show |
| --- | --- |
| Execution | A real origin receipt, two Lasna reactive receipts, two Base callback receipts, worker attestation, final contract state |
| Integration | Removing Reactive stops both job creation and policy enforcement; the worker only attests |
| Usefulness | Deposits start held; a suspicious request cannot take a seller payout; the buyer has recovery |
| Craft | Double callback authentication, isolated gas budget, idempotence, timestamp expiry, explicit model limits, tests and exact report commitments |

No winning outcome is promised. The prize is competitive and the model's deliberately narrow scope should be stated openly.
