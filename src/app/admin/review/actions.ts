"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  type PromiseStatus,
  type PromiseTopic,
  promiseKey,
  STATUSES,
  TOPICS,
  type TrackedPromise,
} from "@/lib/promises";
import { readDraftFile, readPublished, reviewEnabled, writeDraftFile, writePublished } from "./store";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function takeDraft(form: FormData) {
  if (!reviewEnabled) throw new Error("Review is only available in local development");
  const officialId = field(form, "officialId");
  const draftId = field(form, "draftId");
  const file = readDraftFile(officialId);
  const draft = file?.drafts.find((d) => d.draftId === draftId);
  if (!file || !draft) throw new Error("Draft not found; it may already be reviewed");
  return { file, draft, officialId };
}

function newId(text: string) {
  const slug = promiseKey(text).split(" ").slice(0, 6).join("-");
  return `${slug}-${createHash("sha256").update(text).digest("hex").slice(0, 6)}`;
}

export async function approveDraft(form: FormData) {
  const { file, draft, officialId } = takeDraft(form);

  const status = field(form, "status") as PromiseStatus;
  const topic = field(form, "topic") as PromiseTopic;
  if (!STATUSES.includes(status) || !TOPICS.includes(topic)) throw new Error("Bad status or topic");
  const keep = new Set(form.getAll("evidence").map(Number));

  const text = field(form, "text") || draft.text;
  const promise: TrackedPromise = {
    id: draft.updatesId ?? newId(text),
    text,
    topic,
    quote: draft.quote,
    source: draft.source,
    status,
    statusNote: field(form, "statusNote"),
    evidence: draft.evidence.filter((_, i) => keep.has(i)),
    lastReviewed: new Date().toISOString().slice(0, 10),
  };

  const published = readPublished();
  const entry = (published[officialId] ??= {
    officialId,
    name: file.name,
    updatedAt: "",
    promises: [],
    rejected: [],
  });
  const at = entry.promises.findIndex((p) => p.id === promise.id);
  if (at >= 0) entry.promises[at] = promise;
  else entry.promises.push(promise);
  entry.updatedAt = new Date().toISOString();
  writePublished(published);

  writeDraftFile({ ...file, drafts: file.drafts.filter((d) => d.draftId !== draft.draftId) });
  revalidatePath("/admin/review");
}

export async function rejectDraft(form: FormData) {
  const { file, draft, officialId } = takeDraft(form);

  // Remember rejected new promises so the next pipeline run doesn't propose them again.
  // A rejected status update just leaves the published promise as it was.
  if (!draft.updatesId) {
    const published = readPublished();
    const entry = (published[officialId] ??= {
      officialId,
      name: file.name,
      updatedAt: new Date().toISOString(),
      promises: [],
      rejected: [],
    });
    entry.rejected = [...new Set([...entry.rejected, draft.text])];
    writePublished(published);
  }

  writeDraftFile({ ...file, drafts: file.drafts.filter((d) => d.draftId !== draft.draftId) });
  revalidatePath("/admin/review");
}
