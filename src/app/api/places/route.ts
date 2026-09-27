import { autocomplete, placesEnabled } from "@/lib/providers/places";

const TOKEN = /^[\w-]{8,64}$/;

/** Address suggestions for the lookup box. Proxied so the Google key never reaches the browser. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const session = params.get("s") ?? "";

  if (!placesEnabled() || q.length < 3 || q.length > 200 || !TOKEN.test(session)) {
    return Response.json({ suggestions: [] });
  }
  try {
    // Whole states and counties can't be looked up, so don't offer them.
    const suggestions = (await autocomplete(q, session))
      .filter((s) => !s.broad)
      .map(({ placeId, main, secondary }) => ({ placeId, main, secondary }));
    return Response.json({ suggestions });
  } catch (err) {
    // Log the failure, not the query: what people type is their address.
    console.error("places autocomplete failed:", (err as Error).message);
    return Response.json({ suggestions: [] }, { status: 502 });
  }
}
