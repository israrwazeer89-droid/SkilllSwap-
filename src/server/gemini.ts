import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add a valid key in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export interface MatchCandidateInput {
  uid: string;
  displayName: string;
  country: string;
  bio: string;
  teachSkills: string[];
  learnSkills: string[];
  experienceLevel: string;
  languages: string[];
  availability: string;
  completedExchanges: number;
  ratingAvg: number;
}

export interface SkillCatalogInput {
  name: string;
  category: string;
  description: string;
}

export interface AiMatchResultItem {
  partnerId: string;
  partnerName: string;
  compatibilityScore: number;
  reason: string;
  primarySwap: string;
  isAlternative: boolean;
}

async function withBackoffRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("500") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("DEADLINE_EXCEEDED");
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

export async function generateAiMatches(
  currentUser: MatchCandidateInput,
  candidates: MatchCandidateInput[],
  skillCatalog: SkillCatalogInput[] = []
): Promise<AiMatchResultItem[]> {
  if (!candidates.length) {
    return [];
  }

  const ai = getGeminiClient();
  const compactCandidates = candidates.slice(0, 25).map((c) => ({
    uid: c.uid,
    name: c.displayName,
    country: c.country,
    teachSkills: c.teachSkills,
    learnSkills: c.learnSkills,
    experienceLevel: c.experienceLevel,
    languages: c.languages,
    availability: c.availability,
    bio: c.bio.slice(0, 220),
    ratingAvg: c.ratingAvg,
    completedExchanges: c.completedExchanges,
  }));

  const compactCatalog = skillCatalog.slice(0, 30).map((s) => ({
    name: s.name,
    category: s.category,
    description: s.description.slice(0, 120),
  }));

  const prompt = `
You are the SkillSwap AI Matching Engine. Analyze the seeker's profile and rank the best peer learning partners from the candidate list based on taught vs. wanted skills.

CURRENT USER:
${JSON.stringify({
  uid: currentUser.uid,
  name: currentUser.displayName,
  country: currentUser.country,
  teachSkills: currentUser.teachSkills,
  learnSkills: currentUser.learnSkills,
  experienceLevel: currentUser.experienceLevel,
  languages: currentUser.languages,
  availability: currentUser.availability,
  bio: currentUser.bio.slice(0, 260),
})}

ACTIVE SKILL CATALOG (for skill taxonomy & adjacent domain understanding):
${JSON.stringify(compactCatalog)}

CANDIDATES:
${JSON.stringify(compactCandidates)}

INSTRUCTIONS:
1. Score taught vs. wanted compatibility: prioritize direct reciprocal matches (user teaches X and wants Y; candidate teaches Y and wants X), then weigh shared spoken languages, availability overlap, and complementary experience levels.
2. Also identify up to 2 strong "alternative" learning partners (isAlternative: true) who teach a skill the user wants (or an adjacent skill in the same catalog category) or want what the user teaches, even without an exact 1-to-1 mirror.
3. Return at most 6 total matches ordered by compatibilityScore descending (0 to 100 integer).
4. Every partnerId MUST come verbatim from the CANDIDATES list above.
5. Keep "reason" concise and concrete (20-350 chars explaining taught vs. wanted skill alignment).
6. Format "primarySwap" as "Teach [Skill] <-> Learn [Skill]" (5-120 chars).
`;

  const response = await withBackoffRetry(() =>
    ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  partnerId: { type: Type.STRING },
                  partnerName: { type: Type.STRING },
                  compatibilityScore: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                  primarySwap: { type: Type.STRING },
                  isAlternative: { type: Type.BOOLEAN },
                },
                required: [
                  "partnerId",
                  "partnerName",
                  "compatibilityScore",
                  "reason",
                  "primarySwap",
                  "isAlternative",
                ],
              },
            },
          },
          required: ["matches"],
        },
      },
    })
  );

  const rawText = (response.text ?? "{}").trim();
  const parsed = JSON.parse(rawText) as { matches?: AiMatchResultItem[] };
  const candidateMap = new Map(candidates.map((c) => [c.uid, c]));
  const seen = new Set<string>();

  return (parsed.matches ?? [])
    .filter((m) => {
      if (!candidateMap.has(m.partnerId) || seen.has(m.partnerId)) return false;
      seen.add(m.partnerId);
      return true;
    })
    .map((m) => {
      const candidate = candidateMap.get(m.partnerId)!;
      const safeName = (String(m.partnerName || candidate.displayName).trim() || "Peer").slice(0, 80);
      const rawReason = String(m.reason || "").trim();
      const safeReason = (
        rawReason.length >= 5
          ? rawReason
          : `Compatible peer based on ${candidate.teachSkills[0] || "shared skills"}.`
      ).slice(0, 580);
      const rawSwap = String(m.primarySwap || "").trim();
      const safeSwap = (
        rawSwap.length >= 1
          ? rawSwap
          : `Teach ${currentUser.teachSkills[0] || "Skill"} <-> Learn ${candidate.teachSkills[0] || "Skill"}`
      ).slice(0, 130);

      return {
        partnerId: m.partnerId,
        partnerName: safeName,
        compatibilityScore: Math.max(0, Math.min(100, Math.round(Number(m.compatibilityScore) || 0))),
        reason: safeReason,
        primarySwap: safeSwap,
        isAlternative: Boolean(m.isAlternative),
      };
    });
}

