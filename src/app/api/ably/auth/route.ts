export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Ably from "ably";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ABLY_API_KEY) {
    return NextResponse.json({ error: "ABLY_API_KEY is not set" }, { status: 500 });
  }

  try {
    const client = new Ably.Rest(process.env.ABLY_API_KEY);
    const tokenRequestData = await client.auth.createTokenRequest({
      clientId: session.user.id,
    });
    return NextResponse.json(tokenRequestData);
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
