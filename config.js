/**
 * MindMate - Student Mental Wellness Tracker Configuration
 * Safe storage guidelines:
 * - LocalStorage is checked first to allow easy user configuration via UI.
 * - Do NOT commit actual API keys to version control systems.
 */

window.CONFIG = {
  // Default API Key. If empty, the application will prompt the user to input their key.
  GEMINI_API_KEY: '',

  // The recommended, fast, and cost-effective model for text tasks
  GEMINI_MODEL: 'gemini-2.5-flash',

  // Gemini Developer API endpoint base URL
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models'
};
