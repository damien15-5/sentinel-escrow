export const FEATURE_NAMES = ['credential_request','off_platform_payment','guaranteed_returns','urgency','irreversible_payment','impersonation','missing_details','buyer_protection','delivery_terms','specific_description'];
const groups = [
  /seed phrase|private key|recovery phrase|wallet password|verification code|password|secret phrase/gi,
  /outside (the )?(platform|escrow)|direct (payment|transfer)|pay (me )?directly|telegram|whatsapp|bypass|off.platform/gi,
  /guaranteed|double your|risk.free|100% profit|daily returns|instant profit|investment returns/gi,
  /act now|urgent|immediately|last chance|today only|hurry|within (five|5|ten|10) minutes/gi,
  /gift card|wire transfer|untraceable|no refunds|non.refundable|crypto only/gi,
  /support agent|official support|verify your wallet|unlock your account|account suspended|security team/gi,
  /mystery|secret deal|details later|trust me|no questions|unspecified/gi,
  /refund|inspection|buyer protection|escrow|return policy|dispute/gi,
  /tracking|delivery|shipping|receipt|invoice|milestone|days|hours/gi,
  /serial|condition|photograph|photos|dimensions|model|specification|tested|included/gi,
];
export function features(text) {
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text,'utf8') > 2048) throw new Error('Listing must contain 1–2048 UTF-8 bytes');
  return groups.map(pattern=>Math.min(1,(text.toLowerCase().match(pattern)||[]).length/2));
}
export const SCENARIOS = {
  safe: {title:'Studio headphones · verified details', listing:'Studio headphones, model HD600. Tested condition with serial number and photos included. Shipping with tracking within 3 days. Buyer inspection and refund policy through escrow.'},
  risky: {title:'Wallet verification · urgent transfer', listing:'Official support agent: verify your wallet immediately. Send your seed phrase and private key on Telegram to unlock your account. Pay directly outside escrow, crypto only, no refunds. Guaranteed double your investment returns. Act now.'},
  ambiguous: {title:'Mystery electronics · incomplete listing', listing:'Mystery electronics bundle, details later. Trust me. Today only, hurry. Shipping available.'},
};
