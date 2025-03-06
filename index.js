require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN || "7375007973:AAFczxhpL2dZSC6kz0EBKKRRKqMvoNZklyg";
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Cek server di route utama /
app.get('/', (req, res) => {
    res.json({ status: "Server is running", message: "Bot Telegram is active!" });
});

// Jalankan server di port 3000
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

// Fungsi download media dengan retry
async function downloadAndUpload(ctx, mediaUrls, caption = "", retries = 3) {
    caption = caption.substring(0, 1024);
    let mediaFiles = [];

    for (let i = 0; i < mediaUrls.length; i++) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Downloading (${attempt}/${retries}):`, mediaUrls[i]);
                const response = await axios({
                    url: mediaUrls[i],
                    method: 'GET',
                    responseType: 'stream'
                });

                const fileExt = response.headers['content-type'].split('/')[1] || "mp4";
                const filePath = path.join(__dirname, `media_${i}.${fileExt}`);

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                mediaFiles.push(filePath);
                break; // Jika berhasil, keluar dari retry loop
            } catch (error) {
                console.error(`Download attempt ${attempt} failed:`, error.message);
                if (attempt === retries) {
                    ctx.reply(`❌ Gagal mengunduh media setelah ${retries} percobaan.`);
                }
            }
        }
    }

    if (mediaFiles.length === 1) {
        await ctx.replyWithVideo({ source: mediaFiles[0] }, { caption });
    } else if (mediaFiles.length > 1) {
        let mediaGroup = mediaFiles.map((file, index) => ({
            type: "video",
            media: { source: file },
            caption: index === 0 ? caption : ""
        }));

        await ctx.replyWithMediaGroup(mediaGroup);
    } else {
        return ctx.reply("❌ Tidak ada media yang bisa diunduh.");
    }

    // Hapus file setelah dikirim
    mediaFiles.forEach(file => fs.unlinkSync(file));
}

// Handler Command dengan retry
bot.command(['ig', 'fb', 'tw', 'tt'], async (ctx) => {
    try {
        const messageText = ctx.message.text;
        const [command, url] = messageText.split(" ");

        if (!url) return ctx.reply("⚠️ URL tidak valid. Silakan coba lagi.");

        const msg = await ctx.reply("⌛ Tunggu sebentar...");

        let mediaData;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (command === "/ig") mediaData = await getInstagramMedia(url);
                else if (command === "/fb") mediaData = await getFacebookVideoUrl(url);
                else if (command === "/tw") mediaData = await getTwitterMedia(url);
                else if (command === "/tt") mediaData = await getTikTokMedia(url);

                if (mediaData && mediaData.urls.length > 0) break;
            } catch (error) {
                console.error(`Attempt ${attempt} failed:`, error.message);
                if (attempt === 3) {
                    await msg.editText("❌ Gagal mengambil media setelah beberapa kali percobaan.");
                    return;
                }
            }
        }

        if (mediaData && mediaData.urls.length > 0) {
            await downloadAndUpload(ctx, mediaData.urls, mediaData.caption || "");
            await ctx.deleteMessage(msg.message_id).catch(console.error);
        } else {
            await msg.editText("❌ Tidak ada media yang ditemukan.");
        }
    } catch (error) {
        console.error("Command Error:", error.message);
        ctx.reply("❌ Terjadi kesalahan. Coba lagi nanti.");
    }
});

// Instagram API dengan retry
async function getInstagramMedia(instagramUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get("https://api.snapx.info/v1/instagram", {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "x-app-id": "24340030",
                    "x-app-token": "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxNzI2NzgwODQwNzExIn0.5M65C_Rz_C3H4mkIQ3WvgfrpqD6lJmeDc-CK3x_Lbfw"
                },
                params: { url: instagramUrl }
            });

            if (response.status === 200 && response.data.data) {
                return {
                    urls: [response.data.data.video_url || response.data.data.display_url],
                    caption: response.data.data.title || "Tidak ada caption."
                };
            }
        } catch (error) {
            console.error(`Instagram attempt ${attempt} failed:`, error.message);
        }
    }
    return { urls: [] };
}

// Facebook API dengan retry
async function getFacebookVideoUrl(fbUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(`https://vdfr.aculix.net/fb?url=${fbUrl}`, {
                headers: { Authorization: "erg4t5hyj6u75u64y5ht4gf3er4gt5hy6uj7k8l9" }
            });

            if (response.status === 200 && response.data.media) {
                const video = response.data.media.find(m => m.is_video);
                if (video) return { urls: [video.video_url] };
            }
        } catch (error) {
            console.error(`Facebook attempt ${attempt} failed:`, error.message);
        }
    }
    return { urls: [] };
}

// Twitter API dengan retry
async function getTwitterMedia(twitterUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get("https://twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com/status", {
                headers: {
                    "x-rapidapi-key": "4f281a1be0msh5baa41ebeeda439p1d1139jsn3c26d05da8dd",
                    "x-rapidapi-host": "twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com"
                },
                params: { url: twitterUrl }
            });

            if (response.status === 200 && response.data.media.video) {
                return { urls: [response.data.media.video.videoVariants[0].url] };
            }
        } catch (error) {
            console.error(`Twitter attempt ${attempt} failed:`, error.message);
        }
    }
    return { urls: [] };
}

// TikTok API dengan retry
async function getTikTokMedia(tiktokUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(`https://www.tikwm.com/api/?url=${tiktokUrl}`);
            if (response.status === 200 && response.data.data) {
                return {
                    urls: [response.data.data.play],
                    caption: response.data.data.title || "Tidak ada caption."
                };
            }
        } catch (error) {
            console.error(`TikTok attempt ${attempt} failed:`, error.message);
        }
    }
    return { urls: [] };
}

// Tangani error global agar bot tidak crash
bot.catch((err, ctx) => {
    console.error(`Terjadi kesalahan di update ${ctx.update.update_id}:`, err);
    ctx.reply("⚠️ Terjadi kesalahan dalam sistem.");
});

// Jalankan bot
bot.launch().then(() => console.log("Bot Telegram berjalan..."));
