import {assess} from '../src/risk.mjs';
import {save} from '../src/chain.mjs';
// Handwritten held-out probes, not a real-world benchmark or a validation dataset.
const probes=[
  ['clear','Camera model X200 in tested condition. Photos and serial available. Shipping with tracking.'],
  ['clear','Milestone payment for logo delivery within 5 days. Invoice and refund terms included.'],
  ['clear','Mechanical keyboard, dimensions listed; photographs show condition. Buyer inspection before payment.'],
  ['clear','Used desk with dimensions and photos. Receipt provided; return policy available.'],
  ['clear','Headphone model M50, tested. Shipping tracking and inspection through escrow.'],
  ['clear','Book bundle. Delivery in 3 days with tracking and receipt.'],
  ['hold','Your account suspended. Official support needs your recovery phrase and wallet password.'],
  ['hold','Act now. Risk-free daily returns. Double your money with guaranteed instant profit.'],
  ['hold','Pay directly outside the platform using a gift card. No refunds.'],
  ['hold','Send private key to verify your wallet. Official support on Telegram.'],
  ['hold','Secret deal, details later, no questions. Trust me.'],
  ['hold','Urgent wire transfer. Pay directly on WhatsApp. Last chance.'],
];
const rows=probes.map(([expected,listing])=>{const report=assess(listing);return {expected,actual:report.score>=6500?'hold':'clear',score:report.score,listing};});
const output={disclaimer:'12 handwritten synthetic held-out probes. Not a real-world fraud accuracy estimate.',correct:rows.filter(r=>r.actual===r.expected).length,total:rows.length,rows};
save('evidence/model-probes.json',output);console.log(JSON.stringify(output,null,2));
