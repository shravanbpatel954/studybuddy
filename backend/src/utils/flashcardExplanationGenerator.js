const { generateText } = require('./githubModelsClient');

/**
 * Generate a rich, structured flashcard explanation for a given MCQ.
 * Uses AI orchestrator (GitHub Models + Gemini) with fallback.
 */
async function generateFlashcardExplanation({
  question,
  options = [],
  correctAnswer,
  selectedAnswer,
  originalExplanation = '',
  topic = '',
  moduleContext = '',
  difficulty = 'intermediate',
  userId = null,
  subsectionId = null,
}) {
  const safeQuestion = question || topic || 'Unknown question';
  const optsText = (options || [])
    .map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`)
    .join('\n');

  const prompt = `You are an expert CS / Analytics / Reasoning tutor.
Given a multiple-choice question and its answer, write a high-quality flashcard-style explanation.

QUESTION:
${safeQuestion}

OPTIONS:
${optsText || '(options not provided)'}

CORRECT ANSWER: ${correctAnswer || 'Not provided'}
LEARNER'S ANSWER: ${selectedAnswer || 'Not provided'}

ORIGINAL SHORT EXPLANATION (may be brief, low-quality, or missing):
${originalExplanation || '(none)'}

ADDITIONAL CONTEXT FROM COURSE NOTES (optional, may be empty):
${moduleContext || '(none)'}

Return ONLY valid JSON in this exact shape (no markdown, no prose outside JSON):
{
  "answer": "Short direct answer in 1 concise line (what is the correct idea in exam language)",
  "explanation": "3-6 short sentences (~80-150 words) giving a deep, student-friendly explanation. Start with a one-line core idea, then walk through the reasoning or steps, and briefly contrast with 1-2 wrong options. Use simple language like a tutor.",
  "insight": "1 short line with key insight, use case, or 'how to remember' hook.",
  "resources": {
    "articles": ["Optional related reading titles or simple URLs (max 3)", "..."],
    "additionalTopics": ["2-4 related subtopics to revise next"]
  }
}

Rules:
- Focus on conceptual understanding, not just definition-memorization.
- Keep explanations exam-ready for CS / Analytics / Reasoning style questions.
- Make the explanation self-contained so it works as a standalone flashcard.
`;

  const raw = await generateText(
    prompt,
    {
      temperature: 0.35,
      max_tokens: 768,
    },
    null,
    subsectionId,
    difficulty,
    userId
  );

  const cleaned = (raw || '')
    .replace(/```json\s*|\s*```/gi, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw err;
    }
  }

  return {
    answer: parsed.answer || correctAnswer || '',
    explanation: parsed.explanation || originalExplanation || '',
    insight: parsed.insight || '',
    resources: parsed.resources || {},
  };
}

module.exports = { generateFlashcardExplanation };


