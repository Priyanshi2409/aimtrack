import type { ISODate } from "@/lib/core/dates";

export type GoalStatus = "draft" | "researching" | "planning" | "active" | "completed" | "archived";
export type Difficulty = "easy" | "medium" | "hard";
export type TaskStatus = "pending" | "done" | "skipped";
export type ResearchKind = "examples" | "requirements" | "pitfalls";

export interface Feasibility {
  score: number;
  verdict: string;
  reasons: string[];
  suggested_deadline: ISODate | null;
}

export interface ClarifyingQA {
  id: string;
  question: string;
  answer: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  raw_input: string;
  category: string;
  status: GoalStatus;
  context: { answers?: ClarifyingQA[]; notes?: string };
  start_date: ISODate | null;
  deadline: ISODate | null;
  minutes_per_day: number;
  feasibility: Feasibility | null;
  real_world_examples: { summary: string; source_url: string }[];
  color: string;
  ai_generated: boolean;
  last_replanned_on: ISODate | null;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  goal_id: string;
  idx: number;
  title: string;
  description: string | null;
  duration_weeks: number;
  start_date: ISODate;
  end_date: ISODate;
  weekly_targets: string[];
}

export interface Milestone {
  id: string;
  phase_id: string;
  goal_id: string;
  idx: number;
  title: string;
  success_criteria: string;
  target_date: ISODate | null;
  completed_at: string | null;
}

export interface Task {
  id: string;
  goal_id: string;
  phase_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string | null;
  why: string | null;
  estimated_minutes: number;
  difficulty: Difficulty;
  resource_url: string | null;
  resource_query: string | null;
  scheduled_date: ISODate;
  original_date: ISODate;
  status: TaskStatus;
  completed_at: string | null;
  actual_minutes: number | null;
  sort_order: number;
  moved_count: number;
}

export interface ResearchFinding {
  id: string;
  goal_id: string;
  kind: ResearchKind;
  title: string;
  summary: string;
  detail: Record<string, unknown>;
  source_url: string;
  source_title: string | null;
}

export interface ResearchRun {
  kind: ResearchKind;
  status: "done" | "failed";
  note: string | null;
  searched_urls: string[];
  dropped_count: number;
}

export interface Checkin {
  id: string;
  date: ISODate;
  energy: number;
  mood: number;
  blocker: string | null;
}

export interface ReplanEvent {
  id: string;
  goal_id: string;
  kind: "behind" | "ahead" | "manual";
  summary: string;
  changes: { taskId: string; title: string; from: ISODate; to: ISODate }[];
  seen: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  goal_id: string | null;
  kind: "weekly" | "monthly";
  period_start: ISODate;
  period_end: ISODate;
  stats: ReviewStats;
  content: { summary: string; went_well: string[]; slipped: string[]; focus: string };
  ai_generated: boolean;
  created_at: string;
}

export interface ReviewStats {
  planned: number;
  done: number;
  completion_rate: number;
  minutes: number;
  streak: number;
  best_day?: string | null;
  avg_energy?: number | null;
}

export interface CoachMessage {
  id: string;
  goal_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  is_demo: boolean;
  onboarded: boolean;
}
