import { INK, LINE, LINE_INK, PAPER } from "./theme";

/**
 * A skill's standing, drawn in the language of the network.
 *
 * Levels 1-5 are stations along a short line: the ones the learner has passed
 * are filled, the ones ahead are outlines, and the target sits under a marker.
 * A percentage bar would invent precision the corpus does not have — the data
 * is five discrete levels, so it is drawn as five discrete stops.
 */

interface SkillLineProps {
  name: string;
  level: number;
  targetLevel: number | null;
  isGoal: boolean;
}

const STOPS = [1, 2, 3, 4, 5];

export function SkillLine({
  name,
  level,
  targetLevel,
  isGoal,
}: SkillLineProps) {
  const reached = targetLevel !== null && level >= targetLevel;
  const label =
    targetLevel === null
      ? `${name}: level ${round(level)} of 5`
      : `${name}: level ${round(level)} of 5, target ${targetLevel}${reached ? ", reached" : ""}`;

  return (
    <li className="flex items-center gap-4 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">
        {name}
        {isGoal && (
          <span
            className="ml-2 font-mono text-[0.6rem] tracking-[0.14em]"
            style={{ color: LINE_INK.data }}
          >
            DESTINATION
          </span>
        )}
      </span>

      <span
        className="relative flex shrink-0 items-center"
        role="img"
        aria-label={label}
      >
        {STOPS.map((stop, index) => {
          const passed = level >= stop - 0.25;
          const isTarget = targetLevel !== null && stop === targetLevel;
          return (
            <span key={stop} className="flex items-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 3,
                    background: passed ? LINE.data : "rgba(22,22,26,0.2)",
                  }}
                />
              )}
              <span
                aria-hidden="true"
                style={{
                  width: isTarget ? 13 : 11,
                  height: isTarget ? 13 : 11,
                  borderRadius: isTarget ? 0 : "999px",
                  transform: isTarget ? "rotate(45deg)" : undefined,
                  border: `3px solid ${passed ? LINE.data : "rgba(22,22,26,0.32)"}`,
                  background: passed ? LINE.data : PAPER,
                }}
              />
            </span>
          );
        })}
      </span>

      <span
        className="w-14 shrink-0 text-right font-mono text-xs tabular-nums"
        style={{ color: INK }}
      >
        {round(level)}
        {targetLevel !== null && (
          <span className="opacity-70"> / {targetLevel}</span>
        )}
      </span>
    </li>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
