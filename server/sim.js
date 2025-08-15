require('dotenv').config();

const url = `${process.env.NGROK_URL}/telemetry`;
const apiKey = process.env.API_KEY;
const deviceId = process.env.DEVICE_ID || 'truck-1';  // eğer cihaz adı .env dosyasında tanımlı ise onu kullanır yoksa truck-1 'i kullanır.

// Başlangıç konumu İSTANBUL // let lat = 41.05; // let lng = 28.97;
// Başlangıç konumu DİYARBAKIR 
let lat = 37.9144;
let lng = 40.2306;
// Başlangıç konumu ADANA // let lat = 37.0; // let lng = 35.3213;

function jitter(value, range = 0.00015) {   // Cinsi enlemdir. 1 enlem = 111km 'dir. (range = 1 demek 111km demektir.)
  return value + (Math.random() - 0.01) * range;
}

setInterval(async () => {
  lat = jitter(lat);
  lng = jitter(lng);

  const body = { deviceId, lat, lng };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error('POST failed:', res.status, await res.text());
    } else {
      console.log('sent', deviceId, lat.toFixed(6), lng.toFixed(6));
    }
  } catch (e) {
    console.error('network error', e.message);
  }
}, 2000);   // süre = 2000 ms yani 2.0 saniye
