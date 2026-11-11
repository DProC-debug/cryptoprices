import "dotenv/config";
import express from "express";
import axios from "axios";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as format from "./lib/format.js";
import { createTtlCache } from "./lib/cache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const VS_CURRENCY = "usd";

// Chart ranges offered on the coin page (CoinGecko `days` values).
const CHART_RANGES = [
  { days: 1, label: "24H" },
  { days: 7, label: "7D" },
  { days: 30, label: "1M" },
  { days: 90, label: "3M" },
  { days: 365, label: "1Y" },
];
const DEFAULT_CHART_DAYS = 7;
const ALLOWED_CHART_DAYS = new Set(CHART_RANGES.map(({ days }) => days));

// CoinGecko coin IDs shown on the home page.
const TRACKED_COINS = [
  "bitcoin",
  "ethereum",
  "solana",
  "layerzero",
  "bonk",
  "notcoin",
  "catizen",
  "popcat",
  "zetachain",
  "neiro",
  "aptos",
  "sui",
  "pepe",
  "bittensor",
  "tether",
  "arbitrum",
  "optimism",
  "aleo",
  "celestia",
  "starknet",
];

// CoinGecko IDs are lowercase letters, digits and hyphens.
const COIN_ID_PATTERN = /^[a-z0-9-]+$/;

const MAX_SUGGESTIONS = 8;
const MAX_QUERY_LENGTH = 50;

// Caches keep repeated searches and chart range switches from burning through the API rate limit.
const searchCache = createTtlCache({ ttlMs: 5 * 60 * 1000 });
const chartCache = createTtlCache({ ttlMs: 2 * 60 * 1000 });

const coingecko = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
  headers: process.env.API_KEY ? { "x-cg-demo-api-key": process.env.API_KEY } : {},
  timeout: 10_000,
});

// ---------- CoinGecko helpers ----------

async function fetchMarkets(coinIds) {
  const { data } = await coingecko.get("/coins/markets", {
    params: { vs_currency: VS_CURRENCY, ids: coinIds.join(",") },
  });
  return data;
}

// Price points as [timestamp, price] pairs, or null when CoinGecko doesn't know the coin.
// Granularity is chosen by CoinGecko: 5-minute for 1 day, hourly up to 90 days, daily beyond.
function fetchPriceHistory(coinId, days) {
  return chartCache.getOrLoad(`${coinId}:${days}`, async () => {
    try {
      const { data } = await coingecko.get(`/coins/${encodeURIComponent(coinId)}/market_chart`, {
        params: { vs_currency: VS_CURRENCY, days },
      });
      return data.prices;
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  });
}

function searchCoins(query) {
  return searchCache.getOrLoad(query.toLowerCase(), async () => {
    const { data } = await coingecko.get("/search", { params: { query } });
    return data.coins.slice(0, MAX_SUGGESTIONS).map(({ id, name, symbol, thumb, market_cap_rank }) => ({
      id,
      name,
      symbol,
      thumb,
      rank: market_cap_rank,
    }));
  });
}

function byMarketCapRank(a, b) {
  const rankA = a.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
  const rankB = b.market_cap_rank ?? Number.MAX_SAFE_INTEGER;
  return rankA - rankB;
}

// Turns user input such as " Shiba Inu " into a CoinGecko-style ID ("shiba-inu").
function toCoinId(input) {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

// ---------- App setup ----------

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
Object.assign(app.locals, format);

app.use(express.static(path.join(__dirname, "public")));

// ---------- Routes ----------

app.get("/", async (req, res, next) => {
  try {
    const coins = (await fetchMarkets(TRACKED_COINS)).sort(byMarketCapRank);
    res.render("index", { coins });
  } catch (error) {
    next(error);
  }
});

app.get("/search", async (req, res, next) => {
  const query = typeof req.query.search === "string" ? req.query.search : "";
  const coinId = toCoinId(query);

  if (!coinId) {
    return res.redirect("/");
  }

  if (!COIN_ID_PATTERN.test(coinId)) {
    return renderCoinNotFound(res, query.trim());
  }

  try {
    const [markets, prices] = await Promise.all([
      fetchMarkets([coinId]),
      fetchPriceHistory(coinId, DEFAULT_CHART_DAYS),
    ]);

    const coin = markets[0];
    if (!coin || !prices) {
      return renderCoinNotFound(res, query.trim());
    }

    res.render("cryptoinfo", {
      coin,
      chart: { coinId: coin.id, days: DEFAULT_CHART_DAYS, prices },
      chartRanges: CHART_RANGES,
    });
  } catch (error) {
    next(error);
  }
});

// JSON price history for the chart's range buttons.
app.get("/api/coins/:id/market-chart", async (req, res, next) => {
  const coinId = req.params.id;
  const days = Number(req.query.days ?? DEFAULT_CHART_DAYS);

  if (!COIN_ID_PATTERN.test(coinId)) {
    return res.status(400).json({ error: "Invalid coin ID." });
  }
  if (!ALLOWED_CHART_DAYS.has(days)) {
    return res.status(400).json({ error: `days must be one of: ${[...ALLOWED_CHART_DAYS].join(", ")}.` });
  }

  try {
    const prices = await fetchPriceHistory(coinId, days);
    if (!prices) {
      return res.status(404).json({ error: "Coin not found." });
    }
    res.json({ coinId, days, prices });
  } catch (error) {
    next(error);
  }
});

// JSON endpoint behind the search box's live suggestions.
app.get("/api/search", async (req, res, next) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!query) {
    return res.json({ coins: [] });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Query must be at most ${MAX_QUERY_LENGTH} characters.` });
  }

  try {
    res.json({ coins: await searchCoins(query) });
  } catch (error) {
    next(error);
  }
});

function renderCoinNotFound(res, query) {
  res.status(404).render("error", {
    title: "Coin not found",
    message: `We couldn't find a coin matching "${query}". Try its CoinGecko ID, e.g. "bitcoin" or "shiba-inu".`,
  });
}

// ---------- 404 & error handling ----------

// API routes get JSON errors; pages get the HTML error view.
function sendError(req, res, status, title, message) {
  res.status(status);
  if (req.path.startsWith("/api/")) {
    return res.json({ error: message });
  }
  res.render("error", { title, message });
}

app.use((req, res) => {
  sendError(req, res, 404, "Page not found", "The page you're looking for doesn't exist.");
});

app.use((error, req, res, next) => {
  const isUpstreamError = axios.isAxiosError(error);
  const upstreamStatus = error.response?.status;

  // Log a summary only: axios errors carry the request config, including the API key header.
  if (isUpstreamError) {
    console.error(
      `[${req.method} ${req.originalUrl}] CoinGecko request failed:`,
      upstreamStatus ?? error.code,
      error.message,
    );
  } else {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  if (res.headersSent) {
    return next(error);
  }

  if (isUpstreamError && upstreamStatus === 429) {
    return sendError(req, res, 503, "Too many requests",
      "The price service is busy right now. Please try again in a minute.");
  }

  if (isUpstreamError) {
    return sendError(req, res, 502, "Prices unavailable",
      "We couldn't reach the price service. Please try again shortly.");
  }

  sendError(req, res, 500, "Something went wrong", "An unexpected error occurred. Please try again.");
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export default app;
