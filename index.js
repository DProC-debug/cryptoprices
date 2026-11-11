import "dotenv/config";
import express from "express";
import axios from "axios";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const VS_CURRENCY = "usd";
const CHART_DAYS = 1;

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
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 500;

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

// Resolves to null when CoinGecko doesn't know the coin.
async function fetchPriceHistory(coinId) {
  try {
    const { data } = await coingecko.get(`/coins/${encodeURIComponent(coinId)}/market_chart`, {
      params: { vs_currency: VS_CURRENCY, days: CHART_DAYS, interval: "daily" },
    });
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

// Small in-memory cache so typing in the search box doesn't burn through the API rate limit.
const searchCache = new Map();

async function searchCoins(query) {
  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.coins;

  const { data } = await coingecko.get("/search", { params: { query } });
  const coins = data.coins.slice(0, MAX_SUGGESTIONS).map(({ id, name, symbol, thumb, market_cap_rank }) => ({
    id,
    name,
    symbol,
    thumb,
    rank: market_cap_rank,
  }));

  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    searchCache.delete(searchCache.keys().next().value);
  }
  searchCache.set(cacheKey, { coins, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  return coins;
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

function formatNumber(value) {
  return value == null ? "N/A" : Number(value).toLocaleString("en-US");
}

// ---------- App setup ----------

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.formatNumber = formatNumber;

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
    const [markets, history] = await Promise.all([
      fetchMarkets([coinId]),
      fetchPriceHistory(coinId),
    ]);

    const coin = markets[0];
    if (!coin || !history) {
      return renderCoinNotFound(res, query.trim());
    }

    const dates = history.prices.map(([timestamp]) => new Date(timestamp).toISOString().split("T")[0]);
    const prices = history.prices.map(([, price]) => price);

    res.render("cryptoinfo", {
      coin,
      dates,
      prices,
      vsCurrency: VS_CURRENCY,
    });
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
