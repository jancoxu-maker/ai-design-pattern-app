import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ManualStep, CoverDesign, ManualMetadata, ProductInfo } from "../types";

const createClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getTextFromRes = (res: any) => {
  if (typeof res.text === 'function') return res.text();
  return res.text;
};

// 极度宽容的解析模式
const safeParseJSON = (text: string) => {
  try {
    // 直接定位第一个 '{' 和最后一个 '}'，暴力切割中间内容
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return { pages: [], metadata: {} };
    
    let cleaned = text.substring(start, end + 1);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("SafeParse Error (宽容模式):", text);
    // 返回空结构，防止程序崩溃
    return { pages: [], metadata: {} }; 
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

const STRICT_RULES = `
  STRICT RULES:
  - OUTPUT MUST BE A SINGLE VALID JSON OBJECT.
  - DO NOT include markdown code blocks (no \`\`\`json).
  - DO NOT add ANY conversational text before or after the JSON.
  - DO NOT use the word "Chapter" or numbering like "Chapter 1".
`;

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
      contents: { parts: [...imageParts, { text: `Create manual outline for: ${description}. Return JSON { metadata, chapters }. ${STRICT_RULES}` }] },
      config: { responseMimeType: "application/json" }
    }));
    const outlineData = safeParseJSON(getTextFromRes(outlineRes));
    
    const generatePart = async (title: string, prompt: string) => {
      onProgress?.(title);
      const res = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on outline: ${JSON.stringify(outlineData)}. ${prompt}. ${STRICT_RULES}`,
        config: { responseMimeType: "application/json" }
      }));
      return safeParseJSON(getTextFromRes(res));
    };

    const p1 = await generatePart("Writing Part 1...", "Write Chapters 1-7. Return JSON { pages: [...] }");
    const p2 = await generatePart("Writing Part 2...", "Write Chapters 8-9. Return JSON { pages: [...] }");
    const p3 = await generatePart("Writing Part 3...", "Write Chapters 10-11. Return JSON { pages: [...] }");

    const allPages = [
      ...(Array.isArray(p1?.pages) ? p1.pages : []),
      ...(Array.isArray(p2?.pages) ? p2.pages : []),
      ...(Array.isArray(p3?.pages) ? p3.pages : [])
    ].map(page => ({
        ...page,
        title: (page && typeof page === 'object' && page.title) ? page.title : "Untitled Section",
        description: (page && typeof page === 'object' && page.description) ? page.description : ""
    }));
    
    return { metadata: outlineData.metadata || {}, pages: allPages };
  } catch (error) { throw error; }
};

export const generateDescriptionFromImages = async (files: File[]): Promise<string> => {
  const ai = createClient();
  const parts = await Promise.all(files.slice(0, 3).map(f => fileToPart(f)));
  const res = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [...parts, { text: "Describe this action. " + STRICT_RULES }] }
  });
  return safeParseJSON(getTextFromRes(res)).description || "";
};

export const refineStepText = async (t: string, d: string): Promise<AIResponse> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Refine: "${t}", "${d}". ${STRICT_RULES}` });
  return safeParseJSON(getTextFromRes(res)) as AIResponse;
};

export const generateStepTitle = async (d: string): Promise<string> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Generate title for: "${d}". ${STRICT_RULES}` });
  return safeParseJSON(getTextFromRes(res)).title || "Untitled";
};

export const generatePageTitle = async (steps: ManualStep[]): Promise<string> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Generate section title for steps: ${JSON.stringify(steps)}. ${STRICT_RULES}` });
  return safeParseJSON(getTextFromRes(res)).pageTitle || "New Section";
};

export const generateCoverDesign = async (context: string): Promise<{ title: string; subtitle: string; design: CoverDesign }> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Generate cover for: ${context.slice(0, 1000)}. ${STRICT_RULES}` });
  return safeParseJSON(getTextFromRes(res));
};
