import { NextRequest, NextResponse } from "next/server"

const COMPUTE_BASE_URL = "https://integrate.api.nvidia.com/v1"

const PREMIUM_ENDPOINTS: Record<string, { url: string; defaultModel: string }> = {
  "gemini-2.5-flash": { url: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-flash" },
  "gpt-4o": { url: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  "claude-sonnet-4-20250514": { url: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-20250514" },
}

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { modelId, apiKey, messages } = (await req.json()) as {
      modelId: string
      apiKey?: string
      messages: ChatMessage[]
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const premium = PREMIUM_ENDPOINTS[modelId]
    const baseUrl = premium ? premium.url : COMPUTE_BASE_URL
    const key = premium ? apiKey : (process.env.NVIDIA_API_KEY || apiKey)

    if (!key) {
      return NextResponse.json({ error: "API key required" }, { status: 400 })
    }

    const systemMessage: ChatMessage = {
      role: "system",
      content: "You are an AI poker agent. You're chatting with a potential player who wants to test your intelligence and response speed. Be concise, witty, and show poker knowledge. Keep responses under 3 sentences.",
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [systemMessage, ...messages],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Model API error: ${err.slice(0, 200)}` }, { status: res.status })
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? "No response"

    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.slice(0, 200) ?? "Unknown error" }, { status: 500 })
  }
}
