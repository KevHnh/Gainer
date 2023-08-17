const axios = require("axios");
const cheerio = require("cheerio");
const url = "https://www.etrade.wallst.com/research/Markets/Movers?index=US&type=percentGainers";
const yahooFinance = require("yahoo-finance2").default;
require("dotenv").config();

const { Client, Events, GatewayIntentBits } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
const queryOptions = { lang: "en-US", formatted: false, region: "US" };

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  let channel = client.channels.cache.get(process.env.CHANNEL)

  setInterval(() => {
    checkStocks()
      .then((topGainers) => {
        topGainers.map((entry) => console.log(`${entry['companyName']} | +${entry['percentageChange']} | OPTIONS AVAILABLE`));
        topGainers.map((entry) => channel.send(`${entry['companyName']} | +${entry['percentageChange']} | OPTIONS AVAILABLE`))
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, 10000);
});

client.on(Events.MessageCreate, (msg) => {
  if (msg.content === "hello") {
    msg.channel.send("hey!");
  }
});

client.login(process.env.TOKEN);

async function checkStocks() {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const topGainers = [];
    const checkNeeded = [];

    $("table tr").each((index, element) => {
      if (index <= 5) {
        const columns = $(element).find("td");
        if (columns.length >= 3) {
          const companyName = $(columns[1]).text();
          const percentageChange = $(columns[3])
            .text()
            .trim()
            .match(/([0-9]*\.?[0-9]+%)/gm)[0];

          if (percentageChange !== "N/A" && parseFloat(percentageChange) > 20) {
            checkNeeded.push({ companyName, percentageChange });
          }
        }
      }
    });

    const results = await Promise.all(checkNeeded.map((entry) => checkOptions(entry.companyName)));

    results.forEach((result, index) => {
      if (result) {
        topGainers.push({
          companyName: checkNeeded[index].companyName,
          percentageChange: checkNeeded[index].percentageChange,
        });
      }
    });

    return topGainers;
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
