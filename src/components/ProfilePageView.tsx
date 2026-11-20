import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Flame,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getUserEmail, useAuth } from "../contexts/AuthContext";
import { db, storage } from "../lib/firebase";
import {
  createUserNote,
  createUserProfile,
  deleteUserNote,
  getOrCreateConversation,
  createExchangeRequest,
  updatePrivateSettings,
  updateUserNote,
  updateUserProfile,
} from "../lib/firestoreService";
import {
  getLevelInfo,
  getUserRank,
  normalizeUserProfile,
  normalizeWeeklyActivity,
  WEEKDAY_LABELS,
} from "../lib/gamification";
import {
  calculateProfileCompletion,
  COMMON_COUNTRIES,
  COMMON_LANGUAGES,
  DEFAULT_POPULAR_SKILLS,
  SCHEMA_LIMITS,
} from "../lib/validation";
import type {
  ExperienceLevel,
  NoteItem,
  PracticeAttempt,
  Review,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";
import { Avatar } from "./Avatar";

interface ProfilePageViewProps {
  viewedUserId?: string | null;
  peers?: UserProfile[];
  reviews?: Review[];
  notes?: NoteItem[];
  practiceAttempts?: PracticeAttempt[];
  onNavigate?: (tab: WorkspaceTab) => void;
  onSelectConversation?: (convId: string) => void;
  onOpenAuth?: (mode: "login" | "signup") => void;
  onBackHome?: () => void;
}

function extractReadableError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong.";
  try {
    const parsed = JSON.parse(err.message) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // plain message
  }
  return err.message || "Something went wrong.";
}

