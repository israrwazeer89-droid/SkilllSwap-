import {
  generateAiMatches,
  type MatchCandidateInput,
  type SkillCatalogInput,
} from "../../src/server/gemini.ts";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  try {
    const body = (await req.json()) as {
      currentUser?: MatchCandidateInput;
      candidates?: MatchCandidateInput[];
      skillCatalog?: SkillCatalogInput[];
    };

    const { currentUser, candidates, skillCatalog } = body;

    if (!currentUser || !currentUser.uid || !Array.isArray(candidates)) {
      return Response.json({ error: "Invalid matching payload." }, { status: 400 });
    }

    const matches = await generateAiMatches(
      currentUser,
      candidates,
      Array.isArray(skillCatalog) ? skillCatalog : []
    );

    return Response.json({ matches });
  } catch (err) {
    console.error("AI Match error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to compute AI skill matches.";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
};
