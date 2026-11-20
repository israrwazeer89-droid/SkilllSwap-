import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  UserCheck,
  X,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getUserEmail, useAuth } from "../contexts/AuthContext";
import { storage } from "../lib/firebase";
import {
  createUserProfile,
  updatePrivateSettings,
  updateUserProfile,
} from "../lib/firestoreService";
import {
  calculateProfileCompletion,
  COMMON_COUNTRIES,
  COMMON_LANGUAGES,
  DEFAULT_POPULAR_SKILLS,
  SCHEMA_LIMITS,
} from "../lib/validation";
import type { ExperienceLevel, Review, UserProfile } from "../types/skillswap";
import { Avatar } from "./Avatar";

export interface ProfileViewProps {
  peers?: UserProfile[];
  reviews?: Review[];
}

const AVAILABILITY_PRESETS = [
  "Weekday Evenings (18:00–21:00 UTC)",
  "Weekends Flexible",
  "Mornings (09:00–12:00 UTC)",
  "Weekdays & Weekends (Flexible)",
];

function extractReadableError(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to save profile changes.";
  try {
    const parsed = JSON.parse(err.message) as { error?: string };
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // Plain error message
  }
  return err.message || "Failed to save profile changes.";
}

function listsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, idx) => item === b[idx]);
}

