# Security and operational limits

This code is an unaudited testnet prototype. The tests validate important invariants, not all possible behavior of a real network.

| Threat | Implemented defense / limit |
| --- | --- |
| Direct forged callback | Proxy caller AND injected reactive sender both checked |
| Other reactive contract uses legitimate proxy | Immutable allowed Reactive address |
| Arbitrary caller fakes an origin event | `react()` accepts only the Omni system and exact chain/source/topic shape |
| Reporter tries to directly release money | Reporter has no vault permission; buyer alone releases |
| Reporter lies about score | Not solved cryptographically; single reporter is a documented trust assumption |
| Duplicate or replayed origin/report/callback | Once-per-ID state; immutable listing/report binding; finalized vault state cannot reopen |
| Callback arrives late | No decision accepted at or after escrow deadline; buyer can reclaim |
| Worker/RPC/network stalls | Funds remain held; timestamp refund path |
| Model false positive | Buyer can refund immediately; no permanent seizure |
| Model false negative | Buyer approval is still necessary; does not guarantee safety |
| Callback billing drains deposit | Gateway and Reactive hold fees, vault holds buyer principal |
| Reentrant withdrawal | State/accounting updates before transfer; malicious-buyer regression test |
| Listing supplies HTML or prompt instructions | UI escapes markup; neural scorer treats text as data |
| Local API request forgery | Loopback binding, host check, same-origin check and JSON-only mutation routes |
| Secret exposure | No wallet keys needed locally; testnet keys in ignored `.env`; no secrets in ZIP |

## Intentional simplifications

- Anyone can open an escrow and consume the operator-funded assessment budget. Production use requires a fee/quota/admission design. A minimum deposit alone is not a full anti-spam solution.
- Buyer's seller address and listing are self-supplied. The protocol does not verify seller consent, product ownership, delivery or truthful listing content.
- Buyers can reclaim any uncompleted trade after timeout, even if a seller claims delivery. No dispute resolution is implemented.
- No emergency-admin override, oracle key rotation, upgrades, multisig or production monitoring service is included.
- Mock Omni contracts have intentionally unrestricted transport methods; they are **test-only** and must never be deployed as authentication infrastructure.
- Callback delivery, fee accounting and source-event authenticity ultimately rely on the actual Reactive network/proxy.
- The local dashboard signs with ephemeral simulator accounts. It is not an internet-facing service and must not be bound or reverse-proxied publicly as-is.

## User funds

The vault does not inherit the fee payer and does not implement `pay`. Gateway fees cannot use vault deposits. Deposits update `totalLocked`; transfers only occur through buyer-authorized release/refund after state and accounting changes. ETH forced into the vault is not included in `totalLocked` and has no recovery function. This prototype deliberately omits an admin sweep to keep deposited funds beyond admin withdrawal authority.

## Model report privacy

Listings are emitted on-chain in full. Report feature vectors and hashes are public or exported. Never put real passwords, recovery phrases, private keys, personal identification or private customer records in a listing. Demo phrases mention those concepts but contain no real secrets.
