import arcjet, { detectBot, fixedWindow, shield } from "@arcjet/next";
import { NextRequest, NextResponse } from "next/server";

const arcjetMode: "DRY_RUN" | "LIVE" =
  (process.env.ARCJET_MODE as "DRY_RUN" | "LIVE" | undefined) ||
  (process.env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE");

const aj = arcjet({
  key: process.env.ARCJET_KEY as string,
  characteristics: ["ip.src", "http.request.uri.path"],
  rules: [
    shield({
      mode: arcjetMode,
    }),
    detectBot({
      mode: arcjetMode,
      allow: ["CATEGORY:SEARCH_ENGINE"],
    }),
    fixedWindow({
      mode: arcjetMode,
      window: "1m",
      max: 30,
    }),
  ],
});

export async function protectRoute(
  request: NextRequest
): Promise<NextResponse | null> {
  const decision = await aj.protect(request);

  if (decision.isDenied()) {
    if (decision.reason.isBot()) {
      return NextResponse.json(
        { error: "Bot detected. Automated requests are not allowed." },
        { status: 403 }
      );
    }

    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (decision.reason.isShield()) {
      return NextResponse.json(
        { error: "Request blocked by security filter." },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: "Request denied." }, { status: 403 });
  }

  return null;
}
