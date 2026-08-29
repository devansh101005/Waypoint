import type { SkillNode, SkillRef } from "./types";

/**
 * An instant, offline first read of what a learner just said.
 *
 * The gateway takes 20-50 seconds to return a structured profile, which is a
 * long time to stare at a spinner and far too long on a demo recording. This
 * matches the message against skill names locally so the profile panel fills
 * immediately, and the model's answer replaces it when it lands.
 *
 * It is deliberately shallow — no stemming, no synonyms beyond a small hand-
 * written map. It is a placeholder that is usually right, not a second
 * extractor competing with the model, and it is never used to plan a path on
 * its own unless the model is unavailable.
 */

export interface QuickMatch {
  goalSkills: SkillRef[];
  statedSkills: SkillRef[];
  hoursPerWeek?: number;
  deadlineWeeks?: number;
}

/** Words that signal the learner already has a skill rather than wants it. */
const HAVE_MARKERS = [
  "i know",
  "i already know",
  "already know",
  "i have used",
  "i've used",
  "familiar with",
  "comfortable with",
  "i can use",
  "experience with",
  "i studied",
  "i learned",
  "i learnt",
  "did a course",
];

/** Everyday words that map onto skill slugs people rarely name exactly. */
const ALIASES: Record<string, string[]> = {
  "data analyst": ["dashboarding", "data-visualization", "sql-joins"],
  "data science": ["supervised-learning", "model-evaluation"],
  "machine learning": ["supervised-learning", "model-evaluation"],
  ml: ["supervised-learning", "model-evaluation"],
  ai: ["supervised-learning", "model-evaluation"],
  "front end": ["react-fundamentals", "css-layout", "html-basics"],
  frontend: ["react-fundamentals", "css-layout", "html-basics"],
  "web developer": ["react-fundamentals", "html-basics", "javascript-basics"],
  "web development": ["react-fundamentals", "html-basics", "javascript-basics"],
  websites: ["html-basics", "css-basics", "javascript-basics"],
  "full stack": ["react-state-management", "rest-apis", "nodejs-basics"],
  fullstack: ["react-state-management", "rest-apis", "nodejs-basics"],
  backend: ["nodejs-basics", "rest-apis"],
  dashboards: ["dashboarding"],
  dashboard: ["dashboarding"],
  statistics: ["descriptive-statistics"],
  stats: ["descriptive-statistics"],
  excel: [],
  spreadsheets: [],
};

/** Only id and name are needed, so the browser can pass the catalogue straight in. */
export type MatchableSkill = Pick<SkillNode, "id" | "name">;

export function quickMatch(
  text: string,
  skills: MatchableSkill[],
): QuickMatch {
  const normalised = normalise(text);
  const known = new Set(skills.map((s) => s.id));

  const goal = new Set<string>();
  const stated = new Set<string>();

  /**
   * Possession is decided per clause, not by looking backwards a fixed number
   * of characters: in "I already know SQL but I want dashboards" a character
   * window drags "already know" across the "but" and files the goal as
   * something the learner already has.
   */
  for (const clause of splitClauses(normalised)) {
    const owned = HAVE_MARKERS.some((marker) => clause.includes(marker));
    const target = owned ? stated : goal;

    for (const skill of skills) {
      const name = skill.name.toLowerCase();
      const slugWords = skill.id.replace(/-/g, " ");
      if (clause.includes(` ${name} `) || clause.includes(` ${slugWords} `)) {
        target.add(skill.id);
      }
    }

    for (const [phrase, slugs] of Object.entries(ALIASES)) {
      if (clause.includes(` ${phrase} `) || clause.includes(` ${phrase}s `)) {
        for (const slug of slugs) if (known.has(slug)) target.add(slug);
      }
    }
  }

  // A skill claimed as held wins over the same skill read as a goal.
  for (const skillId of stated) goal.delete(skillId);

  return {
    goalSkills: [...goal].slice(0, 4).map((skillId) => ({ skillId, level: 3 })),
    statedSkills: [...stated].slice(0, 6).map((skillId) => ({ skillId, level: 3 })),
    hoursPerWeek: parseHours(normalised),
    deadlineWeeks: parseDeadline(normalised),
  };
}

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+#.,;\s]/g, " ").replace(/\s+/g, " ")} `;
}

/** Break on connectives so "I know X but want Y" reads as two statements. */
function splitClauses(normalised: string): string[] {
  return normalised
    .split(/[,;.]|\bbut\b|\bhowever\b|\bthough\b|\bwhereas\b/)
    .map((part) => ` ${part.trim()} `)
    .filter((part) => part.trim().length > 0);
}

function parseHours(lower: string): number | undefined {
  const match = lower.match(
    /(\d{1,2})\s*(?:hours?|hrs?)\s*(?:a|per|each)?\s*week/,
  );
  if (!match) return undefined;
  const value = Number(match[1]);
  return value > 0 && value <= 80 ? value : undefined;
}

function parseDeadline(lower: string): number | undefined {
  const months = lower.match(/(\d{1,2})\s*months?/);
  if (months) {
    const value = Number(months[1]) * 4;
    return value > 0 && value <= 260 ? value : undefined;
  }
  const weeks = lower.match(/(\d{1,3})\s*weeks?/);
  if (weeks) {
    const value = Number(weeks[1]);
    return value > 0 && value <= 260 ? value : undefined;
  }
  const years = lower.match(/(\d)\s*years?/);
  if (years) return Number(years[1]) * 52;
  return undefined;
}
