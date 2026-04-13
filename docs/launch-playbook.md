# Spekris Launch Playbook
# Your task engine is this document. Execute it.

## PHASE 1: Verify product works (Today — 30 min)

### Task 1: Fix Supabase auth
- [ ] Go to supabase.com/dashboard → your project → Authentication → URL Configuration
- [ ] Set Site URL to: https://spekris.com
- [ ] Add Redirect URL: https://spekris.com/**
- [ ] Save
- [ ] Open incognito browser on DESKTOP
- [ ] Go to spekris.com/auth/login
- [ ] Enter a NEW email (not your existing account)
- [ ] Check inbox → click magic link
- [ ] Confirm you land on /onboarding
- [ ] DONE when: screenshot of /onboarding page from new account

### Task 2: Complete the product flow
- [ ] Create org name in onboarding
- [ ] Connect GitHub (use an account with AI code if possible)
- [ ] Wait for scan to complete
- [ ] View dashboard — confirm signal cards show data
- [ ] Click into an asset — confirm "Why this matters" section shows
- [ ] Assign yourself as owner on the asset
- [ ] Mark asset as reviewed
- [ ] Go to Compliance — confirm score updated
- [ ] Go to Policies — activate 1 governance template
- [ ] Download a compliance report
- [ ] DONE when: full flow works end-to-end on desktop

---

## PHASE 2: Record demo video (Tomorrow — 30 min)

### Demo script (90 seconds):

**[0-10s] Hook**
Show the landing page. Say or caption:
"Most companies don't know what AI systems are running in their code."

**[10-25s] Connect**
Click "Start free" → sign in → go to Connectors → Connect GitHub.
"Spekris connects to your GitHub org and scans every repo."

**[25-45s] Scan results**
Show the dashboard with findings.
"In 60 seconds, it found 5 AI systems — 2 with no owner, 1 critical risk."

**[45-65s] Take action**
Click into a critical asset. Show "Why this matters" and "What you should do."
Click "Assign owner." Click "Mark reviewed."
"Every finding tells you why it matters and what to do next."

**[65-80s] Compliance**
Show compliance page with scores.
"Compliance is auto-assessed across EU AI Act, SOC 2, ISO 42001, and NIST."
Download the report.

**[80-90s] CTA**
"Try free at spekris.com. Find your shadow AI in 5 minutes."

### Recording tips:
- Use Loom (free) or QuickTime screen record
- Desktop only, clean browser with no tabs
- Use a GitHub account with repos that import openai/langchain/anthropic
- No narration needed — captions work fine
- Upload to YouTube (unlisted) or Loom

---

## PHASE 3: Outreach (This week — 2 hours)

### 10 LinkedIn DM templates

**Message 1 — Security leader at SaaS company:**
"Hi [name], I noticed [company] is scaling fast in the AI space. I'm building a tool that scans GitHub orgs for undocumented AI systems — LLM calls, agent frameworks, API keys — and maps them to compliance frameworks automatically. Before I go further, wanted to ask: is inventorying AI usage across your engineering team something that comes up? Would love 15 min of your perspective."

**Message 2 — Compliance officer:**
"Hi [name], with EU AI Act enforcement coming in August, I've been talking to compliance teams about how they're inventorying their AI systems. I built a scanner that connects to GitHub/AWS and auto-maps findings to EU AI Act, SOC 2, and ISO 42001 controls. Would it be useful to see what it finds on a sample repo? Happy to do a free scan."

**Message 3 — VP Engineering:**
"Hi [name], quick question — does your team have a clear inventory of every AI integration running across your repos? I built a tool that scans for OpenAI, LangChain, Anthropic usage and flags unowned or undocumented systems. Free to try, takes 5 min to connect GitHub. Would a tool like this be useful for your team?"

**Message 4 — CTO at mid-market:**
"Hi [name], I'm working on shadow AI detection — a tool that scans code repos for AI systems that were deployed without formal approval or documentation. Think of it as an AI asset inventory for security/compliance teams. Is this a problem you've run into as [company] scales?"

**Message 5 — Head of Security:**
"Hi [name], I've been researching how security teams are handling AI governance. Built a tool that auto-discovers AI systems across GitHub/AWS and generates compliance documentation for SOC 2 and EU AI Act. Would you be open to a 15-min chat about how [company] approaches AI oversight? Happy to share what I've learned from other teams."

**Message 6 — For companies that mention AI in their product:**
"Hi [name], saw that [company] uses AI for [specific feature from their website]. Curious — do you have full visibility into all the AI integrations across your engineering org, or do new ones pop up without documentation? I built a free scanner that maps AI usage to compliance controls. Would that be useful?"

**Message 7 — For EU-based companies:**
"Hi [name], with EU AI Act enforcement starting August 2026, I've been talking to companies about AI inventory challenges. Built a tool that scans source code for AI systems and auto-maps to Article 9-17 controls. Would a free scan of your GitHub org be interesting? Takes 5 minutes."

**Message 8 — For companies hiring for AI governance:**
"Hi [name], noticed [company] posted a role related to AI governance — sounds like this is becoming a priority for you. I built a tool that automates the first step: discovering and inventorying AI systems across your codebase. Would love to hear what problems you're solving in this space."

**Message 9 — Warm intro request:**
"Hi [name], I'm building in the AI governance space (tool that scans repos for undocumented AI and maps to compliance frameworks). Do you know anyone in security or compliance who's actively working on AI inventory? Would love an intro if so."

**Message 10 — Follow-up (send 3 days after no response):**
"Hi [name], following up — I know these come out of nowhere. Quick version: free tool that scans your GitHub for AI systems nobody documented. 5-minute setup. If that sounds useful, happy to set it up for you. If not, no worries at all."

### How to find targets:
1. LinkedIn search: "Head of Security" + filter by company size 50-500
2. LinkedIn search: "Compliance Officer" + "AI" or "SaaS"
3. Search for companies that posted jobs mentioning "AI governance" or "EU AI Act"
4. Check YC company list for AI-adjacent startups with 50+ employees
5. Search ProductHunt for recently launched AI products → find their security/compliance person

### Tracking:
Create a simple Google Sheet:
| Name | Title | Company | Size | LinkedIn URL | DM Sent | Response | Follow-up | Notes |

---

## PHASE 4: First pilot (Week 2)

For anyone who responds positively:
- [ ] Offer free access — "I'll set up your org, you connect GitHub, tell me what's missing"
- [ ] Get on a 15-min Zoom call to watch them use it
- [ ] Take notes on what confuses them
- [ ] Ask: "Would you pay $99/month for this?"
- [ ] Ask: "What would make this a must-have?"
- [ ] If they say yes to paying: set up Stripe checkout
- [ ] If they say no: ask what would change their mind

---

## Success metrics:
- [ ] Auth works for new users
- [ ] Demo video recorded and on landing page
- [ ] 20 DMs sent
- [ ] 3+ responses received
- [ ] 1 pilot user connected
- [ ] 1 person said "I'd pay for this"
