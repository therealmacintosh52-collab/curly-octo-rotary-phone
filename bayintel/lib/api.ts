import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "@/lib/providers/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401, "Sign in required");
  return { supabase, user };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  return schema.parse(json);
}

export function handleError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 400 });
  if (e instanceof ProviderError) return NextResponse.json({ error: `${e.provider} is unavailable right now. ${e.message}` }, { status: 502 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
