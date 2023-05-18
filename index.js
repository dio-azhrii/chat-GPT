/*
Do not forget to create a .env file with the following two variables set:

CHROME_PATH=
OPENAI_APIKEY=

See documentation for help
*/
import { Configuration, OpenAIApi } from "openai";
import whatsappweb from "whatsapp-web.js";
import fs from 'fs';

const { Client, LegacySessionAuth } = whatsappweb;
import qrcode from "qrcode-terminal";
import * as dotenv from "dotenv";

dotenv.config();

// Path where the session data will be stored
const SESSION_FILE_PATH = './chatbot.json';

// Load the session data if it has been previously saved
let sessionData;
if(fs.existsSync(SESSION_FILE_PATH)) return sessionData = require(SESSION_FILE_PATH);

// Create whatsapp client instance
const whatsapp = new Client({
  puppeteer: {
    executablePath: process.env.CHROME_PATH,
  },
  authStrategy: new LegacySessionAuth({
    session: sessionData
}),
});

console.log(process.env.CHROME_PATH);

// Initialize conversation storage
const conversations = {};

whatsapp.initialize();

// This will output a QR code to the console, scan this with the WhatsApp app on the account that will be dedicated to chatGPT
whatsapp.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

whatsapp.on("authenticated", () => {
  console.log("Authentication complete");
});
whatsapp.on("ready", () => {
  console.log("Ready to accept messages");
});

async function main() {

  whatsapp.on("message", (message) => {
    (async () => {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_APIKEY,
      });
      const openai = new OpenAIApi(configuration);
    
      const configOpenAI = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message.body }],
      });
      console.log(`From: ${message._data.id.remote} (${message._data.notifyName})`);

      console.log(`Message: ${message.body}`);

      // If added to a chatgroup, only respond if tagged
      const chat = await message.getChat();

      if (chat.isGroup && !message.mentionedIds.includes(whatsapp.info.wid._serialized)
      )
        return;

      // Do we already have a conversation for this sender, or is the user resetting this conversation?
      if (conversations[message._data.id.remote] === undefined ||message.body === "reset") {
        console.log(`Creating new conversation for ${message._data.id.remote}`);
        if (message.body === "reset") {
          message.reply("Conversation reset");
          return;
        }
        conversations[message._data.id.remote] = configOpenAI;
      }

      const response = await conversations[message._data.id.remote].sendMessage(message.body);

      console.log(`Response: ${response.data.choices[0].message.content}`);

      message.reply(response.data.choices[0].message.content);
    })();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const sleep = (waitTimeInMs) =>
  new Promise((resolve) => setTimeout(resolve, waitTimeInMs));
