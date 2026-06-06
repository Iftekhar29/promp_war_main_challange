/**
 * Get active API Key (stored in localStorage or from config.js)
 */
function getApiKey() {
  return localStorage.getItem('MINDMATE_GEMINI_KEY') || window.CONFIG.GEMINI_API_KEY;
}

/**
 * Check if API key is configured
 */
function hasApiKey() {
  const key = getApiKey();
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Save API key to LocalStorage for persistence across reloads
 */
function saveApiKey(key) {
  if (typeof key === 'string') {
    localStorage.setItem('MINDMATE_GEMINI_KEY', key.trim());
  }
}

/**
 * Remove API key from LocalStorage
 */
function clearApiKey() {
  localStorage.removeItem('MINDMATE_GEMINI_KEY');
}

/**
 * Sanitize user inputs to prevent injection and malicious scripting.
 * Limits character count, strips tags, and removes override keywords.
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  // Replace HTML brackets to prevent XSS, and remove <script> tags
  let cleaned = str.replace(/<script[^>]*>/gi, '');
  cleaned = cleaned.replace(/[<>]/g, '');
  // Remove common prompt injection phrases and override directives
  cleaned = cleaned.replace(/(system prompt|ignore previous|instead of|you must now|change instructions|system instruction|override)/gi, '');
  // Limit input length to prevent payload bloat or DOS
  return cleaned.trim().substring(0, 600);
}

/**
 * Call the Gemini API to get personalized wellness coaching.
 * @param {Object} data - Student check-in/reflection data.
 */
async function getWellnessCoaching(data) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please add your Gemini API key in the settings panel.');
  }

  // Sanitize all inputs
  const examType = sanitizeInput(data.examType || 'General Exams');
  const mood = sanitizeInput(data.mood || 'Neutral');
  const energy = sanitizeInput(data.energy || 'Medium');
  const confidence = sanitizeInput(data.confidence || 'Medium');
  const studyHours = Number(data.studyHours) || 0;
  const sleepHours = Number(data.sleepHours) || 0;
  const waterIntake = Number(data.waterIntake) || 0;

  const triggers = Array.isArray(data.triggers)
    ? data.triggers.map(t => sanitizeInput(t)).filter(Boolean)
    : [];

  const wentWell = sanitizeInput(data.journal?.wentWell || 'Not recorded');
  const challenges = sanitizeInput(data.journal?.challenges || 'Not recorded');
  const proudOf = sanitizeInput(data.journal?.proudOf || 'Not recorded');
  const improveTomorrow = sanitizeInput(data.journal?.improveTomorrow || 'Not recorded');

  // Set up the structured system prompt instructions.
  const systemInstruction = `You are "MindMate AI", an empathetic mental wellness coach specialized in supporting students preparing for highly stressful competitive exams like NEET, JEE, CUET, CAT, GATE, UPSC, and Board Exams.
You provide encouraging feedback, stress management techniques, and healthy study habits.
IMPORTANT: You are NOT a medical doctor, psychiatrist, or clinical counselor. You must NEVER provide medical diagnostics, prescribe medications, or offer clinical treatment plans. Keep all advice non-medical, positive, supportive, and action-oriented.
Show extreme sensitivity to signs of burnout or high pressure.
Your response MUST be valid JSON conforming exactly to the requested schema.`;

  // Build the user context prompt
  const userPrompt = `Here is the student's wellness check-in details:
- Preparing for Exam: ${examType}
- Current Mood: ${mood}
- Energy Level: ${energy}
- Confidence Level: ${confidence}
- Study Hours: ${studyHours} hours
- Sleep Hours: ${sleepHours} hours
- Water Intake: ${waterIntake} cups
- Reported Stress Triggers: ${triggers.join(', ') || 'None'}
- Reflection Journal:
  * What went well: ${wentWell}
  * What challenged them: ${challenges}
  * What they are proud of: ${proudOf}
  * What they will improve: ${improveTomorrow}

Generate a comprehensive review. You must return a single JSON object matching this schema:
{
  "wellnessScore": number (an integer from 0 to 100 assessing their current wellness balance),
  "encouragement": "string (a caring, supportive, and understanding paragraph of 2-3 sentences)",
  "stressManagementTips": ["string (an actionable, practical, exam-specific stress relief tip 1)", "string (tip 2)"],
  "studyRecommendations": ["string (practical study habit / time management advice matching their study hours and sleep 1)", "string (recommendation 2)"],
  "motivationMessage": "string (a powerful, inspiring exam-specific motivational quote or message tailored to ${examType})",
  "riskLevel": "string (must be either 'Healthy', 'Moderate Risk', or 'Burnout Risk' based on their data)"
}`;

  const url = `${window.CONFIG.GEMINI_API_URL}/${window.CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemInstruction}\n\n${userPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1200,
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini API Error: ${message}`);
    }

    const result = await response.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No suggestions generated. Please check your inputs and try again.');
    }

    // Try parsing the response as JSON with a robust regex salvage fallback
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('JSON parse failed in gemini.js. Attempting robust regex salvage...', parseError);
      parsedData = attemptToSalvageJSON(responseText, mood, triggers);
    }

    // Return sanitized and validated response structure
    return validateAndCleanResponse(parsedData, mood, triggers);
  } catch (error) {
    console.error('Error fetching Gemini wellness coaching:', error);
    throw error;
  }
}

