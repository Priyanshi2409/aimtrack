import "server-only";
import { addDays, startOfWeek, todayIn, type ISODate } from "@/lib/core/dates";
import { withUser, type Tx } from "@/lib/db/client";
import * as repo from "@/lib/db/repo";

/**
 * Realistic sample goals with a few weeks of history, so every screen looks alive
 * on first launch. All research findings below point to real, checked sources
 * (verified while building the app); nothing is invented.
 */

type Diff = "easy" | "medium" | "hard";
type PoolTask = [title: string, why: string, minutes: number, diff: Diff, query?: string, url?: string];

interface SampleGoal {
  key: string;
  title: string;
  raw: string;
  category: string;
  color: string;
  minutes: number;
  startedDaysAgo: number;
  totalDays: number;
  completion: number; // probability a past task was completed
  hour: number; // typical local hour of completion
  answers: { id: string; question: string; answer: string }[];
  feasibility: { score: number; verdict: string; reasons: string[]; suggested_deadline: string | null };
  phases: { title: string; description: string; weeks: number; milestones: [string, string][]; targets: string[]; pool: PoolTask[] }[];
  research: { kind: "examples" | "requirements" | "pitfalls"; title: string; summary: string; detail: Record<string, unknown>; url: string; source: string }[];
  examples: { summary: string; source_url: string }[];
  blockers: string[];
}

const PM_URLS = {
  gaurav: "https://internshala.com/blog/reflecting-on-my-journey-of-becoming-a-product-manager/",
  phani: "https://www.mindtheproduct.com/self-discovery-and-landing-a-product-management-internship/",
  sonali: "https://medium.com/internclick/intern-story-3-sonalis-product-management-internship-snapdeal-178f77c87d8c",
  airfocus: "https://airfocus.com/blog/how-to-land-internship-product-management/",
};
const RUN_URLS = {
  higdon: "https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/",
  sally: "https://healthunlocked.com/couchto5k/posts/130608787/couch-to-half-marathon-in-5-months",
  uchicago: "https://www.uchicagomedicineadventhealth.org/blog/avoiding-injury-while-training-a-half-marathon",
};
const CAFE_URLS = {
  csb: "https://en.wikipedia.org/wiki/Anubhav_Dubey",
  downtown: "https://yourstory.com/2018/01/downtown-cafe-srinagar-kashmir",
  costs: "https://www.restaurantindia.in/article/cafe-business-in-india-setup-cost-profit-margins-what-nobody-tells-you.16054",
  fssai: "https://tallysolutions.com/business-guides/fssai-license-fees-cost-of-food-business-registration/",
};

