import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { handleError, HttpError, parseBody, requireUser } from "@/lib/api";
import { DiagnoseRequestSchema } from "@/lib/ai/schema";
import { retrieveContext } from "@/lib/ai/retrieval";
import { aiConfigured, AiRefusedError, runDiagnosis } from "@/lib/ai/diagnose";
import { getEntitlements } from "@/lib/entitlements";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!aiConfigured()) throw new HttpError(503, "The AI assistant is not configured on this server.");
    const body = await parseBody(req, DiagnoseRequestSchema);

    const { data: profile } = await supabase.from("profiles").select("id, shop_id, role").eq("id", user.id).single();
    if (!profile) throw new HttpError(401, "Profile missing");
    const ent = await getEntitlements(profile);
    const limit = Number.isFinite(ent.aiQueriesPerMonth) ? ent.aiQueriesPerMonth : null;
    // p_limit null = unlimited (the generated type is non-nullable, the SQL function accepts null).
    const { data: allowed } = await supabase.rpc("consume_ai_query", { p_limit: limit as unknown as number });
    if (!allowed) throw new HttpError(402, `You've used your ${limit} free AI queries this month. Upgrade to Pro Tech for unlimited diagnostics.`);

    // Resolve the vehicle.
    let vehicle = body.vehicle ? { ...body.vehicle, engine: body.vehicle.engine ?? null } : null;
    let vehicleId = body.vehicle_id ?? null;
    if (vehicleId) {
      const { data: v } = await supabase.from("vehicles").select("year, make, model, engine, mileage").eq("id", vehicleId).maybeSingle();
      if (!v) throw new HttpError(404, "Vehicle not found");
      vehicle = { year: v.year, make: v.make, model: v.model, engine: v.engine };
      if (body.mileage == null) body.mileage = v.mileage;
    }
    if (!vehicle) throw new HttpError(400, "A vehicle is required");

    // Session + history.
    let sessionId = body.session_id ?? null;
    let history: { role: "user" | "assistant"; content: string }[] = [];
    if (sessionId) {
      const { data: s } = await supabase.from("ai_sessions").select("id, vehicle_id").eq("id", sessionId).maybeSingle();
      if (!s) throw new HttpError(404, "Session not found");
      vehicleId = vehicleId ?? s.vehicle_id;
      const { data: msgs } = await supabase.from("ai_messages").select("role, content").eq("session_id", sessionId).order("created_at").limit(12);
      history = (msgs ?? []).map((m) => ({ role: m.role, content: m.content }));
    } else {
      const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}${body.codes.length ? " · " + body.codes.slice(0, 3).join(" ") : ""}`;
      const { data: s, error } = await supabase
        .from("ai_sessions")
        .insert({ user_id: user.id, vehicle_id: vehicleId, title, vehicle_snapshot: { ...vehicle, mileage: body.mileage ?? null } })
        .select("id")
        .single();
      if (error) throw new HttpError(500, error.message);
      sessionId = s.id;
    }

    const docs = await retrieveContext({ vehicle, symptoms: body.symptoms, codes: body.codes });
    const userContent = body.follow_up ? body.follow_up : `${body.symptoms}${body.codes.length ? `\nCodes: ${body.codes.join(", ")}` : ""}${body.tests.length ? `\nTests: ${body.tests.map((t) => `${t.test} → ${t.result}`).join("; ")}` : ""}`;
    await supabase.from("ai_messages").insert({ session_id: sessionId, role: "user", content: userContent });

    let result;
    try {
      result = await runDiagnosis({ vehicle, mileage: body.mileage, symptoms: body.symptoms, codes: body.codes, tests: body.tests, docs, history, followUp: body.follow_up });
    } catch (e) {
      if (e instanceof AiRefusedError) throw new HttpError(422, e.message);
      if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "The AI service is busy. Try again in a moment.");
      if (e instanceof Anthropic.AuthenticationError) throw new HttpError(503, "AI credentials are invalid on this server.");
      if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI service error (${e.status}).`);
      throw e;
    }

    const { data: msg } = await supabase
      .from("ai_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: result.diagnosis.summary,
        structured: result.diagnosis as never,
        citations: result.citations as never,
        model: result.model,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      })
      .select("id")
      .single();

    return NextResponse.json({ session_id: sessionId, message_id: msg?.id, result, context_count: docs.length });
  } catch (e) {
    return handleError(e);
  }
}
