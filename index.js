require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN || "7375007973:AAFczxhpL2dZSC6kz0EBKKRRKqMvoNZklyg";
const bot = new Telegraf(BOT_TOKEN);
const app = express();

const CONTENT_TYPE_MAP = {
    "video/mp4": "mp4",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
};

// Fake website dengan redirect
app.get('/', (req, res) => {
    res.send('<h1>Fake Website</h1><script>setTimeout(() => { window.location.href = "https://google.com"; }, 2000);</script>');
});

app.listen(3000, () => {
    console.log('Fake website running on http://localhost:3000');
});

// Fungsi download media
async function downloadAndUpload(ctx, mediaUrls, caption = "") {
    caption = caption.substring(0, 1024);
    let mediaFiles = [];

    for (let i = 0; i < mediaUrls.length; i++) {
        try {
            const response = await axios({
                url: mediaUrls[i],
                method: 'GET',
                responseType: 'stream'
            });

            const contentType = response.headers['content-type'] || "";
            const fileExt = CONTENT_TYPE_MAP[contentType] || "mp4";
            const filePath = path.join(__dirname, `media_${i}.${fileExt}`);

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            mediaFiles.push({ path: filePath, type: contentType });

        } catch (error) {
            console.error("Download error:", error);
        }
    }

    if (mediaFiles.length === 1) {
        const file = mediaFiles[0];
        if (file.type.startsWith("video")) {
            await ctx.replyWithVideo({ source: file.path }, { caption });
        } else {
            await ctx.replyWithPhoto({ source: file.path }, { caption });
        }
    } else {
        let mediaGroup = mediaFiles.map((file, index) => ({
            type: file.type.startsWith("video") ? "video" : "photo",
            media: { source: file.path },
            caption: index === 0 ? caption : ""
        }));

        await ctx.replyWithMediaGroup(mediaGroup);
    }

    mediaFiles.forEach(file => fs.unlinkSync(file.path));
}

// Handler Command
bot.command(['ig', 'fb', 'tw', 'tt'], async (ctx) => {
    const messageText = ctx.message.text;
    const [command, url] = messageText.split(" ");

    if (!url) {
        return ctx.reply("⚠️ URL tidak valid. Silakan coba lagi.");
    }

    const msg = await ctx.reply("⌛ Tunggu sebentar...");

    let mediaData;
    if (command === "/ig") {
        mediaData = await getInstagramMedia(url);
    } else if (command === "/fb") {
        mediaData = await getFacebookVideoUrl(url);
    } else if (command === "/tw") {
        mediaData = await getTwitterMedia(url);
    } else if (command === "/tt") {
        mediaData = await getTikTokMedia(url);
    }

    if (mediaData && mediaData.urls.length > 0) {
        await downloadAndUpload(ctx, mediaData.urls, mediaData.caption || "");
        await msg.delete();
    } else {
        await msg.editText("❌ Tidak ada media yang ditemukan.");
    }
});

// Instagram API
async function getInstagramMedia(instagramUrl) {
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
        console.error("Instagram Error:", error);
    }
    return { urls: [] };
}

// Facebook API
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
        console.error("Facebook Error:", error);
    }
    return { urls: [] };
}

// Twitter API
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
        console.error("Twitter Error:", error);
    }
    return { urls: [] };
}

// TikTok API
async function getTikTokMedia(tiktokUrl) {
    try {
        const response = await axios.get(`https://www.tikwm.com/api/?url=${tiktokUrl}`);
        if (response.status === 200 && response.data.data) {
            return {
                urls: [response.data.data.play],
                caption: response.data.data.title || "Tidak ada caption."
            };
        }
    } catch (error) {
        console.error("TikTok Error:", error);
    }
    return { urls: [] };
}

// Jalankan bot
bot.launch().then(() => console.log("Bot Telegram berjalan..."));

// Tangani exit agar bot berhenti dengan bersih
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
