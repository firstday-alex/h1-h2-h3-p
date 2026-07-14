import { NextRequest, NextResponse } from "next/server";
import { extract } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1|0\.0\.0\.0)/i;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing ?url= parameter." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are supported." }, { status: 400 });
  }
  if (BLOCKED_HOST.test(target.hostname)) {
    return NextResponse.json({ error: "Internal / local addresses are not allowed." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `The site returned HTTP ${res.status} ${res.statusText}.` },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return NextResponse.json(
        { error: `Expected an HTML page but got "${contentType || "unknown"}".` },
        { status: 415 },
      );
    }

    const html = await res.text();
    const result = extract(html, target.toString());
    return NextResponse.json(result);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "The request timed out after 20s." : "Failed to fetch that page." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
