import "./globals.css";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Pretty Chic Aesthetics Clinic Portal",
  description: "Luxury aesthetic clinic management"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings().catch(() => null);
  const theme = settings?.theme_color ?? "#503626";
  const sidebar = settings?.sidebar_color ?? "#2B1C13";
  const styleVars = `:root{--color-primary:${theme};--color-sidebar:${sidebar};}`;
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: styleVars }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
