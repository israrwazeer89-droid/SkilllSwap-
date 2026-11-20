import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestoreError";
import {
  adminCreateSkill,
  adminDeleteSkill,
  adminSeedDefaultSkills,
  adminToggleSkillActive,
  adminToggleUserSuspend,
  adminToggleUserVerify,
  adminUpdateReportStatus,
} from "../lib/firestoreService";
import type {
  ExchangeRequest,
  ReportItem,
  ReportStatus,
  SkillCategoryItem,
  UserProfile,
} from "../types/skillswap";

export function AdminPanelView() {
  const { user, isAdmin } = useAuth();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allExchanges, setAllExchanges] = useState<ExchangeRequest[]>([]);
  const [skills, setSkills] = useState<SkillCategoryItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // New skill form
  const [skillName, setSkillName] = useState("");
  const [skillCat, setSkillCat] = useState("Programming");
  const [skillDesc, setSkillDesc] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!isAdmin) return;

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, "users")
    );

    const unsubExchanges = onSnapshot(
      collection(db, "exchangeRequests"),
      (snap) => setAllExchanges(snap.docs.map((d) => d.data() as ExchangeRequest)),
      (err) => handleFirestoreError(err, OperationType.LIST, "exchangeRequests")
    );

    const unsubSkills = onSnapshot(
      collection(db, "skills"),
      (snap) => setSkills(snap.docs.map((d) => d.data() as SkillCategoryItem)),
      (err) => handleFirestoreError(err, OperationType.LIST, "skills")
    );

    const unsubReports = onSnapshot(
      collection(db, "reports"),
      (snap) => setReports(snap.docs.map((d) => d.data() as ReportItem)),
      (err) => handleFirestoreError(err, OperationType.LIST, "reports")
    );

    return () => {
      unsubUsers();
      unsubExchanges();
      unsubSkills();
      unsubReports();
    };
  }, [isAdmin]);

  const topSkills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of allUsers) {
      for (const s of u.teachSkills) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [allUsers]);

  if (!isAdmin || !user) {
    return (
      <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Administrator privileges are required to view this console.
        </p>
      </div>
    );
  }

  const activeUsers = allUsers.filter((u) => !u.isSuspended);
  const openReports = reports.filter((r) => r.status === "open");
  const filteredUsers = allUsers.filter(
    (u) =>
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.country.toLowerCase().includes(userSearch.toLowerCase())
  );

  const exchangeStatusCounts = {
    pending: allExchanges.filter((e) => e.status === "pending").length,
    accepted: allExchanges.filter((e) => e.status === "accepted").length,
    completed: allExchanges.filter((e) => e.status === "completed").length,
    declined: allExchanges.filter((e) => e.status === "rejected" || e.status === "cancelled")
      .length,
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;
    await adminCreateSkill(user.uid, {
      name: skillName,
      category: skillCat,
      description: skillDesc || `${skillName} peer mentoring and practice.`,
    });
    setSkillName("");
    setSkillDesc("");
    setFeedback(`Added skill "${skillName}" to the catalog.`);
  };

  const handleSeedSkills = async () => {
    await adminSeedDefaultSkills(user.uid);
    setFeedback("Seeded default skill categories into Firestore.");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Admin Console & Platform Analytics
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage community members, skill taxonomy, safety reports, and real-time platform metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSeedSkills}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 self-start"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Seed Default Skill Categories
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Users</p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {allUsers.length}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Users</p>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {activeUsers.length}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Exchanges</p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {allExchanges.length}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Reported Accounts (Open)
          </p>
          <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-1 tabular-nums">
            {openReports.length} / {reports.length}
          </p>
        </div>
      </div>

      {/* Platform Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Exchange Lifecycle Distribution
          </h2>
          <div className="space-y-3">
            {Object.entries(exchangeStatusCounts).map(([label, count]) => {
              const pct = allExchanges.length
                ? Math.round((count / allExchanges.length) * 100)
                : 0;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize text-slate-600 dark:text-slate-300">{label}</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Top Offered Skills Across Members
          </h2>
          {topSkills.length > 0 ? (
            <div className="space-y-2.5">
              {topSkills.map(([skill, count]) => (
                <div
                  key={skill}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <span className="text-slate-700 dark:text-slate-200">{skill}</span>
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {count} {count === 1 ? "mentor" : "mentors"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Skill analytics populate as members add teaching skills.
            </p>
          )}
        </div>
      </div>

      {/* User Management */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            User Management
          </h2>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Filter users by name or country..."
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 sm:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">Member</th>
                <th className="py-2.5 px-4 font-semibold">Country</th>
                <th className="py-2.5 px-4 font-semibold">Teaches</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 pl-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">
                    {u.displayName}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{u.country}</td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                    {u.teachSkills.join(", ") || "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`font-medium ${
                        u.isSuspended
                          ? "text-red-600 dark:text-red-400"
                          : u.isVerified
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {u.isSuspended
                        ? "Suspended"
                        : u.isVerified
                        ? "Verified"
                        : "Standard"}
                    </span>
                  </td>
                  <td className="py-2.5 pl-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => adminToggleUserVerify(u.uid, !u.isVerified)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      {u.isVerified ? "Unverify" : "Verify"}
                    </button>
                    <button
                      type="button"
                      onClick={() => adminToggleUserSuspend(u.uid, !u.isSuspended)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ShieldAlert className="w-3 h-3 text-red-600" />
                      {u.isSuspended ? "Restore" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skill Category Management */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Skill Category Management
        </h2>

        <form onSubmit={handleCreateSkill} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            required
            minLength={2}
            maxLength={60}
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="Skill name (e.g., Rust)"
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <select
            value={skillCat}
            onChange={(e) => setSkillCat(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="Programming">Programming</option>
            <option value="Design">Design</option>
            <option value="Languages">Languages</option>
            <option value="Mathematics & Science">Mathematics & Science</option>
            <option value="Media & Audio">Media & Audio</option>
            <option value="Business">Business</option>
          </select>
          <input
            type="text"
            maxLength={300}
            value={skillDesc}
            onChange={(e) => setSkillDesc(e.target.value)}
            placeholder="Short description..."
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Skill
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {skills.map((s) => (
            <div
              key={s.id}
              className="py-2.5 flex items-center justify-between gap-4 text-xs"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {s.name}{" "}
                  <span className="font-normal text-slate-500">· {s.category}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">{s.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => adminToggleSkillActive(s.id, !s.isActive)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700"
                >
                  {s.isActive ? "Active" : "Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => adminDeleteSkill(s.id)}
                  aria-label={`Delete ${s.name}`}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reported Accounts Queue */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Reported Accounts & Moderation Queue
        </h2>
        {reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((rep) => {
              const target = allUsers.find((u) => u.uid === rep.reportedUid);
              return (
                <div
                  key={rep.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Target: {target?.displayName || rep.reportedUid} · Reason:{" "}
                      <span className="capitalize">{rep.reason.replace("_", " ")}</span> ·
                      Status: <span className="capitalize">{rep.status}</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">{rep.details}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(["reviewed", "actioned", "dismissed"] as ReportStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => adminUpdateReportStatus(rep.id, st)}
                        className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 capitalize hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No safety reports submitted.
          </p>
        )}
      </div>
    </div>
  );
}