export type AssistantMode =
  | "explain"
  | "roadmap"
  | "exercises"
  | "coding_help"
  | "resources"
  | "exchange_prep";

const MODE_INSTRUCTIONS: Record<AssistantMode, string> = {
  explain:
    "You are an insightful peer educator. Break down difficult concepts from first principles using clear analogies, step-by-step reasoning, and concrete examples.",
  roadmap:
    "You are a curriculum designer. Produce a structured, practical multi-week learning roadmap with clear milestones, weekly goals, and mini-projects tailored to the learner's skill level.",
  exercises:
    "You are a hands-on coach. Create 3 progressive practice exercises (warm-up, applied, stretch) with clear acceptance criteria and collapsible/labeled hints.",
  coding_help:
    "You are a senior software mentor. Diagnose programming questions, provide clean annotated code snippets, explain time/design trade-offs, and suggest debugging checks.",
  resources:
    "You are an educational curator. Recommend high-signal, freely accessible documentation, interactive sandboxes, books, and practice projects suited to the user's level.",
  exchange_prep:
    "You are a peer-exchange facilitator. Help the user prepare a 45-60 minute 1:1 skill swap agenda, teaching talking points, learning questions, and a friendly session icebreaker.",
};

export interface AssistantTurn {
  role: "user" | "model";
  text: string;
}

export async function runLearningAssistant(params: {
  mode: AssistantMode;
  prompt: string;
  skillContext?: {
    teachSkills?: string[];
    learnSkills?: string[];
    experienceLevel?: string;
  };
  history?: AssistantTurn[];
}): Promise<string> {
  const ai = getGeminiClient();
  const systemInstruction = `${MODE_INSTRUCTIONS[params.mode]}

User Context:
- Skills they teach: ${(params.skillContext?.teachSkills ?? []).join(", ") || "Not specified"}
- Skills they want to learn: ${(params.skillContext?.learnSkills ?? []).join(", ") || "Not specified"}
- Experience level: ${params.skillContext?.experienceLevel || "Intermediate"}

Formatting rules:
- Use clean Markdown headings, bullet lists, and fenced code blocks when helpful.
- Be concise, accurate, and directly actionable.`;

  const historyText = (params.history ?? [])
    .slice(-6)
    .map((h) => `${h.role === "user" ? "User" : "Tutor"}: ${h.text}`)
    .join("\n\n");

  const fullContents = historyText
    ? `Previous context:\n${historyText}\n\nCurrent request:\n${params.prompt}`
    : params.prompt;

  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: fullContents,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text?.trim() || "I could not generate a response. Please rephrase your question.";
}
