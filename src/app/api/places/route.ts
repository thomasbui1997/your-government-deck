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
    return Response.json({ suggestions: await autocomplete(q, session) });
  } catch (err) {
    // Log the failure, not the query: what people type is their address.
    console.error("places autocomplete failed:", (err as Error).message);
    return Response.json({ suggestions: [] }, { status: 502 });
  }
}
