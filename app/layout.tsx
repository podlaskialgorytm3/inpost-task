import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { AppProviders } from "./providers";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "InPost Smart Finder",
  description:
    "Search and filter InPost parcel lockers using the official points API.",
};

const themeBootScript = `
(function(){try{
  var d=document.documentElement;
  var t=localStorage.getItem('inpost-theme');
  if(t==='dark') d.setAttribute('data-theme','dark');
  var l=localStorage.getItem('inpost-locale');
  if(l==='en'||l==='pl'||l==='de'||l==='fr') d.setAttribute('lang',l);
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${bodyFont.variable} ${displayFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="app-shell">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
