const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const express = require('express');

// Setup Express
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>Selamat datang di Website Sederhana!</h1><p>Bot Telegram sedang berjalan di latar belakang...</p>');
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

// Bot Telegram setup
const BOT_TOKEN = '7375007973:AAEqgy2z2J2-Xii_wOhea98BmwMSdW82bHM';
const bot = new Telegraf(BOT_TOKEN);

// Fungsi API Twitter
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
    const media = response.data.media.video.videoVariants.find(v => v.content_type === 'video/mp4');
    return { url: media.url, type: 'video' };
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi API Instagram
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
    const media = response.data.medias[0];
    const type = media.type === 'video' ? 'video' : 'image';
    return { url: media.url, type };
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi API Facebook
async function getFacebookVideoUrl(fbUrl) {
  const url = `https://vdfr.aculix.net/fb?url=${fbUrl}`;
  const headers = {
    'Authorization': 'erg4t5hyj6u75u64y5ht4gf3er4gt5hy6uj7k8l9',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.12.0'
  };
  try {
    const response = await axios.get(url, { headers });
    const media = response.data.media[0];
    const type = media.is_video ? 'video' : 'image';
    return { url: media.video_url || media.image_url, type };
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi API TikTok
async function getTiktokPlayUrl(tiktokUrl) {
  const apiUrl = `https://www.tikwm.com/api/?url=${tiktokUrl}`;
  try {
    const response = await axios.get(apiUrl);
    return { url: response.data.data.play, type: 'video' };
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi unduh dan unggah video/gambar
async function downloadAndUpload(ctx, media) {
  if (!media || !media.url) {
    return ctx.reply("Terjadi kesalahan saat mengambil URL media.");
  }

  const uploadMessage = await ctx.reply("Media berhasil diunduh. Sedang mengunggah...");
  try {
    const response = await axios({
      url: media.url,
      method: 'GET',
      responseType: 'stream'
    });
    const filePath = media.type === 'video' ? './video.mp4' : './image.jpg';
    await pipeline(response.data, fs.createWriteStream(filePath));

    // Pastikan unggah sesuai tipe media
    if (media.type === 'video') {
      await ctx.replyWithVideo({ source: filePath });
    } else if (media.type === 'image') {
      await ctx.replyWithPhoto({ source: filePath });
    } else {
      await ctx.reply("Jenis media tidak dikenali.");
    }
    
    fs.unlinkSync(filePath); // Hapus file setelah diunggah
  } catch (error) {
    console.error(error);
    ctx.reply("Gagal mengunggah media.");
  }

  setTimeout(() => ctx.deleteMessage(uploadMessage.message_id), 5000);
}

// Fungsi handler platform
async function handleInstagram(ctx, url) {
  const media = await getInstagramMedia(url);
  await downloadAndUpload(ctx, media);
}

async function handleFacebook(ctx, url) {
  const media = await getFacebookVideoUrl(url);
  await downloadAndUpload(ctx, media);
}

async function handleTwitter(ctx, url) {
  const media = await twitterApi(url);
  await downloadAndUpload(ctx, media);
}

async function handleTiktok(ctx, url) {
  const media = await getTiktokPlayUrl(url);
  await downloadAndUpload(ctx, media);
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
