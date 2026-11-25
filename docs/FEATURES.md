# People of Ahmedabad: complete feature list

Reference build checklist, taken from the live site (peopleofahmedabad.com) on 23 Nov 2026, signed in as a normal member.

Key:
- **[T]** tested in the browser (opened and read; nothing was submitted)
- **[S]** seen in the UI text, not opened
- **[P]** described in the Terms or Privacy page only

---

## 1. Landing page
- [T] "EARLY DEMO" badge
- [T] Live AQI ticker in the top bar (e.g. "AQI 137 · Hawa kharab, mask lai lo")
- [T] Hero: Gujarati and English title "AMDAVAD", tagline "તમારો AI twin, તમારા શહેરમાં" (your AI twin, in your city)
- [T] Main button "Amdavad chalo" (enter the city)
- [T] "Advertise your startup, store or cafe" button (opens the advertise form, see 12)
- [T] Footer: creator's Instagram link, Terms, Privacy
- [P] Visitors can walk the city without signing in; they show only in a "just looking" count, with no name or position

## 2. Sign-in and account
- [P] Sign-in by one-time code sent to email or WhatsApp number
- [P] One account per person; must be 18 or older
- [T] Sign out (in profile settings)
- [P] Data kept in a hosted database and sign-in service
- [P] Visitor state (passport, sound setting, "already seen" markers) saved only in the browser
- [P] Reporting an email for data requests: hello@peopleofahmedabad.com

## 3. The 3D city (core world)
- [T] Walkable 3D Ahmedabad: Sabarmati Riverfront, Atal Bridge, and other areas
- [T] Controls: left thumb to walk, right thumb to look (touch); WASD/arrows and mouse-drag on desktop [S]
- [T] Name tags above people, with a status bubble (e.g. "Aavo aavo!") and an open-to chip (e.g. "OPEN TO CLIENTS")
- [T] Live location label top-left (e.g. "SABARMATI RIVERFRONT")
- [T] Live clock top-left (e.g. "5:18 PM") with a time-of-day override (see 13)
- [T] Bottom bar: "View [name]'s profile" for the nearest person
- [T] Tap a name to say hi
- [T] Your own character with a name and one-liner bubble
- [S] Wave key Q, or the 👋 button (in-world wave; also a mission step)
- [T] 🚲 Ride a cycle (in-world vehicle button)
- [T] 🚌 BRTS and cab rides shown on people ("🚌 BRTS RIDE", "🚕 CAB RIDE")
- [T] Other avatars walk around the city in real time
- [T] Activity toast, e.g. "Vaidik just moved to Digital Amdavad" with a "👋 Say hi" button
- [T] Ambient life: kites, boats on the river, the chai stall, people on the steps (seen on screen)

## 4. Top bar and main controls
- [T] EDIT button (opens the profile and AI-twin setup, see 5 and 6)
- [T] Avatar icon top-right (opens About You, see 7)
- [T] Globe button: World chat (see 9)
- [T] "Online now · Talk ▸" pill (see 9)
- [T] Missions counter "1 Missions · 0/6" (see 10)
- [T] Bottom bar: 🔍 Find someone, 💬 Connections and chats, 🚌 Travel, 🎬 Plans, ☰ More
- [T] Bottom-right: 👋 Wave, 🚲 Ride a cycle
- [T] Joystick and look area on mobile

## 5. Profile (EDIT)
Multi-step form, each step has Back, Save and Next. Save is per-step, and Save is the only place that writes.
- [T] "Talk instead": answer out loud in English or Gujarati and the form fills in
- [T] Step 1 "Tamaru naam?": your name (required) and "What you do (Designer · Your company)"
- [T] Note: "Others see your name, what you do and where you hang out. Never your email."
- [T] Step 2 "Your one-liner": shown in a bubble above your head
- [T] Step 2 "Open to" (pick one): Just here to walk around, Hiring, Looking for work, Finding a co-founder, Finding clients, Mentoring, Friends and chai
- [T] Step 3 "Tamne shu game chhe?" (What are you into?): pick up to 6 from Startups, Coding·AI, Design, Dhandho·business, Share bazaar, Chai pe charcha, Khana-pina, Garba, Cricket, Box cricket, Photography, Music, Films, Fitness, Books, Farvanu·travel
- [T] Step 4 "Ahin kem aavya?" (Why are you here?): pick up to 3 from New friends, A co-founder, Hiring, Looking for work, Clients or customers, Mentors, Bas farva (just exploring)
- [T] Step 5 "How can people reach you?": shown to people after they wave at you (LinkedIn, Instagram links; contact shared only after a wave)
- [T] Step 6 "Pick your character": Male (Hoodie, Casual, Business, Punk, Worker, Suit, T-shirt); Female (Adventurer, Casual, Dress, Tank top, Jacket)
- [T] Step 7 "Where and when?": home district (Sabarmati Riverfront, Sindhu Bhavan Road, Manek Chowk, Kankaria Lake, Law Garden, and others) and usual time (Morning, Day, Evening, Night)
- [T] Step 8 "Who can see you?": "Show me to other people" toggle; "Email me when someone waves or wants to connect" toggle
- [T] AI twin status line on the profile ("Your AI twin is on") with a link to teach it
- [T] "More profile settings" link to the AI-twin settings
- [T] Sign out

