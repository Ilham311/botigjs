addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// Fungsi utama untuk menangani permintaan
async function handleRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Invalid method', { status: 405 });
  }

  const updates = await request.json(); // Dapatkan updates dari webhook
  if (updates.message && updates.message.text) {
    const chatId = updates.message.chat.id;
    const messageText = updates.message.text;
    const [command, url] = messageText.split(' ');

    if (command && url) {
      switch (command) {
        case '/ig':
          return await handleInstagram(chatId, url);
        case '/fb':
          return await handleFacebook(chatId, url);
        case '/tw':
          return await handleTwitter(chatId, url);
        case '/tt':
          return await handleTiktok(chatId, url);
        default:
          return await sendMessage(chatId, "Perintah tidak dikenali.");
      }
    }
  }

  return new Response('OK', { status: 200 });
}

// Fungsi untuk mengirim pesan ke Telegram
async function sendMessage(chatId, text) {
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
  };
  await fetch(TELEGRAM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Fungsi untuk menangani Instagram
async function handleInstagram(chatId, url) {
  const videoUrl = await getInstagramMedia(url);
  if (videoUrl) {
    return await downloadAndUpload(chatId, videoUrl);
  }
  return await sendMessage(chatId, "Gagal mendapatkan video dari Instagram.");
}

// Fungsi untuk menangani Facebook
async function handleFacebook(chatId, url) {
  const videoUrl = await getFacebookVideoUrl(url);
  if (videoUrl) {
    return await downloadAndUpload(chatId, videoUrl);
  }
  return await sendMessage(chatId, "Gagal mendapatkan video dari Facebook.");
}

// Fungsi untuk menangani Twitter
async function handleTwitter(chatId, url) {
  const videoUrl = await getTwitterMedia(url);
  if (videoUrl) {
    return await downloadAndUpload(chatId, videoUrl);
  }
  return await sendMessage(chatId, "Gagal mendapatkan video dari Twitter.");
}

// Fungsi untuk menangani TikTok
async function handleTiktok(chatId, url) {
  const videoUrl = await getTiktokMedia(url);
  if (videoUrl) {
    return await downloadAndUpload(chatId, videoUrl);
  }
  return await sendMessage(chatId, "Gagal mendapatkan video dari TikTok.");
}

// Fungsi untuk mengunduh dan mengunggah video
async function downloadAndUpload(chatId, videoUrl) {
  const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;

  // Karena Cloudflare Workers tidak memiliki file system, kita harus melakukan streaming langsung
  const response = await fetch(videoUrl);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("video", blob, "video.mp4");

  await fetch(TELEGRAM_API, {
    method: 'POST',
    body: formData
  });

  return new Response('OK', { status: 200 });
}

// Fungsi untuk mendapatkan URL video Instagram
async function getInstagramMedia(instagramUrl) {
  const url = 'https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink';
  const headers = {
    'x-rapidapi-key': 'da2822c5a9msh3665ef1bee3ad2cp1ab549jsn457a3b017e06',
    'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com',
    'Content-Type': 'application/json',
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ url: instagramUrl })
  });
  const data = await response.json();
  return data.medias[0]?.url || null;
}

// Fungsi untuk mendapatkan URL video Facebook
async function getFacebookVideoUrl(fbUrl) {
  const apiUrl = `https://vdfr.aculix.net/fb?url=${fbUrl}`;
  const headers = {
    'Authorization': 'erg4t5hyj6u75u64y5ht4gf3er4gt5hy6uj7k8l9',
    'User-Agent': 'okhttp/4.12.0',
  };
  const response = await fetch(apiUrl, { headers });
  const data = await response.json();
  return data.media?.[0]?.is_video ? data.media[0].video_url : null;
}

// Fungsi untuk mendapatkan URL video Twitter
async function getTwitterMedia(twitterUrl) {
  const url = 'https://twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com/status';
  const headers = {
    'x-rapidapi-key': '4f281a1be0msh5baa41ebeeda439p1d1139jsn3c26d05da8dd',
    'x-rapidapi-host': 'twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com',
  };
  const response = await fetch(url, {
    headers,
    params: { url: twitterUrl },
  });
  const data = await response.json();
  return data.media.video.videoVariants.find(v => v.content_type === 'video/mp4').url;
}

// Fungsi untuk mendapatkan URL video TikTok
async function getTiktokMedia(tiktokUrl) {
  const url = `https://www.tikwm.com/api/?url=${tiktokUrl}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.data.play;
}
