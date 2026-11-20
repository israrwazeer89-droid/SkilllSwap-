import type { PracticeAttempt, PracticeQuiz, UserProfile } from "../types/skillswap";

export const PRACTICE_QUIZZES: PracticeQuiz[] = [
  {
    id: "programming-python",
    title: "Python & Programming Fundamentals",
    category: "Programming",
    exploreCategory: "Programmers",
    description:
      "Core Python data structures, complexity basics, functions, and clean problem solving.",
    questions: [
      {
        prompt: "Which Python data structure preserves insertion order and forbids duplicate values?",
        options: ["list", "dict.fromkeys() / set behavior", "set (unordered)", "tuple"],
        correctIndex: 1,
        explanation:
          "Since Python 3.7+, dict preserves insertion order, so dict.fromkeys(items) deduplicates while keeping order, whereas a plain set does not guarantee order.",
      },
      {
        prompt: "What is the time complexity of looking up a key in a Python dictionary on average?",
        options: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
        correctIndex: 2,
        explanation: "Python dicts use hash tables, giving O(1) average lookup time.",
      },
      {
        prompt: "What does list[:: -1] return for items = [1, 2, 3]?",
        options: ["[1, 2, 3]", "[3, 2, 1]", "[2, 3]", "Raises IndexError"],
        correctIndex: 1,
        explanation: "A slice step of -1 reverses the sequence and returns [3, 2, 1].",
      },
      {
        prompt: "Which keyword creates a generator function that yields values lazily?",
        options: ["return", "async", "yield", "lambda"],
        correctIndex: 2,
        explanation: "Using yield inside a function turns it into a lazy generator.",
      },
      {
        prompt: "In clean function design, why should mutable objects like [] be avoided as default parameters?",
        options: [
          "Python forbids mutable defaults at compile time",
          "The default list is shared across every call that omits the argument",
          "It forces O(n^2) memory allocation",
          "It converts the list into a tuple automatically",
        ],
        correctIndex: 1,
        explanation:
          "Default parameter values are evaluated once when def runs, so mutating a default list persists across calls. Use None instead.",
      },
    ],
  },
  {
    id: "programming-web",
    title: "HTML, CSS & React Essentials",
    category: "Programming",
    exploreCategory: "Programmers",
    description:
      "Semantic web layout, responsive flexbox/grid, and modern React state patterns.",
    questions: [
      {
        prompt: "Which CSS property ensures consistent table/dashboard numbers do not shift horizontally as digits change?",
        options: [
          "letter-spacing: 0.1em",
          "font-variant-numeric: tabular-nums",
          "text-transform: uppercase",
          "word-break: keep-all",
        ],
        correctIndex: 1,
        explanation: "tabular-nums forces equal digit widths so timers and counters align cleanly.",
      },
      {
        prompt: "In React, why must list items rendered with .map() include a stable unique key?",
        options: [
          "To satisfy TypeScript compiler errors only",
          "To let React accurately match DOM nodes across updates without losing state",
          "To sort the array automatically",
          "To convert JSX into HTML strings",
        ],
        correctIndex: 1,
        explanation: "Stable keys help React reconcile insertions, deletions, and reorders properly.",
      },
      {
        prompt: "Which HTML element provides built-in keyboard accessibility for triggering an in-page action?",
        options: ["<div onClick>", "<span>", "<button type='button'>", "<section>"],
        correctIndex: 2,
        explanation: "<button> natively supports Enter/Space activation, focus, and screen-reader roles.",
      },
      {
        prompt: "In Flexbox, what does min-w-0 (min-width: 0) fix on a flex child containing long text?",
        options: [
          "It adds a border around the text",
          "It lets the child shrink below its intrinsic content width so truncate works",
          "It centers the text vertically",
          "It disables flex wrapping on parents",
        ],
        correctIndex: 1,
        explanation:
          "Flex children default to min-width: auto, preventing text-overflow ellipsis unless min-width: 0 is set.",
      },
      {
        prompt: "What happens if an async useEffect callback updates state after the component unmounts?",
        options: [
          "Nothing can go wrong with stale responses",
          "Out-of-order responses or stale closures can overwrite newer state unless guarded",
          "React pauses the network automatically",
          "CSS transitions stop working globally",
        ],
        correctIndex: 1,
        explanation: "Using a cancellation flag or AbortController prevents stale async callbacks from overwriting fresh state.",
      },
    ],
  },
  {
    id: "graphic-design",
    title: "Graphic Design & Visual Hierarchy",
    category: "Graphic Design",
    exploreCategory: "Graphic Designers",
    description:
      "Typography scale, WCAG contrast ratios, grid balance, and brand color restraint.",
    questions: [
      {
        prompt: "What is the minimum WCAG AA contrast ratio required for normal body text?",
        options: ["2.0:1", "3.0:1", "4.5:1", "7.5:1"],
        correctIndex: 2,
        explanation: "WCAG AA requires at least 4.5:1 for normal text and 3.0:1 for large text.",
      },
      {
        prompt: "In the 60-30-10 color rule, what role does the 10% accent color serve?",
        options: [
          "Covering the entire page background",
          "Highlighting primary actions, CTAs, and active focus states",
          "Filling every card border and footer paragraph",
          "Replacing neutral body text",
        ],
        correctIndex: 1,
        explanation: "Keeping vibrant accent color to ~10% ensures primary calls-to-action stand out clearly.",
      },
      {
        prompt: "How do designers create visual hierarchy without adding extra borders or boxes?",
        options: [
          "Scale, font weight contrast, and intentional whitespace",
          "Wrapping every label inside a bright pill capsule",
          "Using five unrelated fonts on one screen",
          "Setting every heading to the same size as captions",
        ],
        correctIndex: 0,
        explanation: "Clear scale, weight contrast, and spacing organize attention far cleaner than visual clutter.",
      },
      {
        prompt: "Why should nested rounded corners follow r_inner = r_outer - padding?",
        options: [
          "It lowers GPU memory usage",
          "Concentric radii keep the gap around curved edges visually uniform",
          "CSS rejects non-concentric border radii",
          "It makes square icons circular",
        ],
        correctIndex: 1,
        explanation: "Concentric curvature prevents pinched or uneven gaps between a parent container and inner elements.",
      },
      {
        prompt: "Which typography range is most comfortable for dense prose line length (measure)?",
        options: ["15–20 characters", "45–75 characters", "130–160 characters", "200+ characters"],
        correctIndex: 1,
        explanation: "Measures around 45–75 characters make eye tracking across lines effortless.",
      },
    ],
  },
  {
    id: "english-fluency",
    title: "English Fluency & Clear Communication",
    category: "English",
    exploreCategory: "English Speakers",
    description:
      "Idiomatic phrasing, active voice, concise technical explanations, and grammar precision.",
    questions: [
      {
        prompt: "Which sentence uses the clearest active voice?",
        options: [
          "The lesson plan was reviewed by our team yesterday.",
          "Our team reviewed the lesson plan yesterday.",
          "Reviewing of the lesson plan occurred by the team.",
          "Yesterday, the lesson plan had been being reviewed.",
        ],
        correctIndex: 1,
        explanation: "Active voice puts the actor ('Our team') first, making writing direct and energetic.",
      },
      {
        prompt: "Choose the grammatically correct sentence for a conditional skill exchange:",
        options: [
          "If I would practice daily, I improve faster.",
          "If I practice daily, I will improve faster.",
          "If I practiced daily, I will improve faster.",
          "If I am practice daily, I improved faster.",
        ],
        correctIndex: 1,
        explanation: "First conditional pairs present simple ('If I practice') with 'will + verb'.",
      },
      {
        prompt: "Which phrase best replaces the wordy 'in order to be able to'?",
        options: [
          "With a view toward enabling",
          "To",
          "For the purpose of achieving",
          "Prior to the capability of",
        ],
        correctIndex: 1,
        explanation: "'To' conveys the exact meaning in one crisp word.",
      },
      {
        prompt: "In conversational mentoring, what does 'touch base' mean?",
        options: [
          "To finish an exam early",
          "To reconnect briefly and share an update",
          "To cancel a meeting permanently",
          "To rewrite a textbook",
        ],
        correctIndex: 1,
        explanation: "'Touch base' is a common English idiom meaning to check in briefly with someone.",
      },
      {
        prompt: "Choose the correct punctuation:",
        options: [
          "Python is practical, however, design requires patience.",
          "Python is practical; however, design requires patience.",
          "Python is practical however design requires patience.",
          "Python is practical: however: design requires patience.",
        ],
        correctIndex: 1,
        explanation: "Use a semicolon before 'however' when joining two independent clauses.",
      },
    ],
  },
  {
    id: "video-editing",
    title: "Video Editing & Storytelling Pacing",
    category: "Video Editing",
    exploreCategory: "Video Editors",
    description:
      "J-cuts, L-cuts, frame rates, audio levels, and narrative rhythm in editing.",
    questions: [
      {
        prompt: "What is a J-cut in video editing?",
        options: [
          "Cutting straight to black at the end of a reel",
          "The audio from the next scene begins playing before its video appears",
          "Cropping 16:9 footage to vertical 9:16",
          "Applying a jump cut on the exact same frame",
        ],
        correctIndex: 1,
        explanation: "A J-cut brings the incoming clip's audio in early, smoothing scene transitions.",
      },
      {
        prompt: "Which dialogue audio target keeps spoken tutorials loud and clear without clipping?",
        options: ["-40 dBFS", "-12 to -6 dBFS", "0 dBFS continuous", "+6 dBFS"],
        correctIndex: 1,
        explanation: "Peaking dialogue around -12 dBFS to -6 dBFS preserves headroom and prevents digital distortion.",
      },
      {
        prompt: "Why do editors shoot B-roll at 60fps when exporting a 24fps or 30fps timeline?",
        options: [
          "To create smooth slow-motion playback without frame stutter",
          "To double the audio pitch automatically",
          "Because 60fps files take zero storage",
          "To disable color grading",
        ],
        correctIndex: 0,
        explanation: "60fps footage slowed down to 24fps (40% speed) retains crisp motion frames.",
      },
      {
        prompt: "What does color grading primarily accomplish after basic color correction?",
        options: [
          "Fixing corrupted camera memory cards",
          "Establishing consistent mood, palette tone, and visual style across shots",
          "Removing background microphone hiss",
          "Compressing H.264 keyframes",
        ],
        correctIndex: 1,
        explanation: "Color correction balances exposure/white balance; color grading adds stylistic tone.",
      },
      {
        prompt: "When cutting between two clips of the same speaker, what avoids an awkward jump cut?",
        options: [
          "Inserting a 1-second white flash every time",
          "Punching in by ~20–30% scale or cutting to relevant B-roll",
          "Muting the speaker's audio",
          "Lowering resolution to 480p",
        ],
        correctIndex: 1,
        explanation: "Changing focal framing noticeably or covering the edit with B-roll makes cuts feel intentional.",
      },
    ],
  },
  {
    id: "music-guitar",
    title: "Music Theory & Acoustic Guitar",
    category: "Music",
    exploreCategory: "Musicians",
    description:
      "Chord construction, rhythm subdivisions, tuning, and ear-training basics.",
    questions: [
      {
        prompt: "Which three notes form a C Major triad?",
        options: ["C, D, G", "C, E, G", "C, Eb, G", "C, F, A"],
        correctIndex: 1,
        explanation: "A major triad combines the root (C), major third (E), and perfect fifth (G).",
      },
      {
        prompt: "What is standard 6-string guitar tuning from thickest (6th) to thinnest (1st) string?",
        options: ["E-A-D-G-B-E", "D-A-D-G-B-E", "G-C-F-A-D-G", "E-B-G-D-A-E"],
        correctIndex: 0,
        explanation: "Standard tuning from low to high is E-A-D-G-B-E.",
      },
      {
        prompt: "Placing a capo on the 2nd fret raises an open G chord shape to sound as which chord?",
        options: ["F Major", "A Major", "Bb Major", "C Major"],
        correctIndex: 1,
        explanation: "Two frets equal two semitones (one whole step) above G, producing A Major.",
      },
      {
        prompt: "In 4/4 time, how many eighth notes fit into a single measure?",
        options: ["4", "6", "8", "12"],
        correctIndex: 2,
        explanation: "Each quarter-note beat splits into two eighth notes, so 4 × 2 = 8 eighth notes.",
      },
      {
        prompt: "What is the most effective habit for building clean chord changes as a beginner?",
        options: [
          "Practicing slowly with a metronome until muscle memory locks in",
          "Strumming as fast as possible with muted strings",
          "Tuning the guitar down an octave",
          "Only practicing single-note scales without rhythm",
        ],
        correctIndex: 0,
        explanation: "Slow, relaxed repetition at a steady tempo builds clean fretting accuracy.",
      },
    ],
  },
];

