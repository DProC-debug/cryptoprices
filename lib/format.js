// Display formatters for CoinGecko values, exposed to templates via app.locals.
const LOCALE = "en-US";

const USD = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const USD_SMALL = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 4,
});
const USD_COMPACT = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const NUMBER = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const NUMBER_COMPACT = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const PERCENT_WHOLE = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const DATE = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone: "UTC" });
const RELATIVE_TIME = new Intl.RelativeTimeFormat(LOCALE, { numeric: "always" });

// Years only from 2 onwards, so 13 months reads as "13 months ago" rather than "1 year ago".
const TIME_UNITS = [
  ["year", 365 * 24 * 3600, 2],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const NOT_AVAILABLE = "N/A";

const isMissing = (value) => value == null || Number.isNaN(Number(value));

// Exact number with thousands separators, e.g. 19,950,000.
export function formatNumber(value) {
  return isMissing(value) ? NOT_AVAILABLE : NUMBER.format(value);
}

// Prices: $73,721.18 · $0.9998 · $0.0₇5514 (subscript = number of zeros after the decimal point).
export function formatUsd(value) {
  if (isMissing(value)) return NOT_AVAILABLE;
  const amount = Number(value);
  const magnitude = Math.abs(amount);

  if (magnitude >= 1 || magnitude === 0) return USD.format(amount);
  if (magnitude >= 0.0001) return USD_SMALL.format(amount);

  const leadingZeros = -Math.floor(Math.log10(magnitude)) - 1;
  const significant = (magnitude * 10 ** (leadingZeros + 4)).toFixed(0).replace(/0+$/, "");
  const subscript = [...String(leadingZeros)].map((digit) => SUBSCRIPT_DIGITS[digit]).join("");
  return `${amount < 0 ? "-" : ""}$0.0${subscript}${significant}`;
}

// Full precision without scientific notation, for tooltips: $0.000000055142.
export function formatExactUsd(value) {
  if (isMissing(value)) return NOT_AVAILABLE;
  return `$${Number(value).toLocaleString(LOCALE, { maximumFractionDigits: 20 })}`;
}

// Large dollar amounts: $1.46T, $2.09B.
export function formatCompactUsd(value) {
  return isMissing(value) ? NOT_AVAILABLE : USD_COMPACT.format(value);
}

// Large quantities: 420.69T, 19.95M.
export function formatCompactNumber(value) {
  return isMissing(value) ? NOT_AVAILABLE : NUMBER_COMPACT.format(value);
}

// CoinGecko percentages are already ×100, e.g. -41.53 → "-41.5%".
export function formatPercent(value) {
  if (isMissing(value)) return "";
  const fraction = Number(value) / 100;
  // Very large moves (common for all-time lows) read better without decimals.
  return Math.abs(fraction) >= 10 ? PERCENT_WHOLE.format(fraction) : PERCENT.format(fraction);
}

// ISO timestamp → "Oct 6, 2025".
export function formatDate(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? NOT_AVAILABLE : DATE.format(date);
}

// ISO timestamp → "1 month ago".
export function formatTimeAgo(isoString, now = Date.now()) {
  const seconds = (new Date(isoString).getTime() - now) / 1000;
  if (Number.isNaN(seconds)) return "";

  for (const [unit, unitSeconds, minimumUnits = 1] of TIME_UNITS) {
    if (Math.abs(seconds) >= unitSeconds * minimumUnits) {
      return RELATIVE_TIME.format(Math.trunc(seconds / unitSeconds), unit);
    }
  }
  return "just now";
}

// "positive" / "negative" CSS modifier for a signed change.
export function changeClass(value) {
  if (isMissing(value) || Number(value) === 0) return "";
  return Number(value) > 0 ? "positive" : "negative";
}
