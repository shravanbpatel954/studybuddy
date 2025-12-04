// ✅ Import dependencies
const { generateText } = require('./geminiClient');
const Quiz = require('../models/Quiz.models');

// ✅ Main Quiz Generator class
class QuizGenerator {
    constructor() {
        this.quizCache = new Map();
    }

    // 🧠 Generate quiz questions
    async generateQuizFromContent(content, options = {}) {
        const { numQuestions = 1, difficulty = 'intermediate', types = ['mcq'] } = options;

        const difficultyGuide = {
            beginner:
                "Create basic comprehension questions. Focus on definitions, simple concepts, and direct facts from the content. Questions should be straightforward with clear, distinct options. Avoid complex terminology.",
            intermediate:
                "Mix comprehension with application questions. Include some analysis but keep it moderate. Can use terminology but explain it in the question. Options can be more nuanced.",
            advanced:
                "Focus on analysis, evaluation, and application. Include complex scenarios, comparisons, and deeper implications. Can use advanced terminology and concepts. Options can be sophisticated.",
            expert:
                "Create complex, challenging questions that require deep understanding. Focus on advanced concepts, edge cases, and interconnected knowledge. Include sophisticated analysis and real-world applications."
        };

                    const prompt = `Generate ${numQuestions} unique, diverse, and accurate quiz questions about the following content.
Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Explanation of why this is the correct answer"
    }
  ]
}

Difficulty Level: ${difficulty}
${difficultyGuide[difficulty]}

Requirements:
1. Questions MUST match the difficulty level guidelines above.
2. Each question should be of type ${types.join(' or ')}.
3. Each question must have exactly 4 options.
4. The correct answer must be one of the options.
5. Provide clear explanations.
6. Return ONLY valid JSON — no other text or markdown.
7. Questions must be unique and different from each other.
                    8. Avoid repeating similar questions or options.
                    9. Ensure questions are relevant and accurate to the content.
                    10. If content is insufficient, generate questions based on best educational practices for the topic.

Content:
"""
${content}
"""`;

        try {
            const response = await generateText(prompt);
            console.log('🧩 Raw quiz response preview:', response.substring(0, 200) + '...');

            const cleanedResponse = response
                .replace(/```json\s*|\s*```/g, '')
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2018\u2019]/g, "'")
                .trim();

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(cleanedResponse);
            } catch (parseError) {
                console.error('Failed to parse quiz response:', parseError);
                const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) parsedResponse = JSON.parse(jsonMatch[0]);
                else throw new Error('Invalid quiz response format');
            }

            if (!parsedResponse || !Array.isArray(parsedResponse.questions)) {
                console.error('Invalid quiz structure:', parsedResponse);
                throw new Error('Invalid quiz response structure');
            }

            const validatedQuestions = parsedResponse.questions.map(q => {
                if (!q.question || !Array.isArray(q.options) || !q.correctAnswer || !q.explanation) {
                    throw new Error('Invalid question format in response');
                }
                // Normalize and ensure options length
                const normalizedOptions = (q.options || []).slice(0, 4).map(o => (o || '').trim());
                // Fill missing options with placeholders (shouldn't happen if AI obeys prompt)
                while (normalizedOptions.length < 4) normalizedOptions.push('None of the above');

                return {
                    id: `q_${Math.random().toString(36).substr(2, 9)}`,
                    question: (q.question || '').trim(),
                    options: normalizedOptions,
                    correctAnswer: (q.correctAnswer || '').trim(),
                    explanation: (q.explanation || '').trim(),
                    difficulty,
                    type: types[0]
                };
            });

            // Deduplicate exact-question duplicates (case-insensitive, trimmed)
            const seen = new Set();
            const unique = [];
            for (const qq of validatedQuestions) {
                const key = qq.question.replace(/\s+/g, ' ').toLowerCase().trim();
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(qq);
                }
            }

            if (unique.length < numQuestions) {
                console.warn(`Only ${unique.length} unique questions generated (requested ${numQuestions}).`);
            }

            return unique;
        } catch (error) {
            console.error('Quiz generation error:', {
                message: error.message,
                stack: error.stack,
                content: content ? content.substring(0, 200) + '...' : null
            });
            throw new Error(error.message || 'Failed to generate quiz questions');
        }
    }

    // 🧾 Generate concept-based flashcards (NOT reusing MCQ explanations)
    async generateConceptFlashcard(content, conceptHint = '') {
        const prompt = `Generate a concept-based educational flashcard. DO NOT reuse MCQ explanation text.

Detect the underlying concept from the content (e.g., AIDA Model, SWOT Analysis, osmosis, DNA replication, etc.).

Return ONLY valid JSON in this exact format:
{
  "title": "Concept Name (e.g., AIDA Model)",
  "diagram": "ASCII or simple block illustration showing the concept structure",
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "realWorldExample": "A detailed real-world example of how this concept is applied",
  "summary": "A concise 2-3 sentence summary of the concept"
}

Requirements:
1. Title: Clear concept name
2. Diagram: Use ASCII art or simple text-based illustration (e.g., "A → Attention\nI → Interest\nD → Desire\nA → Action")
3. Key Points: 3-6 bullet points covering essential aspects
4. Real World Example: Specific, practical example (e.g., "Nike uses AIDA in new product launches by...")
5. Summary: Brief conceptual overview
6. DO NOT copy MCQ explanation text
7. Focus on the underlying concept, not just definitions
8. Make it educational and memorable

${conceptHint ? `Concept hint: ${conceptHint}\n` : ''}
Content:
"""
${content}
"""`;

        try {
            const response = await generateText(prompt);
            const cleanedResponse = response
                .replace(/```json\s*|\s*```/g, '')
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2018\u2019]/g, "'")
                .trim();

            const parsed = JSON.parse(cleanedResponse);
            
            return {
                id: `fc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: parsed.title || 'Concept',
                diagram: parsed.diagram || '',
                keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
                realWorldExample: parsed.realWorldExample || '',
                summary: parsed.summary || '',
                front: parsed.title || 'Concept',
                back: `${parsed.diagram ? `Diagram:\n${parsed.diagram}\n\n` : ''}Key Points:\n${(parsed.keyPoints || []).map(p => `• ${p}`).join('\n')}\n\nReal Example:\n${parsed.realWorldExample}\n\nSummary:\n${parsed.summary}`
            };
        } catch (error) {
            console.error('Error generating concept flashcard:', error);
            throw new Error('Failed to generate concept flashcard: ' + error.message);
        }
    }

    // 🧾 Generate flashcards (legacy - for backward compatibility)
    async generateFlashcards(content, numCards = 5) {
        const prompt = `Create ${numCards} proper flashcards with front (question/prompt) and back (answer/explanation) from this content.

Return ONLY valid JSON in this format:
{
  "flashcards": [
    {
      "front": "Question or prompt on the front of the card (e.g., 'What is the AIDA model?' or 'Define marketing mix')",
      "back": "Complete answer or explanation on the back (detailed explanation, definition, or concept)",
      "concept": "The main concept or topic",
      "keyPoints": ["Key point 1", "Key point 2"],
      "example": "Real-world example if applicable"
    }
  ]

Requirements:
1. Front should be a clear question or prompt, not just a title
2. Back should be a complete, detailed answer
3. Focus on concepts that benefit from spaced repetition
4. Make it suitable for active recall practice
5. Return ONLY valid JSON.

Content:
"""
${content}
"""`;

        try {
            const response = await generateText(prompt);
            const cleanedResponse = response
                .replace(/```json\s*|\s*```/g, '')
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2018\u2019]/g, "'")
                .trim();

            const parsed = JSON.parse(cleanedResponse);
            const flashcards = parsed.flashcards;

            if (!Array.isArray(flashcards)) throw new Error('Response does not contain an array of flashcards');

            return flashcards.map((card, index) => ({
                id: `flashcard_${Date.now()}_${index}`,
                front: card.front || 'Concept',
                back: card.back || '',
                concept: card.concept || '',
                keyPoints: card.keyPoints || [],
                example: card.example || '',
                title: card.concept || card.front || 'Concept' // For backward compatibility
            }));
        } catch (error) {
            console.error('Error generating flashcards:', error);
            throw new Error('Failed to generate flashcards: ' + error.message);
        }
    }

    // 🗂 Generate & store quiz (with duplicate prevention)
    async generateAndStoreQuiz(moduleId, sectionPath, content, options = {}) {
        const cacheKey = `${moduleId}-${sectionPath}`;

        if (this.quizCache.has(cacheKey)) {
            const cached = this.quizCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) return cached.quiz;
        }

        try {
            let quiz = await Quiz.findOne({ moduleId, sectionPath });
            if (!quiz) quiz = new Quiz({ moduleId, sectionPath });

            if (!quiz.needsNewQuestions(options.difficulty)) {
                this.quizCache.set(cacheKey, { quiz, timestamp: Date.now() });
                return quiz;
            }

            const questions = await this.generateQuizFromContent(content, options);
            
            // Get existing question texts to prevent duplicates
            const existingQuestionTexts = new Set(
                (quiz.questions || []).map(q => 
                    (q.question || '').toLowerCase().trim().replace(/\s+/g, ' ')
                )
            );

            // Filter out duplicates and add unique IDs
            const uniqueQuestions = [];
            const seenQuestions = new Set();
            
            for (const q of questions) {
                const normalizedText = (q.question || '').toLowerCase().trim().replace(/\s+/g, ' ');
                
                // Skip if already exists in DB or in current batch
                if (existingQuestionTexts.has(normalizedText) || seenQuestions.has(normalizedText)) {
                    continue;
                }
                
                seenQuestions.add(normalizedText);
                
                // Ensure unique ID
                if (!q.id) {
                    q.id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                
                uniqueQuestions.push(q);
            }

            // Append new unique questions to existing ones
            quiz.questions = [...(quiz.questions || []), ...uniqueQuestions];
            quiz.currentDifficulty = options.difficulty;
            quiz.lastGenerated = new Date();
            await quiz.save();

            this.quizCache.set(cacheKey, { quiz, timestamp: Date.now() });
            return quiz;
        } catch (error) {
            console.error('Failed to generate and store quiz:', error);
            throw error;
        }
    }

    // 🧮 Record quiz attempt
    async recordAttempt(quizId, userId, answers) {
        try {
            const quiz = await Quiz.findById(quizId);
            if (!quiz) throw new Error('Quiz not found');

            let correctCount = 0;
            answers.forEach(answer => {
                const question = quiz.questions.find(q => q.question === answer.question);
                if (question && question.correctAnswer === answer.selectedOption) correctCount++;
            });

            const attempt = {
                userId,
                score: (correctCount / answers.length) * 100,
                totalQuestions: answers.length,
                correctAnswers: correctCount,
                difficulty: quiz.currentDifficulty,
                completedAt: new Date()
            };

            quiz.attempts.push(attempt);
            quiz.updateDifficulty(attempt);
            await quiz.save();

            const cacheKey = `${quiz.moduleId}-${quiz.sectionPath}`;
            this.quizCache.set(cacheKey, { quiz, timestamp: Date.now() });

            return attempt;
        } catch (error) {
            console.error('Failed to record attempt:', error);
            throw error;
        }
    }

    // 📜 Get quiz history
    async getQuizHistory(userId, moduleId, sectionPath) {
        try {
            const quiz = await Quiz.findOne({ moduleId, sectionPath });
            if (!quiz) {
                return { attempts: [], currentDifficulty: 'beginner', progressStats: null };
            }

            const attempts = quiz.attempts
                .filter(a => a.userId.toString() === userId)
                .sort((a, b) => b.completedAt - a.completedAt);

            return {
                attempts,
                currentDifficulty: quiz.currentDifficulty,
                progressStats: this.calculateProgressStats(attempts)
            };
        } catch (error) {
            console.error('Failed to get quiz history:', error);
            throw error;
        }
    }

    // 📊 Calculate progress
    calculateProgressStats(attempts) {
        if (!attempts.length) return null;

        const recent = attempts.slice(0, 5);
        return {
            averageScore: recent.reduce((sum, att) => sum + att.score, 0) / recent.length,
            totalAttempts: attempts.length,
            recentTrend: this.calculateTrend(recent),
            difficultyProgression: attempts.map(a => ({
                date: a.completedAt,
                difficulty: a.difficulty,
                score: a.score
            }))
        };
    }

    calculateTrend(attempts) {
        if (attempts.length < 2) return 'not enough data';
        const recentScores = attempts.map(a => a.score);
        const trend = recentScores[0] - recentScores[recentScores.length - 1];
        if (trend > 5) return 'improving';
        if (trend < -5) return 'declining';
        return 'stable';
    }

    // ⚡ Generate a pair (MCQ + Flashcard) - OPTIMIZED for speed
    async generatePair(content, options = {}) {
        const difficulty = options.difficulty || 'intermediate';
        const timestamp = Date.now();
        const skipFlashcard = options.skipFlashcard || false; // Allow skipping flashcard for speed

        try {
            // Limit content length to speed up generation (first 2000 chars should be enough)
            const limitedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content;
            const augmentedContent = `${limitedContent}\n\nGenerate a unique question for timestamp: ${timestamp}`;
            
            // Improved MCQ prompt - shorter questions, clear options, exact answer matching
            const mcqPrompt = `Create ONE high-quality, exam-style multiple-choice question.
Keep question under 15 words. Make options short (under 8 words each).

CRITICAL: The correctAnswer MUST exactly match one of the options (case-sensitive, word-for-word match).

Return ONLY valid JSON in this format:
{
  "questions": [{
    "question": "Short question text?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctAnswer": "Option A text",
    "explanation": "Brief explanation (1-2 sentences)",
    "topic": "Topic name"
  }]
}

Requirements:
1. Question must be under 15 words
2. Each option must be under 8 words
3. correctAnswer MUST be an exact copy of one option (case-sensitive match)
4. Make options distinct and clearly different from each other
5. Difficulty: ${difficulty}
6. The question for this timestamp (${timestamp}) MUST be unique in wording and concept.
   Do NOT repeat any question or option pattern you might have generated earlier for this content.
7. Prefer conceptual or applied questions instead of only simple definitions.

Return ONLY valid JSON. No markdown.`;

            const response = await generateText(mcqPrompt + "\n\nContent:\n" + augmentedContent);
            const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const mcqQuestions = JSON.parse(cleanedResponse).questions;

            // Skip flashcard generation if requested (for streaming speed)
            let flashcard = null;
            if (!skipFlashcard) {
                try {
                    const flashcards = await this.generateFlashcards(augmentedContent, 1);
                    flashcard = flashcards[0] || null;
                } catch (flashcardError) {
                    console.warn('Flashcard generation skipped:', flashcardError.message);
                    // Continue without flashcard
                }
            }

            if (!mcqQuestions || !mcqQuestions[0]) throw new Error('Failed to generate MCQ question');

            const rawMcq = mcqQuestions[0];
            
            // Validate and fix correctAnswer to match one of the options exactly
            const options = rawMcq.options || [];
            let correctAnswer = rawMcq.correctAnswer || rawMcq.answer || '';
            
            // Normalize for comparison
            const normalize = (str) => String(str || '').trim().toLowerCase();
            const normalizedOptions = options.map(opt => normalize(opt));
            const normalizedCorrect = normalize(correctAnswer);
            
            // Find matching option (case-insensitive)
            let matchedOption = null;
            for (let i = 0; i < options.length; i++) {
                if (normalize(options[i]) === normalizedCorrect) {
                    matchedOption = options[i]; // Use original case
                    break;
                }
            }
            
            // If no match found, use first option as fallback
            if (!matchedOption && options.length > 0) {
                console.warn(`correctAnswer "${correctAnswer}" doesn't match any option. Using first option.`);
                matchedOption = options[0];
            }
            
            // Ensure we have exactly 4 options
            while (options.length < 4) {
                options.push(`Option ${String.fromCharCode(65 + options.length)}`);
            }
            const finalOptions = options.slice(0, 4);

            const mcq = {
                question: (rawMcq.question || '').trim(),
                options: finalOptions,
                correctAnswer: matchedOption || finalOptions[0], // Use exact option text
                explanation: (rawMcq.explanation || 'No explanation provided').trim(),
                topic: (rawMcq.topic || 'General').trim(),
                resources: rawMcq.resources || {},
                diagram: rawMcq.diagram || {},
                id: `mcq_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                generatedAt: timestamp,
                difficulty
            };

            return { mcq, flashcard };
        } catch (error) {
            console.error('Quiz generation failed:', error);
            throw error;
        }
    }
}

// ✅ Export instance
const generator = new QuizGenerator();
module.exports = generator;
