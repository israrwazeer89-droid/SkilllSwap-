import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  generateAiMatches,
  runLearningAssistant,
  type AssistantMode,
  type AssistantTurn,
  type MatchCandidateInput,
  type SkillCatalogInput,
} from "./src/server/gemini.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const distDir = path.resolve(__dirname, "dist");
const isProduction =
  process.env.NODE_ENV === "production" ||
  (process.env.NODE_ENV !== "development" &&
    fs.existsSync(path.join(distDir, "index.html")));

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "skillswap-api" });
});

// AI-Powered Matching endpoint
app.post("/api/ai/match", async (req, res) => {
  try {
    const { currentUser, candidates, skillCatalog } = req.body as {
      currentUser?: MatchCandidateInput;
      candidates?: MatchCandidateInput[];
      skillCatalog?: SkillCatalogInput[];
    };

    if (!currentUser || !currentUser.uid || !Array.isArray(candidates)) {
      res.status(400).json({ error: "Invalid matching payload." });
      return;
    }

    const matches = await generateAiMatches(
      currentUser,
      candidates,
      Array.isArray(skillCatalog) ? skillCatalog : []
    );
    res.json({ matches });
  } catch (err) {
    console.error("AI Match error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to compute AI skill matches.";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

// AI Learning Assistant endpoint
app.post("/api/ai/assistant", async (req, res) => {
  try {
    const { mode, prompt, skillContext, history } = req.body as {
      mode?: AssistantMode;
      prompt?: string;
      skillContext?: {
        teachSkills?: string[];
        learnSkills?: string[];
        experienceLevel?: string;
      };
      history?: AssistantTurn[];
    };

    const allowedModes: AssistantMode[] = [
      "explain",
      "roadmap",
      "exercises",
      "coding_help",
      "resources",
      "exchange_prep",
    ];

    if (!mode || !allowedModes.includes(mode) || !prompt || !prompt.trim()) {
      res.status(400).json({ error: "Valid mode and prompt are required." });
      return;
    }

    const reply = await runLearningAssistant({
      mode,
      prompt: prompt.trim().slice(0, 3000),
      skillContext,
      history,
    });

    res.json({ reply });
  } catch (err) {
    console.error("AI Assistant error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to run AI learning assistant.";
    const status = message.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build artifacts not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SkillSwap server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
