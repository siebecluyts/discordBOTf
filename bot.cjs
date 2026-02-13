// ================== START ==================
console.log("🚀 bot.cjs gestart");

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

// ================== CONFIG ==================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = "1463876243362680976";
const NEWS_ROLE_ID = "1463876504122560616";
const ARTICLES_URL = "https://siebecluyts.github.io/gdn/articles.json";
const CHECK_INTERVAL = 5 * 60 * 1000;
const STATE_FILE = "./lastArticle.json";

// ================== CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ================== STATE ==================
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
  if (!res.ok) throw new Error("Failed to fetch articles.json");
  return await res.json();
}

// ================== POST NEWS ==================
async function postNews(channel) {
  try {
    const articles = await fetchArticles();
    if (!Array.isArray(articles) || articles.length === 0) return;

    articles.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

    const newest = articles[0];
    const lastId = getLastArticleId();
    if (String(newest.id) === String(lastId)) return;

    const embed = new EmbedBuilder()
      .setTitle(newest.title)
      .setURL(`https://siebecluyts.github.io/gdn/article?id=${newest.id}`)
      .setDescription(newest.content || "New article published!")
      .setColor(0x008793)
      .setImage(`https://siebecluyts.github.io/gdn/assets/articlethumbnail/${newest.id}.png`)
      .setFooter({ text: "GDN • New article" })
      .setTimestamp(new Date(newest.date || Date.now()));

    await channel.send({
      content: `<@&${NEWS_ROLE_ID}> 📰 **New GDN article!**`,
      embeds: [embed],
      allowedMentions: { roles: [NEWS_ROLE_ID] },
    });

    saveLastArticleId(newest.id);
    console.log("📰 Artikel gepost:", newest.title);

  } catch (err) {
    console.error("News error:", err.message);
  }
}

// ================== MOD CHECK ==================
function isModerator(member) {
  if (!member) return false;
  if (member.user.bot) return false;
  if (member.id === member.guild.ownerId) return true;
  return member.permissions.has("Administrator") ||
         member.roles.cache.some(r => r.name.toLowerCase().includes("mod"));
}

// ================== BAD WORD FILTER ==================
const badWords = ['fuck','shit','ass','penis','vagina','nigga','nigger','tits','bitch'];

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const lower = message.content.toLowerCase();

  if (badWords.some(word => lower.includes(word))) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(
      `${message.author}, That word is not allowed!`
    );
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }
});

// ================== COMMAND HANDLER ==================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  const isMod = isModerator(message.member);

  // ================== MOD ONLY ==================

  if (cmd === "!say") {
    if (!isMod) return;

    let text = args.join(" ");
    if (!text) return message.reply("❌ Geef tekst mee.");

    text = text.replace(/<br\s*\/?>/gi, "\n");

    await message.delete().catch(() => {});
    return message.channel.send(text);
  }

  if (cmd === "!news") {
    if (!isMod) return;

    const channel = message.guild.channels.cache.get(CHANNEL_ID);
    if (!channel) return message.reply("❌ News kanaal niet gevonden.");
    return postNews(channel);
  }

  if (cmd === "!giverole") {
    if (!isMod) return;

    const member = message.mentions.members.first();
    if (!member) return message.reply("❌ Mention een user.");

    const roleName = args.slice(1).join(" ");
    if (!roleName) return message.reply("❌ Geef een role naam.");

    const role = message.guild.roles.cache.find(
      r => r.name.toLowerCase() === roleName.toLowerCase()
    );

    if (!role) return message.reply("❌ Role niet gevonden.");

    await member.roles.add(role).catch(() => {
      return message.reply("❌ Kan role niet geven (check role hierarchy).");
    });

    return message.channel.send(
      `✅ ${member.user.tag} kreeg de role **${role.name}**`
    );
  }

  if (cmd === "!removerole") {
    if (!isMod) return;

    const member = message.mentions.members.first();
    if (!member) return message.reply("❌ Mention een user.");

    const roleName = args.slice(1).join(" ");
    if (!roleName) return message.reply("❌ Geef een role naam.");

    const role = message.guild.roles.cache.find(
      r => r.name.toLowerCase() === roleName.toLowerCase()
    );

    if (!role) return message.reply("❌ Role niet gevonden.");

    await member.roles.remove(role).catch(() => {
      return message.reply("❌ Kan role niet verwijderen.");
    });

    return message.channel.send(
      `🗑 ${member.user.tag} verloor de role **${role.name}**`
    );
  }

  // ================== MOD ACTIONS ==================

  if (!isMod) return;

  if (cmd === "!kick") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("No member mentioned!");
    await member.kick().catch(() => message.reply("❌ Kick mislukt."));
    message.channel.send(`${member.user.tag} is kicked!`);
  }

  if (cmd === "!ban") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("No member mentioned!");
    await member.ban().catch(() => message.reply("❌ Ban mislukt."));
    message.channel.send(`${member.user.tag} is banned!`);
  }

  if (cmd === "!mute") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("No member mentioned!");
    await member.timeout(10 * 60 * 1000).catch(() =>
      message.reply("❌ Mute mislukt.")
    );
    message.channel.send(`${member.user.tag} is muted for 10 minutes!`);
  }
});

// ================== READY ==================
client.once("ready", async () => {
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
