import express from "express";
import bodyParser from "body-parser";
import axios from "axios";

const app = express();
const port = 3000;
const API_URL = "https://api.coingecko.com/api/v3/";
const yourAPIKey = "CG-PekSWHNqhgaGHTHo9Cghy9TY";

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.get("/",  async (req, res) => {

  try {
    const response = await axios.get(`${API_URL}coins/markets`, {
      auth: {
        key: "x-cg-demo-api-key",
        value: yourAPIKey,
      },
      params: {
        vs_currency: "usd",
        ids: "bitcoin, ethereum, solana, layerzero, bonk, notcoin, catizen, popcat, zetachain, neiro, aptos, sui, pepe, bittensor, tether, arbitrum, optimism, aleo, celestia, starknet",
    },
  });
    const result = response.data;
    const bit_coin = (result)[0];
    const eth = (result)[1];
    const sol = (result)[2];
    const zro = (result)[3];
    const bonk = (result)[4];
    const not = (result)[5];
    const cati = (result)[6];
    const popcat = (result)[7];
    const zeta = (result)[8];
    const neiro = (result)[9];
    const aptos = (result)[10];
    const sui = (result)[11];
    const pepe = (result)[12];
    const bittensor = (result)[13];
    const tether = (result)[14];
    const arbitrum = (result)[15];
    const optimism = (result)[16];
    const aleo = (result)[17];
    const celestia = (result)[18];
    const starknet = (result)[19];
    res.render("index.ejs", { 
      bitcoin: bit_coin,
      ethereum: eth,
      solana: sol,
      zero: zro,
      bonkinu: bonk,
      notcoin: not,
      catizen: cati,
      pop: popcat,
      zetachain: zeta,
      neirocoin: neiro,
      aptos: aptos,
      sui: sui,
      pepe: pepe,
      bittensor: bittensor,
      tether: tether,
      arbitrum: arbitrum,
      optimism: optimism,
      aleo: aleo,
      celestia: celestia,
      starknet: starknet,
    });
  } catch (error) {
    res.status(404).send(error.message);
  }

});

app.get("/search", async (req, res) => {
const searchquery = req.query.search.toLowerCase();

const cryptoId = searchquery;  // You can change this to other cryptocurrencies like 'ethereum'
const vsCurrency = 'usd';    // You can change this to other fiat currencies like 'eur', 'jpy'
const days = '1';           // Last 30 days of data


if (!searchquery) {
  res.json(404, "Input Value")
}

  try {
    const response = await axios.get(`${API_URL}coins/markets?vs_currency=usd&ids=${searchquery}`, {
      auth: {
        key: "x-cg-demo-api-key",
        value: yourAPIKey,
      },
  });


  async function getCryptoPrice(cryptoId, vsCurrency, days) {
    const url = `https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart`;
    const params = {
        vs_currency: vsCurrency,
        days: days,
        interval: 'daily',
    };
  
    try {
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching data from CoinGecko:', error);
        throw error;
    }
  }


    // Fetch data from CoinGecko
    const data = await getCryptoPrice(cryptoId, vsCurrency, days);

    // Extract prices and dates from the response
    const prices = data.prices.map(price => price[1]);
    const dates = data.prices.map(price => {
        const date = new Date(price[0]);
        return date.toISOString().split('T')[0]; // Format date as 'YYYY-MM-DD'
    });


  const result = (response.data)[0];
  res.render("cryptoinfo.ejs", {
    searchresult: result,
    numberWithCommas: function (x) {
      return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    dates: dates,
    prices: prices,
    cryptoId: cryptoId,
    vsCurrency: vsCurrency,
  });
} catch (error) {
  res.status(404).send(error.message);
}
});

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });
