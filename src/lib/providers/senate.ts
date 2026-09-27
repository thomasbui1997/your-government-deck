import "server-only";
import { XMLParser } from "fast-xml-parser";
import type { ActivityItem } from "@/lib/types";
import { currentCongress } from "./congress";

// Senate roll calls aren't in the Congress.gov API; senate.gov publishes them as XML.
const LIS = "https://www.senate.gov/legislative/LIS";
const parser = new XMLParser({ isArray: (name) => name === "vote" || name === "member" });

async function getXml<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": "YourGovernmentDeck/0.1" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`senate.gov ${res.status} for ${url}`);
  return parser.parse(await res.text()) as T;
}

interface VoteMenu {
  vote_summary: { votes: { vote: { vote_number: string | number }[] } };
}

interface RollCall {
  roll_call_vote: {
    vote_date: string; // "September 24, 2026,  01:45 PM"
    question: string;
    vote_result: string;
    vote_document_text?: string;
    document?: { document_name?: string };
    amendment?: {
      amendment_number?: string;
      amendment_to_document_number?: string;
      amendment_purpose?: string;
    };
    members: { member: { lis_member_id: string; vote_cast: string }[] };
  };
}

function isoDate(senateDate: string) {
  const d = new Date(senateDate.split(",").slice(0, 2).join(","));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The senator's votes on the most recent Senate roll calls. */
export async function getSenateVotes(lisId: string, limit: number): Promise<ActivityItem[]> {
  const { congress, session } = currentCongress();
  const menu = await getXml<VoteMenu>(
    `${LIS}/roll_call_lists/vote_menu_${congress}_${session}.xml`,
    3600,
  );
  const numbers = menu.vote_summary.votes.vote
    .map((v) => Number(v.vote_number))
    .sort((a, b) => b - a)
    .slice(0, limit);

  const items = await Promise.all(
    numbers.map(async (n) => {
      const padded = String(n).padStart(5, "0");
      const url = `${LIS}/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.xml`;
      const { roll_call_vote: v } = await getXml<RollCall>(url, 7 * 86400);
      const cast = v.members.member.find((m) => m.lis_member_id === lisId)?.vote_cast;
      if (!cast) return null;
      const amdt = v.amendment?.amendment_number ? v.amendment : undefined;
      const doc = amdt?.amendment_to_document_number || v.document?.document_name || undefined;
      // Amendment votes only carry the amendment's purpose, so name what it amends.
      const title = amdt
        ? `${amdt.amendment_number}${doc ? ` to ${doc}` : ""}: ${amdt.amendment_purpose ?? v.question}`
        : v.vote_document_text || `${v.question}${doc ? ` ${doc}` : ""}`;
      return {
        kind: "vote",
        date: isoDate(v.vote_date),
        title,
        badge: cast,
        detail: [doc, v.question, v.vote_result].filter(Boolean).join(" · "),
        url: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.htm`,
      } satisfies ActivityItem;
    }),
  );
  return items.filter((i): i is NonNullable<typeof i> => i !== null);
}
