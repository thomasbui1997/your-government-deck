// Runs a Claude request that must finish by calling one strict "submit" tool.
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export const MODEL = "claude-opus-5";

const client = new Anthropic();

// $ per million tokens for claude-opus-5; used only for the cost printout.
const PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

export const usageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 };

export function costSoFar() {
  const t = usageTotals;
  const tokens =
    (t.input * PRICE.input +
      t.output * PRICE.output +
      t.cacheRead * PRICE.cacheRead +
      t.cacheWrite * PRICE.cacheWrite) /
    1e6;
  // Web search is billed at $10 per 1,000 searches.
  return tokens + t.searches * 0.01;
}

export interface SubmitResult<T> {
  value: T;
  /** Every URL that appeared in a web search or web fetch result during the run. */
  seenUrls: Set<string>;
}

const WEB_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 10 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
];

function collectUrls(content: Anthropic.Beta.BetaContentBlock[], seen: Set<string>) {
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) seen.add(r.url);
    } else if (block.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") {
      seen.add(block.content.url);
    }
  }
}

/**
 * Sends `prompt` and loops until Claude calls `submitName` with input that passes `schema`.
 * Handles pause_turn (long server-tool turns), nudges once if Claude stops without
 * submitting, and returns a validation error to Claude to fix if the input is invalid.
 */
export async function runToSubmit<T>(opts: {
  system: string;
  prompt: Anthropic.Beta.BetaContentBlockParam[];
  submitName: string;
  submitDescription: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  web: boolean;
  label: string;
}): Promise<SubmitResult<T>> {
  const submitTool: Anthropic.Beta.BetaTool = {
    name: opts.submitName,
    description: opts.submitDescription,
    strict: true,
    // Streams the (large) submission as it's generated; schema.safeParse below is the
    // validation, since streamed input isn't validated server-side.
    eager_input_streaming: true,
    input_schema: opts.jsonSchema as Anthropic.Beta.BetaTool.InputSchema,
  };
  const tools = opts.web ? [...WEB_TOOLS, submitTool] : [submitTool];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const seenUrls = new Set<string>();

  for (let turn = 0; turn < 12; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });
    const message = await stream.finalMessage();

    const u = message.usage;
    usageTotals.input += u.input_tokens;
    usageTotals.output += u.output_tokens;
    usageTotals.cacheRead += u.cache_read_input_tokens ?? 0;
    usageTotals.cacheWrite += u.cache_creation_input_tokens ?? 0;
    usageTotals.searches += u.server_tool_use?.web_search_requests ?? 0;
    collectUrls(message.content, seenUrls);

    if (message.stop_reason === "refusal") {
      throw new Error(`[${opts.label}] model declined: ${message.stop_details?.explanation ?? "no details"}`);
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error(`[${opts.label}] hit max_tokens before submitting`);
    }

    messages.push({ role: "assistant", content: message.content });

    // Long server-tool turns pause; re-sending the history resumes them.
    if (message.stop_reason === "pause_turn") continue;

    const submit = message.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === opts.submitName,
    );
    if (!submit) {
      messages.push({
        role: "user",
        content: `Please finish by calling the ${opts.submitName} tool with your results.`,
      });
      continue;
    }

    const parsed = opts.schema.safeParse(submit.input);
    if (parsed.success) return { value: parsed.data, seenUrls };

    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: submit.id,
          is_error: true,
          content: `Invalid input: ${parsed.error.message}. Fix it and call ${opts.submitName} again.`,
        },
      ],
    });
  }
  throw new Error(`[${opts.label}] gave up after too many turns without a valid submission`);
}
