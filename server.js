const axios = require("axios");
const cheerio = require("cheerio");
const url = "https://www.etrade.wallst.com/research/Markets/Movers?index=US&type=percentGainers";
const yahooFinance = require("yahoo-finance2").default;
require("dotenv").config();

const express = require("express");
const app = express();
const port = 3000;

const { Client, Events, GatewayIntentBits } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const queryOptions = { lang: "en-US", formatted: false, region: "US" };

app.get("/", (req, res) => {
  res.send("Gainer is operational");
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);

  client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    let channel = client.channels.cache.get(process.env.CHANNEL);

    setInterval(() => {
      console.log("CHECKING STOCKS")
      checkStocks()
        .then((topGainers) => {
          let res = topGainers.map((entry) => `${entry.companyName} | +${entry.percentageChange}`).join("\n");

          if (res) {
            console.log(res);
            channel.send(res);
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }, 780000);
  });

  client.on(Events.MessageCreate, (msg) => {
    if (msg.content === "!status") {
      msg.reply("Systems Operational");
    }
  });

  client.login(process.env.TOKEN);
});

const checkedCompanies = new Map();

async function checkStocks() {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const topGainers = [];

    $("table tr").each((index, element) => {
      if (index <= 5) {
        const columns = $(element).find("td");
        if (columns.length >= 3) {
          const companyName = $(columns[1]).text();
          const percentageChange = $(columns[3])
            .text()
            .trim()
            .match(/([0-9]*\.?[0-9]+%)/gm)[0];

          if (percentageChange !== "N/A" && parseFloat(percentageChange) > 90 && !checkedCompanies.has(companyName)) {
            checkedCompanies.set(companyName, true);
            topGainers.push({ companyName, percentageChange });
          }
        }
      }
    });

    const results = await Promise.all(topGainers.map((entry) => checkOptions(entry.companyName)));
    const finalTopGainers = topGainers.filter((_, index) => results[index]);

    return finalTopGainers;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

async function checkOptions(ticker) {
  try {
    const result = await yahooFinance.options(ticker, queryOptions);
    return result.options.length !== 0;
  } catch (error) {
    console.error("Error fetching options:", error);
    throw error;
  }
}