## 6. AI twin
- [T] Setup screen: "Make your AI twin". Talk for a minute; it learns who you are, then lives in the city and answers people for you
- [T] Language: Gujarati, Hindi, English
- [T] "Edit what my twin knows" and "More profile settings"
- [T] Teach-your-twin screen: "Let an AI answer for me when I am offline" (on/off, off by default)
- [T] Confirm 18 or older
- [T] Fields: "What I do, and what I am working on", "What I am looking for", "Ask me about", "Best way to work with me", "One fun Amdavad thing about me"
- [T] Save and "Try my twin" (test chat)
- [T] "Clear everything my twin knows"
- [T] Rules shown to the user: answer only from what the member wrote and their public profile; say it is an AI; say "I'll tell quellflowclient" when it does not know; never share contact details; never agree to meetings, prices or promises; never say anything about other people
- [T] Chats are visible to the owner in the Chats tab, kept 14 days
- [P] Replies processed by an AI provider (Groq); replies with phone numbers, emails, links, claims about others, or anything sexual are not saved
- [P] Twin rules and moderation: the team may switch off or remove a twin

## 7. About You (top-right avatar)
- [T] "1 person looked at your profile this week" (profile-view count)
- [T] Your public tags shown back to you
- [T] Note: matching people see you first in the "Koi ne shodho" search
- [T] Note: people can see when you open their profile
- [T] Optional, shown on your card: company or college, what you are building, website or portfolio, skills (up to 8, comma-separated)
- [T] Save button
- [T] "Change these" link back to profile

## 8. Resident card
- [T] Your card image, with a number (e.g. "Resident No. 1884"), drawn on the fly
- [T] Three sizes: Story 9:16, Post 4:5, Link preview
- [T] Download story (9:16) and all three sizes
- [T] Caption ready to paste, with a Copy caption button
- [S] Bilingual text ("Tamaru card taiyar che")

## 9. Social: find, connect, chat
- [T] **Find someone** (🔍): "Find someone in the city"
  - Filter chips: Everyone, Hosting a plan, Finding a co-founder, Friends and chai, Finding clients, Hiring, Looking for work, Mentoring
  - Sort: "Nearest first" (shows count, e.g. 204)
  - People list with name, one-liner, distance and direction ("5m · AHEAD RIGHT"), location (e.g. "WEST BANK", "AHMEDABAD AIRPORT", "LAW GARDEN", "KALUPUR STATION", "ADALAJ NI VAV")
  - Status: "● HERE NOW"
  - "🎙 GO AND TALK ▸" action on each person
  - "✨ FOR YOU" section, with matched people (e.g. "You are both looking for a co-founder")
  - "EVERYONE" section below the matches
  - Search "Koi ne shodho" (find someone)
- [T] **Online now** (green pill, top right): list of people currently online, each with "Go and talk ▸" and their location
- [T] **Talk** (on the Online now pill): start a live talk with someone (likely voice; "Go and talk" wording on each person)
- [T] **Connections and chats** (💬):
  - Tabs: Chats (count), Requests, Sent (count)
  - Chat list with the last message and "OPEN CHAT" button
  - Status: "Sent. When X replies, you two are connected."
  - "💬 ADD A MESSAGE" to send another message
  - A first message is held until they reply (up to 3 before they reply, no phone numbers, emails or links)
  - Unanswered requests expire
- [T] **Waves**: one per person per day. A wave is an invitation, not an obligation
- [P] Block anyone; report anyone (a report sends the owner a copy of the chat with that person)
- [P] Daily limits on waves and connection requests

## 10. World chat (🌍)
- [T] Public room: "Everyone in the city can read this. Be kind. No numbers, emails or links."
- [T] Empty state "Say kem cho to the whole city"
- [T] Emoji picker (😊) and send (➤)
- [T] Unread badge (the "1" on the globe)

## 11. Missions, badges and the passport
- [T] Missions counter "Missions · 0/6" (top left)
- [T] **Chapter 1 · Navo Amdavadi** (0 of 6 done), saved on device
  1. 👋 Pehlo kem cho: wave at three AI residents, chat with one and ask what they do (unlocked)
  2. Cutting chai (locked until 1 is done)
  3. Meter chalu (locked until 2 is done)
  4. Janmarg dash (locked until 3 is done)
  5. Bhaav karo (locked until 4 is done)
  6. Manek Chowk, table for five (locked until 5 is done)
