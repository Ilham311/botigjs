const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const express = require('express'); // Import express

// Setup Express
const app = express();
const PORT = process.env.PORT || 3000; // Port untuk web server

// Endpoint sederhana untuk pengalihan
app.get('/', (req, res) => {
  res.send('<h1>Selamat datang di Website Sederhana!</h1><p>Bot Telegram sedang berjalan di latar belakang...</p>');
});

// Menjalankan Express server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

// Bot Telegram setup
const BOT_TOKEN = '7375007973:AAEqgy2z2J2-Xii_wOhea98BmwMSdW82bHM';
const bot = new Telegraf(BOT_TOKEN);

// Fungsi untuk API Twitter
async function twitterApi(twitterUrl) {
  const url = 'https://twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com/status';
  const headers = {
    'x-rapidapi-key': '4f281a1be0msh5baa41ebeeda439p1d1139jsn3c26d05da8dd',
    'x-rapidapi-host': 'twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.10.0'
  };
  try {
    const response = await axios.get(url, { params: { url: twitterUrl }, headers });
    const variants = response.data.media.video.videoVariants;
    return variants.find(v => v.content_type === 'video/mp4').url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi untuk API Instagram
async function getInstagramMedia(instagramUrl) {
  const url = 'https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink';
  const headers = {
    'x-rapidapi-key': 'da2822c5a9msh3665ef1bee3ad2cp1ab549jsn457a3b017e06',
    'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com',
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/3.14.9'
  };
  try {
    const response = await axios.post(url, { url: instagramUrl }, { headers });
    return response.data.medias[0].url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi untuk API Facebook
async function getFacebookVideoUrl(fbUrl) {
  const url = `https://vdfr.aculix.net/fb?url=${fbUrl}`;
  const headers = {
    'Authorization': 'erg4t5hyj6u75u64y5ht4gf3er4gt5hy6uj7k8l9',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.12.0'
  };
  try {
    const response = await axios.get(url, { headers });
    const media = response.data.media;
    return media.length && media[0].is_video ? media[0].video_url : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi untuk TikTok
async function getTiktokPlayUrl(tiktokUrl) {
  const apiUrl = `https://www.tikwm.com/api/?url=${tiktokUrl}`;
  try {
    const response = await axios.get(apiUrl);
    return response.data.data.play;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi untuk unduh dan unggah video
async function downloadAndUpload(ctx, videoUrl) {
  if (!videoUrl) {
    return ctx.reply("Terjadi kesalahan saat mengambil URL video.");
  }

  const uploadMessage = await ctx.reply("Video berhasil diunduh. Sedang mengunggah...");
  try {
    const response = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream'
    });
    const filePath = './video.mp4';
    await pipeline(response.data, fs.createWriteStream(filePath));
    await ctx.replyWithVideo({ source: filePath });
    fs.unlinkSync(filePath);  // Hapus file setelah diunggah
  } catch (error) {
    console.error(error);
    ctx.reply("Gagal mengunggah video.");
  }

  // Hapus pesan upload
  setTimeout(() => ctx.deleteMessage(uploadMessage.message_id), 5000);
}

// Fungsi handler platform
async function handleInstagram(ctx, url) {
  const videoUrl = await getInstagramMedia(url);
  await downloadAndUpload(ctx, videoUrl);
}

async function handleFacebook(ctx, url) {
  const videoUrl = await getFacebookVideoUrl(url);
  await downloadAndUpload(ctx, videoUrl);
}

async function handleTwitter(ctx, url) {
  const videoUrl = await twitterApi(url);
  await downloadAndUpload(ctx, videoUrl);
}

async function handleTiktok(ctx, url) {
  const videoUrl = await getTiktokPlayUrl(url);
  await downloadAndUpload(ctx, videoUrl);
}

// Menangani perintah unduh
bot.command(['ig', 'fb', 'tw', 'tt'], async (ctx) => {
  const text = ctx.message.text.split(' ');
  const command = text[0];
  const url = text[1];

  if (!url) {
    return ctx.reply("URL tidak valid. Silakan coba lagi.");
  }

  switch (command) {
    case '/ig':
      await handleInstagram(ctx, url);
      break;
    case '/fb':
      await handleFacebook(ctx, url);
      break;
    case '/tw':
      await handleTwitter(ctx, url);
      break;
    case '/tt':
      await handleTiktok(ctx, url);
      break;
    default:
      ctx.reply("Perintah tidak valid.");
      break;
  }
});

// Jalankan bot
bot.launch();