export function ProfilePageView({
  viewedUserId,
  peers = [],
  reviews = [],
  notes = [],
  practiceAttempts = [],
  onNavigate,
  onSelectConversation,
  onOpenAuth,
  onBackHome,
}: ProfilePageViewProps) {
  const {
    user,
    profile: myProfile,
    privateInfo,
    profileLoading,
    profileError,
    retryProfileLoad,
    isVerified,
    setNeedsOnboarding,
  } = useAuth();

  const targetUid = viewedUserId || user?.uid || "";
  const isOwnProfile = Boolean(user && targetUid === user.uid);

  const [fetchedProfile, setFetchedProfile] = useState<UserProfile | null>(null);
  const [fetchingOther, setFetchingOther] = useState(false);
  const [fetchOtherError, setFetchOtherError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Edit profile mode (for owner)
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United States");
  const [bio, setBio] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("Intermediate");
  const [availability, setAvailability] = useState("Flexible");
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  // Notes state (owner only)
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteTag, setNoteTag] = useState("");
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteText, setNoteText] = useState("");
  const [noteFilterTag, setNoteFilterTag] = useState("All");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  // Visitor Connect modal state
  const [connectOpen, setConnectOpen] = useState(false);
  const [offeredSkill, setOfferedSkill] = useState("");
  const [requestedSkill, setRequestedSkill] = useState("");
  const [connectMsg, setConnectMsg] = useState("");
  const [connectBusy, setConnectBusy] = useState(false);
  const [visitorNotice, setVisitorNotice] = useState("");

  // Fetch another user's public profile when visiting /profile/[userId]
  useEffect(() => {
    if (isOwnProfile || !targetUid) {
      setFetchedProfile(null);
      setFetchOtherError("");
      return;
    }

    const fromPeers = peers.find((p) => p.uid === targetUid);
    if (fromPeers) {
      setFetchedProfile(normalizeUserProfile(fromPeers));
      setFetchOtherError("");
      return;
    }

    let cancelled = false;
    setFetchingOther(true);
    setFetchOtherError("");
    void getDoc(doc(db, "users", targetUid))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setFetchedProfile(
            normalizeUserProfile(snap.data() as Partial<UserProfile> & { uid: string })
          );
        } else {
          setFetchedProfile(null);
          setFetchOtherError("This SkillSwap profile could not be found or is private.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchOtherError(extractReadableError(err));
        }
      })
      .finally(() => {
        if (!cancelled) setFetchingOther(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetUid, isOwnProfile, peers]);

  const viewedProfile = isOwnProfile ? myProfile : fetchedProfile;

  // Populate edit form state from myProfile / user
  useEffect(() => {
    if (!isOwnProfile) return;
    if (myProfile) {
      setDisplayName(myProfile.displayName);
      setPhotoURL(myProfile.photoURL);
      setCity(myProfile.city || "");
      setCountry(myProfile.country);
      setBio(myProfile.bio);
      setExperienceLevel(myProfile.experienceLevel);
      setAvailability(myProfile.availability);
      setTeachSkills(myProfile.teachSkills);
      setLearnSkills(myProfile.learnSkills);
      setLanguages(myProfile.languages);
      setIsPublic(myProfile.isPublic);
    } else if (user) {
      setDisplayName(user.displayName || getUserEmail(user).split("@")[0] || "");
      setPhotoURL(user.photoURL || "");
    }
  }, [isOwnProfile, myProfile, user]);

  useEffect(() => {
    if (privateInfo) {
      setAllowMessagesFrom(privateInfo.allowMessagesFrom);
      setEmailNotifications(privateInfo.emailNotifications);
    }
  }, [privateInfo]);

  const allLeaderboardUsers = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const p of peers) map.set(p.uid, p);
    if (myProfile) map.set(myProfile.uid, myProfile);
    if (fetchedProfile) map.set(fetchedProfile.uid, fetchedProfile);
    return Array.from(map.values());
  }, [peers, myProfile, fetchedProfile]);

  const noteTags = useMemo(
    () => ["All", ...Array.from(new Set(notes.map((n) => n.skillTag).filter(Boolean)))],
    [notes]
  );

  const visibleNotes = useMemo(
    () =>
      noteFilterTag === "All"
        ? notes
        : notes.filter((n) => n.skillTag === noteFilterTag),
    [notes, noteFilterTag]
  );

  // Loading & Error Guards
  if ((isOwnProfile && profileLoading) || (!isOwnProfile && fetchingOther)) {
    return (
      <div
        className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-3 min-h-[260px]"
        aria-busy="true"
      >
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Loading profile...
        </p>
      </div>
    );
  }

  if (isOwnProfile && profileError && !myProfile) {
    return (
      <div
        role="alert"
        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 space-y-3"
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

  if (!isOwnProfile && (!viewedProfile || fetchOtherError)) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 max-w-xl mx-auto">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Profile Unavailable
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {fetchOtherError || "This SkillSwap user profile was not found."}
        </p>
        <div className="flex flex-wrap gap-3">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Back to Explore People
            </button>
          )}
          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Back to SkillSwap
            </button>
          )}
        </div>
      </div>
    );
  }

  // When own profile doc doesn't exist yet, still show full Profile Page (Create Banner + Growth + Notes + Practice History)

  const handleCopyProfileLink = async () => {
    const shareUrl = `${window.location.origin}/profile/${targetUid}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setProfileMsg(`Profile URL: ${shareUrl}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setProfileErr("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileErr("Profile image must be smaller than 2 MB.");
      return;
    }
    setUploadingPhoto(true);
    setProfileErr("");
    try {
      const storageRef = ref(storage, `avatars/${user.uid}/profile_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
      setProfileMsg("Photo uploaded. Click Save Profile to apply.");
    } catch {
      setProfileErr(
        "Firebase Storage upload was unavailable; paste any direct HTTPS image URL below instead."
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addSkill = (target: "teach" | "learn", raw: string) => {
    const trimmed = raw.trim().slice(0, SCHEMA_LIMITS.skillItemMax);
    if (!trimmed) return;
    if (target === "teach") {
      if (
        !teachSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase()) &&
        teachSkills.length < SCHEMA_LIMITS.maxSkills
      ) {
        setTeachSkills([...teachSkills, trimmed]);
      }
      setTeachInput("");
    } else {
      if (
        !learnSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase()) &&
        learnSkills.length < SCHEMA_LIMITS.maxSkills
      ) {
        setLearnSkills([...learnSkills, trimmed]);
      }
      setLearnInput("");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileErr("");
    setProfileMsg("");

    if (!isVerified) {
      setProfileErr("Verify your email address before saving profile updates.");
      return;
    }

    const cleanName = displayName.trim();
    if (cleanName.length < SCHEMA_LIMITS.displayNameMin) {
      setProfileErr(
        `Full name must be at least ${SCHEMA_LIMITS.displayNameMin} characters.`
      );
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        displayName: cleanName,
        photoURL,
        city,
        country,
        bio,
        teachSkills,
        learnSkills,
        experienceLevel,
        languages: languages.length > 0 ? languages : ["English"],
        availability: availability.trim() || "Flexible",
        isPublic,
        emailVerified: isVerified,
      };

      if (!myProfile) {
        await createUserProfile(user.uid, getUserEmail(user), payload, {
          allowMessagesFrom,
          emailNotifications,
        });
        setProfileMsg("Profile created!");
      } else {
        await updateUserProfile(user.uid, {
          ...payload,
          existingProfile: myProfile,
        });
        if (privateInfo) {
          await updatePrivateSettings(user.uid, {
            email: privateInfo.email || getUserEmail(user),
            blockedUserIds: privateInfo.blockedUserIds,
            allowMessagesFrom,
            emailNotifications,
          });
        }
        setProfileMsg("Profile changes saved.");
      }
      setIsEditing(false);
    } catch (err) {
      setProfileErr(extractReadableError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  // Notes handlers
  const openNewNote = () => {
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteTag(myProfile?.learnSkills[0] || myProfile?.teachSkills[0] || "Python");
    setNoteDate(new Date().toISOString().slice(0, 10));
    setNoteText("");
    setNoteError("");
    setNoteFormOpen(true);
  };

  const openEditNote = (note: NoteItem) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteTag(note.skillTag);
    setNoteDate(note.noteDate);
    setNoteText(note.text);
    setNoteError("");
    setNoteFormOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setNoteError("");
    if (!isVerified) {
      setNoteError("Verify your email to save private notes.");
      return;
    }
    if (!noteTitle.trim() || !noteText.trim()) {
      setNoteError("Both note title and text are required.");
      return;
    }

    setNoteSaving(true);
    try {
      if (editingNoteId) {
        await updateUserNote(editingNoteId, {
          title: noteTitle,
          text: noteText,
          skillTag: noteTag || "General",
          noteDate: noteDate || new Date().toISOString().slice(0, 10),
        });
      } else {
        await createUserNote(user.uid, {
          title: noteTitle,
          text: noteText,
          skillTag: noteTag || "General",
          noteDate: noteDate || new Date().toISOString().slice(0, 10),
        });
      }
      setNoteFormOpen(false);
      setEditingNoteId(null);
    } catch (err) {
      setNoteError(extractReadableError(err));
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setNoteError("");
    try {
      await deleteUserNote(noteId);
    } catch (err) {
      setNoteError(extractReadableError(err));
    }
  };

  // Visitor Connect & Chat handlers
  const handleVisitorChat = async () => {
    if (!viewedProfile) return;
    if (!user) {
      onOpenAuth?.("signup");
      return;
    }
    if (!myProfile) {
      setVisitorNotice("Create your profile first to message peers.");
      setNeedsOnboarding(true);
      return;
    }
    if (!isVerified) {
      setVisitorNotice("Verify your email before starting peer chats.");
      return;
    }
    try {
      const convId = await getOrCreateConversation(myProfile, viewedProfile);
      onSelectConversation?.(convId);
      onNavigate?.("messages");
    } catch (err) {
      setVisitorNotice(extractReadableError(err));
    }
  };

  const handleVisitorConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !viewedProfile) return;
    setConnectBusy(true);
    setVisitorNotice("");
    try {
      await createExchangeRequest({
        fromUser: myProfile,
        toUser: viewedProfile,
        offeredSkill: offeredSkill || myProfile.teachSkills[0] || "Mentoring",
        requestedSkill: requestedSkill || viewedProfile.teachSkills[0] || "Skill Coaching",
        message: connectMsg,
        scheduleNote: "Flexible 45-min video session",
      });
      setConnectOpen(false);
      setVisitorNotice(`Swap request sent to ${viewedProfile.displayName}.`);
    } catch (err) {
      setVisitorNotice(extractReadableError(err));
    } finally {
      setConnectBusy(false);
    }
  };

  const activeProfile = viewedProfile
    ? normalizeUserProfile(viewedProfile)
    : normalizeUserProfile({
        uid: targetUid,
        displayName:
          user?.displayName ||
          getUserEmail(user).split("@")[0] ||
          "SkillSwap Learner",
        photoURL: user?.photoURL || "",
        bio: "Set up your public profile so peers can discover what you teach and what you want to learn.",
      });
  const levelInfo = getLevelInfo(activeProfile.xp);
  const rank = getUserRank(activeProfile.uid, allLeaderboardUsers);
  const weekly = normalizeWeeklyActivity(activeProfile.weeklyActivity);
  const weeklyMax = Math.max(10, ...weekly);
  const completion = calculateProfileCompletion(activeProfile);
  const isAccountEmailVerified =
    activeProfile.emailVerified ||
    activeProfile.isVerified ||
    (isOwnProfile && isVerified);

  const peerReviews = reviews.filter((r) => r.revieweeId === activeProfile.uid);
  const avgRating = peerReviews.length
    ? (peerReviews.reduce((s, r) => s + r.rating, 0) / peerReviews.length).toFixed(1)
    : null;

  const countryOptions = COMMON_COUNTRIES.includes(country)
    ? COMMON_COUNTRIES
    : [country, ...COMMON_COUNTRIES];

  return (
    <div className="space-y-8">
      {/* Top Bar / Breadcrumb Return for Visitors */}
      {!isOwnProfile && (
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              if (onNavigate) onNavigate("explore");
              else onBackHome?.();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{onNavigate ? "Back to Explore People" : "Back to SkillSwap"}</span>
          </button>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
            /profile/{activeProfile.uid}
          </span>
        </div>
      )}

      {profileMsg && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{profileMsg}</span>
        </div>
      )}

      {(profileErr || visitorNotice) && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between gap-3"
        >
          <span>{profileErr || visitorNotice}</span>
          <button
            type="button"
            onClick={() => {
              setProfileErr("");
              setVisitorNotice("");
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. PUBLIC PROFILE HEADER & EDIT FORM */}
      <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
        {!isEditing ? (
          <>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
                <Avatar
                  src={activeProfile.photoURL}
                  name={activeProfile.displayName}
                  size="xl"
                />
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {activeProfile.displayName}
                    </h1>
                    {isAccountEmailVerified && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        <ShieldCheck className="w-4 h-4" />
                        Verified
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {activeProfile.city
                        ? `${activeProfile.city}, ${activeProfile.country}`
                        : activeProfile.country}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {activeProfile.experienceLevel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {rank ? `Rank #${rank}` : "Unranked"} · {activeProfile.xp} XP
                    </span>
                    {avgRating && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {avgRating} ({peerReviews.length})
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                    {activeProfile.bio || "No biography added yet."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyProfileLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Link Copied" : "Share Profile"}</span>
                </button>

                {isOwnProfile ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    {myProfile ? <Edit3 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {myProfile ? "Edit Profile" : "Create Profile"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          onOpenAuth?.("signup");
                          return;
                        }
                        if (!myProfile) {
                          setVisitorNotice("Create your profile first to connect.");
                          setNeedsOnboarding(true);
                          return;
                        }
                        setOfferedSkill(myProfile.teachSkills[0] || "Mentoring");
                        setRequestedSkill(activeProfile.teachSkills[0] || "Coaching");
                        setConnectMsg(
                          `Hi ${activeProfile.displayName}, I'd love to exchange skills with you!`
                        );
                        setConnectOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={handleVisitorChat}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Skills I Can Teach
                </h2>
                {activeProfile.teachSkills.length > 0 ? (
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {activeProfile.teachSkills.join(" · ")}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No teaching skills listed yet.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Skills I Want To Learn
                </h2>
                {activeProfile.learnSkills.length > 0 ? (
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {activeProfile.learnSkills.join(" · ")}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No learning goals listed yet.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Languages:{" "}
                <strong className="text-slate-700 dark:text-slate-300 font-medium">
                  {activeProfile.languages.join(", ")}
                </strong>
              </span>
              <span>
                Availability:{" "}
                <strong className="text-slate-700 dark:text-slate-300 font-medium">
                  {activeProfile.availability || "Flexible"}
                </strong>
              </span>
              {isOwnProfile && (
                <span>
                  Profile Strength:{" "}
                  <strong className="font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                    {completion}%
                  </strong>
                </span>
              )}
            </div>
          </>
        ) : (
          /* EDIT PROFILE FORM (Owner) */
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {myProfile ? "Edit Your Public Profile" : "Create Your Profile"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your photo, city, bio, experience level, and skills anytime.
                </p>
              </div>
              {myProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar src={photoURL} name={displayName || "User"} size="xl" />
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
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
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    placeholder="Or paste HTTPS photo URL..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Private email ({privateInfo?.email || getUserEmail(user) || "Not set"}) is never displayed publicly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.cityMax}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Karachi, London"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Country
                </label>
                <select
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Level
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Availability
                </label>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.availabilityMax}
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder="e.g., Evenings UTC, Weekends"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bio
              </label>
              <textarea
                rows={3}
                maxLength={SCHEMA_LIMITS.bioMax}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell peers what you teach, what you're learning, and how you run 1:1 sessions..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Teach Skills */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Skills I Can Teach ({teachSkills.length}/{SCHEMA_LIMITS.maxSkills})
              </label>
              <div className="flex gap-2">
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
                  placeholder="Add skill (e.g., Python, English)..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => addSkill("teach", teachInput)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {teachSkills.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTeachSkills(teachSkills.filter((x) => x !== s))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800"
                  >
                    <span>{s}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_POPULAR_SKILLS.slice(0, 6).map((s) => (
                  <button
                    key={`et-${s.name}`}
                    type="button"
                    onClick={() => addSkill("teach", s.name)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-0.5"
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Learn Skills */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Skills I Want To Learn ({learnSkills.length}/{SCHEMA_LIMITS.maxSkills})
              </label>
              <div className="flex gap-2">
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
                  placeholder="Add skill (e.g., Graphic Design, Video Editing)..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => addSkill("learn", learnInput)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {learnSkills.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLearnSkills(learnSkills.filter((x) => x !== s))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800"
                  >
                    <span>{s}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_POPULAR_SKILLS.slice(3, 9).map((s) => (
                  <button
                    key={`el-${s.name}`}
                    type="button"
                    onClick={() => addSkill("learn", s.name)}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline px-1.5 py-0.5"
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages & Privacy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Languages Spoken
                </p>
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
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Visible in Explore People &amp; Leaderboard</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Who Can Message Me
                  </label>
                  <select
                    value={allowMessagesFrom}
                    onChange={(e) =>
                      setAllowMessagesFrom(e.target.value as "anyone" | "matched_only")
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="anyone">Any verified peer</option>
                    <option value="matched_only">Accepted exchange partners only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : myProfile ? "Save Profile" : "Create Profile"}
              </button>
              {myProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* 2. GROWTH SECTION */}
      {(viewedProfile || isOwnProfile) && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Growth &amp; Milestones
                </p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Level {levelInfo.level} Learner · {activeProfile.xp} XP
                </h2>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <Flame className="w-4 h-4" />
                  {activeProfile.streakDays} day streak
                </span>
                {rank && (
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-semibold">
                    <Trophy className="w-4 h-4 text-blue-500" />
                    Rank #{rank}
                  </span>
                )}
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  XP to Level {levelInfo.level + 1}
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {levelInfo.xpInLevel} / {levelInfo.xpPerLevel} XP ({levelInfo.xpToNextLevel} XP needed)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4 Growth Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Exchanges Done
                </p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                  {activeProfile.completedExchanges}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hours Learned</p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                  {activeProfile.hoursLearned}h
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hours Taught</p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                  {activeProfile.hoursTaught}h
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Badges Earned</p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                  {activeProfile.badges.length}
                </p>
              </div>
            </div>

            {/* Badges list */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Earned Badges
              </p>
              {activeProfile.badges.length > 0 ? (
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {activeProfile.badges.map((badge) => (
                    <span key={badge} className="inline-flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-blue-500" />
                      {badge}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Complete a skill swap or practice quiz to unlock your first badge.
                </p>
              )}
            </div>
          </div>

          {/* Weekly Activity Chart (Mon to Sun) */}
          <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Weekly Activity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  XP activity across Monday to Sunday
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>

            <div
              className="grid grid-cols-7 gap-2 items-end pt-2"
              aria-label="Weekly activity chart Mon to Sun"
            >
              {WEEKDAY_LABELS.map((day, idx) => {
                const val = weekly[idx] || 0;
                const heightPct = val > 0 ? Math.max(14, Math.round((val / weeklyMax) * 100)) : 8;
                return (
                  <div key={day} className="flex flex-col items-center justify-end gap-1.5">
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums h-4 flex items-center">
                      {val > 0 ? val : ""}
                    </span>
                    <div className="w-full max-w-[28px] h-28 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          val > 0
                            ? "bg-blue-600 dark:bg-blue-500"
                            : "bg-slate-100 dark:bg-slate-800"
                        }`}
                        style={{ height: `${heightPct}%` }}
                        title={`${day}: ${val} XP`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. PRACTICE HISTORY + 4. MY NOTES (Private Owner-Only) */}
      {isOwnProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* MY NOTES SECTION (Strictly Private) */}
          <section className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  My Notes
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Private study notes stored in your account — only you can see them.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewNote}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                New Note
              </button>
            </div>

            {noteError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {noteError}
              </div>
            )}

            {noteFormOpen && (
              <form
                onSubmit={handleSaveNote}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {editingNoteId ? "Edit Note" : "Create Personal Note"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setNoteFormOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    maxLength={SCHEMA_LIMITS.noteTitleMax}
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note title..."
                    className="sm:col-span-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    maxLength={SCHEMA_LIMITS.noteTagMax}
                    value={noteTag}
                    onChange={(e) => setNoteTag(e.target.value)}
                    placeholder="Skill Tag (e.g. Python, Photoshop)"
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="date"
                    required
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <textarea
                  rows={4}
                  required
                  maxLength={SCHEMA_LIMITS.noteTextMax}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write your lesson takeaways, code snippets, or practice reminders..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteFormOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={noteSaving}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {noteSaving ? "Saving..." : editingNoteId ? "Update Note" : "Save Note"}
                  </button>
                </div>
              </form>
            )}

            {noteTags.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {noteTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNoteFilterTag(tag)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      noteFilterTag === tag
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {visibleNotes.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleNotes.map((note) => (
                  <article key={note.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {note.skillTag}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{note.noteDate}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                          {note.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditNote(note)}
                          aria-label={`Edit note ${note.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          aria-label={`Delete note ${note.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No personal notes yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Save study summaries, Python syntax tips, or Photoshop shortcuts privately here.
                </p>
              </div>
            )}
          </section>

          {/* PRACTICE HISTORY SECTION */}
          <section className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Practice History
              </h2>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("practice")}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Take a quiz →
                </button>
              )}
            </div>

            {practiceAttempts.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {practiceAttempts.slice(0, 8).map((att) => (
                  <div
                    key={att.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {att.quizTitle}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {att.category} ·{" "}
                        {att.createdAt?.toDate
                          ? att.createdAt.toDate().toLocaleDateString()
                          : "Today"}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs shrink-0 tabular-nums">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {att.score}/{att.totalQuestions}
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{att.xpEarned} XP
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <Sparkles className="w-6 h-6 text-blue-500 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No practice quizzes completed yet. Earn +10 XP per correct answer!
                </p>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("practice")}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    Start First Practice
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Peer Reviews */}
      <section className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Peer Reviews ({peerReviews.length})
          </h2>
          {avgRating && (
            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              <Star className="w-3.5 h-3.5 fill-current" />
              {avgRating} average
            </span>
          )}
        </div>
        {peerReviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {peerReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {rev.reviewerName}
                  </span>
                  <span className="font-mono text-amber-500 tabular-nums">
                    {rev.rating}.0 ★ · {rev.skillLearned}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {rev.comment}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Completed skill swaps will display verified peer reviews here.
          </p>
        )}
      </section>

      {/* Connect / Propose Swap Modal for Visitors */}
      {connectOpen && viewedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Connect with {activeProfile.displayName}
              </h3>
              <button type="button" onClick={() => setConnectOpen(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleVisitorConnectSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Skill You Offer
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={offeredSkill}
                  onChange={(e) => setOfferedSkill(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Skill You Want to Learn
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={requestedSkill}
                  onChange={(e) => setRequestedSkill(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Introduction
                </label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={connectMsg}
                  onChange={(e) => setConnectMsg(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConnectOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{connectBusy ? "Sending..." : "Send Swap Request"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
