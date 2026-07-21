/**
 * lib/newsCategory.js — classify a headline into a topic bucket.
 *
 * Headlines from /api/news carry no category field, so the details page groups them into a small,
 * familiar set of tabs by keyword. Pure and exported so it can be unit-tested and reused. Order
 * matters: the first matching rule wins, most-specific first; anything unmatched is "Markets".
 */
export const NEWS_CATS = ["Earnings", "Analyst", "Deals", "Product", "Markets"];

const NEWS_CAT_RULES = [
  ["Earnings", /\b(earning|revenue|profit|loss|quarter|q[1-4]\b|results?|guidance|eps|margin|dividend|forecast)/i],
  ["Analyst", /\b(analyst|rating|upgrade|downgrade|price target|outperform|overweight|underweight|reiterate|buy rating|sell rating|initiat)/i],
  ["Deals", /\b(acqui|merger|buyout|stake|deal|ipo|takeover|raise[sd]?|funding|invest(ment|s|ed)?|partnership|joint venture)/i],
  ["Product", /\b(launch|unveil|release[sd]?|product|feature|rollout|debut|introduc|expands?|new (model|service|app))/i],
];

export function newsCatOf(title) {
  const t = String(title || "");
  for (const [cat, re] of NEWS_CAT_RULES) if (re.test(t)) return cat;
  return "Markets";
}
