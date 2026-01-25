// bot.cjs
console.log("🚀 bot.cjs gestart");

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const fs = require("fs");

require('dotenv').config();
// ================== CONFIG ==================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // je bot token
const CLIENT_ID = "1450850667341025463"; // bot client ID
const GUILD_ID = "1450853381680660783"; // server ID voor testen
const CHANNEL_ID = "1463876243362680976"; // kanaal waar nieuws gepost wordt
const ARTICLES_URL = "https://siebecluyts.github.io/gdn/articles.json";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minuten
const STATE_FILE = "./lastArticle.json";

// ================== CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel]
});

// ================== STATE HELPERS ==================
function getLastArticleId() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE)).lastId ?? null;
  } catch {
    return null;
  }
}

function saveLastArticleId(id) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastId: id }, null, 2));
}

// ================== FETCH ARTICLES ==================
async function fetchArticles() {
const res = await fetch(ARTICLES_URL);
  if (!res.ok) throw new Error('Failed to fetch articles.json');
  return await res.json();
}

// ================== CHECK NEW ARTICLE ==================
async function postNews(channel) {
  try {
    const articles = await fetchArticles();
    if (!Array.isArray(articles) || articles.length === 0) return;

    // nieuwste eerst
    articles.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

    const newest = articles[0];
    const lastId = getLastArticleId();
    if (String(newest.id) === String(lastId)) return;

    const embed = new EmbedBuilder()
      .setTitle(newest.title)
      .setURL(`https://siebecluyts.github.io/gdn/article?id=${newest.id}`)
      .setDescription(newest.content || 'New article published!')
      .setAuthor({ name: newest.author || 'GDN' })
      .setColor(0x008793)
      .setImage(`https://siebecluyts.github.io/gdn/assets/articlethumbnail/${newest.id}.png`)
      .setFooter({ text: 'GDN • New article' })
      .setTimestamp(new Date(newest.date || Date.now()));

    await channel.send({ embeds: [embed] });
    saveLastArticleId(newest.id);
    console.log("📰 Artikel gepost:", newest.title);
  } catch (err) {
    console.error("News error:", err.message);
  }
}

// ================== HELPERS ==================
function isModerator(member) {
  if (!member) return false;
  if (member.user.bot) return true;
  if (member.id === member.guild.ownerId) return true;
  return member.roles.cache.some(r => r.name.toLowerCase().includes('mod'));
}

// ================== BAD WORD FILTER ==================
const badWords = ['fuck','shit','ass', 'penis', 'vagina', 'nigga', 'nigger', 'tits', 'bitch'];

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // check bad words
  if (badWords.some(w => message.content.toLowerCase().includes(w))) {
    await message.delete();
    message.channel.send(`${message.author}, That word is not allowed!`).then(msg => setTimeout(() => msg.delete(), 5000));
  }

  // ------------------------- MOD COMMANDS -------------------------
  const args = message.content.split(' ');
  const cmd = args.shift().toLowerCase();

  if (!isModerator(message.member)) return;

  // kick
  if (cmd === '!kick') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('No member mentioned!');
    await member.kick();
    message.channel.send(`${member.user.tag} is kicked!`);
  }

  // ban
  if (cmd === '!ban') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('No member mentioned!');
    await member.ban();
    message.channel.send(`${member.user.tag} is banned!`);
  }

  // mute (10 min)
  if (cmd === '!mute') {
    const member = message.mentions.members.first();
    if (!member) return message.reply('No member mentioned!');
    await member.timeout(10*60*1000);
    message.channel.send(`${member.user.tag} is muted for 10 minutes!`);
  }
});

// ================== USER COMMANDS ==================
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // !help
  if (cmd === '!help') {
    const helpText = `
📌 **GDN Discord Bot – Commands**

👤 **Voor iedereen**
• \`!help\` → toont dit bericht
• \`!say <tekst>\` → laat de bot iets zeggen
• \`!news\` → post het nieuwste GDN artikel

🛡 **Moderators**
• \`!kick @user\`
• \`!ban @user\`
• \`!mute @user\` (10 minuten)

🚫 Scheldwoorden worden automatisch verwijderd.
`;
    return message.channel.send(helpText);
  }

// !say
if (cmd === '!say') {
  let text = args.join(' ');
  if (!text) return message.reply('❌ Geef tekst mee.');

  // <br> → nieuwe lijn
  text = text.replace(/<br\s*\/?>/gi, '\n');

  await message.delete();
  return message.channel.send(text);
}


  // !news
  if (cmd === '!news') {
    const channel = message.guild.channels.cache.get(CHANNEL_ID);
    if (!channel) return message.reply('❌ News kanaal niet gevonden.');
    return postNews(channel);
  }
});

// ================== READY ==================
client.once('ready', async () => {
  console.log(`🤖 Online als ${client.user.tag}`);
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (channel) postNews(channel);
  setInterval(() => {
    if (channel) postNews(channel);
  }, CHECK_INTERVAL);
});

// ================== LOGIN ==================
client.login(DISCORD_TOKEN);

// ================== KEEP RENDER ALIVE ==================
const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running");
}).listen(PORT, () => {
  console.log("🌐 HTTP server actief op poort", PORT);
});




