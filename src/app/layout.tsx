import type { Metadata } from "next";
import { Bungee, Inter } from "next/font/google";
import "./globals.css";

const display = Bungee({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Your Government Deck",
  description:
    "Enter your zip code and meet every elected official who represents you, and see whether they keep their promises.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
