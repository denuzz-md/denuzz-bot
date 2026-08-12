const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

let userSessions = {};
// WORKTYPE: 'public' (Anyone can use) or 'private' (Only owner can use)
const WORKTYPE = "public"; 
const OWNER_NUMBER = "94759987949";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const sock = makeWASocket({ 
    logger: pino({ level: "silent" }), 
    auth: state, 
    printQRInTerminal: false 
  });

  sock.ev.on("creds.update", saveCreds);
  
  sock.ev.on("connection.update", (update) => {
    if (update.connection === "open") {
      console.log("\n✅ DENUZZ PUBLIC BOT IS LIVE & READY!");
    } else if (update.connection === "close") {
      startBot();
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg.message) return;
      const remoteJid = msg.key.remoteJid;
      const sender = msg.key.participant || remoteJid;
      const isOwner = sender.includes(OWNER_NUMBER);

      // If worktype is private, restrict non-owners
      if (WORKTYPE === "private" && !isOwner) return;
      
      const messageType = Object.keys(msg.message)[0];
      let text = messageType === "conversation" ? msg.message.conversation : 
                 messageType === "extendedTextMessage" ? msg.message.extendedTextMessage.text : "";

      if (!text) return;
      text = text.trim();

      // Handle Quality Selection for xvid
      if (userSessions[remoteJid] && userSessions[remoteJid].step === "quality") {
        let choice = text;
        let url = userSessions[remoteJid].url;
        
        if (['1', '2', '3'].includes(choice)) {
          await sock.sendMessage(remoteJid, { react: { text: "⚡", key: msg.key } }).catch(() => {});
          let fmt = choice === '1' ? "best" : choice === '2' ? "best[height<=720]" : "best[height<=480]";
          await sock.sendMessage(remoteJid, { text: "⏳ *Downloading video... Please wait!*" }, { quoted: msg });
          
          let out = `vid_${Date.now()}.mp4`;
          let ytCmd = `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -f "${fmt}" -o "${out}" "${url}"`;
          
          exec(ytCmd, async (err) => {
            delete userSessions[remoteJid];
            if (err) {
              await sock.sendMessage(remoteJid, { text: "❌ *Download failed! Check if the link is correct.*" }, { quoted: msg });
              return;
            }
            if (fs.existsSync(out)) {
              await sock.sendMessage(remoteJid, { video: { url: out }, caption: "✅ *Downloaded & Saved Successfully!*" }, { quoted: msg });
              await sock.sendMessage(remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
              setTimeout(() => { try { fs.unlinkSync(out); } catch(e){} }, 5000);
            } else {
              await sock.sendMessage(remoteJid, { text: "❌ *File error!*" }, { quoted: msg });
            }
          });
        } else {
          await sock.sendMessage(remoteJid, { text: "⚠️ *Invalid choice! Reply with 1, 2, or 3.*" }, { quoted: msg });
        }
        return;
      }

      // --- MENU COMMAND ---
      if (text.toLowerCase() === ".menu") {
        await sock.sendMessage(remoteJid, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        let menu = `╭═══━⊰ 🥷 *DENUZZ PUBLIC BOT* ⊱━═══╮\n\n`;
        menu += `👤 Owner: DenuZZ\n`;
        menu += `🌐 Mode: Public (Everyone can use)\n\n`;
        
        menu += `📂 *CATEGORY 1: MAIN*\n`;
        menu += `1. .menu\n2. .ping\n3. .owner\n\n`;

        menu += `📥 *CATEGORY 2: DOWNLOADS*\n`;
        menu += `4. .tiktok <link>\n5. .xvid <link>\n\n`;
        
        menu += `╰═══━⊰ *DENUZZ BOT PRO v1.0* ⊱━═══╯`;
        
        await sock.sendMessage(remoteJid, { text: menu }, { quoted: msg });
        await sock.sendMessage(remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      }

      else if (text.toLowerCase() === ".ping") {
        await sock.sendMessage(remoteJid, { react: { text: "⚡", key: msg.key } }).catch(() => {});
        await sock.sendMessage(remoteJid, { text: "🚀 *Bot Speed: Ultra Fast (Public Mode Active)*" }, { quoted: msg });
        await sock.sendMessage(remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      }

      // --- TIKTOK DOWNLOAD COMMAND ---
      else if (text.startsWith(".tiktok ")) {
        let url = text.split(" ")[1];
        if (!url) {
          await sock.sendMessage(remoteJid, { text: "⚠️ *Please provide a TikTok link!*" }, { quoted: msg });
          return;
        }
        await sock.sendMessage(remoteJid, { react: { text: "⚡", key: msg.key } }).catch(() => {});
        await sock.sendMessage(remoteJid, { text: "⏳ *Fetching TikTok video...*" }, { quoted: msg });

        try {
          let response = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);
          let res = response.data;
          
          if (res && res.code === 0 && res.data) {
            let videoUrl = res.data.play;
            let author = res.data.author ? res.data.author.nickname : "TikTok User";
            
            if (videoUrl) {
              await sock.sendMessage(remoteJid, { 
                video: { url: videoUrl }, 
                caption: `✅ *TikTok Video Downloaded!*\n👤 *Creator:* ${author}` 
              }, { quoted: msg });
              
              await sock.sendMessage(remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
            } else {
              await sock.sendMessage(remoteJid, { text: "❌ *Video stream URL not found.*" }, { quoted: msg });
            }
          } else {
            await sock.sendMessage(remoteJid, { text: "❌ *Invalid TikTok link or restricted video!*" }, { quoted: msg });
          }
        } catch (e) {
          await sock.sendMessage(remoteJid, { text: "❌ *Network error connecting to API.*" }, { quoted: msg });
        }
      }

      else if (text.startsWith(".xvid ")) {
        let url = text.split(" ")[1];
        if (!url) {
          await sock.sendMessage(remoteJid, { text: "⚠️ *Please provide a video link!*" }, { quoted: msg });
          return;
        }
        await sock.sendMessage(remoteJid, { react: { text: "⚡", key: msg.key } }).catch(() => {});
        userSessions[remoteJid] = { url, step: "quality" };
        let qMsg = `🔥 *ADULT VIDEO DOWNLOADER* 🔥\n\nSelect Quality:\n1️⃣ Best Quality (HD)\n2️⃣ Medium Quality (720p)\n3️⃣ Low Quality (480p)\n\n_Reply with 1, 2, or 3._`;
        await sock.sendMessage(remoteJid, { text: qMsg }, { quoted: msg });
        await sock.sendMessage(remoteJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
      }
    } catch (e) {
      console.log("Error caught:", e);
    }
  });
}

startBot();
