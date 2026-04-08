import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ManualStep, CoverDesign, ManualMetadata, ProductInfo } from "../types";

const createClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 工具函数：安全解析 JSON，自动剔除 Markdown 标记或多余的文字
const safeParseJSON = (text: string) => {
  try {
    // 1. 去掉 Markdown 标记 (如 ```json ... ```)
    const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    // 2. 找到第一个 '{' 和最后一个 '}' 之间的内容
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error("No JSON object found in response");
    
    return JSON.parse(cleaned.substring(start, end + 1));
  } catch (e) {
    console.error("JSON 解析失败，原始文本：", text);
    throw new Error("Failed to parse AI response as JSON");
  }
};

const callWithRetry = async <T>(
  fn: () => Promise<T>,
  retries = 5,
  delay = 5000
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit hit, retrying in ${delay}ms... (${retries} retries left)`);
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
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateDescriptionFromImages = async (files: File[]): Promise<string> => {
  const ai = createClient();
  if (files.length === 0) throw new Error("No images provided");
  const imageParts = await Promise.all(files.slice(0, 3).map(f => fileToPart(f)));

  const prompt = `
  Analyze these images which illustrate a step in a user manual. 
  Write a clear, concise, and instructional description of what is happening.
  IMPORTANT: Output English only. No Chinese characters.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [...imageParts, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { description: { type: Type.STRING } }, required: ["description"] },
    },
  });

  if (!response.text) throw new Error("No response from AI");
  const data = safeParseJSON(response.text) as { description: string };
  return data.description;
};

export const refineStepText = async (currentTitle: string, currentDescription: string): Promise<AIResponse> => {
  const ai = createClient();
  const prompt = `Refine this user manual step: "${currentTitle}", Description: "${currentDescription}". Return in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { refinedTitle: { type: Type.STRING }, refinedDescription: { type: Type.STRING } }, required: ["refinedTitle", "refinedDescription"] },
    },
  });

  if (!response.text) throw new Error("No response from AI");
  return safeParseJSON(response.text) as AIResponse;
};

export const generateStepTitle = async (description: string): Promise<string> => {
  const ai = createClient();
  const prompt = `Generate a short title (max 5 words) for: "${description}".`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ["title"] },
    },
  });

  if (!response.text) throw new Error("No response from AI");
  const data = safeParseJSON(response.text) as { title: string };
  return data.title;
};

export const generatePageTitle = async (steps: ManualStep[]): Promise<string> => {
  const ai = createClient();
  const stepsContent = steps.map((s, i) => `Step ${i+1}: ${s.title} - ${s.description}`).join('\n');
  const prompt = `Generate a section title (under 5 words) for: ${stepsContent}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { pageTitle: { type: Type.STRING } }, required: ["pageTitle"] },
    },
  });

  if (!response.text) throw new Error("No response from AI");
  const data = safeParseJSON(response.text) as { pageTitle: string };
  return data.pageTitle;
};

export const generateCoverDesign = async (context: string): Promise<{ title: string; subtitle: string; design: CoverDesign }> => {
  const ai = createClient();
  const prompt = `Generate manual cover title, subtitle, and design style for: ${context.slice(0, 2000)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, subtitle: { type: Type.STRING }, design: { type: Type.OBJECT } }, required: ["title", "subtitle", "design"] },
    },
  });

  if (!response.text) throw new Error("No response from AI");
  return safeParseJSON(response.text) as { title: string; subtitle: string; design: CoverDesign };
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
    const outlinePrompt = `Create a 11-chapter manual outline for: ${description}`;
    const outlineResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [...imageParts, { text: outlinePrompt }] },
      config: { responseMimeType: "application/json" }
    }));
    const outlineData = safeParseJSON(outlineResponse.text);

    await sleep(2000);
    onProgress?.("Writing Part 1...");
    const part1Response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write Part 1 based on outline: ${JSON.stringify(outlineData)}`,
        config: { responseMimeType: "application/json" }
    }));
    const part1Data = safeParseJSON(part1Response.text);

    await sleep(2000);
    onProgress?.("Writing Part 2...");
    const part2Response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write Part 2 based on outline: ${JSON.stringify(outlineData)}`,
        config: { responseMimeType: "application/json" }
    }));
    const part2Data = safeParseJSON(part2Response.text);

    await sleep(2000);
    onProgress?.("Writing Part 3...");
    const part3Response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write Part 3 based on outline: ${JSON.stringify(outlineData)}`,
        config: { responseMimeType: "application/json" }
    }));
    const part3Data = safeParseJSON(part3Response.text);

    return { metadata: outlineData.metadata, pages: [...part1Data.pages, ...part2Data.pages, ...part3Data.pages] };
  } catch (error) {
    console.error("Error generating manual:", error);
    throw error;
  }
};
