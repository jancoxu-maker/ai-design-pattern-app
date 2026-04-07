import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, ManualStep, CoverDesign, ManualMetadata, ProductInfo } from "../types";

const createClient = () => {
  const apiKey = "AIzaSyBbPFsratJL2J5cd-jbbLgkGGCPYZHtSIw";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Helper to convert File to Base64
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

  // Prepare images (limit to first 3 to save tokens/bandwidth if necessary)
  const imageParts = await Promise.all(files.slice(0, 3).map(f => fileToPart(f)));

  const prompt = `
    Analyze these images which illustrate a step in a user manual. 
    Write a clear, concise, and instructional description of what is happening or what action the user needs to take.
    Directly describe the action. Do not say "The image shows...".
    
    IMPORTANT: The output must be in English only. Do not use any Chinese characters.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [...imageParts, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
          },
          required: ["description"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as { description: string };
    return data.description;
  } catch (error) {
    console.error("Error analyzing images:", error);
    throw error;
  }
};

export const refineStepText = async (
  currentTitle: string,
  currentDescription: string
): Promise<AIResponse> => {
  const ai = createClient();
  
  const prompt = `
    You are an expert technical writer and editor. 
    Your task is to refine the following user manual step to be clear, concise, professional, and easy to understand.
    
    Current Title: "${currentTitle}"
    Current Description: "${currentDescription}"

    IMPORTANT: The output must be in English only. Do not use any Chinese characters.
    Return the refined title and description in valid JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedTitle: { type: Type.STRING },
            refinedDescription: { type: Type.STRING },
          },
          required: ["refinedTitle", "refinedDescription"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as AIResponse;
    return data;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

export const generateStepTitle = async (description: string): Promise<string> => {
  const ai = createClient();
  
  const prompt = `
    Based on the following step description, generate a short, action-oriented title (max 5 words).
    
    Description: "${description}"
    
    IMPORTANT: The output must be in English only. Do not use any Chinese characters.
    Return just the title string in JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
          },
          required: ["title"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as { title: string };
    return data.title;
  } catch (error) {
    console.error("Error generating title:", error);
    throw error;
  }
};

export const generatePageTitle = async (steps: ManualStep[]): Promise<string> => {
  const ai = createClient();

  const stepsContent = steps.map((s, i) => `Step ${i+1}: ${s.title} - ${s.description}`).join('\n');

  const prompt = `
    You are organizing a user manual. Based on the following list of steps found on a single page, generate a short, professional Section Title for this page (e.g., "Installation", "Safety Warnings", "Troubleshooting", "Unboxing").
    
    Keep it under 5 words. Do not use quotation marks.

    IMPORTANT: The output must be in English only. Do not use any Chinese characters.

    Steps content:
    ${stepsContent}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pageTitle: { type: Type.STRING },
          },
          required: ["pageTitle"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as { pageTitle: string };
    return data.pageTitle;
  } catch (error) {
    console.error("Error generating page title:", error);
    return "New Section"; // Fallback
  }
};

