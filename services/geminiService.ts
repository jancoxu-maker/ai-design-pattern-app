import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ManualStep, CoverDesign, ManualMetadata, ProductInfo } from "../types";

const createClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 兼容性获取 text 的方法：兼容 res.text 属性和 res.text() 方法
const getTextFromRes = (res: any) => {
  if (typeof res.text === 'function') return res.text();
  return res.text;
};

// 增强版：处理双重转义和清洗，防止 JSON 解析报错
const safeParseJSON = (text: string) => {
  try {
    let cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    let parsed = JSON.parse(cleaned);
    // 如果解析后还是字符串，说明被二次转义，再解析一次
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch (e) {
    console.error("SafeParse Error:", text);
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
    const outlineData = safeParseJSON(getTextFromRes(outlineRes));
    
    const generatePart = async (title: string, prompt: string) => {
      onProgress?.(title);
      const res = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on outline: ${JSON.stringify(outlineData)}. ${prompt}`,
        config: { responseMimeType: "application/json" }
      }));
      return safeParseJSON(getTextFromRes(res));
    };

    const p1 = await generatePart("Writing Part 1...", "Write Chapters 1-7. Return JSON { pages: [...] }");
    const p2 = await generatePart("Writing Part 2...", "Write Chapters 8-9. Return JSON { pages: [...] }");
    const p3 = await generatePart("Writing Part 3...", "Write Chapters 10-11. Return JSON { pages: [...] }");

    // 强制合并逻辑，彻底过滤掉无效数据
    const p1Pages = Array.isArray(p1?.pages) ? p1.pages : [];
    const p2Pages = Array.isArray(p2?.pages) ? p2.pages : [];
    const p3Pages = Array.isArray(p3?.pages) ? p3.pages : [];

    const allPages = [...p1Pages, ...p2Pages, ...p3Pages].map(page => ({
        ...page,
        // 只有当 page 确实是一个对象时才处理，否则返回默认值
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
    contents: { parts: [...parts, { text: "Describe this action." }] }
  });
  return safeParseJSON(getTextFromRes(res)).description;
};

export const refineStepText = async (t: string, d: string): Promise<AIResponse> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Refine: "${t}", "${d}"` });
  return safeParseJSON(getTextFromRes(res)) as AIResponse;
};

export const generateStepTitle = async (d: string): Promise<string> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Generate title for: "${d}"` });
  return safeParseJSON(getTextFromRes(res)).title;
};

export const generatePageTitle = async (steps: ManualStep[]): Promise<string> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Generate section title for steps: ${JSON.stringify(steps)}` });
  return safeParseJSON(getTextFromRes(res)).pageTitle;
};

export const generateCoverDesign = async (context: string): Promise<{ title: string; subtitle: string; design: CoverDesign }> => {
  const ai = createClient();
  const res = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Generate cover for: ${context.slice(0, 1000)}` });
  return safeParseJSON(getTextFromRes(res));
};
