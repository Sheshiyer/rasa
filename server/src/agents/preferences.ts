import {
  OnboardingProfileSchema,
  PreferenceProfileSchema,
  type OnboardingProfile,
  type PreferenceProfile,
} from "@rasa/shared";
import type { LlmClient } from "../llm/client";

/** Hard constraints that must be explicitly stated by the user — never fabricated by repair. */
const HARD_FIELDS = ["diet_type", "allergens"] as const;

const QUESTION_TEXT: Record<string, string> = {
  diet_type: "What's your diet type — veg, jain, egg, or nonveg?",
  allergens:
    "Any food allergies I must always avoid? (reply 'none' if you have none)",
  spice_level: "How spicy do you like it — mild, medium, or hot?",
  meals_per_day: "How many meals a day should I plan (1–6), and at what times?",
  slots:
    "What are your meal times? (e.g. lunch 12:30-13:30, dinner 20:00-21:00)",
  budget_monthly_inr: "What's your monthly food budget in ₹?",
  calorie_target: "What's your daily calorie target?",
  macro_target: "What are your daily protein / carb / fat goals in grams?",
  variety_tolerance:
    "How much do you mind repeats — low, medium, or high tolerance?",
  cuisines_like: "Which cuisines do you like?",
  cuisines_avoid: "Any cuisines to avoid?",
  dislikes: "Any foods you dislike?",
};

export interface MissingQuestion {
  field: string;
  question: string;
}

export type ProcessResult =
  | { status: "stored"; profile: PreferenceProfile; repaired: boolean }
  | { status: "needs_input"; questions: MissingQuestion[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Extract a JSON object from a paste: prefer a fenced ```json block, tolerate prose. */
export function extractJson(rawText: string): unknown {
  const fence = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1]! : rawText).trim();
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  const direct = tryParse(candidate);
  if (direct !== undefined) return direct;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const sliced = tryParse(candidate.slice(first, last + 1));
    if (sliced !== undefined) return sliced;
  }
  return null;
}

/** Merge app-side fields onto the onboarding subset to form the full PreferenceProfile. */
function buildProfile(
  userId: string,
  data: OnboardingProfile,
): PreferenceProfile {
  const { cheat_rules, ...rest } = data;
  return PreferenceProfileSchema.parse({
    ...rest,
    user_id: userId,
    ...(cheat_rules ? { cheat_rules } : {}),
  });
}

export interface PreferencesAgentDeps {
  llm: LlmClient;
  persist: (profile: PreferenceProfile) => Promise<void>;
}

/**
 * Preferences Agent. Turns an onboarding paste into a validated, persisted profile.
 * safeParse -> LLM repair -> re-validate; if a HARD field (diet_type/allergens) was
 * absent from the paste, it is always asked, never fabricated by repair.
 */
export function createPreferencesAgent(deps: PreferencesAgentDeps) {
  return {
    async processOnboarding(
      userId: string,
      rawText: string,
    ): Promise<ProcessResult> {
      const parsed = extractJson(rawText);
      const originalKeys = isRecord(parsed) ? Object.keys(parsed) : [];
      const missingHard = HARD_FIELDS.filter((f) => !originalKeys.includes(f));

      let result = OnboardingProfileSchema.safeParse(parsed);
      let repaired = false;
      if (!result.success) {
        const issues = result.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        );
        const candidate = await deps.llm.repairProfile({ rawText, issues });
        const reparse = OnboardingProfileSchema.safeParse(candidate);
        result = reparse;
        repaired = reparse.success;
      }

      if (result.success && missingHard.length === 0) {
        const profile = buildProfile(userId, result.data);
        await deps.persist(profile);
        return { status: "stored", profile, repaired };
      }

      // Exactly the fields that are still missing/invalid — plus any fabricated hard field.
      const fields = new Set<string>(missingHard);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const top = issue.path[0];
          if (typeof top === "string") fields.add(top);
        }
      }
      const questions: MissingQuestion[] = [...fields].map((f) => ({
        field: f,
        question: QUESTION_TEXT[f] ?? `Please provide: ${f}`,
      }));
      return { status: "needs_input", questions };
    },
  };
}
