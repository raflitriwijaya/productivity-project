# Polymath OS — User Guide

> **Your personal productivity suite.** Finances, research, engineering, learning, reading, contacts, ideas, goals, and an AI assistant — all in one integrated system.
> **Access URL:** [https://mightguy.my.id](https://mightguy.my.id)

---

## 1. Welcome to Polymath OS

Polymath OS is a personal productivity system built for researchers, engineers, startup founders, and polymaths — anyone who juggles multiple disciplines and needs one integrated tool instead of six separate apps.

**Philosophy:** Your finances, research notes, engineering projects, reading list, learning goals, ideas, and contacts are not separate worlds. They connect. A book you read inspires a research entry. A research entry sparks an engineering project. An engineering project needs budget tracking. Polymath OS links everything together so your knowledge compounds instead of scattering across apps.

**Getting started:**
1. Open [https://mightguy.my.id](https://mightguy.my.id) in your browser
2. Click **Register** — enter your name, email, and a password (minimum 8 characters)
3. After registration, log in with your email and password
4. You land on the **Today Dashboard** — your daily home base

---

## 2. Core Concepts You Must Understand

### 2.1 Main Navigation

The sidebar on the left organizes all 18+ modules into six sections:

| Section | Modules | What it's for |
|---------|---------|---------------|
| **Top** | Dashboard, To-Do, AI Chat | Daily essentials |
| **Finance** | Overview, Charts, Transactions, Accounts, Receivables, Payables, Portfolio, Budget | Money management |
| **Business** | Contacts, Ideas | Relationships & creativity |
| **Knowledge** | Research, Learning, Reading, Roadmaps | Knowledge building |
| **Engineering** | Sprint Board, Projects, Snippets, Docs, Check-ins, Issues, Roadmap | Building things |
| **Reflect** | Weekly Review, Goals, Polymath, Annual Report | Growth & reflection |

Click any item to navigate. The active page is highlighted in moss green. On mobile, tap the hamburger menu (☰) to open the sidebar.

### 2.2 Quick Capture (⌘K)

Quick Capture is your instant thought-capture tool. **Press `Ctrl+K` (Windows) or `⌘K` (Mac) anywhere** to open the command palette. Type your thought, select a mode, and press Enter — it is saved instantly without leaving your current page.

**Four modes (press Tab to cycle):**

| Mode | Icon | Use for | Example |
|------|------|---------|---------|
| **Task** | ✓ | Action items, to-dos | "Review contract for Project Alpha" |
| **Research** | 📖 | Notes, findings, citations | "Quantum error correction paper — key insight about surface codes" |
| **Idea** | 💡 | Impulsive ideas, brainstorms | "Build a ROS2-powered drone for agricultural monitoring" |
| **Search** | 🔍 | Find anything across all modules | Search for "STM32" finds projects, snippets, research entries |

**How to use Quick Capture in practice:**
1. You're reading a paper and have an idea → press `Ctrl+K`, type the idea, select **Idea**, press Enter
2. You remember a task you need to do → press `Ctrl+K`, type the task, select **Task**, press Enter
3. You learn something worth noting → press `Ctrl+K`, type the insight, select **Research**, press Enter
4. You need to find a specific project or note → press `Ctrl+K`, select **Search**, type keywords, click a result

**Pro tip:** The Today Dashboard header also has a "Quick Capture" button. Use either the keyboard shortcut or the button — they open the same palette.

### 2.3 Universal Links (Connecting Everything)

Every entity in Polymath OS can be linked to any other entity. A research entry can link to a book, a book to a learning item, a transaction to a contact, a goal to multiple projects — **22 entity types can interconnect**.

**How to link items:**
1. Open any item detail (click a research entry title, a book card, a goal card, an idea card, an engineering project)
2. Scroll to the **"Linked Items"** section at the bottom
3. Click **"Add Link"**
4. Choose a module → browse or search → select the item → optionally add a note → click **Create Link**

**Real-world examples:**
- Link a **book purchase transaction** to the **book** in your Reading tracker
- Link a **research entry** about LiDAR sensors to the **engineering project** using LiDAR
- Link a **contact** (supplier) to **payables** (what you owe them)
- Link **books**, **projects**, and **research entries** to a **Goal** — the goal's progress auto-calculates from linked items

**Why link everything?** The more connections you create, the more valuable your knowledge base becomes. Six months later, you can trace how a book led to a research insight that became a shipped project.

### 2.4 State Handling (Four States Every Page)

Every page in Polymath OS handles exactly four states. Understanding these helps you know what to expect:

| State | What you see | What it means |
|-------|-------------|---------------|
| **Loading** | Skeleton cards (animated gray placeholders) | Data is being fetched — wait a moment |
| **Error** | A red error card with a "Retry" button | Something went wrong — click Retry, or wait and refresh |
| **Empty** | An illustration with a helpful message | You have no data yet — create your first item to get started |
| **Data** | The actual content (cards, tables, charts) | Everything loaded successfully |

Pages never show a blank screen or a spinning wheel. If you see an error, use the **Retry** button — it re-fetches without reloading the page.

---

## 3. Daily Routine

### 3.1 Morning: Today Dashboard

Open [https://mightguy.my.id](https://mightguy.my.id) — you land on the **Today Dashboard**. This is your daily briefing, answering "what should I do today?"

**What you see:**

- **Five stat cards** at the top:
  - **Tasks** — count of pending, in-progress, completed today, and overdue tasks
  - **Today's Finance** — income and expenses recorded today, plus receivables/payables due within 7 days
  - **Learning** — active learning items with progress bars
  - **Research** — total entries, journal entries, citations, and notes
  - **Engineering** — open P0 (critical) issues, this week's check-in status, and active projects

- **Four action-item widgets** below:
  - **Tasks Due Today** — tasks with due dates of today or past (overdue)
  - **Today's Finance** — revenue, income, and expense totals for the day
  - **Today's Learning** — learning items in progress
  - **Engineering Issues** — critical and open issues across all projects

**Morning routine checklist:**
1. Check Tasks Due Today — pick 2-3 priority tasks
2. Scan Today's Finance — know your money position
3. Check Engineering Issues — any P0 fires to fight?
4. Open Quick Capture (`Ctrl+K`) to capture any overnight ideas

### 3.2 Throughout the Day: Capturing Ideas

Ideas are fragile — they evaporate in seconds. Use Quick Capture (`Ctrl+K`) the moment something crosses your mind:

- **Thought about a business idea?** → Idea mode, type it, Enter
- **Remembered a task?** → Task mode, type it, Enter
- **Learned something interesting?** → Research mode, type it, Enter

Don't classify or organize now — just capture. You can refine it later in the relevant module.

### 3.3 Evening: Review & Reflect

1. **Check notifications** — the bell icon in the sidebar shows items due. Click to see the list
2. **Update task status** — mark completed tasks as "Done" in the To-Do page
3. **Stop the timer** — if you used the Timer during the day, make sure it's stopped (check the Timer section in the Weekly Review page)
4. **Update learning progress** — if you studied something, update the progress in the Learning tracker

### 3.4 Weekly: Monday Review

Every Monday morning, go to **Weekly Review** (`/review` in the sidebar Reflect section). You'll see:

- **Seven summary stat cards:** Tasks Done, Net Finance, Research Entries Added, Learning Progress, Books Finished, Issues Resolved, Time Logged
- **Time breakdown chart:** where your hours went by entity type
- **Week navigation:** use the prev/next buttons to look at past weeks

Use this to plan your week and track progress against your goals.

---

## 4. Module-by-Module Guide

---

### 4.1 To-Do (Task Management)

- **What it is:** Daily task management with priorities, due dates, status tracking, and browser/Telegram notifications.
- **When to use it:** Any action item — from "Buy groceries" to "Submit grant proposal."
- **Page:** `/todo`

**How to use it:**

**Creating a task:**
1. Navigate to `/todo` → click the **"+ New Task"** button
2. Fill in:
   - **Title** (required) — e.g., "Review contract for Project Alpha"
   - **Description** (optional) — details, notes, context
   - **Priority** — Low, Medium, High, or Critical
   - **Status** — Pending (default), In Progress, or Done
   - **Due date** — a calendar date picker
   - **Due time** — optional, for time-specific reminders
3. Click **Save**

**Managing tasks:**
- **Edit:** Click the edit icon (pencil) on any task row
- **Delete:** Click the delete icon (trash) — a confirmation modal appears
- **Filter:** Use the status pills at the top (All, Pending, In Progress, Done) to filter your view
- **Sort:** Click column headers to sort by priority, due date, or status

**Module-specific features:**
- **Browser notifications:** When a task has a `due_time`, you receive a desktop notification 30 minutes before
- **Telegram reminders:** If you've connected Telegram (`@Raflitriwijaya_bot`), you also get a Telegram message
- **Priority badges:** Critical = red, High = amber, Medium = blue, Low = gray

**Practical Example:**
> You need to submit a paper abstract by Friday. Create a task: "Submit quantum computing abstract" → Priority: High → Due date: Friday → Due time: 14:00. At 13:30 on Friday, you get a browser notification and a Telegram message reminding you.

**Tips:**
- Set `due_time` for any task with a hard deadline — the 30-minute reminder is invaluable
- Use Critical priority sparingly (1-2 tasks max) so it remains meaningful
- Capture tasks via Quick Capture (`Ctrl+K`) throughout the day, organize them later

---

### 4.2 Finance — Transactions

- **What it is:** A multi-account general ledger tracking all money movement: income, expenses, transfers, and adjustments across 6 account types.
- **When to use it:** Every time money moves — salary received, coffee bought, rent paid, DANA top-up.
- **Page:** `/finance`

**How to use it:**

**Creating a transaction:**
1. Navigate to `/finance` → click **"+ New Transaction"**
2. Select the **Type**:
   - **Income** — money coming in (salary, freelance payment, gift)
   - **Expense** — money going out (food, transport, bills)
   - **Transfer** — moving money between your accounts (ATM → DANA)
   - **Revenue** — founder/business income (separate from personal income)
   - **Balance Adjustment** — correcting account balances
   - **Market Adjustment** — updating investment values
3. Fill in the fields that appear (they change based on type):
   - **Amount:** Type the number directly — `50000` (not `50.000`). The system formats it as Rp 50.000
   - **Source/Destination accounts** (for transfers)
   - **Category** — e.g., Food, Transport, Salary, Investment
   - **Description** — what this transaction was for
   - **Date** — when it happened
4. Click **Save**

**Viewing transactions:**
- Use the **month/year selector** at the top to filter by month
- Use the **type filter tabs** (All, Income, Expense, Transfer, Revenue) to filter by type
- The **summary cards** show Income / Expense / Net (income minus expense) / Net Worth for the selected period
- Each row is color-coded: green for incoming, red for outgoing

**Accounts:** The system manages 6 account types automatically:
- **Cash** — physical money in your wallet
- **ATM** — bank account
- **DANA, ShopeePay, GoPay** — e-wallets
- **Investment** — stocks, crypto, etc.

**Practical Example:**
> You receive Rp 5.000.000 salary into your ATM account. Create: Type = Income, Amount = `5000000`, Destination = ATM, Category = Salary. Then you transfer Rp 500.000 to DANA for daily spending: Type = Transfer, Amount = `500000`, Source = ATM, Destination = DANA.

---

### 4.3 Finance — Accounts, Receivables, Payables, Portfolio, Budget

**Accounts** (`/finance/accounts`)
- View all 6 account balances and total net worth
- Edit account names and opening balances
- Each account shows as a card with its current calculated balance

**Receivables** (`/finance/receivables`)
- Money owed TO you — invoices, loans to friends, pending payments
- Each receivable has: person name, description, amount, due date, status
- **Settle a receivable:** Click "Settle" → the system automatically creates an Income transaction
- Color-coded: outstanding (amber), settled (green)

**Payables** (`/finance/payables`)
- Money you owe — bills, rent, loan repayments
- Same structure as receivables but in reverse
- **Settle a payable:** Creates an Expense transaction automatically

**Portfolio** (`/finance/portfolio`)
- Track investments: stocks, crypto, index funds
- Enter: name, symbol, quantity, average price, current price
- The system calculates: market value, gain/loss, allocation percentage
- **Donut chart** shows your allocation across holdings
- Update current prices inline to see real-time gain/loss

**Budget** (`/finance/budget`)
- Set monthly spending limits per category
- Color-coded progress bars: green (under 80%), amber (80-99%), red (over budget)
- Compare planned budget vs actual spending

---

### 4.4 Finance Overview

- **What it is:** A one-screen financial command center consolidating all finance sub-modules.
- **When to use it:** Monthly financial review — see everything at a glance.
- **Page:** `/finance/overview`

**What you see in one screen:**
- Net income/expense for the selected month
- Account balances with net worth
- Recent transactions list
- Receivables and payables due soon
- Portfolio summary
- Budget vs actual bars with color coding

**Practical Example:**
> End of the month: open Finance Overview, select June 2026. You see: Net Income Rp 8.500.000, Top expense category: Food at Rp 2.100.000 (78% of budget — green), 2 receivables due next week, portfolio up 3.2%. One screen, complete picture.

---

### 4.5 Research

- **What it is:** Your personal research journal with markdown entries, topics (color-coded folders), tags, file attachments, semantic search, and AI auto-tagging.
- **When to use it:** Capturing research insights, literature notes, paper summaries, experiment findings, and any knowledge worth keeping.
- **Page:** `/research`

**How to use it:**

**Creating a research entry:**
1. Navigate to `/research` → click **"+ New Entry"**
2. Choose a **Type:** Journal (reflection/analysis), Citation (reference to a paper/book), or Note (quick observation)
3. Enter a **Title** — be descriptive, e.g., "Surface Code Error Thresholds Under Realistic Noise"
4. Write **Content** — full markdown editor with formatting toolbar (headings, bold, italic, code blocks, lists, links)
5. Select **Topics** — click the topic chips to assign entries to color-coded folders
6. Add **Tags** — start typing, existing tags autocomplete; press Enter or comma to add
7. Attach **Files** — after saving, open the entry detail and upload PDFs, images, or code files

**Organizing with Topics:**
- **Topics** are like folders with colors (Emerald, Blue, Red, Amber, Purple, Gray)
- Create topics for your research areas: "Quantum Computing," "Embedded Systems," "Machine Learning," "Startup Strategy"
- Select a topic from the sidebar → the table shows only entries in that topic
- Each topic shows its entry count in the sidebar

**Power features:**
- **Semantic Search:** Toggle from "Keyword" to "Semantic" search — find entries by meaning, not just exact words. "error correction in quantum systems" finds entries about "fault-tolerant qubits" even if those words don't appear
- **Auto-tag:** When creating an entry, click "✨ Suggest" next to Tags — AI suggests relevant tags based on your content
- **Pin:** Click the pin icon to keep important entries at the top
- **Duplicate:** Clone an entry as a starting point for a related note
- **Copy Citation:** For journal/citation entries, click the copy icon → choose APA, MLA, or IEEE format → citation is copied to your clipboard
- **Export:** Click "Export" in the header → choose JSON or CSV → downloads with current filters applied
- **Bulk actions:** Select entries via checkboxes → "Archive Selected" or "Delete Selected"
- **Date range filter:** Use the From/To date pickers to filter by creation date

**Attachments:**
- Supported formats: JPG, PNG, PDF, TXT, MD, CPP, PY, ZIP
- Maximum file size: 10 MB
- Files are stored securely and downloaded through authenticated links (no public URLs)

**Practical Example:**
> You read a paper on "Topological Quantum Error Correction." Create a Citation entry with the paper title, paste your notes in markdown (including key equations in code blocks), assign it to the "Quantum Computing" topic, tag it with `error-correction, surface-codes, topological`. Attach the PDF. A week later, you create a Journal entry developing an idea based on that paper — link the two entries via Universal Links.

---

### 4.6 Reading (Book Tracker)

- **What it is:** Track books across three shelves, with progress tracking, star ratings, notes, and links to research.
- **When to use it:** Every time you start, progress through, or finish a book.
- **Page:** `/reading`

**How to use it:**

**Adding a book:**
1. Navigate to `/reading` → click **"+ Add Book"**
2. Enter: Title, Author, Genre, Total Pages, Shelf (Want to Read / Reading / Finished)
3. Click **Save**

**Tracking progress:**
- Click a book card → detail modal opens
- Update **Current Page** as you read — progress bar fills automatically
- When you move a book from "Want to Read" to "Reading," `started_at` is auto-stamped
- When you move it to "Finished," `finished_at` is auto-stamped and `current_page` fills to `total_pages`
- Rate books 1-5 stars after finishing

**Shelves explained:**
- **Want to Read** — your reading queue
- **Reading** — books you're actively reading
- **Finished** — completed books with ratings

**Linking to Research:**
Open a book's detail modal → scroll to "Linked Items" → link to research entries. This creates a traceable path: "Book X → inspired Research Note Y → which became Project Z."

**Practical Example:**
> You start reading "The Hard Thing About Hard Things" by Ben Horowitz. Add it to Reading shelf, 289 pages. As you read, update current page. At page 150, you capture an insight about CEO decision-making → Quick Capture → Research mode. Open the book detail → Link Items → link that research entry. When you finish, move to Finished shelf, rate 5 stars.

---

### 4.7 Learning

- **What it is:** Track courses, tutorials, certifications, and self-directed learning with progress, hours invested, and status.
- **When to use it:** Any structured learning activity — online course, textbook study, skill practice.
- **Page:** `/learning`

**How to use it:**

**Creating a learning item:**
1. Navigate to `/learning` → click **"+ New Item"**
2. Fill in:
   - **Title** — e.g., "CS229: Machine Learning (Stanford)"
   - **Type** — Course, Book, Tutorial, Certification, Workshop, or Other
   - **Source** — where you're learning from (Coursera, YouTube, textbook)
   - **Status** — Not Started, In Progress, Completed, or Abandoned
   - **Priority** — how important this is
   - **Total Hours** — estimated total time commitment
   - **Spent Hours** — hours you've actually invested
   - **Progress** — percentage (0-100)
3. Click **Save**

**Practical Example:**
> You're taking Andrew Ng's ML course on Coursera: Title = "CS229 Machine Learning", Type = Course, Source = "Coursera / Stanford Online", Status = In Progress, Total Hours = 60, Spent Hours = 15, Progress = 25%. Update spent hours and progress after each study session.

---

### 4.8 Contacts CRM

- **What it is:** A lightweight contact manager for clients, partners, suppliers, investors, and mentors — linked to projects and finances.
- **When to use it:** Any professional relationship you need to track.
- **Page:** `/contacts`

**How to use it:**

**Adding a contact:**
1. Navigate to `/contacts` → click **"+ Add Contact"**
2. Fill in: Name, Email, Phone, Company, Role, Type (Client / Partner / Supplier / Investor / Mentor / Other), Status (Active / Inactive / Lead)
3. Add notes about the relationship
4. Click **Save**

**Linking contacts:**
- Open a contact detail → scroll to Linked Items → link to:
  - **Projects** — who you're working with
  - **Receivables** — who owes you money
  - **Payables** — who you owe money to
  - **Ideas** — collaboration ideas

**Practical Example:**
> You meet a potential PCB supplier at a conference. Add them: Name = "PCBExpress Ltd", Type = Supplier, Status = Lead, Notes = "Met at Embedded World 2026, competitive pricing on 4-layer boards." Later, when you start a project using their boards, link the contact to the engineering project and the payable for their invoice.

---

### 4.9 Ideas

- **What it is:** A visual idea board — capture impulses before they evaporate, then develop, validate, and convert them into projects, research, or tasks.
- **When to use it:** Every time inspiration strikes, no matter how rough the idea is.
- **Page:** `/ideas`

**Idea lifecycle:**
- **New** — just captured, raw
- **Developing** — you're thinking about it, adding notes
- **Validated** — you've confirmed it's worth pursuing
- **Converted** — turned into a real project, research entry, or task
- **Archived** — decided not to pursue (kept for reference)

**The "Convert to…" feature (most powerful):**
1. Open an idea → click the **"Convert to…"** dropdown
2. Choose: Project, Research Note, Todo, or Learning Item
3. The system creates the target item, links it back to the idea, and marks the idea as "Converted"
4. You can now trace: Idea → Project → Issues → Code

**Practical Example:**
> You have an idea: "Build an ESP32-based plant watering system with soil moisture sensors." Capture it as New. Later, add notes about sensors, watering schedules, power. Mark as Developing. After researching feasibility, mark as Validated. Then click "Convert to…" → Project → it becomes an engineering project with full project tracking, issues, check-ins, and budget.

---

### 4.10 Goals / OKRs

- **What it is:** Set goals across any domain, link them to the items that contribute to them, and watch progress auto-calculate.
- **When to use it:** Annual planning, quarterly OKRs, habit targets, learning milestones.
- **Page:** `/goals`

**Goal types:**
- **Target** — numeric target, e.g., "Read 24 books this year" (target: 24)
- **Milestone** — binary achievement, e.g., "Launch MVP of product X"
- **Habit** — recurring target, e.g., "Write 100 research notes"
- **Learning** — skill acquisition, e.g., "Complete ROS2 certification"

**Auto-calculated progress:**
1. Create a Goal (e.g., "Read 24 books," target: 24)
2. Link items to it — link each finished book via Universal Links
3. Click **"Recalculate from links"** — the system counts linked finished books, deployed projects, done tasks, completed learning items, and linked time entries
4. Progress bar updates automatically

**Practical Example:**
> Goal: "Ship 3 IoT products in 2026" (Type: Target, Target: 3). Link your three engineering projects. As each project status changes to "Deployed," recalculate — progress moves from 0/3 → 1/3 → 2/3 → 3/3. The goal card shows progress percentage, start/target dates, and an overdue flag if past deadline.

---

### 4.11 Time Tracking (Timer)

- **What it is:** Start/stop timer on any entity (research entry, book, project, learning item, task) to track where your hours go.
- **When to use it:** Deep work sessions, reading time, project hours, study sessions.
- **Page:** Timer is accessible from any item detail or the Weekly Review page.

**How to use it:**
1. Open any entity detail (research entry, book, project)
2. Click **"Start Timer"**
3. Work, read, or study
4. Click **"Stop Timer"** when done — the system records the duration
5. View your time log in Weekly Review

**Important:** Only one timer runs at a time. Starting a new timer automatically stops the previous one.

**Practical Example:**
> You're doing a 2-hour research deep-dive. Open the research entry → Start Timer → work for 2 hours → Stop Timer. The entry is now at 2 hours. At the end of the week, Weekly Review shows: Research: 8h, Reading: 5h, Engineering: 12h.

---

### 4.12 Weekly Review

- **What it is:** Auto-generated summary across all modules, week by week, with navigation to look back at any week.
- **When to use it:** Every Monday morning — your weekly retrospective.
- **Page:** `/review`

**What you see:**
- **Seven stat cards:** Tasks Done, Net Finance, Research Entries, Learning Items, Books Finished, Issues Resolved, Time Logged
- **Time breakdown bar chart:** hours by entity type (research, reading, engineering, learning, tasks)
- **Week navigation:** prev/next/Today buttons; default is the current week (Mon-Sun)

---

### 4.13 Annual Report

- **What it is:** Your year as a polymath — books read, papers written, projects shipped, hours invested, across every module.
- **When to use it:** End of year reflection, or any time you need to see the big picture.
- **Page:** `/report`

**What you see:**
- **Year selector** — arrows to scroll through years, capped at current year
- **Hero band** — headline numbers: books finished, research entries, projects shipped, hours invested
- **Per-module breakdowns:**
  - **Reading** — books finished, pages read, average rating
  - **Research** — entries created, by type
  - **Learning** — items completed
  - **Engineering** — projects deployed or archived
  - **Tasks** — tasks completed
  - **Time** — total hours logged
  - **Finance** — income, expense, net
  - **Goals** — goals completed

---

### 4.14 Polymath Dashboard

- **What it is:** Multi-year growth visualization across all disciplines — see your polymath journey unfold.
- **When to use it:** When you need inspiration, perspective, or proof of progress.
- **Page:** `/polymath`

**What you see:**
- **Year-over-year stat cards** with trend deltas (↑12% vs last year)
- **Growth bars** — books, research, projects, learning, year by year
- **Donut chart** — lifetime activity distribution
- **Tag cloud** — your most-used research tags, sized by frequency
- **Achievement highlights** — key milestones

---

### 4.15 AI Chat

- **What it is:** A DeepSeek-powered AI assistant with streaming responses, context injection from your data, and save-to-research.
- **When to use it:** Brainstorming, summarizing research, drafting content, asking questions about your own data, making decisions with Deep Think mode.
- **Page:** `/ai-chat`

**How to use it:**

**Starting a chat:**
1. Navigate to `/ai-chat` from the sidebar
2. Choose a model from the top bar:
   - **V4 Flash** (moss) — fast, for quick questions and summaries
   - **V4 Pro** (ember) — deeper reasoning, for complex analysis
   - **R1 Local** (terracotta) — runs on your own hardware via Ollama (privacy)
3. Toggle **Deep Think** for especially complex reasoning (available on V4 Pro)
4. Adjust **Temperature** — 0 for precise/factual, 1 for creative/divergent
5. Type your message → Enter to send, Shift+Enter for new lines

**Context Injection (most powerful feature):**
When you click **"🤖 Ask AI"** from any item detail (research entry, book, idea, project), the AI chat opens with that item's content injected as context. The AI already knows what you're looking at.

**Example flow:**
1. Open a research entry about "PID controller tuning for drone stabilization"
2. Click "🤖 Ask AI"
3. Type: "What are three alternative approaches to PID for drone stabilization, and what are their trade-offs?"
4. The AI responds knowing the full context of your research entry
5. Click **"💾 Save to Research"** on a valuable response → instantly creates a new research entry

**Chat management:**
- **New Chat** (➕ button) — starts a fresh conversation
- **Conversation list** (left sidebar) — click to resume any previous chat
- **Delete** (trash icon) — remove a conversation
- **Copy** (copy icon on each message) — copy AI response to clipboard

**Conversation persistence:** All chats are saved. Close the browser, come back next week — your conversations are still there.

---

### 4.16 Engineer Toolkit

The Engineering module is a complete toolkit for building hardware/software projects:

#### Projects (`/engineer`)
- Track IoT, embedded, robotics, and general software projects
- Each project has: name, description, type, platforms, tech stack, status, repo URL
- **Template picker** when creating: choose "Heltec IoT," "STM32 FreeRTOS," "ROS2 Python," or "Raspberry Pi Camera" to auto-fill project details
- Status workflow: Idea → Planning → Development → Testing → Deployed → Archived
- Click a project → **tabbed detail view:** Overview, Budget, Documents, Check-ins, Issues

**Budget tab:** Link budgets to projects via Universal Links → see budget vs actual with color-coded progress bars

#### Snippets (`/engineer/snippets`)
- Syntax-highlighted code snippet library
- 16 starter snippets included (common patterns for IoT/embedded)
- Categorized with search and language filters
- Copy button for one-click clipboard copy

#### Docs (`/engineer/docs`)
- Per-project markdown documentation
- Master-detail layout: list on the left, editor on the right
- Edit/Preview toggle with live markdown rendering
- Can also create global docs (not tied to a specific project)

#### Check-ins (`/engineer/checkins`)
- Weekly engineering check-ins
- Record: achievements this week, plans for next week, blockers, bugs discovered, concerns
- **Health indicator:** red dot if the latest check-in has blockers
- **Promote to Issue:** turn a concern into a tracked issue with one click

#### Issues (`/engineer/issues`)
- P0-P3 severity tracker with status workflow
- Severities: P0-Critical (red), P1-High (amber), P2-Medium (blue), P3-Low (gray)
- Filter by severity, status, project
- Pre-fill from check-in concerns

#### Roadmap (`/engineer/roadmap`)
- 12-month skills roadmap with monthly themes
- Each month has skills grouped by category: Hardware, Software, Process
- Toggle skills as completed — overall progress bar tracks your journey
- 36 skills seeded (3 per month × 12 months)

---

### 4.17 Engineer Sprint Board

- **What it is:** A consolidated sprint planning screen — active projects, critical issues, check-in status, and roadmap progress in one view.
- **When to use it:** Sprint planning sessions, daily standup with yourself.
- **Page:** `/engineer/sprint`

**What you see in one screen:**
- **Stat cards:** Total Projects, Active, Deployed, Idea-phase
- **Active Projects** — each with its open-critical issue count
- **P0/P1 Queue** — critical and high-priority issues across all projects
- **This Week's Check-in** — your latest status
- **Next Roadmap Skills** — upcoming skills to tackle

---

### 4.18 Roadmaps (Custom Learning Paths)

- **What it is:** Create unlimited learning roadmaps for any discipline. Unlike the fixed 12-month Engineer Roadmap, this is fully customizable.
- **When to use it:** Planning a learning journey — "Become an FPGA developer," "Learn ROS2," "Master PCB design."
- **Page:** `/roadmaps`

**Structure:**
- **Roadmap** — the top-level plan (e.g., "FPGA Development Path")
- **Tracks** — parallel learning tracks within a roadmap (e.g., "Digital Logic," "Verilog/VHDL," "Timing & Constraints")
- **Milestones** — specific achievements within each track (e.g., "Build a UART in Verilog," "Pass timing closure at 100MHz")

**Milestone details:**
- Status: Pending → In Progress → Completed / Skipped
- Priority: Low / Medium / High / Critical
- Due date, estimated hours, actual hours
- Resources: attach links, documents, or references as `[{title, url, type}]`
- Notes: markdown notes on your progress

**Progress is automatic:** Completing milestones recalculates track progress, which recalculates roadmap progress. Drag-and-drop visual, nothing manual.

**Practical Example:**
> Roadmap: "ESP32 IoT Development" with three tracks: (1) Hardware Interfaces — milestones for I2C, SPI, UART, ADC; (2) Wireless — milestones for WiFi, BLE, ESP-NOW; (3) Firmware — milestones for FreeRTOS tasks, OTA updates, deep sleep. As you complete each milestone, the roadmap progress bar fills. Link the roadmap to your engineering projects.

---

### 4.19 Universal Export

- **What it is:** Download all your data as a ZIP file of JSON or CSV — your data is always yours.
- **When to use it:** Regular backups, data portability, peace of mind.
- **Location:** Sidebar footer — click **"Export Data"**

**What's exported:** All 14 user-data modules: todos, transactions, accounts, categories, receivables, payables, portfolio, budgets, research entries (with topics and attachments), learning items, books, contacts, ideas, goals, time entries, chat conversations, roadmaps, habit logs, engineer projects, snippets, docs, check-ins, issues.

**Format:** Open standards — JSON and CSV. Readable by any application, no vendor lock-in.

---

### 4.20 Notifications

- **What it is:** Dual-channel reminders — browser desktop notifications and Telegram messages.
- **When it fires:** 30 minutes before a task's `due_time`, plus system alerts from Uptime Kuma.

**Browser notifications:**
- Requires permission (your browser will ask on first notification)
- Shows task title and due time
- Works even when Polymath OS is in a background tab

**Telegram integration:**
- Bot: `@Raflitriwijaya_bot`
- Send `/start` to activate
- Receives: todo reminders (30 min before due_time), server uptime alerts
- One bot handles everything — no separate channels

**Notification bell (sidebar):**
- Shows count of due/overdue items
- Click to see the full list
- Items clear as you complete tasks

---

## 5. Integrated Workflows

### 5.1 Researcher Workflow

Let's walk through a real research workflow — from idea to published insight:

1. **Capture the spark** → `Ctrl+K` → mode: Research → "Attention mechanisms might improve our sensor fusion pipeline"
2. **Develop in Research** → open `/research`, find the entry, click to edit → expand the note with full markdown: add headings, equations in code blocks, reference links
3. **Organize** → assign to topic "Sensor Fusion", add tags: `attention, transformers, multi-modal`
4. **Literature review** → create Citation entries for 3 papers on attention mechanisms → link them to the original Journal entry via Universal Links
5. **AI deep-dive** → open the Journal entry → click "🤖 Ask AI" → "Compare these three approaches to attention-based sensor fusion and recommend one for a resource-constrained embedded system"
6. **Save insight** → click "💾 Save to Research" on the AI's response → now you have a new research entry with the AI's analysis
7. **Attach files** → upload PDFs of the papers, diagrams, experimental data
8. **Connect to engineering** → link the research entries to an `engineer_project` for implementation
9. **Track time** → start the timer while working on this research
10. **Weekly Review** → see your research output for the week

### 5.2 Startup Founder Workflow

1. **Morning briefing** → open `/` (Today Dashboard) → check tasks due, today's finances, open issues
2. **Capture business ideas** → `Ctrl+K` → Idea mode → "Partner with local IoT farmers for pilot testing"
3. **Manage contacts** → open `/contacts` → add new leads, update status, link to deals
4. **Financial overview** → open `/finance/overview` → check net income, budget vs actual, outstanding receivables
5. **Track revenue** → create Revenue transactions (separate from personal Income) → shows on Today Dashboard
6. **Set quarterly goals** → `/goals` → "Close 5 enterprise deals" (Target: 5) → link contacts/deals to track progress
7. **Monday review** → `/review` → tasks done, money in/out, new contacts, ideas captured
8. **Annual perspective** → `/report` → revenue growth, contacts added, projects deployed

### 5.3 Engineer Workflow

1. **Sprint planning** → open `/engineer/sprint` → see active projects, critical issues, check-in status
2. **Pick a project** → navigate to the project detail → Overview tab shows description, platform, stack, repo link
3. **Track issues** → Issues tab → create P0-P3 issues → filter by severity → resolve as you go
4. **Weekly check-in** → `/engineer/checkins` → record what you achieved, what's next, any blockers
5. **Code snippets** → `/engineer/snippets` → save reusable code with syntax highlighting → search by category/language
6. **Document** → `/engineer/docs` → write per-project markdown docs → edit/preview toggle
7. **Budget tracking** → project detail → Budget tab → link budgets → see actual spend vs planned
8. **Monitor progress** → `/engineer/roadmap` → toggle completed skills → watch the 12-month progress bar fill

### 5.4 Polymath Workflow (Cross-Discipline Learner)

1. **Reading** → add books to the Reading tracker → update pages as you go
2. **Timer** → start timer while reading → track hours per book
3. **Research** → capture insights from books as Research entries
4. **Link** → link books to research entries → link research to projects
5. **Learning** → track online courses, tutorials → update progress and hours
6. **Roadmaps** → create custom learning paths for each discipline
7. **Goals** → set annual targets ("Read 24 books," "Complete 3 courses," "Ship 2 projects")
8. **Annual Report** → end of year: see everything in one beautiful report — books, papers, projects, hours

---

## 6. AI Chat Features (Deep Dive)

### 6.1 Models

| Model | Speed | Best for | Notes |
|-------|-------|----------|-------|
| **V4 Flash** | Fast | Quick questions, summaries, drafting | Default model |
| **V4 Pro** | Slower, deeper | Complex analysis, reasoning, decisions | Enable Deep Think for maximum depth |
| **R1 Local** | Variable | Privacy-sensitive work | Runs on local hardware via Ollama |

### 6.2 Deep Think Mode

Toggle **Deep Think** (available on V4 Pro) for the most important decisions. The model spends more time reasoning — visible as a thinking indicator — before responding. Use for:
- Evaluating strategic options
- Complex technical analysis
- Multi-step problem solving
- Decisions with significant consequences

### 6.3 Context Injection

This is what makes AI Chat uniquely powerful in Polymath OS:

- Open any research entry, book, idea, or engineering project
- Click **"🤖 Ask AI"** in the detail modal
- The AI receives the full content of that item as context
- Ask questions about it, ask for summaries, ask for related ideas
- The AI understands exactly what you're working on

### 6.4 Save to Research

Any AI response can become a permanent part of your knowledge base:
- Click **"💾 Save to Research"** below any AI message
- A new research entry is created with the AI's response as content
- Edit, tag, and link it like any other research entry
- Content is capped at 10,000 characters per save

---

## 7. Tips & Tricks

### Daily habits for maximum value:
1. **Use Quick Capture obsessively** — every idea, task, or insight, the moment it occurs. `Ctrl+K` is your best friend
2. **Morning dashboard check** — 2 minutes to know what matters today
3. **Timer everything** — you can't improve what you don't measure. Start the timer for deep work
4. **Link everything** — the more connections, the more valuable your knowledge graph becomes. A research entry linked to a book linked to a project is worth 10x an isolated note

### Weekly habits:
5. **Monday Weekly Review** — 5 minutes to see last week's output and plan this week
6. **Check notification bell** — don't let due items pile up
7. **Update learning progress** — spent hours and progress percentage

### Monthly habits:
8. **Finance Overview** — 10 minutes to review money: income, expenses, budget adherence, portfolio
9. **Goals check** — recalculate goal progress from linked items
10. **Export your data** — "Export Data" in sidebar footer. Regular backups = peace of mind

### Power-user moves:
11. **AI context injection** — always use "Ask AI" from item details, never start from a blank chat
12. **Deep Think for big decisions** — toggle it on when the answer really matters
13. **Convert ideas systematically** — New → Developing → Validated → Convert to Project/Task/Research
14. **Bulk research operations** — select multiple entries → archive or delete at once
15. **Semantic search** — when keyword search fails, toggle to Semantic mode to find by meaning

### Money input rule:
- **Type raw numbers without formatting:** `50000` not `50.000`, `1500000` not `1.500.000`
- The system auto-formats for display. Adding dots will cause wrong values.

---

## 8. Common Troubleshooting

| Issue | Solution |
|-------|----------|
| **502 Bad Gateway** | Server is restarting — wait 2-3 minutes, then refresh |
| **Cannot log in** | Clear browser cache and cookies, or try an Incognito/Private window |
| **Money input shows wrong value** | You likely typed dots (e.g., `50.000`). Type raw numbers only: `50000` |
| **AI Chat not responding** | The server's `DEEPSEEK_API_KEY` may need checking. Contact your server admin |
| **Telegram notifications not arriving** | Make sure you've sent `/start` to `@Raflitriwijaya_bot` |
| **Forgot password** | No self-service reset yet — contact your server administrator |
| **Attachment upload fails** | File must be under 10 MB. Supported formats: JPG, PNG, PDF, TXT, MD, CPP, PY, ZIP |
| **Page shows error state** | Click the **Retry** button on the error card. If it persists, wait a minute and refresh |
| **Sidebar not visible on mobile** | Tap the hamburger menu (☰) in the top bar to open the sidebar |
| **Timer not stopping** | Starting a new timer automatically stops the previous one. Only one timer runs at a time |

---

## 9. Telegram Integration

Polymath OS uses a single Telegram bot (`@Raflitriwijaya_bot`) for all notifications:

**Setup:**
1. Open Telegram → search for `@Raflitriwijaya_bot`
2. Send `/start` to activate
3. You're connected — no additional configuration needed

**What you receive:**
- **Todo reminders** — 30 minutes before a task's `due_time`
- **Server alerts** — if the server goes down (via Uptime Kuma monitoring)

**Pro tip:** Set `due_time` on any time-sensitive task. A 14:00 meeting reminder at 13:30 gives you exactly enough time to wrap up what you're doing.

---

## 10. Data Backup & Security

### Your data is yours — always

**Self-service export:**
- Click **"Export Data"** in the sidebar footer
- Downloads a ZIP file containing all your data in JSON and CSV formats
- Open formats — readable by any text editor, spreadsheet, or script
- No vendor lock-in: even without Polymath OS, your data is fully accessible

**Automated backups:**
- Server runs nightly backups at 02:00 local time
- Encrypted and pushed to Cloudflare R2 cloud storage
- Restore process is tested and verified (last test: June 16, 2026 ✅)

**Security:**
- All connections go through Cloudflare with automatic HTTPS
- Session-based authentication with httpOnly cookies
- Rate limiting on login (5 attempts per 15 minutes) to prevent brute force
- Security headers: X-Frame-Options, Content-Security-Policy, HSTS
- File attachments are served through authenticated routes — no public URLs

---

## 11. Quick Reference Card

| I want to… | Go to… | Shortcut |
|-------------|--------|----------|
| See today's priorities | `/` (Dashboard) | — |
| Capture an idea/task/note | Any page | `Ctrl+K` |
| Search everything | Quick Capture → Search mode | `Ctrl+K` then Tab to Search |
| Create a task | `/todo` → New Task | `Ctrl+K` → Task mode |
| Log a transaction | `/finance` → New Transaction | — |
| Write research notes | `/research` → New Entry | `Ctrl+K` → Research mode |
| Add a book | `/reading` → Add Book | — |
| Log learning progress | `/learning` → New Item | — |
| Add a contact | `/contacts` → Add Contact | — |
| Start the timer | Any item detail → Start Timer | — |
| Chat with AI | `/ai-chat` | — |
| Ask AI about an item | Item detail → Ask AI | — |
| Link two items | Item detail → Linked Items → Add Link | — |
| Weekly review | `/review` | — |
| Check goals | `/goals` | — |
| Sprint planning | `/engineer/sprint` | — |
| See annual report | `/report` | — |
| Export all data | Sidebar footer → Export Data | — |

---

> **Remember:** Polymath OS is a tool, not a burden. Start with Quick Capture and the Today Dashboard. Add modules as you need them. The system grows with you — additive evolution means every new feature builds on what's already there, never replaces it.

> **Questions or issues?** Your server administrator is your first point of contact. This guide is version-controlled alongside the codebase at `docs/GUIDELINE_USER.md`.

---

*Last updated: June 17, 2026*