export function getQuizById(id: string): PracticeQuiz | undefined {
  return PRACTICE_QUIZZES.find((q) => q.id === id);
}

export function getRecommendedQuiz(
  profile: UserProfile | null,
  attempts: PracticeAttempt[]
): PracticeQuiz {
  const triedIds = new Set(attempts.map((a) => a.quizId));

  if (profile && profile.learnSkills.length > 0) {
    const learnLower = profile.learnSkills.map((s) => s.toLowerCase());
    const matchedBySkill = PRACTICE_QUIZZES.find((q) => {
      const cat = q.category.toLowerCase();
      const title = q.title.toLowerCase();
      return learnLower.some(
        (skill) =>
          title.includes(skill) ||
          skill.includes(cat) ||
          (skill.includes("python") && q.id === "programming-python") ||
          ((skill.includes("html") || skill.includes("react") || skill.includes("css")) &&
            q.id === "programming-web") ||
          ((skill.includes("design") || skill.includes("figma")) && q.id === "graphic-design") ||
          (skill.includes("english") && q.id === "english-fluency") ||
          (skill.includes("video") && q.id === "video-editing") ||
          ((skill.includes("guitar") || skill.includes("music")) && q.id === "music-guitar")
      );
    });
    if (matchedBySkill) return matchedBySkill;
  }

  const untried = PRACTICE_QUIZZES.find((q) => !triedIds.has(q.id));
  return untried || PRACTICE_QUIZZES[0];
}
