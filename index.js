export default { 
  async fetch(request, env) {
    return await handleRequest(request, env);
  }
}

async function handleRequest(request, env) {
  // Mendapatkan path URL
  const { pathname } = new URL(request.url);

  if (pathname === "/webhook") {
    // Mengelola permintaan webhook dari Telegram
    const update = await request.json();
    const message = update.message || update.edited_message;
    
    if (message) {
      const chatId = message.chat.id;
      const text = message.text;

      if (text.startsWith("/ig")) {
        const url = text.split(" ")[1];
        const videoUrl = await getInstagramMedia(url);
        if (videoUrl) {
          await sendVideoToTelegram(chatId, videoUrl);
        } else {
          await sendMessageToTelegram(chatId, "Gagal mendapatkan video dari Instagram.");
        }
      } else if (text.startsWith("/fb")) {
        const url = text.split(" ")[1];
        const videoUrl = await getFacebookVideoUrl(url);
        if (videoUrl) {
          await sendVideoToTelegram(chatId, videoUrl);
        } else {
          await sendMessageToTelegram(chatId, "Gagal mendapatkan video dari Facebook.");
        }
      } else if (text.startsWith("/tw")) {
        const url = text.split(" ")[1];
        const videoUrl = await getTwitterVideoUrl(url);
        if (videoUrl) {
          await sendVideoToTelegram(chatId, videoUrl);
        } else {
          await sendMessageToTelegram(chatId, "Gagal mendapatkan video dari Twitter.");
        }
      } else if (text.startsWith("/tt")) {
        const url = text.split(" ")[1];
        const videoUrl = await getTiktokPlayUrl(url);
        if (videoUrl) {
          await sendVideoToTelegram(chatId, videoUrl);
        } else {
          await sendMessageToTelegram(chatId, "Gagal mendapatkan video dari TikTok.");
        }
      } else {
        await sendMessageToTelegram(chatId, "Perintah tidak dikenal.");
      }
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Not Found", { status: 404 });
}

async function sendMessageToTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: text
  });

  return await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });
}

async function sendVideoToTelegram(chatId, videoUrl) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
  const body = JSON.stringify({
    chat_id: chatId,
    video: videoUrl,
    supports_streaming: true
  });

  return await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });
}

// Fungsi untuk API Instagram
async function getInstagramMedia(instagramUrl) {
  const url = 'https://auto-download-all-in-one.p.rapidapi.com/v1/social/autolink';
  const headers = {
    'x-rapidapi-key': 'da2822c5a9msh3665ef1bee3ad2cp1ab549jsn457a3b017e06',
    'x-rapidapi-host': 'auto-download-all-in-one.p.rapidapi.com',
    'Content-Type': 'application/json',
  };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: instagramUrl }),
    });
    const data = await response.json();
    return data.medias[0].url;
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
    'Content-Type': 'application/json',
  };
  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    return data.media[0].video_url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi untuk API Twitter
async function getTwitterVideoUrl(twitterUrl) {
  const url = 'https://twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com/status';
  const headers = {
    'x-rapidapi-key': '4f281a1be0msh5baa41ebeeda439p1d1139jsn3c26d05da8dd',
    'x-rapidapi-host': 'twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com',
  };
  try {
    const response = await fetch(url, { method: 'GET', headers, params: { url: twitterUrl } });
    const data = await response.json();
    return data.media.video.videoVariants.find(v => v.content_type === 'video/mp4').url;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Fungsi untuk API TikTok
async function getTiktokPlayUrl(tiktokUrl) {
  const url = `https://www.tikwm.com/api/?url=${tiktokUrl}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.data.play;
  } catch (error) {
    console.error(error);
    return null;
  }
}