/**
 * Robust regex salvage for malformed, cut-off, or unescaped JSON text
 */
function attemptToSalvageJSON(text, mood, triggers) {
  const cleanText = text.trim();

  let wellnessScore = null;
  const scoreMatch = cleanText.match(/"wellnessScore"\s*:\s*(\d+)/);
  if (scoreMatch) {
    wellnessScore = Math.max(0, Math.min(100, Number(scoreMatch[1])));
  } else {
    wellnessScore = calculateFallbackScore(mood, triggers);
  }

  let encouragement = '';
  const encouragementMatch = cleanText.match(/"encouragement"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
  if (encouragementMatch) {
    encouragement = sanitizeInput(encouragementMatch[1]);
  } else {
    const broadMatch = cleanText.match(/"encouragement"\s*:\s*"([\s\S]*?)"/);
    encouragement = broadMatch ? sanitizeInput(broadMatch[1]) : 'Keep pushing forward. Self-care is a vital part of exam preparation success.';
  }

  let motivationMessage = '';
  const motivationMatch = cleanText.match(/"motivationMessage"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/);
  if (motivationMatch) {
    motivationMessage = sanitizeInput(motivationMatch[1]);
  } else {
    const broadMatch = cleanText.match(/"motivationMessage"\s*:\s*"([\s\S]*?)"/);
    motivationMessage = broadMatch ? sanitizeInput(broadMatch[1]) : 'Your effort is paving the way to your dreams. Take it one step at a time.';
  }

  let riskLevel = '';
  const riskMatch = cleanText.match(/"riskLevel"\s*:\s*"([^"]+)"/);
  if (riskMatch) {
    riskLevel = riskMatch[1].trim();
  }
  const validRiskLevels = ['Healthy', 'Moderate Risk', 'Burnout Risk'];
  if (!validRiskLevels.includes(riskLevel)) {
    if (wellnessScore >= 70) riskLevel = 'Healthy';
    else if (wellnessScore >= 40) riskLevel = 'Moderate Risk';
    else riskLevel = 'Burnout Risk';
  }

  // Extract arrays
  let stressManagementTips = [];
  const tipsBlock = cleanText.match(/"stressManagementTips"\s*:\s*\[([\s\S]*?)\]/);
  if (tipsBlock) {
    const matches = tipsBlock[1].match(/"([^"]+)"/g);
    if (matches) {
      stressManagementTips = matches.map(m => sanitizeInput(m.slice(1, -1)));
    }
  }
  if (stressManagementTips.length === 0) {
    stressManagementTips = [
      'Take deep breaths when feeling tense.',
      'Set clear bounds between study and relaxation.'
    ];
  }

  let studyRecommendations = [];
  const recsBlock = cleanText.match(/"studyRecommendations"\s*:\s*\[([\s\S]*?)\]/);
  if (recsBlock) {
    const matches = recsBlock[1].match(/"([^"]+)"/g);
    if (matches) {
      studyRecommendations = matches.map(m => sanitizeInput(m.slice(1, -1)));
    }
  }
  if (studyRecommendations.length === 0) {
    studyRecommendations = [
      'Prioritize active recall over passive reading.',
      'Avoid late night cramming; protect your sleep.'
    ];
  }

  return {
    wellnessScore,
    encouragement,
    stressManagementTips,
    studyRecommendations,
    motivationMessage,
    riskLevel
  };
}

