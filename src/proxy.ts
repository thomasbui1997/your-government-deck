import { type NextRequest, NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./i18n/config";
import { DECK_COOKIE, isDeckPath } from "./lib/savedDeck";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Every page lives under /<locale>. Unprefixed URLs redirect to the visitor's saved
 * choice, else their browser's language; visiting a prefixed URL saves that choice.
 * Once they've looked up an address, the home page is their deck (`?new` shows the search).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  const deck = request.cookies.get(DECK_COOKIE)?.value;

  const home = isLocale(first) && pathname.replace(/\/$/, "") === `/${first}`;
  if (home && !request.nextUrl.searchParams.has("new") && isDeckPath(deck)) {
    return NextResponse.redirect(new URL(`/${first}${deck}`, request.url));
  }

  if (isLocale(first)) {
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: YEAR, sameSite: "lax" });
    }
    return response;
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals, and static files (anything with a file extension).
  matcher: ["/((?!api/|_next|.*\\..*).*)"],
};
