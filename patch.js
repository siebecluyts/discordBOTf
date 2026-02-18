const fs = require('fs');
const path = 'bot.cjs';
let src = fs.readFileSync(path,'utf8');
const startMarker = '// ================== COMMAND HANDLER ==================';
const endMarker = '// ================== MOD ACTIONS ==================';
const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker);
if (start === -1 || end === -1) {
  console.error('markers not found', start, end);
  process.exit(1);
}
const before = src.slice(0, start);
const after = src.slice(end);
const newBlock = `// ================== COMMAND HANDLER ==================
// Unified auto-mod + command handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // auto moderation
  const content = message.content.toLowerCase();
  const cleaned = content.replace(/[^a-z]/g, "");
  const foundWord = bannedWords.find(word => cleaned.includes(word));
  if (foundWord) {
    try {
      await message.delete().catch(() => {});
      await message.member.timeout(10 * 60 * 1000, "Used banned word");
      message.channel.send(\
        \`🔇 ${message.author}, je bent 10 minuten gemute voor ongepast taalgebruik.\`
      ).then(msg => { setTimeout(() => msg.delete().catch(() => {}), 5000); });
      const logChannel = message.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send(\
          \`⚠️ **AUTO-MOD TRIGGERED**\\n\` +
          \`User: ${message.author.tag}\\n\` +
          \`ID: ${message.author.id}\\n\` +
          \`Word: ${foundWord}\\n\` +
          \`Channel: ${message.channel.name}\\n\` +
          \`Time: ${new Date().toLocaleString()}\`
        );
      }
    } catch (err) {
      console.error("AutoMod error:", err);
    }
    return;
  }

  // command parsing
  const parts = message.content.trim().split(/\\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  const isMod = isModerator(message.member);

  if (cmd === "!say") {
    if (!isMod) return;
    let text = args.join(" ");
    if (!text) return message.reply("❌ Geef tekst mee.");
    text = text.replace(/<br\\s*\\/?>>/gi, "\\n");
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
    return message.channel.send(\
      \`✅ ${member.user.tag} kreeg de role **${role.name}**\`
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
    return message.channel.send(\
      \`🗑 ${member.user.tag} verloor de role **${role.name}**\`
    );
  }

  // ================== MOD ACTIONS ==================
});
`;
fs.writeFileSync(path, before + newBlock + after, 'utf8');
console.log('rewrite complete');
