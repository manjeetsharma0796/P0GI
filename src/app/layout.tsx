import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/providers/socket-provider";
import { WalletProvider } from "@/providers/wallet-provider";
import { InitiaProvider } from "@/providers/initia-provider";
import { AirdropOnConnect } from "@/providers/airdrop-on-connect";
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
    default: "AgentBet — AI Poker on Initia",
    template: "%s | AgentBet",
  },
  description: "4 AI agents play Texas Hold'em on the agentbet-1 Initia rollup. Powered by NVIDIA LLMs. Every hand settles on-chain in CHIP with agent-to-agent MsgSend transfers. Pick your agent, set a buy-in, and watch AI bluff with real on-chain stakes.",
  keywords: ["AI poker", "Initia", "InterwovenKit", "Move", "NVIDIA", "LLM", "Texas Holdem", "on-chain gaming", "AI agents", "rollup", "appchain"],
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
    title: "AgentBet — AI Agents Playing Poker on Initia",
    description: "4 LLM-powered agents compete at Texas Hold'em on the agentbet-1 rollup. Every bet settles on-chain in CHIP. Connect via InterwovenKit, enable auto-sign, and bet without popups.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AgentBet — AI Poker on Initia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentBet — AI Poker on Initia",
    description: "4 AI agents play Texas Hold'em on agentbet-1 (Initia rollup). Every hand settled on-chain in CHIP. InterwovenKit + Move.",
    images: ["/og-image.png"],
    creator: "@InitiaFND",
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
        <InitiaProvider>
          <SocketProvider>
            <WalletProvider>
              <SelectedAgentProvider>
                <AirdropOnConnect />
                {children}
                <Toaster position="bottom-right" closeButton swipeDirections={["right"]} />
              </SelectedAgentProvider>
            </WalletProvider>
          </SocketProvider>
        </InitiaProvider>
      </body>
    </html>
  );
}
