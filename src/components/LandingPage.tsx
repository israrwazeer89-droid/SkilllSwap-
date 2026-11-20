import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Menu,
  Moon,
  ShieldCheck,
  Star,
  Sun,
  X,
} from "lucide-react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../lib/firebase";
import { DEFAULT_POPULAR_SKILLS } from "../lib/validation";
import type { Review, SkillCategoryItem, UserProfile } from "../types/skillswap";
import { Avatar } from "./Avatar";

interface LandingPageProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

const HOW_IT_WORKS_STEPS = [
  {
    num: "01.",
    title: "Create Your Skill Profile",
    body: "List the subjects you can teach comfortably alongside the new skills you want to learn, plus your spoken languages and weekly schedule.",
  },
  {
    num: "02.",
    title: "Get AI-Matched With Peers",
    body: "Our Gemini matching engine scores reciprocal fit—connecting a Python developer wanting UI design with a designer learning Python.",
  },
  {
    num: "03.",
    title: "Propose & Coordinate Exchanges",
    body: "Send a structured swap proposal, chat in real time, and use the built-in AI Learning Assistant to prepare lesson outlines and exercises.",
  },
  {
    num: "04.",
    title: "Complete Swaps & Earn Trust",
    body: "Mark finished sessions complete, leave transparent peer reviews, and build a verified global teaching portfolio without spending a cent.",
  },
];

const SAMPLE_PATHWAYS = [
  {
    title: "Mathematics & Discrete Logic ↔ Python Programming",
    context: "Sample Exchange Pathway · University Peers",
    description:
      "An engineering student trades weekly calculus and linear algebra tutoring for structured Python scripting and data automation sessions.",
    image: "/src/assets/images/exchange_coding_math_1795070575858.jpg",
    alt: "University peers collaborating on mathematics and programming",
  },
  {
    title: "HTML/CSS & Frontend Architecture ↔ Video Editing",
    context: "Sample Exchange Pathway · Creative & Tech",
    description:
      "A web developer coaches a filmmaker on responsive CSS Grid layouts in exchange for timeline pacing and color-grading critiques.",
    image: "/src/assets/images/exchange_design_video_1795070575659.jpg",
    alt: "Web developer and video editor reviewing a studio monitor",
  },
  {
    title: "Acoustic Guitar Technique ↔ Conversational Spanish",
    context: "Sample Exchange Pathway · Languages & Music",
    description:
      "Two remote peers split 60-minute weekly calls: 30 minutes of fingerstyle chord drills followed by 30 minutes of natural Spanish conversation.",
    image: "/src/assets/images/exchange_global_mentoring_1795070575903.jpg",
    alt: "Peer practicing acoustic guitar during an online skill swap session",
  },
];

const FAQS = [
  {
    q: "Is SkillSwap completely free to use?",
    a: "Yes. SkillSwap operates strictly on peer-to-peer skill bartering. Members exchange time and knowledge directly without subscriptions, course fees, or paid tutoring tiers.",
  },
  {
    q: "How does AI-powered skill matching work?",
    a: "Using Google Gemini on our server, SkillSwap evaluates your teaching skills, learning goals, experience level, spoken languages, and availability against active community profiles to compute a compatibility score, explain why you fit, and suggest alternative partners.",
  },
  {
    q: "What if I want to learn from someone who doesn't need what I teach?",
    a: "Our AI matcher recommends both direct 1:1 reciprocal partners and adjacent alternative partners whose broader interests align, and you can also browse the full global directory using skill, country, and language filters.",
  },
  {
    q: "How do you keep peer messaging and exchanges safe?",
    a: "All members verify their email address before interacting, profiles isolate private contact info from public discovery, users can block or report suspicious accounts at any time, and automated spam checks guard chat threads.",
  },
  {
    q: "How long is a typical skill exchange?",
    a: "Most peers agree on a 4-session or weekly 60-minute cadence—splitting each session 30 minutes teaching and 30 minutes learning—tracked directly inside the Exchanges workspace.",
  },
];

