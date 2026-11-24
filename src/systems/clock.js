import { CITY } from "../config.js";

// City clock (live India time, with Morning/Day/Evening/Night overrides and a
// "24h in 60s" timelapse) and live weather + air quality from Open-Meteo (free, no key).
const PRESETS = { Morning: 8, Day: 13, Evening: 18.5, Night: 22 };
const MOOD = {
  Morning: "Morning: joggers at Sarita Udyan, chai and fafda, the sectors wake up slowly.",
  Day: "Day: Infocity and GIFT City are busy, campus canteens are full.",
  Evening: "Evening: everyone heads out. Lake Garden fills up, Akshardham lights come on.",
  Night: "Night: quiet green roads, late chai near the campuses.",
};

export function istHour() {
  const d = new Date();
  const utc = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return (utc + 5.5) % 24;
}
export function periodOf(h) {
  return h >= 5 && h < 11 ? "Morning" : h >= 11 && h < 17 ? "Day" : h >= 17 && h < 21 ? "Evening" : "Night";
}
export function fmtHour(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function createClock() {
  let mode = "live"; // live | preset | lapse
  let preset = 13, lapseStart = 0, lapseFrom = 0;
  const weather = { temp: null, wind: null, aqi: null, code: null, loaded: false };

  function hour() {
    if (mode === "preset") return preset;
    if (mode === "lapse") {
      const t = (performance.now() - lapseStart) / 1000;
      if (t >= 60) { mode = "live"; return istHour(); }
      return (lapseFrom + (t / 60) * 24) % 24;
    }
    return istHour();
  }

  async function loadWeather() {
    const { lat, lon } = CITY.weatherPoint;
    try {
      const [w, a] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`).then((r) => r.json()),
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`).then((r) => r.json()),
      ]);
      weather.temp = Math.round(w.current?.temperature_2m);
      weather.wind = Math.round(w.current?.wind_speed_10m);
      weather.code = w.current?.weather_code;
      weather.aqi = Math.round(a.current?.us_aqi);
      weather.loaded = true;
    } catch { weather.loaded = false; }
    return weather;
  }

  return {
    hour,
    get mode() { return mode; },
    get period() { return periodOf(hour()); },
    setLive() { mode = "live"; },
    setPreset(name) { mode = "preset"; preset = PRESETS[name]; },
    timelapse() { mode = "lapse"; lapseStart = performance.now(); lapseFrom = hour(); },
    mood() { return MOOD[periodOf(hour())]; },
    weather,
    loadWeather,
    weatherText() {
      if (!weather.loaded) return "Weather unavailable right now";
      const t = weather.temp;
      const feel = t >= 38 ? "Bahu garmi, paani pee lo" : t >= 33 ? "Garmi che" : t <= 14 ? "Thandi che, shawl lai lo" : "Mausam mast che";
      return `${t}°C · ${feel} · pavan ${weather.wind} km/h`;
    },
    aqiText() {
      const q = weather.aqi;
      if (q == null || Number.isNaN(q)) return "";
      const say = q <= 50 ? "Hawa saras che" : q <= 100 ? "Hawa theek che" : q <= 150 ? "Hawa kharab, mask lai lo" : "Hawa bahu kharab, bahar ochhu nikalo";
      return `AQI ${q} · ${say}`;
    },
  };
}
