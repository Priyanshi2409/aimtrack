import { z } from "zod";

/** The strict JSON contracts every AI step must satisfy. Validated with Zod before use. */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const url = z.string().url().refine((u) => /^https?:\/\//.test(u), "must be http(s)");

export const VERDICTS = [
  "Very achievable",
  "Achievable",
  "Ambitious but doable",
  "Very ambitious",
  "Unrealistic in this timeframe",
] as const;

export const FeasibilitySchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(VERDICTS),
  reasons: z.array(z.string().min(3)).min(1).max(6),
  suggested_deadline: isoDate.nullable(),
});
export type FeasibilityOut = z.infer<typeof FeasibilitySchema>;

export const ClarifyQuestionsSchema = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(["career", "fitness", "business", "learning", "finance", "creative", "health", "personal"]),
  questions: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        question: z.string().min(5).max(200),
        placeholder: z.string().max(120).optional(),
        options: z.array(z.string().max(60)).max(6).optional(),
      }),
    )
    .min(2)
    .max(3),
  suggested_deadline: isoDate.nullable(),
  suggested_minutes_per_day: z.number().int().min(10).max(600),
});
export type ClarifyQuestions = z.infer<typeof ClarifyQuestionsSchema>;

export const ResearchItemSchema = z.object({
  title: z.string().min(2).max(160),
  summary: z.string().min(10).max(900),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])).optional().default({}),
  source_url: url,
  source_title: z.string().max(200).optional().nullable(),
});
export const ResearchStepSchema = z.object({
  items: z.array(ResearchItemSchema).max(8),
  note: z.string().max(400).optional().nullable(),
});
export type ResearchStep = z.infer<typeof ResearchStepSchema>;

export const PlanTaskSchema = z.object({
  day: z.number().int().min(1).max(14),
  title: z.string().min(3).max(140),
  description: z.string().max(500).optional().default(""),
  why: z.string().min(3).max(300),
  estimated_minutes: z.number().int().min(5).max(240),
  difficulty: z.enum(["easy", "medium", "hard"]),
  resource_url: url.nullable().optional(),
  resource_query: z.string().max(120).nullable().optional(),
  phase_index: z.number().int().min(0),
  milestone_index: z.number().int().min(0).nullable().optional(),
});

export const PlanSchema = z.object({
  feasibility: FeasibilitySchema,
  real_world_examples: z.array(z.object({ summary: z.string().min(10).max(500), source_url: url })).max(6),
  phases: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        description: z.string().max(400).optional().default(""),
        duration_weeks: z.number().int().min(1).max(104),
        milestones: z.array(z.object({ title: z.string().min(3).max(140), success_criteria: z.string().min(5).max(300) })).min(1).max(5),
        weekly_targets: z.array(z.string().min(3).max(200)).min(1).max(8),
      }),
    )
    .min(1)
    .max(8),
  daily_tasks: z.array(PlanTaskSchema).min(5).max(60),
});
export type Plan = z.infer<typeof PlanSchema>;
export type PlanTaskOut = z.infer<typeof PlanTaskSchema>;

/** Rolling horizon: the next week of tasks for an active goal. */
export const NextTasksSchema = z.object({
  daily_tasks: z.array(PlanTaskSchema.extend({ day: z.number().int().min(1).max(7) })).min(3).max(35),
});
export type NextTasks = z.infer<typeof NextTasksSchema>;

export const ReviewSchema = z.object({
  summary: z.string().min(10).max(500),
  went_well: z.array(z.string().min(3).max(200)).max(4),
  slipped: z.array(z.string().min(3).max(200)).max(4),
  focus: z.string().min(5).max(240),
});
export type ReviewOut = z.infer<typeof ReviewSchema>;
