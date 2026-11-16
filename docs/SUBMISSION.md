# Submission package

**Status: live on Reactive Lasna + Ethereum Sepolia with four verified loops. Not yet published or submitted.**

## Suggested entry

**Name:** Sentinel Escrow

**Track:** Reactive Meets AI

**One line:** Live neural risk assessment, on-chain Reactive enforcement, and buyer-controlled escrow.

**Short description:**

Sentinel holds a buyer's deposit while a live neural model assesses the listing. It is live on Reactive Lasna + Ethereum Sepolia. A Reactive contract observes the deposit event and requests an assessment through an authenticated callback. The worker verifies the listing commitment, runs the pinned model and commits a risk report. Reactive then applies a size-aware threshold, fixed when the deposit is observed (stricter for larger deposits), and sends a second callback to clear or freeze the escrow. A buyer can release a cleared trade or recover a frozen deposit; stalled assessments have a timestamp-based refund path.

Reactive owns both workflow transitions. The AI reporter cannot release funds or call the escrow directly. Fee balances are separate from buyer deposits. The code includes reproducible neural training, adversarial contract tests, a local control room, deployment tooling and an evidence collector that checks cross-chain causality and actual callback records.

The included model is trained on synthetic examples and is intentionally presented as a demonstration, not a production fraud detector. The oracle is a trusted reporter; report commitments do not claim cryptographic proof of inference.

## Before submission

- [ ] Register at [DoraHacks](https://dorahacks.io/hackathon/reactive-omni-buildathon).
- [ ] Confirm exact December 5 deadline **and timezone**; the supplied 9 PM time was not independently verified.
- [ ] Confirm age, country, team-size and prize-payment eligibility.
- [ ] Confirm the synthetic-trained neural model's track fit with organizers.
- [ ] Replace any generic project authorship/team information with your actual details.
- [ ] Create a public GitHub repository and push the source with MIT license.
- [x] Deploy to Lasna + Ethereum Sepolia (Base Sepolia also supported).
- [x] Run the model worker live and capture normal, risky and size-aware examples.
- [x] Save verified `complete: true` public testnet evidence bundles (escrows #1–#4).
- [x] Add deployed addresses, explorer links and readable transaction tables to the README.
- [ ] Verify source in explorers if available.
- [ ] Record and host a demo video shorter than 3 minutes.
- [ ] Submit the real repository URL, deployed addresses, hashes and video link.

## Live deployment (real, verified)

| Field | Value |
| --- | --- |
| Repository | NOT PUBLISHED YET (github.com/damien15-5, pending) |
| Demo video | NOT RECORDED YET |

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

## Judging narrative

| Criterion | Show |
| --- | --- |
| Execution | A real origin receipt, two Lasna reactive receipts, two Sepolia callback receipts, worker attestation, final contract state |
| Integration | Removing Reactive stops both job creation and policy enforcement; the worker only attests |
| Usefulness | Deposits start held; a suspicious request cannot take a seller payout; the buyer has recovery |
| Craft | Double callback authentication, isolated gas budget, idempotence, timestamp expiry, explicit model limits, tests and exact report commitments |

No winning outcome is promised. The prize is competitive and the model's deliberately narrow scope should be stated openly.
