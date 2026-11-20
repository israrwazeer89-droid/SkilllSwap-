import React, { useState } from "react";
import { Plus, X, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { updateUserProfile } from "../lib/firestoreService";
import {
  COMMON_COUNTRIES,
  COMMON_LANGUAGES,
  DEFAULT_POPULAR_SKILLS,
  SCHEMA_LIMITS,
} from "../lib/validation";
import type { ExperienceLevel } from "../types/skillswap";

export function OnboardingModal() {
  const { user, profile, needsOnboarding, setNeedsOnboarding } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || "");
  const [country, setCountry] = useState(profile?.country || "United States");
  const [bio, setBio] = useState(profile?.bio || "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile?.experienceLevel || "Intermediate"
  );
  const [availability, setAvailability] = useState(
    profile?.availability || "Weekdays 6pm - 9pm UTC"
  );
  const [teachSkills, setTeachSkills] = useState<string[]>(profile?.teachSkills || []);
  const [learnSkills, setLearnSkills] = useState<string[]>(profile?.learnSkills || []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages || ["English"]);

  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user || !user.emailVerified || !profile || !needsOnboarding) {
    return null;
  }

  const addSkill = (target: "teach" | "learn", raw: string) => {
    const val = raw.trim().slice(0, SCHEMA_LIMITS.skillItemMax);
    if (!val) return;
    if (target === "teach") {
      if (!teachSkills.some((s) => s.toLowerCase() === val.toLowerCase()) && teachSkills.length < 15) {
        setTeachSkills([...teachSkills, val]);
      }
      setTeachInput("");
    } else {
      if (!learnSkills.some((s) => s.toLowerCase() === val.toLowerCase()) && learnSkills.length < 15) {
        setLearnSkills([...learnSkills, val]);
      }
      setLearnInput("");
    }
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      if (languages.length > 1) {
        setLanguages(languages.filter((l) => l !== lang));
      }
    } else if (languages.length < 10) {
      setLanguages([...languages, lang]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (displayName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (teachSkills.length === 0 || learnSkills.length === 0) {
      setError("Add at least one skill you can teach and one skill you want to learn.");
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim(),
        photoURL: profile.photoURL || user.photoURL || "",
        country,
        bio: bio.trim() || "Excited to teach and learn through peer skill swaps.",
        teachSkills,
        learnSkills,
        experienceLevel,
        languages,
        availability: availability.trim() || "Flexible",
        isPublic: true,
      });
      setNeedsOnboarding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 my-8 shadow-xl">
        <div className="mb-6">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
            Complete Your Peer Profile
          </p>
          <h2
            id="onboarding-title"
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight"
          >
            Set up what you teach and what you want to learn
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            SkillSwap AI uses these skills, languages, and availability to connect you with compatible peers.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {COMMON_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {SCHEMA_LIMITS.experienceLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Availability
              </label>
              <input
                type="text"
                maxLength={120}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g., Weekends, Evenings EST"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Teach Skills */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Skills You Can Teach ({teachSkills.length}/15)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={teachInput}
                onChange={(e) => setTeachInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill("teach", teachInput);
                  }
                }}
                placeholder="Type a skill (e.g., Python) and press Add"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => addSkill("teach", teachInput)}
                className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DEFAULT_POPULAR_SKILLS.slice(0, 6).map((s) => (
                <button
                  key={`t-${s.name}`}
                  type="button"
                  onClick={() => addSkill("teach", s.name)}
                  className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  + {s.name}
                </button>
              ))}
            </div>
            {teachSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {teachSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => setTeachSkills(teachSkills.filter((s) => s !== skill))}
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Learn Skills */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Skills You Want to Learn ({learnSkills.length}/15)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={learnInput}
                onChange={(e) => setLearnInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill("learn", learnInput);
                  }
                }}
                placeholder="Type a skill (e.g., Graphic Design) and press Add"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => addSkill("learn", learnInput)}
                className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DEFAULT_POPULAR_SKILLS.slice(3, 9).map((s) => (
                <button
                  key={`l-${s.name}`}
                  type="button"
                  onClick={() => addSkill("learn", s.name)}
                  className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  + {s.name}
                </button>
              ))}
            </div>
            {learnSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {learnSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => setLearnSkills(learnSkills.filter((s) => s !== skill))}
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Languages */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Languages Spoken
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_LANGUAGES.map((lang) => {
                const active = languages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Short Biography
            </label>
            <textarea
              rows={3}
              maxLength={600}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your background, what projects you enjoy, and how you prefer to run 1:1 sessions."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setNeedsOnboarding(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <span>{saving ? "Saving Profile..." : "Save & Enter Workspace"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
