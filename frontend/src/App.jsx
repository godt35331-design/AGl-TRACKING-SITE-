import React, { useState, useEffect, useRef, useMemo } from 'react';
import { setTawkVisible } from './tawk.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Truck, Plane, Ship, Activity, ClipboardList, PlusCircle, CheckCircle, 
  MapPin, LogOut, ArrowRight, Eye, EyeOff, Shield, Users, Package, RefreshCw, Mail, Lock,
  SlidersHorizontal, Download, Printer, Search, Trash, MessageSquare, Compass, Send, Pencil
} from 'lucide-react';
import LandingPage, { Brand } from './landing.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:5000/api' 
    : `${window.location.origin}/api`);

const WS_BASE = import.meta.env.VITE_WS_BASE || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'ws://127.0.0.1:5000' 
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`);

// Photo addresses from the server are relative ("/shipments/ID/image?v=1"); make them full URLs.
const imgSrc = (s) => {
  const p = s && s.packageImage;
  if (!p) return '';
  return /^(data:|https?:)/.test(p) ? p : `${API_BASE}${p}`;
};

// Shrink a chosen photo in the browser (max 1000px, JPEG) so uploads stay small and quick.
const compressImage = (file) => new Promise((resolve, reject) => {
  if (!file || !/^image\//.test(file.type)) { reject(new Error('Please choose an image file (PNG, JPG or WEBP).')); return; }
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that file.'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ name: file.name, size: `${((out.length * 0.75) / 1048576).toFixed(2)} MB`, base64: out });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// milliseconds -> value for <input type="datetime-local">
const toLocalInput = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

// Every call to our own API carries the signed session token. If the server rejects it
// (expired or tampered session) we drop the session and send the visitor to sign in again.
const SESSION_KEY = 'apex_user';
const readSessionToken = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.token || ''; } catch { return ''; }
};
if (typeof window !== 'undefined' && !window.__aglFetchPatched) {
  window.__aglFetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith(API_BASE)) return nativeFetch(input, init);
    const token = readSessionToken();
    let nextInit = init;
    if (token) {
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      nextInit = { ...init, headers };
    }
    const res = await nativeFetch(input, nextInit);
    if (res.status === 401 && token && !url.includes('/auth/login')) {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
      if (window.location.hash !== '#login') {
        window.location.hash = '#login';
        window.location.reload();
      }
    }
    return res;
  };
}

// 🌍 Comprehensive Shipping Cities & Logistics Hubs (USA, UK, Europe, & Gateways)
export const CITIES_DATA = [
  // --- UNITED KINGDOM ---
  { code: 'LON', name: 'London, England', country: 'UK', flag: '🇬🇧', coords: [51.5074, -0.1278] },
  { code: 'LHR', name: 'London Heathrow Cargo, England', country: 'UK', flag: '🇬🇧', coords: [51.4700, -0.4543] },
  { code: 'LGW', name: 'London Gatwick, England', country: 'UK', flag: '🇬🇧', coords: [51.1537, -0.1821] },
  { code: 'BHX', name: 'Birmingham, England', country: 'UK', flag: '🇬🇧', coords: [52.4862, -1.8904] },
  { code: 'MAN', name: 'Manchester, England', country: 'UK', flag: '🇬🇧', coords: [53.4808, -2.2426] },
  { code: 'LPL', name: 'Liverpool Port, England', country: 'UK', flag: '🇬🇧', coords: [53.4084, -2.9916] },
  { code: 'GLA', name: 'Glasgow, Scotland', country: 'UK', flag: '🇬🇧', coords: [55.8642, -4.2518] },
  { code: 'EDI', name: 'Edinburgh, Scotland', country: 'UK', flag: '🇬🇧', coords: [55.9533, -3.1883] },
  { code: 'BRS', name: 'Bristol, England', country: 'UK', flag: '🇬🇧', coords: [51.4545, -2.5879] },
  { code: 'LDS', name: 'Leeds, England', country: 'UK', flag: '🇬🇧', coords: [53.8008, -1.5491] },
  { code: 'SHF', name: 'Sheffield, England', country: 'UK', flag: '🇬🇧', coords: [53.3811, -1.4701] },
  { code: 'NCL', name: 'Newcastle, England', country: 'UK', flag: '🇬🇧', coords: [54.9783, -1.6178] },
  { code: 'BFS', name: 'Belfast, Northern Ireland', country: 'UK', flag: '🇬🇧', coords: [54.5973, -5.9301] },
  { code: 'NTG', name: 'Nottingham, England', country: 'UK', flag: '🇬🇧', coords: [52.9548, -1.1581] },
  { code: 'EMA', name: 'East Midlands Air Cargo, England', country: 'UK', flag: '🇬🇧', coords: [52.8311, -1.3281] },
  { code: 'SOU', name: 'Southampton Port, England', country: 'UK', flag: '🇬🇧', coords: [50.9097, -1.4044] },
  { code: 'CDF', name: 'Cardiff, Wales', country: 'UK', flag: '🇬🇧', coords: [51.4816, -3.1791] },
  { code: 'SWA', name: 'Swansea, Wales', country: 'UK', flag: '🇬🇧', coords: [51.6214, -3.9436] },
  { code: 'CVT', name: 'Coventry, England', country: 'UK', flag: '🇬🇧', coords: [52.4068, -1.5197] },
  { code: 'LCS', name: 'Leicester, England', country: 'UK', flag: '🇬🇧', coords: [52.6369, -1.1398] },
  { code: 'ABZ', name: 'Aberdeen, Scotland', country: 'UK', flag: '🇬🇧', coords: [57.1497, -2.0943] },
  { code: 'DND', name: 'Dundee, Scotland', country: 'UK', flag: '🇬🇧', coords: [56.4620, -2.9707] },
  { code: 'INV', name: 'Inverness, Scotland', country: 'UK', flag: '🇬🇧', coords: [57.4778, -4.2247] },
  { code: 'CAM', name: 'Cambridge, England', country: 'UK', flag: '🇬🇧', coords: [52.2053, 0.1218] },
  { code: 'OXF', name: 'Oxford, England', country: 'UK', flag: '🇬🇧', coords: [51.7520, -1.2577] },
  { code: 'DOV', name: 'Dover Freight Port, England', country: 'UK', flag: '🇬🇧', coords: [51.1279, 1.3134] },
  { code: 'FXT', name: 'Felixstowe Container Port, England', country: 'UK', flag: '🇬🇧', coords: [51.9638, 1.3511] },
  { code: 'EXT', name: 'Exeter, England', country: 'UK', flag: '🇬🇧', coords: [50.7184, -3.5339] },
  { code: 'PLY', name: 'Plymouth, England', country: 'UK', flag: '🇬🇧', coords: [50.3755, -4.1427] },
  { code: 'NRW', name: 'Norwich, England', country: 'UK', flag: '🇬🇧', coords: [52.6309, 1.2974] },
  { code: 'HUL', name: 'Hull Port, England', country: 'UK', flag: '🇬🇧', coords: [53.7676, -0.3274] },
  { code: 'DRB', name: 'Derby, England', country: 'UK', flag: '🇬🇧', coords: [52.9225, -1.4746] },
  { code: 'STK', name: 'Stoke-on-Trent, England', country: 'UK', flag: '🇬🇧', coords: [53.0027, -2.1794] },
  { code: 'WLV', name: 'Wolverhampton, England', country: 'UK', flag: '🇬🇧', coords: [52.5862, -2.1288] },
  { code: 'RDG', name: 'Reading, England', country: 'UK', flag: '🇬🇧', coords: [51.4543, -0.9781] },
  { code: 'PME', name: 'Portsmouth, England', country: 'UK', flag: '🇬🇧', coords: [50.8198, -1.0880] },
  { code: 'YRK', name: 'York, England', country: 'UK', flag: '🇬🇧', coords: [53.9599, -1.0873] },
  { code: 'LTN', name: 'Luton Freight, England', country: 'UK', flag: '🇬🇧', coords: [51.8787, -0.4200] },

  // --- EUROPE (GERMANY, FRANCE, NETHERLANDS, SPAIN, ITALY & MORE) ---
  { code: 'FRA', name: 'Frankfurt Cargo City, Germany', country: 'Europe', flag: '🇩🇪', coords: [50.1109, 8.6821] },
  { code: 'BER', name: 'Berlin, Germany', country: 'Europe', flag: '🇩🇪', coords: [52.5200, 13.4050] },
  { code: 'MUC', name: 'Munich, Germany', country: 'Europe', flag: '🇩🇪', coords: [48.1351, 11.5820] },
  { code: 'HAM', name: 'Hamburg Container Port, Germany', country: 'Europe', flag: '🇩🇪', coords: [53.5511, 9.9937] },
  { code: 'CGN', name: 'Cologne / Bonn Hub, Germany', country: 'Europe', flag: '🇩🇪', coords: [50.9375, 6.9603] },
  { code: 'LEJ', name: 'Leipzig European Cargo Hub, Germany', country: 'Europe', flag: '🇩🇪', coords: [51.3397, 12.3731] },
  { code: 'STR', name: 'Stuttgart Logistics, Germany', country: 'Europe', flag: '🇩🇪', coords: [48.7758, 9.1829] },
  { code: 'DUS', name: 'Dusseldorf, Germany', country: 'Europe', flag: '🇩🇪', coords: [51.2277, 6.7735] },
  { code: 'DTM', name: 'Dortmund, Germany', country: 'Europe', flag: '🇩🇪', coords: [51.5136, 7.4653] },
  { code: 'BRE', name: 'Bremen Logistics, Germany', country: 'Europe', flag: '🇩🇪', coords: [53.0793, 8.8017] },
  { code: 'HAJ', name: 'Hanover, Germany', country: 'Europe', flag: '🇩🇪', coords: [52.3759, 9.7320] },
  { code: 'NUE', name: 'Nuremberg, Germany', country: 'Europe', flag: '🇩🇪', coords: [49.4521, 11.0767] },
  { code: 'DRS', name: 'Dresden, Germany', country: 'Europe', flag: '🇩🇪', coords: [51.0504, 13.7373] },
  { code: 'PAR', name: 'Paris, France', country: 'Europe', flag: '🇫🇷', coords: [48.8566, 2.3522] },
  { code: 'CDG', name: 'Paris Charles de Gaulle, France', country: 'Europe', flag: '🇫🇷', coords: [49.0097, 2.5479] },
  { code: 'ORY', name: 'Paris Orly, France', country: 'Europe', flag: '🇫🇷', coords: [48.7262, 2.3652] },
  { code: 'MRS', name: 'Marseille Port, France', country: 'Europe', flag: '🇫🇷', coords: [43.2965, 5.3698] },
  { code: 'LYS', name: 'Lyon Saint-Exupery, France', country: 'Europe', flag: '🇫🇷', coords: [45.7640, 4.8357] },
  { code: 'TLS', name: 'Toulouse Aerospace Hub, France', country: 'Europe', flag: '🇫🇷', coords: [43.6047, 1.4442] },
  { code: 'NCE', name: 'Nice Cote d\'Azur, France', country: 'Europe', flag: '🇫🇷', coords: [43.7102, 7.2620] },
  { code: 'NTE', name: 'Nantes, France', country: 'Europe', flag: '🇫🇷', coords: [47.2184, -1.5536] },
  { code: 'SXB', name: 'Strasbourg, France', country: 'Europe', flag: '🇫🇷', coords: [48.5734, 7.7521] },
  { code: 'BOD', name: 'Bordeaux, France', country: 'Europe', flag: '🇫🇷', coords: [44.8378, -0.5792] },
  { code: 'LIL', name: 'Lille Eurozone, France', country: 'Europe', flag: '🇫🇷', coords: [50.6292, 3.0573] },
  { code: 'LEH', name: 'Le Havre Port, France', country: 'Europe', flag: '🇫🇷', coords: [49.4944, 0.1079] },
  { code: 'AMS', name: 'Amsterdam Schiphol, Netherlands', country: 'Europe', flag: '🇳🇱', coords: [52.3676, 4.9041] },
  { code: 'RTM', name: 'Rotterdam Europort, Netherlands', country: 'Europe', flag: '🇳🇱', coords: [51.9244, 4.4777] },
  { code: 'EIN', name: 'Eindhoven Tech Hub, Netherlands', country: 'Europe', flag: '🇳🇱', coords: [51.4416, 5.4697] },
  { code: 'UTC', name: 'Utrecht Central, Netherlands', country: 'Europe', flag: '🇳🇱', coords: [52.0907, 5.1214] },
  { code: 'MST', name: 'Maastricht Aachen Airport, Netherlands', country: 'Europe', flag: '🇳🇱', coords: [50.8514, 5.6909] },
  { code: 'BRU', name: 'Brussels International, Belgium', country: 'Europe', flag: '🇧🇪', coords: [50.8503, 4.3517] },
  { code: 'ANR', name: 'Antwerp Port Terminal, Belgium', country: 'Europe', flag: '🇧🇪', coords: [51.2194, 4.4025] },
  { code: 'LGG', name: 'Liege Air Cargo Gateway, Belgium', country: 'Europe', flag: '🇧🇪', coords: [50.6326, 5.5797] },
  { code: 'GNT', name: 'Ghent Logistics, Belgium', country: 'Europe', flag: '🇧🇪', coords: [51.0543, 3.7174] },
  { code: 'BGE', name: 'Bruges / Zeebrugge, Belgium', country: 'Europe', flag: '🇧🇪', coords: [51.2093, 3.2247] },
  { code: 'MAD', name: 'Madrid Barajas, Spain', country: 'Europe', flag: '🇪🇸', coords: [40.4168, -3.7038] },
  { code: 'BCN', name: 'Barcelona Port, Spain', country: 'Europe', flag: '🇪🇸', coords: [41.3879, 2.1699] },
  { code: 'VLC', name: 'Valencia Container Port, Spain', country: 'Europe', flag: '🇪🇸', coords: [39.4699, -0.3763] },
  { code: 'SVQ', name: 'Seville, Spain', country: 'Europe', flag: '🇪🇸', coords: [37.3891, -5.9845] },
  { code: 'ZAZ', name: 'Zaragoza Air Cargo, Spain', country: 'Europe', flag: '🇪🇸', coords: [41.6488, -0.8891] },
  { code: 'BIO', name: 'Bilbao Port, Spain', country: 'Europe', flag: '🇪🇸', coords: [43.2630, -2.9350] },
  { code: 'AGP', name: 'Malaga, Spain', country: 'Europe', flag: '🇪🇸', coords: [36.7213, -4.4214] },
  { code: 'ALC', name: 'Alicante, Spain', country: 'Europe', flag: '🇪🇸', coords: [38.3452, -0.4810] },
  { code: 'FCO', name: 'Rome Fiumicino, Italy', country: 'Europe', flag: '🇮🇹', coords: [41.9028, 12.4964] },
  { code: 'MXP', name: 'Milan Malpensa Cargo, Italy', country: 'Europe', flag: '🇮🇹', coords: [45.4642, 9.1900] },
  { code: 'BGY', name: 'Milan Bergamo Express, Italy', country: 'Europe', flag: '🇮🇹', coords: [45.6983, 9.6773] },
  { code: 'NAP', name: 'Naples Port, Italy', country: 'Europe', flag: '🇮🇹', coords: [40.8518, 14.2681] },
  { code: 'TRN', name: 'Turin, Italy', country: 'Europe', flag: '🇮🇹', coords: [45.0703, 7.6869] },
  { code: 'BLQ', name: 'Bologna Freight, Italy', country: 'Europe', flag: '🇮🇹', coords: [44.4949, 11.3426] },
  { code: 'GOA', name: 'Genoa Sea Port, Italy', country: 'Europe', flag: '🇮🇹', coords: [44.4056, 8.9463] },
  { code: 'VCE', name: 'Venice Marco Polo, Italy', country: 'Europe', flag: '🇮🇹', coords: [45.4408, 12.3155] },
  { code: 'FLR', name: 'Florence, Italy', country: 'Europe', flag: '🇮🇹', coords: [43.7696, 11.2558] },
  { code: 'VRN', name: 'Verona Quadrante Europa, Italy', country: 'Europe', flag: '🇮🇹', coords: [45.4384, 10.9916] },
  { code: 'ZRH', name: 'Zurich Airport, Switzerland', country: 'Europe', flag: '🇨🇭', coords: [47.3769, 8.5417] },
  { code: 'GVA', name: 'Geneva Freight, Switzerland', country: 'Europe', flag: '🇨🇭', coords: [46.2044, 6.1432] },
  { code: 'BSL', name: 'Basel-Mulhouse EuroAirport, Switzerland', country: 'Europe', flag: '🇨🇭', coords: [47.5596, 7.5886] },
  { code: 'BRN', name: 'Bern, Switzerland', country: 'Europe', flag: '🇨🇭', coords: [46.9480, 7.4474] },
  { code: 'VIE', name: 'Vienna Cargo City, Austria', country: 'Europe', flag: '🇦🇹', coords: [48.2082, 16.3738] },
  { code: 'SZG', name: 'Salzburg, Austria', country: 'Europe', flag: '🇦🇹', coords: [47.8095, 13.0550] },
  { code: 'INN', name: 'Innsbruck, Austria', country: 'Europe', flag: '🇦🇹', coords: [47.2692, 11.4041] },
  { code: 'DUB', name: 'Dublin Gateway, Ireland', country: 'Europe', flag: '🇮🇪', coords: [53.3498, -6.2603] },
  { code: 'ORK', name: 'Cork Port, Ireland', country: 'Europe', flag: '🇮🇪', coords: [51.8985, -8.4756] },
  { code: 'SNN', name: 'Shannon Cargo, Ireland', country: 'Europe', flag: '🇮🇪', coords: [52.7122, -8.9248] },
  { code: 'WAW', name: 'Warsaw Chopin, Poland', country: 'Europe', flag: '🇵🇱', coords: [52.2297, 21.0122] },
  { code: 'KRK', name: 'Krakow Balice, Poland', country: 'Europe', flag: '🇵🇱', coords: [50.0647, 19.9450] },
  { code: 'GDN', name: 'Gdansk Baltic Port, Poland', country: 'Europe', flag: '🇵🇱', coords: [54.3520, 18.6466] },
  { code: 'WRO', name: 'Wroclaw Logistics, Poland', country: 'Europe', flag: '🇵🇱', coords: [51.1079, 17.0385] },
  { code: 'POZ', name: 'Poznan, Poland', country: 'Europe', flag: '🇵🇱', coords: [52.4064, 16.9252] },
  { code: 'KTW', name: 'Katowice Pyrzowice, Poland', country: 'Europe', flag: '🇵🇱', coords: [50.2649, 19.0238] },
  { code: 'LIS', name: 'Lisbon Port, Portugal', country: 'Europe', flag: '🇵🇹', coords: [38.7223, -9.1393] },
  { code: 'OPO', name: 'Porto Leixoes Port, Portugal', country: 'Europe', flag: '🇵🇹', coords: [41.1579, -8.6291] },
  { code: 'FAO', name: 'Faro, Portugal', country: 'Europe', flag: '🇵🇹', coords: [37.0194, -7.9304] },
  { code: 'CPH', name: 'Copenhagen Kastrup, Denmark', country: 'Europe', flag: '🇩🇰', coords: [55.6761, 12.5683] },
  { code: 'AAR', name: 'Aarhus Port, Denmark', country: 'Europe', flag: '🇩🇰', coords: [56.1629, 10.2039] },
  { code: 'ARN', name: 'Stockholm Arlanda, Sweden', country: 'Europe', flag: '🇸🇪', coords: [59.3293, 18.0686] },
  { code: 'GOT', name: 'Gothenburg Port, Sweden', country: 'Europe', flag: '🇸🇪', coords: [57.7089, 11.9746] },
  { code: 'MMX', name: 'Malmo Express, Sweden', country: 'Europe', flag: '🇸🇪', coords: [55.6050, 13.0038] },
  { code: 'OSL', name: 'Oslo Gardermoen, Norway', country: 'Europe', flag: '🇳🇴', coords: [59.9139, 10.7522] },
  { code: 'BGO', name: 'Bergen Port, Norway', country: 'Europe', flag: '🇳🇴', coords: [60.3913, 5.3221] },
  { code: 'SVG', name: 'Stavanger, Norway', country: 'Europe', flag: '🇳🇴', coords: [58.9700, 5.7331] },
  { code: 'TRD', name: 'Trondheim, Norway', country: 'Europe', flag: '🇳🇴', coords: [63.4305, 10.3951] },
  { code: 'HEL', name: 'Helsinki Vantaa, Finland', country: 'Europe', flag: '🇫🇮', coords: [60.1699, 24.9384] },
  { code: 'TMP', name: 'Tampere, Finland', country: 'Europe', flag: '🇫🇮', coords: [61.4978, 23.7610] },
  { code: 'TKU', name: 'Turku Port, Finland', country: 'Europe', flag: '🇫🇮', coords: [60.4518, 22.2666] },
  { code: 'ATH', name: 'Athens Piraeus Port, Greece', country: 'Europe', flag: '🇬🇷', coords: [37.9838, 23.7275] },
  { code: 'SKG', name: 'Thessaloniki, Greece', country: 'Europe', flag: '🇬🇷', coords: [40.6401, 22.9444] },
  { code: 'PRG', name: 'Prague Ruzyne, Czechia', country: 'Europe', flag: '🇨🇿', coords: [50.0755, 14.4378] },
  { code: 'BRQ', name: 'Brno, Czechia', country: 'Europe', flag: '🇨🇿', coords: [49.1951, 16.6068] },
  { code: 'BUD', name: 'Budapest Cargo City, Hungary', country: 'Europe', flag: '🇭🇺', coords: [47.4979, 19.0402] },
  { code: 'BTS', name: 'Bratislava, Slovakia', country: 'Europe', flag: '🇭🇺', coords: [48.1486, 17.1077] },
  { code: 'OTP', name: 'Bucharest Otopeni, Romania', country: 'Europe', flag: '🇷🇴', coords: [44.4268, 26.1025] },
  { code: 'SOF', name: 'Sofia Gateway, Bulgaria', country: 'Europe', flag: '🇧🇬', coords: [42.6977, 23.3219] },
  { code: 'ZAG', name: 'Zagreb, Croatia', country: 'Europe', flag: '🇭🇷', coords: [45.8150, 15.9819] },
  { code: 'LJU', name: 'Ljubljana, Slovenia', country: 'Europe', flag: '🇸🇮', coords: [46.0569, 14.5058] },
  { code: 'IST', name: 'Istanbul New Airport Cargo, Turkey', country: 'Europe', flag: '🇹🇷', coords: [41.0082, 28.9784] },
  { code: 'SAW', name: 'Istanbul Sabiha Gokcen, Turkey', country: 'Europe', flag: '🇹🇷', coords: [40.8986, 29.3092] },
  { code: 'ESB', name: 'Ankara, Turkey', country: 'Europe', flag: '🇹🇷', coords: [39.9334, 32.8597] },
  { code: 'ADB', name: 'Izmir Port, Turkey', country: 'Europe', flag: '🇹🇷', coords: [38.4237, 27.1428] },

  // --- UNITED STATES (TEXAS & NATIONWIDE HUBS) ---
  { code: 'HOU', name: 'Houston Intercontinental, Texas', country: 'USA', flag: '🇺🇸', coords: [29.7604, -95.3698] },
  { code: 'DFW', name: 'Dallas / Fort Worth Logistics, Texas', country: 'USA', flag: '🇺🇸', coords: [32.7767, -96.7970] },
  { code: 'AUS', name: 'Austin Bergstrom, Texas', country: 'USA', flag: '🇺🇸', coords: [30.2672, -97.7431] },
  { code: 'SAT', name: 'San Antonio International, Texas', country: 'USA', flag: '🇺🇸', coords: [29.4241, -98.4936] },
  { code: 'ELP', name: 'El Paso Border Logistics Hub, Texas', country: 'USA', flag: '🇺🇸', coords: [31.7619, -106.4850] },
  { code: 'FTW', name: 'Fort Worth Alliance Cargo, Texas', country: 'USA', flag: '🇺🇸', coords: [32.7555, -97.3308] },
  { code: 'ARL', name: 'Arlington Logistics, Texas', country: 'USA', flag: '🇺🇸', coords: [32.7357, -97.1081] },
  { code: 'CRP', name: 'Corpus Christi Deepwater Port, Texas', country: 'USA', flag: '🇺🇸', coords: [27.8006, -97.3964] },
  { code: 'PLN', name: 'Plano North Texas Hub, Texas', country: 'USA', flag: '🇺🇸', coords: [33.0198, -96.6989] },
  { code: 'LBB', name: 'Lubbock Preston Smith, Texas', country: 'USA', flag: '🇺🇸', coords: [33.5779, -101.8552] },
  { code: 'LRD', name: 'Laredo World Trade Port, Texas', country: 'USA', flag: '🇺🇸', coords: [27.5306, -99.4803] },
  { code: 'AMA', name: 'Amarillo Rick Husband, Texas', country: 'USA', flag: '🇺🇸', coords: [35.2220, -101.8313] },
  { code: 'MFE', name: 'McAllen Foreign Trade Zone, Texas', country: 'USA', flag: '🇺🇸', coords: [26.2034, -98.2300] },
  { code: 'ACT', name: 'Waco Central Logistics, Texas', country: 'USA', flag: '🇺🇸', coords: [31.5493, -97.1467] },
  { code: 'BRO', name: 'Brownsville Port of Texas, Texas', country: 'USA', flag: '🇺🇸', coords: [25.9017, -97.4975] },
  { code: 'BPT', name: 'Beaumont / Port Arthur Petrochemical Port, Texas', country: 'USA', flag: '🇺🇸', coords: [30.0802, -94.1266] },
  { code: 'MAF', name: 'Midland / Odessa Permian Hub, Texas', country: 'USA', flag: '🇺🇸', coords: [31.9973, -102.0779] },
  { code: 'TYR', name: 'Tyler East Texas Gateway, Texas', country: 'USA', flag: '🇺🇸', coords: [32.3513, -95.3011] },
  { code: 'GLS', name: 'Galveston Port & Cruise Terminal, Texas', country: 'USA', flag: '🇺🇸', coords: [29.3013, -94.7977] },
  { code: 'ABI', name: 'Abilene Regional, Texas', country: 'USA', flag: '🇺🇸', coords: [32.4487, -99.7331] },
  { code: 'SPS', name: 'Wichita Falls, Texas', country: 'USA', flag: '🇺🇸', coords: [33.9137, -98.4934] },
  { code: 'SJT', name: 'San Angelo Concho Valley, Texas', country: 'USA', flag: '🇺🇸', coords: [31.4638, -100.4370] },
  { code: 'GRK', name: 'Killeen / Fort Cavazos Logistics, Texas', country: 'USA', flag: '🇺🇸', coords: [31.1171, -97.7278] },
  { code: 'CLL', name: 'College Station / Bryan, Texas', country: 'USA', flag: '🇺🇸', coords: [30.6280, -96.3344] },
  { code: 'GGG', name: 'Longview Gregg County, Texas', country: 'USA', flag: '🇺🇸', coords: [32.5007, -94.7405] },
  { code: 'TXK', name: 'Texarkana Gateway, Texas', country: 'USA', flag: '🇺🇸', coords: [33.4251, -94.0477] },
  { code: 'VCT', name: 'Victoria Regional, Texas', country: 'USA', flag: '🇺🇸', coords: [28.8053, -97.0036] },
  { code: 'HRL', name: 'Harlingen Valley International, Texas', country: 'USA', flag: '🇺🇸', coords: [26.1906, -97.6961] },
  { code: 'NYC', name: 'New York City, New York', country: 'USA', flag: '🇺🇸', coords: [40.7128, -74.0060] },
  { code: 'JFK', name: 'New York JFK Cargo, New York', country: 'USA', flag: '🇺🇸', coords: [40.6413, -73.7781] },
  { code: 'EWR', name: 'Newark Liberty Cargo, New Jersey', country: 'USA', flag: '🇺🇸', coords: [40.6895, -74.1745] },
  { code: 'LAX', name: 'Los Angeles International, California', country: 'USA', flag: '🇺🇸', coords: [34.0522, -118.2437] },
  { code: 'LGB', name: 'Long Beach Container Port, California', country: 'USA', flag: '🇺🇸', coords: [33.7701, -118.1937] },
  { code: 'SFO', name: 'San Francisco Bay Area, California', country: 'USA', flag: '🇺🇸', coords: [37.7749, -122.4194] },
  { code: 'OAK', name: 'Oakland Port & Air Cargo, California', country: 'USA', flag: '🇺🇸', coords: [37.8044, -122.2712] },
  { code: 'SJC', name: 'San Jose Silicon Valley, California', country: 'USA', flag: '🇺🇸', coords: [37.3382, -121.8863] },
  { code: 'SAN', name: 'San Diego Lindbergh, California', country: 'USA', flag: '🇺🇸', coords: [32.7157, -117.1611] },
  { code: 'SMF', name: 'Sacramento Valley Hub, California', country: 'USA', flag: '🇺🇸', coords: [38.5816, -121.4944] },
  { code: 'FAT', name: 'Fresno Central Valley, California', country: 'USA', flag: '🇺🇸', coords: [36.7468, -119.7726] },
  { code: 'ONT', name: 'Ontario Air Cargo SuperHub, California', country: 'USA', flag: '🇺🇸', coords: [34.0560, -117.6012] },
  { code: 'CHI', name: 'Chicago Central Hub, Illinois', country: 'USA', flag: '🇺🇸', coords: [41.8781, -87.6298] },
  { code: 'ORD', name: 'Chicago O\'Hare Global Cargo, Illinois', country: 'USA', flag: '🇺🇸', coords: [41.9742, -87.9073] },
  { code: 'PHX', name: 'Phoenix Sky Harbor, Arizona', country: 'USA', flag: '🇺🇸', coords: [33.4484, -112.0740] },
  { code: 'TUS', name: 'Tucson International, Arizona', country: 'USA', flag: '🇺🇸', coords: [32.2226, -110.9747] },
  { code: 'PHL', name: 'Philadelphia Regional Port, Pennsylvania', country: 'USA', flag: '🇺🇸', coords: [39.9526, -75.1652] },
  { code: 'PIT', name: 'Pittsburgh Intermodal, Pennsylvania', country: 'USA', flag: '🇺🇸', coords: [40.4406, -79.9959] },
  { code: 'SEA', name: 'Seattle Tacoma Container Port, Washington', country: 'USA', flag: '🇺🇸', coords: [47.6062, -122.3321] },
  { code: 'TCM', name: 'Tacoma Logistics Port, Washington', country: 'USA', flag: '🇺🇸', coords: [47.2529, -122.4443] },
  { code: 'GEG', name: 'Spokane Inland Hub, Washington', country: 'USA', flag: '🇺🇸', coords: [47.6588, -117.4260] },
  { code: 'DEN', name: 'Denver Intermodal Freight, Colorado', country: 'USA', flag: '🇺🇸', coords: [39.7392, -104.9903] },
  { code: 'COS', name: 'Colorado Springs, Colorado', country: 'USA', flag: '🇺🇸', coords: [38.8339, -104.8214] },
  { code: 'BOS', name: 'Boston Logan Freight, Massachusetts', country: 'USA', flag: '🇺🇸', coords: [42.3601, -71.0589] },
  { code: 'MIA', name: 'Miami International Gateway, Florida', country: 'USA', flag: '🇺🇸', coords: [25.7617, -80.1918] },
  { code: 'ORL', name: 'Orlando Central Cargo, Florida', country: 'USA', flag: '🇺🇸', coords: [28.5383, -81.3792] },
  { code: 'TPA', name: 'Tampa Bay Freight, Florida', country: 'USA', flag: '🇺🇸', coords: [27.9506, -82.4572] },
  { code: 'JAX', name: 'Jacksonville Deepwater Port, Florida', country: 'USA', flag: '🇺🇸', coords: [30.3322, -81.6557] },
  { code: 'FLL', name: 'Fort Lauderdale Port Everglades, Florida', country: 'USA', flag: '🇺🇸', coords: [26.1224, -80.1373] },
  { code: 'ATL', name: 'Atlanta Hartsfield SuperHub, Georgia', country: 'USA', flag: '🇺🇸', coords: [33.7490, -84.3880] },
  { code: 'SAV', name: 'Savannah Container Terminal, Georgia', country: 'USA', flag: '🇺🇸', coords: [32.0809, -81.0912] },
  { code: 'KC',  name: 'Kansas City Logistics Park, Missouri', country: 'USA', flag: '🇺🇸', coords: [39.0997, -94.5786] },
  { code: 'STL', name: 'St. Louis Mississippi Gateway, Missouri', country: 'USA', flag: '🇺🇸', coords: [38.6270, -90.1994] },
  { code: 'MEM', name: 'Memphis FedEx World Hub, Tennessee', country: 'USA', flag: '🇺🇸', coords: [35.1495, -90.0490] },
  { code: 'BNA', name: 'Nashville Music City Logistics, Tennessee', country: 'USA', flag: '🇺🇸', coords: [36.1627, -86.7816] },
  { code: 'SDF', name: 'Louisville UPS Worldport Hub, Kentucky', country: 'USA', flag: '🇺🇸', coords: [38.2527, -85.7585] },
  { code: 'IND', name: 'Indianapolis Air Cargo Hub, Indiana', country: 'USA', flag: '🇺🇸', coords: [39.7684, -86.1581] },
  { code: 'CVG', name: 'Cincinnati / Northern KY DHL Global Hub, Ohio', country: 'USA', flag: '🇺🇸', coords: [39.1031, -84.5120] },
  { code: 'CLE', name: 'Cleveland Lake Erie Logistics, Ohio', country: 'USA', flag: '🇺🇸', coords: [41.4993, -81.6944] },
  { code: 'CMH', name: 'Columbus Rickenbacker Air Cargo Hub, Ohio', country: 'USA', flag: '🇺🇸', coords: [39.9612, -82.9988] },
  { code: 'DET', name: 'Detroit Ambassador Bridge Hub, Michigan', country: 'USA', flag: '🇺🇸', coords: [42.3314, -83.0458] },
  { code: 'MSP', name: 'Minneapolis St Paul, Minnesota', country: 'USA', flag: '🇺🇸', coords: [44.9778, -93.2650] },
  { code: 'MKE', name: 'Milwaukee Lake Port, Wisconsin', country: 'USA', flag: '🇺🇸', coords: [43.0389, -87.9065] },
  { code: 'SLC', name: 'Salt Lake City Crossroads, Utah', country: 'USA', flag: '🇺🇸', coords: [40.7608, -111.8910] },
  { code: 'LAS', name: 'Las Vegas Logistics Hub, Nevada', country: 'USA', flag: '🇺🇸', coords: [36.1699, -115.1398] },
  { code: 'RNO', name: 'Reno Tahoe Industrial Center, Nevada', country: 'USA', flag: '🇺🇸', coords: [39.5296, -119.8138] },
  { code: 'PDX', name: 'Portland Maritime Gateway, Oregon', country: 'USA', flag: '🇺🇸', coords: [45.5152, -122.6784] },
  { code: 'CLT', name: 'Charlotte Douglas Cargo, North Carolina', country: 'USA', flag: '🇺🇸', coords: [35.2271, -80.8431] },
  { code: 'RDU', name: 'Raleigh Durham Research Triangle, North Carolina', country: 'USA', flag: '🇺🇸', coords: [35.7796, -78.6382] },
  { code: 'GSO', name: 'Greensboro Piedmont Triad Hub, North Carolina', country: 'USA', flag: '🇺🇸', coords: [36.0726, -79.7920] },
  { code: 'CHS', name: 'Charleston Port Terminal, South Carolina', country: 'USA', flag: '🇺🇸', coords: [32.7765, -79.9311] },
  { code: 'GSP', name: 'Greenville / Spartanburg Hub, South Carolina', country: 'USA', flag: '🇺🇸', coords: [34.8526, -82.3940] },
  { code: 'MSY', name: 'New Orleans Gulf Port, Louisiana', country: 'USA', flag: '🇺🇸', coords: [29.9511, -90.0715] },
  { code: 'BAL', name: 'Baltimore Seagirt Marine Terminal, Maryland', country: 'USA', flag: '🇺🇸', coords: [39.2904, -76.6122] },
  { code: 'WAS', name: 'Washington Dulles Air Cargo, DC', country: 'USA', flag: '🇺🇸', coords: [38.9072, -77.0369] },
  { code: 'ABQ', name: 'Albuquerque Rio Grande Hub, New Mexico', country: 'USA', flag: '🇺🇸', coords: [35.0844, -106.6504] },
  { code: 'OKC', name: 'Oklahoma City Crossroads, Oklahoma', country: 'USA', flag: '🇺🇸', coords: [35.4676, -97.5164] },
  { code: 'TUL', name: 'Tulsa Port of Catoosa, Oklahoma', country: 'USA', flag: '🇺🇸', coords: [36.1540, -95.9928] },
  { code: 'OMA', name: 'Omaha Union Pacific Hub, Nebraska', country: 'USA', flag: '🇺🇸', coords: [41.2565, -95.9345] },
  { code: 'DSM', name: 'Des Moines Heartland Hub, Iowa', country: 'USA', flag: '🇺🇸', coords: [41.5868, -93.6250] },
  { code: 'LIT', name: 'Little Rock River Port, Arkansas', country: 'USA', flag: '🇺🇸', coords: [34.7465, -92.2896] },
  { code: 'BHM', name: 'Birmingham Southern Hub, Alabama', country: 'USA', flag: '🇺🇸', coords: [33.5186, -86.8104] },
  { code: 'MOB', name: 'Mobile Container Terminal, Alabama', country: 'USA', flag: '🇺🇸', coords: [30.6954, -88.0399] },
  { code: 'JAN', name: 'Jackson Freight Center, Mississippi', country: 'USA', flag: '🇺🇸', coords: [32.2988, -90.1848] },
  { code: 'BOI', name: 'Boise Intermountain Hub, Idaho', country: 'USA', flag: '🇺🇸', coords: [43.6150, -116.2023] },

  // --- MEXICO (ALL 32 STATES & KEY LOGISTICS HUBS) ---
  { code: 'MEX', name: 'Mexico City (CDMX) Central Hub, Mexico', country: 'Mexico', flag: '🇲🇽', coords: [19.4326, -99.1332] },
  { code: 'NLU', name: 'Felipe Ángeles (AIFA) Cargo Gateway, State of Mexico', country: 'Mexico', flag: '🇲🇽', coords: [19.7454, -99.0142] },
  { code: 'TLC', name: 'Toluca Logistics & Air Cargo, State of Mexico', country: 'Mexico', flag: '🇲🇽', coords: [19.2826, -99.6557] },
  { code: 'GDL', name: 'Guadalajara Tech Logistics Hub, Jalisco', country: 'Mexico', flag: '🇲🇽', coords: [20.6597, -103.3496] },
  { code: 'MTY', name: 'Monterrey Industrial Center, Nuevo León', country: 'Mexico', flag: '🇲🇽', coords: [25.6866, -100.3161] },
  { code: 'TIJ', name: 'Tijuana Otay Mesa Border Port, Baja California', country: 'Mexico', flag: '🇲🇽', coords: [32.5149, -117.0382] },
  { code: 'MXL', name: 'Mexicali Industrial Corridor, Baja California', country: 'Mexico', flag: '🇲🇽', coords: [32.6245, -115.4523] },
  { code: 'ESE', name: 'Ensenada Deep Sea Port, Baja California', country: 'Mexico', flag: '🇲🇽', coords: [31.8667, -116.5964] },
  { code: 'LAP', name: 'La Paz Gateway, Baja California Sur', country: 'Mexico', flag: '🇲🇽', coords: [24.1426, -110.3128] },
  { code: 'SJD', name: 'Los Cabos Transpeninsular Hub, Baja California Sur', country: 'Mexico', flag: '🇲🇽', coords: [23.0587, -109.7048] },
  { code: 'HMO', name: 'Hermosillo Distribution Hub, Sonora', country: 'Mexico', flag: '🇲🇽', coords: [29.0729, -110.9559] },
  { code: 'NOG', name: 'Nogales International Border Terminal, Sonora', country: 'Mexico', flag: '🇲🇽', coords: [31.3086, -110.9422] },
  { code: 'CJS', name: 'Ciudad Juárez Border Gateway, Chihuahua', country: 'Mexico', flag: '🇲🇽', coords: [31.6904, -106.4245] },
  { code: 'CUU', name: 'Chihuahua Aerospace Hub, Chihuahua', country: 'Mexico', flag: '🇲🇽', coords: [28.6353, -106.0889] },
  { code: 'SLW', name: 'Saltillo Automotive Corridor, Coahuila', country: 'Mexico', flag: '🇲🇽', coords: [25.4260, -101.0053] },
  { code: 'TRC', name: 'Torreón La Laguna Hub, Coahuila', country: 'Mexico', flag: '🇲🇽', coords: [25.5428, -103.4068] },
  { code: 'NLD', name: 'Nuevo Laredo World Trade Bridge, Tamaulipas', country: 'Mexico', flag: '🇲🇽', coords: [27.4864, -99.5070] },
  { code: 'REX', name: 'Reynosa Freight Gateway, Tamaulipas', country: 'Mexico', flag: '🇲🇽', coords: [26.0569, -98.2978] },
  { code: 'MAM', name: 'Matamoros Port Terminal, Tamaulipas', country: 'Mexico', flag: '🇲🇽', coords: [25.8690, -97.5027] },
  { code: 'TAM', name: 'Tampico & Altamira Container Port, Tamaulipas', country: 'Mexico', flag: '🇲🇽', coords: [22.2331, -97.8611] },
  { code: 'CUL', name: 'Culiacán Agro-Logistics Center, Sinaloa', country: 'Mexico', flag: '🇲🇽', coords: [24.8091, -107.3940] },
  { code: 'MZT', name: 'Mazatlán Pacific Port, Sinaloa', country: 'Mexico', flag: '🇲🇽', coords: [23.2494, -106.4111] },
  { code: 'DGO', name: 'Durango Silver Corridor Hub, Durango', country: 'Mexico', flag: '🇲🇽', coords: [24.0277, -104.6532] },
  { code: 'ZCL', name: 'Zacatecas Central Industrial Hub, Zacatecas', country: 'Mexico', flag: '🇲🇽', coords: [22.7709, -102.5832] },
  { code: 'SLP', name: 'San Luis Potosí Logistics Valley, SLP', country: 'Mexico', flag: '🇲🇽', coords: [22.1565, -100.9855] },
  { code: 'AGU', name: 'Aguascalientes Automotive Hub, Aguascalientes', country: 'Mexico', flag: '🇲🇽', coords: [21.8853, -102.2916] },
  { code: 'TPQ', name: 'Tepic Logistics Center, Nayarit', country: 'Mexico', flag: '🇲🇽', coords: [21.5039, -104.8946] },
  { code: 'BJX', name: 'León / Bajío Logistics Hub, Guanajuato', country: 'Mexico', flag: '🇲🇽', coords: [21.1221, -101.6826] },
  { code: 'CYW', name: 'Celaya Intermodal Freight Yard, Guanajuato', country: 'Mexico', flag: '🇲🇽', coords: [20.5283, -100.8143] },
  { code: 'IRP', name: 'Irapuato Freight Gateway, Guanajuato', country: 'Mexico', flag: '🇲🇽', coords: [20.6767, -101.3563] },
  { code: 'QRO', name: 'Querétaro Intercontinental Logistics, Querétaro', country: 'Mexico', flag: '🇲🇽', coords: [20.5888, -100.3899] },
  { code: 'PCA', name: 'Pachuca Central Hub, Hidalgo', country: 'Mexico', flag: '🇲🇽', coords: [20.1011, -98.7591] },
  { code: 'TLN', name: 'Tulancingo Valley Logistics, Hidalgo, Mexico', country: 'Mexico', flag: '🇲🇽', coords: [20.0833, -98.3667] },
  { code: 'SMA', name: 'San Miguel Ameyalco (Lerma), State of Mexico', country: 'Mexico', flag: '🇲🇽', coords: [19.3064, -99.4581] },
  { code: 'CVJ', name: 'Cuernavaca Industrial Park, Morelos', country: 'Mexico', flag: '🇲🇽', coords: [18.9242, -99.2216] },
  { code: 'TXA', name: 'Tlaxcala Valley Terminal, Tlaxcala', country: 'Mexico', flag: '🇲🇽', coords: [19.3182, -98.2375] },
  { code: 'PBC', name: 'Puebla Automotive & Industrial Hub, Puebla', country: 'Mexico', flag: '🇲🇽', coords: [19.0414, -98.2063] },
  { code: 'VER', name: 'Veracruz Gulf Deepwater Port, Veracruz', country: 'Mexico', flag: '🇲🇽', coords: [19.1738, -96.1342] },
  { code: 'COA', name: 'Coatzacoalcos Isthmus Terminal, Veracruz', country: 'Mexico', flag: '🇲🇽', coords: [18.1345, -94.4578] },
  { code: 'PAZ', name: 'Poza Rica / Tuxpan Port, Veracruz', country: 'Mexico', flag: '🇲🇽', coords: [20.5332, -97.4584] },
  { code: 'JAL', name: 'Xalapa Freight Terminal, Veracruz', country: 'Mexico', flag: '🇲🇽', coords: [19.5438, -96.9102] },
  { code: 'MLM', name: 'Morelia Logistics Hub, Michoacán', country: 'Mexico', flag: '🇲🇽', coords: [19.7060, -101.1950] },
  { code: 'LZC', name: 'Lázaro Cárdenas Mega Container Port, Michoacán', country: 'Mexico', flag: '🇲🇽', coords: [17.9585, -102.2014] },
  { code: 'ZLO', name: 'Manzanillo Pacific Container Port, Colima', country: 'Mexico', flag: '🇲🇽', coords: [19.0522, -104.3158] },
  { code: 'COL', name: 'Colima Capital Logistics, Colima', country: 'Mexico', flag: '🇲🇽', coords: [19.2452, -103.7247] },
  { code: 'CHV', name: 'Chilpancingo Freight Hub, Guerrero', country: 'Mexico', flag: '🇲🇽', coords: [17.5513, -99.5058] },
  { code: 'ACA', name: 'Acapulco Maritime Gateway, Guerrero', country: 'Mexico', flag: '🇲🇽', coords: [16.8531, -99.8237] },
  { code: 'OAX', name: 'Oaxaca Central Freight Center, Oaxaca', country: 'Mexico', flag: '🇲🇽', coords: [17.0732, -96.7266] },
  { code: 'SCZ', name: 'Salina Cruz Interoceanic Port, Oaxaca', country: 'Mexico', flag: '🇲🇽', coords: [16.1833, -95.2000] },
  { code: 'TGZ', name: 'Tuxtla Gutiérrez Southern Gateway, Chiapas', country: 'Mexico', flag: '🇲🇽', coords: [16.7569, -93.1292] },
  { code: 'TAP', name: 'Tapachula / Puerto Chiapas Terminal, Chiapas', country: 'Mexico', flag: '🇲🇽', coords: [14.9042, -92.2618] },
  { code: 'VSA', name: 'Villahermosa Oil & Cargo Hub, Tabasco', country: 'Mexico', flag: '🇲🇽', coords: [17.9892, -92.9281] },
  { code: 'CPE', name: 'Campeche Gulf Marine Terminal, Campeche', country: 'Mexico', flag: '🇲🇽', coords: [19.8301, -90.5349] },
  { code: 'CME', name: 'Ciudad del Carmen Offshore Hub, Campeche', country: 'Mexico', flag: '🇲🇽', coords: [18.6496, -91.8286] },
  { code: 'MID', name: 'Mérida Yucatán Logistics Center, Yucatán', country: 'Mexico', flag: '🇲🇽', coords: [20.9674, -89.5926] },
  { code: 'PGO', name: 'Progreso Deep Container Port, Yucatán', country: 'Mexico', flag: '🇲🇽', coords: [21.2828, -89.6644] },
  { code: 'CUN', name: 'Cancún International Air Cargo, Quintana Roo', country: 'Mexico', flag: '🇲🇽', coords: [21.1619, -86.8515] },
  { code: 'CTM', name: 'Chetumal Border Freight Terminal, Quintana Roo', country: 'Mexico', flag: '🇲🇽', coords: [18.5141, -88.3038] },
  { code: 'CZM', name: 'Cozumel / Riviera Maya Gateway, Quintana Roo', country: 'Mexico', flag: '🇲🇽', coords: [20.5083, -86.9533] },

  // --- GLOBAL KEY GATEWAYS ---
  { code: 'DXB', name: 'Dubai Cargo City, UAE', country: 'Global', flag: '🇦🇪', coords: [25.2532, 55.3657] },
  { code: 'SIN', name: 'Singapore Changi, Singapore', country: 'Global', flag: '🇸🇬', coords: [1.3521, 103.8198] },
  { code: 'HND', name: 'Tokyo Haneda, Japan', country: 'Global', flag: '🇯🇵', coords: [35.5494, 139.7798] },
  { code: 'NRT', name: 'Tokyo Narita Cargo, Japan', country: 'Global', flag: '🇯🇵', coords: [35.7720, 140.3929] },
  { code: 'HKG', name: 'Hong Kong International Cargo', country: 'Global', flag: '🇭🇰', coords: [22.3193, 114.1694] },
  { code: 'PVG', name: 'Shanghai Pudong, China', country: 'Global', flag: '🇨🇳', coords: [31.2304, 121.4737] },
  { code: 'SZX', name: 'Shenzhen Freight Hub, China', country: 'Global', flag: '🇨🇳', coords: [22.6393, 113.8107] },
  { code: 'BOM', name: 'Mumbai Express Cargo, India', country: 'Global', flag: '🇮🇳', coords: [19.0896, 72.8656] },
  { code: 'DEL', name: 'Delhi Indira Gandhi, India', country: 'Global', flag: '🇮🇳', coords: [28.6139, 77.2090] },
  { code: 'YYZ', name: 'Toronto Pearson, Canada', country: 'Global', flag: '🇨🇦', coords: [43.6532, -79.3832] },
  { code: 'YVR', name: 'Vancouver Port, Canada', country: 'Global', flag: '🇨🇦', coords: [49.2827, -123.1207] },
  { code: 'YUL', name: 'Montreal Cargo, Canada', country: 'Global', flag: '🇨🇦', coords: [45.5017, -73.5673] },
  { code: 'SYD', name: 'Sydney Kingsford, Australia', country: 'Global', flag: '🇦🇺', coords: [-33.8688, 151.2093] },
  { code: 'MEL', name: 'Melbourne Tullamarine, Australia', country: 'Global', flag: '🇦🇺', coords: [-37.8136, 144.9631] }
];

// Expanded coordinates map for Leaflet pins & calculations
const GPS_COORDINATES = CITIES_DATA.reduce((acc, c) => {
  acc[c.code] = c.coords;
  return acc;
}, {
  // Legacy aliases
  'NY': [40.7128, -74.0060],
  'SF': [37.7749, -122.4194],
  'LA': [34.0522, -118.2437]
});

// ⚡ Automatic Optimal Route / Waypoint Algorithm
export function calculateOptimalRoute(originCode, destCode) {
  if (!originCode || !destCode) return [];
  if (originCode === destCode) return [originCode];

  const originCoords = GPS_COORDINATES[originCode];
  const destCoords = GPS_COORDINATES[destCode];

  if (!originCoords || !destCoords) {
    return [originCode, destCode];
  }

  const [lat1, lng1] = originCoords;
  const [lat2, lng2] = destCoords;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  if (dist < 1.5) {
    return [originCode, destCode];
  }

  const originItem = CITIES_DATA.find(c => c.code === originCode);
  const destItem = CITIES_DATA.find(c => c.code === destCode);
  const sameCountry = (originItem && destItem && originItem.country === destItem.country) ? originItem.country : null;

  const candidates = CITIES_DATA.filter(c => {
    if (c.code === originCode || c.code === destCode) return false;
    if (sameCountry && c.country !== sameCountry) return false;
    return true;
  }).map(c => {
    const [cLat, cLng] = c.coords;
    const dot = (cLat - lat1) * dLat + (cLng - lng1) * dLng;
    const t = dot / (dist * dist);

    if (t < 0.18 || t > 0.82) return null;

    const projLat = lat1 + t * dLat;
    const projLng = lng1 + t * dLng;
    const perpDist = Math.sqrt((cLat - projLat) ** 2 + (cLng - projLng) ** 2);

    return { code: c.code, name: c.name, t, perpDist };
  }).filter(Boolean);

  candidates.sort((a, b) => a.perpDist - b.perpDist);

  const waypoints = [originCode];
  if (candidates.length > 0) {
    if (dist < 8 || candidates.length === 1) {
      waypoints.push(candidates[0].code);
    } else {
      const first = candidates[0];
      const secondCandidates = candidates.slice(1).filter(c => Math.abs(c.t - first.t) > 0.18);
      if (secondCandidates.length > 0) {
        const sortedPair = [first, secondCandidates[0]].sort((a, b) => a.t - b.t);
        waypoints.push(sortedPair[0].code, sortedPair[1].code);
      } else {
        waypoints.push(first.code);
      }
    }
  }
  waypoints.push(destCode);
  return waypoints;
}

// 🏙️ Searchable Combobox Component for Cities & Hubs
const CitySearchInput = ({ value, selectedCode, placeholder, onChange }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    let list = CITIES_DATA;
    if (selectedRegion !== 'All') {
      list = list.filter(c => c.country === selectedRegion);
    }
    if (!q) return list.slice(0, 50);
    return list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.code.toLowerCase().includes(q) || 
      c.country.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [query, selectedRegion]);

  const displayVal = value || (selectedCode ? (CITIES_DATA.find(c => c.code === selectedCode)?.name || selectedCode) : '');

  return (
    <div className="city-search-box" ref={containerRef}>
      <div className="city-search-input-wrap">
        <span className="city-search-icon">
          <Search style={{ width: '15px', height: '15px' }} />
        </span>
        <input
          type="text"
          className="city-search-input"
          placeholder={placeholder || "Search city, state or hub in Mexico, USA, UK, Europe..."}
          value={isOpen ? query : (displayVal || query)}
          onFocus={() => {
            setQuery(value || '');
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            onChange(e.target.value, selectedCode || 'MEX');
          }}
        />
        {(displayVal || query) && (
          <button 
            type="button" 
            className="city-clear-btn"
            onClick={() => {
              setQuery('');
              onChange('', '');
              setIsOpen(false);
            }}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="city-dropdown-menu">
          {/* Quick Region Filter Bar */}
          <div className="city-region-filter-bar">
            {['All', 'Mexico', 'USA', 'Europe', 'UK', 'Global'].map((region) => (
              <button
                key={region}
                type="button"
                className={`city-region-pill ${selectedRegion === region ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelectedRegion(region);
                }}
              >
                {region === 'Mexico' ? '🇲🇽 Mexico' : region === 'Europe' ? '🇪🇺 Europe' : region === 'UK' ? '🇬🇧 UK' : region === 'USA' ? '🇺🇸 USA' : region === 'Global' ? '🌐 Global' : '🌍 All (200+)'}
              </button>
            ))}
          </div>

          <div className="city-dropdown-list">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <div 
                  key={item.code} 
                  className={`city-dropdown-item ${selectedCode === item.code ? 'active' : ''}`}
                  onMouseDown={() => {
                    onChange(item.name, item.code);
                    setQuery(item.name);
                    setIsOpen(false);
                  }}
                >
                  <div className="city-item-left">
                    <span className="city-item-flag">{item.flag}</span>
                    <div>
                      <span className="city-item-name">{item.name}</span>
                      <span className="city-item-country-tag">{item.country}</span>
                    </div>
                  </div>
                  <span className="city-item-badge">{item.code}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '14px', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                No standard hub found for "{query}". You can continue typing to save a custom location.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function getInterpolatedPosition(waypoints, progressPercentage) {
  if (!waypoints || waypoints.length === 0) return [0, 0];
  if (waypoints.length === 1) return GPS_COORDINATES[waypoints[0]] || [0, 0];

  const totalSegments = waypoints.length - 1;
  const progressRatio = progressPercentage / 100;
  const exactSegment = progressRatio * totalSegments;
  const activeSegmentIndex = Math.min(Math.floor(exactSegment), totalSegments - 1);
  const segmentProgress = exactSegment - activeSegmentIndex;

  const startStop = waypoints[activeSegmentIndex];
  const endStop = waypoints[activeSegmentIndex + 1];

  const startCoords = GPS_COORDINATES[startStop];
  const endCoords = GPS_COORDINATES[endStop];

  if (!startCoords || !endCoords) return [0, 0];

  const lat = startCoords[0] + (endCoords[0] - startCoords[0]) * segmentProgress;
  const lng = startCoords[1] + (endCoords[1] - startCoords[1]) * segmentProgress;

  return [lat, lng];
}

