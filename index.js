require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN || "7375007973:AAFczxhpL2dZSC6kz0EBKKRRKqMvoNZklyg";
const bot = new Telegraf(BOT_TOKEN);
const app = express();

const CHECK_INTERVAL = 100000; // 300 detik (5 menit)
const CHECK_URL = "https://bot2-9kk1x0u5.b4a.run/";

const DEFAULT_EPOCH = "1739818135710";
const DEFAULT_HASH = "601c84a1991b93fa50a8ebd1c6a5d5f797eac864060f7cf82f61fcf61dbaad71";

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
            const urlObject = new URL(mediaUrls[i]);
            const authority = urlObject.hostname; // Ambil domain dari URL

            const response = await axios({
                url: mediaUrls[i],
                method: 'GET',
                responseType: 'stream',
                headers: {
                    'authority': authority,
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'cache-control': 'max-age=0',
                    'if-modified-since': 'Thu, 17 Oct 2024 12:36:36 GMT',
                    'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                    'sec-ch-ua-mobile': '?1',
                    'sec-ch-ua-platform': '"Android"',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'cross-site',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
                    'x-client-data': 'CL6AywEIxZrNAQ=='
                }
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
            console.error(`❌ Download error dari ${mediaUrls[i]}:`, error.message);
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
bot.command(['ig', 'fb', 'tw', 'tt', 'yt'], async (ctx) => {
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
        else if (command === "/yt") mediaData = await YTdown(url);

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
        const response = await axios.get("https://api.snapx.info/v1/instagram", {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "x-app-id": "24340030",
                "x-app-token": "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOiIxNzI2NzgwODQwNzExIn0.5M65C_Rz_C3H4mkIQ3WvgfrpqD6lJmeDc-CK3x_Lbfw"
            },
            params: { url: instagramUrl }
        });

        if (response.status === 200) {
            try {
                const data = response.data.data || {};

                let videos = [];
                let images = [];
                let caption = data.title || "Tidak ada caption.";

                // Coba ambil video utama langsung dari data jika ada
                if (data.video_url) {
                    videos.push(data.video_url);
                }

                // Jika video utama tidak ditemukan, cari dalam GraphVideo
                if (!videos.length && data.__type === "GraphVideo" && data.video_url) {
                    videos.push(data.video_url);
                }

                // Jika masih belum ada video, cari dalam GraphSidecar
                if (!videos.length && data.__type === "GraphSidecar") {
                    (data.items || []).forEach(item => {
                        if (item.__type === "GraphVideo" && item.video_url) {
                            videos.push(item.video_url);
                        } else if (item.display_url) {
                            images.push(item.display_url);
                        }
                    });
                }

                // Jika hanya gambar utama
                if (!videos.length && data.display_url) {
                    images.push(data.display_url);
                }

                // Prioritaskan video jika ada
                let mediaUrls = [...videos, ...images];

                return { urls: mediaUrls, caption };

            } catch (error) {
                console.error("❌ Parsing Error:", error);
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
async function YTdown(videoUrl) {
    try {
        const timestamp = Date.now();
        const signData = `${videoUrl}${timestamp}${DEFAULT_HASH}`;
        const hash = crypto.createHash('sha256').update(signData).digest('hex');

        const requestBody = {
            ts: timestamp,
            _ts: DEFAULT_EPOCH,
            _tsc: 0,
            _s: hash,
            url: videoUrl
        };

        const response = await axios.post("https://ummy.net/api/convert", requestBody, {
            headers: { "Content-Type": "application/json" }
        });

        const videos = response.data?.url || [];
        const googleVideos = videos.filter(v =>
            ["MP4", "WEBM"].includes(v.name) &&
            v.url.includes("googlevideo.com") &&
            !v.audio &&
            !v.no_audio
        );

        if (googleVideos.length > 0) {
            const bestVideo = googleVideos.reduce((max, v) => parseInt(v.quality) > parseInt(max.quality) ? v : max, googleVideos[0]);
            return { urls: [bestVideo.url] };
        }

    } catch (error) {
        console.error("❌ YouTube Download Error:", error.message);
    }
    return { urls: [] };
}


// Jalankan bot
bot.launch().then(() => console.log("🤖 Bot Telegram berjalan..."));
