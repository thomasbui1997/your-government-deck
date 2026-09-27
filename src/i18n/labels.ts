import type { TierLabel } from "@/lib/types";
import { format } from "./config";
import type { ClientDictionary } from "./dictionaries/en";

export function tierTitle(label: TierLabel, t: ClientDictionary) {
  if ("text" in label) return label.text;
  if ("state" in label) return format(t.tiers[label.key], { state: label.state });
  return t.tiers[label.key];
}

/** Office titles come from the data layer in English; unknown ones stay in English. */
export function officeTitle(office: string, t: ClientDictionary) {
  return t.offices[office] ?? office;
}
