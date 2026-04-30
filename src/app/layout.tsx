import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mockup Generator",
  description:
    "Generate three distinct homepage mockups from inspiration sites and a brand logo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
