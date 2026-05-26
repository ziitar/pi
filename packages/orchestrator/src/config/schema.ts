import { Type, type Static } from "typebox";

export const ThinkingLevelSchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

export const CategoryConfigSchema = Type.Object({
  provider: Type.String({ minLength: 1 }),
  modelId: Type.String({ minLength: 1 }),
  thinkingLevel: Type.Optional(ThinkingLevelSchema),
  temperature: Type.Optional(Type.Number({ minimum: 0, maximum: 2 })),
});

export const CategoryWithFallbackSchema = Type.Object({
  primary: CategoryConfigSchema,
  fallback: Type.Optional(Type.Array(CategoryConfigSchema)),
});

export const ModelCategoriesConfigSchema = Type.Object({
  classifier: Type.Optional(CategoryConfigSchema),
  categories: Type.Record(Type.String(), CategoryWithFallbackSchema),
  maxConcurrency: Type.Optional(Type.Number({ minimum: 1, maximum: 10, default: 3 })),
});

export type CategoryConfig = Static<typeof CategoryConfigSchema>;
export type CategoryWithFallback = Static<typeof CategoryWithFallbackSchema>;
export type ModelCategoriesConfig = Static<typeof ModelCategoriesConfigSchema>;
export type ThinkingLevel = Static<typeof ThinkingLevelSchema>;