// Subcomponents: Interactive Leaflet Map Viewer
const LeafletMap = ({ shipment }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLineRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const markersRef = useRef([]);
  const lastFittedRouteKey = useRef('');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map centered on shipment origin or Mexico City central hub
    const originCoords = (shipment && GPS_COORDINATES[shipment.originCode]) ? GPS_COORDINATES[shipment.originCode] : [19.4326, -99.1332];
    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: true
    }).setView(originCoords, 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !shipment) return;

    // Clean old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (routeLineRef.current) map.removeLayer(routeLineRef.current);
    if (vehicleMarkerRef.current) map.removeLayer(vehicleMarkerRef.current);

    // Plot Route Waypoints
    const routePoints = (shipment.simulation?.waypoints || []).map(code => ({
      code,
      coords: GPS_COORDINATES[code]
    })).filter(pt => pt.coords);

    const latlngs = routePoints.map(pt => pt.coords);

    // Draw routing line
    if (latlngs.length > 0) {
      routeLineRef.current = L.polyline(latlngs, {
        color: '#ff2a00',
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 10'
      }).addTo(map);

      // Plot Hub Pins
      routePoints.forEach((pt, index) => {
        const isEnd = index === routePoints.length - 1;
        const isStart = index === 0;

        const pinIcon = L.divIcon({
          html: `<div class="map-hub-pin ${isStart ? 'start' : isEnd ? 'end' : 'mid'}"><span>${pt.code}</span></div>`,
          className: 'custom-pin-container',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker(pt.coords, { icon: pinIcon })
          .addTo(map)
          .bindPopup(`<b>Hub: ${pt.code}</b><br/>${CITIES_DATA.find(c => c.code === pt.code)?.name || 'Transit Stop'}<br/>Stop Index: ${index}`);
        markersRef.current.push(marker);
      });

      // Automatically frame route nicely when loaded or waypoints change
      const currentRouteKey = `${shipment.id}-${(shipment.simulation?.waypoints || []).join('-')}`;
      if (lastFittedRouteKey.current !== currentRouteKey && latlngs.length > 1) {
        lastFittedRouteKey.current = currentRouteKey;
        try {
          map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 8 });
        } catch (err) {
          // Fallback if container size is pending
        }
      }
    }

    // Set Vehicle Marker
    const vehiclePos = getInterpolatedPosition(shipment.simulation?.waypoints, shipment.simulation?.currentProgress || 0);
    const vehicleIcon = L.divIcon({
      html: `<div class="sim-vehicle ${(shipment.vessel || 'Truck').toLowerCase()}" style="transform: rotate(0deg);"><i class="fas fa-${shipment.vessel === 'Plane' ? 'plane' : shipment.vessel === 'Ship' ? 'ship' : 'truck'}"></i></div>`,
      className: 'custom-vehicle-container',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    vehicleMarkerRef.current = L.marker(vehiclePos, { icon: vehicleIcon })
      .addTo(map)
      .bindPopup(`<b>${shipment.id} (${shipment.vessel || 'Freight'})</b><br/>Telemetry: ${(shipment.simulation?.currentProgress || 0).toFixed(1)}% complete`);

    // Pan map to vehicle position during movement
    if (shipment.simulation?.active) {
      map.panTo(vehiclePos);
    }

  }, [shipment, shipment.simulation?.currentProgress, shipment.simulation?.waypoints]);

  return (
    <div style={{ height: '350px', width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
};

const EmailCenterView = ({ shipments, API_BASE }) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [templateType, setTemplateType] = useState('CUSTOM_NOTICE');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '6px',
    background: '#0b0f17',
    border: '1px solid var(--border-color, #222a38)',
    color: '#ffffff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const handleSelectShipment = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    if (!shipmentId) return;
    const shipment = shipments.find(s => s.id === shipmentId);
    if (shipment) {
      if (shipment.customerEmail) setRecipientEmail(shipment.customerEmail);
      if (shipment.customerName) setRecipientName(shipment.customerName);
      applyTemplate(templateType, shipment);
    }
  };

  const applyTemplate = (type, shipment = null) => {
    setTemplateType(type);
    const activeShipment = shipment || shipments.find(s => s.id === selectedShipmentId);
    const code = activeShipment?.id || '[TRACKING_CODE]';
    const senderNote = activeShipment?.senderName ? ` from ${activeShipment.senderName}` : '';

    if (type === 'SHIPMENT_UPDATE') {
      setSubject(`Shipment Update: AGL Package #${code}${senderNote}`);
      setMessageBody(`Your package #${code}${senderNote} has been updated to "${activeShipment?.status || 'In Transit'}". Current location: ${activeShipment?.currentLocationName || activeShipment?.origin || 'Hub'}.`);
    } else if (type === 'OUT_FOR_DELIVERY') {
      setSubject(`Out for Delivery: AGL Package #${code}${senderNote}`);
      setMessageBody(`Great news! Your AGL package #${code}${senderNote} is out for final delivery today. Please ensure someone is available to receive the package.`);
    } else if (type === 'DELAY_NOTICE') {
      setSubject(`Important Notice: Update on AGL Package #${code}`);
      setMessageBody(`We wanted to notify you that shipment #${code}${senderNote} is experiencing a slight delay due to logistics processing. Our team is actively resolving this to deliver your package as soon as possible.`);
    } else {
      setSubject(`Notice regarding your AGL Shipment #${code}`);
      setMessageBody(`Hello,\n\nWe are writing to provide an update regarding your parcel with AGL Logistics${senderNote}.\n\nThank you for choosing AGL Logistics.`);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.trim()) {
      setFeedback({ type: 'error', text: 'Please provide a valid recipient email address.' });
      return;
    }
    if (!messageBody || !messageBody.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a message body before sending.' });
      return;
    }

    setSending(true);
    setFeedback({ type: '', text: '' });

    const linkedShipment = shipments.find(s => s.id === selectedShipmentId);

    try {
      const res = await fetch(`${API_BASE}/admin/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: recipientEmail,
          recipientName: recipientName || recipientEmail.split('@')[0],
          senderName: linkedShipment?.senderName || '',
          senderPhone: linkedShipment?.senderPhone || '',
          subject: subject,
          messageBody: messageBody,
          templateType: templateType,
          shipmentId: selectedShipmentId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: `Email dispatched successfully to ${recipientEmail}!` });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to send email.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error connecting to email dispatch server.' });
    } finally {
      setSending(false);
    }
  };

  const selectedShipment = shipments.find(s => s.id === selectedShipmentId);

  return (
    <section className="email-center-view">
      <div className="email-center-header">
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--mx-ink)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail style={{ color: '#ff2a00' }} /> Admin Email Dispatch Center
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0 0', fontSize: '0.9rem' }}>
            Send transactional emails & updates directly to customers via Resend API
          </p>
        </div>
        <div className="resend-active-badge">
          ✓ Resend Active: support@aglgloballogistics.com
        </div>
      </div>

      {feedback.text && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#4ade80' : '#f87171',
          fontWeight: '600',
          fontSize: '0.9rem'
        }}>
          {feedback.type === 'success' ? '✓ ' : 'Warning: '}{feedback.text}
        </div>
      )}

      <div className="email-center-grid">
        
        {/* Left Column: Form Controls */}
        <div className="email-compose-card" style={{ background: 'var(--card-bg, #121722)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ff2a00', marginTop: 0, marginBottom: '16px' }}>
            1. Compose Email
          </h3>

          <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Link Active Shipment (Auto-Fills Customer Info)
              </label>
              <select
                value={selectedShipmentId}
                onChange={(e) => handleSelectShipment(e.target.value)}
                style={inputStyle}
              >
                <option value="" style={{ background: '#0b0f17', color: '#ffffff' }}>-- None (Manual Recipient) --</option>
                {shipments.map(s => (
                  <option key={s.id} value={s.id} style={{ background: '#0b0f17', color: '#ffffff' }}>
                    {s.id} - {s.customerName || 'No Name'} ({s.customerEmail || 'No Email'}){s.senderName ? ` [Sender: ${s.senderName}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="email-form-row">
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Recipient Email *
                </label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Preset Email Template
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'SHIPMENT_UPDATE', label: 'Status Update' },
                  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
                  { id: 'DELAY_NOTICE', label: 'Delay Notice' },
                  { id: 'CUSTOM_NOTICE', label: 'Custom Notice' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      border: templateType === t.id ? '1px solid #ff2a00' : '1px solid var(--border-color)',
                      background: templateType === t.id ? 'rgba(255, 42, 0, 0.15)' : '#0b0f17',
                      color: templateType === t.id ? '#ff2a00' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Subject Line *
              </label>
              <input
                type="text"
                placeholder="Email Subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#e2e8f0', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Message Content *
              </label>
              <textarea
                rows={5}
                placeholder="Write your email body message here..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                required
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                marginTop: '10px',
                padding: '12px 20px',
                borderRadius: '8px',
                background: sending ? '#64748b' : 'linear-gradient(135deg, #ff2a00 0%, #d91f00 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '800',
                fontSize: '0.95rem',
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {sending ? (
                <>Sending Email via Resend...</>
              ) : (
                <>Dispatch Email Now &rarr;</>
              )}
            </button>

          </form>
        </div>

        {/* Right Column: Live Preview (Dukascopy Bank Style) */}
        <div style={{ background: 'var(--card-bg, #121722)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ff2a00', marginTop: 0, marginBottom: '16px' }}>
            2. Live Email Preview
          </h3>

          <div style={{ background: '#eef2f5', color: '#2d3748', borderRadius: '8px', padding: '20px', fontFamily: 'Arial, Helvetica, sans-serif', border: '1px solid #cbd5e1' }}>
            
            {/* Top Logo */}
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#ff2a00', letterSpacing: '1px' }}>AGL</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#d91f00', marginLeft: '6px', textTransform: 'uppercase' }}>LOGISTICS</span>
            </div>

            {/* Main White Card 1 */}
            <div style={{ background: '#ffffff', borderRadius: '4px', padding: '20px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748', margin: '0 0 14px 0' }}>
                Dear {recipientName || 'Sir/Madam'},
              </p>

              <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#4a5568', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {messageBody || 'Your message content will render here...'}
              </div>

              {selectedShipment && (
                <div style={{ background: '#f7fafc', border: '1px solid #edf2f7', borderRadius: '2px', padding: '12px', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ marginBottom: '4px' }}><strong>Tracking ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#0b0f17' }}>{selectedShipment.id}</span></div>
                  <div style={{ marginBottom: '4px' }}><strong>Status:</strong> {selectedShipment.status}</div>
                  <div><strong>Route:</strong> {selectedShipment.origin || 'N/A'} to {selectedShipment.destination || 'N/A'}</div>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <span style={{ color: '#0b0f17', fontWeight: 'bold', fontSize: '13px', textDecoration: 'underline' }}>
                  Track Package Online &rarr;
                </span>
              </div>
            </div>

            {/* Footer White Card 2 */}
            <div style={{ background: '#ffffff', borderRadius: '4px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#4a5568' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#2d3748' }}>AGL Global Logistics Services</p>
              <p style={{ margin: '0 0 4px 0' }}>Website: aglgloballogistics.com</p>
              <p style={{ margin: '0', color: '#718096' }}>Email: support@aglgloballogistics.com</p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

const MessagesView = ({ messages, API_BASE, onMarkRead }) => {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [filterSearch, setFilterSearch] = useState('');

  // Group messages by customerEmail
  const conversations = React.useMemo(() => {
    const groups = {};
    (messages || []).forEach(m => {
      const email = m.customerEmail ? m.customerEmail.toLowerCase().trim() : 'unknown@aglgloballogistics.com';
      if (!groups[email]) {
        groups[email] = {
          email,
          name: m.customerName || email.split('@')[0],
          messages: [],
          unreadCount: 0,
          lastMsg: m
        };
      }
      groups[email].messages.push(m);
      if (m.sender === 'customer' && !m.read) {
        groups[email].unreadCount += 1;
      }
    });

    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a.lastMsg.createdAt || a.lastMsg.updatedAt || 0).getTime();
      const timeB = new Date(b.lastMsg.createdAt || b.lastMsg.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [messages]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedEmail) {
      setSelectedEmail(conversations[0].email);
    }
  }, [conversations, selectedEmail]);

  useEffect(() => {
    if (!selectedEmail) return;
    const targetConv = conversations.find(c => c.email === selectedEmail);
    if (targetConv && targetConv.unreadCount > 0) {
      onMarkRead(selectedEmail);
    }
    const lastMsg = targetConv?.messages[targetConv.messages.length - 1];
    if (lastMsg && lastMsg.subject) {
      const subj = lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`;
      setReplySubject(subj);
    } else {
      setReplySubject('Re: Customer Inquiry');
    }
  }, [selectedEmail, conversations, onMarkRead]);

  const activeConv = conversations.find(c => c.email === selectedEmail);
  const sortedActiveMsgs = React.useMemo(() => {
    if (!activeConv) return [];
    return [...activeConv.messages].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [activeConv]);

  const latestCustomerMsg = React.useMemo(() => {
    if (!sortedActiveMsgs.length) return null;
    const custMsgs = sortedActiveMsgs.filter(m => m.sender === 'customer');
    return custMsgs.length > 0 ? custMsgs[custMsgs.length - 1] : sortedActiveMsgs[sortedActiveMsgs.length - 1];
  }, [sortedActiveMsgs]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedEmail || !replyBody.trim()) return;

    setSending(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/admin/messages/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: selectedEmail,
          customerName: activeConv?.name || selectedEmail.split('@')[0],
          subject: replySubject,
          body: replyBody.trim(),
          inReplyTo: latestCustomerMsg?.messageId || ''
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReplyBody('');
        setFeedback({
          type: 'success',
          text: data.emailSent ? 'Reply dispatched to customer via email!' : 'Reply recorded in portal.'
        });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to dispatch reply.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error connecting to messaging server.' });
    } finally {
      setSending(false);
    }
  };

  const handleSimulateInbound = async () => {
    const targetEmail = selectedEmail || 'customer@aglgloballogistics.com';
    const sampleText = prompt(`Enter test email reply message from customer (${targetEmail}):`, "Hello Support, thank you! Could you also check if signature release is available for my shipment?");
    if (!sampleText) return;

    try {
      const res = await fetch(`${API_BASE}/inbound-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${activeConv?.name || 'Customer'} <${targetEmail}>`,
          subject: `Re: Inquiry regarding AGL Package`,
          text: sampleText
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'success', text: 'Simulated customer email reply received in inbox!' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to simulate inbound email.' });
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.email.toLowerCase().includes(filterSearch.toLowerCase()) || 
    c.name.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <section className="messages-view admin-messages-view">
      <div className="messages-view-header">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1a202c', margin: 0 }}>Customer Support Inbox</h2>
          <p style={{ color: '#718096', fontSize: '14px', margin: '4px 0 0 0' }}>
            Real-time inbound customer inquiries & threaded email responses
          </p>
        </div>
        <button
          onClick={handleSimulateInbound}
          className="btn-test-inbound-reply"
        >
          + Test Inbound Reply
        </button>
      </div>

      <div className="messages-thread-grid">
        
        {/* Left Column: Conversation List */}
        <div className="messages-conv-sidebar" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #edf2f7', background: '#f8fafc' }}>
            <input 
              type="text"
              placeholder="Search conversations..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#a0aec0', fontSize: '14px' }}>
                No active support threads.
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = conv.email === selectedEmail;
                return (
                  <div
                    key={conv.email}
                    onClick={() => setSelectedEmail(conv.email)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #edf2f7',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#edf2f7' : (conv.unreadCount > 0 ? '#fffaf0' : '#ffffff'),
                      transition: 'background 0.15s ease',
                      borderLeft: isSelected ? '4px solid #0b0f17' : '4px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {conv.name}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{ backgroundColor: '#e53e3e', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '10px' }}>
                          {conv.unreadCount} NEW
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px', fontFamily: 'monospace' }}>
                      {conv.email}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a5568', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.lastMsg.body ? conv.lastMsg.body.substring(0, 45) + '...' : 'New message'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Thread & Reply Form */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConv ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#a0aec0' }}>
              Select a conversation to view support history.
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #edf2f7', background: '#0b0f17', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{activeConv.name}</h3>
                  <span style={{ fontSize: '12px', opacity: 0.85, fontFamily: 'monospace' }}>{activeConv.email}</span>
                </div>
                <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '4px' }}>
                  {sortedActiveMsgs.length} messages
                </span>
              </div>

              {/* Message Feed */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f7fafc', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {sortedActiveMsgs.map((m, index) => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <div
                      key={m._id || index}
                      style={{
                        alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAdmin ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#718096', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: isAdmin ? '#d91f00' : '#3a4152' }}>
                          {isAdmin ? 'AGL Support Admin' : m.customerName}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.createdAt || Date.now()).toLocaleString()}</span>
                      </div>
                      <div
                        style={{
                          background: isAdmin ? '#0b0f17' : '#ffffff',
                          color: isAdmin ? '#ffffff' : '#2d3748',
                          padding: '14px 16px',
                          borderRadius: isAdmin ? '12px 12px 0 12px' : '12px 12px 12px 0',
                          border: isAdmin ? '1px solid #d91f00' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {m.subject && (
                          <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '6px', opacity: 0.9, borderBottom: isAdmin ? '1px solid rgba(255,255,255,0.2)' : '1px solid #edf2f7', paddingBottom: '4px' }}>
                            {m.subject}
                          </div>
                        )}
                        {m.body}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div style={{ padding: '16px', borderTop: '1px solid #edf2f7', background: '#ffffff' }}>
                {feedback.text && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    backgroundColor: feedback.type === 'error' ? '#fff5f5' : '#f0fff4',
                    color: feedback.type === 'error' ? '#c53030' : '#276749',
                    border: `1px solid ${feedback.type === 'error' ? '#feb2b2' : '#9ae6b4'}`
                  }}>
                    {feedback.text}
                  </div>
                )}

                <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    type="text"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="Subject..."
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '13px', outline: 'none' }}
                  />
                  <textarea 
                    rows="3"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your response to client..."
                    style={{ padding: '10px 12px', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={sending || !replyBody.trim()}
                      style={{
                        backgroundColor: '#0b0f17',
                        color: '#ffffff',
                        fontWeight: '700',
                        fontSize: '14px',
                        padding: '10px 24px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: (sending || !replyBody.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (sending || !replyBody.trim()) ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {sending ? 'Sending Reply...' : 'Send Email Reply →'}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </section>
  );
};

const CustomerSupportView = ({ user, messages, API_BASE, onMarkRead, onMessageSent }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const chatBottomRef = useRef(null);

  const customerEmail = (user?.email || '').toLowerCase().trim();

  // Filter messages for current customer
  const threadMessages = useMemo(() => {
    if (!customerEmail) return [];
    return (messages || [])
      .filter(m => m.customerEmail && m.customerEmail.toLowerCase().trim() === customerEmail)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }, [messages, customerEmail]);

  // Mark admin replies as read when customer opens the view
  useEffect(() => {
    if (customerEmail && onMarkRead) {
      const hasUnread = threadMessages.some(m => m.sender === 'admin' && !m.read);
      if (hasUnread) {
        onMarkRead(customerEmail);
      }
    }
  }, [customerEmail, threadMessages, onMarkRead]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadMessages.length]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!body.trim() || sending) return;

    setSending(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: user.email,
          customerName: user.name || user.email.split('@')[0],
          subject: subject.trim() || 'General Shipment & Delivery Inquiry',
          body: body.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBody('');
        setSubject('');
        setFeedback({ 
          type: 'success', 
          text: 'Inquiry delivered directly to AGL Global Dispatch Operations!' 
        });
        if (onMessageSent && data.message) {
          onMessageSent(data.message);
        }
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to dispatch inquiry.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Network error connecting to support server.' });
    } finally {
      setSending(false);
    }
  };

  const quickTopics = [
    'Customs Clearance & Duty Info',
    'Change Delivery Address',
    'Hold at Hub / Warehouse',
    'Proof of Delivery / Signature',
    'Urgent Telemetry Inquiry'
  ];

  return (
    <section className="customer-support-view" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px 16px 40px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #121722 0%, #16120f 100%)',
        border: '1px solid rgba(255, 42, 0, 0.3)',
        borderRadius: '14px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255, 42, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ff2a00',
            flexShrink: 0
          }}>
            <MessageSquare style={{ width: '26px', height: '26px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                Customer Support & Dispatch Helpdesk
              </h2>
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
                Desk Active 24/7
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: '#cbd5e1' }}>
              Direct threaded communication with AGL logistics dispatchers, cargo handlers, and fleet managers.
            </p>
          </div>
        </div>

        <button 
          onClick={() => window.location.hash = '#dashboard'}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#e2e8f0',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ← Return to Dashboard
        </button>
      </div>

      {/* Main Chat Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '560px'
      }}>
        {/* Chat Thread Header Bar */}
        <div style={{
          padding: '16px 22px',
          background: '#f8fafc',
          borderBottom: '1px solid #edf2f7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
              Conversation with AGL Global Dispatch
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Connected as: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>{customerEmail}</span>
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', background: '#e2e8f0', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
            {threadMessages.length} Message{threadMessages.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Message Bubble Stream */}
        <div style={{
          flex: 1,
          padding: '24px',
          background: '#f8fafc',
          overflowY: 'auto',
          maxHeight: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {threadMessages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              maxWidth: '460px',
              margin: 'auto',
              color: '#64748b'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <MessageSquare style={{ width: '32px', height: '32px' }} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                How can we assist you today?
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                Our dispatch operators are ready to help with parcel telemetry, delivery schedules, address modifications, or customs clearance. Send a message below!
              </p>
            </div>
          ) : (
            threadMessages.map((m, index) => {
              const isCust = m.sender === 'customer';
              const formattedDate = new Date(m.createdAt || Date.now()).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={m._id || index}
                  style={{
                    alignSelf: isCust ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isCust ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontWeight: 700, color: isCust ? '#b45309' : '#047857' }}>
                      {isCust ? 'You (Customer)' : 'AGL Dispatch Support'}
                    </span>
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </div>

                  <div style={{
                    background: isCust ? '#0b0f17' : '#ffffff',
                    color: isCust ? '#ffffff' : '#1e293b',
                    padding: '14px 18px',
                    borderRadius: isCust ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    border: isCust ? '1px solid #b45309' : '1px solid #e2e8f0',
                    boxShadow: isCust ? '0 2px 8px rgba(11, 15, 23, 0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
                    fontSize: '0.92rem',
                    lineHeight: '1.55',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {m.subject && (
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        marginBottom: '6px',
                        paddingBottom: '5px',
                        borderBottom: isCust ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #f1f5f9',
                        color: isCust ? '#ff2a00' : '#0f172a'
                      }}>
                        {m.subject}
                      </div>
                    )}
                    <div>{m.body}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Quick Topics Pills */}
        <div style={{
          padding: '12px 20px',
          background: '#f1f5f9',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
            Quick Topics:
          </span>
          {quickTopics.map((top, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSubject(top)}
              style={{
                background: subject === top ? '#0b0f17' : '#ffffff',
                color: subject === top ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {top}
            </button>
          ))}
        </div>

        {/* Compose Form */}
        <div style={{ padding: '20px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          {feedback.text && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: feedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: feedback.type === 'error' ? '#dc2626' : '#16a34a',
              border: `1px solid ${feedback.type === 'error' ? '#fca5a5' : '#86efac'}`
            }}>
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject / Shipment ID (optional, e.g. AGL-8271-4492 delivery query)..."
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />

            <textarea
              rows="3"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message for AGL Dispatch Operations..."
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.92rem',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                💡 Direct dispatch responses appear in real-time right here in your portal.
              </span>
              <button
                type="submit"
                disabled={sending || !body.trim()}
                style={{
                  background: 'linear-gradient(135deg, #0b0f17 0%, #1f100c 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  padding: '11px 24px',
                  borderRadius: '8px',
                  border: '1px solid #ff2a00',
                  cursor: (sending || !body.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (sending || !body.trim()) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 10px rgba(11, 15, 23, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Send style={{ width: '15px', height: '15px' }} />
                <span>{sending ? 'Sending to Dispatch...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};


const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const getValidSession = () => {
  try {
    const savedStr = localStorage.getItem('apex_user');
    if (!savedStr) return null;
    const saved = JSON.parse(savedStr);

    if (!saved || !saved.role || !saved.token) {
      localStorage.removeItem('apex_user');
      return null;
    }

    // Session persisted for 30 days for both Admin and Customer across page refreshes
    if (saved.loginTimestamp && (Date.now() - saved.loginTimestamp > SESSION_EXPIRY_MS)) {
      localStorage.removeItem('apex_user');
      return null;
    }

    return saved;
  } catch (e) {
    localStorage.removeItem('apex_user');
    return null;
  }
};

const getInitialTab = () => {
  try {
    const rawHash = window.location.hash;
    if (!rawHash || rawHash === '#home') return 'home';
    const tab = rawHash.startsWith('#details?id=') ? 'details' : rawHash.replace('#', '');
    const sess = getValidSession();
    if (!sess && ['admin', 'dashboard', 'appointment', 'email-center', 'messages'].includes(tab)) {
      return 'home';
    }
    return tab || 'home';
  } catch {
    return 'home';
  }
};

export default function App() {
  const [user, setUser] = useState(() => getValidSession());
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Live chat is only for signed-in customers, not visitors or admins.
  useEffect(() => {
    setTawkVisible(user?.role === 'customer');
  }, [user]);

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [shipments, setShipments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const unreadCount = messages.filter(m => m.sender === 'customer' && !m.read).length;
  const customerUnreadCount = (messages || []).filter(
    m => m.customerEmail && 
         m.customerEmail.toLowerCase().trim() === (user?.email || '').toLowerCase().trim() && 
         m.sender === 'admin' && 
         !m.read
  ).length;

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      fetch(`${API_BASE}/messages`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setMessages(Array.isArray(data) ? data : []))
        .catch(err => console.error('Error fetching messages:', err));
    } else if (user.role === 'customer' && user.email) {
      fetch(`${API_BASE}/messages?email=${encodeURIComponent(user.email.toLowerCase().trim())}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setMessages(Array.isArray(data) ? data : []))
        .catch(err => console.error('Error fetching customer messages:', err));
    }
  }, [user, activeTab]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTab]);

  // Transition Flash Navigator
  const triggerNavigationWithFlash = (targetHash) => {
    setIsFlashing(true);
    setTimeout(() => {
      window.location.hash = targetHash;
    }, 250);
    setTimeout(() => {
      setIsFlashing(false);
    }, 750);
  };
  const [stats, setStats] = useState(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  
  // Login Form States
  const [loginTrackingCode, setLoginTrackingCode] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Shipping Form States (Sender & Recipient)
  const [formSenderName, setFormSenderName] = useState('');
  const [formSenderCountryCode, setFormSenderCountryCode] = useState('+52');
  const [formSenderPhone, setFormSenderPhone] = useState('');
  const [formSenderEmail, setFormSenderEmail] = useState('');
  const [formSenderAddress, setFormSenderAddress] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formCountryCode, setFormCountryCode] = useState('+52');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formUploadedImage, setFormUploadedImage] = useState(null);
  const [formWeight, setFormWeight] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVessel, setFormVessel] = useState('Truck');
  const [formOrigin, setFormOrigin] = useState('Mexico City (CDMX) Central Hub, Mexico');
  const [formDestination, setFormDestination] = useState('Monterrey Industrial Center, Nuevo León');
  const [formOriginCode, setFormOriginCode] = useState('MEX');
  const [formDestCode, setFormDestCode] = useState('MTY');
  const [formEta, setFormEta] = useState('2026-07-25');
  const [formRouteConfig, setFormRouteConfig] = useState('MEX-QRO-SLP-MTY');
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });
  const [formTrackingId, setFormTrackingId] = useState(`AGL-${Math.floor(10000000 + Math.random() * 90000000)}`);
  const [formShipmentType, setFormShipmentType] = useState('Standard');
  const [formInitialStatus, setFormInitialStatus] = useState('Manifest Prepared');
  const [formInternalNotes, setFormInternalNotes] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formStartAt, setFormStartAt] = useState('');
  const [imageError, setImageError] = useState('');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showCustomerTrackPrompt, setShowCustomerTrackPrompt] = useState(false);
  const [customerTrackInput, setCustomerTrackInput] = useState('');
  const [trackPromptError, setTrackPromptError] = useState('');

  // Visitor Quick Tracking Modal States
  const [showVisitorTrackModal, setShowVisitorTrackModal] = useState(false);
  const [visitorTrackInput, setVisitorTrackInput] = useState('');
  const [visitorTrackError, setVisitorTrackError] = useState('');
  const [visitorTrackResult, setVisitorTrackResult] = useState(null);
  const [visitorTrackLoading, setVisitorTrackLoading] = useState(false);

  // Hero Section Quick-Track Bar States
  const [heroTrackCode, setHeroTrackCode] = useState('');
  const [heroTrackLoading, setHeroTrackLoading] = useState(false);

  // Tracking Search
  const [searchTrackId, setSearchTrackId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Live simulator controls (for active admin telemetry toggles)
  const [simActiveShipmentId, setSimActiveShipmentId] = useState('');
  const [simSpeed, setSimSpeed] = useState(2);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [simDurationHours, setSimDurationHours] = useState(72); // Default 3 days (1h up to 168h / 7 days)
  const [durationUnit, setDurationUnit] = useState('days'); // 'hours' or 'days'
  const simDurationHoursRef = useRef(simDurationHours);
  useEffect(() => {
    simDurationHoursRef.current = simDurationHours;
  }, [simDurationHours]);

  useEffect(() => {
    if (simActiveShipmentId) {
      const activeShip = shipments.find(s => s.id === simActiveShipmentId);
      if (activeShip && activeShip.simulation && activeShip.simulation.durationHours) {
        setSimDurationHours(activeShip.simulation.durationHours);
      }
    }
  }, [simActiveShipmentId, shipments]);

  const shipmentsRef = useRef(shipments);
  useEffect(() => {
    shipmentsRef.current = shipments;
  }, [shipments]);

  const simActiveShipmentIdRef = useRef(simActiveShipmentId);
  useEffect(() => {
    simActiveShipmentIdRef.current = simActiveShipmentId;
  }, [simActiveShipmentId]);

  const simSpeedRef = useRef(simSpeed);
  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  const simIntervalRef = useRef(null);

  // Sync hash routing
  useEffect(() => {
    const handleHash = () => {
      const rawHash = window.location.hash || '#home';
      window.scrollTo(0, 0);

      const currentUser = userRef.current || user || getValidSession();

      const targetTab = rawHash.startsWith('#details?id=') ? 'details' : rawHash.replace('#', '');
      
      if (targetTab === 'home' || !rawHash || rawHash === '#home') {
        setActiveTab('home');
        return;
      }

      // Protected route check
      if (!currentUser && ['admin', 'dashboard', 'appointment', 'email-center', 'messages'].includes(targetTab)) {
        setActiveTab('home');
        if (window.location.hash !== '#home') {
          window.location.hash = '#home';
        }
        return;
      }

      if (rawHash.startsWith('#details?id=')) {
        const id = rawHash.split('=')[1];
        setSelectedShipmentId(id);
      }

      setActiveTab(targetTab || 'home');
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();

    return () => window.removeEventListener('hashchange', handleHash);
  }, [user]);

  // Auto-fetch targeted shipment if opened via direct email link
  useEffect(() => {
    if (!selectedShipmentId) return;
    const exists = shipments.some(s => s.id.toUpperCase() === selectedShipmentId.toUpperCase());
    if (!exists) {
      fetch(`${API_BASE}/shipments/${selectedShipmentId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.id) {
            setShipments(prev => {
              if (prev.some(s => s.id.toUpperCase() === data.id.toUpperCase())) return prev;
              return [data, ...prev];
            });
          }
        })
        .catch(err => console.error('Error fetching direct link shipment:', err));
    }
  }, [selectedShipmentId]);

  // Fetch initial core shipments / data
  const fetchShipments = async () => {
    try {
      const queryParam = user ? (user.role === 'admin' ? '' : (user.trackingNumber ? `?trackingNumber=${encodeURIComponent(user.trackingNumber)}` : `?email=${encodeURIComponent(user.email)}`)) : '';
      const res = await fetch(`${API_BASE}/shipments${queryParam}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setShipments(data);
      }
      
      // Auto-set simulator target if empty
      if (Array.isArray(data) && data.length > 0 && !simActiveShipmentId) {
        setSimActiveShipmentId(data[0].id);
      }
    } catch (e) {
      console.error('Fetch shipments failed:', e);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [user]);

  const fetchStats = async () => {
    if (!user || user.role !== 'admin') return;
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Fetch stats failed:', e);
    }
  };

  useEffect(() => {
    fetchShipments();
    fetchStats();
  }, [user]);

  // WebSocket Telemetry Connection Link
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWS = () => {
      ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(readSessionToken())}`);

      ws.onopen = () => {
        console.log('Connected to real-time telemetry Socket channel.');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'SHIPMENT_UPDATE') {
            const updated = msg.payload;
            
            // Sync live lists
            setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
            
            // If viewing this shipment map, update state
            if (selectedShipmentId && selectedShipmentId.toUpperCase() === updated.id.toUpperCase()) {
              setSelectedShipmentId(updated.id);
            }
          } else if (msg.type === 'SHIPMENT_DELETED') {
            const { id } = msg.payload;
            setShipments(prev => prev.filter(s => s.id !== id));
            if (selectedShipmentId && selectedShipmentId.toUpperCase() === id.toUpperCase()) {
              setSelectedShipmentId(null);
              if (window.location.hash.startsWith('#details?id=')) {
                window.location.hash = user && user.role === 'admin' ? '#admin' : '#dashboard';
              }
            }
          } else if (msg.type === 'NEW_MESSAGE') {
            const newMsg = msg.payload;
            setMessages(prev => {
              const exists = prev.some(m => m._id === newMsg._id);
              if (exists) return prev;
              return [newMsg, ...prev];
            });
          }
        } catch (error) {
          console.warn('Socket message parse error:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Attempting reconnect...');
        reconnectTimeout = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedShipmentId, user]);

  // 1. User login trigger
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const code = (loginTrackingCode || loginEmail || '').trim();
    if (!code) {
      setLoginError('Please enter your tracking number or admin access key.');
      return;
    }

    try {
      setLoggingIn(true);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trackingNumber: code, 
          accessCode: code, 
          email: code,
          password: loginPassword 
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Tracking number or access code not recognized.');
      } else {
        const sessionData = {
          ...data,
          loginTimestamp: Date.now()
        };
        localStorage.setItem('apex_user', JSON.stringify(sessionData));
        setUser(sessionData);
        userRef.current = sessionData;

        if (data.role === 'admin') {
          setActiveTab('admin');
          window.location.hash = '#admin';
        } else {
          if (data.trackingNumber) {
            setSelectedShipmentId(data.trackingNumber);
            setActiveTab('details');
            window.location.hash = `#details?id=${data.trackingNumber}`;
          } else {
            setActiveTab('dashboard');
            window.location.hash = '#dashboard';
          }
        }
      }
    } catch (err) {
      setLoginError('Could not link to backend server.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('apex_user');
    setUser(null);
    userRef.current = null;
    setActiveTab('home');
    window.location.hash = '#home';
  };

  // 3. Admin shipping appointment creation
  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });

    if (!formCustomerEmail || !formCustomerName || !formOrigin || !formDestination) {
      setFormMsg({ type: 'error', text: 'Please fill in all required fields (Recipient name, email, origin, destination).' });
      return;
    }

    const waypointsArray = formRouteConfig.split('-').filter(Boolean);

    const shipmentPayload = {
      id: formTrackingId,
      senderName: formSenderName.trim(),
      senderPhone: formSenderPhone ? `${formSenderCountryCode} ${formSenderPhone}`.trim() : '',
      senderEmail: formSenderEmail.trim(),
      senderAddress: formSenderAddress.trim(),
      customerName: formCustomerName.trim(),
      customerEmail: formCustomerEmail.trim(),
      customerPhone: formCustomerPhone ? `${formCountryCode} ${formCustomerPhone}`.trim() : '+52 55 5100 0100',
      address: formAddress || 'Warehouse facility D',
      weight: parseFloat(formWeight) || 500,
      desc: formDesc || 'Commercial freight cargo items',
      vessel: formVessel,
      origin: formOrigin,
      destination: formDestination,
      originCode: formOriginCode,
      destCode: formDestCode,
      eta: formEta,
      waypoints: waypointsArray,
      internalNotes: formInternalNotes || '',
      amount: parseFloat(formAmount) || 0,
      packageImage: formUploadedImage ? formUploadedImage.base64 : '',
      startAt: formStartAt ? new Date(formStartAt).toISOString() : ''
    };

    try {
      const res = await fetch(`${API_BASE}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentPayload)
      });
      const data = await res.json();

      if (res.ok) {
        setFormMsg({ type: 'success', text: `Shipping appointment registered successfully! Tracking Code: ${data.id}` });
        if (data.credentials) {
          setCredentialsModal(data.credentials);
        }
        setSimActiveShipmentId(data.id);
        // Clear input form
        setFormSenderName('');
        setFormSenderPhone('');
        setFormSenderCountryCode('+52');
        setFormSenderEmail('');
        setFormSenderAddress('');
        setFormCustomerName('');
        setFormCustomerEmail('');
        setFormCountryCode('+52');
        setFormCustomerPhone('');
        setFormAddress('');
        setFormUploadedImage(null);
        setFormWeight('');
        setFormDesc('');
        setFormTrackingId(`AGL-${Math.floor(10000000 + Math.random() * 90000000)}`);
        setFormInternalNotes('');
        setFormAmount('');
        setFormStartAt('');
        setImageError('');
        fetchShipments();
        fetchStats();
      } else {
        setFormMsg({ type: 'error', text: data.error || 'Server rejected creation.' });
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Network connection write failure.' });
    }
  };

  const acceptImageFile = async (file) => {
    if (!file) return;
    try {
      setImageError('');
      setFormUploadedImage(await compressImage(file));
    } catch (err) {
      setImageError(err.message || 'That picture could not be used.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    await acceptImageFile(file);
  };
  const handleUpdateSimShipmentVessel = async (newVessel) => {
    if (!simActiveShipmentId) return;
    const shipment = shipments.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;
    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vessel: newVessel,
          status: shipment.status,
          currentLocationName: shipment.currentLocationName,
          simulation: {
            active: simIntervalRef.current !== null,
            currentProgress: shipment.simulation.currentProgress,
            logs: shipment.simulation.logs
          }
        })
      });
      if (res.ok) {
        fetchShipments();
      }
    } catch (e) {
      console.warn("Vessel update error:", e);
    }
  };

  const handleUpdateSimSpeed = async (newSpeed) => {
    setSimSpeed(newSpeed);
    if (!simActiveShipmentId) return;
    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            speedMultiplier: newSpeed
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(prev => prev.map(s => s.id === data.id ? data : s));
      }
    } catch (e) {
      console.warn("Speed multiplier update failed:", e);
    }
  };

  const handleAddWaypoint = async (newWp) => {
    if (!simActiveShipmentId) return;
    const shipment = shipments.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;

    let wps = [...(shipment.simulation.waypoints || [])];
    if (wps.length > 1) {
      wps.splice(wps.length - 1, 0, newWp);
    } else {
      wps.push(newWp);
    }

    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            waypoints: wps
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(prev => prev.map(s => s.id === data.id ? data : s));
      }
    } catch (e) {
      console.warn("Add waypoint failed:", e);
    }
  };

  const handleRemoveWaypoint = async (wpToRemove) => {
    if (!simActiveShipmentId) return;
    const shipment = shipments.find(s => s.id === simActiveShipmentId);
    if (!shipment) return;

    let wps = (shipment.simulation.waypoints || []).filter(wp => wp !== wpToRemove);
    if (wps.length === 0) {
      wps = [shipment.originCode || 'CHI'];
    }

    try {
      const res = await fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            waypoints: wps
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShipments(prev => prev.map(s => s.id === data.id ? data : s));
      }
    } catch (e) {
      console.warn("Remove waypoint failed:", e);
    }
  };

  // 4. Simulator Loop handlers
  const updateSimTelemetry = async (shipmentId, deltaProgress, forceLog) => {
    const shipment = shipmentsRef.current.find(s => s.id === shipmentId);
    if (!shipment) return;

    let newProgress = shipment.simulation.currentProgress + deltaProgress;
    if (newProgress > 100) newProgress = 100;
    if (newProgress < 0) newProgress = 0;

    // Compute status milestone
    let newStatus = shipment.status;
    let newLoc = shipment.currentLocationName;
    let newLog = forceLog || shipment.simulation.logs;

    if (newProgress === 0) {
      newStatus = 'Registered';
      newLoc = `Scheduled for departure at ${shipment.origin}`;
      newLog = 'Shipment details registered in terminal system database.';
    } else if (newProgress > 0 && newProgress < 30) {
      newStatus = 'Warehouse';
      newLoc = `Sorting at global distribution center ${shipment.simulation.waypoints[0] || shipment.origin}`;
      newLog = 'Passed gate check scanner; scheduled for line haul departure.';
    } else if (newProgress >= 30 && newProgress < 85) {
      newStatus = 'In Transit';
      newLoc = `En-route via ${shipment.vessel} to ${shipment.destination}`;
      if (!forceLog) {
        newLog = `Telemetry logs active. Speed multiplier: ${simSpeedRef.current}x. Vehicle coordinate shift update registered.`;
      }
    } else if (newProgress >= 85 && newProgress < 100) {
      newStatus = 'Out for Delivery';
      newLoc = `Final dispatch facility near ${shipment.simulation.waypoints[shipment.simulation.waypoints.length - 1] || shipment.destination}`;
      newLog = 'Sorted to local delivery truck. Expected to arrive today.';
    } else if (newProgress >= 100) {
      newStatus = 'Delivered';
      newLoc = `Arrived at recipient base address: ${shipment.address}`;
      newLog = 'Delivered safely. Certified signature uploaded.';
    }

    try {
      const res = await fetch(`${API_BASE}/shipments/${shipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          currentLocationName: newLoc,
          simulation: {
            active: simIntervalRef.current !== null,
            currentProgress: newProgress,
            logs: newLog
          }
        })
      });
      const data = await res.json();
      setShipments(prev => prev.map(s => s.id === data.id ? data : s));
    } catch (e) {
      console.error('Server sync telemetry failed:', e);
    }
  };

  const handleUpdateSimDuration = (hours) => {
    const validHours = Math.max(0.5, Math.min(168, Number(hours) || 72));
    setSimDurationHours(validHours);
    if (simActiveShipmentId) {
      const activeShip = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
      if (activeShip && activeShip.simulation && activeShip.simulation.active) {
        fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulation: {
              active: true,
              durationHours: validHours,
              startedAt: Date.now(),
              startProgress: activeShip.simulation.currentProgress || 0
            }
          })
        }).then(res => res.ok ? res.json() : null)
          .then(updated => {
            if (updated) {
              setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
            }
          });
      }
    }
  };

  const handleStartSim = (customHours) => {
    if (!simActiveShipmentId) return;
    const durHours = typeof customHours === 'number' ? customHours : (simDurationHoursRef.current || 72);
    const shipment = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
    const currProg = shipment?.simulation?.currentProgress || 0;
    const startProg = currProg >= 100 ? 0 : currProg;

    fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'In Transit',
        simulation: {
          active: true,
          durationHours: durHours,
          startedAt: Date.now(),
          startProgress: startProg,
          currentProgress: startProg,
          speedMultiplier: simSpeedRef.current
        }
      })
    }).then(res => res.ok ? res.json() : null)
      .then(updated => {
        if (updated) {
          setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
        }
      });

    setIsSimRunning(true);
  };

  const handlePauseSim = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimRunning(false);
    
    if (simActiveShipmentId) {
      const shipment = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
      fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation: {
            active: false,
            currentProgress: shipment?.simulation?.currentProgress || 0
          }
        })
      }).then(res => res.ok ? res.json() : null)
        .then(updated => {
          if (updated) {
            setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
          }
        });
    }
  };

  const handleStopSim = () => {
    handlePauseSim();
    if (simActiveShipmentId) {
      fetch(`${API_BASE}/shipments/${simActiveShipmentId}/simulation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Registered',
          currentLocationName: 'Grounded at origin departure port',
          simulation: {
            active: false,
            currentProgress: 0,
            startedAt: 0,
            startProgress: 0,
            logs: 'Simulator reset. Grounded in departure port.'
          }
        })
      }).then(res => res.ok ? res.json() : null)
        .then(updated => {
          if (updated) {
            setShipments(prev => prev.map(s => s.id === updated.id ? updated : s));
          }
        });
    }
  };

  // Sync active shipment simulation loop state
  useEffect(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimRunning(false);

    if (simActiveShipmentId) {
      const activeShip = shipmentsRef.current.find(s => s.id === simActiveShipmentId);
      if (activeShip && activeShip.simulation && activeShip.simulation.active) {
        const speed = activeShip.simulation.speedMultiplier || 2;
        setSimSpeed(speed);

        const interval = setInterval(() => {
          updateSimTelemetry(simActiveShipmentId, simSpeedRef.current, null);
        }, 1500);

        simIntervalRef.current = interval;
        setIsSimRunning(true);
      }
    }

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setIsSimRunning(false);
    };
  }, [simActiveShipmentId]);

  const handleShiftSim = (direction) => {
    if (!simActiveShipmentId) return;
    const offset = direction === 'forward' ? 5 : -5;
    updateSimTelemetry(simActiveShipmentId, offset, `Manual coordinate shift of ${offset}% applied by Admin override.`);
  };

  const handleHubJump = (target) => {
    if (!simActiveShipmentId) return;
    const progress = target === 'destination' ? 100 : 0;
    const logText = target === 'destination' 
      ? 'Admin triggered automated telemetry jump: Arrived at destination.' 
      : 'Admin triggered automated telemetry jump: Returned to origin airport.';
    
    // Perform bulk shift update
    updateSimTelemetry(simActiveShipmentId, target === 'destination' ? 100 : -100, logText);
  };

  // 5. Landing page hero track submit trigger
  const handleHeroTrackSubmit = async (e) => {
    e.preventDefault();
    const code = heroTrackCode.trim();
    if (!code) {
      triggerNavigationWithFlash('#login');
      return;
    }
    setLoginTrackingCode(code);
    setLoginEmail(code);
    setHeroTrackLoading(true);

    try {
      // 1. Check loaded shipments in memory
      const directMatch = shipments.find(s => s.id?.toUpperCase() === code.toUpperCase());
      if (directMatch) {
        setSelectedShipmentId(directMatch.id);
        setActiveTab('details');
        window.location.hash = `#details?id=${directMatch.id}`;
        setHeroTrackLoading(false);
        return;
      }

      // 2. Query backend API
      const res = await fetch(`${API_BASE}/shipments/${encodeURIComponent(code.toUpperCase())}`);
      const data = await res.json();
      if (res.ok && data && (data.id || data.trackingNumber)) {
        const id = data.id || data.trackingNumber;
        setSelectedShipmentId(id);
        setActiveTab('details');
        window.location.hash = `#details?id=${id}`;
        setHeroTrackLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Hero quick track query error:', err);
    } finally {
      setHeroTrackLoading(false);
    }

    // Default fallback to dedicated tracking portal
    triggerNavigationWithFlash('#login');
  };

  // 5b. Landing page quick-track box trigger
  const handleQuickTrackSubmit = (e) => {
    e.preventDefault();
    if (!searchTrackId) return;
    const target = shipments.find(s => s.id.toUpperCase() === searchTrackId.trim().toUpperCase());
    if (target) {
      window.location.hash = `#details?id=${target.id}`;
    } else {
      alert('Tracking identity code not registered in system databases.');
    }
  };

  const openEditShipment = (s) => {
    setEditError('');
    setEditForm({
      id: s.id,
      customerName: s.customerName || '',
      customerEmail: s.customerEmail || '',
      customerPhone: s.customerPhone || '',
      address: s.address || '',
      weight: s.weight ?? '',
      desc: s.desc || '',
      vessel: s.vessel || 'Truck',
      originCode: s.originCode || '',
      destCode: s.destCode || '',
      origin: s.origin || '',
      destination: s.destination || '',
      eta: s.eta || '',
      status: s.status || 'Registered',
      currentLocationName: s.currentLocationName || '',
      internalNotes: s.internalNotes || '',
      amount: s.amount ?? 0,
      paymentStatus: s.paymentStatus || 'Unpaid',
      route: ((s.simulation && s.simulation.waypoints) || []).join('-'),
      startAt: toLocalInput(s.simulation && s.simulation.startedAt > 0 ? s.simulation.startedAt : 0),
      startAtOriginal: toLocalInput(s.simulation && s.simulation.startedAt > 0 ? s.simulation.startedAt : 0),
      currentImage: imgSrc(s),
      newImage: null,
      removeImage: false
    });
  };

  const setEditField = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }));

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.customerName.trim() || !editForm.customerEmail.trim() || !editForm.origin.trim() || !editForm.destination.trim()) {
      setEditError('Customer name, email, origin and destination are required.');
      return;
    }
    const waypoints = editForm.route.split('-').map(w => w.trim()).filter(Boolean);
    const { id, route, startAt, startAtOriginal, currentImage, newImage, removeImage, ...fields } = editForm;
    const body = { ...fields, waypoints };
    if (newImage) body.packageImage = newImage;
    else if (removeImage) body.packageImage = '';
    if (startAt && startAt !== startAtOriginal) body.startAt = new Date(startAt).toISOString();
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`${API_BASE}/shipments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setShipments(prev => prev.map(s => (s.id === id ? data : s)));
        setEditForm(null);
        fetchStats();
      } else {
        setEditError(data.error || 'Failed to save changes.');
      }
    } catch (err) {
      setEditError('Failed to connect to backend server.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleTogglePaid = async (s) => {
    const next = s.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    if (!window.confirm(`Mark shipment #${s.id} as ${next}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/shipments/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: next })
      });
      const data = await res.json();
      if (res.ok) {
        setShipments(prev => prev.map(x => (x.id === s.id ? data : x)));
      } else {
        alert(data.error || 'Failed to update payment.');
      }
    } catch (err) {
      alert('Failed to connect to backend server.');
    }
  };

  const formatMoney = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDeleteShipment = async (shipmentId) => {
    if (!window.confirm(`Are you sure you want to permanently delete shipment #${shipmentId}? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/shipments/${shipmentId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShipments(prev => prev.filter(s => s.id !== shipmentId));
        if (selectedShipmentId === shipmentId) {
          setSelectedShipmentId(null);
        }
        if (simActiveShipmentId === shipmentId) {
          setSimActiveShipmentId(null);
        }
        fetchStats();
      } else {
        alert(data.error || 'Failed to delete shipment.');
      }
    } catch (err) {
      alert('Failed to connect to backend server for deletion.');
    }
  };

  const customerShipments = user && user.role === 'customer'
    ? shipments.filter(s => s.customerEmail && s.customerEmail.toLowerCase() === user.email.toLowerCase())
    : [];

  const displayedShipments = user && user.role === 'customer' ? customerShipments : shipments;

  const activeShipment = user && user.role === 'customer'
    ? customerShipments.find(s => s.id.toUpperCase() === (selectedShipmentId || '').toUpperCase())
    : shipments.find(s => s.id.toUpperCase() === (selectedShipmentId || '').toUpperCase());

  // Compute metric panels for customer
  const myTotalShipments = customerShipments.length;
  const myInTransit = customerShipments.filter(s => s.status === 'In Transit').length;
  const myDelivered = customerShipments.filter(s => s.status === 'Delivered').length;
  const myPending = customerShipments.filter(s => s.status === 'Registered' || s.status === 'Warehouse').length;

  return (
    <div>
      {isFlashing && <div className="screen-flash-overlay" />}
      {/* 🚀 Dynamic Header - Hidden on the Login Page */}
      {activeTab !== 'login' && activeTab !== 'home' && (
        user ? (
          <header className="main-header select-none">
            <button 
              className="btn-mobile-menu"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle Navigation Sidebar"
            >
              <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {mobileSidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="header-branding" onClick={() => window.location.hash = '#home'}>
              <Brand onLight />
                                        </div>

            <div className="header-search-container">
              <form className="header-search-form" onSubmit={handleQuickTrackSubmit}>
                <span className="search-icon-wrapper">
                  <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input 
                  type="text" 
                  placeholder="Track Shipment..." 
                  value={searchTrackId}
                  onChange={(e) => setSearchTrackId(e.target.value)}
                  className="header-search-input"
                />
              </form>
            </div>

            <div className="header-right-actions">
              {user.role === 'admin' ? (
                <div className="header-profile-widget">
                  <div className="profile-info-text">
                    <span className="profile-name">
                      Administrator
                    </span>
                    <span className="profile-role">
                      Fleet Manager ID: #AGL-8821
                    </span>
                  </div>
                  <img 
                    className="profile-avatar-circle" 
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80"
                    alt="User Profile" 
                  />
                </div>
              ) : (
                <div className="header-profile-widget customer">
                  <div className="profile-info-text">
                    <span className="profile-name">
                      {user.name || user.email?.split('@')[0] || 'Customer'}
                    </span>
                    <span className="profile-role">
                      Customer Portal
                    </span>
                  </div>
                  <div className="customer-avatar-badge">
                    {(user.name || user.email || 'C')[0].toUpperCase()}
                  </div>
                </div>
              )}

              {/* 🚪 Direct Header Logout Button for Instant 1-Tap Access on Mobile & Desktop */}
              <button 
                onClick={handleLogout} 
                className="header-logout-btn" 
                title="Log out of session"
              >
                <LogOut style={{ width: '15px', height: '15px' }} />
                <span className="header-logout-text">Logout</span>
              </button>
            </div>
          </header>
        ) : (
          <header className="main-header">
            <div className="header-branding" onClick={() => window.location.hash = '#home'}>
              <Brand onLight />
                                        </div>

            <div className="header-ctrls-right">
              <a href="#login" className="header-login-link">Track Shipment</a>
            </div>
          </header>
        )
      )}

      {/* 🚀 Main Core Layout Wrapper */}
      <div className="portal-wrapper">
        
        {/* Render Sidebar Navigation if logged in and not on Home or Login page */}
        {user && activeTab !== 'home' && activeTab !== 'login' && (
          <>
            {mobileSidebarOpen && (
              <div className="sidebar-mobile-backdrop" onClick={() => setMobileSidebarOpen(false)} />
            )}
            <aside className={`main-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-brand-block">
              <h1 className="sidebar-brand-name">Global Logistics</h1>
              <span className="sidebar-brand-sub">Enterprise Portal</span>
            </div>

            <nav className="sidebar-nav-links">
              {user.role === 'customer' ? (
                <>
                  <a href="#dashboard" className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}>
                    <Activity className="nav-icon" /> Dashboard
                  </a>
                  <a 
                    href="#tracking" 
                    onClick={(e) => {
                      e.preventDefault();
                      // Customers are already signed in, so open their shipment directly.
                      const target = customerShipments.find(s => s.id === selectedShipmentId) || customerShipments[0];
                      if (target) {
                        setSelectedShipmentId(target.id);
                        window.location.hash = `#details?id=${target.id}`;
                        return;
                      }
                      setCustomerTrackInput('');
                      setTrackPromptError('');
                      setShowCustomerTrackPrompt(true);
                    }}
                    className={`sidebar-link ${activeTab === 'details' || showCustomerTrackPrompt ? 'active' : ''}`}
                  >
                    <ClipboardList className="nav-icon" /> Tracking
                  </a>
                  <a href="#messages" className={`sidebar-link ${activeTab === 'messages' ? 'active' : ''}`}>
                    <MessageSquare className="nav-icon" /> Support & Messages
                    {customerUnreadCount > 0 && (
                      <span className="sidebar-badge-unread">
                        {customerUnreadCount}
                      </span>
                    )}
                  </a>
                </>
              ) : (
                <>
                  <a href="#admin" className={`sidebar-link ${activeTab === 'admin' ? 'active' : ''}`}>
                    <Activity className="nav-icon" /> Dashboard
                  </a>
                  <a href="#appointment" className={`sidebar-link ${activeTab === 'appointment' ? 'active' : ''}`}>
                    <PlusCircle className="nav-icon" /> Shipping Appointment
                  </a>
                  <a href="#tracking" className={`sidebar-link ${activeTab === 'tracking' ? 'active' : ''}`}>
                    <ClipboardList className="nav-icon" /> Shipments
                  </a>
                  <a href="#messages" className={`sidebar-link ${activeTab === 'messages' ? 'active' : ''}`}>
                    <MessageSquare className="nav-icon" /> Messages
                    {unreadCount > 0 && (
                      <span className="sidebar-badge-unread">
                        {unreadCount}
                      </span>
                    )}
                  </a>
                  <a href="#email-center" className={`sidebar-link ${activeTab === 'email-center' ? 'active' : ''}`}>
                    <Mail className="nav-icon" /> Email Center
                  </a>
                  <div className="sidebar-action-btn-container">
                    <button 
                      onClick={() => window.location.hash = '#appointment'} 
                      className="btn-sidebar-new-shipment"
                    >
                      + New Shipment
                    </button>
                  </div>
                </>
              )}
            </nav>

            <div className="sidebar-bottom-links">
              {user.role === 'admin' ? (
                <a href="#messages" className="sidebar-link bottom-link">
                  <MessageSquare className="nav-icon" /> Support Desk
                  {unreadCount > 0 && (
                    <span className="sidebar-badge-unread">{unreadCount}</span>
                  )}
                </a>
              ) : (
                <a href="#messages" className="sidebar-link bottom-link">
                  <MessageSquare className="nav-icon" /> Contact Dispatch
                  {customerUnreadCount > 0 && (
                    <span className="sidebar-badge-unread">{customerUnreadCount}</span>
                  )}
                </a>
              )}
              <button onClick={handleLogout} className="sidebar-link bottom-link btn-sidebar-logout" title="Log Out">
                <LogOut className="nav-icon" /> Logout
              </button>
            </div>
          </aside>
        </>
      )}

        {/* 🚀 Render SPA Views Routing Context */}
        <main className={`main-content ${!user ? 'full-width' : ''}`}>
          
          {/* LANDING PAGE VIEW */}
          {activeTab === 'home' && (
            <LandingPage
              heroTrackCode={heroTrackCode}
              setHeroTrackCode={setHeroTrackCode}
              heroTrackLoading={heroTrackLoading}
              handleHeroTrackSubmit={handleHeroTrackSubmit}
              goTo={triggerNavigationWithFlash}
              portalHash={user ? (user.role === 'admin' ? '#admin' : '#dashboard') : '#login'}
              portalLabel={user ? 'My Portal' : 'Track Shipment'}
            />
          )}

          {/* LOGIN VIEW */}
          {activeTab === 'login' && (
            <section className="mx-login">
              <div className="mx-login-bg" aria-hidden="true">
                <div className="mx-hero-poster" />
                <div className="mx-hero-shade" />
                <div className="mx-hero-grid" />
              </div>

              <a href="#home" className="mx-login-back">&larr; Back to site</a>

              <div className="mx-login-card">
                <Brand onClick={() => { window.location.hash = '#home'; }} />

                <span className="mx-tag dark">Secure Shipment Portal</span>
                <h2 className="mx-login-title">Track Shipment</h2>
                <p className="mx-login-tagline">Enter your tracking number to access real-time status and live GPS telemetry</p>

                {loginError && <div className="mx-login-error" role="alert">{loginError}</div>}

                <form onSubmit={handleLogin}>
                  <label className="mx-mono mx-login-label" htmlFor="tracking-code-input">ENTER TRACKING NUMBER</label>
                  <div className="mx-login-field">
                    <Package size={18} />
                    <input
                      id="tracking-code-input"
                      type="text"
                      placeholder="e.g. AGL-31518784 or Access Key"
                      value={loginTrackingCode || loginEmail}
                      onChange={(e) => {
                        setLoginTrackingCode(e.target.value);
                        setLoginEmail(e.target.value);
                      }}
                      autoFocus
                      autoComplete="off"
                      required
                    />
                  </div>
                  <p className="mx-login-hint">
                    Enter your 8-digit tracking number to view package status and live GPS telemetry.
                  </p>

                  <button type="submit" className="mx-btn mx-btn-red mx-login-submit" disabled={loggingIn}>
                    {loggingIn ? (
                      <>
                        <span className="btn-spinner" aria-label="Verifying"></span>
                        <span>Verifying Tracking Number…</span>
                      </>
                    ) : (
                      <>Track Shipment <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                <div className="mx-login-foot mx-mono">
                  <a href="#home">Support</a>
                  <a href="#home">Privacy Policy</a>
                </div>
              </div>
            </section>
          )}

          {/* CUSTOMER DASHBOARD VIEW */}
          {activeTab === 'dashboard' && user && (
            <section className="customer-dashboard">
              {/* Statistics Row */}
              <div className="dashboard-stats-row">
                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">Total Shipments</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.length : myTotalShipments}</span>
                    <span className="stat-badge-pill yellow">+12%</span>
                  </div>
                </div>
                
                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">In Transit</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.filter(s => s.status === 'In Transit').length : myInTransit}</span>
                  </div>
                  <div className="stat-card-icon-container yellow-truck">
                    <Truck style={{ width: '20px', height: '20px' }} />
                  </div>
                </div>

                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">Delivered</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.filter(s => s.status === 'Delivered').length : myDelivered}</span>
                    <span className="stat-badge-pill grey">On Time</span>
                  </div>
                </div>

                <div className="stat-card-custom">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">Pending</span>
                  </div>
                  <div className="stat-card-value-container">
                    <span className="stat-card-value">{user.role === 'admin' ? shipments.filter(s => s.status === 'Registered' || s.status === 'Warehouse').length : myPending}</span>
                  </div>
                  <div className="stat-card-icon-container">
                    <ClipboardList style={{ width: '20px', height: '20px' }} />
                  </div>
                </div>
            </div>

              {/* 💬 Customer Support & Dispatch Assistance Banner */}
              <div className="customer-support-banner" style={{
                marginTop: '22px',
                marginBottom: '26px',
                background: 'linear-gradient(135deg, #121722 0%, #171310 100%)',
                border: '1px solid rgba(255, 42, 0, 0.35)',
                borderRadius: '12px',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'rgba(255, 42, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ff2a00',
                    flexShrink: 0
                  }}>
                    <MessageSquare style={{ width: '22px', height: '22px' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                        Customer Support & Dispatch Helpdesk
                      </h4>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        ● Dispatch Online
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#cbd5e1' }}>
                      Need assistance with customs clearance, delivery reschedule, or route inquiry? Message our team directly.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {customerUnreadCount > 0 && (
                    <span style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '5px 10px',
                      borderRadius: '20px'
                    }}>
                      {customerUnreadCount} New Reply
                    </span>
                  )}
                  <button 
                    onClick={() => window.location.hash = '#messages'}
                    style={{
                      background: '#ff2a00',
                      color: '#1a130f',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      boxShadow: '0 2px 10px rgba(255, 42, 0, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <MessageSquare style={{ width: '15px', height: '15px' }} />
                    <span>{customerUnreadCount > 0 ? 'View Replies' : 'Message Dispatch'}</span>
                  </button>
                </div>
              </div>

              {/* Customer Active Shipments Section */}
              <div className="customer-shipments-section" style={{ marginTop: '25px', marginBottom: '35px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                      My Active Shipments
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Real-time live status and GPS route telemetry for your parcels.
                    </p>
                  </div>
                  {displayedShipments.length > 0 && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-color)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: '12px' }}>
                      {displayedShipments.length} Parcel{displayedShipments.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                {displayedShipments.length === 0 ? (
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '36px 20px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
                    <Package style={{ width: '40px', height: '40px', color: 'var(--primary-color)', margin: '0 auto 12px auto', display: 'block', opacity: 0.8 }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>No packages registered yet</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      When dispatch registers a shipment for {user.email}, it will appear here with live tracking telemetry.
                    </p>
                  </div>
                ) : (
                  <div className="customer-shipment-cards-grid">
                    {displayedShipments.map(s => {
                      const prog = s.simulation?.currentProgress || 0;
                      return (
                        <div key={s.id} className="customer-shipment-card" onClick={() => window.location.hash = `#details?id=${s.id}`}>
                          <div className="cust-card-top">
                            <span className="cust-tracking-id">
                              <Package style={{ width: '15px', height: '15px', color: 'var(--primary-color)' }} />
                              {s.id}
                            </span>
                            <span className={`status-pill ${s.status.toLowerCase().replace(/ /g, '-')}`}>
                              <span className="pill-dot"></span>
                              {s.status.toUpperCase()}
                            </span>
                          </div>

                          {imgSrc(s) && <img src={imgSrc(s)} alt={`Package ${s.id}`} className="cust-card-photo" loading="lazy" />}

                          <div className="cust-card-route">
                            <div className="route-node">
                              <span className="route-node-label">ORIGIN</span>
                              <span className="route-node-city">{s.origin}</span>
                            </div>
                            <div className="route-arrow-icon">→</div>
                            <div className="route-node text-right">
                              <span className="route-node-label">DESTINATION</span>
                              <span className="route-node-city">{s.destination}</span>
                            </div>
                          </div>

                          <div className="cust-card-progress-wrap">
                            <div className="progress-info-row">
                              <span>Transit Progress</span>
                              <span className="progress-pct">{Math.round(prog)}%</span>
                            </div>
                            <div className="cust-prog-bar">
                              <div className="cust-prog-fill" style={{ width: `${Math.round(prog)}%` }}></div>
                            </div>
                          </div>

                          <div className="cust-card-footer">
                            <div className="cust-eta-block">
                              <span className="eta-small-label">EST. ARRIVAL:</span>
                              <span className="eta-date-val">{s.eta || 'In Transit'}</span>
                            </div>
                            <button type="button" className="btn-track-parcel-card">
                              Track Live Map →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer attribution */}
              <footer className="portal-footer-note select-none">
                <p>© 2026 AGL Global Logistics Ltd. All rights reserved. AGL is an independent international freight and express courier provider.</p>
                <div className="portal-footer-links">
                  <a href="#dashboard" onClick={(e) => { e.preventDefault(); alert("Privacy Notice details logged under enterprise guidelines."); }}>Privacy Policy</a>
                  <a href="#dashboard" onClick={(e) => { e.preventDefault(); alert("Service terms terms & conditions registered."); }}>Terms of Use</a>
                  <a href="#dashboard" onClick={(e) => { e.preventDefault(); alert("Cookie configuration settings saved."); }}>Cookie Settings</a>
                </div>
              </footer>
            </section>
          )}

          {/* TRACKING LIST VIEW */}
          {activeTab === 'tracking' && user && user.role === 'admin' && (() => {
            const q = adminSearch.trim().toLowerCase();
            const rows = shipments.filter(s => !q || s.id.toLowerCase().includes(q));
            const th = { textAlign: 'left', padding: '14px 16px', fontSize: '0.75rem', letterSpacing: '0.08em', color: '#64748B', fontWeight: 700 };
            const td = { padding: '14px 16px', fontSize: '0.88rem', color: '#334155', borderTop: '1px solid #F1F5F9', verticalAlign: 'middle' };
            return (
              <section className="tracking-list-view">
                <div className="table-search-header">
                  <div>
                    <h2 className="tracking-title-custom">Shipments</h2>
                    <p className="tracking-subtitle-custom">Edit shipment details and confirm customer payments.</p>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Search by tracking number..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 18px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '1rem', marginBottom: '16px', background: '#fff', color: '#0F172A' }}
                />

                <div style={{ background: '#fff', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 1px 4px rgba(15,23,42,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead style={{ background: '#F8FAFC' }}>
                      <tr>
                        <th style={th}>TRACKING NUMBER</th>
                        <th style={th}>CUSTOMER</th>
                        <th style={th}>ROUTE</th>
                        <th style={th}>STATUS</th>
                        <th style={th}>AMOUNT</th>
                        <th style={th}>PAYMENT</th>
                        <th style={th}>EXPECTED DELIVERY</th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(s => {
                        const paid = s.paymentStatus === 'Paid';
                        return (
                          <tr key={s.id}>
                            <td style={{ ...td, fontWeight: 700, color: '#0F172A', cursor: 'pointer' }} onClick={() => window.location.hash = `#details?id=${s.id}`}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>{imgSrc(s) && <img src={imgSrc(s)} alt="" className="mx-thumb" loading="lazy" />}{s.id}</span></td>
                            <td style={td}>{s.customerName}<div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{s.customerEmail}</div></td>
                            <td style={td}>{s.originCode} ➔ {s.destCode}</td>
                            <td style={td}>
                              <span style={{ background: '#EEF2F7', border: '1px solid #DDE3EC', color: '#334155', borderRadius: '999px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700 }}>{s.status}</span>
                            </td>
                            <td style={{ ...td, fontWeight: 600 }}>{formatMoney(s.amount)}</td>
                            <td style={td}>
                              <button
                                onClick={() => handleTogglePaid(s)}
                                title={paid ? 'Click to mark as Unpaid' : 'Click to confirm payment received'}
                                style={{ cursor: 'pointer', borderRadius: '999px', padding: '4px 14px', fontSize: '0.8rem', fontWeight: 700,
                                  background: paid ? '#DCFCE7' : '#FEE2E2', border: `1px solid ${paid ? '#86EFAC' : '#FECACA'}`, color: paid ? '#15803D' : '#B91C1C' }}
                              >
                                {paid ? 'Paid' : 'Unpaid'}
                              </button>
                            </td>
                            <td style={td}>{s.eta}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <button
                                onClick={() => openEditShipment(s)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#EEF0F5', color: '#0b0f17', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '0.9rem', cursor: 'pointer' }}
                              >
                                <Pencil style={{ width: '14px', height: '14px' }} /> Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr><td colSpan="8" style={{ ...td, textAlign: 'center', padding: '30px' }}>No shipments found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })()}

          {activeTab === 'tracking' && user && user.role === 'customer' && (
            <section className="tracking-list-view">
              <div className="table-search-header">
                <div>
                  <h2 className="tracking-title-custom">Shipment Tracking</h2>
                  <p className="tracking-subtitle-custom">Manage and monitor {displayedShipments.length} active global shipments across your fleet.</p>
                </div>
                <div className="tracker-header-actions">
                  <button className="btn-tracker-filter" onClick={() => alert("Filter criteria: Active / Pending / Delayed.")}>
                    <SlidersHorizontal style={{ width: '15px', height: '15px', marginRight: '6px' }} /> Filters
                  </button>
                  <button className="btn-tracker-export" onClick={() => alert("Exporting 4 cargo logs as CSV...")}>
                    <Download style={{ width: '15px', height: '15px', marginRight: '6px' }} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Metrics cards row */}
              <div className="tracking-stats-row">
                <div className="track-stat-card">
                  <span className="track-stat-label">In Transit</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val">84</span>
                    <span className="track-stat-badge green">~12%</span>
                  </div>
                </div>

                <div className="track-stat-card">
                  <span className="track-stat-label">Delayed</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val text-red">06</span>
                    <span className="track-stat-badge red">▲ 2%</span>
                  </div>
                </div>

                <div className="track-stat-card">
                  <span className="track-stat-label">Delivered Today</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val">34</span>
                    <span className="track-stat-badge gray">+8</span>
                  </div>
                </div>

                <div className="track-stat-card">
                  <span className="track-stat-label">Avg. Duration</span>
                  <div className="track-stat-value-container">
                    <span className="track-stat-val">2.4d</span>
                    <span className="track-stat-badge gray">-0.2</span>
                  </div>
                </div>
              </div>

              {/* Shipment Tracking Table */}
              <div className="table-container-custom">
                <table className="portal-table-custom">
                  <thead>
                    <tr>
                      <th>TRACKING NUMBER</th>
                      <th>ORIGIN</th>
                      <th>DESTINATION</th>
                      <th>STATUS</th>
                      <th>PAYMENT</th>
                      <th>EST. DELIVERY</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedShipments.map((shipment) => {
                      let originSub = '';
                      let destSub = '';
                      
                      if (shipment.id === 'AGL-8271-4492') {
                        originSub = 'Changi Logistics Hub';
                        destSub = 'Brandenburg Facility';
                      } else if (shipment.id === 'AGL-9302-1184') {
                        originSub = 'Terminal 4 Cargo';
                        destSub = 'Heathrow Distribution';
                      } else if (shipment.id === 'AGL-7721-0032') {
                        originSub = 'Haneda Port Services';
                        destSub = "Ontario Int'l Depot";
                      } else if (shipment.id === 'AGL-1104-9923') {
                        originSub = "Al Maktoum Int'l";
                        destSub = 'Navi Mumbai Port';
                      } else {
                        originSub = 'Regional Sorting Hub';
                        destSub = 'Delivery Depot';
                      }

                      // Map status classes
                      let statusClass = 'in-transit';
                      if (shipment.status === 'Pending') statusClass = 'pending';
                      if (shipment.status === 'Delayed') statusClass = 'delayed';
                      if (shipment.status === 'Out for Delivery') statusClass = 'out-of-delivery';

                      return (
                        <tr key={shipment.id}>
                          <td className="tracking-num-cell">
                            {imgSrc(shipment) ? (
                              <img src={imgSrc(shipment)} alt="" className="mx-thumb" loading="lazy" />
                            ) : (
                              <div className="table-package-icon">
                                <Package style={{ width: '15px', height: '15px', color: '#c21d00' }} />
                              </div>
                            )}
                            <span className="bold-num">{shipment.id}</span>
                          </td>
                          <td>
                            <div className="location-cell">
                              <span className="main-city">{shipment.origin}</span>
                              <span className="sub-hub">{originSub}</span>
                            </div>
                          </td>
                          <td>
                            <div className="location-cell">
                              <span className="main-city">{shipment.destination}</span>
                              <span className="sub-hub">{destSub}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${statusClass}`}>
                              <span className="pill-dot"></span>
                              {shipment.status}
                            </span>
                          </td>
                          <td>
                            <span style={{ display: 'inline-block', borderRadius: '999px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700,
                              background: shipment.paymentStatus === 'Paid' ? '#DCFCE7' : '#FEE2E2',
                              border: `1px solid ${shipment.paymentStatus === 'Paid' ? '#86EFAC' : '#FECACA'}`,
                              color: shipment.paymentStatus === 'Paid' ? '#15803D' : '#B91C1C' }}>
                              {shipment.paymentStatus === 'Paid' ? 'Paid' : `Unpaid${shipment.amount > 0 ? ` · ${formatMoney(shipment.amount)}` : ''}`}
                            </span>
                          </td>
                          <td>
                            <div className="delivery-cell">
                              <span className="delivery-date">
                                {shipment.id === 'AGL-8271-4492' ? 'Oct 24, 2023' : 
                                 shipment.id === 'AGL-9302-1184' ? 'Oct 26, 2023' :
                                 shipment.id === 'AGL-7721-0032' ? 'Oct 22, 2023' :
                                 shipment.id === 'AGL-1104-9923' ? 'Today' : shipment.eta}
                              </span>
                              <span className={`delivery-time-info ${shipment.status === 'Delayed' ? 'text-red' : ''}`}>
                                {shipment.id === 'AGL-8271-4492' && 'by 18:00 PM'}
                                {shipment.id === 'AGL-9302-1184' && 'Scheduled'}
                                {shipment.id === 'AGL-7721-0032' && 'Overdue'}
                                {shipment.id === 'AGL-1104-9923' && 'Expected 2h'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <button 
                              className="btn-track-action-gold"
                              onClick={() => window.location.hash = `#details?id=${shipment.id}`}
                            >
                              Track
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {displayedShipments.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                          No shipments registered under this customer account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mock Pagination Footer */}
              <div className="table-pagination-row">
                <span className="pagination-info">Showing 1 to 4 of 124 shipments</span>
                <div className="pagination-pages">
                  <button className="page-nav-btn">&lt;</button>
                  <button className="page-num-btn active">1</button>
                  <button className="page-num-btn">2</button>
                  <button className="page-num-btn">3</button>
                  <button className="page-nav-btn">&gt;</button>
                </div>
              </div>

              {/* Bottom Live Fleet View Map widget */}
              <div className="live-fleet-map-section">
                <div className="fleet-map-container-relative">
                  {displayedShipments.length > 0 ? (
                    <div style={{ height: '320px', width: '100%' }}>
                      <LeafletMap shipment={displayedShipments[0]} />
                    </div>
                  ) : (
                    <div style={{ height: '320px', backgroundColor: '#e5e7eb' }}></div>
                  )}

                  {/* View Live Map overlay glass badge */}
                  <div className="fleet-map-overlay-center">
                    <button 
                      className="btn-view-live-map" 
                      onClick={() => {
                        if (displayedShipments.length > 0) {
                          window.location.hash = `#details?id=${displayedShipments[0].id}`;
                        } else {
                          alert("No shipments are currently online.");
                        }
                      }}
                    >
                      <MapPin style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                      View Live Map
                    </button>
                  </div>

                  {/* Map corner telemetry footer info */}
                  <div className="fleet-map-overlay-footer">
                    <h4>Live Fleet View</h4>
                    <p>Currently tracking 42 vehicles in North American sector.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SHIPMENT DETAILS / DYNAMIC MAP VIEW */}
          {activeTab === 'details' && (() => {
            if (!activeShipment) {
              return (
                <section className="shipment-details-view" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div className="back-nav-row" style={{ marginBottom: '30px' }}>
                    <button onClick={() => window.location.hash = '#home'} className="btn-back-link">
                      ← BACK TO LANDING PAGE
                    </button>
                  </div>
                  <div style={{ background: 'var(--card-bg, #121722)', border: '1px solid var(--border-color, #222a38)', borderRadius: '12px', padding: '40px', maxWidth: '600px', margin: '0 auto', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
                    <Package style={{ width: '48px', height: '48px', color: '#ff2a00', marginBottom: '16px' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '10px', color: '#fff' }}>
                      Loading Telemetry for Shipment #{selectedShipmentId || 'Unknown'}...
                    </h2>
                    <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '24px' }}>
                      Connecting to AGL Global Tracking database to load parcel telemetry.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <button 
                        className="btn-hero-primary"
                        style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                        onClick={() => window.location.reload()}
                      >
                        Refresh Tracking Page
                      </button>
                      <button 
                        className="btn-hero-secondary"
                        style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                        onClick={() => window.location.hash = '#home'}
                      >
                        Go to Home
                      </button>
                    </div>
                  </div>
                </section>
              );
            }

            const etaDetails = (() => {
              const eta = activeShipment.eta || '';
              if (!eta) return { date: 'Pending', time: 'Scheduled' };
              if (!/\b(by|Expected|Scheduled|Overdue)\b/.test(eta)) {
                // A plain date such as 2026-10-19 or "Oct 19, 2026"
                const when = /^\d{4}-\d{2}-\d{2}$/.test(eta) ? Date.parse(`${eta}T23:59:59`) : Date.parse(eta);
                if (Number.isFinite(when)) {
                  const pretty = new Date(when).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
                  if (activeShipment.status === 'Delivered') return { date: pretty, time: 'Delivered' };
                  return { date: pretty, time: when < Date.now() ? 'Overdue' : 'Scheduled' };
                }
              }
              const splitter = eta.includes('by') ? 'by' : eta.includes('Expected') ? 'Expected' : eta.includes('Scheduled') ? 'Scheduled' : 'Overdue';
              const parts = eta.split(splitter);
              const date = parts[0]?.trim() || 'Oct 24, 2023';
              const time = (splitter + (parts[1] || '')).trim();
              return { date, time };
            })();

            const originInfo = (() => {
              switch(activeShipment.originCode) {
                case 'SIN': return { city: 'Singapore, SG', hub: 'Changi Logistics Hub - Gate 12' };
                case 'JFK': return { city: 'New York, US', hub: 'JFK Terminal 4 Cargo' };
                case 'HND': return { city: 'Tokyo, JP', hub: 'Haneda Port Services' };
                case 'DXB': return { city: 'Dubai, AE', hub: "Al Maktoum Int'l Terminal" };
                case 'SZX': return { city: 'Shenzhen, CN', hub: 'SZX Hub - Gate 42' };
                default: return { city: activeShipment.origin || 'Origin Port', hub: 'Regional Sorting Hub' };
              }
            })();

            const destInfo = (() => {
              switch(activeShipment.destCode) {
                case 'BER': return { city: 'Berlin, DE', hub: 'Brandenburg Facility - Gate B4' };
                case 'LHR': return { city: 'London, UK', hub: 'Heathrow Distribution Hub' };
                case 'LAX': return { city: 'Los Angeles, US', hub: 'LAX Logistics Center - Dock 4' };
                case 'BOM': return { city: 'Mumbai, IN', hub: 'Navi Mumbai Port Hub' };
                default: return { city: activeShipment.destination || 'Destination Port', hub: 'Delivery Depot' };
              }
            })();

            const displayWeight = activeShipment.id === 'AGL-8271-4492' ? '1,240.50 kg' : `${(activeShipment.weight || 0).toLocaleString()} lbs`;
            const transportDesc = activeShipment.vessel === 'Plane' ? 'Express Air Freight' : activeShipment.vessel === 'Ship' ? 'Ocean Cargo Freight' : 'Expedited Ground Freight';
            const packageDesc = activeShipment.id === 'AGL-8271-4492' ? '3x Euro Pallet' : activeShipment.desc || 'Standard Freight';
            const serviceLevel = activeShipment.vessel === 'Plane' ? 'Priority Global' : activeShipment.vessel === 'Ship' ? 'Standard Economy' : 'Next-Day Ground';

            // Next update countdown dynamically relative to progress
            const progress = activeShipment.simulation ? (activeShipment.simulation.currentProgress || 0) : 0;
            const nextUpdateMins = Math.max(5, Math.round(60 - (progress % 30)));
            const displayProgress = Math.round(progress);

            // Stepper checkpoints array
            const checkpoints = [
              { label: 'Registered', date: 'Oct 18, 08:30', threshold: 0, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
              { label: 'Picked Up', date: 'Oct 19, 14:15', threshold: 15, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
              { label: 'Warehouse', date: 'Oct 19, 22:00', threshold: 30, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
              { label: 'In Transit', date: 'Oct 20, 04:45', threshold: 50, icon: <Plane style={{width:'15px', height:'15px'}} /> },
              { label: 'Customs', date: 'Expected Oct 22', threshold: 75, icon: <Users style={{width:'15px', height:'15px'}} /> },
              { label: 'Local Hub', date: 'Expected Oct 23', threshold: 90, icon: <Truck style={{width:'15px', height:'15px'}} /> },
              { label: 'Delivered', date: 'Expected Oct 24', threshold: 100, icon: <CheckCircle style={{width:'15px', height:'15px'}} /> },
            ];

            return (
              <section className="shipment-details-view">
                {/* GUEST ACCESS LOGIN BANNER */}
                {!user && (
                  <div style={{
                    background: 'linear-gradient(to right, rgba(255, 42, 0, 0.15), rgba(11, 15, 23, 0.6))',
                    border: '1px solid #ff2a00',
                    borderRadius: '8px',
                    padding: '16px 24px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '15px'
                  }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', color: '#ff2a00', fontSize: '1rem', fontWeight: '700' }}>
                        Live Email Tracking Telemetry
                      </h4>
                      <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem' }}>
                        Viewing shipment #{activeShipment.id}. Enter your tracking number on the Track Shipment page to open your Customer Portal.
                      </p>
                    </div>
                    <button 
                      className="btn-hero-primary" 
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                      onClick={() => {
                        setLoginEmail(activeShipment.customerEmail || '');
                        window.location.hash = '#login';
                      }}
                    >
                      Login to Account →
                    </button>
                  </div>
                )}

                {/* BACK NAVIGATION */}
                <div className="back-nav-row">
                  <button 
                    onClick={() => {
                      if (!user) {
                        window.location.hash = '#home';
                      } else {
                        window.location.hash = user.role === 'admin' ? '#admin' : '#dashboard';
                      }
                    }} 
                    className="btn-back-link"
                  >
                    {!user ? '← BACK TO LANDING PAGE' : user.role === 'admin' ? '← BACK TO SHIPMENTS' : '← BACK TO DASHBOARD'}
                  </button>
                </div>

                {/* DETAILS HEADER */}
                <div className="details-header-flex">
                  <h2>Shipment Details #{activeShipment.id}</h2>
                  {user?.role === 'admin' && (
                    <button className="btn-print-label" onClick={() => window.print()}>
                      <Printer style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                      Print Label
                    </button>
                  )}
                </div>

                {/* METADATA MATRIX CARD */}
                <div className="details-top-card-grid">
                  <div className="details-metadata-matrix">
                    <div className="matrix-row">
                      <div className="matrix-item">
                        <span className="matrix-label">CURRENT STATUS</span>
                        <div className="matrix-val">
                          <span className={`status-pill ${activeShipment.status.toLowerCase().replace(/ /g, '-')}`}>
                            <span className="pill-dot"></span>
                            {activeShipment.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">ESTIMATED DELIVERY</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{etaDetails.date}</strong>
                          <span className="sub-val-text">{etaDetails.time}</span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">ORIGIN</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{originInfo.city}</strong>
                          <span className="sub-val-text">{originInfo.hub}</span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">DESTINATION</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{destInfo.city}</strong>
                          <span className="sub-val-text">{destInfo.hub}</span>
                        </div>
                      </div>
                    </div>

                    <div className="matrix-separator"></div>

                    <div className="matrix-row">
                      <div className="matrix-item">
                        <span className="matrix-label">WEIGHT</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{displayWeight}</strong>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">TRANSPORT TYPE</span>
                        <div className="matrix-val transport-val">
                          {activeShipment.vessel === 'Plane' ? <Plane className="transport-icon" /> :
                           activeShipment.vessel === 'Ship' ? <Ship className="transport-icon" /> : <Truck className="transport-icon" />}
                          <span className="transport-text">{transportDesc}</span>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">PACKAGE TYPE</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{packageDesc}</strong>
                        </div>
                      </div>
                      <div className="matrix-item">
                        <span className="matrix-label">SERVICE LEVEL</span>
                        <div className="matrix-val">
                          <strong className="main-val-text">{serviceLevel}</strong>
                        </div>
                      </div>
                    </div>

                    {(activeShipment.senderName || activeShipment.customerName) && (
                      <>
                        <div className="matrix-separator"></div>
                        <div className="matrix-row">
                          <div className="matrix-item">
                            <span className="matrix-label">SENDER / SHIPPER</span>
                            <div className="matrix-val">
                              <strong className="main-val-text">{activeShipment.senderName || 'AGL Logistics Partner'}</strong>
                              {activeShipment.senderPhone && <span className="sub-val-text">{activeShipment.senderPhone}</span>}
                            </div>
                          </div>
                          <div className="matrix-item">
                            <span className="matrix-label">RECIPIENT / CONSIGNEE</span>
                            <div className="matrix-val">
                              <strong className="main-val-text">{activeShipment.customerName || 'Valued Customer'}</strong>
                              {activeShipment.customerPhone && <span className="sub-val-text">{activeShipment.customerPhone}</span>}
                            </div>
                          </div>
                          <div className="matrix-item" style={{ gridColumn: 'span 2' }}>
                            <span className="matrix-label">DELIVERY DESTINATION ADDRESS</span>
                            <div className="matrix-val">
                              <strong className="main-val-text" style={{ fontSize: '0.88rem', wordBreak: 'break-word' }}>{activeShipment.address}</strong>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {((activeShipment.simulation && activeShipment.simulation.startedAt > 0) || imgSrc(activeShipment)) && (
                      <>
                        <div className="matrix-separator"></div>
                        <div className="matrix-row">
                          {activeShipment.simulation && activeShipment.simulation.startedAt > 0 && (
                            <div className="matrix-item">
                              <span className="matrix-label">SHIPMENT START</span>
                              <div className="matrix-val">
                                <strong className="main-val-text">{new Date(activeShipment.simulation.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                                <span className="sub-val-text">{activeShipment.simulation.startedAt > Date.now() ? 'Scheduled - not yet departed' : 'Departed'}</span>
                              </div>
                            </div>
                          )}
                          {imgSrc(activeShipment) && (
                            <div className="matrix-item" style={{ gridColumn: 'span 3' }}>
                              <span className="matrix-label">PACKAGE PHOTO</span>
                              <div className="matrix-val">
                                <a href={imgSrc(activeShipment)} target="_blank" rel="noopener noreferrer">
                                  <img src={imgSrc(activeShipment)} alt={`Package ${activeShipment.id}`} className="mx-package-photo" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="next-update-progress-card">
                    <span className="update-label">NEXT UPDATE IN</span>
                    <h2 className="countdown-val">{nextUpdateMins}<span>m</span></h2>
                    
                    <div className="progress-footer-block">
                      <div className="progress-label-row">
                        <span>JOURNEY PROGRESS</span>
                        <span>{displayProgress}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${displayProgress}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEPPER MILESTONES CARD */}
                <div className="milestones-stepper-card">
                  <h3 className="stepper-section-title">Shipment Milestones</h3>
                  
                  <div className="stepper-horizontal-container">
                    <div className="stepper-track-line">
                      <div className="stepper-track-fill" style={{ width: `${Math.min(100, Math.max(0, (progress / 100) * 100))}%` }}></div>
                    </div>
                    
                    <div className="stepper-nodes-row">
                      {checkpoints.map((cp, idx) => {
                        const isCompleted = progress >= cp.threshold;
                        const isActive = idx === 0 
                          ? (progress < 15)
                          : idx === 6
                            ? (progress >= 100)
                            : (progress >= cp.threshold && progress < checkpoints[idx + 1].threshold);
                            
                        let statusClass = 'pending';
                        if (isCompleted) statusClass = 'completed';
                        if (isActive) statusClass = 'active';

                        return (
                          <div className={`step-node-col ${statusClass}`} key={idx}>
                            <div className="step-badge-circle">
                              {isCompleted && !isActive ? <span className="check-mark-symbol">✓</span> : cp.icon}
                            </div>
                            <span className="step-node-label">{cp.label}</span>
                            <span className="step-node-date">{cp.date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* BOTTOM MAP & LIVE STATUS CONTAINER */}
                <div className="details-map-live-section">
                  <div className="details-map-side-wrapper">
                    <LeafletMap shipment={activeShipment} />
                    
                    {/* Floating Legend Overlay */}
                    <div className="map-legend-footer">
                      <div className="legend-item"><span className="legend-dot express"></span> Express</div>
                      <div className="legend-item"><span className="legend-dot ground"></span> Ground</div>
                      <div className="legend-item"><span className="legend-dot ports"></span> Ports</div>
                    </div>

                    {/* Floating Live Status Card */}
                    <div className="live-status-floating-card">
                      <div className="live-status-card-header">
                        <span className="red-pulse-indicator"></span>
                        <h4>Live Status</h4>
                      </div>

                      <div className="live-status-body">
                        <div className="live-status-item">
                          <span className="live-item-label">CURRENT LOCATION</span>
                          <span className="live-item-val">{activeShipment.currentLocationName || 'Mid-Pacific Operations Area'}</span>
                        </div>
                        <div className="live-status-item">
                          <span className="live-item-label">LAST UPDATED</span>
                          <span className="live-item-val">12 Minutes ago</span>
                        </div>
                        <div className="live-status-item">
                          <span className="live-item-label">ESTIMATED SPEED</span>
                          <span className="live-item-val">
                            {activeShipment.vessel === 'Plane' ? '854 km/h' : activeShipment.vessel === 'Ship' ? '42 km/h' : '85 km/h'}
                          </span>
                        </div>
                        <div className="live-status-item">
                          <span className="live-item-label">EST. ARRIVAL HUB</span>
                          <span className="live-item-val">Tomorrow, 06:00 AM</span>
                        </div>
                      </div>

                      {/* Expandable Logs Button */}
                      <button 
                        className="btn-toggle-tracking-logs"
                        onClick={(e) => {
                          e.preventDefault();
                          const panel = document.getElementById('floating-logs-panel');
                          if (panel) {
                            panel.classList.toggle('visible');
                          }
                        }}
                      >
                        Full Tracking Logs <span className="down-arrow-symbol">▼</span>
                      </button>

                      {/* Collapsed Logs Drawer Area */}
                      <div id="floating-logs-panel" className="floating-logs-drawer">
                        <div className="logs-feed">
                          <div className="log-entry">
                            <div className="log-point"></div>
                            <div className="log-text-block">
                              <span className="log-time">LIVE UPDATES</span>
                              <p className="log-message">{activeShipment.simulation?.logs || 'Tracking telemetry initialized.'}</p>
                            </div>
                          </div>
                          <div className="log-entry">
                            <div className="log-point grey"></div>
                            <div className="log-text-block">
                              <span className="log-time">SYSTEM HISTORY</span>
                              <p className="log-message">Global route coordinates interpolated successfully. Hub sequence: {activeShipment.simulation?.waypoints ? activeShipment.simulation.waypoints.join(' → ') : 'CHI → DEN → SEA'}.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* ADMIN DASHBOARD VIEW */}
          {activeTab === 'admin' && user && user.role === 'admin' && (
            <section className="admin-dashboard-view">
              <div className="admin-dashboard-header">
                <h2>Admin Dashboard</h2>
                <p className="admin-dashboard-subtitle">Overview of global operations and customer activity.</p>
              </div>

              {/* Status Metrics Cards Grid */}
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">TOTAL CUSTOMERS</span>
                    <span className="stat-badge green-trend">Active</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.customers ?? 0}</h3>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">TOTAL SHIPMENTS</span>
                    <span className="stat-badge green-trend">Registered</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.shipments ?? 0}</h3>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">IN TRANSIT</span>
                    <span className="stat-badge orange-badge">Live</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.transit ?? 0}</h3>
                </div>

                <div className="admin-stat-card">
                  <div className="stat-header-flex">
                    <span className="stat-card-label">DELIVERED</span>
                    <span className="stat-badge green-badge">Done</span>
                  </div>
                  <h3 className="stat-card-number">{stats?.metrics?.delivered ?? 0}</h3>
                </div>
              </div>

              {/* Main Panel Grid */}
              <div className="admin-panels-grid">
                
                {/* Recent Shipments Directory */}
                <div className="admin-panel-shipments">
                  <div className="panel-header-row">
                    <h3>Recent Shipments</h3>
                    <a href="#tracking" className="panel-link-btn">View All</a>
                  </div>

                  <div className="admin-table-wrapper">
                    <table className="admin-dashboard-table">
                      <thead>
                        <tr>
                          <th>SHIPMENT ID</th>
                          <th>ORIGIN / DESTINATION</th>
                          <th>STATUS</th>
                          <th>DATE</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipments.slice(0, 4).map(s => {
                          const dateStr = s.createdAt 
                            ? new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Oct 30, 2023';
                          
                          let statusClass = 'in-transit';
                          if (s.status === 'Delivered') statusClass = 'delivered';
                          if (s.status === 'Registered' || s.status === 'Warehouse') statusClass = 'pending';
                          if (s.status === 'Delayed') statusClass = 'delayed';

                          return (
                            <tr key={s.id}>
                              <td className="shipment-id-cell" onClick={() => window.location.hash = `#details?id=${s.id}`}>
                                {imgSrc(s) ? <img src={imgSrc(s)} alt="" className="mx-thumb" loading="lazy" /> : <Package className="table-row-pkg-icon" />}
                                <span className="bold-id-text">{s.id}</span>
                              </td>
                              <td>
                                <div className="route-cell">
                                  <span className="route-cities">{s.origin} to {s.destination}</span>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span className="route-codes">{s.originCode} ➔ {s.destCode}</span>
                                    {s.senderName && (
                                      <span style={{ fontSize: '0.75rem', color: '#ff2a00' }}>
                                        From: {s.senderName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill ${statusClass}`}>
                                  <span className="pill-dot"></span>
                                  {s.status}
                                </span>
                              </td>
                              <td className="date-cell">{dateStr}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button 
                                    className="btn-tracker-filter" 
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem', background: 'rgba(255, 42, 0, 0.08)', border: '1px solid rgba(255, 42, 0, 0.3)', color: '#ff2a00' }}
                                    onClick={() => {
                                      setSimActiveShipmentId(s.id);
                                      window.location.hash = '#appointment';
                                    }}
                                    title="Control Live Simulation"
                                  >
                                    <Activity style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Simulate</span>
                                  </button>
                                  <button
                                    className="btn-tracker-filter"
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem', background: 'rgba(11, 15, 23, 0.08)', border: '1px solid rgba(11, 15, 23, 0.3)', color: '#0b0f17' }}
                                    onClick={() => openEditShipment(s)}
                                    title="Edit Shipment Details"
                                  >
                                    <Pencil style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Edit</span>
                                  </button>
                                  <button
                                    className="btn-tracker-filter"
                                    style={{ padding: '6px 10px', height: 'auto', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                                    onClick={() => handleDeleteShipment(s.id)}
                                    title="Permanently Delete Tracking"
                                  >
                                    <Trash style={{ width: '13px', height: '13px' }} />
                                    <span style={{ marginLeft: '4px' }}>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {shipments.length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                              No active database rows registered in shipments cluster.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Bottom Real-time Monitoring Map */}
              <div className="admin-monitoring-section">
                <div className="monitoring-header">
                  <div className="monitoring-title-flex">
                    <h3>Fleet Real-time Monitoring</h3>
                    <div className="live-badge-glow">
                      <span className="glow-dot"></span>
                      <span>Live Updates</span>
                    </div>
                  </div>
                </div>

                <div className="monitoring-map-wrapper">
                  {shipments.length > 0 ? (
                    <LeafletMap shipment={shipments[0]} />
                  ) : (
                    <div style={{ height: '350px', backgroundColor: '#E9ECF2', borderRadius: '12px' }}></div>
                  )}

                  {/* Fleet velocity overlay card */}
                  <div className="fleet-velocity-overlay-card">
                    <span className="velocity-label">FLEET VELOCITY</span>
                    <h4 className="velocity-value">94.2% Efficiency</h4>
                    
                    {/* Simulated visual bar graph */}
                    <div className="velocity-bars-visual">
                      <div className="v-bar" style={{ height: '14px' }}></div>
                      <div className="v-bar" style={{ height: '24px' }}></div>
                      <div className="v-bar" style={{ height: '18px' }}></div>
                      <div className="v-bar yellow" style={{ height: '32px' }}></div>
                      <div className="v-bar" style={{ height: '20px' }}></div>
                      <div className="v-bar" style={{ height: '28px' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SHIPPING APPOINTMENT VIEW */}
          {activeTab === 'appointment' && user && user.role === 'admin' && (() => {
            const selectedShipmentForSim = shipments.find(s => s.id === simActiveShipmentId);
            const selectedShipmentSimProg = selectedShipmentForSim?.simulation?.currentProgress || 0;
            const selectedShipmentSimVessel = selectedShipmentForSim?.vessel || 'Truck';
            
            let selectedShipmentSimProgressCoords = { lat: 39.8283, lng: -98.5795 };
            if (selectedShipmentForSim && selectedShipmentForSim.simulation && selectedShipmentForSim.simulation.waypoints && selectedShipmentForSim.simulation.waypoints.length > 0) {
              const wps = selectedShipmentForSim.simulation.waypoints;
              const progress = selectedShipmentSimProg / 100;
              const totalSegments = wps.length - 1;
              if (totalSegments > 0) {
                const segmentProgress = progress * totalSegments;
                const index = Math.min(Math.floor(segmentProgress), totalSegments - 1);
                const frac = segmentProgress - index;
                const startHubName = wps[index];
                const endHubName = wps[index + 1];
                const startCoords = GPS_COORDINATES[startHubName] || [34.05, -118.24];
                const endCoords = GPS_COORDINATES[endHubName] || [40.71, -74.00];
                selectedShipmentSimProgressCoords = {
                  lat: startCoords[0] + (endCoords[0] - startCoords[0]) * frac,
                  lng: startCoords[1] + (endCoords[1] - startCoords[1]) * frac
                };
              } else if (wps.length === 1) {
                const singleCoords = GPS_COORDINATES[wps[0]] || [39.8283, -98.5795];
                selectedShipmentSimProgressCoords = { lat: singleCoords[0], lng: singleCoords[1] };
              }
            }
            
            let selectedShipmentSimEtaString = '0h 0m';
            if (selectedShipmentForSim) {
              const remainingFraction = (100 - selectedShipmentSimProg) / 100;
              const totalMinutesSim = selectedShipmentSimVessel === 'Plane' ? 180 : selectedShipmentSimVessel === 'Ship' ? 1440 : 480;
              const remainingMinutes = Math.max(0, Math.round(totalMinutesSim * remainingFraction));
              const hours = Math.floor(remainingMinutes / 60);
              const mins = remainingMinutes % 60;
              selectedShipmentSimEtaString = `${hours}h ${mins}m`;
            }
            
            return (
              <section className="shipping-appointment-view">
                <div className="appointment-page-container">
                  {/* Page Header Area */}
                  <div className="appointment-header-section">
                    <div className="appointment-breadcrumb">
                      <span>Shipments</span>
                      <svg className="breadcrumb-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      <span className="active">New Registration</span>
                    </div>

                    <div className="appointment-title-row">
                      <div className="title-left">
                        <h2>Register Customer Shipment</h2>
                        <p className="appointment-subtitle">Populate details to generate tracking and logistical scheduling.</p>
                      </div>
                      <div className="title-actions">
                        <button type="button" className="btn-discard-draft" onClick={() => {
                          if (window.confirm("Are you sure you want to discard this draft?")) {
                            setFormSenderName('');
                            setFormSenderCountryCode('+52');
                            setFormSenderPhone('');
                            setFormSenderEmail('');
                            setFormSenderAddress('');
                            setFormCustomerName('');
                            setFormCustomerEmail('');
                            setFormCountryCode('+52');
                            setFormCustomerPhone('');
                            setFormAddress('');
                            setFormWeight('');
                            setFormDesc('');
                            setFormVessel('Truck');
                            setFormOrigin('Mexico City (CDMX) Central Hub, Mexico');
                            setFormOriginCode('MEX');
                            setFormDestination('Monterrey Industrial Center, Nuevo León');
                            setFormDestCode('MTY');
                            setFormRouteConfig('MEX-QRO-SLP-MTY');
                          }
                        }}>Discard Draft</button>
                        
                        <button type="button" className="btn-submit-registration" onClick={handleCreateShipment}>Submit Registration</button>
                      </div>
                    </div>
                  </div>

                  {formMsg.text && (
                    <div className={formMsg.type === 'success' ? 'success-banner mb-20' : 'error-banner mb-20'}>
                      {formMsg.text}
                    </div>
                  )}

                  {/* Main Grid split layout */}
                  <div className="appointment-form-grid">
                    {/* Left Column: Sender Info, Customer Info & Shipment Details */}
                    <div className="appointment-form-left-col">
                      {/* Sender Information Card */}
                      <div className="appointment-card mb-24">
                        <div className="card-header">
                          <Send className="card-header-icon" />
                          <h3>Sender Information</h3>
                        </div>
                        
                        <div className="card-body">
                          <div className="form-double-row">
                            <div className="input-field">
                              <label>SENDER FULL NAME / COMPANY</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Carlos Mendoza / Guadalajara Freight S.A."
                                value={formSenderName}
                                onChange={(e) => setFormSenderName(e.target.value)}
                              />
                            </div>
                            <div className="input-field">
                              <label>SENDER EMAIL ADDRESS</label>
                              <input 
                                type="email" 
                                placeholder="e.g. sender@logistics.com"
                                value={formSenderEmail}
                                onChange={(e) => setFormSenderEmail(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="form-double-row mt-15">
                            <div className="input-field">
                              <label>SENDER PHONE NUMBER</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  type="text" 
                                  placeholder="+52"
                                  value={formSenderCountryCode}
                                  onChange={(e) => setFormSenderCountryCode(e.target.value)}
                                  style={{ width: '70px', textAlign: 'center' }}
                                />
                                <input 
                                  type="tel" 
                                  placeholder="e.g. 33 1234 5678"
                                  value={formSenderPhone}
                                  onChange={(e) => setFormSenderPhone(e.target.value)}
                                  style={{ flex: 1 }}
                                />
                              </div>
                            </div>
                            <div className="input-field">
                              <label>SENDER ORIGIN ADDRESS / HUB</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Av. Vallarta 1400, Guadalajara, Jalisco"
                                value={formSenderAddress}
                                onChange={(e) => setFormSenderAddress(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Customer / Recipient Information Card */}
                      <div className="appointment-card">
                        <div className="card-header">
                          <Users className="card-header-icon" />
                          <h3>Recipient / Consignee Information</h3>
                        </div>
                        
                        <div className="card-body">
                          <div className="form-double-row">
                            <div className="input-field">
                              <label>RECIPIENT FULL NAME</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Maria Gonzalez"
                                value={formCustomerName}
                                onChange={(e) => setFormCustomerName(e.target.value)}
                              />
                            </div>
                            <div className="input-field">
                              <label>RECIPIENT EMAIL ADDRESS</label>
                              <input 
                                type="email" 
                                placeholder="e.g. customer@domain.com"
                                value={formCustomerEmail}
                                onChange={(e) => setFormCustomerEmail(e.target.value)}
                              />
                            </div>
                          </div>
                          
                          <div className="form-double-row mt-15">
                            <div className="input-field">
                              <label>RECIPIENT PHONE NUMBER</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                  type="text" 
                                  placeholder="+52"
                                  value={formCountryCode}
                                  onChange={(e) => setFormCountryCode(e.target.value)}
                                  style={{ width: '70px', textAlign: 'center' }}
                                />
                                <input 
                                  type="tel" 
                                  placeholder="e.g. 55 9876 5432"
                                  value={formCustomerPhone}
                                  onChange={(e) => setFormCustomerPhone(e.target.value)}
                                  style={{ flex: 1 }}
                                />
                              </div>
                            </div>
                            <div className="input-field">
                              <label>DELIVERY DESTINATION ADDRESS</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Av. Insurgentes Sur 120, CDMX, Mexico"
                                value={formAddress}
                                onChange={(e) => setFormAddress(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Shipment Details Card */}
                      <div className="appointment-card mt-24">
                        <div className="card-header">
                          <Package className="card-header-icon" />
                          <h3>Shipment Details</h3>
                        </div>
                        
                        <div className="card-body">
                          <div className="form-triple-row">
                            <div className="input-field">
                              <label>TRACKING NUMBER</label>
                              <div className="tracking-number-badge-input">
                                <span className="tracking-number-code">{formTrackingId}</span>
                                <button type="button" className="btn-copy-tracking" onClick={() => {
                                  navigator.clipboard.writeText(formTrackingId);
                                  alert("Copied tracking ID to clipboard!");
                                }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px'}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                              </div>
                            </div>
                            
                            <div className="input-field">
                              <label>SHIPMENT TYPE</label>
                              <select className="custom-select" value={formShipmentType} onChange={(e) => setFormShipmentType(e.target.value)}>
                                <option value="Standard">Standard Freight</option>
                                <option value="Express">Express Deliveries</option>
                                <option value="Priority">Priority Air Cargo</option>
                              </select>
                            </div>
                            
                            <div className="input-field">
                              <label>TRANSPORT TYPE</label>
                              <div className="transport-type-btn-group">
                                <button 
                                  type="button" 
                                  className={`transport-btn ${formVessel === 'Truck' ? 'active' : ''}`}
                                  onClick={() => setFormVessel('Truck')}
                                >
                                  <Truck style={{width: '18px', height: '18px'}} />
                                </button>
                                <button 
                                  type="button" 
                                  className={`transport-btn ${formVessel === 'Plane' ? 'active' : ''}`}
                                  onClick={() => setFormVessel('Plane')}
                                >
                                  <Plane style={{width: '18px', height: '18px'}} />
                                </button>
                                <button 
                                  type="button" 
                                  className={`transport-btn ${formVessel === 'Ship' ? 'active' : ''}`}
                                  onClick={() => setFormVessel('Ship')}
                                >
                                  <Ship style={{width: '18px', height: '18px'}} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="form-double-row mt-15">
                            <div className="input-field">
                              <label>ORIGIN CITY / HUB</label>
                              <CitySearchInput
                                value={formOrigin}
                                selectedCode={formOriginCode}
                                placeholder="Search origin city/state in Mexico, USA, Europe (e.g. Mexico City, Guadalajara, CDMX)..."
                                onChange={(cityName, code) => {
                                  setFormOrigin(cityName);
                                  if (code) {
                                    setFormOriginCode(code);
                                    if (formDestCode && code !== formDestCode) {
                                      const autoRoute = calculateOptimalRoute(code, formDestCode);
                                      setFormRouteConfig(autoRoute.join('-'));
                                    }
                                  }
                                }}
                              />
                            </div>
                            
                            <div className="input-field">
                              <label>DESTINATION CITY / HUB</label>
                              <CitySearchInput
                                value={formDestination}
                                selectedCode={formDestCode}
                                placeholder="Search destination city/state in Mexico, USA, Europe (e.g. Monterrey, Tijuana, Cancun)..."
                                onChange={(cityName, code) => {
                                  setFormDestination(cityName);
                                  if (code) {
                                    setFormDestCode(code);
                                    if (formOriginCode && formOriginCode !== code) {
                                      const autoRoute = calculateOptimalRoute(formOriginCode, code);
                                      setFormRouteConfig(autoRoute.join('-'));
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className="form-triple-row mt-15">
                            <div className="input-field">
                              <label>WEIGHT (KG)</label>
                              <input 
                                type="number" 
                                placeholder="0.00"
                                value={formWeight}
                                onChange={(e) => setFormWeight(e.target.value)}
                              />
                            </div>
                            
                            <div className="input-field">
                              <label>AMOUNT TO PAY ($)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={formAmount}
                                onChange={(e) => setFormAmount(e.target.value)}
                              />
                            </div>

                            <div className="input-field">
                              <label>EST. DELIVERY</label>
                              <input 
                                type="date" 
                                value={formEta}
                                onChange={(e) => setFormEta(e.target.value)}
                              />
                            </div>

                            <div className="input-field">
                              <label>INITIAL STATUS</label>
                              <select className="custom-select" value={formInitialStatus} onChange={(e) => setFormInitialStatus(e.target.value)}>
                                <option value="Manifest Prepared">Manifest Prepared</option>
                                <option value="In Transit">In Transit</option>
                                <option value="Warehouse">Warehouse arrival</option>
                                <option value="Out for Delivery">Out for Delivery</option>
                              </select>
                            </div>
                          </div>

                          <div className="input-field mt-15">
                            <label>SHIPMENT START DATE &amp; TIME (OPTIONAL)</label>
                            <input
                              type="datetime-local"
                              value={formStartAt}
                              onChange={(e) => setFormStartAt(e.target.value)}
                            />
                            <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              The shipment starts moving automatically at this time and reaches its destination on the estimated delivery date. Leave empty to start it yourself later.
                            </span>
                          </div>

                          <div className="input-field mt-15">
                            <label>CONTENT DESCRIPTION</label>
                            <textarea 
                              rows="3" 
                              placeholder="Describe the items being shipped for insurance and customs..."
                              value={formDesc}
                              onChange={(e) => setFormDesc(e.target.value)}
                            />
                          </div>
                          
                          <div className="input-field mt-15">
                            <label>OPTIMAL ROUTE & WAYPOINTS</label>
                            <div className="route-sequence-editor">
                              <div className="route-sequence-header">
                                <div className="route-sequence-title">
                                  <Compass style={{ width: '15px', height: '15px', color: '#ff2a00' }} />
                                  Smart Checkpoint Sequence
                                </div>
                                <div className="route-auto-badge">
                                  <CheckCircle style={{ width: '12px', height: '12px' }} />
                                  Auto-Calculated
                                </div>
                              </div>

                              {/* Interactive Route Chips Flow */}
                              <div className="route-chips-flow">
                                {(formRouteConfig ? formRouteConfig.split('-').filter(Boolean) : []).map((code, idx, arr) => {
                                  const isStart = idx === 0;
                                  const isEnd = idx === arr.length - 1 && arr.length > 1;
                                  const cityObj = CITIES_DATA.find(c => c.code === code);
                                  return (
                                    <React.Fragment key={`${code}-${idx}`}>
                                      <div className={`route-node-chip ${isStart ? 'start' : isEnd ? 'end' : 'waypoint'}`}>
                                        <span>{cityObj ? `${cityObj.flag || ''} ${code}` : code}</span>
                                        {!isStart && !isEnd && (
                                          <span 
                                            className="route-chip-remove" 
                                            title="Remove checkpoint"
                                            onClick={() => {
                                              const newArr = arr.filter((_, i) => i !== idx);
                                              setFormRouteConfig(newArr.join('-'));
                                            }}
                                          >
                                            ×
                                          </span>
                                        )}
                                      </div>
                                      {idx < arr.length - 1 && <span className="route-arrow-sep">➔</span>}
                                    </React.Fragment>
                                  );
                                })}
                              </div>

                              {/* Manual Override & Waypoint Controls */}
                              <div className="route-manual-edit-row">
                                <input 
                                  type="text" 
                                  className="route-raw-input"
                                  placeholder="e.g. LAX-DEN-STL-JFK"
                                  value={formRouteConfig}
                                  onChange={(e) => setFormRouteConfig(e.target.value.toUpperCase())}
                                  title="Manually edit waypoint sequence"
                                />
                                
                                <select 
                                  className="add-waypoint-select"
                                  value=""
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const currentWps = formRouteConfig ? formRouteConfig.split('-').filter(Boolean) : [];
                                    if (currentWps.length > 1) {
                                      currentWps.splice(currentWps.length - 1, 0, e.target.value);
                                    } else {
                                      currentWps.push(e.target.value);
                                    }
                                    setFormRouteConfig(currentWps.join('-'));
                                  }}
                                >
                                  <option value="">+ Add Waypoint</option>
                                  {CITIES_DATA.map(c => (
                                    <option key={c.code} value={c.code}>
                                      {c.flag} {c.code} - {c.name}
                                    </option>
                                  ))}
                                </select>

                                <button 
                                  type="button" 
                                  className="route-recalc-btn"
                                  title="Recalculate best route based on Origin & Destination"
                                  onClick={() => {
                                    if (formOriginCode && formDestCode) {
                                      const autoRoute = calculateOptimalRoute(formOriginCode, formDestCode);
                                      setFormRouteConfig(autoRoute.join('-'));
                                    }
                                  }}
                                >
                                  <RefreshCw style={{ width: '13px', height: '13px' }} />
                                  Recalculate Route
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Upload Image & Internal Notes */}
                    <div className="appointment-form-right-col">
                      {/* Package Image Card */}
                      <div className="appointment-card">
                        <div className="card-header">
                          <svg className="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px', height: '20px'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <h3>Package Image</h3>
                        </div>
                        
                        <div className="card-body">
                          <div 
                            className="upload-dropzone" 
                            onClick={() => document.getElementById('package-image-upload').click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                            onDragLeave={() => setIsDraggingImage(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDraggingImage(false); acceptImageFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
                            style={{ cursor: 'pointer', borderColor: isDraggingImage ? '#ff2a00' : undefined, background: isDraggingImage ? 'rgba(255,42,0,0.06)' : undefined }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-cloud-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span className="dropzone-text">Click to upload or drag & drop</span>
                            <span className="dropzone-sub">PNG, JPG or WEBP - resized automatically</span>
                            <input 
                              type="file" 
                              id="package-image-upload" 
                              style={{ display: 'none' }} 
                              accept="image/*"
                              onChange={handleImageUpload}
                            />
                          </div>
                          
                          {formUploadedImage ? (
                            <div className="uploaded-files-list">
                              <div className="file-list-item">
                                <img 
                                  className="file-preview-img-icon" 
                                  src={formUploadedImage.base64} 
                                  alt="shipment box" 
                                  style={{width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover'}} 
                                />
                                <div className="file-item-meta">
                                  <span className="file-item-name">{formUploadedImage.name}</span>
                                  <span className="file-item-size">{formUploadedImage.size} &bull; Ready</span>
                                </div>
                                <button 
                                  type="button" 
                                  className="btn-delete-file" 
                                  onClick={() => setFormUploadedImage(null)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '15px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                              No package photo uploaded yet.
                            </div>
                          )}
                          {imageError && <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '8px' }}>{imageError}</div>}
                        </div>
                      </div>

                      {/* Internal Notes Card */}
                      <div className="appointment-card mt-24">
                        <div className="card-header">
                          <svg className="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px', height: '20px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <h3>Internal Notes</h3>
                        </div>
                        
                        <div className="card-body">
                          <textarea 
                            rows="5" 
                            placeholder="Add administrative notes, route exceptions, or specific handling instructions..." 
                            value={formInternalNotes}
                            onChange={(e) => setFormInternalNotes(e.target.value)}
                          />
                          <div className="notes-privacy-banner">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="lock-icon" style={{width: '12px', height: '12px'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <span>These notes are only visible to AGL staff.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Panel: Live Tracking Simulation */}
                  <div className="appointment-simulation-panel mt-24">
                    <div className="sim-panel-header">
                      <div className="header-left">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pulse-icon"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        <div className="sim-panel-titles">
                          <h3>Live Tracking Simulation</h3>
                          <span className="sim-panel-subtitle">PREVIEW LOGISTICS PIPELINE BEFORE COMMIT</span>
                        </div>
                      </div>
                      <div className="header-right">
                        <div className="sim-pill-group">
                          <span className="sim-pill active">REAL-TIME</span>
                          <span className="sim-pill">SIMULATED</span>
                        </div>
                        <button type="button" className="btn-fullscreen-toggle" onClick={() => alert("Simulation Fullscreen Mode Enabled")}>FULL SCREEN</button>
                      </div>
                    </div>
                    
                    <div className="sim-panel-content-split">
                      {/* Map Column */}
                      <div className="sim-panel-map-col">
                        {selectedShipmentForSim ? (
                          <LeafletMap shipment={selectedShipmentForSim} />
                        ) : (
                          <div style={{ height: '400px', backgroundColor: 'var(--mx-ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', borderRadius: '8px' }}>
                            No active shipment selected for simulation. Select a shipment from the sidebar on the right.
                          </div>
                        )}
                        
                        {/* Floating Telemetry Screen on Map */}
                        {selectedShipmentForSim && (
                          <div className="map-sim-telemetry-badge">
                            <span className="telemetry-title">SIMULATION TELEMETRY</span>
                            
                            <div className="telemetry-row">
                              <span className="tel-lbl">Speed:</span>
                              <span className="tel-val gold">{selectedShipmentSimVessel === 'Plane' ? '820 km/h' : selectedShipmentSimVessel === 'Ship' ? '35 km/h' : '85 km/h'}</span>
                            </div>
                            <div className="telemetry-row">
                              <span className="tel-lbl">Coordinates:</span>
                              <span className="tel-val">{selectedShipmentSimProgressCoords?.lat?.toFixed(4)}&deg;N, {selectedShipmentSimProgressCoords?.lng?.toFixed(4)}&deg;W</span>
                            </div>
                            <div className="telemetry-row">
                              <span className="tel-lbl">ETA:</span>
                              <span className="tel-val">{selectedShipmentSimEtaString}</span>
                            </div>
                            
                            <div className="telemetry-progress-track">
                              <div className="telemetry-progress-fill" style={{ width: `${selectedShipmentSimProg}%` }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Controller Column */}
                      <div className="sim-panel-controls-col">
                        <div className="controller-section">
                          <span className="section-label">PATH SETUP</span>
                          
                          <div className="control-group">
                            <label>SELECT SHIPMENT TO TELEMETER</label>
                            <select 
                              className="sim-shipment-select"
                              value={simActiveShipmentId} 
                              onChange={(e) => setSimActiveShipmentId(e.target.value)}
                            >
                              <option value="">-- Select Shipment --</option>
                              {shipments.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.id} ({s.customerName} - {s.vessel}){s.senderName ? ` [From: ${s.senderName}]` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="control-group mt-10">
                            <label>ORDER HUB</label>
                            <div className="mock-control-input-read">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', color: '#ff2a00'}}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                              <span>{selectedShipmentForSim?.originCode || 'MEX'}</span>
                            </div>
                          </div>
                          
                          <div className="control-group mt-10">
                            <label>WAYPOINTS</label>
                            <div className="waypoints-flex-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                              {selectedShipmentForSim?.simulation?.waypoints?.map((wp, idx) => (
                                <span key={idx} className="wp-badge" style={{
                                  background: 'rgba(255, 42, 0, 0.1)',
                                  border: '1px solid var(--primary-color)',
                                  color: 'var(--primary-color)',
                                  padding: '2.5px 7px',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontWeight: '500'
                                }}>
                                  {wp}
                                  {selectedShipmentForSim?.simulation?.waypoints?.length > 1 && (
                                    <span 
                                      onClick={() => handleRemoveWaypoint(wp)} 
                                      style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '2px', color: '#ff4d4d' }}
                                      title="Remove waypoint"
                                    >
                                      &times;
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                            <select 
                              className="sim-waypoint-select custom-select" 
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddWaypoint(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              style={{
                                width: '100%',
                                background: 'var(--bg-secondary)',
                                color: 'var(--mx-ink)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                padding: '6px',
                                fontSize: '0.85rem'
                              }}
                            >
                              <option value="">-- Add Waypoint --</option>
                              {Object.keys(GPS_COORDINATES)
                                .filter(code => !selectedShipmentForSim?.simulation?.waypoints?.includes(code))
                                .map(code => {
                                  const cInfo = CITIES_DATA.find(c => c.code === code);
                                  return (
                                    <option key={code} value={code}>
                                      {cInfo ? `${cInfo.flag} ${code} - ${cInfo.name}` : code}
                                    </option>
                                  );
                                })
                              }
                            </select>
                          </div>

                          <div className="control-group mt-10">
                            <label>DESTINATION HUB</label>
                            <div className="mock-control-input-read">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px', height: '14px', color: '#ff4d4d'}}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                              <span>{selectedShipmentForSim?.destCode || 'MTY'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="controller-section mt-15">
                          <span className="section-label">SIMULATION MODE</span>
                          <div className="simulation-mode-icons-row">
                            <button 
                              type="button" 
                              className={`sim-mode-btn ${selectedShipmentSimVessel === 'Truck' ? 'active' : ''}`}
                              onClick={() => handleUpdateSimShipmentVessel('Truck')}
                            >
                              <Truck style={{width: '16px', height: '16px'}} />
                              <span>Truck</span>
                            </button>
                            <button 
                              type="button" 
                              className={`sim-mode-btn ${selectedShipmentSimVessel === 'Plane' ? 'active' : ''}`}
                              onClick={() => handleUpdateSimShipmentVessel('Plane')}
                            >
                              <Plane style={{width: '16px', height: '16px'}} />
                              <span>Plane</span>
                            </button>
                            <button 
                              type="button" 
                              className={`sim-mode-btn ${selectedShipmentSimVessel === 'Ship' ? 'active' : ''}`}
                              onClick={() => handleUpdateSimShipmentVessel('Ship')}
                            >
                              <Ship style={{width: '16px', height: '16px'}} />
                              <span>Ship</span>
                            </button>
                          </div>
                        </div>

                        <div className="controller-section mt-15">
                          <div className="slider-header-flex">
                            <span className="section-label">SIMULATION SPEED</span>
                            <span className="speed-val-badge">x{simSpeed}.0</span>
                          </div>
                          <input 
                            type="range" 
                            className="sim-speed-range-slider"
                            min="1" 
                            max="10" 
                            value={simSpeed}
                            onChange={(e) => handleUpdateSimSpeed(parseInt(e.target.value))}
                          />
                        </div>

                        {/* 🕒 Autonomous Delivery Duration & Schedule (Up to 7 Days / 1 Week) */}
                        <div className="controller-section mt-15">
                          <div className="slider-header-flex">
                            <span className="section-label">AUTONOMOUS DELIVERY SCHEDULE</span>
                            <span className="speed-val-badge">
                              {simDurationHours >= 24 ? `${(simDurationHours / 24).toFixed(1)} Days` : `${simDurationHours} Hours`}
                            </span>
                          </div>

                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                            Select target delivery duration up to 7 days (1 week). Progresses automatically 24/7 on the server even when logged out or offline!
                          </p>

                          {/* Quick Duration Preset Pills */}
                          <div className="sim-duration-pill-row">
                            {[
                              { label: '1 Hr', hours: 1 },
                              { label: '6 Hrs', hours: 6 },
                              { label: '12 Hrs', hours: 12 },
                              { label: '1 Day', hours: 24 },
                              { label: '2 Days', hours: 48 },
                              { label: '3 Days', hours: 72 },
                              { label: '5 Days', hours: 120 },
                              { label: '7 Days (1 Wk)', hours: 168 }
                            ].map(preset => (
                              <button
                                key={preset.hours}
                                type="button"
                                className={`sim-duration-pill ${Math.abs(simDurationHours - preset.hours) < 0.1 ? 'active' : ''}`}
                                onClick={() => handleUpdateSimDuration(preset.hours)}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          {/* Custom Hours / Days Stepper */}
                          <div className="sim-days-input-wrap mt-10">
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                              CUSTOM TRANSIT WINDOW:
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '5px' }}>
                              <input
                                type="number"
                                min="0.5"
                                max="168"
                                step={durationUnit === 'days' ? '0.25' : '1'}
                                value={durationUnit === 'days' ? +(simDurationHours / 24).toFixed(2) : simDurationHours}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1;
                                  const hours = durationUnit === 'days' ? val * 24 : val;
                                  handleUpdateSimDuration(hours);
                                }}
                                style={{
                                  flex: 1,
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--mx-ink)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '0.85rem'
                                }}
                              />
                              <div className="unit-toggle-group" style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                <button
                                  type="button"
                                  onClick={() => setDurationUnit('hours')}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    border: 'none',
                                    background: durationUnit === 'hours' ? 'var(--primary-color)' : 'transparent',
                                    color: durationUnit === 'hours' ? '#fff' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: durationUnit === 'hours' ? 'bold' : 'normal'
                                  }}
                                >
                                  Hours
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDurationUnit('days')}
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    border: 'none',
                                    background: durationUnit === 'days' ? 'var(--primary-color)' : 'transparent',
                                    color: durationUnit === 'days' ? '#fff' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontWeight: durationUnit === 'days' ? 'bold' : 'normal'
                                  }}
                                >
                                  Days
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Calculated Speed & ETA Card */}
                          <div className="sim-calculation-card mt-10">
                            <div className="calc-row">
                              <span className="calc-label">Progression Velocity:</span>
                              <span className="calc-val">
                                ~{(100 / simDurationHours).toFixed(2)}% / hr ({((100 / simDurationHours) / 60).toFixed(4)}% / min)
                              </span>
                            </div>
                            <div className="calc-row">
                              <span className="calc-label">Estimated Arrival (ETA):</span>
                              <span className="calc-val highlight">
                                {new Date(Date.now() + simDurationHours * 3600 * 1000).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="calc-row server-status-row">
                              <span className="calc-label">24/7 Autonomous Engine:</span>
                              {selectedShipmentForSim?.simulation?.active ? (
                                <span className="autonomous-badge active">
                                  <span className="pulse-dot"></span> 24/7 SERVER RUNNING
                                </span>
                              ) : (
                                <span className="autonomous-badge idle">STANDBY / READY</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="controller-section mt-15">
                          <span className="section-label">PLAYBACK CONTROLS</span>
                          
                          <div className="playback-grid-buttons">
                            <button 
                              type="button" 
                              className={`btn-play-ctrl start ${isSimRunning ? 'active' : ''}`}
                              onClick={handleStartSim}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                              <span>START</span>
                            </button>
                            
                            <button 
                              type="button" 
                              className={`btn-play-ctrl pause ${!isSimRunning && selectedShipmentSimProg > 0 ? 'active' : ''}`}
                              onClick={handlePauseSim}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                              <span>PAUSE</span>
                            </button>
                            
                            <button 
                              type="button" 
                              className="btn-play-ctrl reset"
                              onClick={handleStopSim}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                              <span>RESET</span>
                            </button>
                            
                            <button 
                              type="button" 
                              className="btn-play-ctrl stop"
                              onClick={() => {
                                handlePauseSim();
                                handleHubJump('origin');
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}><rect x="4" y="4" width="16" height="16"/></svg>
                              <span>STOP</span>
                            </button>
                          </div>

                          <div className="playback-navigation-row mt-12">
                            <button className="btn-jump-step" onClick={() => handleShiftSim('backward')}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                            </button>
                            <span className="jump-txt">JUMP TO LOC</span>
                            <button className="btn-jump-step" onClick={() => handleShiftSim('forward')}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '12px', height: '12px'}}><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                            </button>
                          </div>

                          <div className="control-group mt-15">
                            <label>UPDATE STATUS OVERRIDE</label>
                            <select className="override-select" value={selectedShipmentForSim?.status || 'Manifest Prepared'} onChange={(e) => {
                              if (selectedShipmentForSim) {
                                fetch(`${API_BASE}/shipments/${selectedShipmentForSim.id}/simulation`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: e.target.value })
                                })
                                .then(() => fetchShipments());
                              }
                            }}>
                              <option value="Manifest Prepared">Manual Position Update</option>
                              <option value="Warehouse">Warehouse Arrival</option>
                              <option value="In Transit">In Transit</option>
                              <option value="Out for Delivery">Out for Delivery</option>
                              <option value="Delivered">Delivered</option>
                            </select>
                          </div>
                        </div>

                        <button type="button" className="btn-save-tracking-config" onClick={() => alert("Simulation Config Saved!")}>
                          Save Tracking Config
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </section>
            );
          })()}

          {activeTab === 'email-center' && user?.role === 'admin' && (
            <EmailCenterView shipments={shipments} API_BASE={API_BASE} />
          )}

          {activeTab === 'messages' && (
            user?.role === 'admin' ? (
              <MessagesView 
                messages={messages} 
                API_BASE={API_BASE} 
                onMarkRead={async (email) => {
                  try {
                    await fetch(`${API_BASE}/messages/read`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerEmail: email, readerRole: 'admin' })
                    });
                    setMessages(prev => prev.map(m => (m.customerEmail === email && m.sender === 'customer') ? { ...m, read: true } : m));
                  } catch (e) {
                    console.error('Failed marking messages read:', e);
                  }
                }}
              />
            ) : (
              <CustomerSupportView 
                user={user}
                messages={messages} 
                API_BASE={API_BASE} 
                onMarkRead={async (email) => {
                  try {
                    await fetch(`${API_BASE}/messages/read`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerEmail: email, readerRole: 'customer' })
                    });
                    setMessages(prev => prev.map(m => (m.customerEmail === email && m.sender === 'admin') ? { ...m, read: true } : m));
                  } catch (e) {
                    console.error('Failed marking customer messages read:', e);
                  }
                }}
                onMessageSent={(newMsg) => {
                  setMessages(prev => {
                    const exists = prev.some(m => m._id === newMsg._id);
                    if (exists) return prev;
                    return [newMsg, ...prev];
                  });
                }}
              />
            )
          )}

        </main>
      </div>
      {editForm && user && user.role === 'admin' && (() => {
        const inputStyle = { width: '100%', padding: '9px 10px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', background: '#fff', color: '#0F172A' };
        const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', fontWeight: 600, color: '#475569' };
        const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '12px' };
        const f = editForm;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '16px' }}>
            <form onSubmit={handleSaveEdit} style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', color: '#0F172A' }}>
              <h3 style={{ margin: '0 0 4px' }}>Edit Shipment #{f.id}</h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748B' }}>Changes are saved immediately and show on the customer's tracking page.</p>

              <div style={grid}>
                <label style={labelStyle}>Customer Name
                  <input style={inputStyle} value={f.customerName} onChange={e => setEditField('customerName', e.target.value)} />
                </label>
                <label style={labelStyle}>Customer Email
                  <input style={inputStyle} type="email" value={f.customerEmail} onChange={e => setEditField('customerEmail', e.target.value)} />
                </label>
                <label style={labelStyle}>Customer Phone
                  <input style={inputStyle} value={f.customerPhone} onChange={e => setEditField('customerPhone', e.target.value)} />
                </label>
                <label style={labelStyle}>Delivery Address
                  <input style={inputStyle} value={f.address} onChange={e => setEditField('address', e.target.value)} />
                </label>
                <label style={labelStyle}>Weight (kg)
                  <input style={inputStyle} type="number" step="any" value={f.weight} onChange={e => setEditField('weight', e.target.value)} />
                </label>
                <label style={labelStyle}>Transport Type
                  <select style={inputStyle} value={f.vessel} onChange={e => setEditField('vessel', e.target.value)}>
                    <option value="Truck">Truck</option>
                    <option value="Plane">Plane</option>
                    <option value="Ship">Ship</option>
                  </select>
                </label>
              </div>

              <label style={{ ...labelStyle, marginBottom: '12px' }}>Cargo Description
                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={f.desc} onChange={e => setEditField('desc', e.target.value)} />
              </label>

              <div style={grid}>
                <div style={labelStyle}>Origin City / Hub
                  <CitySearchInput
                    value={f.origin}
                    selectedCode={f.originCode}
                    placeholder="Search origin city / hub..."
                    onChange={(cityName, code) => setEditForm(prev => ({
                      ...prev,
                      origin: cityName,
                      ...(code ? { originCode: code, route: code !== prev.destCode ? calculateOptimalRoute(code, prev.destCode).join('-') : prev.route } : {})
                    }))}
                  />
                </div>
                <div style={labelStyle}>Destination City / Hub
                  <CitySearchInput
                    value={f.destination}
                    selectedCode={f.destCode}
                    placeholder="Search destination city / hub..."
                    onChange={(cityName, code) => setEditForm(prev => ({
                      ...prev,
                      destination: cityName,
                      ...(code ? { destCode: code, route: code !== prev.originCode ? calculateOptimalRoute(prev.originCode, code).join('-') : prev.route } : {})
                    }))}
                  />
                </div>
                <label style={labelStyle}>Route Waypoints
                  <input style={inputStyle} placeholder="e.g. LHR-EMA-MAN-EDI" value={f.route} onChange={e => setEditField('route', e.target.value)} />
                </label>
                <label style={labelStyle}>Estimated Delivery (ETA)
                  <input style={inputStyle} value={f.eta} onChange={e => setEditField('eta', e.target.value)} />
                </label>
                <label style={labelStyle}>Amount to Pay ($)
                  <input style={inputStyle} type="number" min="0" step="0.01" value={f.amount} onChange={e => setEditField('amount', e.target.value)} />
                </label>
                <label style={labelStyle}>Payment Status
                  <select style={inputStyle} value={f.paymentStatus} onChange={e => setEditField('paymentStatus', e.target.value)}>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </label>
                <label style={labelStyle}>Status
                  <select style={inputStyle} value={f.status} onChange={e => setEditField('status', e.target.value)}>
                    {[...new Set(['Registered', 'Manifest Prepared', 'Warehouse', 'In Transit', 'Delayed', 'Delivered', f.status])].map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>Current Location
                  <input style={inputStyle} value={f.currentLocationName} onChange={e => setEditField('currentLocationName', e.target.value)} />
                </label>
                <label style={labelStyle}>Shipment Start (date &amp; time)
                  <input style={inputStyle} type="datetime-local" value={f.startAt} onChange={e => setEditField('startAt', e.target.value)} />
                </label>
              </div>

              <div style={{ ...labelStyle, marginBottom: '12px' }}>
                Package Photo
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {(f.newImage || (f.currentImage && !f.removeImage)) ? (
                    <img src={f.newImage || f.currentImage} alt="Package" style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #CBD5E1' }} />
                  ) : (
                    <div style={{ width: '96px', height: '96px', borderRadius: '12px', border: '1px dashed #CBD5E1', display: 'grid', placeItems: 'center', color: '#94A3B8', fontSize: '0.72rem' }}>No photo</div>
                  )}
                  <label style={{ padding: '9px 16px', borderRadius: '999px', border: '1px solid #CBD5E1', background: '#F1F5F9', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', color: '#0B0F17' }}>
                    {(f.newImage || f.currentImage) && !f.removeImage ? 'Replace photo' : 'Upload photo'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const r = await compressImage(file);
                          setEditForm(prev => ({ ...prev, newImage: r.base64, removeImage: false }));
                          setEditError('');
                        } catch (err) {
                          setEditError(err.message || 'That picture could not be used.');
                        }
                      }}
                    />
                  </label>
                  {(f.newImage || (f.currentImage && !f.removeImage)) && (
                    <button type="button" onClick={() => setEditForm(prev => ({ ...prev, newImage: null, removeImage: true }))} style={{ padding: '9px 16px', borderRadius: '999px', border: '1px solid #FBC9C0', background: '#FEECEA', color: '#C21D00', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <label style={{ ...labelStyle, marginBottom: '12px' }}>Internal Notes
                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={f.internalNotes} onChange={e => setEditField('internalNotes', e.target.value)} />
              </label>

              {editError && <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '12px' }}>{editError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setEditForm(null)} disabled={editSaving} style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F1F5F9', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={editSaving} style={{ padding: '9px 18px', borderRadius: '6px', border: 'none', background: '#ff2a00', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        );
      })()}
      {credentialsModal && (
        <div className="credentials-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="credentials-modal" style={{
            background: 'var(--card-bg, #121722)',
            border: '1px solid var(--primary-color, #ff2a00)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '440px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'var(--text-primary, #ffffff)',
            animation: 'fadeInCode 0.25s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                background: 'rgba(255, 42, 0, 0.1)',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <i className="fas fa-key" style={{ color: '#ff2a00', fontSize: '18px' }}></i>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ff2a00' }}>Shipment Tracking Created</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #cccccc)', marginBottom: '16px', lineHeight: '1.4' }}>
              Share the tracking number below with your customer. They enter it on the Track Shipment page to see live status, the route map and the package photo.
            </p>

            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid #22c55e',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#4ade80',
              fontSize: '0.85rem',
              fontWeight: '600',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>ℹ️ No email was sent. Share the tracking number yourself, or use the Email Center to message <strong>{credentialsModal.email}</strong>.</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Customer Login Tracking ID</label>
                <div style={{ display: 'flex', background: 'var(--bg-secondary, #0b0f17)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{credentialsModal.trackingId}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.trackingId);
                      alert("Tracking ID copied!");
                    }} 
                    style={{ background: 'none', border: 'none', color: '#ff2a00', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Username / Email</label>
                <div style={{ display: 'flex', background: 'var(--bg-secondary, #0b0f17)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace' }}>{credentialsModal.email}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(credentialsModal.email);
                      alert("Email copied!");
                    }} 
                    style={{ background: 'none', border: 'none', color: '#ff2a00', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4', marginTop: '4px' }}>
                ℹ️ No password required. Entering this Tracking ID (<strong>{credentialsModal.trackingId}</strong>) on the Track Shipment page will open the live shipment dashboard directly.
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setCredentialsModal(null)} 
                style={{
                  background: 'linear-gradient(135deg, #ff2a00 0%, #d91f00 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                CONFIRM & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showCustomerTrackPrompt && (
        <div className="credentials-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <form className="credentials-modal" onSubmit={(e) => {
            e.preventDefault();
            if (!customerTrackInput.trim()) {
              setTrackPromptError('Please enter a tracking number.');
              return;
            }
            const target = customerShipments.find(s => s.id.trim().toUpperCase() === customerTrackInput.trim().toUpperCase());
            if (target) {
              setShowCustomerTrackPrompt(false);
              setSelectedShipmentId(target.id);
              window.location.hash = `#details?id=${target.id}`;
            } else {
              setTrackPromptError('Tracking ID not found in your account.');
            }
          }} style={{
            background: 'var(--card-bg, #121722)',
            border: '1px solid var(--primary-color, #ff2a00)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'var(--text-primary, #ffffff)',
            animation: 'fadeInCode 0.25s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                background: 'rgba(255, 42, 0, 0.1)',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#ff2a00" strokeWidth="2.5" style={{width: '20px', height: '20px'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#ff2a00' }}>Track Your Shipment</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #cccccc)', marginBottom: '20px', lineHeight: '1.4' }}>
              Please enter your 8-digit tracking ID number to view live simulation path updates, ETA checkpoints, and status notifications.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tracking Number</label>
              <input 
                type="text"
                value={customerTrackInput}
                onChange={(e) => {
                  setCustomerTrackInput(e.target.value);
                  setTrackPromptError('');
                }}
                placeholder="e.g. AGL-31518784"
                style={{
                  width: '100%',
                  background: 'var(--bg-secondary, #0b0f17)',
                  border: '1px solid var(--border-color, #444)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              {trackPromptError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px' }}>
                  {trackPromptError}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={() => setShowCustomerTrackPrompt(false)}
                style={{
                  background: 'none',
                  color: 'var(--text-secondary, #cccccc)',
                  border: '1px solid var(--border-color, #444)',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                CANCEL
              </button>
              <button 
                type="submit" 
                style={{
                  background: 'linear-gradient(135deg, #ff2a00 0%, #d91f00 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                TRACK SHIPMENT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
