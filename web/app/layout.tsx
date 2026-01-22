import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const port = process.env.NEXT_PUBLIC_PORT;
const titlePrefix = port && port !== "3000" ? `[${port}] ` : "";

export const metadata: Metadata = {
  title: {
    template: `${titlePrefix}%s`,
    default: `${titlePrefix}Strava Book`,
  },
  description: "Your Year in Print. Turn your Strava data into a beautiful book.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
