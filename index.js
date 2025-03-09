require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN || "7375007973:AAFczxhpL2dZSC6kz0EBKKRRKqMvoNZklyg";
const bot = new Telegraf(BOT_TOKEN);
const app = express();

const CHECK_INTERVAL = 100000; // 300 detik (5 menit)
const CHECK_URL = "https://bot2-9kk1x0u5.b4a.run/";

// Server express untuk health check
app.get('/', (req, res) => {
    res.json({ status: "Server is running", message: "Bot Telegram is active!" });
});

// Jalankan server di port 3000
app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});

// HTTP Health Check setiap 5 menit
async function healthCheck() {
    try {
        const response = await axios.get(CHECK_URL, { timeout: 5000 });
        console.log(`✅ Health check success: ${response.status}`);
    } catch (error) {
        console.error("❌ Health check failed:", error.message);
    }
}
setInterval(healthCheck, CHECK_INTERVAL);

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

            const contentType = response.headers['content-type'];
            let fileExt = "mp4"; // Default ke video jika tidak ditemukan jenis file

            if (contentType.includes("image")) {
                fileExt = "jpg";
            } else if (contentType.includes("video")) {
                fileExt = "mp4";
            }

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

    // Hapus file setelah dikirim
    mediaFiles.forEach(file => fs.unlinkSync(file.filePath));
}


// Handler Command
bot.command(['ig', 'fb', 'tw', 'tt'], async (ctx) => {
    try {
        const messageText = ctx.message.text;
        const [command, url] = messageText.split(" ");

        if (!url) return ctx.reply("⚠️ URL tidak valid. Silakan coba lagi.");

        let msg;
        try {
            msg = await ctx.reply("⌛ Tunggu sebentar...");
        } catch (err) {
            console.error("❌ Error saat mengirim pesan status:", err);
        }

        let mediaData;
        if (command === "/ig") mediaData = await getInstagramMedia(url);
        else if (command === "/fb") mediaData = await getFacebookVideoUrl(url);
        else if (command === "/tw") mediaData = await getTwitterMedia(url);
        else if (command === "/tt") mediaData = await getTikTokMedia(url);

        if (mediaData && mediaData.urls.length > 0) {
            await downloadAndUpload(ctx, mediaData.urls, mediaData.caption || "");
            if (msg) await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
        } else {
            if (msg) await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, "❌ Tidak ada media yang ditemukan.");
        }
    } catch (error) {
        console.error("❌ Command Error:", error);
        await ctx.reply("⚠️ Terjadi kesalahan, coba lagi nanti.");
    }
});

async function getInstagramMedia(instagramUrl) {
    try {
        let response = await require("axios").get("https://api.snapx.info/v1/instagram", {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "x-app-id": "24340030",
                "x-app-token": "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxNzY2NzgwODQwNzExIn0.5M65C_Rz_C3H4mkIQ3WvgfrpqD6lJmeDc-CK3x_Lbfw"
            },
            params: { url: instagramUrl }
        });

        if (response.status === 200) {
            try {
                let data = response.data.data || {};
                let videos = [];
                let images = [];
                let caption = data.title || "Tidak ada caption.";

                if (data.video_url) videos.push(data.video_url);
                if (!videos.length && data.__type === "GraphVideo" && data.video_url) videos.push(data.video_url);
                if (!videos.length && data.__type === "GraphSidecar") {
                    for (let item of data.items || []) {
                        if (item.__type === "GraphVideo" && item.video_url) videos.push(item.video_url);
                        else if (item.display_url) images.push(item.display_url);
                    }
                }
                if (!videos.length && data.display_url) images.push(data.display_url);

                return { urls: [...videos, ...images], caption };
            } catch (parseError) {
                console.error("❌ Parsing Error:", parseError);
            }
        }
    } catch (error) {
        console.error("❌ Instagram Error:", error);
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
        console.error("❌ Facebook Error:", error);
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
        console.error("❌ Twitter Error:", error);
    }
    return { urls: [] };
}

// TikTok API
async function getTikTokMedia(tiktokUrl) {
    try {
        if (!tiktokUrl) throw new Error("URL TikTok tidak boleh kosong.");

        const apiUrl = `https://www.tikwm.com/api/?url=${tiktokUrl}`;
        const response = await axios.get(apiUrl);

        if (response.status === 200 && response.data.data) {
            const data = response.data.data;

            // Cek apakah ada video (play URL) yang bukan MP3
            if (data.play && !data.play.endsWith(".mp3")) {
                return {
                    urls: [data.play],
                    caption: data.title || "Tidak ada caption."
                };
            }

            // Jika tidak ada video, cek apakah ada gambar
            if (Array.isArray(data.images) && data.images.length > 0) {
                return {
                    urls: data.images,
                    caption: data.title || "Tidak ada caption."
                };
            }
        }
    } catch (error) {
        console.error("❌ TikTok Error:", error.message);
    }

    return { urls: [] }; // Kembalikan kosong jika hanya ada mp3 atau error
}


// Jalankan bot
bot.launch().then(() => console.log("🤖 Bot Telegram berjalan..."));
