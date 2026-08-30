import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Three faces, three jobs.
 *
 * Archivo carries the identity: heavy, uppercase, tight tracking, used for
 * headings and station names. Inter carries anything read in sentences — mono
 * at paragraph length is measurably slower to read and costs accessibility.
 * JetBrains Mono carries data: hours, levels, skill slugs, metrics, and every
 * label whose job is to look like a reading off an instrument.
 */

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Waypoint — Personalized Learning Path Recommender",
  description:
    "Waypoint plans prerequisite-feasible learning routes over a skill graph, closing a learner's skill gap in the fewest hours and explaining every step.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
