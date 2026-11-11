# Crypto Prices

A server-rendered web app that shows live prices for a curated list of 20 cryptocurrencies and lets you look up any coin's market data and recent price chart. Data comes from the [CoinGecko API](https://www.coingecko.com/en/api).

**Live demo:** https://cryptoprices-sigma.vercel.app

## Tech stack

- **Node.js** + **Express**: routing, error handling
- **EJS**: server-side templates
- **Axios**: HTTP client for CoinGecko (shared instance with API key header and timeout)
- **Chart.js**: price chart on the coin detail page
- **CoinGecko API**: market data
- **Vercel**: hosting

## Running locally

Requires Node.js 18.11+.

```bash
git clone https://github.com/DProC-debug/cryptoprices.git
cd cryptoprices
npm install
cp .env.example .env   # then set API_KEY to your free CoinGecko demo key
npm run dev
```

The app runs at http://localhost:3000 (or the `PORT` set in `.env`). Get a free demo API key from the [CoinGecko developer dashboard](https://www.coingecko.com/en/developers/dashboard).

## Routes

| Method | Path                        | Description                                                        |
| ------ | --------------------------- | ------------------------------------------------------------------ |
| GET    | `/`                         | Prices for the tracked coins, sorted by market cap rank            |
| GET    | `/search?search=<coin-id>`  | Market data and price chart for one coin (e.g. `bitcoin`)          |

Unknown coins return a 404 page. If CoinGecko is unreachable the app returns 502 (or 503 when rate-limited) with a friendly error page.
