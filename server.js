const axios = require("axios");
const cheerio = require("cheerio");
const url =
  "https://www.etrade.wallst.com/research/Markets/Movers?index=US&type=percentGainers";

const qrcode = require("qrcode-terminal");

const { Client, LocalAuth } = require("whatsapp-web.js");
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");

  client.getChats().then((chats) => {
    const GainerGroup = chats.find((chat) => chat.name === "Gainer");

    setInterval(() => {
      checkStocks()
        .then((topGainers) => {
          client.sendMessage(GainerGroup.id._serialized, topGainers);
          topGainers.map((entry) => console.log(`${entry["companyName"]} is up ${entry["percentageChange"]}`))
          topGainers.map((entry) => client.sendMessage(GainerGroup.id._serialized, `${entry["companyName"]} is up ${entry["percentageChange"]}`))
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }, 20000);
  });
});

client.on("message", (message) => {
  console.log(message.body);

  if (message.body === "!ping") {
    message.reply("pong");
  }
});

client.initialize();

function checkStocks() {
  return axios
    .get(url)
    .then((response) => {
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

            if (
              percentageChange !== "N/A" &&
              parseFloat(percentageChange) > 20
            ) {
              topGainers.push({ companyName, percentageChange });
            }
          }
        }
      });

      return topGainers;
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      return [];
    });
}
