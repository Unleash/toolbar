import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UnleashToolbarProvider } from "@unleash/toolbar/next";
import "@unleash/toolbar/toolbar.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unleash Toolbar + Next.js",
  description: "Demo of Unleash Session Override Toolbar with Next.js App Router",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UnleashToolbarProvider
          config={{
            url: process.env.NEXT_PUBLIC_UNLEASH_FRONTEND_API_URL!,
            clientKey: process.env.NEXT_PUBLIC_UNLEASH_FRONTEND_API_TOKEN!,
            appName: process.env.NEXT_PUBLIC_UNLEASH_APP_NAME || 'nextjs-demo',
            environment: 'development',
            refreshInterval: 15,
          }}
          toolbarOptions={
            process.env.NODE_ENV !== 'production' 
              ? { themePreset: 'dark', initiallyVisible: false }
              : undefined
          }
        >
          {children}
        </UnleashToolbarProvider>
      </body>
    </html>
  );
}
