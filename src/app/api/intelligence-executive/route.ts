import OpenAI from "openai";
import { NextResponse } from "next/server";
import { OPENAI_INTELLIGENCE_MODEL } from "@/lib/intelligence/openai-model";
import {
  ANALYST_CORE_RULES,
  EXECUTIVE_JSON_SHAPE_DESC,
} from "@/lib/intelligence/openai-analyst-rules";
import { parseExecutiveAnalysisJson } from "@/lib/intelligence/executive-analysis-types";

export const runtime = "nodejs";

const MAX_CONTEXT_JSON_CHARS = 100_000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "missing_api_key",
        message:
          "Falta OPENAI_API_KEY en el servidor. Configurala en Vercel (Project Settings → Environment Variables) o en .env.local.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Cuerpo JSON inválido." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "invalid_body", message: "Solicitud inválida." },
      { status: 400 },
    );
  }

  const businessContext = body.businessContext;
  if (!isRecord(businessContext)) {
    return NextResponse.json(
      { error: "invalid_context", message: "Falta businessContext." },
      { status: 400 },
    );
  }

  let contextString: string;
  try {
    contextString = JSON.stringify(businessContext);
  } catch {
    return NextResponse.json(
      { error: "context_stringify", message: "No se pudo serializar el contexto." },
      { status: 400 },
    );
  }

  if (contextString.length > MAX_CONTEXT_JSON_CHARS) {
    return NextResponse.json(
      { error: "context_too_large", message: "El contexto es demasiado grande." },
      { status: 400 },
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_INTELLIGENCE_MODEL,
      temperature: 0.28,
      max_tokens: 3_500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${ANALYST_CORE_RULES}\n\n${EXECUTIVE_JSON_SHAPE_DESC}\n\nbusinessContext (JSON):\n${contextString}`,
        },
        {
          role: "user",
          content:
            "Generá el informe ejecutivo en el formato JSON acordado. Usá solo evidencia del businessContext.",
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json(
        {
          error: "empty_completion",
          message: "La IA devolvió una respuesta vacía. Reintentá.",
        },
        { status: 502 },
      );
    }

    const parsed = parseExecutiveAnalysisJson(raw);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "invalid_analysis_json",
          message:
            "La respuesta no pudo interpretarse como informe estructurado. Probá regenerar.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      analysis: parsed,
      model: OPENAI_INTELLIGENCE_MODEL,
    });
  } catch {
    return NextResponse.json(
      {
        error: "openai_error",
        message:
          "No se pudo generar el análisis. Verificá API key, saldo y conectividad.",
      },
      { status: 502 },
    );
  }
}
