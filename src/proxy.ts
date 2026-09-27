import { type NextRequest, NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./i18n/config";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Every page lives under /<locale>. Unprefixed URLs redirect to the visitor's saved
 * choice, else their browser's language; visiting a prefixed URL saves that choice.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];

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
