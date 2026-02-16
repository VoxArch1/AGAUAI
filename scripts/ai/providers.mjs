import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export const PROVIDER_ORDER = ["ChatGPT", "Gemini", "Claude", "Grok", "LLaMA"];

export function enabledProviders() {
  return {
    Claude: !!process.env.ANTHROPIC_API_KEY,
    Grok: !!process.env.XAI_API_KEY,
    Gemini: !!process.env.GEMINI_API_KEY,
    LLaMA: !!process.env.OPENAI_API_KEY,
    ChatGPT: !!(process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY)
  };
}

async function callClaude(prompt) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest",
    max_tokens: 500,
    temperature: 0,
    messages: [{ role: "user", content: prompt }]
  });
  return response.content?.[0]?.type === "text" ? response.content[0].text : null;
}

async function callGemini(prompt) {
  const google = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = google.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
  const response = await model.generateContent(prompt);
  return response.response?.text?.() ?? null;
}

async function callGrok(prompt) {
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: process.env.XAI_BASEURL || "https://api.x.ai/v1"
  });
  const response = await client.chat.completions.create({
    model: process.env.XAI_MODEL || "grok-4-0709",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });
  return response.choices?.[0]?.message?.content ?? null;
}

async function callLLaMA(prompt) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASEURL || undefined
  });
  const response = await client.chat.completions.create({
    model: process.env.LLAMA_MODEL || "llama-3.1-70b-instruct",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });
  return response.choices?.[0]?.message?.content ?? null;
}

async function callChatGPT(prompt) {
  const client = new OpenAI({
    apiKey: process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.CHATGPT_BASEURL || undefined
  });
  const response = await client.chat.completions.create({
    model: process.env.CHATGPT_MODEL || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });
  return response.choices?.[0]?.message?.content ?? null;
}

const PROVIDER_CALLERS = {
  Claude: callClaude,
  Grok: callGrok,
  Gemini: callGemini,
  LLaMA: callLLaMA,
  ChatGPT: callChatGPT
};

export async function callProvider(name, prompt) {
  const enabled = enabledProviders();
  if (!Object.hasOwn(PROVIDER_CALLERS, name)) {
    throw new Error(`Unknown provider: ${name}`);
  }
  if (!enabled[name]) {
    throw new Error(`Provider ${name} is not enabled in environment`);
  }

  return PROVIDER_CALLERS[name](prompt);
}