export function ProfileView({ peers = [], reviews = [] }: ProfileViewProps) {
  const {
    user,
    profile,
    privateInfo,
    loading,
    profileLoading,
    profileError,
    retryProfileLoad,
    isVerified,
  } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [country, setCountry] = useState("United States");
  const [bio, setBio] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("Intermediate");
  const [availability, setAvailability] = useState("");
  const [teachSkills, setTeachSkills] = useState<string[]>([]);
  const [learnSkills, setLearnSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [isPublic, setIsPublic] = useState(true);

  const [allowMessagesFrom, setAllowMessagesFrom] = useState<"anyone" | "matched_only">(
    "anyone"
  );
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPhotoURL(profile.photoURL);
      setCountry(profile.country);
      setBio(profile.bio);
      setExperienceLevel(profile.experienceLevel);
      setAvailability(profile.availability);
      setTeachSkills(profile.teachSkills);
      setLearnSkills(profile.learnSkills);
      setLanguages(profile.languages);
      setIsPublic(profile.isPublic);
    } else if (user) {
      setDisplayName(
        (prev) =>
          prev || user.displayName || getUserEmail(user).split("@")[0] || ""
      );
      setPhotoURL((prev) => prev || user.photoURL || "");
    }
  }, [profile, user]);

  useEffect(() => {
    if (privateInfo) {
      setAllowMessagesFrom(privateInfo.allowMessagesFrom);
      setEmailNotifications(privateInfo.emailNotifications);
    }
  }, [privateInfo]);

  const isDirty = useMemo(() => {
    if (!profile) {
      return Boolean(displayName.trim() || bio.trim() || teachSkills.length || learnSkills.length);
    }
    const publicChanged =
      displayName !== profile.displayName ||
      photoURL !== profile.photoURL ||
      country !== profile.country ||
      bio !== profile.bio ||
      experienceLevel !== profile.experienceLevel ||
      availability !== profile.availability ||
      isPublic !== profile.isPublic ||
      !listsMatch(teachSkills, profile.teachSkills) ||
      !listsMatch(learnSkills, profile.learnSkills) ||
      !listsMatch(languages, profile.languages);

    const privateChanged = privateInfo
      ? allowMessagesFrom !== privateInfo.allowMessagesFrom ||
        emailNotifications !== privateInfo.emailNotifications
      : false;

    return publicChanged || privateChanged;
  }, [
    profile,
    privateInfo,
    displayName,
    photoURL,
    country,
    bio,
    experienceLevel,
    availability,
    isPublic,
    teachSkills,
    learnSkills,
    languages,
    allowMessagesFrom,
    emailNotifications,
  ]);

  const suggestedTeachSkills = useMemo(() => {
    const existing = new Set(teachSkills.map((s) => s.toLowerCase()));
    return DEFAULT_POPULAR_SKILLS.map((s) => s.name)
      .filter((name) => !existing.has(name.toLowerCase()))
      .slice(0, 5);
  }, [teachSkills]);

  const suggestedLearnSkills = useMemo(() => {
    const existing = new Set(learnSkills.map((s) => s.toLowerCase()));
    return DEFAULT_POPULAR_SKILLS.map((s) => s.name)
      .filter((name) => !existing.has(name.toLowerCase()))
      .slice(0, 5);
  }, [learnSkills]);

  if (!user) return null;

  if (loading || profileLoading) {
    return (
      <div
        className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-3 min-h-[240px]"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Loading profile settings...
        </p>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div
        role="alert"
        className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 space-y-3"
      >
        <div className="flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{extractReadableError(new Error(profileError))}</span>
        </div>
        <button
          type="button"
          onClick={retryProfileLoad}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const completion = calculateProfileCompletion({
    displayName,
    photoURL,
    country,
    bio,
    teachSkills,
    learnSkills,
    languages,
    availability,
  });

  const myReviews = reviews.filter((r) => r.revieweeId === user.uid);
  const avgRating = myReviews.length
    ? (myReviews.reduce((acc, r) => acc + r.rating, 0) / myReviews.length).toFixed(1)
    : null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Profile image must be smaller than 2 MB.");
      return;
    }

    setUploadingPhoto(true);
    setErrorMsg("");
    try {
      const storageRef = ref(storage, `avatars/${user.uid}/profile_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
      setStatusMsg("Profile photo uploaded. Save your profile to apply changes.");
    } catch {
      setErrorMsg(
        "Firebase Storage upload was unavailable; you can paste any direct HTTPS photo URL below instead."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addSkill = (target: "teach" | "learn", value: string) => {
    const trimmed = value.trim().slice(0, SCHEMA_LIMITS.skillItemMax);
    if (!trimmed) return;
    if (target === "teach") {
      const exists = teachSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase());
      if (!exists && teachSkills.length < SCHEMA_LIMITS.maxSkills) {
        setTeachSkills([...teachSkills, trimmed]);
      }
      setTeachInput("");
    } else {
      const exists = learnSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase());
      if (!exists && learnSkills.length < SCHEMA_LIMITS.maxSkills) {
        setLearnSkills([...learnSkills, trimmed]);
      }
      setLearnInput("");
    }
  };

  const handleResetForm = () => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPhotoURL(profile.photoURL);
      setCountry(profile.country);
      setBio(profile.bio);
      setExperienceLevel(profile.experienceLevel);
      setAvailability(profile.availability);
      setTeachSkills(profile.teachSkills);
      setLearnSkills(profile.learnSkills);
      setLanguages(profile.languages);
      setIsPublic(profile.isPublic);
    } else {
      setDisplayName(user.displayName || getUserEmail(user).split("@")[0] || "");
      setPhotoURL(user.photoURL || "");
      setCountry("United States");
      setBio("");
      setExperienceLevel("Intermediate");
      setAvailability("");
      setTeachSkills([]);
      setLearnSkills([]);
      setLanguages(["English"]);
      setIsPublic(true);
    }
    if (privateInfo) {
      setAllowMessagesFrom(privateInfo.allowMessagesFrom);
      setEmailNotifications(privateInfo.emailNotifications);
    }
    setStatusMsg("");
    setErrorMsg("");
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");

    if (!isVerified) {
      setErrorMsg("Please verify your email address before saving profile updates.");
      return;
    }

    const cleanName = displayName.trim();
    if (cleanName.length < SCHEMA_LIMITS.displayNameMin) {
      setErrorMsg(
        `Full name must be at least ${SCHEMA_LIMITS.displayNameMin} characters.`
      );
      return;
    }

    setSaving(true);
    try {
      const publicPayload = {
        displayName: cleanName,
        photoURL,
        city: profile?.city || "",
        country,
        bio,
        teachSkills,
        learnSkills,
        experienceLevel,
        languages: languages.length > 0 ? languages : ["English"],
        availability,
        isPublic,
        emailVerified: isVerified,
      };

      if (!profile) {
        await createUserProfile(user.uid, getUserEmail(user), publicPayload, {
          allowMessagesFrom,
          emailNotifications,
        });
        setStatusMsg("Profile created and saved to Firestore.");
      } else {
        await updateUserProfile(profile.uid, {
          ...publicPayload,
          existingProfile: profile,
        });

        if (privateInfo) {
          await updatePrivateSettings(profile.uid, {
            email: privateInfo.email || getUserEmail(user),
            blockedUserIds: privateInfo.blockedUserIds,
            allowMessagesFrom,
            emailNotifications,
          });
        }
        setStatusMsg("Profile and preferences saved to Firestore.");
      }
    } catch (err) {
      setErrorMsg(extractReadableError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedUid: string) => {
    if (!privateInfo) return;
    setErrorMsg("");
    try {
      await updatePrivateSettings(user.uid, {
        email: privateInfo.email,
        blockedUserIds: privateInfo.blockedUserIds.filter((id) => id !== blockedUid),
        allowMessagesFrom: privateInfo.allowMessagesFrom,
        emailNotifications: privateInfo.emailNotifications,
      });
    } catch (err) {
      setErrorMsg(extractReadableError(err));
    }
  };

  const countryOptions = COMMON_COUNTRIES.includes(country)
    ? COMMON_COUNTRIES
    : [country, ...COMMON_COUNTRIES];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Profile &amp; Safety Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage your bio, skills taught, skills wanted, availability, and privacy controls.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            {completion}% complete
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          {profile?.isVerified ? (
            <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              Admin Verified Peer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <UserCheck className="w-4 h-4" />
              {profile ? "Standard Member" : "New Profile"}
            </span>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSaveAll} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Public Peer Identity
              </h2>
              {isDirty && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar src={photoURL} name={displayName || "User"} size="xl" />
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{uploadingPhoto ? "Uploading..." : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="url"
                    aria-label="Profile photo HTTPS URL"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    placeholder="Or paste HTTPS avatar URL..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Private email ({privateInfo?.email || getUserEmail(user) || "Not provided"}) is never shown on your public
                  profile.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  required
                  minLength={SCHEMA_LIMITS.displayNameMin}
                  maxLength={SCHEMA_LIMITS.displayNameMax}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-country"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Country
                </label>
                <select
                  id="profile-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="profile-experience"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Experience Level
                </label>
                <select
                  id="profile-experience"
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
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="profile-availability"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Availability
                  </label>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {availability.length}/{SCHEMA_LIMITS.availabilityMax}
                  </span>
                </div>
                <input
                  id="profile-availability"
                  type="text"
                  maxLength={SCHEMA_LIMITS.availabilityMax}
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g., Weekday evenings & Saturday mornings (UTC)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Availability quick presets */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Quick availability schedules:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABILITY_PRESETS.map((preset) => {
                  const selected = availability === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAvailability(preset)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        selected
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Biography */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="profile-bio"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Short Biography
                </label>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {bio.length}/{SCHEMA_LIMITS.bioMax}
                </span>
              </div>
              <textarea
                id="profile-bio"
                rows={4}
                maxLength={SCHEMA_LIMITS.bioMax}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share what you teach, how you like to structure peer sessions, and what you are excited to learn."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Skills Taught */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-teach-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Skills Taught
                </label>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {teachSkills.length}/{SCHEMA_LIMITS.maxSkills}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="profile-teach-input"
                  type="text"
                  maxLength={SCHEMA_LIMITS.skillItemMax}
                  value={teachInput}
                  onChange={(e) => setTeachInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill("teach", teachInput);
                    }
                  }}
                  placeholder="Add a skill you can teach (e.g., Python Programming)..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => addSkill("teach", teachInput)}
                  disabled={!teachInput.trim() || teachSkills.length >= SCHEMA_LIMITS.maxSkills}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {teachSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {teachSkills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTeachSkills(teachSkills.filter((x) => x !== s))}
                      aria-label={`Remove taught skill ${s}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    >
                      <span>{s}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No teaching skills added yet. Add at least one so peers know what you offer.
                </p>
              )}
              {suggestedTeachSkills.length > 0 && teachSkills.length < SCHEMA_LIMITS.maxSkills && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Popular:
                  </span>
                  {suggestedTeachSkills.map((skillName) => (
                    <button
                      key={skillName}
                      type="button"
                      onClick={() => addSkill("teach", skillName)}
                      className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5"
                    >
                      + {skillName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Skills Wanted */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-learn-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Skills Wanted
                </label>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {learnSkills.length}/{SCHEMA_LIMITS.maxSkills}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  id="profile-learn-input"
                  type="text"
                  maxLength={SCHEMA_LIMITS.skillItemMax}
                  value={learnInput}
                  onChange={(e) => setLearnInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill("learn", learnInput);
                    }
                  }}
                  placeholder="Add a skill you want to learn (e.g., Graphic Design)..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => addSkill("learn", learnInput)}
                  disabled={!learnInput.trim() || learnSkills.length >= SCHEMA_LIMITS.maxSkills}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
              {learnSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {learnSkills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLearnSkills(learnSkills.filter((x) => x !== s))}
                      aria-label={`Remove wanted skill ${s}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                    >
                      <span>{s}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No learning goals added yet. Add skills you want to acquire for better matches.
                </p>
              )}
              {suggestedLearnSkills.length > 0 && learnSkills.length < SCHEMA_LIMITS.maxSkills && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Popular:
                  </span>
                  {suggestedLearnSkills.map((skillName) => (
                    <button
                      key={skillName}
                      type="button"
                      onClick={() => addSkill("learn", skillName)}
                      className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline px-1.5 py-0.5"
                    >
                      + {skillName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Languages */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Languages Spoken
                </span>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {languages.length}/{SCHEMA_LIMITS.maxLanguages}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_LANGUAGES.map((lang) => {
                  const active = languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => {
                        if (active && languages.length > 1) {
                          setLanguages(languages.filter((l) => l !== lang));
                        } else if (!active && languages.length < SCHEMA_LIMITS.maxLanguages) {
                          setLanguages([...languages, lang]);
                        }
                      }}
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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                {saving
                  ? "Saving..."
                  : profile
                    ? "Save Profile & Settings"
                    : "Create Profile"}
              </button>
              {isDirty && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Changes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Completion, Privacy, Blocking & Reviews */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Profile Strength
              </h2>
              <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {completion}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {completion < 100
                ? "Complete your bio, availability, and both taught and wanted skills to rank higher in peer discovery."
                : "Your peer profile is complete and ready for AI matching."}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Privacy &amp; Messaging Controls
            </h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Visible in Peer Directory
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Allow verified learners to discover your profile and propose swaps.
                </p>
              </div>
            </label>

            <div>
              <label
                htmlFor="profile-allow-messages"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Who Can Initiate Messages
              </label>
              <select
                id="profile-allow-messages"
                value={allowMessagesFrom}
                onChange={(e) =>
                  setAllowMessagesFrom(e.target.value as "anyone" | "matched_only")
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="anyone">Any verified peer</option>
                <option value="matched_only">Accepted exchange partners only</option>
              </select>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Activity Notifications
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receive alerts for new exchange requests and messages.
                </p>
              </div>
            </label>
          </div>

          {/* Blocked Peers */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Blocked Users
            </h2>
            {privateInfo && privateInfo.blockedUserIds.length > 0 ? (
              <ul className="space-y-2">
                {privateInfo.blockedUserIds.map((bUid) => {
                  const p = peers.find((x) => x.uid === bUid);
                  return (
                    <li
                      key={bUid}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {p?.displayName || bUid}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnblock(bUid)}
                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        Unblock
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No blocked peers.
              </p>
            )}
          </div>

          {/* Ratings & Reviews Received */}
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Ratings &amp; Reviews
              </h2>
              {avgRating && (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {avgRating} ({myReviews.length})
                </span>
              )}
            </div>
            {myReviews.length > 0 ? (
              <div className="space-y-3">
                {myReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {rev.reviewerName}
                      </span>
                      <span className="font-mono text-amber-600 tabular-nums">
                        {rev.rating}.0 ★
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{rev.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completed swaps will showcase peer reviews here.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
