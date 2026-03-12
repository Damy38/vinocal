import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  items: {
    name: string;
    calories: number;
    protein: number;
    portion: string;
  }[];
  totalCalories: number;
  totalProtein: number;
  beveragePairing: {
    recommendation: string;
    reason: string;
    alternatives: string[];
  };
  healthyAlternative: {
    suggestion: string;
    benefits: string;
    shoppingList: string[];
  };
}

export async function analyzePlate(base64Image: string): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
          {
            text: "Analyse cette assiette. Estime les calories et les protéines (en grammes) pour chaque élément et le total. Propose également un accord boisson idéal (vin, café, thé, jus, cocktail, etc.) selon le type de repas. Enfin, suggère une version plus 'Healthy' et équilibrée de ce même repas avec une liste de courses pour la réaliser. Réponds en français.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nom de l'aliment" },
                calories: { type: Type.NUMBER, description: "Estimation des calories" },
                protein: { type: Type.NUMBER, description: "Grammes de protéines" },
                portion: { type: Type.STRING, description: "Portion estimée" },
              },
              required: ["name", "calories", "protein", "portion"],
            },
          },
          totalCalories: { type: Type.NUMBER, description: "Total des calories estimées" },
          totalProtein: { type: Type.NUMBER, description: "Total des protéines estimées en grammes" },
          beveragePairing: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING, description: "Boisson recommandée (vin, café, thé, etc.)" },
              reason: { type: Type.STRING, description: "Pourquoi cette boisson ?" },
              alternatives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Autres options de boissons",
              },
            },
            required: ["recommendation", "reason", "alternatives"],
          },
          healthyAlternative: {
            type: Type.OBJECT,
            properties: {
              suggestion: { type: Type.STRING, description: "Description de la version plus saine" },
              benefits: { type: Type.STRING, description: "Avantages nutritionnels de cette version" },
              shoppingList: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Liste de courses pour la version saine",
              },
            },
            required: ["suggestion", "benefits", "shoppingList"],
          },
        },
        required: ["items", "totalCalories", "totalProtein", "beveragePairing", "healthyAlternative"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text) as AnalysisResult;
}

export async function analyzeTextDescription(description: string): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyse ce repas décrit textuellement : "${description}". Estime les calories et les protéines (en grammes) pour chaque élément et le total. Propose également un accord boisson idéal (vin, café, thé, jus, cocktail, etc.) selon le type de repas. Enfin, suggère une version plus 'Healthy' et équilibrée de ce même repas avec une liste de courses pour la réaliser. Réponds en français.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nom de l'aliment" },
                calories: { type: Type.NUMBER, description: "Estimation des calories" },
                protein: { type: Type.NUMBER, description: "Grammes de protéines" },
                portion: { type: Type.STRING, description: "Portion estimée" },
              },
              required: ["name", "calories", "protein", "portion"],
            },
          },
          totalCalories: { type: Type.NUMBER, description: "Total des calories estimées" },
          totalProtein: { type: Type.NUMBER, description: "Total des protéines estimées en grammes" },
          beveragePairing: {
            type: Type.OBJECT,
            properties: {
              recommendation: { type: Type.STRING, description: "Boisson recommandée (vin, café, thé, etc.)" },
              reason: { type: Type.STRING, description: "Pourquoi cette boisson ?" },
              alternatives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Autres options de boissons",
              },
            },
            required: ["recommendation", "reason", "alternatives"],
          },
          healthyAlternative: {
            type: Type.OBJECT,
            properties: {
              suggestion: { type: Type.STRING, description: "Description de la version plus saine" },
              benefits: { type: Type.STRING, description: "Avantages nutritionnels de cette version" },
              shoppingList: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Liste de courses pour la version saine",
              },
            },
            required: ["suggestion", "benefits", "shoppingList"],
          },
        },
        required: ["items", "totalCalories", "totalProtein", "beveragePairing", "healthyAlternative"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text) as AnalysisResult;
}
