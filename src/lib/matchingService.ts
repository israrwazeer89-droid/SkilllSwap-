import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { handleFirestoreError, OperationType } from "./firestoreError";
import { saveAiMatches } from "./firestoreService";
import { DEFAULT_POPULAR_SKILLS } from "./validation";
import type { SkillCategoryItem, UserProfile } from "../types/skillswap";

export interface GeneratedMatchSummary {
  partnerId: string;
  partnerName: string;
  compatibilityScore: number;
  reason: string;
  primarySwap: string;
  isAlternative: boolean;
}

export interface MatchingServiceResult {
  matches: GeneratedMatchSummary[];
  persisted: boolean;
  analyzedPeers: number;
  analyzedSkills: number;
}

/**
 * Pulls the current user's profile, active skill catalog entries, and public peer
 * profiles directly from Firestore, calculates compatibility scores via the
 * server-side Gemini API endpoint (/api/ai/match), and stores the ranked results
 * in the Firestore `matches` collection.
 */
export async function computeAndStoreSkillMatches(params: {
  uid: string;
  emailVerified: boolean;
  blockedUserIds?: string[];
}): Promise<MatchingServiceResult> {
  const { uid, emailVerified, blockedUserIds = [] } = params;
  const blockedSet = new Set(blockedUserIds);

  // 1. Pull fresh seeker profile from Firestore
  let currentUser: UserProfile | null = null;
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      currentUser = snap.data() as UserProfile;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (!currentUser) {
    throw new Error("Your SkillSwap profile could not be loaded from Firestore.");
  }

  // 2. Pull active skill catalog entries from Firestore (`skills` collection)
  let skillCatalog: Array<{ name: string; category: string; description: string }> = [];
  try {
    const skillsSnap = await getDocs(
      query(collection(db, "skills"), where("isActive", "==", true))
    );
    skillCatalog = skillsSnap.docs.map((d) => {
      const item = d.data() as SkillCategoryItem;
      return {
        name: item.name,
        category: item.category,
        description: item.description,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "skills");
  }

  if (skillCatalog.length === 0) {
    skillCatalog = DEFAULT_POPULAR_SKILLS;
  }

  // 3. Pull eligible public peer profiles from Firestore (`users` collection)
  let candidates: UserProfile[] = [];
  try {
    const peersSnap = await getDocs(
      query(
        collection(db, "users"),
        where("isPublic", "==", true),
        where("isSuspended", "==", false)
      )
    );
    candidates = peersSnap.docs
      .map((d) => d.data() as UserProfile)
      .filter(
        (p) =>
          p.uid !== uid &&
          !blockedSet.has(p.uid) &&
          (p.teachSkills.length > 0 || p.learnSkills.length > 0)
      );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "users");
  }

  if (candidates.length === 0) {
    throw new Error(
      "No other public peers with skills are available in Firestore yet."
    );
  }

  // 4. Calculate compatibility scores via Gemini API on the server
  const response = await fetch("/api/ai/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentUser,
      candidates,
      skillCatalog,
    }),
  });

  const payload = (await response.json()) as {
    matches?: GeneratedMatchSummary[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Gemini AI matching request failed.");
  }

  const computedMatches = payload.matches ?? [];

  // 5. Store results in the Firestore `matches` collection (and remove stale entries)
  let persisted = false;
  if (emailVerified) {
    let existingMatchIds: string[] = [];
    try {
      const existingSnap = await getDocs(
        query(collection(db, "matches"), where("userId", "==", uid))
      );
      existingMatchIds = existingSnap.docs.map((d) => d.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "matches");
    }

    await saveAiMatches(uid, computedMatches, existingMatchIds);
    persisted = true;
  }

  return {
    matches: computedMatches,
    persisted,
    analyzedPeers: candidates.length,
    analyzedSkills: skillCatalog.length,
  };
}
