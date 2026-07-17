// The "learning file" of narrative / copywriting frameworks the AI grader uses to
// decide which structure a page's copy follows. These are the shipped defaults;
// users can edit, add, or remove them in Settings (changes persist in localStorage
// per browser and are sent to the grader).

export interface Framework {
  id: string;
  name: string;
  /** Ordered stages that define the framework. */
  stages: string[];
  /** One-line description of what it is / when it's used. */
  description: string;
}

export const FRAMEWORKS_STORAGE_KEY = "copy-extractor.frameworks.v1";

export const DEFAULT_FRAMEWORKS: Framework[] = [
  {
    id: "aida",
    name: "AIDA",
    stages: ["Attention", "Interest", "Desire", "Action"],
    description:
      "Classic direct-response funnel: grab attention, build interest, create desire, then prompt a clear action.",
  },
  {
    id: "pas",
    name: "PAS",
    stages: ["Problem", "Agitate", "Solution"],
    description:
      "Name the reader's problem, agitate the pain it causes, then present the product as the relief.",
  },
  {
    id: "bab",
    name: "Before–After–Bridge",
    stages: ["Before", "After", "Bridge"],
    description:
      "Show life as it is now (Before), paint the improved world (After), and position the product as the Bridge between them.",
  },
  {
    id: "storybrand",
    name: "StoryBrand (SB7)",
    stages: ["Character", "Problem", "Guide", "Plan", "Call to Action", "Success", "Failure"],
    description:
      "Make the customer the hero and the brand the guide: a hero with a problem meets a guide who offers a plan and a call to action, leading to success and avoiding failure.",
  },
  {
    id: "four-ps",
    name: "The 4 Ps",
    stages: ["Promise", "Picture", "Proof", "Push"],
    description:
      "Make a bold Promise, paint a Picture of the outcome, back it with Proof, then Push for the action.",
  },
  {
    id: "fab",
    name: "FAB",
    stages: ["Features", "Advantages", "Benefits"],
    description:
      "Translate each product Feature into an Advantage and then a concrete customer Benefit.",
  },
  {
    id: "pastor",
    name: "PASTOR",
    stages: ["Problem", "Amplify", "Story & Solution", "Testimony", "Offer", "Response"],
    description:
      "Long-form persuasion: state the Problem, Amplify the stakes, tell a Story with the Solution, add Testimony, present the Offer, and ask for a Response.",
  },
];

/** Compact one-per-line summary of the frameworks for a prompt. */
export function frameworksForPrompt(frameworks: Framework[]): string {
  return frameworks
    .map((f) => `- ${f.name}: ${f.stages.join(" → ")} — ${f.description}`)
    .join("\n");
}

/** Load the user's saved frameworks from localStorage, falling back to defaults. */
export function loadFrameworks(): Framework[] {
  if (typeof window === "undefined") return DEFAULT_FRAMEWORKS;
  try {
    const raw = window.localStorage.getItem(FRAMEWORKS_STORAGE_KEY);
    if (!raw) return DEFAULT_FRAMEWORKS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FRAMEWORKS;
    return parsed
      .filter((f) => f && typeof f.name === "string")
      .map((f, i) => ({
        id: typeof f.id === "string" && f.id ? f.id : `fw-${i}`,
        name: String(f.name),
        stages: Array.isArray(f.stages) ? f.stages.map(String) : [],
        description: typeof f.description === "string" ? f.description : "",
      }));
  } catch {
    return DEFAULT_FRAMEWORKS;
  }
}

export function saveFrameworks(frameworks: Framework[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FRAMEWORKS_STORAGE_KEY, JSON.stringify(frameworks));
  } catch {
    /* ignore quota / disabled storage */
  }
}
