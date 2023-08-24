const axios = require("axios");
const cheerio = require("cheerio");
const url1 = "https://www.etrade.wallst.com/research/Markets/Movers?index=US&type=percentGainers";
const url2 = "https://www.marketbeat.com/market-data/three-day-gainers/";
const yahooFinance = require("yahoo-finance2").default;
require("dotenv").config();

const express = require("express");
const app = express();
const port = 3000;

const https = require("https");
const serverUrl = "https://gainer.onrender.com";

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
      https
        .get(serverUrl, (res) => {
          console.log(`Ping sent to ${serverUrl}. Status code: ${res.statusCode}`);
        })
        .on("error", (err) => {
          console.error(`Error sending ping to ${serverUrl}: ${err}`);
        });

      checkStocks()
        .then((topGainers) => {
          let res = topGainers.map((entry) => `${entry.companyName} | +${entry.percentageChange}`).join("\n");

          if (res) {
            console.log(`Today's Gainers \n` + res);
            channel.send(`**Today's Gainer(s)** \n` + res);
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });

      checkStocks3day()
        .then((topGainers) => {
          let res = topGainers.map((entry) => `${entry.companyName} | +${entry.percentageChange}`).join("\n");

          if (res) {
            console.log(`3 Day Gainers \n` + res);
            channel.send(`**3 Day Gainer(s)** \n` + res);
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }, 600000);
  });

  client.on(Events.MessageCreate, (msg) => {
    if (msg.content === "!status") {
      msg.reply("Systems Operational");
    }

    if (msg.content === "!today") {
      checkStocks("command")
        .then((stocks) => {
          let res = stocks.map((entry) => `${entry.companyName} | +${entry.percentageChange} | ${entry.optionable ? "OPTIONS AVAILABLE" : "NO OPTIONS"}`).join("\n");
          msg.reply(`**Today's Gainers** \n` + res);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }

    if (msg.content === "!3day") {
      checkStocks3day("command")
        .then((stocks) => {
          let res = stocks.map((entry) => `${entry.companyName} | +${entry.percentageChange} | ${entry.optionable ? "OPTIONS AVAILABLE" : "NO OPTIONS"}`).join("\n");
          msg.reply(`**3 Day Gainers** \n` + res);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  });

  client.login(process.env.TOKEN);
});

const checkedCompanies1 = new Map();
const checkedCompanies2 = new Map();

async function checkStocks(mode) {
  try {
    const response = await axios.get(url1);
    const html = response.data;
    const $ = cheerio.load(html);
    const stocks = [];
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

          stocks.push({ companyName, percentageChange });

          if (percentageChange !== "N/A" && parseFloat(percentageChange) > 90 && !checkedCompanies1.has(companyName)) {
            checkedCompanies1.set(companyName, true);
            topGainers.push({ companyName, percentageChange });
          }
        }
      }
    });

    if (mode === "command") {
      const res = await Promise.all(stocks.map((entry) => checkOptions(entry.companyName)));

      for (let i = 0; i < 5; i++) {
        stocks[i]["optionable"] = res[i];
      }

      return stocks;
    }

    const results = await Promise.all(topGainers.map((entry) => checkOptions(entry.companyName)));
    const finalTopGainers = topGainers.filter((_, index) => results[index]);

    return finalTopGainers;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

async function checkStocks3day(mode) {
  try {
    const response = await axios.get(url2);
    const html = response.data;
    const $ = cheerio.load(html);
    const stocks = [];
    const topGainers = [];

    $("table tr").each((index, element) => {
      if (index <= 5) {
        const columns = $(element).find("td");
        if (columns.length >= 3) {
          const dataClean = $(columns[0]).attr("data-clean");
          const percentageChange = $(columns[1])
            .text()
            .match(/([0-9]*\.?[0-9]+%)/gm)[0];
          const [companyName, name] = dataClean.split("|");

          stocks.push({ companyName, percentageChange });

          if (percentageChange !== "N/A" && parseFloat(percentageChange) > 150 && !checkedCompanies2.has(companyName)) {
            checkedCompanies2.set(companyName, true);
            topGainers.push({ companyName, percentageChange });
          }
        }
      }
    });

    if (mode === "command") {
      const res = await Promise.all(stocks.map((entry) => checkOptions(entry.companyName)));

      for (let i = 0; i < 5; i++) {
        stocks[i]["optionable"] = res[i];
      }

      return stocks;
    }

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