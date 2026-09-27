import type { Metadata } from "next";
import {
  Bungee,
  Inter,
  Noto_Sans_Arabic,
  Noto_Sans_KR,
  Noto_Sans_SC,
  Noto_Sans_TC,
} from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { LOCALE_INFO, LOCALES, type Locale } from "@/i18n/config";
import type { ClientDictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/server";
import "../globals.css";

const display = Bungee({ variable: "--font-bungee", weight: "400", subsets: ["latin"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

// Scripts Inter and Bungee don't cover. Not preloaded: the browser only downloads the one
// the current locale's text actually uses.
// (Font loaders must each be assigned to a module-level const.)
const notoSC = Noto_Sans_SC({ variable: "--font-script", preload: false });
const notoTC = Noto_Sans_TC({ variable: "--font-script", preload: false });
const notoKR = Noto_Sans_KR({ variable: "--font-script", preload: false });
const notoArabic = Noto_Sans_Arabic({ variable: "--font-script", subsets: ["arabic"], preload: false });

const scriptFonts: Partial<Record<Locale, { variable: string }>> = {
  "zh-hans": notoSC,
  "zh-hant": notoTC,
  ko: notoKR,
  ar: notoArabic,
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.meta.title, description: t.meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dict = await getDictionary();
  // Long page copy stays on the server; client components only get UI strings.
  const clientDict: ClientDictionary = { ...dict, methodology: undefined } as ClientDictionary;
  const info = LOCALE_INFO[locale];

  return (
    <html
      lang={info.htmlLang}
      dir={info.dir}
      className={`${display.variable} ${body.variable} ${scriptFonts[locale]?.variable ?? ""} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider locale={locale} t={clientDict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