export function LandingPage({ onOpenAuth }: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const [liveSkills, setLiveSkills] = useState<SkillCategoryItem[]>([]);
  const [featuredMentors, setFeaturedMentors] = useState<UserProfile[]>([]);
  const [liveReviews, setLiveReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicHighlights = async () => {
      try {
        const qSkills = query(
          collection(db, "skills"),
          where("isActive", "==", true),
          limit(24)
        );
        const qMentors = query(
          collection(db, "users"),
          where("isPublic", "==", true),
          where("isSuspended", "==", false),
          limit(6)
        );
        const qReviews = query(
          collection(db, "reviews"),
          where("isVisible", "==", true),
          limit(6)
        );

        const [skillsRes, mentorsRes, reviewsRes] = await Promise.allSettled([
          getDocs(qSkills),
          getDocs(qMentors),
          getDocs(qReviews),
        ]);

        if (cancelled) return;

        if (skillsRes.status === "fulfilled") {
          setLiveSkills(
            skillsRes.value.docs.map((d) => d.data() as SkillCategoryItem)
          );
        }
        if (mentorsRes.status === "fulfilled") {
          setFeaturedMentors(
            mentorsRes.value.docs
              .map((d) => d.data() as UserProfile)
              .filter((u) => u.teachSkills.length > 0)
          );
        }
        if (reviewsRes.status === "fulfilled") {
          setLiveReviews(reviewsRes.value.docs.map((d) => d.data() as Review));
        }
      } catch {
        // Fallback to curated SkillSwap catalog when offline
      }
    };

    void loadPublicHighlights();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayedSkills =
    liveSkills.length > 0
      ? liveSkills.map((s) => ({
          name: s.name,
          category: s.category,
          description: s.description,
        }))
      : DEFAULT_POPULAR_SKILLS;

  const categories = ["All", ...Array.from(new Set(displayedSkills.map((s) => s.category)))];
  const filteredSkills =
    selectedCategory === "All"
      ? displayedSkills
      : displayedSkills.filter((s) => s.category === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#"
            className="text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 font-display"
          >
            SkillSwap
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#how-it-works"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#explore-skills"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Explore Skills
            </a>
            <a
              href="#mentors"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Pathways
            </a>
            <a
              href="#about-us"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              About Us
            </a>
            <a
              href="#faq"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          <div className="hidden md:flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth("signup")}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              Get Started
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              How It Works
            </a>
            <a
              href="#explore-skills"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Explore Skills
            </a>
            <a
              href="#mentors"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Pathways
            </a>
            <a
              href="#about-us"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              About Us
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              FAQ
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth("signup");
              }}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold"
            >
              Get Started
            </button>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    SkillSwap · Exchange Skills, Not Money
                  </p>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Toggle light or dark theme"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun className="w-3.5 h-3.5" />
                        <span>Light</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5" />
                        <span>Dark</span>
                      </>
                    )}
                  </button>
                </div>

                <h1 className="text-[clamp(2.25rem,4vw,3.5rem)] leading-[1.08] font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                  Learn Something New. Teach What You Know.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  A global peer-to-peer learning network where developers, designers,
                  students, and creators exchange real skills directly. Trade Python
                  coaching for graphic design, or math tutoring for spoken English—no fees
                  attached.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAuth("signup")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href="#explore-skills"
                    className="inline-flex items-center px-5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    Explore Skills
                  </a>
                  <button
                    type="button"
                    onClick={() => onOpenAuth("login")}
                    className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[280px] sm:min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_skillswap_collaboration_1795070574452.jpg"
                    alt="Two peers exchanging Python programming and graphic design skills at a sunlit table"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Peer-to-peer skill exchange studio
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent text-white">
                  <p className="text-xs font-medium text-slate-200">
                    Global Peer Exchange · Zero Tuition
                  </p>
                  <p className="text-sm font-semibold mt-0.5">
                    Python Engineering ↔ Brand & Graphic Design
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-column structural strip below hero split */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-b border-slate-200 dark:border-slate-800 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="py-5 sm:pr-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Direct Barter Model
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                1:1 Knowledge Trade
              </p>
            </div>
            <div className="py-5 sm:px-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Compatibility Engine
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                Gemini AI Matchmaking
              </p>
            </div>
            <div className="py-5 sm:px-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Guided Preparation
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                AI Roadmaps & Exercises
              </p>
            </div>
            <div className="py-5 sm:pl-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Trust Architecture
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                Verified Peers & Reviews
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              How It Works
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              Four structured steps from profile to completed skill swap
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.num}
                className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  {step.num}
                </span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Popular Skills Section */}
        <section
          id="explore-skills"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                Popular Skills
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Explore disciplines peers are trading today
              </h2>
            </div>

            {/* Interactive Category Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSkills.map((skill) => (
              <div
                key={skill.name}
                className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    {skill.category} · Peer Exchange
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {skill.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    {skill.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAuth("signup")}
                  className="self-start text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Find a swap partner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Mentors & Sample Exchange Pathways */}
        <section
          id="mentors"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800 space-y-14"
        >
          {featuredMentors.length > 0 && (
            <div>
              <div className="flex items-end justify-between gap-4 mb-8">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                    Active Community Members
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Featured Mentors Open to Swap
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAuth("signup")}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Join directory
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredMentors.map((mentor) => (
                  <div
                    key={mentor.uid}
                    className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar src={mentor.photoURL} name={mentor.displayName} size="md" />
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                            {mentor.displayName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {mentor.country} · {mentor.experienceLevel}
                          </p>
                        </div>
                      </div>
                      {mentor.isVerified && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                          Verified
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {mentor.bio || "Open for structured 1:1 skill exchange sessions."}
                    </p>

                    <div className="space-y-1.5 text-xs">
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">Teaches:</span>{" "}
                        {mentor.teachSkills.slice(0, 3).join(", ")}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">Learns:</span>{" "}
                        {mentor.learnSkills.slice(0, 3).join(", ") || "Open to proposals"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Illustrative Pathways (explicitly labeled as sample pathways, never fake users) */}
          <div>
            <div className="max-w-2xl mb-10">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                Example Exchange Pathways
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                How complementary skills pair across disciplines
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {SAMPLE_PATHWAYS.map((pathway) => (
                <article
                  key={pathway.title}
                  className="rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={pathway.image}
                      alt={pathway.alt}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6 space-y-2.5 flex-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {pathway.context}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {pathway.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {pathway.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Community Reviews (Real Firestore Data Only) */}
        <section
          id="reviews"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              Verified Reviews & Outcomes
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Transparent feedback from completed exchanges
            </h2>
          </div>

          {liveReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {liveReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Learned {rev.skillLearned}</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {rev.rating}.0
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    "{rev.comment}"
                  </p>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    — {rev.reviewerName}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-2xl">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Be among the first verified exchange pairs
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Reviews on SkillSwap are strictly tied to completed exchange records—never
                  fabricated. Create your profile, complete a swap, and publish real peer
                  feedback.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth("signup")}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold whitespace-nowrap shrink-0"
              >
                Start First Exchange
              </button>
            </div>
          )}
        </section>

        {/* About Us / Founder Story Section */}
        <section
          id="about-us"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Founder&apos;s Story
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  About SkillSwap
                </h2>
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                From Struggle to Shared Opportunity: Built So No Learner Is Held Back by Cost
              </h3>
              <div className="space-y-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                <p>
                  Coming from a humble family in Sarej Gresha, Nall (Khuzdar, Balochistan),
                  I know firsthand how hard it feels to carry big dreams when you cannot afford
                  paid courses, bootcamps, or private tutors. Building SkillSwap was a real
                  struggle—teaching myself step by step with limited means—because I refused to
                  accept that quality education should belong only to those who can pay for it.
                </p>
                <p>
                  SkillSwap was born from a simple conviction: nobody should face that barrier
                  alone. Talent and curiosity live in every town and community. When we trade what
                  we know for what we want to learn, every learner becomes a teacher, and
                  knowledge turns into opportunity for all.
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white pt-1">
                — Israr Wazeer, Founder of SkillSwap
              </p>
            </div>

            <div className="lg:col-span-5 p-6 sm:p-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white pb-4 border-b border-slate-100 dark:border-slate-800">
                Website &amp; Founder Details
              </h3>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Website
                  </dt>
                  <dd className="font-semibold text-blue-600 dark:text-blue-400 text-right">
                    SkillSwap
                  </dd>
                </div>
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Name
                  </dt>
                  <dd className="font-semibold text-slate-900 dark:text-white text-right">
                    Israr Wazeer
                  </dd>
                </div>
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Father&apos;s Name
                  </dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                    Wazeer Ahmed
                  </dd>
                </div>
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Nationality
                  </dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                    Baloch
                  </dd>
                </div>
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Location
                  </dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200 text-right">
                    Sarej Gresha, Nall, Khuzdar, Balochistan
                  </dd>
                </div>
                <div className="py-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Phone
                  </dt>
                  <dd className="text-right">
                    <a
                      href="tel:03313579655"
                      className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline tabular-nums"
                    >
                      03313579655
                    </a>
                  </dd>
                </div>
                <div className="pt-3 flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                    Email
                  </dt>
                  <dd className="text-right min-w-0">
                    <a
                      href="mailto:israrwazeer89@gmail.com"
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      israrwazeer89@gmail.com
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="faq"
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="mb-10">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              Frequently Asked Questions
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Everything you need to know before your first swap
            </h2>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
            {FAQS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.q} className="py-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <span className="text-base font-semibold text-slate-900 dark:text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <span className="text-lg font-bold text-slate-900 dark:text-white font-display">
              SkillSwap
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Exchange Skills, Not Money. Global peer-to-peer learning network.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white">
              How It Works
            </a>
            <a href="#explore-skills" className="hover:text-slate-900 dark:hover:text-white">
              Explore Skills
            </a>
            <a href="#about-us" className="hover:text-slate-900 dark:hover:text-white">
              About Us
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white">
              FAQ
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth("login")}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
