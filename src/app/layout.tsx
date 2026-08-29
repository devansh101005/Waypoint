import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display: Bricolage Grotesque — a surveyor's lettering, slightly irregular,
// used only for headings and waypoint numbers.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Mono carries measurements: hours, levels, scores.
const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="bg-paper text-ink flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
