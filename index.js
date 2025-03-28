require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN || "7375007973:AAFczxhpL2dZSC6kz0EBKKRRKqMvoNZklyg";
const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.json({ status: "Server is running", message: "Bot Telegram is active!" }));
app.listen(3000, () => console.log('✅ Server running on http://localhost:3000'));

async function healthCheck() {
    try {
        const response = await axios.get("https://bot2-9kk1x0u5.b4a.run/", { timeout: 5000 });
        console.log(`✅ Health check success: ${response.status}`);
    } catch (error) {
        console.error("❌ Health check failed:", error.message);
    }
}
setInterval(healthCheck, 100000);

async function downloadAndUpload(ctx, mediaUrls, caption = "") {
    caption = caption.substring(0, 1024);
    let mediaFiles = [];

    for (let i = 0; i < mediaUrls.length; i++) {
        try {
            const response = await axios({ url: mediaUrls[i], method: 'GET', responseType: 'stream' });
            const contentType = response.headers['content-type'];
            let fileExt = contentType.includes("image") ? "jpg" : "mp4";
            const filePath = path.join(__dirname, `media_${i}.${fileExt}`);
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            mediaFiles.push({ filePath, type: contentType.includes("image") ? "photo" : "video" });
        } catch (error) {
            console.error("❌ Download error:", error);
        }
    }

    try {
        if (mediaFiles.length === 1) {
            if (mediaFiles[0].type === "photo") {
                await ctx.replyWithPhoto({ source: mediaFiles[0].filePath }, { caption });
            } else {
                await ctx.replyWithVideo({ source: mediaFiles[0].filePath }, { caption });
            }
        } else {
            let mediaGroup = mediaFiles.map((file, index) => ({
                type: file.type,
                media: { source: file.filePath },
                caption: index === 0 ? caption : ""
            }));
            await ctx.replyWithMediaGroup(mediaGroup);
        }
    } catch (error) {
        console.error("❌ Upload error:", error);
        await ctx.reply("⚠️ Gagal mengupload media.");
    }

    mediaFiles.forEach(file => fs.unlinkSync(file.filePath));
}

bot.command(['ig', 'fb', 'tw', 'tt'], async (ctx) => {
    try {
        const [command, url] = ctx.message.text.split(" ");
        if (!url) return ctx.reply("⚠️ URL tidak valid. Silakan coba lagi.");
        let msg = await ctx.reply("⌛ Tunggu sebentar...");

        let mediaData;
        if (command === "/ig") mediaData = await getInstagramMedia(url);
        else if (command === "/fb") mediaData = await getFacebookVideoUrl(url);
        else if (command === "/tw") mediaData = await getTwitterMedia(url);
        else if (command === "/tt") mediaData = await getTikTokMedia(url);

        if (mediaData && mediaData.urls.length > 0) {
            await downloadAndUpload(ctx, mediaData.urls, mediaData.caption || "");
            await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, "❌ Tidak ada media yang ditemukan.");
        }
    } catch (error) {
        console.error("❌ Command Error:", error);
        await ctx.reply("⚠️ Terjadi kesalahan, coba lagi nanti.");
    }
});

async function getInstagramMedia(instagramUrl) {
    try {
        const response = await axios.post("https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink", 
            { url: instagramUrl }, 
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-rapidapi-key": "b4204bb183mshbb02c6962ce881cp12a248jsn8a474bf78237",
                    "x-rapidapi-host": "social-download-all-in-one.p.rapidapi.com"
                }
            }
        );

        if (response.status === 200) {
            const data = response.data || {};
            const caption = data.title || "Tidak ada caption.";
            let mediaUrls = [];

            if (Array.isArray(data.medias)) {
                data.medias.forEach(media => {
                    if (media.url) mediaUrls.push(media.url);
                });
            }

            return { urls: mediaUrls, caption };
        }
    } catch (error) {
        console.error("❌ Instagram Error:", error);
    }
    return { urls: [], caption: "Tidak ada caption." };
}

async function getFacebookVideoUrl(fbUrl) {
    try {
        const response = await axios.get(`https://vdfr.aculix.net/fb?url=${fbUrl}`, {
            headers: { Authorization: "erg4t5hyj6u75u64y5ht4gf3er4gt5hy6uj7k8l9" }
        });

        if (response.status === 200 && response.data.media) {
            const video = response.data.media.find(m => m.is_video);
            if (video) return { urls: [video.video_url] };
        }
    } catch (error) {
        console.error("❌ Facebook Error:", error);
    }
    return { urls: [] };
}

async function getTwitterMedia(twitterUrl) {
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
        console.error("❌ Twitter Error:", error);
    }
    return { urls: [] };
}

async function getTikTokMedia(tiktokUrl) {
    try {
        const response = await axios.get(`https://www.tikwm.com/api/?url=${tiktokUrl}`);
        if (response.status === 200 && response.data.data) {
            const data = response.data.data;
            if (data.play && !data.play.endsWith(".mp3")) {
                return { urls: [data.play], caption: data.title || "Tidak ada caption." };
            }
            if (Array.isArray(data.images) && data.images.length > 0) {
                return { urls: data.images, caption: data.title || "Tidak ada caption." };
            }
        }
    } catch (error) {
        console.error("❌ TikTok Error:", error.message);
    }
    return { urls: [] };
}

bot.launch().then(() => console.log("🤖 Bot Telegram berjalan..."));
