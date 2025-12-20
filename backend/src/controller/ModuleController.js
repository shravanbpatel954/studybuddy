const Module = require('../models/Module.models');
const fileProcessor = require('../utils/fileProcessor');
const quizGenerator = require('../utils/quizGenerator');
const { 
    generateStructuredContent, 
    generateStructuredContentStream, 
    generateText 
} = require('../utils/githubModelsClient');
const path = require('path');
const fs = require('fs').promises;
const mime = require('mime-types');
const UserQuiz = require('../models/UserQuiz.models');

// Simple in-memory quiz cache (24h TTL)
const quizCache = {};
const QUIZ_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 86400000

// Utility to shuffle options for MCQs so correct answer isn't always first
function shuffleOptions(options = []) {
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Batch MCQ generator using AI orchestrator (GitHub Models only)
async function generateBatchMCQ({ contentForQuiz, topic, difficulty = 'beginner', moduleId, subsectionId, userId }) {
    const prompt = `Generate 5 HIGH-QUALITY, UNIQUE multiple-choice questions for TOPIC: ${topic}.
Difficulty: ${difficulty} (CS / Data Analytics / Logical Reasoning context).

Return ONLY valid JSON (no markdown) in exactly this shape:
{
  "questions": [
    {
      "question": "Question text (concise, under 18 words)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "2-3 short sentences (max ~60 words) explaining why this option is correct and at least one other is not"
    }
  ]
}

CRITICAL UNIQUENESS REQUIREMENTS:
- Each question MUST test a COMPLETELY DIFFERENT concept, fact, or aspect of the topic.
- Each question MUST use DIFFERENT wording - do not repeat similar phrases or structures.
- Each question MUST have DIFFERENT options - do not reuse the same answer choices.
- Vary question types: mix definition questions, application questions, analysis questions, and comparison questions.
- Each question should focus on a different subtopic or aspect of "${topic}".

Strict rules:
- 5 questions ONLY, each testing a DIFFERENT concept, rule, or pattern from the topic.
- DO NOT repeat question stems, topics, or options; avoid near-duplicates.
- Options must be mutually distinct and plausible; exactly ONE is correct.
- "correctAnswer" MUST be an exact string match to one of the options.
- Explanations MUST be 2-3 short sentences (max ~60 words) in simple language, focusing on the concept and reasoning.
- Prefer applied/understanding questions over pure memorized definitions (e.g., trace a hashing step, choose the right metric, pick the valid inference).
- Base questions on the provided content when available; if thin, infer closely related, exam-relevant ideas.

Content to base questions on:
"""
${contentForQuiz || ''}
"""`;

    console.log('[AI API CALLED]', 'generateBatchMCQ', {
        timestamp: new Date().toISOString(),
        moduleId,
        subsectionId,
        difficulty
    });

    let response;
    try {
        response = await generateText(prompt, {
            temperature: 0.3,
            max_tokens: 1024
        }, moduleId, subsectionId, difficulty, userId);
    } catch (error) {
        // Handle quota errors gracefully
        if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            console.error('[generateBatchMCQ] API quota exceeded:', error.message);
            throw new Error('API quota exceeded. You have reached the free tier limit. Please try again in a few minutes.');
        }
        throw error;
    }

    const cleaned = (response || '').replace(/```json\s*|\s*```/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        // Attempt to salvage JSON
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            parsed = JSON.parse(match[0]);
        } else {
            throw err;
        }
    }

    if (!parsed || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid batch MCQ response');
    }

    const seenQuestions = new Set();
    const normalized = [];
    parsed.questions.slice(0, 5).forEach((q, idx) => {
        const question = (q.question || '').trim();
        if (!question) return;
        const qKey = question.toLowerCase().replace(/\s+/g, ' ');
        if (seenQuestions.has(qKey)) return;
        seenQuestions.add(qKey);

        // Ensure option uniqueness and length 4
        let options = Array.isArray(q.options) ? q.options.map(o => (o || '').trim()) : [];
        options = options.filter(Boolean);
        const optSet = new Set();
        options = options.filter(o => {
            const key = o.toLowerCase();
            if (optSet.has(key)) return false;
            optSet.add(key);
            return true;
        });
        while (options.length < 4) {
            const filler = `Option ${String.fromCharCode(65 + options.length)} (unique ${idx + 1}-${options.length + 1})`;
            options.push(filler);
        }
        options = options.slice(0, 4);

        let correctAnswer = (q.correctAnswer || '').trim();
        if (!options.some(o => o === correctAnswer)) {
            // fallback: pick first option to avoid mismatches
            correctAnswer = options[0];
        }

        normalized.push({
            id: `mcq_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
            question,
            options,
            correctAnswer,
            explanation: (q.explanation || '').trim(),
            difficulty,
            generatedAt: Date.now()
        });
    });

    if (normalized.length < 5) {
        console.warn(`[AI BATCH CALL] Only ${normalized.length} unique MCQs generated; requested 5.`);
    }

    console.log('[AI BATCH CALL] Generated 5 MCQs in one request');
    return normalized;
}

class ModuleController {
    // Share a module by generating/returning a shareCode
    async shareModule(req, res) {
        try {
            const moduleId = req.params.moduleId;
            const userId = req.user && (req.user._id || req.user.id);

            const module = await Module.findById(moduleId);
            if (!module) return res.status(404).json({ success: false, error: 'Module not found' });

            // Owner and admin can share
            const isOwner = module.owner.toString() === userId.toString();
            const requesterMember = module.members.find(m => m.user.toString() === userId.toString());
            const isAdmin = requesterMember && requesterMember.role === 'admin';

            if (!isOwner && !isAdmin) {
                return res.status(403).json({ success: false, error: 'Only the owner and admins can share this module' });
            }

            if (!module.shareCode) {
                const { generateShareCode } = require('../utils/shareCodeGenerator');
                module.shareCode = generateShareCode();
                module.isShared = true;
                await module.save();
            }

            return res.json({ success: true, shareCode: module.shareCode });
        } catch (error) {
            console.error('shareModule error:', error);
            return res.status(500).json({ success: false, error: 'Failed to share module' });
        }
    }

    // Simple member unenrollment - just remove the user from members array
    async unenroll(req, res) {
        try {
            const moduleId = req.params.moduleId;
            const userId = req.user._id;

            console.log('[Unenroll] Attempting to unenroll:', { moduleId, userId });

            // Simple update to remove user from members
            const result = await Module.updateOne(
                { _id: moduleId },
                { $pull: { members: { user: userId } } }
            );

            console.log('[Unenroll] Update result:', result);

            return res.json({
                success: true,
                message: 'Successfully unenrolled from module'
            });
        } catch (error) {
            console.error('[Unenroll] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to unenroll from module'
            });
        }
    }

    async importModule(req, res) {
        try {
            const { shareCode } = req.body;
            
            // Enhanced authentication validation
            if (!req.user) {
                console.error('[importModule] No user in request');
                return res.status(401).json({ success: false, error: 'Authentication required' });
            }

            const userId = req.user._id || req.user.id;
            if (!userId) {
                console.error('[importModule] No user ID available');
                return res.status(401).json({ success: false, error: 'Invalid user session' });
            }

            console.log('[importModule] Import requested:', { 
                shareCode, 
                requesterId: userId,
                userEmail: req.user.email
            });

            // Input validation
            if (!shareCode || typeof shareCode !== 'string') {
                console.error('[importModule] Invalid share code:', shareCode);
                return res.status(400).json({ success: false, error: 'Valid share code is required' });
            }

            // Verify user exists in database
            const User = require('../models/User.models');
            try {
                const userExists = await User.findById(userId).select('_id');
                if (!userExists) {
                    console.error('[importModule] User not found in database:', userId);
                    return res.status(401).json({ success: false, error: 'User account not found' });
                }
            } catch (userErr) {
                console.error('[importModule] Error verifying user:', userErr);
                return res.status(500).json({ success: false, error: 'Error verifying user account' });
            }

            // Find original module
            let original;
            try {
                original = await Module.findOne({ shareCode })
                    .populate('owner', 'displayName name _id email')
                    .lean(); // Use lean() to get plain JS object
            } catch (dbError) {
                console.error('[importModule] Error finding module:', dbError);
                return res.status(500).json({ success: false, error: 'Error locating module to import' });
            }

            if (!original) {
                return res.status(404).json({ success: false, error: 'Invalid share code' });
            }

            // Check if user already has access
            try {
                const existing = await Module.findOne({
                    $or: [
                        { _id: original._id, $or: [{ owner: userId }, { 'members.user': userId }] },
                        { originalModule: original._id, $or: [{ owner: userId }, { 'members.user': userId }] }
                    ]
                }).select('_id');

                if (existing) {
                    return res.status(400).json({ success: false, error: 'You already have access to this module' });
                }
            } catch (checkErr) {
                console.error('[importModule] Error checking existing:', checkErr);
                return res.status(500).json({ success: false, error: 'Error checking existing access' });
            }

            // Create new module
            try {
                // Create a clean copy of the module data
                const moduleData = {
                    subject: original.subject,
                    owner: userId,
                    originalModule: original._id,
                    progress: 0,
                    members: [{ user: userId, role: 'owner' }],
                    chapters: original.chapters ? original.chapters.map(chapter => ({
                        id: chapter.id,
                        name: chapter.name,
                        difficulty: chapter.difficulty || 'intermediate',
                        sections: chapter.sections ? chapter.sections.map(section => ({
                            id: section.id,
                            name: section.name,
                            difficulty: section.difficulty || 'intermediate',
                            subsections: section.subsections ? section.subsections.map(subsection => ({
                                id: subsection.id,
                                name: subsection.name,
                                type: subsection.type || 'concept',
                                content: {
                                    description: subsection.content?.description || '',
                                    key_points: subsection.content?.key_points || [],
                                    examples: subsection.content?.examples || [],
                                    resources: subsection.content?.resources || { youtube: [], articles: [], additionalTopics: [] },
                                    difficulty: subsection.content?.difficulty || 'intermediate'
                                },
                                learningMaterials: [],
                                quizzes: [],
                                flashcards: []
                            })) : []
                        })) : []
                    })) : []
                };

                // Create new module instance
                const newModule = new Module(moduleData);
                
                // Save with validation
                await newModule.save();

                // Populate user details for response
                await newModule.populate([
                    { path: 'owner', select: 'displayName name _id email' },
                    { path: 'members.user', select: 'displayName name _id email' }
                ]);

                console.log('[importModule] Successfully created:', {
                    moduleId: newModule._id,
                    owner: newModule.owner._id,
                    memberCount: newModule.members.length,
                    chapterCount: newModule.chapters.length
                });

                return res.json({ success: true, module: newModule });
            } catch (error) {
                console.error('[importModule] Error creating module:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to create imported module',
                    details: error.message 
                });
            }
        } catch (error) {
            console.error('[importModule] Unexpected error:', error);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to import module',
                details: error.message
            });
        }
    }

    // Add a member to module (owner or admin can add)
    async addMember(req, res) {
        try {
            const { moduleId } = req.params;
            const { userId, role = 'member' } = req.body;
            const requester = req.user && (req.user._id || req.user.id);

            const module = await Module.findById(moduleId);
            if (!module) return res.status(404).json({ success: false, error: 'Module not found' });

            // Only owner or admin can add
            const isOwner = module.owner.toString() === requester.toString();
            const isAdmin = (module.members || []).some(m => m.user && m.user.toString() === requester.toString() && m.role === 'admin');
            if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: 'Not authorized' });

            // Prevent duplicate
            if ((module.members || []).some(m => m.user && m.user.toString() === userId)) {
                return res.status(400).json({ success: false, error: 'User already a member' });
            }

            module.members.push({ user: userId, role });
            await module.save();

            return res.json({ success: true, message: 'Member added' });
        } catch (error) {
            console.error('addMember error:', error);
            return res.status(500).json({ success: false, error: 'Failed to add member' });
        }
    }

    // Invite a member by email (owner or admin only). If the user exists, add them; otherwise return not found.
    async inviteMember(req, res) {
        try {
            console.log('[Member Invite] Starting invite process');
            const { moduleId } = req.params;
            const { email } = req.body;
            const requester = req.user && (req.user._id || req.user.id);

            console.log('[Member Invite] Params:', { moduleId, email, requesterId: requester });

            if (!email) {
                console.log('[Member Invite] No email provided');
                return res.status(400).json({ success: false, error: 'Email is required' });
            }

            const module = await Module.findById(moduleId);
            if (!module) {
                console.log('[Member Invite] Module not found:', moduleId);
                return res.status(404).json({ success: false, error: 'Module not found' });
            }

            console.log('[Member Invite] Found module:', { id: module._id, owner: module.owner });

            // Only owner, admin or moderator can invite
            const isOwner = module.owner.toString() === requester.toString();
            const requesterMember = (module.members || []).find(m => m.user && m.user.toString() === requester.toString());
            const isAdmin = !!(requesterMember && requesterMember.role === 'admin');
            const isModerator = !!(requesterMember && requesterMember.role === 'moderator');

            console.log('[Member Invite] Permission check:', { isOwner, isAdmin, isModerator });

            if (!isOwner && !isAdmin && !isModerator) {
                console.log('[Member Invite] Permission denied for requester:', requester);
                return res.status(403).json({ success: false, error: 'Not authorized' });
            }

            const User = require('../models/User.models');
            let user;
            try {
                user = await User.findOne({ email });
            } catch (dbError) {
                console.error('[Member Invite] Database error finding user:', dbError);
                return res.status(500).json({ success: false, error: 'Database error while finding user' });
            }

            if (!user) {
                console.log('[Member Invite] User not found with email:', email);
                return res.status(404).json({ success: false, error: 'User with that email not found' });
            }

            console.log('[Member Invite] Found user:', { id: user._id, email: user.email });

            const userId = user._id.toString();
            if ((module.members || []).some(m => m.user && m.user.toString() === userId) || module.owner.toString() === userId) {
                console.log('[Member Invite] User already a member:', userId);
                return res.status(400).json({ success: false, error: 'User already a member' });
            }

            module.members.push({ user: userId, role: 'member' });
            await module.save();

            console.log('[Member Invite] Successfully added member:', { moduleId, userId });
            
            // Set explicit content type and response structure
            res.setHeader('Content-Type', 'application/json');
            return res.json({ success: true, message: 'Invitation processed (user added to module)' });
        } catch (error) {
            console.error('[Member Invite] Error:', error);
            // Set explicit content type even for error responses
            res.setHeader('Content-Type', 'application/json');
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to invite member', 
                details: error.message 
            });
        }
    }

    // Remove a member from module (owner or admin)
    async removeMember(req, res) {
        try {
            const { moduleId, userId: userIdStr } = req.params;
            const requesterIdStr = req.user && (req.user._id || req.user.id);

            const module = await Module.findById(moduleId);
            if (!module) {
                return res.status(404).json({ success: false, error: 'Module not found' });
            }

            // For admin removal actions, check permissions
            const isOwner = module.owner.toString() === requesterIdStr;
            const requesterMember = module.members.find(m => m.user.toString() === requesterIdStr);
            const isAdmin = !!(requesterMember && requesterMember.role === 'admin');
            const isModerator = !!(requesterMember && requesterMember.role === 'moderator');

            if (!isOwner && !isAdmin && !isModerator) {
                return res.status(403).json({ success: false, error: 'Not authorized to remove members' });
            }

            // Prevent removing the owner
            if (module.owner.toString() === userIdStr) {
                return res.status(400).json({ success: false, error: 'Cannot remove module owner' });
            }

            // If requester is moderator, ensure target is a regular member
            if (isModerator) {
                const targetMember = module.members.find(m => m.user.toString() === userIdStr);
                if (!targetMember) {
                    return res.status(404).json({ success: false, error: 'Member not found' });
                }
                if (targetMember.role && targetMember.role !== 'member') {
                    return res.status(403).json({ success: false, error: 'Moderators can only remove regular members' });
                }
            }

            // Remove the member
            module.members = module.members.filter(m => m.user.toString() !== userIdStr);
            await module.save();

            return res.json({ success: true, message: 'Member removed' });
        } catch (error) {
            console.error('removeMember error:', error);
            return res.status(500).json({ success: false, error: 'Failed to remove member' });
        }
    }

    // Delete a module (owner only)
    async deleteModule(req, res) {
        try {
            const { moduleId } = req.params;
            const requester = req.user && (req.user._id || req.user.id);

            const module = await Module.findById(moduleId);
            if (!module) return res.status(404).json({ success: false, error: 'Module not found' });

            const isOwner = module.owner.toString() === requester.toString();
            if (!isOwner) return res.status(403).json({ success: false, error: 'Only owner can delete module' });

            await Module.deleteOne({ _id: moduleId });
            return res.json({ success: true, message: 'Module deleted' });
        } catch (error) {
            console.error('deleteModule error:', error);
            return res.status(500).json({ success: false, error: 'Failed to delete module' });
        }
    }

    // Update member role (owner only)
    async updateMemberRole(req, res) {
        try {
            const { moduleId } = req.params;
            const { userId, role } = req.body;
            const requester = req.user && (req.user._id || req.user.id);

            const module = await Module.findById(moduleId);
            if (!module) return res.status(404).json({ success: false, error: 'Module not found' });

            // Only owner can change roles
            const isOwner = module.owner.toString() === requester.toString();
            if (!isOwner) return res.status(403).json({ success: false, error: 'Only owner can update roles' });

            const mem = (module.members || []).find(m => m.user && m.user.toString() === userId);
            if (!mem) return res.status(404).json({ success: false, error: 'Member not found' });

            mem.role = role;
            await module.save();

            return res.json({ success: true, message: 'Member role updated' });
        } catch (error) {
            console.error('updateMemberRole error:', error);
            return res.status(500).json({ success: false, error: 'Failed to update member role' });
        }
    }

    // Streaming version of generateQuizzes - creates UserQuiz per user/subsection/difficulty
    async generateQuizzesStream(req, res) {
        try {
            const { subsectionId } = req.params;
            const userId = req.user?._id;
            const { difficulty = 'beginner', useUserContent = false } = req.body;

            console.log('[AI API CALLED]', 'generateQuizzesStream', {
                timestamp: new Date().toISOString(),
                moduleId: null,
                subsectionId,
                difficulty,
                userId
            });

            if (!userId) {
                return res.status(401).json({ success: false, error: 'User not authenticated' });
            }

            // Set up SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const sendEvent = (type, data) => {
                res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
            };

            sendEvent('start', { message: 'Starting quiz generation...' });

            // Check if user wants fresh questions (always generate new for variety)
            // Delete existing quiz to ensure fresh questions each time
            const existingQuiz = await UserQuiz.findOne({ userId, subsectionId, difficulty });
            if (existingQuiz) {
                await UserQuiz.deleteOne({ _id: existingQuiz._id });
                console.log(`[Quiz] Deleted existing quiz to generate fresh questions`);
            }

            const mongoose = require('mongoose');
            if (!mongoose.Types.ObjectId.isValid(subsectionId)) {
                sendEvent('error', { message: 'Invalid subsection id' });
                return res.end();
            }

            sendEvent('progress', { step: 'loading', message: 'Loading module content...' });
            const module = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
            if (!module) {
                sendEvent('error', { message: 'Subsection not found' });
                return res.end();
            }

            let targetChapter = null;
            let targetSection = null;
            let targetSubsection = null;
            for (const chapter of module.chapters) {
                for (const section of chapter.sections) {
                    const found = section.subsections.find(sub => sub._id.toString() === subsectionId);
                    if (found) {
                        targetChapter = chapter;
                        targetSection = section;
                        targetSubsection = found;
                        break;
                    }
                }
                if (targetSubsection) break;
            }

            if (!targetSubsection) {
                sendEvent('error', { message: 'Subsection not found in module' });
                return res.end();
            }

            sendEvent('progress', { step: 'preparing', message: 'Preparing content for quiz generation...' });
            let contentForQuiz;
            if (useUserContent && Array.isArray(targetSubsection.learningMaterials)) {
                contentForQuiz = targetSubsection.learningMaterials
                    .filter(material => material.content)
                    .map(material => material.content)
                    .join('\n\n');
            } else {
                const desc = (targetSubsection.content && targetSubsection.content.description) || '';
                const keyPoints = (targetSubsection.content && Array.isArray(targetSubsection.content.key_points)) ? targetSubsection.content.key_points.join('\n') : '';
                const examples = (targetSubsection.content && Array.isArray(targetSubsection.content.examples)) ? targetSubsection.content.examples.join('\n') : '';
                contentForQuiz = [desc, keyPoints, examples].filter(Boolean).join('\n');
            }

            if (!contentForQuiz || contentForQuiz.trim().length === 0) {
                sendEvent('error', { message: 'No content available for quiz generation' });
                return res.end();
            }

            // Cache check
            const cacheKey = `${module._id}:${subsectionId}:${difficulty}`;
            const cached = quizCache[cacheKey];
            const now = Date.now();
            if (cached && (now - cached.timestamp) < QUIZ_CACHE_TTL_MS && Array.isArray(cached.data)) {
                console.log('[CACHE HIT]', cacheKey);
                cached.data.forEach((question, i) => {
                    sendEvent('question', {
                        question,
                        index: i,
                        total: cached.data.length,
                        message: `Question ${i + 1} ready! (cached)`
                    });
                });
                sendEvent('complete', {
                    success: true,
                    quiz: {
                        questions: cached.data,
                        totalQuestions: cached.data.length,
                        difficulty
                    },
                    count: cached.data.length,
                    message: 'Quiz served from cache'
                });
                return res.end();
            }

            sendEvent('progress', { step: 'generating', message: `Generating ${difficulty} quiz questions...` });
            
            // Generate questions one at a time and stream them immediately
            const numQuestions = 5;
            const questions = [];
            const seenQuestions = new Set();
            let userQuiz = null;

            for (let i = 0; i < numQuestions; i++) {
                sendEvent('progress', { 
                    step: 'generating', 
                    message: `Generating question ${i + 1} of ${numQuestions}...`,
                    current: i + 1,
                    total: numQuestions
                });

                // Generate one MCQ at a time using generatePair - SKIP flashcard for speed
                // Pass previously generated questions to avoid duplicates
                let pair;
                let attempts = 0;
                const maxAttemptsPerQuestion = 3;
                const normalizeQuestion = (q) => (q || '').trim().toLowerCase().replace(/\s+/g, ' ');

                while (attempts < maxAttemptsPerQuestion) {
                    attempts += 1;
                    try {
                        // Pass previously generated questions so AI can avoid duplicates
                        pair = await quizGenerator.generatePair(contentForQuiz, {
                            difficulty: difficulty,
                            skipFlashcard: true, // Skip flashcard generation to speed up
                            previousQuestions: questions // Pass all previously generated questions
                        });
                    } catch (error) {
                        // Handle quota errors gracefully
                        if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
                            console.error('[generateQuizzesStream] API quota exceeded:', error.message);
                            sendEvent('error', { 
                                message: 'API quota exceeded. You have reached the free tier limit. Please try again in a few minutes.',
                                quotaExceeded: true
                            });
                            return res.end();
                        }
                        throw error;
                    }

                    const normalizedQ = normalizeQuestion(pair?.mcq?.question || '');
                    if (normalizedQ && !seenQuestions.has(normalizedQ)) {
                        seenQuestions.add(normalizedQ);
                        break;
                    }

                    // If duplicate, try again
                    if (attempts >= maxAttemptsPerQuestion) {
                        console.warn('[generateQuizzesStream] Skipping duplicate question after retries');
                    }
                }

                if (pair && pair.mcq) {
                    const originalOptions = Array.isArray(pair.mcq.options) ? pair.mcq.options : [];
                    const shuffledOptions = shuffleOptions(originalOptions);
                    const question = {
                        question: pair.mcq.question,
                        options: shuffledOptions,
                        // Keep correctAnswer as text; we only shuffle option order
                        correctAnswer: pair.mcq.correctAnswer,
                        explanation: pair.mcq.explanation,
                        topic: pair.mcq.topic,
                        resources: pair.mcq.resources || {},
                        id: pair.mcq.id,
                        generatedAt: pair.mcq.generatedAt
                    };
                    questions.push(question);

                    // Stream the question IMMEDIATELY so user can start - don't wait for DB save
                    sendEvent('question', {
                        question: question,
                        index: i,
                        total: numQuestions,
                        message: `Question ${i + 1} ready!`
                    });

                    // Create or update UserQuiz with questions so far
                    if (!userQuiz) {
                        userQuiz = new UserQuiz({
                            userId,
                            subsectionId,
                            difficulty,
                            questions: [],
                            currentIndex: 0
                        });
                    }
                    userQuiz.questions.push(question);
                    
                    // Save immediately for first question (so user can start), then batch saves
                    if (i === 0 || i === numQuestions - 1 || (i + 1) % 2 === 0) {
                        await userQuiz.save();
                    }
                }
            }
            
            // Final save to ensure all questions are persisted
            if (userQuiz && questions.length > 0) {
                await userQuiz.save();
            }

            if (questions.length > 0) {
                quizCache[cacheKey] = { data: questions, timestamp: now };
                console.log('[CACHE STORE]', cacheKey);
            }

            sendEvent('progress', { step: 'complete', message: 'All questions generated!' });

            sendEvent('complete', { 
                success: true, 
                quiz: {
                    _id: userQuiz._id,
                    questions: userQuiz.questions,
                    currentIndex: userQuiz.currentIndex,
                    totalQuestions: userQuiz.questions.length,
                    difficulty: userQuiz.difficulty
                },
                count: userQuiz.questions.length,
                message: 'Quiz generated successfully'
            });
            res.end();
        } catch (error) {
            console.error('Error in generateQuizzesStream:', error);
            // Handle quota errors specifically
            if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
                res.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    message: 'API quota exceeded. You have reached the free tier limit. Please try again in a few minutes.',
                    quotaExceeded: true
                })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            }
            res.end();
        }
    }

    // ⚡ FAST (batch-backed): Generate MCQs with a single AI call and serve indexed items
    async generateOneMCQ(req, res) {
        try {
            const { difficulty = 'beginner', index = 0, subsectionId } = req.query;

            if (!subsectionId) {
                return res.status(400).json({
                    success: false,
                    error: 'subsectionId required'
                });
            }

            // Get subsection content from database
            const mongoose = require('mongoose');
            if (!mongoose.Types.ObjectId.isValid(subsectionId)) {
                return res.status(400).json({ success: false, error: 'Invalid subsection id' });
            }

            const module = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
            if (!module) {
                return res.status(404).json({ success: false, error: 'Subsection not found' });
            }

            let targetSubsection = null;
            for (const chapter of module.chapters) {
                for (const section of chapter.sections) {
                    const found = section.subsections.find(sub => sub._id.toString() === subsectionId);
                    if (found) {
                        targetSubsection = found;
                        break;
                    }
                }
                if (targetSubsection) break;
            }

            if (!targetSubsection) {
                return res.status(404).json({ success: false, error: 'Subsection not found in module' });
            }

            console.log('[AI API CALLED]', 'generateOneMCQ', {
                timestamp: new Date().toISOString(),
                moduleId: module._id,
                subsectionId,
                difficulty,
                userId: req?.user?._id
            });

            const desc = (targetSubsection.content && targetSubsection.content.description) || '';
            const keyPoints = (targetSubsection.content && Array.isArray(targetSubsection.content.key_points))
                ? targetSubsection.content.key_points.join('\n') : '';
            const examples = (targetSubsection.content && Array.isArray(targetSubsection.content.examples))
                ? targetSubsection.content.examples.join('\n') : '';
            const contentForQuiz = [desc, keyPoints, examples].filter(Boolean).join('\n').substring(0, 1500);
            const topic = targetSubsection.name || 'the topic';

            const cacheKey = `${module._id}:${subsectionId}:${difficulty}`;
            const cached = quizCache[cacheKey];
            const now = Date.now();
            if (cached && (now - cached.timestamp) < QUIZ_CACHE_TTL_MS && Array.isArray(cached.data)) {
                console.log('[CACHE HIT]', cacheKey);
            }

            let questions = cached && (now - cached.timestamp) < QUIZ_CACHE_TTL_MS ? cached.data : null;

            if (!questions) {
                questions = await generateBatchMCQ({
                    contentForQuiz,
                    topic,
                    difficulty,
                    moduleId: module._id,
                    subsectionId,
                    userId: req?.user?._id
                });
                if (Array.isArray(questions) && questions.length >= 4) {
                    quizCache[cacheKey] = { data: questions, timestamp: now };
                    console.log('[CACHE STORE]', cacheKey);
                } else {
                    console.warn('[CACHE SKIP] Not enough unique MCQs to cache', { cacheKey, count: questions?.length || 0 });
                }
            }

            const idx = Math.max(0, parseInt(index, 10) || 0) % questions.length;
            const mcq = questions[idx];
            const shuffledOptions = shuffleOptions(mcq.options);

            const result = {
                success: true,
                question: mcq.question,
                options: shuffledOptions,
                correctAnswer: mcq.correctAnswer,
                explanation: mcq.explanation || 'No explanation provided',
                id: mcq.id || `mcq_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
                index: idx,
                difficulty: mcq.difficulty || difficulty,
                generatedAt: mcq.generatedAt || now
            };

            return res.json(result);
        } catch (error) {
            console.error('generateOneMCQ error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate MCQ'
            });
        }
    }

    async generateQuizzes(req, res) {
        try {
            const { subsectionId } = req.params;
            const { useUserContent = false } = req.body;

            console.log('[AI API CALLED]', 'generateQuizzes', {
                timestamp: new Date().toISOString(),
                subsectionId,
                difficulty: req.body?.difficulty,
                userId: req?.user?._id
            });

            // Validate subsectionId
            const mongoose = require('mongoose');
            if (!mongoose.Types.ObjectId.isValid(subsectionId)) {
                return res.status(400).json({ success: false, error: 'Invalid subsection id' });
            }

            // Load module and locate subsection (used to extract content and identify path)
            const module = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
            if (!module) {
                return res.status(404).json({ success: false, error: 'Subsection not found' });
            }

            // Find the chapter/section/subsection objects and their ids for arrayFilters
            let targetChapter = null;
            let targetSection = null;
            let targetSubsection = null;
            for (const chapter of module.chapters) {
                for (const section of chapter.sections) {
                    const found = section.subsections.find(sub => sub._id.toString() === subsectionId);
                    if (found) {
                        targetChapter = chapter;
                        targetSection = section;
                        targetSubsection = found;
                        break;
                    }
                }
                if (targetSubsection) break;
            }

            if (!targetSubsection) {
                return res.status(404).json({ success: false, error: 'Subsection not found in module' });
            }

            const cacheKey = `${module._id}:${subsectionId}:${(targetSubsection.content && targetSubsection.content.difficulty) || 'intermediate'}`;
            const now = Date.now();
            const cached = quizCache[cacheKey];
            if (cached && (now - cached.timestamp) < QUIZ_CACHE_TTL_MS && Array.isArray(cached.data)) {
                console.log('[CACHE HIT]', cacheKey);
                return res.json({
                    success: true,
                    quiz: {
                        questions: cached.data,
                        totalQuestions: cached.data.length,
                        difficulty: (targetSubsection.content && targetSubsection.content.difficulty) || 'intermediate'
                    },
                    cached: true
                });
            }

            let contentForQuiz;
            if (useUserContent && Array.isArray(targetSubsection.learningMaterials) && targetSubsection.learningMaterials.length > 0) {
                // Use user-uploaded content for quiz generation
                contentForQuiz = targetSubsection.learningMaterials
                    .filter(material => material.content)
                    .map(material => material.content)
                    .join('\n\n');
            } else {
                // Use AI-generated content (be defensive when fields are missing)
                const desc = (targetSubsection.content && targetSubsection.content.description) || '';
                const keyPoints = (targetSubsection.content && Array.isArray(targetSubsection.content.key_points)) ? targetSubsection.content.key_points.join('\n') : '';
                const examples = (targetSubsection.content && Array.isArray(targetSubsection.content.examples)) ? targetSubsection.content.examples.join('\n') : '';
                contentForQuiz = [desc, keyPoints, examples].filter(Boolean).join('\n');
            }

            // Generate quizzes and flashcards
            const sectionPath = `${targetChapter.id}.${targetSection.id}.${targetSubsection.id}`;
            const quiz = await quizGenerator.generateAndStoreQuiz(
                module._id,
                sectionPath,
                contentForQuiz,
                {
                    difficulty: (targetSubsection.content && targetSubsection.content.difficulty) || 'intermediate',
                    numQuestions: 5
                }
            );

            if (quiz && Array.isArray(quiz.questions)) {
                quizCache[cacheKey] = { data: quiz.questions, timestamp: now };
                console.log('[CACHE STORE]', cacheKey);
            }

            // Update subsection with new quizzes and flashcards using a targeted update
            const update = {
                $set: {
                    'chapters.$[c].sections.$[s].subsections.$[ss].quizzes': quiz.questions || []
                }
            };

            const arrayFilters = [
                { 'c._id': targetChapter._id },
                { 's._id': targetSection._id },
                { 'ss._id': targetSubsection._id }
            ];

            // Try update and handle possible version errors by retrying once
            try {
                const result = await Module.updateOne(
                    { _id: module._id, 'chapters.sections.subsections._id': subsectionId },
                    update,
                    { arrayFilters }
                );

                if (result.matchedCount === 0) {
                    // No document matched; return not found
                    return res.status(404).json({ success: false, error: 'Subsection/module not found for update' });
                }

                res.json({ 
                    success: true, 
                    quizzes: quiz.questions || [], 
                    currentDifficulty: quiz.currentDifficulty || 'beginner'
                });
            } catch (updateError) {
                console.error('Update error:', updateError);
                // If it's a VersionError, refetch and retry the update once
                if (updateError && updateError.name === 'VersionError') {
                    const freshModule = await Module.findOne({ 'chapters.sections.subsections._id': subsectionId });
                    if (!freshModule) {
                        return res.status(404).json({ success: false, error: 'Subsection not found on retry' });
                    }

                    // Recompute arrayFilters against freshModule
                    let freshChap, freshSec, freshSub;
                    for (const chapter of freshModule.chapters) {
                        for (const section of chapter.sections) {
                            const found = section.subsections.find(sub => sub._id.toString() === subsectionId);
                            if (found) {
                                freshChap = chapter;
                                freshSec = section;
                                freshSub = found;
                                break;
                            }
                        }
                        if (freshSub) break;
                    }

                    if (!freshSub) {
                        return res.status(404).json({ success: false, error: 'Subsection missing on retry' });
                    }

                    const retryRes = await Module.updateOne(
                        { _id: freshModule._id, 'chapters.sections.subsections._id': subsectionId },
                        update,
                        { arrayFilters: [{ 'c._id': freshChap._id }, { 's._id': freshSec._id }, { 'ss._id': freshSub._id }] }
                    );

                    if (retryRes.matchedCount === 0) {
                        return res.status(500).json({ success: false, error: 'Failed to update subsection after retry' });
                    }

                    return res.json({ success: true, quizzes, flashcards });
                }

                // Unknown update error
                return res.status(500).json({ success: false, error: 'Failed to update subsection: ' + updateError.message });
            }
        } catch (error) {
            console.error('Error generating quizzes:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // NOTE: Deprecated – we no longer pre-generate quizzes for entire modules.
    // Quizzes are now generated on-demand per subsection when the user starts a quiz,
    // to save tokens, time, and memory.
    async generateQuizzesForModule(req, res) {
        return res.status(410).json({
            success: false,
            error: 'Bulk module quiz generation is disabled. Quizzes are generated on-demand when the user starts a quiz.'
        });
    }

    async uploadLearningMaterial(req, res) {
        try {
            const { subsectionId } = req.params;
            const files = req.files || [];
            const { title, description, type } = req.body;

            const module = await Module.findOne({
                'chapters.sections.subsections._id': subsectionId
            });

            if (!module) {
                return res.status(404).json({
                    success: false,
                    error: 'Subsection not found'
                });
            }

            const uploadDir = path.join(__dirname, '../../uploads');
            await fs.mkdir(uploadDir, { recursive: true });

            // Process each file
            const learningMaterials = await Promise.all(files.map(async file => {
                const filename = Date.now() + '-' + file.originalname;
                const filepath = path.join(uploadDir, filename);
                await fs.writeFile(filepath, file.buffer);

                // Extract text content if possible
                let content = '';
                try {
                    content = await fileProcessor.processFile(file);
                } catch (error) {
                    console.warn('Could not extract text from file:', error);
                }

                return {
                    type: type || mime.lookup(file.originalname).split('/')[0],
                    title: title || file.originalname,
                    description,
                    file: {
                        path: filename,
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        size: file.size
                    },
                    content,
                    isUserGenerated: true
                };
            }));

            // Find and update the subsection
            let found = false;
            for (const chapter of module.chapters) {
                for (const section of chapter.sections) {
                    const subsection = section.subsections.find(sub => sub._id.toString() === subsectionId);
                    if (subsection) {
                        subsection.learningMaterials.push(...learningMaterials);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            await module.save();

            res.json({
                success: true,
                learningMaterials
            });
        } catch (error) {
            console.error('Error uploading learning materials:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async uploadUserContent(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No files uploaded'
                });
            }

            const { sectionId, notes } = req.body;
            const module = await Module.findOne({
                'chapters.sections.subsections._id': sectionId
            });

            if (!module) {
                return res.status(404).json({
                    success: false,
                    error: 'Section not found'
                });
            }

            // Create uploads directory if it doesn't exist
            const uploadDir = path.join(__dirname, '../../uploads');
            await fs.mkdir(uploadDir, { recursive: true });

            // Process each file
            const uploadedFiles = [];
            for (const file of req.files) {
                const filename = Date.now() + '-' + file.originalname;
                const filepath = path.join(uploadDir, filename);
                await fs.writeFile(filepath, file.buffer);

                uploadedFiles.push({
                    filename: file.originalname,
                    fileType: path.extname(file.originalname).toLowerCase().slice(1),
                    path: filename
                });
            }

            // Update the module with user content
            const section = module.chapters
                .flatMap(ch => ch.sections)
                .find(sec => sec.subsections.some(sub => sub._id.toString() === sectionId));

            if (!section) {
                return res.status(404).json({
                    success: false,
                    error: 'Section not found'
                });
            }

            const subsection = section.subsections.find(sub => sub._id.toString() === sectionId);
            subsection.userContent = {
                files: uploadedFiles,
                customNotes: notes
            };
            subsection.isUserGenerated = true;

            await module.save();

            res.status(200).json({
                success: true,
                message: 'Content uploaded successfully',
                files: uploadedFiles
            });
        } catch (error) {
            console.error('Error uploading user content:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    // Streaming version of createModule
    async createModuleStream(req, res) {
        console.log('createModuleStream called');
        
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    success: false,
                    error: 'No file uploaded' 
                });
            }

            if (!req.user || !req.user._id) {
                return res.status(401).json({
                    success: false,
                    error: 'User not authenticated'
                });
            }

            // Set up SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const sendEvent = (type, data) => {
                res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
            };

            sendEvent('start', { message: 'Starting module creation...' });

            // Process file
            sendEvent('progress', { step: 'extracting', message: 'Extracting text from file...' });
            if (!req.file.buffer) {
                if (req.file.data) {
                    req.file.buffer = Buffer.from(req.file.data);
                } else {
                    sendEvent('error', { message: 'File not available in memory' });
                    return res.end();
                }
            }

            let extractedText;
            try {
                extractedText = await fileProcessor.processFile(req.file);
            } catch (fileError) {
                console.error('File processing error:', fileError);
                sendEvent('error', { message: fileError.message || 'Failed to extract text from the file' });
                return res.end();
            }
            
            if (!extractedText) {
                sendEvent('error', { message: 'No text could be extracted from the file' });
                return res.end();
            }

            sendEvent('progress', { step: 'structuring', message: 'Structuring content with AI...' });

            // Stream module structure generation (GitHub Models only)
            let moduleData;
            try {
                moduleData = await generateStructuredContentStream(
                    extractedText,
                    sendEvent
                );
            } catch (error) {
                console.error('Content generation error in createModuleStream:', error);
                
                // Sanitize error message - remove Gemini references if somehow present
                let errorMessage = error.message || 'Failed to generate content';
                
                // If error mentions Gemini, it means old code is running
                if (errorMessage.includes('Gemini') || errorMessage.includes('GoogleGenerativeAI')) {
                    errorMessage = '⚠️ ERROR: Backend is running old code with Gemini. Please restart backend from correct directory: studybuddylatest3\\backend\n\n' +
                                  'GitHub Models API quota may also be exceeded. Please try again in a few minutes.';
                    console.error('[CRITICAL] Gemini error detected - backend is running from wrong directory!');
                } else if (error.status === 429) {
                    // Only treat as quota error if status is explicitly 429
                    errorMessage = 'GitHub Models API rate limit exceeded (429). Please try again in a few minutes.';
                } else {
                    // For all other errors, show the actual error message
                    errorMessage = `GitHub Models API error: ${errorMessage}`;
                }
                
                sendEvent('error', { message: errorMessage });
                return res.end();
            }
            
            if (!moduleData || !moduleData.subject || !Array.isArray(moduleData.chapters)) {
                sendEvent('error', { message: 'Content structuring failed: Invalid response format' });
                return res.end();
            }

            moduleData.owner = req.user._id;
            moduleData.members = [{ user: req.user._id, role: 'owner' }];

            sendEvent('progress', { step: 'saving', message: 'Saving module...' });
            const module = new Module(moduleData);
            await module.save();

            sendEvent('module_created', { 
                module: {
                    _id: module._id,
                    subject: module.subject,
                    chapters: module.chapters.map(ch => ({
                        id: ch.id,
                        name: ch.name,
                        sections: ch.sections?.map(sec => ({
                            id: sec.id,
                            name: sec.name,
                            subsections: sec.subsections?.map(sub => ({
                                id: sub.id,
                                name: sub.name
                            })) || []
                        })) || []
                    }))
                }
            });

            // Stream quiz generation
            // Skip automatic quiz generation here to save time/tokens.
            // Quizzes are generated on-demand when the user starts a quiz.
            sendEvent('complete', { 
                message: 'Module created successfully',
                module: {
                    _id: module._id,
                    subject: module.subject
                }
            });
            res.end();
        } catch (error) {
            console.error('Error in createModuleStream:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    }

    async createModule(req, res) {
        console.log('createModule called');
        console.log('Request body:', req.body);
        console.log('Request files:', req.files);
        console.log('Request file:', req.file);
        
        try {
            if (!req.file) {
                console.log('No file in request');
                return res.status(400).json({ 
                    success: false,
                    error: 'No file uploaded' 
                });
            }

            // Check if user is authenticated
            if (!req.user || !req.user._id) {
                return res.status(401).json({
                    success: false,
                    error: 'User not authenticated'
                });
            }

            console.log('File received:', {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });

            // Process the uploaded file
            console.log('Starting file processing...');
            // Ensure req.file.buffer is a Node Buffer (multer.memoryStorage should provide this)
            if (!req.file.buffer) {
                // Try to normalize common shapes
                if (req.file.data) {
                    req.file.buffer = Buffer.from(req.file.data);
                } else if (req.file.stream && typeof req.file.stream.read === 'function') {
                    // Not ideal to consume the stream here; log and return error
                    console.error('Received a streaming file; expected buffer from multer memoryStorage');
                    return res.status(400).json({ success: false, error: 'Uploaded file not available in memory. Please re-upload.' });
                }
            }

            const extractedText = await fileProcessor.processFile(req.file);
            
            if (!extractedText) {
                return res.status(400).json({
                    success: false,
                    error: 'No text could be extracted from the file'
                });
            }

            // Use GitHub Models to structure the content
            let moduleData;
            try {
                console.log('Sending text to GitHub Models:', extractedText.substring(0, 200) + '...');
                
                const structured = await generateStructuredContent(
                    extractedText
                );
                
                if (!structured || !structured.subject || !Array.isArray(structured.chapters)) {
                    console.error('Invalid structure received:', structured);
                    throw new Error('Content structuring failed: Invalid response format');
                }

                moduleData = {
                    ...structured,
                    owner: req.user._id,
                    members: [{ user: req.user._id, role: 'owner' }]  // Ensure owner is also set as a member with owner role
                };
                
                console.log('Successfully structured content:', {
                    subject: moduleData.subject,
                    chapterCount: moduleData.chapters.length
                });
            } catch (error) {
                console.error('AI structuring failed:', {
                    error: error.message,
                    stack: error.stack,
                    responseType: error.responseType,
                    status: error.status
                });
                
                return res.status(500).json({
                    success: false,
                    error: `Failed to structure content: ${error.message}. Please try again or use a different file.`
                });
            }

            // If preview flag present, return structured data but do not persist
            if (req.query && req.query.preview === 'true') {
                return res.json({ success: true, preview: moduleData });
            }

            const module = new Module(moduleData);
            await module.save();

            // MCQ generation is now done on-demand when user clicks "Start Quiz"
            // This improves performance and ensures quizzes are only generated when needed

            res.status(201).json({
                success: true,
                module,
                message: 'Module created successfully'
            });
        } catch (error) {
            console.error('Error creating module:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getModules(req, res) {
        try {
            // populate owner and member user info for client display
            console.log('[getModules] Fetching modules for user:', req.user._id);
            
            const modules = await Module.find({ 
                $or: [
                    { owner: req.user._id },
                    { 'members.user': req.user._id }
                ]
            })
            .populate('owner', 'displayName name _id email')
            .populate({
                path: 'members.user',
                select: 'displayName name _id email',
                model: 'User'
            })
            .populate('originalModule')
            .lean();  // Convert to plain objects for modification
            
            console.log('[getModules] Found modules:', modules.map(m => ({
                id: m._id,
                subject: m.subject,
                owner: m.owner?._id,
                memberCount: m.members?.length,
                members: m.members?.map(mem => ({
                    userId: mem.user?._id,
                    name: mem.user?.name || mem.user?.displayName,
                    role: mem.role
                }))
            })));
            
            // For each imported module, get the original owner info
            for (const module of modules) {
                if (module.originalModule) {
                    await Module.populate(module, {
                        path: 'originalModule.owner',
                        select: 'displayName name _id email'
                    });
                }
                
                // Ensure owner is counted in members (if not already in members array)
                // Calculate total member count: members array + owner (if owner not in members)
                const ownerInMembers = module.members?.some(m => 
                    m.user && (String(m.user._id || m.user) === String(module.owner?._id || module.owner))
                );
                
                // Add memberCount field that includes owner
                module.memberCount = (module.members?.length || 0) + (ownerInMembers ? 0 : 1);
            }
            
            res.json({
                success: true,
                modules
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getModuleById(req, res) {
        try {
            console.log('[getModuleById] Fetching module:', req.params.id);
            
            const module = await Module.findById(req.params.id)
                .populate('owner', 'displayName name _id email')
                .populate({
                    path: 'members.user',
                    select: 'displayName name _id email',
                    model: 'User'
                })
                .populate('originalModule');
            
            if (!module) {
                console.log('[getModuleById] Module not found');
                return res.status(404).json({
                    success: false,
                    error: 'Module not found'
                });
            }
            
            console.log('[getModuleById] Found module with members:', {
                owner: module.owner?._id,
                memberCount: module.members?.length,
                members: module.members.map(m => ({
                    userId: m.user?._id,
                    name: m.user?.name || m.user?.displayName,
                    role: m.role
                }))
            });
            
            // If this is an imported module, also get the original module owner info
            if (module.originalModule) {
                await module.populate('originalModule.owner', 'displayName name _id email');
            }
            
            // Ensure owner is counted in members (if not already in members array)
            const ownerInMembers = module.members?.some(m => 
                m.user && (String(m.user._id || m.user) === String(module.owner?._id || module.owner))
            );
            
            // Add memberCount field that includes owner
            const moduleObj = module.toObject ? module.toObject() : module;
            moduleObj.memberCount = (module.members?.length || 0) + (ownerInMembers ? 0 : 1);

            res.json({
                success: true,
                module: moduleObj
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new ModuleController();