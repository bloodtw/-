import { GoogleGenAI, Type } from "@google/genai";
import { CleaningScheduleData } from "../types";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  // In a real app, you might want to show an error to the user.
  // For this context, we assume the key is always present.
  console.error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    "area": { "type": Type.STRING, "description": "The administrative district, e.g., 中山區. Extract only the first word." },
    "name": { "type": Type.STRING, "description": "The customer's full name." },
    "phone": { "type": Type.STRING, "description": "The customer's phone number, keeping the original format." },
    "date": { "type": Type.STRING, "description": "The cleaning date, formatted as YYYY-MM-DD." },
    "startTime": { "type": Type.STRING, "description": "The cleaning start time, formatted as HH:MM (24-hour)." },
    "endTime": { "type": Type.STRING, "description": "The cleaning end time, formatted as HH:MM (24-hour)." },
    "address": { "type": Type.STRING, "description": "The complete cleaning address." },
    "notes": { "type": Type.STRING, "description": "Extract ALL special requests and notes from the customer, especially any text explicitly labeled or intended as '給管家的備註' (notes for the housekeeper). It is CRITICAL to extract the complete, verbatim text without any summarization or omission." }
  },
};

export const extractScheduleFromImages = async (imageParts: { inlineData: { data: string; mimeType: string; } }[]): Promise<CleaningScheduleData> => {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const systemPrompt = "You are an assistant specialized in extracting customer cleaning appointment information from images. Your task is to consolidate information from all provided images to extract 'area', 'customer name', 'customer phone', 'cleaning date', 'start time', 'end time', 'cleaning address', and 'customer notes/requests', and output it in the specified JSON format. For the 'notes' field, pay special attention to extracting ALL text specifically designated as '給管家的備註' (notes for the housekeeper). It is crucial to capture the full, complete, and verbatim text of these notes without any summarization or omission. The cleaning date must be converted to YYYY-MM-DD format, and times to HH:MM (24-hour) format. If any piece of information cannot be found, use an empty string for its value.";
  const userQuery = "Please consolidate and extract all customer cleaning appointment information from these images.";

  const parts = [
    { text: userQuery },
    ...imageParts
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: parts },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("AI did not return any content.");
    }
    
    const parsedData = JSON.parse(jsonText);
    return parsedData as CleaningScheduleData;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes("API key not valid")) {
        throw new Error("The provided Gemini API key is not valid. Please check your configuration.");
    }
    throw new Error("Failed to process images with AI. The AI may be temporarily unavailable or the request was blocked.");
  }
};