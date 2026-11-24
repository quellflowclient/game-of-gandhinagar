import { h } from "./dom.js";

// Heads-up display, "Hariyali" design: frosted green glass, marigold accents, a live
// mini-map, an arrival banner, a labelled dock. `open(name)` opens a panel; `act(name)`
// runs an action.
export function createHud({ open, act }) {
  const root = h("div", { id: "hud" });
  const ibtn = (icon, label, aria, onclick, cls = "") =>
    h("button", { type: "button", class: cls, "aria-label": aria, title: aria, onclick }, h("span", { class: "i" }, icon), label ? h("span", { class: "l" }, label) : null);

  // ---- top left: where am I, time and weather, mission ----
  const placeName = h("div", { class: "pc-name" }, "Gandhinagar");
  const placeGu = h("div", { class: "pc-gu" }, "ગાંધીનગર");
  const timeChip = h("button", { type: "button", class: "pc-time", onclick: () => open("time"), "aria-label": "Time and weather" }, "☀ --:--");
  const placeCard = h("div", { class: "place-card glass" }, h("div", { class: "pc-dot" }), h("div", { class: "pc-txt" }, placeName, placeGu), timeChip);

  const msTitle = h("div", { class: "ms-t" }, "Pehlo kem cho");
  const msBar = h("i", {});
  const msCount = h("span", { class: "ms-c" }, "0/6");
  const mission = h("button", { type: "button", class: "mission-card glass", onclick: () => open("mission"), "aria-label": "Current mission" },
    h("span", { class: "ms-ic" }, "🎯"), h("div", { class: "ms-body" }, h("div", { class: "ms-k" }, "MISSION ", msCount), msTitle, h("div", { class: "ms-bar" }, msBar)));
  const topLeft = h("div", { class: "hud-tl" }, placeCard, mission);

  // ---- top right: me, online, world chat ----
  const meAv = h("span", { class: "me-av" }, "🙂");
  const worldBadge = h("span", { class: "badge", hidden: true });
  const onlineN = h("b", {}, "0");
  const topRight = h("div", { class: "hud-tr" },
    h("button", { type: "button", class: "me-btn glass", "aria-label": "Your profile and AI twin", onclick: () => open("profile") }, meAv, h("span", { class: "l" }, "Me")),
    h("button", { type: "button", class: "online glass", "aria-label": "Online now", onclick: () => open("online") }, h("i", { class: "pulse" }), onlineN, h("span", {}, " online")),
    h("button", { type: "button", class: "world glass", "aria-label": "World chat: talk to everyone", onclick: () => open("world") }, "💬", h("span", { class: "l" }, "City"), worldBadge));

  // ---- right: mini-map ----
  const miniCanvas = h("canvas", { width: 280, height: 280 });
  const minimap = h("button", { type: "button", class: "minimap", "aria-label": "Open the city map (L)", onclick: () => open("map") }, miniCanvas, h("span", { class: "n" }, "N"));

  // ---- bottom right: actions ----
  const cycleBtn = ibtn("🚲", null, "Ride a cycle (C)", () => act("cycle"), "fab cycle");
  const waveBtn = ibtn("👋", null, "Wave (Q)", () => act("wave"), "fab wave");
  const actions = h("div", { class: "hud-actions" }, cycleBtn, waveBtn);

  const joystick = h("div", { class: "joystick", "aria-hidden": "true" }, h("div", { class: "knob" }));
  const hint = h("div", { class: "hint glass" }, h("b", {}, "Kem cho! "), "Walk with WASD or the left thumb · drag to look · tap a name to say hi");
  setTimeout(() => hint.classList.add("fade"), 9000);

  const context = h("div", { class: "context" });
  const nearBtn = h("button", { type: "button", class: "ctx glass", hidden: true, onclick: () => act("nearest") });
  const interactBtn = h("button", { type: "button", class: "ctx glass green", hidden: true, onclick: () => act("interact") });
  context.append(nearBtn, interactBtn);

  // ---- dock ----
  const chatsBadge = h("span", { class: "badge", hidden: true });
  const dock = h("nav", { class: "dock glass" },
    ibtn("🔍", "Find", "Find someone", () => open("find")),
    h("button", { type: "button", "aria-label": "Connections and chats", onclick: () => open("chats") }, h("span", { class: "i" }, "🤝"), h("span", { class: "l" }, "Chats"), chatsBadge),
    ibtn("🚌", "BRTS", "Travel", () => open("travel"), "main"),
    ibtn("🎬", "Plans", "Plans: find someone to do things with", () => open("plans")),
    ibtn("✨", "More", "More city menu buttons", () => toggleMore()));

  const MORE = [
    ["🎯", "Missions", "missions"], ["🌅", "Day one", "dayone"], ["🎟", "Passport", "passport"], ["🏆", "Scores", "scores"],
    ["🗺️", "Map", "map"], ["🎉", "Utsav", "utsav"], ["💬", "City chat", "world"], ["🪪", "My card", "card"],
    ["🪞", "My twin", "twin"], ["🧑‍💻", "About me", "about"], ["🔊", "Sound", "sound"], ["🕒", "Time", "time"],
    ["📣", "Advertise", "ads"], ["💡", "Suggest", "suggest"],
  ];
  const moreBadges = {};
  const more = h("div", { class: "more glass", hidden: true },
    h("div", { class: "more-head" }, h("b", {}, "Gandhinagar menu"), h("button", { type: "button", class: "x", "aria-label": "Close menu", onclick: () => toggleMore(false) }, "✕")),
    h("div", { class: "more-grid" }, MORE.map(([icon, label, name]) => {
      const badge = h("span", { class: "mini-badge", hidden: true });
      moreBadges[name] = badge;
      return h("button", { type: "button", "aria-label": label, onclick: () => { toggleMore(false); open(name); } },
        h("span", { class: "i" }, icon), h("span", { class: "l" }, label), badge);
    })));
  function toggleMore(on = more.hidden) { more.hidden = !on; }

  // ---- arrival banner and activity ----
  const arrival = h("div", { class: "arrival", hidden: true });
  const activity = h("div", { class: "activity" });

  root.append(topLeft, topRight, minimap, actions, joystick, hint, context, dock, more, arrival, activity);
  document.body.append(root);

  let arrivalTimer = 0;
  return {
    root, joystick, miniCanvas,
    setPlace(p) {
      placeName.textContent = p ? p.name : "Gandhinagar";
      placeGu.textContent = p ? p.gu : "ગાંધીનગર · Green City";
      placeCard.style.setProperty("--pc", p ? "#" + p.color.toString(16).padStart(6, "0") : "#36c48a");
    },
    arrive(p) {
      clearTimeout(arrivalTimer);
      arrival.replaceChildren(
        h("div", { class: "ar-k" }, "WELCOME TO"),
        h("div", { class: "ar-n" }, p.name),
        h("div", { class: "ar-gu" }, p.gu),
        h("div", { class: "ar-b" }, p.blurb));
      arrival.style.setProperty("--pc", "#" + p.color.toString(16).padStart(6, "0"));
      arrival.hidden = false;
      arrival.classList.remove("out");
      arrivalTimer = setTimeout(() => { arrival.classList.add("out"); setTimeout(() => { arrival.hidden = true; }, 600); }, 3200);
    },
    setTime(text, night, weather) {
      timeChip.textContent = `${night ? "🌙" : "☀"} ${text}${weather ? " · " + weather : ""}`;
    },
    setMission(index, title, done, total, show = true) {
      mission.hidden = !show;
      msTitle.textContent = title;
      msCount.textContent = `${done}/${total}`;
      msBar.style.width = `${(done / total) * 100}%`;
    },
    setMe(name) { meAv.textContent = name ? name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "🙂"; },
    setOnline(n) { onlineN.textContent = String(n); },
    setBadge(which, n) {
      const b = which === "chats" ? chatsBadge : worldBadge;
      b.hidden = !n; b.textContent = n > 9 ? "9+" : String(n);
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
