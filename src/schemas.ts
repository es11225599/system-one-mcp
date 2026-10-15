import { z } from "zod";

const ContentSchema = z.union([z.string().min(1), z.record(z.unknown()), z.array(z.unknown())]);

const ChoiceQuestion = z.object({
  type: z.literal("choice"),
  instructions: ContentSchema,
  criteria: z.record(z.union([z.string(), z.null()])).refine((o) => Object.keys(o).length >= 2 && Object.keys(o).length <= 255, {
    message: "choice criteria must have 2-255 options"
  })
});

const NoulQuestion = z.object({
  type: z.literal("noul"),
  instructions: ContentSchema,
  criteria: z.object({ true: z.string().optional(), false: z.string().optional() }).strict().optional()
});

const ScoreQuestion = z.object({
  type: z.literal("score"),
  instructions: ContentSchema,
  criteria: z.array(z.string()).min(2).max(10)
});

const QuestionSchema = z.discriminatedUnion("type", [ChoiceQuestion, NoulQuestion, ScoreQuestion]);

export const EvaluateSchema = z.object({
  model: z.string().min(1).optional(),
  state: ContentSchema,
  questions: z.record(QuestionSchema).refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 64, {
    message: "questions must have 1-64 entries"
  }),
  images: z.array(z.string().min(1)).optional(),
  keep_alive: z.union([z.string(), z.number()]).optional()
});

export type EvaluateInput = z.infer<typeof EvaluateSchema>;
export const ListModelsSchema = z.object({});
