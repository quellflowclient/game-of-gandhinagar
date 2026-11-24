import { CITY } from "../config.js";

// City clock (live India time, with Morning/Day/Evening/Night overrides and a
// "24h in 60s" timelapse) and live weather + air quality from Open-Meteo (free, no key).
const PRESETS = { Morning: 8, Day: 13, Evening: 18.5, Night: 22 };
const MOOD = {
  Morning: "Morning: a walk around LDRP, fresh chai and the campus waking up.",
  Day: "Day: explore the campus roads, gardens and KH-5 food stalls.",
  Evening: "Evening: stop for chai near LDRP or walk through Mahatma Mandir as the lights come on.",
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
// Offline astronomical fallback for Gujarat; API sunrise/sunset replace this
// when available. UTC date comes from IST, independent of the device timezone.
export function solarTimes(date=new Date(),lat=CITY.weatherPoint.lat,lon=CITY.weatherPoint.lon){
 const local=new Date(date.getTime()+5.5*3600000),year=local.getUTCFullYear(),n=Math.floor((Date.UTC(year,local.getUTCMonth(),local.getUTCDate())-Date.UTC(year,0,0))/86400000),b=2*Math.PI*(n-81)/364;
 const eot=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b),decl=23.45*Math.PI/180*Math.sin(2*Math.PI*(284+n)/365),phi=lat*Math.PI/180;
 const angle=Math.acos(Math.max(-1,Math.min(1,(Math.sin(-.833*Math.PI/180)-Math.sin(phi)*Math.sin(decl))/(Math.cos(phi)*Math.cos(decl)))))*180/Math.PI;
 const noon=12+(82.5-lon)/15-eot/60;return{sunrise:noon-angle/15,sunset:noon+angle/15};
}

export function createClock() {
  let mode = "live"; // live | preset | lapse
  let preset = 13, lapseStart = 0, lapseFrom = 0;
  const weather = { temp: null, wind: null, aqi: null, code: null, loaded: false,updatedAt:null,stale:false,solar:null };

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
    const json=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Weather unavailable');return r.json();};
    const [w,a]=await Promise.allSettled([
      json(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&daily=sunrise,sunset&forecast_days=1&timezone=Asia%2FKolkata`),
      json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`)
    ]);
    if(w.status==='fulfilled'&&Number.isFinite(w.value.current?.temperature_2m)){
      const data=w.value;weather.temp=Math.round(data.current.temperature_2m);weather.wind=Number.isFinite(data.current.wind_speed_10m)?Math.round(data.current.wind_speed_10m):null;weather.code=data.current.weather_code;weather.loaded=true;weather.stale=false;weather.updatedAt=data.current.time;
      const hour=s=>{const parts=s?.slice(11,16).split(':').map(Number);return parts?.length===2?parts[0]+parts[1]/60:NaN;};
      const sunrise=hour(data.daily?.sunrise?.[0]),sunset=hour(data.daily?.sunset?.[0]);if(Number.isFinite(sunrise)&&Number.isFinite(sunset))weather.solar={sunrise,sunset,date:data.daily.time[0]};
    }else{weather.stale=weather.loaded;}
    weather.aqi=a.status==='fulfilled'&&Number.isFinite(a.value.current?.us_aqi)?Math.round(a.value.current.us_aqi):null;
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
    get solar(){const today=new Date(Date.now()+19800000).toISOString().slice(0,10);return weather.solar?.date===today?weather.solar:solarTimes();},
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
