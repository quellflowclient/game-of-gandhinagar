import { h } from "./dom.js";
import {gameIcon} from './game-icons.js';
import './city-actions.css';

// Heads-up display, "Hariyali" design: frosted green glass, marigold accents, a live
// mini-map, an arrival banner, a labelled dock. `open(name)` opens a panel; `act(name)`
// runs an action.
export function createHud({ open, act }) {
  const root = h("div", { id: "hud" });
  const ibtn = (icon, label, aria, onclick, cls = "") =>
    h("button", { type: "button", class: cls, "aria-label": aria, title: aria, onclick }, h("span", { class: "i" }, icon), label ? h("span", { class: "l" }, label) : null);

  // ---- top left: where am I, time and weather ----
  const placeName = h("div", { class: "pc-name" }, "Gandhinagar");
  const placeGu = h("div", { class: "pc-gu" }, "ગાંધીનગર");
  const timeChip = h("button", { type: "button", class: "pc-time", onclick: () => open("time"), "aria-label": "Time and weather" }, "☀ --:--");
  const placeCard = h("div", { class: "place-card glass" }, h("div", { class: "pc-dot" }), h("div", { class: "pc-txt" }, placeName, placeGu), timeChip);

  const topLeft = h("div", { class: "hud-tl" }, placeCard);

  // Profile identity lives in the utility menu.
  const meAv = h("span", { class: "me-av" }, "🙂");

  // ---- right: mini-map ----
  const miniCanvas = h("canvas", { width: 280, height: 280 });
  const minimap = h("button", { type: "button", class: "minimap", "aria-label": "Open the city map (L)", onclick: () => open("map") }, miniCanvas, h("span", { class: "n" }, "N"));

  // ---- bottom right: actions ----
  const cycleBtn = ibtn("🚲", null, "Choose ride: walk, cycle, auto or car (C)", () => act("cycle"), "fab cycle");
  const runBtn = ibtn('🏃',null,'Toggle running',()=>{const on=act('run');runBtn.setAttribute('aria-pressed',String(on));},'fab run');
  runBtn.setAttribute('aria-pressed','false');
  const jumpBtn=ibtn('↑','Jump','Jump (Space)',()=>act('jump'),'fab jump');
  const actions = h("div", { class: "hud-actions" }, runBtn,jumpBtn);
  const carQuick=ibtn('🚗','Car','Choose car',()=>act('ride:car'),'ride-shortcut');
  const autoQuick=ibtn('🛺','Rickshaw','Choose rickshaw',()=>act('ride:auto'),'ride-shortcut');
  const exitRide=ibtn('↗','Exit','Stop and leave vehicle',()=>act('ride:walk'),'ride-shortcut ride-exit');exitRide.hidden=true;
  cycleBtn.className='ride-shortcut ride-more';cycleBtn.replaceChildren(h('span',{class:'i'},'＋'),h('span',{class:'l'},'Rides'));
  const rideBar=h('nav',{class:'quick-rides','aria-label':'Choose a vehicle'},carQuick,autoQuick,cycleBtn,exitRide);
  let lastRide=null;
  const speed=h('div',{class:'vehicle-speed glass',hidden:true,'aria-live':'off'}),area=h('div',{class:'play-area-label glass',hidden:true},'LDRP · KH-5 · STALLS');
  const boundaryHint=h('div',{class:'area-boundary-hint glass',hidden:true,role:'status'},'Area ends here · Use Metro for other locations');
  const cameraBtn=ibtn('◉',null,'Camera view',()=>open('camera'),'fab camera-view');

  const joystick = h("div", { class: "joystick",role:'group','aria-label':'Movement joystick. Drag to walk, push to outer ring to run.' }, h("div", { class: "knob" }),h('span',{class:'joy-label'},'WALK · RUN'));
  const hint = h("div", { class: "hint glass" }, h("b", {}, "Kem cho! "), "Move with WASD or the joystick · drag to look around · tap a name to say hi");
  setTimeout(() => hint.classList.add("fade"), 3500);

  const context = h("div", { class: "context" });
  const nearBtn = h("button", { type: "button", class: "ctx glass", hidden: true, onclick: () => act("nearest") });
  const interactBtn = h("button", { type: "button", class: "ctx glass green", hidden: true, onclick: () => act("interact") });
  context.append(nearBtn, interactBtn);

  // The three everyday actions stay outside the grouped utility menu.
  const quickButton=(icon,label,aria,onclick)=>h('button',{type:'button',class:`city-action city-action-${icon}`,'aria-label':aria,title:aria,onclick},h('span',{class:'city-action-icon',html:gameIcon(icon)}),h('span',{class:'city-action-label'},label));
  const waveQuick=quickButton('wave','Wave','Wave and say hi (Q)',()=>act('wave'));
  const metroQuick=quickButton('metro','Metro','Travel by metro (M)',()=>open('travel'));
  const chatQuick=quickButton('chat','Chat','Open chat (T)',()=>open('world'));
  const chatsBadge = h("span", { class: "badge quick-chat-badge", hidden: true });chatQuick.append(chatsBadge);
  const quickActions=h('nav',{class:'city-quick-actions','aria-label':'Wave, metro and chat'},waveQuick,metroQuick,chatQuick);
  const greeting=h('div',{class:'player-greeting',hidden:true,role:'status','aria-live':'polite'},h('span',{html:gameIcon('wave')}),h('strong',{},'Hi!'));
  let greetingTimer=0;
  const unread={chats:0,world:0};
  const dock = h("nav", { class: "hub-launcher", "aria-label":"Game navigation" },
    h('button',{type:'button',class:'hub-toggle','aria-label':'Open game menu','aria-haspopup':'dialog',title:'Menu',onclick:()=>toggleMore()},h('span',{class:'i',html:gameIcon('menu')})));

  // Grouped, trimmed menu. Every entry opens a real, working panel.
  const MENU = [
    ["You", [["🙂","Profile","profile"],["🪪","Campus ID","campus"],["🪞","AI twin","twin"]]],
    ["People", [["🤝","Private chats","chats"],["🔍","Find people","find"],["👥","Online now","online"]]],
    ["Explore", [["🗺","City map","map"],["🚗","Choose ride","vehicles"]]],
    ["Settings", [["✥","Controls","controls"],["◉","Camera","camera"],["🔊","Sound","sound"],["🕒","Time & weather","time"],["⛶","Fullscreen","fullscreen"]]],
  ];
  const moreBadges = {};
  const more = h("div", { class: "more glass city-menu", hidden: true, id:"game-hub", role: "dialog", 'aria-modal':'true', "aria-label": "Game menu" },
    h("div", { class: "more-head" },h('div',{},h('small',{class:'menu-kicker'},'GANDHINAGAR'),h("b", {}, "Your city"),h('p',{class:'menu-description'},'People, places & settings')), h("button", { type: "button", class: "x", "aria-label": "Close menu", onclick: () => toggleMore(false) }, "✕")),
    ...MENU.map(([section, items]) => h("section", { class: "more-sec" }, h("h4", {}, section),
      h("div", { class: "more-grid" }, items.map(([icon, label, name]) => {
        const badge = h("span", { class: "mini-badge", hidden: true });
        moreBadges[name] = badge;
        return h("button", { type: "button", "aria-label": label, onclick: () => { toggleMore(false); open(name); } },
          name==='profile'?meAv:h("span", { class: "i" }, icon), h("span", { class: "l" }, label), badge);
      })))));
  function toggleMore(on = more.hidden) { if(on===!more.hidden)return;more.hidden = !on; document.body.classList.toggle("game-menu-open",on);dock.lastChild.setAttribute("aria-expanded",String(on));if(on)more.querySelector("button")?.focus();else dock.lastChild.focus({preventScroll:true}); }
  more.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();toggleMore(false);}else if(e.key==='Tab'){const items=[...more.querySelectorAll('button:not(:disabled)')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  document.addEventListener("game-open-hub",()=>toggleMore(true));
  dock.lastChild.setAttribute("aria-controls","game-hub");
  dock.lastChild.setAttribute("aria-expanded","false");
  document.addEventListener("pointerdown",e=>{if(!more.hidden&&!more.contains(e.target)&&!dock.contains(e.target))toggleMore(false);});

  // ---- arrival banner and activity ----
  const arrival = h("div", { class: "arrival", hidden: true });
  const activity = h("div", { class: "activity" });

  root.append(topLeft,rideBar, minimap,cameraBtn, actions, joystick, hint, context, quickActions,dock, more, arrival, activity,speed,area,boundaryHint,greeting);
  document.body.append(root);

  let arrivalTimer = 0;
  return {
    root, joystick, miniCanvas,
    showGreeting(){clearTimeout(greetingTimer);greeting.hidden=false;greeting.style.visibility='hidden';greetingTimer=setTimeout(()=>{greeting.hidden=true;},2800);},
    get greetingActive(){return !greeting.hidden;},
    positionGreeting(x,y,visible=true){greeting.style.visibility=visible?'visible':'hidden';greeting.style.left=`${Math.max(56,Math.min(window.innerWidth-56,x))}px`;greeting.style.top=`${Math.max(86,Math.min(window.innerHeight-80,y))}px`;},
    setBoundary(near){boundaryHint.hidden=!near;},
    get menuOpen(){return !more.hidden;},
    setVehicle(type){if(type===lastRide)return;lastRide=type;jumpBtn.hidden=type!=='walk';carQuick.setAttribute('aria-pressed',String(type==='car'));autoQuick.setAttribute('aria-pressed',String(type==='auto'));exitRide.hidden=type==='walk';cycleBtn.setAttribute('aria-label',`Choose ride. Current: ${type}`);},
    setDrive(type,kmh,locked,direction='STOP',placeName){speed.hidden=!['car','auto','bike','scooter'].includes(type);const text=`${direction} · ${Math.round(kmh)} / ${({auto:35,car:80,bike:45,scooter:35})[type]||0} km/h`;if(speed.textContent!==text)speed.textContent=text;area.hidden=!locked;const label=`${placeName||'LOCAL AREA'} · METRO TO TRAVEL`;if(area.textContent!==label)area.textContent=label;},
    setPlace(p) {
      placeName.textContent = p ? p.name : "Gandhinagar";
      placeGu.textContent = p ? p.gu : "ગાંધીનગર · Green City";
      placeCard.style.setProperty("--pc", p ? "#" + p.color.toString(16).padStart(6, "0") : "#36c48a");
    },
    arrive(p) {
      clearTimeout(arrivalTimer);
      arrival.replaceChildren(
        h('span',{},`📍 ${p.name}`));
      arrival.style.setProperty("--pc", "#" + p.color.toString(16).padStart(6, "0"));
      arrival.hidden = false;
      arrival.classList.remove("out");
      arrivalTimer = setTimeout(() => { arrival.classList.add("out"); setTimeout(() => { arrival.hidden = true; }, 300); }, 1800);
    },
    setTime(text, night, weather) {
      timeChip.textContent = `${night ? "🌙" : "☀"} ${text}${weather ? " · " + weather : ""}`;
    },
    setMe(name) { meAv.textContent = name ? name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "🙂"; },
    setOnline(n) { if(moreBadges.online){moreBadges.online.hidden=!n;moreBadges.online.textContent=String(n);}},
    setBadge(which, n) {
      unread[which]=Math.max(0,Number(n)||0);const total=unread.chats+unread.world;
      chatsBadge.hidden=!total;chatsBadge.textContent=total>9?'9+':String(total);
      chatQuick.setAttribute('aria-label',`Open chat (T)${total?`, ${total} unread`:''}`);
      const b=moreBadges[which];if(b){b.hidden=!unread[which];b.textContent=unread[which]>9?'9+':String(unread[which]);}
    },
    setMoreBadge(which, text) { const b = moreBadges[which]; if (b) { b.hidden = !text; b.textContent = text || ""; } },
    setCycling(on) { cycleBtn.classList.toggle("on", on); },
    setNearest(p) {
      nearBtn.hidden = !p;
      if (p) nearBtn.replaceChildren(h("span", { class: "i" }, p.data.ai ? "🤖" : "🙂"), h("span", {}, "Say hi to ", h("b", {}, p.data.firstName || p.data.name.split(" ")[0])), h("kbd", {}, "E"));
    },
    setInteract(label) {
      interactBtn.hidden = !label;
      if (label) interactBtn.replaceChildren(h("span", {}, label), h("kbd", {}, "E"));
    },
    activity(text, action) {
      const card = h("div", { class: "act-card glass" }, h("span", {}, "✨ ", text),
        action ? h("button", { type: "button", onclick: () => { action.fn(); card.remove(); } }, action.label) : null,
        h("button", { type: "button", class: "x", "aria-label": "Dismiss", onclick: () => card.remove() }, "✕"));
      activity.replaceChildren(card);
      setTimeout(() => card.remove(), 9000);
    },
    toggleMore,
  };
}
