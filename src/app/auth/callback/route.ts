import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/src/lib/supabase/server";
import { claimAnonymous } from "@/src/lib/db";

// Google sends people back here after they sign in.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // On Vercel the real address arrives in a header.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const base =
    process.env.NODE_ENV !== "development" && forwardedHost
      ? `https://${forwardedHost}`
      : origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Attach the free result they got before signing in to their new account.
      const anonId = (await cookies()).get("rc_anon")?.value;
      let claimed = 0;
      if (anonId) {
        try {
          claimed = await claimAnonymous(anonId, data.user.id);
        } catch (claimError) {
          console.error("Claiming the anonymous result failed:", claimError);
        }
      }
      return NextResponse.redirect(`${base}/${claimed > 0 ? "?unlocked=1" : ""}`);
    }
  }

  return NextResponse.redirect(`${base}/?auth_error=1`);
}
