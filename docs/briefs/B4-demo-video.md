# Brief B4 — Demo Video (Ayush, with Prateek on edit)

**Deliverable:** a 3–5 minute video at a public URL (YouTube unlisted is fine), required deliverable #4.
**Deadline: Mon 31 Aug, 16:00.** Devansh submits at 18:00.

**No code, no setup.** You need a screen recorder and something to record voice with.

## Why this matters

Most judges will not run our code. HCL's own wording: the video must _"demonstrate core functionality
and key features"_ and _"explain the overall workflow and user experience."_ Anything not on camera
effectively only exists in code review. This is how the six features get seen.

## Hard constraints

- **3–5 minutes.** Under 3 looks thin, over 5 may be cut off. Aim for **4:00**.
- Must show the app actually working, not slides of screenshots.
- Voice-over required — subtitles alone won't carry the reasoning.

## The site to record

**https://waypoint-six-teal.vercel.app**

Devansh will record a clean run-through in the morning and send you the raw footage. You can also
record your own — the site is live now.

## Script — follow this order

The order matters: it tells a story rather than touring a UI.

**0:00–0:25 — The problem.**

> "Search a course catalogue for 'data analyst' and you get a thousand results and no idea what
> order to do them in. Learners don't lack courses. They lack a sequence."

Show the landing page.

**0:25–1:00 — What we built, in one sentence.**

> "Waypoint treats this as planning over a skill graph, not text search. It works out which skills
> stand between you and your goal, then orders the journey so you never arrive somewhere you're not
> ready for."

Scroll the landing page to the route diagram.

**1:00–2:00 — The live journey. This is the core.**
Go to `/start`. Type a real goal, in a learner's voice — for example:

> "I'm a commerce graduate working in accounts. I want to become a data analyst."

Show: the profile panel filling in as it reads the sentence → click through to the plotted route.
Say what's happening:

> "It extracted her existing skills and her goal, worked out the gap, and planned a route through it."

**2:00–2:40 — Why each step. (Feature 5 — don't skip this.)**
Click **"WHY THIS STEP?"** on a stop. Show the reasoning panel.

> "Every step explains itself: which skill gap it closes, what it unlocks, why it's at this
> difficulty. The reasons come from the planner — the language model only phrases them, so it can't
> invent a justification."

**2:40–3:15 — Adaptation. This is the moment judges remember.**
Click **"I STRUGGLED HERE"** (or use the re-plot toggle on the landing page).

> "When the learner reports a setback, the route re-plots — and shows exactly what changed and what
> was kept."

Let the animation play. Don't talk over it.

**3:15–3:45 — Proof. (Our strongest 30 seconds.)**
Go to `/eval`.

> "We tested this against the standard approach — rank courses by similarity to the goal — on
> expert-written learning paths. Same corpus, same embeddings. Zero prerequisite violations against
> fifty percent. Ninety-three percent of the skill gap closed against sixty-five."

Let the numbers sit on screen for a beat.

**3:45–4:00 — Close.**
Show the dashboard.

> "Progress, skill development, milestones, and the next thing to do. Six features, one graph
> underneath all of them."

## What to make sure appears on camera

Tick these off — they're the six required features:

- [ ] Conversational intake (`/start`, typing a goal in natural language)
- [ ] Profile filling in (skills and level detected)
- [ ] The recommended resources
- [ ] The route with prerequisites and milestones (diamond markers = milestones)
- [ ] "WHY THIS STEP?" reasoning panel
- [ ] The dashboard
- [ ] Bonus, very much worth it: `/eval`

## Practical tips

- **Record at 1920×1080**, browser zoom at 100%, close bookmarks bar and any extensions.
- Record the screen and the voice in **one take per section** — easier to fix one 40-second section
  than to redo everything.
- The app calls a language-model gateway, which takes **20–50 seconds** on the `/start` page. **Cut
  that wait out in the edit.** Don't leave a silent 40-second pause on camera.
- If a take goes wrong, keep rolling and just repeat the sentence — trim it later.
- Say **"Waypoint"**, not "our app".

## When you're done

Upload to YouTube as **unlisted**, and send the URL to Devansh by **16:00**. Check the link opens in
a private/incognito window before sending — a video the judges can't open scores zero.