export const SAMPLE_GOALS: SampleGoal[] = [
  {
    key: "pm",
    title: "Land a PM internship",
    raw: "Crack a product management internship in 6 months",
    category: "career",
    color: "lime",
    minutes: 90,
    startedDaysAgo: 26,
    totalDays: 182,
    completion: 0.82,
    hour: 20,
    answers: [
      { id: "level", question: "Where are you starting from?", answer: "Final-year CSE student, no PM experience, some data projects" },
      { id: "budget", question: "Budget for courses or tools?", answer: "₹0 (free only)" },
      { id: "constraints", question: "Anything to plan around?", answer: "College placements in Nov–Dec, end-sem exams in December" },
    ],
    feasibility: {
      score: 62,
      verdict: "Ambitious but doable",
      reasons: [
        "Six months is enough to build 2–3 product case studies and a referral network. The paths in the research took about a year, but they started with less direction.",
        "90 min/day gives roughly 270 hours, enough for fundamentals, a portfolio and interview prep if networking starts early.",
        "December exams will cost about 3 weeks, so the plan front-loads fundamentals and portfolio work before then.",
        "PM internships are mostly filled through outreach and referrals, not job boards [4], so how many people you reach out to matters most.",
      ],
      suggested_deadline: null,
    },
    phases: [
      {
        title: "PM foundations",
        description: "Understand what PMs actually do and build a shared vocabulary.",
        weeks: 4,
        milestones: [
          ["Explain the PM role end-to-end", "Can walk through discovery → prioritisation → launch → metrics with one real example"],
          ["Teardown of 2 products", "Two written teardowns published on LinkedIn/Notion"],
        ],
        targets: ["Read 3 PM case studies", "Write 1 product teardown", "5 coffee-chat requests to PMs"],
        pool: [
          ["Read a real PM origin story and note 3 transferable skills", "Seeing a real path makes the target concrete.", 30, "easy", undefined, PM_URLS.gaurav],
          ["Map your projects to PM skills (user, data, delivery)", "Turns what you already did into PM evidence.", 40, "medium"],
          ["Write a 1-page teardown of Swiggy's reorder flow", "Teardowns are the fastest proof of product thinking.", 60, "hard", "Swiggy app product teardown example"],
          ["Learn RICE and MoSCoW prioritisation", "Prioritisation questions show up in every PM interview.", 35, "medium", "RICE prioritization framework explained"],
          ["Send 3 personalised LinkedIn notes to PMs", "Most internships come through people, not portals.", 25, "easy", undefined, PM_URLS.airfocus],
          ["Watch a mock PM interview and note the structure", "Knowing the format early shapes what you practise.", 30, "easy", "product manager mock interview product sense"],
          ["Define 3 success metrics for a feature you use daily", "Metrics fluency separates PMs from idea people.", 30, "medium"],
        ],
      },
      {
        title: "Build proof of work",
        description: "Create case studies that show product sense on real problems.",
        weeks: 7,
        milestones: [
          ["Case study #1 shipped", "Problem → research → solution → metrics, published with visuals"],
          ["Case study #2 with user interviews", "At least 5 user interviews synthesised"],
        ],
        targets: ["Interview 2–3 users", "One case-study section per 2 days", "Share draft for feedback"],
        pool: [
          ["Interview 2 classmates about how they find internships", "User interviews ground a case study in reality.", 45, "medium"],
          ["Write the problem statement for case study #1", "A sharp problem statement drives every later decision.", 40, "medium"],
          ["Sketch 3 solution options in Figma", "Showing alternatives demonstrates judgement.", 60, "hard", "Figma wireframing for beginners"],
          ["Pick a north-star metric and 2 guardrails", "Interviewers probe metrics hard.", 30, "medium"],
          ["Ask a PM for 10-min feedback on your draft", "Outside feedback catches blind spots early.", 20, "easy"],
        ],
      },
      {
        title: "Network & apply",
        description: "Get in front of hiring PMs through referrals and targeted outreach.",
        weeks: 8,
        milestones: [["30 targeted applications / referrals", "Tracked in a sheet with status"], ["5 interviews scheduled", "At least 5 first-round interviews"]],
        targets: ["10 outreach messages", "5 applications", "2 follow-ups"],
        pool: [
          ["Shortlist 10 startups hiring product interns", "Focus beats volume.", 40, "medium"],
          ["Send 5 referral requests with your case study link", "Referrals massively lift reply rates.", 35, "medium"],
          ["Follow up on last week's outreach", "Most replies come after a follow-up.", 20, "easy", undefined, PM_URLS.airfocus],
        ],
      },
      {
        title: "Interview prep & offers",
        description: "Product sense, metrics and behavioural rounds.",
        weeks: 7,
        milestones: [["10 mock interviews done", "Peer or recorded mocks with notes"], ["Offer accepted", "Signed internship offer"]],
        targets: ["3 mock interviews", "Review 1 weak area", "Refine stories"],
        pool: [
          ["Do a 30-min product sense mock with a peer", "Repetition is the only way to get fluent.", 45, "hard"],
          ["Write 3 STAR stories from your projects", "Behavioural rounds reward prepared stories.", 40, "medium"],
        ],
      },
    ],
    research: [
      {
        kind: "examples",
        title: "Gaurav Sahu: support intern → Principal PM at Internshala",
        summary:
          "From a Hindi-medium school in Durg, Chhattisgarh, he missed on-campus placements, joined Internshala as an operations/customer-support intern, spotted a process to automate, prototyped fixes in MS Paint and Illustrator, and moved into product with a mentor's help.",
        detail: { who: "Gaurav Sahu, Principal PM at Internshala", timeline: "Intern → PM, then 1.5 years on recruitment products", key_steps: ["Start in any role close to product", "Prototype improvements proactively", "Find a mentor, accept hard feedback"] },
        url: PM_URLS.gaurav,
        source: "Internshala Blog",
      },
      {
        kind: "examples",
        title: "Phani Munipalli: engineer → PM intern in about a year",
        summary:
          "A software engineer with 4+ years at IBM and Walmart spent 3–4 hours a day on LinkedIn coffee chats with 40+ PMs, mapped his skills to PM gaps, and landed a Summer 2023 PM internship after a former colleague shared an opening.",
        detail: { who: "Phani Sai Ram Munipalli", timeline: "About 1 year", key_steps: ["40+ PM coffee chats", "Skill-gap mapping from JDs", "Repeated mock interviews"] },
        url: PM_URLS.phani,
        source: "Mind the Product",
      },
      {
        kind: "examples",
        title: "Sonali: off-campus PM internship at Snapdeal",
        summary:
          "An IIT Kanpur earth-sciences student with no CS degree got interviews through cold email and LinkedIn outreach in her third year, then spent 58 days at Snapdeal analysing return-to-origin orders with SQL.",
        detail: { who: "Sonali, IIT Kanpur '20", timeline: "Outreach in 3rd year; 58-day internship", key_steps: ["Cold email + LinkedIn outreach", "Use SQL for product analysis"] },
        url: PM_URLS.sonali,
        source: "InternClick on Medium",
      },
      {
        kind: "requirements",
        title: "What PM internship recruiters look for",
        summary:
          "Working knowledge of product tools and basic technical understanding, evidence of initiative (projects, side hustles), market and problem analysis, and strong communication. Cold emails and LinkedIn outreach to PMs are recommended over job boards alone.",
        detail: { type: "skill" },
        url: PM_URLS.airfocus,
        source: "airfocus",
      },
      {
        kind: "pitfalls",
        title: "Only applying through job portals",
        summary: "Limiting the search to formal postings, not following up, and giving up after rejections are the common mistakes. Persisting and staying in touch with contacts is what converts.",
        detail: { fix: "Send targeted outreach weekly and follow up on every message after 5–7 days." },
        url: PM_URLS.airfocus,
        source: "airfocus",
      },
      {
        kind: "pitfalls",
        title: "Shipping without user research",
        summary: "Gaurav's first feature launched without proper user research, and his CTO told him to work on analytical thinking. That's why being data-driven and understanding user journeys became his core lesson.",
        detail: { fix: "Every case study starts with interviews and a metric, not a solution." },
        url: PM_URLS.gaurav,
        source: "Internshala Blog",
      },
    ],
    examples: [
      { summary: "Gaurav Sahu went from support intern to Principal PM at Internshala by prototyping fixes and finding a mentor.", source_url: PM_URLS.gaurav },
      { summary: "Phani Munipalli landed a PM internship in about a year through 40+ coffee chats and deliberate skill-gap work.", source_url: PM_URLS.phani },
    ],
    blockers: ["College assignment deadline", "Slept late, low focus", "Placement test prep took the evening", "", "", ""],
  },
  {
    key: "run",
    title: "Run my first half marathon",
    raw: "Run a half marathon by February",
    category: "fitness",
    color: "ember",
    minutes: 50,
    startedDaysAgo: 19,
    totalDays: 140,
    completion: 0.74,
    hour: 7,
    answers: [
      { id: "level", question: "How much can you run today?", answer: "About 3 km without stopping" },
      { id: "budget", question: "Budget for gear?", answer: "Under ₹5,000 (shoes)" },
      { id: "constraints", question: "Anything to plan around?", answer: "Mornings only; monsoon rain until mid-October" },
    ],
    feasibility: {
      score: 71,
      verdict: "Achievable",
      reasons: [
        "Hal Higdon's Novice 1 plan assumes you can run about 3 miles (~5 km) 3–4× a week, then takes 12 weeks [2]. You're at 3 km, so a 6-week base block comes first.",
        "20 weeks leaves room for a 6-week base plus the 12-week plan and a 2-week buffer.",
        "The main risk is injury from ramping mileage too fast, so the plan caps weekly increases at about 10% [3].",
      ],
      suggested_deadline: null,
    },
    phases: [
      {
        title: "Base building",
        description: "Get to 5 km comfortably, 3–4 times a week.",
        weeks: 6,
        milestones: [["Run 5 km non-stop", "5 km at conversational pace without walking"], ["4 runs/week habit", "Two consecutive weeks with 4 runs"]],
        targets: ["3–4 easy runs", "1 strength session", "Weekly distance +10% max"],
        pool: [
          ["Easy run: 3 km at conversational pace", "Aerobic base is built at easy effort.", 30, "easy"],
          ["Run/walk intervals: 6 × (4 min run, 1 min walk)", "Intervals extend time on feet safely.", 35, "medium"],
          ["Strength: squats, lunges, planks (20 min)", "Hip and core strength prevent common running injuries.", 20, "medium", undefined, RUN_URLS.uchicago],
          ["Long run: 4 km, walk breaks allowed", "The long run is the key session for half-marathon prep.", 40, "hard", undefined, RUN_URLS.higdon],
          ["Mobility + foam roll (15 min)", "Recovery keeps you consistent.", 15, "easy"],
        ],
      },
      {
        title: "Novice 1 (12-week plan)",
        description: "Follow Hal Higdon's Novice 1 structure: 4 runs, 2 cross-training, long run builds to 10 miles.",
        weeks: 12,
        milestones: [["10K done", "Finish a 10K (race or solo) around week 9"], ["16 km long run", "Complete the peak long run"]],
        targets: ["4 runs incl. long run", "2 cross-training days", "2 rest days"],
        pool: [["Long run (plan distance)", "Builds race endurance.", 50, "hard", undefined, RUN_URLS.higdon]],
      },
      {
        title: "Taper & race",
        description: "Reduce volume, sharpen, race.",
        weeks: 2,
        milestones: [["Race day", "Finish 21.1 km"]],
        targets: ["Reduce volume by ~40%", "Practise race-day fuelling"],
        pool: [["Race-pace 5 km", "Locks in race rhythm.", 35, "medium"]],
      },
    ],
    research: [
      {
        kind: "examples",
        title: "Sally: Couch to 5K → Cambridge Half in 5 months",
        summary:
          "Started Couch to 5K in October, began building distance on 1 January, practised fuelling on long runs, and finished the Cambridge Half Marathon in 3:17 on a hot day. Her main lesson: stick to the training plan.",
        detail: { who: "Sally (NHS Couch to 5K community)", timeline: "5 months", key_steps: ["C25K first", "Weekly distance build", "Practise water and fuel"] },
        url: RUN_URLS.sally,
        source: "HealthUnlocked, Couch to 5K forum",
      },
      {
        kind: "requirements",
        title: "Hal Higdon Novice 1: 12 weeks, 3 miles to start",
        summary:
          "Prerequisite: run about 3 miles, 3–4 times a week. Plan: 4 running days, 2 cross-training days, 2 rest days; the long run builds from 4 to 10 miles by week 11. Optional 5K at week 6 and 10K at week 9.",
        detail: { type: "timeline", time: "12 weeks" },
        url: RUN_URLS.higdon,
        source: "Hal Higdon",
      },
      {
        kind: "requirements",
        title: "Shoes and strength work",
        summary: "Replace running shoes every 300–500 miles, and do 2 weekly strength sessions for core and hip stability (squats, lunges, planks).",
        detail: { type: "resource" },
        url: RUN_URLS.uchicago,
        source: "UChicago Medicine AdventHealth",
      },
      {
        kind: "pitfalls",
        title: "Increasing mileage too fast",
        summary: "Rapid mileage jumps, skipped recovery days, and no warm-ups lead to IT band syndrome, runner's knee, shin splints and stress fractures.",
        detail: { fix: "Keep weekly distance increases under 10% and schedule rest days." },
        url: RUN_URLS.uchicago,
        source: "UChicago Medicine AdventHealth",
      },
    ],
    examples: [{ summary: "Sally went from Couch to 5K to finishing the Cambridge Half Marathon in 5 months by sticking to a plan.", source_url: RUN_URLS.sally }],
    blockers: ["Rain, skipped the outdoor run", "Knee felt tight", "Woke up late", "", "", ""],
  },
  {
    key: "cafe",
    title: "Open a café in Indore",
    raw: "Open a café in Indore within 3 years",
    category: "business",
    color: "sky",
    minutes: 45,
    startedDaysAgo: 12,
    totalDays: 3 * 365,
    completion: 0.63,
    hour: 21,
    answers: [
      { id: "level", question: "Any food-business experience?", answer: "None. I love coffee and hosting." },
      { id: "budget", question: "Rough budget you could raise?", answer: "₹8–12 lakh with family support" },
      { id: "constraints", question: "Anything to plan around?", answer: "Working full-time for the first 2 years" },
    ],
    feasibility: {
      score: 58,
      verdict: "Ambitious but doable",
      reasons: [
        "A small 200–400 sq ft café typically needs ₹8–15 lakh [3], so your ₹8–12 lakh budget fits a small-format or kiosk launch, but not a premium café.",
        "Chai Sutta Bar started in Indore in 2016 with about ₹3 lakh [1], which shows a low-capex concept can work there.",
        "The biggest risks are location and over-spending on interiors. Three years is enough to test the concept (pop-ups, a kiosk) before signing a lease.",
      ],
      suggested_deadline: null,
    },
    phases: [
      {
        title: "Learn the business",
        description: "Understand café unit economics before spending anything.",
        weeks: 10,
        milestones: [["Unit economics model", "Spreadsheet with food, labour and rent % targets"], ["Work 20 shifts in a café", "Hands-on operations experience"]],
        targets: ["Visit 2 cafés and note operations", "Read 1 cost breakdown", "1 hour on the model"],
        pool: [
          ["Read a café cost breakdown and note the 5 biggest costs", "Real numbers stop you from over-investing in interiors.", 30, "easy", undefined, CAFE_URLS.costs],
          ["Visit a busy café in Vijay Nagar and count covers for an hour", "Footfall data beats gut feel on location.", 60, "medium"],
          ["Build a simple P&L sheet (food <35%, labour <30%, rent <20%)", "These ratios decide whether a busy café is profitable.", 45, "medium", undefined, CAFE_URLS.costs],
          ["Research how Chai Sutta Bar started on ₹3 lakh", "A local low-capex precedent for your concept.", 25, "easy", undefined, CAFE_URLS.csb],
          ["List FSSAI and municipal licences you'll need", "Licences take time. Knowing early avoids launch delays.", 25, "easy", undefined, CAFE_URLS.fssai],
          ["Interview one café owner (10 questions)", "First-hand lessons are the cheapest education.", 45, "hard"],
        ],
      },
      {
        title: "Validate the concept",
        description: "Test menu and demand with pop-ups before committing capital.",
        weeks: 26,
        milestones: [["3 pop-ups run", "3 weekend pop-ups with sales data"], ["Menu of 12 items", "Costed menu with target margins"]],
        targets: ["Menu testing", "Supplier calls", "Pop-up planning"],
        pool: [["Cost out 3 menu items", "Margins decide the menu, not taste alone.", 40, "medium"]],
      },
      {
        title: "Save, plan & find location",
        description: "Build the fund and shortlist locations.",
        weeks: 80,
        milestones: [["Fund target reached", "₹10 lakh saved/raised"], ["Location shortlist", "3 locations with footfall counts"]],
        targets: ["Monthly savings", "1 location visit/week"],
        pool: [["Visit a potential location at peak hour", "Location is the #1 reason cafés fail.", 60, "medium"]],
      },
      {
        title: "Build & launch",
        description: "Fit-out, hiring, licences and soft launch.",
        weeks: 40,
        milestones: [["Licences approved", "FSSAI, Shop & Establishment, GST"], ["Soft launch", "Two-week soft launch with friends and family"]],
        targets: ["Fit-out milestones", "Hiring", "Launch marketing"],
        pool: [["Apply for FSSAI registration on FoSCoS", "Mandatory before serving food.", 40, "medium", undefined, CAFE_URLS.fssai]],
      },
    ],
    research: [
      {
        kind: "examples",
        title: "Chai Sutta Bar: started in Indore on about ₹3 lakh",
        summary:
          "Anubhav Dubey and Anand Nayak opened the first outlet in Indore in 2016 with roughly ₹3 lakh, serving tea in kulhads near a girls' hostel. The brand later grew to about 380 outlets.",
        detail: { who: "Anubhav Dubey & Anand Nayak", timeline: "2016 → ~380 outlets", key_steps: ["Low-capex format", "Strong single-product identity", "Location near students"] },
        url: CAFE_URLS.csb,
        source: "Wikipedia",
      },
      {
        kind: "examples",
        title: "Downtown Café, Srinagar: ₹60 lakh, 8 months to build",
        summary:
          "Brothers Suhail and Nadeem Bhat spent 8 months building a 90-seat café in a three-storey building and opened in November 2017. They served 1,200 tables in two months despite frequent curfews.",
        detail: { who: "Suhail & Nadeem Bhat", timeline: "8 months build", key_steps: ["Researched ideas for months", "Focused on operations despite disruptions"] },
        url: CAFE_URLS.downtown,
        source: "YourStory",
      },
      {
        kind: "requirements",
        title: "Setup cost for a small café: ₹8–15 lakh",
        summary:
          "Kiosk ₹3–5 lakh; small café (200–400 sq ft) ₹8–15 lakh; mid-size ₹15–30 lakh. Licences cost ₹35,000–1.5 lakh. Keep food cost under 35%, labour under 30% and occupancy under 20% of revenue.",
        detail: { type: "cost", cost: "₹8–15 lakh (small café)" },
        url: CAFE_URLS.costs,
        source: "Restaurant India",
      },
      {
        kind: "requirements",
        title: "FSSAI: basic registration is ₹100/year under ₹1.5 cr turnover",
        summary: "Food businesses register on the FoSCoS portal. Basic registration (turnover up to ₹1.5 crore) costs ₹100 per year; a state licence costs ₹2,000–5,000.",
        detail: { type: "certification", cost: "₹100/year" },
        url: CAFE_URLS.fssai,
        source: "Tally Solutions",
      },
      {
        kind: "pitfalls",
        title: "Poor location and over-invested interiors",
        summary: "The top reasons cafés fail: poor location, weak pricing, over-investing in interiors before understanding operations, few repeat customers, oversized menus, and rent above 20% of revenue.",
        detail: { fix: "Validate demand with pop-ups and footfall counts before signing a lease; keep the menu small." },
        url: CAFE_URLS.costs,
        source: "Restaurant India",
      },
    ],
    examples: [
      { summary: "Chai Sutta Bar opened its first outlet in Indore in 2016 on about ₹3 lakh.", source_url: CAFE_URLS.csb },
      { summary: "Downtown Café in Srinagar took ₹60 lakh and 8 months to build, then served 1,200 tables in two months.", source_url: CAFE_URLS.downtown },
    ],
    blockers: ["Long day at work", "Family function", "", "", ""],
  },
];

