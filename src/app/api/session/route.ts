import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/src/lib/supabase/server";
import { countAnonAnalyses, countUserAnalyses, isOnWaitlist, latestForUser } from "@/src/lib/db";
import { MAX_ANALYSES_PER_USER, MAX_ANON_ANALYSES } from "@/src/lib/access";
import type { SessionInfo } from "@/src/lib/types";

// Tells the page who is signed in and how many checks they have left.
export async function GET(request: Request) {
  const wantLatest = new URL(request.url).searchParams.get("latest") === "1";

  try {
    const user = await getCurrentUser();

    if (!user) {
      const anonId = (await cookies()).get("rc_anon")?.value;
      const anonCount = anonId ? await countAnonAnalyses(anonId) : 0;
      const info: SessionInfo = {
        signedIn: false,
        email: null,
        used: 0,
        limit: MAX_ANALYSES_PER_USER,
        onWaitlist: false,
        anonUsed: anonCount >= MAX_ANON_ANALYSES,
        latest: null,
      };
      return NextResponse.json(info);
    }

    const [used, onWaitlist, latest] = await Promise.all([
      countUserAnalyses(user.id),
      isOnWaitlist(user.id),
      wantLatest ? latestForUser(user.id) : Promise.resolve(null),
    ]);
    const info: SessionInfo = {
      signedIn: true,
      email: user.email,
      used,
      limit: MAX_ANALYSES_PER_USER,
      onWaitlist,
      anonUsed: false,
      latest,
    };
    return NextResponse.json(info);
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ error: "Could not load your account." }, { status: 500 });
  }
}
