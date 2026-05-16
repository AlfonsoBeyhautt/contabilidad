import OpenAI from "openai";
import { NextResponse } from "next/server";
import { OPENAI_INTELLIGENCE_MODEL } from "@/lib/intelligence/openai-model";

export const runtime = "nodejs";

const MAX_QUESTION_CHARS = 1_500;
const MAX_ASSISTANT_CHARS = 12_000;
const MAX_MESSAGES = 14;
const MAX_CONTEXT_JSON_CHARS = 100_000;

type ChatRole = "user" | "assistant";

type IncomingMessage = { role: ChatRole; content: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function sanitizeMessages(raw: unknown): IncomingMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: IncomingMessage[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const role = item.role;
    const content = item.content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const trimmed = content.replace(/\u0000/g, "").trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_ASSISTANT_CHARS) return null;
    out.push({ role, content: trimmed });
  }
  if (out.length > MAX_MESSAGES) return null;
  return out;
}

const SYSTEM_INSTRUCTIONS = `Sos el "Analista empresarial" integrado en un sistema de gestión comercial y financiera para PyMEs (Argentina / español rioplatense profesional).

REGLAS ESTRICTAS:
1) Usá EXCLUSIVAMENTE el JSON "businessContext" provisto en este turno. No inventes cifras, porcentajes, nombres de clientes/productos ni hechos que no estén en ese contexto.
2) Si el contexto no alcanza para responder con evidencia, decilo explícitamente y pedí qué dato falta o sugerí qué cargar en la app.
3) No des asesoramiento legal, impositivo ni contable formal. Podés orientar en gestión y lectura financiera con el lenguaje "desde los datos cargados…".
4) Mantené tono ejecutivo: claro, sobrio, directo. Evitá frases genéricas ("reducí costos") sin atarlas a datos del contexto.
5) No fuerces respuestas estructuradas tipo consultora o template numerado.
Respondé de forma natural y ejecutiva.

Solo usá estructura o bullets cuando realmente ayuden a la claridad.

Priorizá:
- interpretación,
- causalidad,
- contexto,
- relación entre métricas,
- explicación del negocio.

No repitas obviedades como "los egresos son mayores a los ingresos" sin profundizar qué componentes están explicando eso y por qué importa.
6) Los números y métricas ya fueron calculados por el sistema: interpretalos, contrastalos y explicá el vínculo causal probable, sin contradecir el motor determinístico salvo que aclares una limitación del dato.
7) Si el negocio no tiene ventas o el período está vacío, no dramatices: indicá que no hay actividad registrada en el período.
8) No respondas como un chatbot genérico ni como una consultora abstracta.

Evitá:
- frases MBA vacías,
- consejos genéricos,
- recomendaciones universales,
- repetir métricas evidentes,
- tono robótico,
- respuestas escolares.

La respuesta debe sentirse como la explicación de un analista financiero senior que realmente entiende el negocio y está explicándole al dueño qué está ocurriendo.

9) No expliques solamente QUÉ está pasando.
Priorizá explicar POR QUÉ probablemente está pasando y qué métricas están empujando el resultado.

10) Si detectás un problema importante, explicá:
- qué lo está causando,
- qué tan grave parece,
- y qué área del negocio merece atención primero.

11) Cuando haya pérdidas, no dramatices automáticamente.
Analizá:
- si el problema parece estructural o temporal,
- si el negocio igual tiene buena facturación,
- si existen señales positivas,
- y qué variables están deteriorando la rentabilidad.`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "missing_api_key",
        message:
          "Falta la variable de entorno OPENAI_API_KEY en el servidor. Configurala en Vercel (Project Settings → Environment Variables) o en .env.local para desarrollo.",
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

  const messages = sanitizeMessages(body.messages);
  if (!messages || messages.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_messages",
        message: "Debés enviar al menos un mensaje de usuario o asistente válido.",
      },
      { status: 400 },
    );
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return NextResponse.json(
      {
        error: "invalid_turn",
        message: "El último mensaje debe ser del usuario.",
      },
      { status: 400 },
    );
  }

  if (last.content.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      {
        error: "question_too_long",
        message: `La pregunta supera ${MAX_QUESTION_CHARS} caracteres.`,
      },
      { status: 400 },
    );
  }

  const businessContext = body.businessContext;
  if (!isRecord(businessContext)) {
    return NextResponse.json(
      {
        error: "invalid_context",
        message: "Falta businessContext (objeto JSON).",
      },
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
      {
        error: "context_too_large",
        message: "El contexto enviado es demasiado grande.",
      },
      { status: 400 },
    );
  }

  const openai = new OpenAI({ apiKey });

  const completionMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM_INSTRUCTIONS}\n\nbusinessContext (JSON):\n${contextString}`,
    },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_INTELLIGENCE_MODEL,
      messages: completionMessages,
      temperature: 0.35,
      max_tokens: 2_048,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json(
        {
          error: "empty_completion",
          message: "OpenAI devolvió una respuesta vacía. Probá de nuevo.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      reply: text,
      model: OPENAI_INTELLIGENCE_MODEL,
    });
  } catch {
    return NextResponse.json(
      {
        error: "openai_error",
        message:
          "No se pudo completar el análisis con IA. Verificá la API key, saldo de cuenta y reintentá en unos minutos.",
      },
      { status: 502 },
    );
  }
}