/**
 * Validate and sanitize the object returned by the Gemini API
 */
function validateAndCleanResponse(data, originalMood, originalTriggers) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid AI response: Expected a JSON object.');
  }

  // Validate wellness score
  let wellnessScore = Number(data.wellnessScore);
  if (isNaN(wellnessScore) || wellnessScore < 0 || wellnessScore > 100) {
    wellnessScore = calculateFallbackScore(originalMood, originalTriggers);
  } else {
    wellnessScore = Math.round(wellnessScore);
  }

  // Validate risk level
  const validRiskLevels = ['Healthy', 'Moderate Risk', 'Burnout Risk'];
  let riskLevel = data.riskLevel;
  if (!validRiskLevels.includes(riskLevel)) {
    if (wellnessScore >= 70) riskLevel = 'Healthy';
    else if (wellnessScore >= 40) riskLevel = 'Moderate Risk';
    else riskLevel = 'Burnout Risk';
  }

  // Sanitize textual responses
  const encouragement = data.encouragement && typeof data.encouragement === 'string'
    ? sanitizeInput(data.encouragement)
    : 'Keep pushing forward. Self-care is a vital part of exam preparation success.';

  const motivationMessage = data.motivationMessage && typeof data.motivationMessage === 'string'
    ? sanitizeInput(data.motivationMessage)
    : 'Your effort is paving the way to your dreams. Take it one step at a time.';

  // Sanitize array responses
  const stressManagementTips = Array.isArray(data.stressManagementTips)
    ? data.stressManagementTips.map(tip => sanitizeInput(String(tip))).filter(Boolean).slice(0, 4)
    : ['Take deep breaths when feeling tense.', 'Set clear bounds between study and relaxation.'];

  const studyRecommendations = Array.isArray(data.studyRecommendations)
    ? data.studyRecommendations.map(rec => sanitizeInput(String(rec))).filter(Boolean).slice(0, 4)
    : ['Prioritize active recall over passive reading.', 'Avoid late night cramming; protect your sleep.'];

  return {
    wellnessScore,
    encouragement,
    stressManagementTips,
    studyRecommendations,
    motivationMessage,
    riskLevel
  };
}

/**
 * Helper to compute a fallback wellness score based on mood and triggers
 */
function calculateFallbackScore(mood, triggers = []) {
  let score = 75; // Neutral start
  if (mood === 'Excellent') score = 95;
  else if (mood === 'Good') score = 85;
  else if (mood === 'Neutral') score = 65;
  else if (mood === 'Stressed') score = 40;
  else if (mood === 'Overwhelmed') score = 15;

  // Reduce score based on trigger count
  const deduction = triggers.length * 8;
  score = Math.max(10, score - deduction);
  return score;
}

// Bind methods globally
window.MindMateGemini = {
  getApiKey,
  hasApiKey,
  saveApiKey,
  clearApiKey,
  sanitizeInput,
  getWellnessCoaching
};
