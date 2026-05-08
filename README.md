# MioCode — Teaching Programming Using a Virtual Robot

**Author:** Riyadh Miah (202314286)
**Institution:** University of Hull, 2026
**Degree:** BSc Computer Science (Artificial Intelligence)  
**Module:** 600091 Honours Stage Project 2025/26  
**Project Reference:** NAG-25-953
**Supervisor:** Zhibao Mian  


---

## Live Demo

**[https://honour-stage-project-202314286.vercel.app](https://honour-stage-project-202314286.vercel.app)**

> **Note:** For completely seamless usage of the app, with integration of the backend database and AIDE tutor, usage via the hosted website is highly recommended.

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@robotlab.demo | RobotLab2026! |
| Student | alice@robotlab.demo | RobotLab2026! |
| Student | ben@robotlab.demo | RobotLab2026! |

---

## Project Overview

MioCode is a web-based educational platform that teaches fundamental programming concepts to school-age children (ages 7-11) through a programmable virtual robot and a proactive AI tutor.

The platform uses a two-stage pedagogical approach:

1. **Block-based programming** — learners control a virtual robot (Mio) using Google's Blockly editor to understand sequencing, loops, and conditionals through visual, tangible feedback.

2. **AI literacy** — an integrated LLM assistant (the AIDE Teacher Console) demonstrates how to interact with AI as a purposeful tool, not a solution engine. The AIDE provides context-aware pedagogical hints when a student fails a level, explaining *why* code failed without giving the answer.

The project addresses a documented gap in computing education: non-specialist teachers lack the confidence to teach abstract programming concepts, and general-purpose AI tools like ChatGPT encourage over-reliance rather than genuine learning (Gardella et al., 2024; Xue et al., 2024).

---

## Key Features

### Core Application
- **Virtual robot simulation** — Mio the robot renders on an HTML5 Canvas with a full animation queue engine (400ms per cell, cubic ease-in-out), wobble feedback on boundary/wall hits, and a canvas flash failure sequence
- **Google Blockly integration** — custom block definitions (Move Forward, Turn Left/Right, Turn Around), progressive toolbox disclosure per category (basics → loops → obstacles → conditionals)
- **28 curated levels** across 4 curriculum categories (Movement Basics, Loops, Obstacles & Navigation, Conditionals & Sensors)
- **Obstacle walls** stored as JSONB in the database, making new levels configurable without code changes
- **Conditional blocks** — `if path is clear`, `if path is blocked`, `while path is clear`, with logical position prediction so conditionals evaluate correctly after all queued moves

### AIDE Teacher Console
- Proactive AI tutor powered by Anthropic's Claude Haiku 4.5 via a Vercel serverless function (`/api/aide.js`)
- Fires after a student fails a level — captures the generated code, level context, and block efficiency
- System prompt instructs the model to act as an encouraging teacher for ages 7-11: 2-3 sentences, no direct answers, no jargon, no bullet points
- API key stored securely in Vercel environment variables — never exposed to the client
- All AIDE interactions logged to the `aide_interactions` table for teacher telemetry
- Proactive Level 1 introduction on first visit — demonstrates the Intelligent Tutoring System pattern (scaffolding *before* failure, not just after)

### Gamification
- **Star system** — 1-3 stars per level based on block efficiency vs the `optimal_block_count` stored in the database. Shadow blocks (grey Blockly inputs) excluded from the count.
- **15 badges** — earned automatically on level completion events (First Steps, Speed Coder, Perfect Run, category completions, streak milestones, curriculum complete)
- **Daily streak** tracking with longest streak history
- **Class leaderboard** — visible to students in the same class, ranked by total stars
- **Progress never downgraded** — replaying a level can only improve, never reduce, a student's best score

### Sound System
- Web Audio API — all sounds generated programmatically, no external audio files
- Functional SFX: step (each cell move), turn, run start arpeggio, wall hit, error descent, star earn (pitched per star), level complete fanfare
- Mute button fixed-position, persists to localStorage — classroom essential

### Role-Based Platform
- **Student view** — personalised greeting, level select, progress dashboard, badge showcase, class leaderboard
- **Teacher view** — class management, student progress telemetry, AIDE interaction log, class leaderboard
- Teachers create classes with a unique 6-character code; students join via the code
- Teacher accounts provisioned exclusively via Supabase dashboard (prevents privilege escalation)

### Onboarding
- 3-slide welcome modal shown once to new users (zero progress rows in DB + localStorage flag)
- Slides feature Mio in different expression states (neutral, thinking, celebrating)
- Detection is per-user via `miocode_onboarded_[userId]` — handles multiple accounts on shared devices

### Mio Mascot
- Original character design inspired by the Clementoni Mio the Robot (documented in the PDD appendix)
- Duo-style flat cartoon with LED-hole eyes in an amber visor (no pupils — just glowing circular holes)
- Expression system driven by emoticon logic: `• •` neutral, `> <` happy, `> ~` thinking, `★ ★` celebrating
- Implemented as inline SVG throughout the platform (blink animation via SVG SMIL `<animate>`)
- Canvas robot (in-game) rendered via HTML5 Canvas 2D API — amber visor faces direction of travel

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vanilla JavaScript, HTML5 Canvas, CSS | Bypasses school IT restrictions on npm-based builds and framework dependencies |
| Block editor | Google Blockly (CDN) | Industry standard for visual programming education |
| Backend / Database | Supabase (PostgreSQL + Auth) | Managed BaaS — Row Level Security enforced at DB level, not application level |
| Hosting / CI/CD | Vercel | Auto-deploys on GitHub push; serverless functions for API key security |
| AI / AIDE | Anthropic API (claude-haiku-4-5) | Constitutional AI alignment with pedagogical safety goals; fraction-of-a-penny per hint |
| Fonts | Nunito (Google Fonts) | Rounded humanist sans-serif — reduces b/d reversal errors in 7-11 age group (BDA guidelines) |

---

## Architecture

```
┌─────────────────────────────────┐
│         Client (Browser)        │
│  Vanilla JS + HTML5 Canvas      │
│  Google Blockly (CDN)           │
│  Supabase JS (CDN)              │
└────────────┬────────────────────┘
             │ HTTPS
    ┌────────▼────────┐
    │   Vercel CDN    │
    │  Static files   │
    │  /api/aide.js   │  ← serverless function (API key proxy)
    └────────┬────────┘
             │
    ┌────────▼────────┐    ┌──────────────────┐
    │  Supabase       │    │  Anthropic API   │
    │  PostgreSQL     │    │  claude-haiku-4-5│
    │  Auth + RLS     │    │  (AIDE hints)    │
    └─────────────────┘    └──────────────────┘
```

The `/api/aide.js` serverless function acts as a secure proxy: the client sends level context, the function reads `ANTHROPIC_API_KEY` from Vercel environment variables, calls Anthropic, and returns the hint. The key never reaches the browser.

---

## Database Schema

```sql
profiles          -- id (uuid), role, display_name, total_stars, class_id,
                  -- streak_current, streak_longest, last_active_date, xp_total

levels            -- id, category, difficulty, title, description,
                  -- target_x, target_y, optimal_block_count, walls (jsonb)

student_progress  -- student_id, level_id, completed, stars_earned,
                  -- attempts, hints_used

classes           -- id, teacher_id, name, class_code (6-char)

badges            -- key, title, description, icon
student_badges    -- student_id, badge_key, earned_at

aide_interactions -- student_id, level_id, hint_text, blocks_used, optimal, created_at

endless_scores    -- student_id, score, levels_survived, created_at
```

**Row Level Security:** students are isolated at the database level. A student cannot construct any Supabase query returning another student's progress data. Class leaderboard access uses a `SECURITY DEFINER` function (`auth_user_class_id()`) to avoid recursive RLS on the profiles table.

**UK data jurisdiction:** Supabase project hosted in London (eu-west-2) — UK GDPR and Data Protection Act 2018 compliant.

---

## Project Structure

```
/
├── index.html          # main app — level select + game screen
├── login.html          # auth page (sign in / sign up)
├── teacher.html        # teacher dashboard
├── app.js              # blockly blocks, execution logic, win/fail sequences, sounds
├── robot.js            # Robot class — canvas rendering, animation queue engine, walls
├── level_select.js     # level select screen, onboarding, badges, leaderboard
├── supabase.js         # all DB queries, badge logic, auth helpers
├── sound.js            # SoundManager — Web Audio API, programmatic SFX
├── auth.js             # role-based redirect after login
├── styles.css          # design system, component styles
├── vercel.json         # serverless function config
└── api/
    └── aide.js         # serverless function — Anthropic API proxy
```

---

## Running Locally

> **Note:** the AIDE Teacher Console requires the live Vercel deployment since the serverless function and API key are not available locally. All other features work with Live Server.

1. Clone the repository
2. Open in VS Code
3. Install the Live Server extension
4. Right-click `index.html` → Open with Live Server
5. Create a Supabase account and project, apply the schema from the migration history
6. Update `supabase.js` with your project URL and anon key

For AIDE testing, deploy to Vercel and add `ANTHROPIC_API_KEY` to environment variables.

---

## Pedagogical Approach

The platform is grounded in established educational research:

- **Cognitive Load Theory** (Sweller, 1988) — progressive disclosure of blocks per category, split-screen layout separating editor from canvas, one new concept per level
- **Zone of Proximal Development** (Vygotsky, 1978) — sequential level locking, scaffolded AIDE hints, proactive Level 1 introduction
- **Feedback meta-analysis** (Hattie, 2009; effect size 0.73) — immediate feedback on execution, non-punitive error states, AIDE context-aware hints
- **Animation and sequencing comprehension** (Gouws, Bradshaw & Wentworth, 2013) — 400ms smooth robot animation at each cell, turn animation 200ms
- **Child-facing UX** (Gelman, 2014; Gapsy Studio, 2026; BDA Dyslexia Style Guide) — Nunito typeface, muted colour palette (Brom et al., 2025), non-punitive error language, multimodal reward signals
- **Sound in educational games** (Bishop et al., 2015) — functional SFX on by default, ambient music off (reduces cognitive load per Brom et al., 2025)

---

## Colour Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Brand green | `#3DAA6E` | Primary actions, success states |
| Brand blue | `#4A90D9` | Secondary UI, loops category |
| Reward amber | `#F5A623` | Stars, Mio visor, rewards |
| Error red | `#E53935` | Error states only — never decorative |
| Background | `#F5F7FA` | Page background |
| Text | `#1A1A2E` | Body text |

Muted palette chosen following Brom et al. (2025) finding that pale palettes outperform vivid colours for achievement scores in the 7-11 age group.

---

## Academic References

- Gardella, N., Pettit, R. and Riggs, S.L. (2024). Performance, Workload, Emotion, and Self-Efficacy of Novice Programmers Using AI Code Generation. https://doi.org/10.1145/3649217.3653615
- Xue, Y. et al. (2024). Does ChatGPT Help With Introductory Programming? An Experiment of Students Using ChatGPT in CS1. https://doi.org/10.1145/3639474.3640076
- Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science*, 12(2), 257–285.
- Hattie, J. (2009). *Visible Learning*. Routledge.
- Mayer, R.E. & Moreno, R. (2003). Nine ways to reduce cognitive load in multimedia learning. *Educational Psychologist*, 38(1), 43–52.
- Gouws, L., Bradshaw, K. & Wentworth, P. (2013). Computational Thinking in Educational Activities (ERIC EJ1154629).
- Brom, C. et al. (2025). Digital educational game design: Music, speed, colour and collectible item. *Computers & Education*.
- Bishop, M.J. et al. (2015). Audial engagement: Effects of game sound on learner engagement. *Computers in Human Behavior*.
- Sentance, S. & Csizmadia, A. (2017). Computing in the curriculum: Challenges and strategies. *Education and Information Technologies*. https://doi.org/10.1007/s10639-016-9482-0
- Cave, S. et al. (2018). Portrayals and perceptions of AI and why they matter. The Royal Society. https://doi.org/10.17863/CAM.34502

---

*NAG-25-953 | BSc Computer Science (Artificial Intelligence) | University of Hull | 2025/26*