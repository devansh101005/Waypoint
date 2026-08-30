"use client";

import { useState } from "react";

/**
 * The skill graph drawn as a transit network.
 *
 * This is the hero image and it is made of the product's own subject matter:
 * three domain lines, interchange stations where a skill serves more than one
 * route, and 45-degree geometry throughout. It draws itself on load — a route
 * being plotted rather than a decoration fading in — and every station is
 * hoverable, so it rewards a second look instead of just filling space.
 */

const RED = "#D82A24";
const BLUE = "#1B45C4";
const GREEN = "#00734A";
const INK = "#16161A";
const PAPER = "#F4F3EF";

interface Station {
  x: number;
  y: number;
  label: string;
  detail: string;
  interchange?: boolean;
}

const DATA_LINE: Station[] = [
  { x: 70, y: 430, label: "Python Basics", detail: "entry · 20h" },
  { x: 200, y: 430, label: "Data Structures", detail: "level 3 · 15h" },
  { x: 280, y: 350, label: "NumPy Arrays", detail: "level 3 · 4h" },
  {
    x: 420,
    y: 350,
    label: "Pandas",
    detail: "level 4 · 25h",
    interchange: true,
  },
  { x: 500, y: 270, label: "Visualization", detail: "level 4 · 15h" },
  {
    x: 660,
    y: 270,
    label: "Dashboarding",
    detail: "goal · 12h",
    interchange: true,
  },
];

const WEB_LINE: Station[] = [
  { x: 70, y: 110, label: "HTML", detail: "entry · 8h" },
  { x: 190, y: 110, label: "CSS Layout", detail: "level 4 · 15h" },
  {
    x: 270,
    y: 190,
    label: "JavaScript",
    detail: "level 4 · 20h",
    interchange: true,
  },
  { x: 430, y: 190, label: "React Hooks", detail: "level 4 · 15h" },
  { x: 530, y: 90, label: "Next.js Routing", detail: "goal · 14h" },
];

const STATS_LINE: Station[] = [
  { x: 70, y: 270, label: "Descriptive Stats", detail: "entry · 20h" },
  { x: 190, y: 270, label: "Probability", detail: "level 3 · 8h" },
  {
    x: 270,
    y: 190,
    label: "JavaScript",
    detail: "interchange",
    interchange: true,
  },
  { x: 420, y: 350, label: "Pandas", detail: "interchange", interchange: true },
];

const LINES = [
  { points: DATA_LINE, colour: RED, name: "Data analysis", delay: 0 },
  { points: WEB_LINE, colour: BLUE, name: "Web development", delay: 0.25 },
  { points: STATS_LINE, colour: GREEN, name: "Foundations", delay: 0.5 },
];

function polyline(points: Station[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

export function NetworkMap() {
  const [hovered, setHovered] = useState<Station | null>(null);

  const stations = new Map<string, Station>();
  for (const line of LINES) {
    for (const station of line.points) {
      stations.set(`${station.x},${station.y}`, station);
    }
  }

  return (
    <figure className="relative m-0">
      <svg
        viewBox="0 0 760 500"
        className="h-auto w-full"
        role="img"
        aria-label="A schematic network of three learning domains — data analysis, web development and foundations — meeting at shared interchange skills."
      >
        {/* faint grid, like a map's registration marks */}
        <g opacity="0.07">
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={i * 95}
              x2={i * 95}
              y1="0"
              y2="500"
              stroke={INK}
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              x2="760"
              y1={i * 100}
              y2={i * 100}
              stroke={INK}
              strokeWidth="1"
            />
          ))}
        </g>

        {LINES.map((line) => (
          <g key={line.name}>
            {/* the casing, so crossing lines read as over/under */}
            <polyline
              points={polyline(line.points)}
              fill="none"
              stroke={PAPER}
              strokeWidth="16"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              className="wp-draw"
              points={polyline(line.points)}
              fill="none"
              stroke={line.colour}
              strokeWidth="9"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
              style={{ animationDelay: `${line.delay}s` }}
            />
          </g>
        ))}

        {[...stations.values()].map((station) => {
          const active = hovered?.label === station.label;
          return (
            <g
              key={`${station.x},${station.y}`}
              className="wp-station"
              onMouseEnter={() => setHovered(station)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {/* generous invisible hit area */}
              <circle cx={station.x} cy={station.y} r="22" fill="transparent" />
              {station.interchange ? (
                <rect
                  x={station.x - 11}
                  y={station.y - 11}
                  width="22"
                  height="22"
                  transform={`rotate(45 ${station.x} ${station.y})`}
                  fill={PAPER}
                  stroke={INK}
                  strokeWidth={active ? 6 : 4.5}
                />
              ) : (
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={active ? 10 : 8}
                  fill={PAPER}
                  stroke={INK}
                  strokeWidth={active ? 5.5 : 4}
                />
              )}
            </g>
          );
        })}

        {hovered && (
          <g pointerEvents="none">
            <rect
              x={Math.min(hovered.x + 18, 520)}
              y={hovered.y - 40}
              width="215"
              height="52"
              fill={INK}
            />
            <text
              x={Math.min(hovered.x + 30, 532)}
              y={hovered.y - 20}
              fill={PAPER}
              fontSize="16"
              fontWeight="700"
              fontFamily="var(--tr-display), sans-serif"
            >
              {hovered.label.toUpperCase()}
            </text>
            <text
              x={Math.min(hovered.x + 30, 532)}
              y={hovered.y - 2}
              fill="#B9B7B1"
              fontSize="13"
              fontFamily="var(--tr-mono), monospace"
            >
              {hovered.detail}
            </text>
          </g>
        )}
      </svg>

      <figcaption className="sr-only">
        Hover a station to see the skill it represents and the hours it takes.
      </figcaption>
    </figure>
  );
}