export const generateCoverDesign = async (context: string): Promise<{ title: string; subtitle: string; design: CoverDesign }> => {
  const ai = createClient();

  const prompt = `
    You are a professional graphic designer for product manuals. 
    Based on the content of the manual provided below, suggest a catchy, professional Title and Subtitle.
    Also suggest a visual design style for the cover page including colors and layout.
    
    Manual Content Summary:
    ${context.slice(0, 2000)}

    IMPORTANT: The output must be in English only. Do not use any Chinese characters.
    Return JSON with 'title', 'subtitle', and a 'design' object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            design: {
              type: Type.OBJECT,
              properties: {
                primaryColor: { type: Type.STRING, description: "Hex color" },
                secondaryColor: { type: Type.STRING, description: "Hex color" },
                textColor: { type: Type.STRING, description: "Hex color" },
                layoutMode: { type: Type.STRING, enum: ["centered", "split", "overlay", "card", "minimal"] },
                fontStyle: { type: Type.STRING, enum: ["serif", "sans", "mono"] },
                overlayOpacity: { type: Type.NUMBER },
              },
              required: ["primaryColor", "secondaryColor", "textColor", "layoutMode", "fontStyle"],
            },
          },
          required: ["title", "subtitle", "design"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as { title: string; subtitle: string; design: CoverDesign };
  } catch (error) {
    console.error("Error generating cover design:", error);
    throw error;
  }
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
    // 1. Generate Outline based on Specifications
    onProgress?.("Step 1: Analyzing specifications and generating outline...");
    const outlinePrompt = `
      You are a senior technical writer. Based on the following product description, product info, and images, create a detailed 11-chapter outline following the "Standard Manual Outline" specification:
      1. Cover, 2. Preface, 3. Specifications, 4. Safety Warnings, 5. Product Parameters, 6. Package List, 7. Parts Diagram, 8. Installation/Operation, 9. Maintenance, 10. Troubleshooting, 11. Compliance & Contact.
      
      Product: ${description}
      Product Info: ${JSON.stringify(productInfo)}
      Market: ${market}
      
      IMPORTANT: The output must be in English only. Do not use any Chinese characters.
      Return the outline as a JSON object with 'metadata' (title, subtitle) and 'chapters' (array of {id, title, description}).
    `;

    const outlineResponse = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [...imageParts, { text: outlinePrompt }] },
      config: { responseMimeType: "application/json" }
    }));
    const outlineData = JSON.parse(outlineResponse.text);

    await sleep(2000); // Increased delay between calls

    // 2. Generate Part 1: Cover to Parts Diagram (Chapters 1-7)
    onProgress?.("Step 2: Writing Part 1 (Cover, Safety, Specs, Diagram)...");
    const part1Prompt = `
      Write the first part of the manual (corresponding to Chapters 1-7) based on this outline: ${JSON.stringify(outlineData)}.
      Use this Product Info: ${JSON.stringify(productInfo)}
      STRICT RULES:
      - DO NOT use the word "Chapter" or any numbering like "Chapter 1" in titles or content.
      - Preface: Must include "Legal Storage Requirement": Keep manual until product disposal; if sold, manual must accompany it.
      - Safety: Use DANGER (Red), WARNING (Yellow), CAUTION (Blue) levels. Include Child Safety (Choking hazard) and Electrical Safety.
      - Parameters: US market uses inch/lb/°F; EU uses cm/kg/°C.
      - Diagram: Define official names for parts.
      - Detail Level: Provide extensive, detailed, and comprehensive instructions. Do not be brief.
      
      IMPORTANT: The output must be in English only. Do not use any Chinese characters.
      Return as JSON: { pages: Array<{type, title, steps: Array<{title, description, layout}>}> }
    `;
    const part1Response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: part1Prompt,
      config: { responseMimeType: "application/json" }
    }));
    const part1Data = JSON.parse(part1Response.text);

    await sleep(2000); // Increased delay between calls

    // 3. Generate Part 2: Operation & Maintenance (Chapters 8-9)
    onProgress?.("Step 3: Writing Part 2 (Installation, Operation, Maintenance)...");
    const part2Prompt = `
      Write the second part of the manual (corresponding to Chapters 8-9) based on this outline: ${JSON.stringify(outlineData)}.
      Use this Product Info: ${JSON.stringify(productInfo)}
      STRICT RULES:
      - DO NOT use the word "Chapter" or any numbering like "Chapter 1" in titles or content.
      - Operation: Include "First Use Preparation" and "Tool Confirmation". Use Step 1, Step 2 logic. 
      - Maintenance: Include "Cleaning Taboos" (No high-pressure water, no chemicals) and "Seasonal Maintenance".
      - Detail Level: Provide extensive, detailed, and comprehensive instructions. Do not be brief.
      
      IMPORTANT: The output must be in English only. Do not use any Chinese characters.
      Return as JSON: { pages: Array<{type, title, steps: Array<{title, description, layout}>}> }
    `;
    const part2Response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: part2Prompt,
      config: { responseMimeType: "application/json" }
    }));
    const part2Data = JSON.parse(part2Response.text);

    await sleep(2000); // Increased delay between calls

    // 4. Generate Part 3: Troubleshooting & Compliance (Chapters 10-11)
    onProgress?.("Step 4: Writing Part 3 (Troubleshooting, Compliance, Contact)...");
    const part3Prompt = `
      Write the third part of the manual (corresponding to Chapters 10-11) based on this outline: ${JSON.stringify(outlineData)}.
      Use this Product Info: ${JSON.stringify(productInfo)}
      STRICT RULES:
      - DO NOT use the word "Chapter" or any numbering like "Chapter 1" in titles or content.
      - Troubleshooting: MUST use a Markdown table format with columns: | Problem | Possible Cause | Solution |. Use this format strictly.
      - Compliance: Include placeholders for CE, FCC, RoHS, WEEE. Include Manufacturer and Rep info.
      - Detail Level: Provide extensive, detailed, and comprehensive instructions. Do not be brief.
      
      IMPORTANT: The output must be in English only. Do not use any Chinese characters.
      Return as JSON: { pages: Array<{type, title, steps: Array<{title, description, layout}>}> }
    `;
    const part3Response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: part3Prompt,
      config: { responseMimeType: "application/json" }
    }));
    const part3Data = JSON.parse(part3Response.text);

    const allPages = [...part1Data.pages, ...part2Data.pages, ...part3Data.pages];

    return {
      metadata: outlineData.metadata,
      pages: allPages
    };
  } catch (error) {
    console.error("Error generating professional manual:", error);
    throw error;
  }
};
