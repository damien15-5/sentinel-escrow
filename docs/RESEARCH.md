# Research notes — November 16, 2026

## Event findings

The [organizer's announcement](https://blog.reactive.network/reactive-omni-buildathon-thirty-days-to-find-out-what-one-second-buys/) puts the event on **November 5–December 5, 2026**. November 16 is inside that build window; waiting until November 30 is unnecessary. It lists $5,500 total, denominated in USD and paid in REACT. The AI track has a $1,000 first prize and requires AI to participate in the running system. It evaluates execution, integration, usefulness and craft, with on-chain Reactive execution and callbacks essential. A public open-source repo, deployed addresses, complete-loop transaction hashes and a video shorter than three minutes are required. Earlier work may be used as a dependency, not as the project itself.

The [DoraHacks event page](https://dorahacks.io/hackathon/reactive-omni-buildathon) returned HTTP 405 to both research fetch methods. Therefore the brief's exact **December 5 at 9:00 PM**, timezone, participant count, and age/team/country conditions were **not independently confirmed**. The announcement only establishes the date. Confirm these in the logged-in event page or with organizers before relying on eligibility or the exact cutoff. No account registration or message to organizers has been performed.

## Technical findings that changed the implementation

| Finding | Implementation consequence | Primary source |
| --- | --- | --- |
| Omni removes the old RVM split and uses system-authenticated reactive calls | A single contract with `msg.sender` restricted to the system | [Getting started / Omni migration](https://dev.reactive.network/) |
| New callbacks are requested with `requestCallbackV_1_0` | No legacy emitted `Callback` mechanism | [Reactive contracts](https://dev.reactive.network/reactive-contracts) |
| Callback sender argument is the **reactive contract address**, not a legacy deployer/RVM identity | Gateway checks both proxy caller and injected reactive address | [Callback contracts](https://dev.reactive.network/callback-contracts) |
| System address is `0x8888888888888888888888888888888888888888` | Constant in the production reactive contract | [Network parameters](https://dev.reactive.network/reactive-mainnet) |
| Base Sepolia proxy is `0x476F44b11F5C942c58f4c8E3d0300E5710743585` | Deployment config checks that address has code | [Origins and destinations](https://dev.reactive.network/origins-and-destinations) |
| Reactive transactions and callbacks have separate fee balances; debt stops delivery | Separate fee-paying gateway, health checks and debt recovery instructions | [Economy](https://dev.reactive.network/economy) |
| The system can expose callback results keyed by Reactive transaction hash | Collector cross-checks `getCallbacks(uint256)` | [Economy / inspecting callbacks](https://dev.reactive.network/economy#inspecting-callbacks) |
| Fast Base blocks make block-count timers unsuitable | Escrow timeout uses `block.timestamp` | [Buildathon announcement](https://blog.reactive.network/reactive-omni-buildathon-thirty-days-to-find-out-what-one-second-buys/) |

The public [official Omni interface repository](https://github.com/Reactive-Network/reactive-lib-omni) was inspected at commit `3ade0dcf1d27e67e5783ef807e73a1b9e0c0cce8`. The project independently implements its small ABI compatibility surface in `contracts/Omni.sol`; it does not vendor the upstream `UNLICENSED` base implementations. EVM target is Shanghai for broad simulator compatibility, with Solidity 0.8.29.

## Track choice and pitch

Target **Reactive Meets AI**. The entry's differentiator is the separation of powers: Reactive starts the AI job, the AI only attests a score, Reactive applies policy, the gateway authenticates delivery, and the buyer alone controls payout. Two real callback stages make Reactive substantive. The reproducible local model removes paid API keys from the judge's local setup.

This is a prototype of a marketplace protection mechanism, not a claim that a small synthetic model can make safe financial decisions. Show one normal listing and one credential-extraction listing, report the model's limitations, and expose every transaction.

## Questions to send yourself to the organizers

> I'm entering Reactive Meets AI with a newly built escrow prototype using live neural inference and Lasna/Base Sepolia callbacks. Could you confirm the exact deadline and timezone, minimum age, team-size and country restrictions, and whether this synthetic-trained local neural model meets the AI-track requirements? Are there any licensing, identity-verification or prize-payment conditions beyond the published brief?

This is a draft, not a sent message. Ask about the synthetic-model interpretation before assuming acceptance; track fit is our reading of the published neural-network requirement, not an organizer decision.
