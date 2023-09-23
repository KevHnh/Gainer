const axios = require("axios");
const cheerio = require("cheerio");
const url1 = "https://finviz.com/screener.ashx?v=152&s=ta_topgainers&f=exch_nasd&o=-change&ar=180&c=0,1,42,80,66";
const url2 = "https://finviz.com/screener.ashx?v=152&s=ta_topgainers&f=exch_nasd&o=-perf1w&ar=180&c=0,1,42,80,66"
require("dotenv").config();

const express = require("express");
const app = express();
const port = 3000;

const https = require("https");
const serverUrl = "https://gainer.onrender.com";


const { Client, Events, GatewayIntentBits } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

app.get("/", (req, res) => {
  res.send("Gainer Beta is operational");
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

      checkStocksDay()
        .then((topGainers) => {
          let res = topGainers.map((entry) => `${entry.ticker} | +${entry.dayGain}%`).join("\n");

          if (res) {
            console.log(`Today's Gainers \n` + res);
            channel.send(`**Today's Gainer(s)** \n` + res);
          }
        })
        .catch((error) => {
          console.error("Error:", error);
        });

        checkStocksWeek()
        .then((topGainers) => {
          let res = topGainers.map((entry) => `${entry.ticker} | +${entry.weekGain}%`).join("\n");

          if (res) {
            console.log(`Week's Gainers \n` + res);
            channel.send(`**Week's Gainer(s)** \n` + res);
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
      checkStocksDay("command")
        .then((stocks) => {
          let res = stocks.map((entry) => `${entry.ticker} | +${entry.dayGain}% | ${entry.optionable === "Yes" ? "🟢" : "🔴"}`).join("\n");
          msg.reply(`**Today's Gainers** \n` + res);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }

    if (msg.content === "!week") {
      checkStocksWeek("command")
        .then((stocks) => {
          let res = stocks.map((entry) => `${entry.ticker} | +${entry.weekGain}% | ${entry.optionable === "Yes" ? "🟢" : "🔴"}`).join("\n");
          msg.reply(`**Week's Gainers** \n` + res);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  });

  client.login(process.env.TOKEN);
});

let checkedCompanies1 = new Map()
let checkedCompanies2 = new Map()

async function checkStocksDay(mode) {
  try {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

    const config = {
      headers: {
        'User-Agent': userAgent,
      },
    };

    const response = await axios.get(url1, config);
    const html = response.data;
    const $ = cheerio.load(html);
    const parentRow = $("tr#screener-table");
    let count = 0;
    const stocks = [];
    const alertable = []

    parentRow.find("tr[valign='top']").each((index, element) => {
      if (count < 5) {
        const childRow = $(element);
        const ticker = childRow.find("td:nth-child(2)").text();
        const optionable = childRow.find("td:nth-child(4)").text();
        const dayGain = parseFloat(childRow.find("td:nth-child(5)").text().match(/([0-9]*\.?[0-9]+)/gm));

        count++

        stocks.push({ ticker, dayGain, optionable })

        if (parseFloat(dayGain) >= 90 && !checkedCompanies1.has(ticker) && optionable === "Yes") {
          checkedCompanies1.set(ticker, true);
          alertable.push({ ticker, dayGain, optionable });
        }
      }
    });

    if (mode === "command") {
      return stocks
    }

    return alertable
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}

async function checkStocksWeek(mode) {
  try {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36';

    const config = {
      headers: {
        'User-Agent': userAgent,
      },
    };

    const response = await axios.get(url2, config);
    const html = response.data;
    const $ = cheerio.load(html);
    const parentRow = $("tr#screener-table");
    let count = 0;
    const stocks = [];
    const alertable = []

    parentRow.find("tr[valign='top']").each((index, element) => {
      if (count < 5) {
        const childRow = $(element);
        const ticker = childRow.find("td:nth-child(2)").text();
        const weekGain = parseFloat(childRow.find("td:nth-child(3)").text().match(/([0-9]*\.?[0-9]+)/gm));
        const optionable = childRow.find("td:nth-child(4)").text();

        count++;

        stocks.push({ ticker, weekGain, optionable })

        if (parseFloat(weekGain) >= 130 && !checkedCompanies2.has(ticker) && optionable === "Yes") {
          checkedCompanies2.set(ticker, true);
          alertable.push({ ticker, weekGain, optionable });
        }
      }
    });

    if (mode === "command") {
      return stocks
    }

    return alertable
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
}