import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/supabase/server";
import { joinWaitlist } from "@/src/lib/db";

// "Notify me about the paid plan". Only for signed-in users, so we already
// have their email.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  try {
    await joinWaitlist(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Joining the waitlist failed:", error);
    return NextResponse.json({ error: "Could not join the waitlist. Please try again." }, { status: 500 });
  }
}
