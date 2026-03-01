import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story Pipeline — Animate Any Story",
  description:
    "Upload a written story and get a complete animation production pipeline: characters, scenes, prompts, voices, and music — ready to animate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
