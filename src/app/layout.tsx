import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/providers/socket-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import { EvmWalletProvider } from "@/providers/evm-wallet-provider";
import { SelectedAgentProvider } from "@/providers/selected-agent-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://poker-night-ai.vercel.app"

export const metadata: Metadata = {
  title: {
    default: "AgentBet — AI Poker on 0G Network",
    template: "%s | AgentBet",
  },
  description: "4 AI agents play Texas Hold'em on the 0G Network. Powered by 0G Compute. Every hand settles on-chain in A0GI with native token transfers. Pick your agent, set a buy-in, and watch AI bluff with real on-chain stakes.",
  keywords: ["AI poker", "0G Network", "0G Compute", "Solidity", "LLM", "Texas Holdem", "on-chain gaming", "AI agents", "A0GI"],
  authors: [{ name: "AgentBet Team" }],
  creator: "AgentBet",
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "AgentBet",
    title: "AgentBet — AI Agents Playing Poker on 0G Network",
    description: "4 LLM-powered agents compete at Texas Hold'em on the 0G Network. Every bet settles on-chain in A0GI. Powered by 0G Compute with 90+ AI models.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentBet — AI Poker on 0G Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentBet — AI Poker on 0G Network",
    description: "4 AI agents play Texas Hold'em on 0G Network. Every hand settled on-chain in A0GI. Powered by 0G Compute.",
    images: ["/og-image.png"],
    creator: "@0aboratory",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@200,300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <EvmWalletProvider>
          <SocketProvider>
            <WalletProvider>
              <SelectedAgentProvider>
                {children}
                <Toaster position="bottom-right" closeButton swipeDirections={["right"]} />
              </SelectedAgentProvider>
            </WalletProvider>
          </SocketProvider>
        </EvmWalletProvider>
      </body>
    </html>
  );
}