/** Tiny deterministic PRNG so sample data looks the same on every seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function istTimestamp(date: ISODate, hour: number, minute: number) {
  // IST = UTC+5:30
  const utcMinutes = hour * 60 + minute - 330;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(utcMinutes);
  return d;
}

async function insertSampleGoal(tx: Tx, userId: string, g: SampleGoal, today: ISODate, rand: () => number) {
  const start = addDays(today, -g.startedDaysAgo);
  const deadline = addDays(start, g.totalDays);
  const goal = await repo.createGoal(tx, userId, {
    title: g.title,
    raw_input: g.raw,
    category: g.category,
    context: { answers: g.answers },
    deadline,
    minutes_per_day: g.minutes,
    start_date: start,
    color: g.color,
  });

  await repo.saveResearch(tx, userId, goal.id, "examples", toOutcome(g, "examples"));
  await repo.saveResearch(tx, userId, goal.id, "requirements", toOutcome(g, "requirements"));
  await repo.saveResearch(tx, userId, goal.id, "pitfalls", toOutcome(g, "pitfalls"));

  // Phases + milestones
  let cursor = start;
  const phaseRows: { id: string; start: ISODate; end: ISODate; milestones: string[]; pool: PoolTask[] }[] = [];
  for (let i = 0; i < g.phases.length; i++) {
    const p = g.phases[i];
    const end = addDays(cursor, p.weeks * 7 - 1);
    const id = await repo.insertPhase(tx, userId, goal.id, {
      idx: i,
      title: p.title,
      description: p.description,
      duration_weeks: p.weeks,
      start_date: cursor,
      end_date: end,
      weekly_targets: p.targets,
    });
    const ms: string[] = [];
    for (let j = 0; j < p.milestones.length; j++) {
      const target = addDays(cursor, Math.round(((j + 1) / p.milestones.length) * p.weeks * 7) - 1);
      const mid = await repo.insertMilestone(tx, userId, goal.id, id, { idx: j, title: p.milestones[j][0], success_criteria: p.milestones[j][1], target_date: target });
      if (target < today) await repo.setMilestoneDone(tx, mid, true);
      ms.push(mid);
    }
    phaseRows.push({ id, start: cursor, end, milestones: ms, pool: p.pool });
    cursor = addDays(end, 1);
  }

  // Tasks: history + the next 10 days, 1–2 tasks per day, rest day on Sundays for the runner.
  let order = 0;
  let poolIdx = 0;
  for (let d = start; d <= addDays(today, 10); d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (g.key === "run" && dow === 0) continue;
    if (g.key === "cafe" && (dow === 2 || dow === 4)) continue;
    const perDay = g.key === "pm" && dow !== 6 ? 2 : 1;
    let used = 0;
    const phase0 = phaseRows.find((p) => d >= p.start && d <= p.end) ?? phaseRows[0];
    for (let k = 0; k < perDay; k++) {
      const [title, why, minutes, difficulty, query, url] = phase0.pool[poolIdx++ % phase0.pool.length];
      if (used + minutes > g.minutes) break;
      used += minutes;
      const past = d < today;
      const isToday = d === today;
      const roll = rand();
      const onTime = past ? roll < g.completion : isToday ? k === 0 && g.key !== "cafe" : false;
      // Older misses were already handled in real life: done a day late, or skipped.
      // Only the last few days' misses are still open, so the first visit shows a small, real replan.
      const old = past && !onTime && d < addDays(today, -3);
      const late = old && rand() < 0.35;
      const done = onTime || late;
      const scheduled = d;
      const skipped = old && !late;
      const completedOn = late ? addDays(d, 1) : d;
      await tx`
        insert into tasks (goal_id, user_id, phase_id, milestone_id, title, why, estimated_minutes, difficulty, resource_url, resource_query,
                           scheduled_date, original_date, status, completed_at, actual_minutes, sort_order, moved_count)
        values (${goal.id}, ${userId}, ${phase0.id}, ${phase0.milestones[0]}, ${title}, ${why}, ${minutes}, ${difficulty}, ${url ?? null}, ${url ? null : (query ?? title)},
                ${scheduled}, ${d}, ${done ? "done" : skipped ? "skipped" : "pending"},
                ${done ? istTimestamp(completedOn, g.hour + Math.floor(rand() * 2), Math.floor(rand() * 59)) : null},
                ${done ? Math.max(5, Math.round(minutes * (0.75 + rand() * 0.55))) : null}, ${order++}, ${scheduled !== d ? 1 : 0})
`;
    }
  }
  await repo.updateGoal(tx, goal.id, {
    status: "active",
    feasibility: g.feasibility,
    real_world_examples: g.examples,
    last_replanned_on: addDays(today, -1), // first visit today runs the real replanner on any leftovers
    ai_generated: true,
  });
  return goal.id;
}

function toOutcome(g: SampleGoal, kind: "examples" | "requirements" | "pitfalls") {
  const items = g.research.filter((r) => r.kind === kind);
  return {
    items: items.map((r) => ({ title: r.title, summary: r.summary, details: r.detail, source_url: r.url, source_title: r.source })),
    note: null,
    searchedUrls: [...new Set(g.research.map((r) => r.url))],
    dropped: 0,
  };
}

async function sampleHistory(tx: Tx, userId: string, today: ISODate, goalIds: Record<string, string>, rand: () => number) {
  // Daily check-ins for the last ~3 weeks (a few skipped days, like real life).
  for (let i = 21; i >= 1; i--) {
    const d = addDays(today, -i);
    if (rand() < 0.2) continue;
    const energy = Math.max(1, Math.min(5, Math.round(3.3 + (rand() - 0.5) * 2.6)));
    const mood = Math.max(1, Math.min(5, Math.round(3.5 + (rand() - 0.5) * 2.2)));
    const pool = SAMPLE_GOALS[Math.floor(rand() * SAMPLE_GOALS.length)].blockers;
    const blocker = pool[Math.floor(rand() * pool.length)] || null;
    await repo.upsertCheckin(tx, userId, { date: d, energy, mood, blocker });
  }

  // Coach conversation on the PM goal.
  if (goalIds.pm) {
    await repo.insertCoachMessage(tx, userId, goalIds.pm, "user", "I only have 1 hour today. What should I do?");
    await repo.insertCoachMessage(
      tx,
      userId,
      goalIds.pm,
      "assistant",
      "With 60 minutes, do the **teardown first** (it's the hardest and moves you toward Milestone 2), then send the **3 LinkedIn notes** if you have 20 minutes left.\n\nSkip the reading task today. It's the easiest to catch up on. If you want, tap **Lighten today** and I'll move it without overloading tomorrow.",
    );
  }

  // Past weekly reviews (rule-based sample text built from the same stats the app computes).
  const lastWeek = addDays(startOfWeek(today), -7);
  const reviews: [string, string, number, number, string[], string[], string][] = [
    ["pm", lastWeek, 11, 9, ["Published your first teardown (Swiggy reorder)", "Kept a 6-day streak mid-week"], ["Two LinkedIn outreach sessions slipped"], "Send 5 personalised PM notes by Wednesday, before the next case study."],
    ["run", lastWeek, 5, 4, ["Longest run so far: 4 km with walk breaks", "Strength session done twice"], ["Missed Thursday's run (rain)"], "Move one run indoors or to the evening when it rains, so the weekly count stays at 4."],
    ["pm", addDays(lastWeek, -7), 10, 7, ["Finished the PM role deep-dive"], ["Prioritisation frameworks pushed twice"], "Do RICE practice on Monday, when your energy is highest."],
  ];
  for (const [key, ws, planned, done, well, slipped, focus] of reviews) {
    if (!goalIds[key]) continue;
    await repo.upsertReview(tx, userId, {
      goal_id: goalIds[key],
      kind: "weekly",
      period_start: ws,
      period_end: addDays(ws, 6),
      stats: { planned, done, completion_rate: done / planned, minutes: done * 38, streak: 4, best_day: "Tue", avg_energy: 3.4 },
      content: {
        summary: `You completed ${done} of ${planned} planned tasks (${Math.round((done / planned) * 100)}%). ${done / planned >= 0.8 ? "A strong, consistent week." : "Decent, with a couple of slips worth fixing."}`,
        went_well: well,
        slipped,
        focus,
      },
      ai_generated: false,
    });
  }
}

/** Adds the three sample goals (with history) to a user's account. Returns goals created. */
export async function seedSampleGoals(userId: string, opts: { replace: boolean }) {
  return withUser(userId, async (tx) => {
    const profile = await repo.getProfile(tx, userId);
    const today = todayIn(profile.timezone);
    if (opts.replace) {
      await tx`delete from goals where user_id = ${userId}`;
      await tx`delete from daily_checkins where user_id = ${userId}`;
      await tx`delete from weekly_reviews where user_id = ${userId}`;
    } else {
      const existing = await repo.listGoals(tx, { includeArchived: true });
      if (existing.some((g) => SAMPLE_GOALS.some((s) => s.title === g.title))) return 0;
    }
    const rand = rng(42);
    const ids: Record<string, string> = {};
    for (const g of SAMPLE_GOALS) ids[g.key] = await insertSampleGoal(tx, userId, g, today, rand);
    await sampleHistory(tx, userId, today, ids, rand);
    return SAMPLE_GOALS.length;
  });
}
