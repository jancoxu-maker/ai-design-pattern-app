import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ManualStep, CoverDesign, ManualMetadata, ProductInfo } from "../types";

const createClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 安全解析函数：自动剔除可能的 Markdown 标记
const safeParseJSON = (text: string) => {
  try {
    const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error("No JSON object found");
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    throw new Error("Failed to parse AI response as JSON");
  }
};

const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try { return await fn(); }
  catch (error: any) {
    if ((error?.status === 429 || error?.message?.includes('429')) && retries > 0) {
      await sleep(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const fileToPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({ inlineData: { data: (reader.result as string).split(',')[1], mimeType: file.type } });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- API Functions ---

export const generateProfessionalManual = async (
  description: string,
  productInfo: ProductInfo,
  images: File[],
  market: 'EU' | 'US',
  onProgress?: (message: string) => void
): Promise<{ metadata: Partial<ManualMetadata>; pages: any[] }> => {
  const ai = createClient();
  const imageParts = await Promise.all(images.slice(0, 5).map(f => fileToPart(f)));

  try {
    onProgress?.("Generating outline...");
    const outlineRes = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [...imageParts, { text: `Create manual outline for: ${description}` }] },
      config: { responseMimeType: "application/json" }
    }));
    const outlineData = safeParseJSON(outlineRes.text());

    const generatePart = async (title: string, prompt: string) => {
      onProgress?.(title);
      const res = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on outline: ${JSON.stringify(outlineData)}. ${prompt}`,
        config: { responseMimeType: "application/json" }
      }));
      return safeParseJSON(res.text());
    };

    const p1 = await generatePart("Writing Part 1...", "Write Chapters 1-7. Return JSON { pages: [...] }");
    const p2 = await generatePart("Writing Part 2...", "Write Chapters 8-9. Return JSON { pages: [...] }");
    const p3 = await generatePart("Writing Part 3...", "Write Chapters 10-11. Return JSON { pages: [...] }");

    // 关键修复：强制数组类型检查
    const allPages = [
      ...(Array.isArray(p1.pages) ? p1.pages : []),
      ...(Array.isArray(p2.pages) ? p2.pages : []),
      ...(Array.isArray(p3.pages) ? p3.pages : [])
    ];

    return { metadata: outlineData.metadata || {}, pages: allPages };
  } catch (error) {
    console.error("Manual Generation Error:", error);
    throw error;
  }
};

// 保持其他简单函数不变，只需更新 parse 方式
export const generateDescriptionFromImages = async (files: File[]): Promise<string> => {
    const ai = createClient();
    const imageParts = await Promise.all(files.slice(0, 3).map(f => fileToPart(f)));
    const res = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [...imageParts, { text: "Describe this action." }] },
        config: { responseMimeType: "application/json" }
    });
    return safeParseJSON(res.text()).description;
};

// 对于其他函数（refineStepText 等），直接调用 safeParseJSON(res.text()) 即可
