import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Structured-output schema — the model is forced to return exactly this shape,
// so the response is always valid JSON we can trust.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", description: "One-sentence overall judgment." },
    score: { type: "integer", description: "0-100 coherence score." },
    band: { type: "string", enum: ["easy", "clear", "moderate", "choppy", "hard"] },
    dimensions: {
      type: "array",
      description: "One entry per rubric dimension.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          score: { type: "integer", description: "0-100 for this dimension." },
          assessment: { type: "string", description: "1-2 sentences." },
          evidence: {
            type: "string",
            description: "A short phrase quoted verbatim from the copy that supports the assessment, or an empty string if none applies.",
          },
        },
        required: ["name", "score", "assessment", "evidence"],
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "score", "band", "dimensions", "strengths", "issues"],
} as const;

const SYSTEM = `You are an editor evaluating whether the COPY of a landing/marketing page tells a coherent, easy-to-follow story.

Rules you must follow strictly:
- Judge ONLY the text provided. Do not use outside knowledge about the brand or product.
- Every claim you make must be grounded in the text. When you cite evidence, quote a short phrase VERBATIM from the copy. If you cannot find supporting text, use an empty string for evidence — never invent a quote.
- If something is genuinely unclear or there is not enough text to judge, say so plainly rather than guessing.
- Do not reward or penalize based on design, images, or layout — you only see the text.

Grade these dimensions, each 0-100:
1. "Logical flow" — does each section follow naturally from the previous one; is there a clear beginning, middle, and end?
2. "Message clarity" — is the core value proposition obvious and consistently stated?
3. "Consistency" — are claims, tone, and terminology consistent throughout (no contradictions)?
4. "Gaps & non-sequiturs" — are there unexplained jumps, missing context, or sections that don't connect?
5. "Redundancy" — is the same point repeated more than it needs to be?

Then give an overall 0-100 "score" and a "band":
- 85-100 -> "easy" (easy to follow)
- 70-84 -> "clear" (mostly clear)
- 55-69 -> "moderate"
- 40-54 -> "choppy"
- 0-39 -> "hard" (hard to follow)

"strengths" and "issues" are short bullet strings a marketer can act on. Keep the whole response concise.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The writing grader needs an ANTHROPIC_API_KEY. Set it in .env.local (local) or in your Vercel project's Environment Variables, then retry.",
        needsKey: true,
      },
      { status: 501 },
    );
  }

  let body: { markdown?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const markdown = (body.markdown || "").trim();
  const title = (body.title || "Untitled page").trim();
  if (!markdown) {
    return NextResponse.json({ error: "No copy to grade — extract a page first." }, { status: 400 });
  }
  // Keep the request bounded (these pages are a few KB; this is a safety cap).
  const copy = markdown.slice(0, 60_000);

  const client = new Anthropic();

  try {
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Page title: ${title}\n\nHere is the extracted copy (markdown). Grade how coherent and easy to follow the story is.\n\n---\n${copy}\n---`,
        },
      ],
    });

    if (res.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to grade this content." },
        { status: 422 },
      );
    }

    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "The grader returned no output." }, { status: 502 });
    }

    const report = JSON.parse(textBlock.text);
    return NextResponse.json({ report });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const status = err.status === 401 ? 401 : 502;
      return NextResponse.json(
        {
          error:
            err.status === 401
              ? "The ANTHROPIC_API_KEY was rejected (401). Check the key."
              : `The grader failed (${err.status ?? "unknown"}: ${err.message}).`,
        },
        { status },
      );
    }
    return NextResponse.json({ error: "The grader failed unexpectedly." }, { status: 502 });
  }
}
