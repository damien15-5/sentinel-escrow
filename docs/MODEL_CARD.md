# Sentinel MLP v1 model card

## Intended use

A transparent demonstration of **live neural inference inside an event-driven on-chain workflow**. Scores select whether a sample escrow is cleared for buyer approval or held for immediate refund. The model is not suitable for production fraud detection, identity judgments or autonomous financial disbursement.

## Implementation

- 10 input features, each bounded to `[0,1]` by clipping matching phrase counts divided by two.
- Feature groups: credential requests, off-platform payments, guaranteed returns, urgency, irreversible payment terms, impersonation, missing details, buyer protection, delivery terms and specific descriptions.
- Fully connected hidden layer with 12 tanh neurons and a sigmoid output; 145 trainable parameters.
- SGD with binary cross-entropy gradient, 140 epochs, deterministic seed `20261116` and small weight decay.
- 1,800 synthetic examples generated from separate benign, malicious and ambiguous phrase templates.
- No foundation-model dependency, external endpoint, network call or API credential.
- `npm run train` regenerates `model/weights.json`; `src/risk.mjs` performs every live forward pass.

The feature extractor uses explicit lexical signals, but the final score is computed by trained neural weights. This is a deliberately small hybrid, not an LLM, a lookup table of the demo outcomes or a hardcoded decision for a scenario ID. The worker receives listing text from the original on-chain event, not a user-selected UI risk label.

## Evaluation

`node model/evaluate.mjs` writes `evidence/model-probes.json`. The current model matches 11 of 12 manually labeled, held-out **synthetic probes**. One vague offer without the training curriculum's urgency signals scores 4956/10000 and falls below the 6500 hold threshold. That miss is retained in the report. These probes are tiny, related to the feature design and not independently representative of marketplace fraud. Do not describe this as 91.7% production accuracy.

The UI's normal, risky and ambiguous scenarios are demonstration probes, not an unbiased evaluation set. A score of 10000 is a saturated sigmoid result, not certainty of fraud. A score of 0 is not a guarantee of safety.

## Known limitations

- English phrases only; paraphrases, Unicode tricks, multilingual and obfuscated content can evade detection.
- Substring features do not understand negation or the truth of a claim. “Never send your seed phrase” can look suspicious; “refunds” can match within “no refunds”.
- Benign details can be fabricated; no on-chain account history or seller reputation is verified.
- Out-of-distribution text is not detected reliably. An empty feature vector can still produce a score.
- Synthetic labels bake in the author's assumptions. There is no real fraud dataset, calibration, demographic analysis, human annotation program or production robustness validation.
- Hashing the weights does not cryptographically prove inference was executed correctly. The authorized reporter remains trusted.

## Improvement path after the hackathon

Gather a properly consented and licensed evaluation set; measure false positives and negatives under realistic attacks; add language/unknown-input handling; compare with a trained semantic encoder; introduce model version governance and more than one attestor if needed. Changes to the model require redeploying this prototype to pin the new hash. Preserve buyer approval and deterministic refund recovery even if a stronger model is adopted.