- [T] **Story missions** (any time): Teen Darwaza no divo (Heritage Walk, about 5 min, solo); Ellis Bridge no karigar (Riverfront, about 5 min, build it by hand)
- [T] **Gigs** (play money, locked until mission 3): Rickshaw fares; Tiffin delivery. The rupees earned are play money and cannot be paid out
- [T] **Real-people missions** (any time): Pehli olkhan (send your first connect request to a real person); Host bano (post a plan on the Plans board); Kaam ni vaat (message a real person open to what you're looking for)
- [T] **Badges, 0/12** (locked, "Not yet"): Kem cho certified; Kitli regular; Meter master; Fix bhaav ustad; Janmarg sprinter; Bhaav karo champion; Table for five; Fafda loyalist; Paisa vasool; Pakko amdavadi; Divo no saathi; Pul no karigar
- [T] "Show my current mission on screen" toggle
- [T] **Day one** (🌅 1/6): first-day missions
  - Day 1 streak with a "rest day in hand" (one rest day, keeps the streak)
  - Visit two places (1/2): take the BRTS
  - Wave at three people (1/3): press Q or 👋
  - Join or post a plan
- [T] **Amdavad passport** (🎟):
  - Stamps for 10 places: Sabarmati Riverfront, Sindhu Bhavan Road, Law Garden, Kankaria Lake, Manek Chowk, Heritage Walk, Adalaj ni Vav, Narendra Modi Stadium, Kalupur Station, Ahmedabad Airport
  - "Firsts" (8): Rode a cycle; Crossed the Atal Bridge; Bargained like an Amdavadi; Waved at five people; Joined a plan; Out after dark; Up for the morning; Reached Nagina Wadi
  - Streak, saved on this device only

## 12. Advertise (📣 and the landing button)
- [T] "Advertise your startup, store or cafe"
- [T] Offer: "Free for the first month"
- [T] Business type: Startup, Store, Cafe or restaurant, Other
- [T] Placement: Anywhere, Sabarmati Riverfront, Sindhu Bhavan Road, Manek Chowk, Kankaria Lake, Law Garden
- [T] Placements described: named shopfront, billboard, stall or event
- [T] "Send request" (lead form; the team replies by email, details used only for that)
- [P] Paid shopfronts and billboards are advertising

## 13. Time, weather and mood
- [T] "Time" panel (🕒)
- [T] Live IST clock
- [T] Time-of-day override: Morning, Day, Evening, Night
- [T] "24h in 60s" timelapse
- [T] Weather: temperature (31°C) and text ("Mausam mast che"), wind (7 km/h)
- [T] AQI with text ("Hawa kharab, mask lai lo")
- [T] Mood text per time of day ("Evening: the whole city turns up...")

## 14. Sound settings (🔊 Sound · Avaaj)
- [T] Master sound: everything on or off
- [T] Music: "A tune for each part of the city" (volume slider, default 80; off on phones to save data, with "Play it anyway")
- [T] City: water, traffic, people, footsteps, horns (volume 80)
- [T] Voice guide: Gujarati hello and place names (volume 80)
- [T] Footstep sounds on different ground types (seen in asset list)

## 15. Map (🗺️ City map, also L key)
- [T] 2D map with filters: ☕ Cafes, 🍲 Food, 🛍️ Shops, 🎉 Events, 👥 People
- [T] Zoom in, zoom out, recentre (◎), fullscreen (⤢)
- [T] Place markers: Narendra Modi Stadium, Adalaj ni Vav, Ahmedabad Airport, Heritage Walk, Kalupur Station, Sindhu Bhavan Road, Law Garden, Manek Chowk, Sabarmati Riverfront, Kankaria Lake
- [T] People shown on the map
- [T] Scale bar (200 m)

## 16. Travel (🚌 BRTS · જનમાર્ગ, fast travel)
- [T] "Kya javu che?" (where do you want to go?)
- [T] Destinations, each with a live headcount and "Start meeting new people ▸":
  - Kalupur Station (54 people): Ahmedabad Jn., catch the train to the airport
  - Ahmedabad Airport (40): SVPI Terminal 2
  - Narendra Modi Stadium (30): Motera, concert night
  - Sindhu Bhavan Road (79): cafes, cars, late nights
  - Law Garden (81): chaniya choli market, pav bhaji
  - Kankaria Lake (78): lake rounds, lights, toy train
  - Manek Chowk (42): jewellers by day, food by night
  - Heritage Walk (32): Teen Darwaza to the Kalupur mandir, on foot
  - Adalaj ni Vav (15): the stepwell, five storeys down
  - Sabarmati Riverfront: "You are here"
- [T] 🎤 Open mic stage: "Take the mic or just listen" (Sabarmati Riverfront)

## 17. Plans (🎬 Plans · koi che?)
- [T] Plan categories (filter): All, Movie or show, Chai, Food run, Box cricket, Garba, Startup talk, Walk, Something else
- [T] "＋ Post a plan"
- [T] Real local events, each with date, time, venue and "FIND COMPANY ▸", with a disclaimer to check the organiser before you go (about 25 events)
- [T] "I'm in" on a plan (join a plan)
- [T] Cinema releases with "FIND COMPANY ▸" (note: look up showtimes before you book)
- [T] Plans are made between people; the team does not organise or check them
- [P] Plans drop off after about three days

## 18. Utsav (🎉 What's on in Amdavad, Events)
- [T] Sample event calendar, with "Preview" (turns an event on to see it now)
- [T] Kankaria Carnival (25 to 31 Dec, Kankaria Lake): fireworks every night of the last week; "Chalo ▸"
- [T] "Coming up in the real city": AI virtual meetup (date TBA, "tickets soon", "I am interested"); Garba night (date and venue TBA, "tickets soon", "I am interested")
- [T] Note: festival dates that move each year are marked; fixed dates switch on by themselves

## 19. Shops, stalls and listings
- [S] Street stalls seen in the city: Bhel, Ice cream, Makai, Chai, Popcorn, Baraf gola, Pani puri, Limbu soda, Dabeli, Sherdi ras, Cloth stall, Bandhani seller, Imitation jewellery, Mukhwas
- [S] Vendor AI residents and real shops at each stall
- [P] Shop prices, events and listings are samples unless stated
- [T] Bargaining mechanic (mission "Bargained like an Amdavadi" and mission "Bhaav karo")

## 20. Other menu items (in ☰ More)
- [T] 💡 Suggest: "What should we add?" with type (Feature request, Something is broken, Other) and Send
- [T] 🗺️ City map
- [T] 🎉 Utsav (events)
- [T] 🪞 My twin (AI twin)
- [T] 🎯 Missions
- [T] 🎟 Passport
- [T] 🌅 Day one
- [T] 🪪 Card (resident card)
- [T] 📣 Ads
- [T] 🔊 Sound
- [T] 🕒 Time
- [T] 🌍 World
- [T] 🔍 Find
- [T] 💬 Chats
- [T] 🚌 BRTS (travel)
- [T] 🎬 Plans
- [T] ☰ Close

## 21. Content and tone
- [T] Gujarati-English mix throughout (Gujarati copy plus English translation)
- [T] AI residents (bots) fill the streets so the city never feels empty; labelled as AI residents
- [T] Creator credit: "MADE WITH AI AND CHAI IN AMDAVAD"
- [T] "AMDAVAD CHALO" and "Ghar na niyam · house rules" (terms)
- [T] Terms: "Draft, last edited 17 November 2026"

## 22. Safety, trust and legal
- [P] Age gate 18+ (for sign-in, visibility and the AI twin)
- [P] One account per person
- [P] Use a real name
- [P] Block and report (report sends the owner a copy of the chat)
- [P] Daily limits on waves and requests; unanswered requests expire
- [P] Chat: first messages held until replied (max 3); no phone numbers, emails or links
- [P] AI replies labelled as AI; AI twins must not make promises or share contact details
- [P] Retention: chat with AI kept 14 days; Plans drop off after about 3 days
- [P] Play money (₹ in missions and gigs) cannot be paid out
- [P] Terms and Privacy pages (both marked "Draft")

## 23. Data (what the app stores)
- [P] Account: email or WhatsApp number (used for sign-in only, never shown)
- [P] Profile: name, what you do, one-liner, open-to, home district, usual hours, character look, optional fields (company, building, website, skills)
- [P] Optional links: LinkedIn, Instagram
- [P] Last position in the game city, used to show "here now" or "away"
- [P] Waves and connection requests, first messages, private chat after reply
- [P] Plans posted and joined
- [P] Game scores on the top scores board (shown publicly)
- [P] Blocks and reports
- [P] Visitor-only: passport, sound setting, "already seen" markers, all in the browser only

## 24. Not yet checked (to confirm before build)
- [ ] Sign-in flow itself (one-time code screens)
- [ ] Wave and in-world interaction (not clicked, to avoid waving at real people)
- [ ] Cycle ride mechanics
- [ ] "Go and talk" and "Talk" (live talk type: voice or text)
- [ ] Mission gameplay (cutting chai, meter chalu, janmarg dash, bhaav karo, Manek Chowk table for five)
- [ ] Top scores board
- [ ] Shops and stalls: bargaining flow
- [ ] AI residents: chat behaviour
- [ ] Desktop layout (checked at phone width only)
- [ ] Leaderboard, if it exists
