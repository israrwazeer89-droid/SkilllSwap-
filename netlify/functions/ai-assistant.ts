import {
  runLearningAssistant,
  type AssistantMode,
  type AssistantTurn,
} from "../../src/server/gemini.ts";

const ALLOWED_MODES: AssistantMode[] = [
  "explain",
  "roadmap",
  "exercises",
  "coding_help",
  "resources",
  "exchange_prep",
];

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const body = (await req.json()) as {
      mode?: AssistantMode;
      prompt?: string;
      skillContext?: {
        teachSkills?: string[];
        learnSkills?: string[];
        experienceLevel?: string;
      };
      history?: AssistantTurn[];
    };

    const { mode, prompt, skillContext, history } = body;

    if (!mode || !ALLOWED_MODES.includes(mode) || !prompt || !prompt.trim()) {
      return Response.json(
        { error: "Valid mode and prompt are required." },
        { status: 400 }
      );
    }

    const reply = await runLearningAssistant({
      mode,
      prompt: prompt.trim().slice(0, 3000),
      skillContext,
      history,
    });

    return Response.json({ reply });
  } catch (err) {
    console.error("AI Assistant error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to run AI learning assistant.";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
};
