export interface AIResponse {
  guidance: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  threatDetected: boolean;
  recommendedAction: 'sos' | 'contacts' | 'navigate_safe' | 'none';
  isLocal: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const LOCAL_RULES: { keywords: string[]; response: Omit<AIResponse, 'isLocal'> }[] = [
  {
    keywords: ['follow', 'following', 'behind me', 'chasing', 'stalker', 'stalking'],
    response: {
      guidance: "Increased risk detected. Immediately head towards a busy public area, keep your phone in your hand, and prepare to activate SOS if the person approaches any closer.",
      riskLevel: 'high',
      riskScore: 85,
      threatDetected: true,
      recommendedAction: 'sos',
    }
  },
  {
    keywords: ['threat', 'threatened', 'weapon', 'gun', 'knife', 'kill', 'hurt', 'attack'],
    response: {
      guidance: "Immediate threat detected. Seek shelter in a safe building, prepare your Emergency SOS, and call emergency services (112) or your trusted contacts immediately.",
      riskLevel: 'high',
      riskScore: 95,
      threatDetected: true,
      recommendedAction: 'sos',
    }
  },
  {
    keywords: ['isolated', 'dark', 'alone', 'empty street', 'lost', 'no lights'],
    response: {
      guidance: "You are in an isolated area. Keep walking towards main roads, keep your live location shared, and monitor your surroundings carefully.",
      riskLevel: 'medium',
      riskScore: 65,
      threatDetected: false,
      recommendedAction: 'navigate_safe',
    }
  },
  {
    keywords: ['unsafe', 'scared', 'uncomfortable', 'suspicious', 'creepy'],
    response: {
      guidance: "Trust your instincts. If someone nearby behaves suspiciously, keep a safe distance, stay in well-lit areas, and call a friend or emergency contact to stay on the line.",
      riskLevel: 'medium',
      riskScore: 60,
      threatDetected: false,
      recommendedAction: 'contacts',
    }
  }
];

const DEFAULT_LOCAL_RESPONSE: Omit<AIResponse, 'isLocal'> = {
  guidance: "SafeHer AI is active. Please stay alert to your surroundings. Let me know if you are in immediate danger or need to find safe places nearby.",
  riskLevel: 'low',
  riskScore: 20,
  threatDetected: false,
  recommendedAction: 'none',
};

export async function getAIResponse(
  userInput: string,
  chatHistory: ChatMessage[],
  locationContext?: { latitude: number; longitude: number }
): Promise<AIResponse> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    // Local Fallback Processing (Clearly labeled as local)
    const lowerInput = userInput.toLowerCase();
    for (const rule of LOCAL_RULES) {
      if (rule.keywords.some(keyword => lowerInput.includes(keyword))) {
        return {
          ...rule.response,
          isLocal: true,
        };
      }
    }
    return {
      ...DEFAULT_LOCAL_RESPONSE,
      isLocal: true,
    };
  }

  // Real Gemini API Integration
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Format chat history for Gemini API
    const contents = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Add current user turn
    contents.push({
      role: 'user',
      parts: [{ text: userInput }]
    });

    const locationText = locationContext 
      ? `User's current coordinates: Latitude ${locationContext.latitude}, Longitude ${locationContext.longitude}.`
      : "User's current coordinates are not available.";

    const systemInstruction = {
      role: 'system',
      parts: [{
        text: `You are SafeHer AI, an emergency response safety companion. Your goal is to keep the user safe.
Analyze the user's safety situation. Return safety guidance, evaluate threat presence, and estimate risk.
${locationText}

CRITICAL: You MUST respond ONLY with a valid raw JSON object matching the following schema. No markdown wrapping, no code block backticks (like \`\`\`json). Just the raw JSON string.

Schema:
{
  "guidance": "Safety advice text here (1-3 sentences, direct and reassuring)",
  "riskLevel": "low" | "medium" | "high",
  "riskScore": 0-100,
  "threatDetected": boolean,
  "recommendedAction": "sos" | "contacts" | "navigate_safe" | "none"
}`
      }]
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: systemInstruction.parts
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed: Omit<AIResponse, 'isLocal'> = JSON.parse(text.trim());
    return {
      ...parsed,
      isLocal: false,
    };
  } catch (error) {
    console.error('Error fetching from Gemini API:', error);
    
    // Attempt local fallback if API fails
    const lowerInput = userInput.toLowerCase();
    for (const rule of LOCAL_RULES) {
      if (rule.keywords.some(keyword => lowerInput.includes(keyword))) {
        return {
          ...rule.response,
          isLocal: true,
        };
      }
    }
    return {
      ...DEFAULT_LOCAL_RESPONSE,
      isLocal: true,
      guidance: "I'm having trouble connecting to my cloud neural brain. (Local Offline Mode): " + DEFAULT_LOCAL_RESPONSE.guidance
    };
  }
}
