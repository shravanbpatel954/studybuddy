const express = require('express');
const router = express.Router();
const multer = require('multer');
const ModuleController = require('../controller/ModuleController');
const { verifyToken } = require('../utils/jwt');
const Module = require('../models/Module.models');

// Handle member leaving a module
router.post('/:moduleId/leave', verifyToken, async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const userId = req.user._id;

        console.log('Member leaving module:', { moduleId, userId });

        // First check if the module exists and if the user is actually a member
        const module = await Module.findById(moduleId);
        if (!module) {
            return res.status(404).json({
                success: false,
                error: 'Module not found'
            });
        }

        // Check if user is the owner
        if (module.owner.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Module owner cannot leave. Use delete instead.'
            });
        }

        const result = await Module.updateOne(
            { _id: moduleId },
            { $pull: { members: { user: userId } } }
        );

        if (result.modifiedCount > 0) {
            return res.json({
                success: true,
                message: 'Successfully left the module'
            });
        } else {
            return res.status(404).json({
                success: false,
                error: 'Module not found or user not a member'
            });
        }
    } catch (error) {
        console.error('Error leaving module:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to leave module'
        });
    }
});

// Handle module deletion (owner only)
router.delete('/:moduleId', verifyToken, async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const userId = req.user._id;

        console.log('Attempting to delete module:', { moduleId, userId });

        const module = await Module.findById(moduleId);
        if (!module) {
            return res.status(404).json({
                success: false,
                error: 'Module not found'
            });
        }

        // Verify ownership
        if (module.owner.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Only the owner can delete a module'
            });
        }

        await Module.deleteOne({ _id: moduleId });
        
        return res.json({
            success: true,
            message: 'Module successfully deleted'
        });
    } catch (error) {
        console.error('Error deleting module:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete module'
        });
    }
});

// Route for a member to unenroll from a module
router.post('/unenroll/:moduleId', verifyToken, async (req, res) => {
    try {
        const moduleId = req.params.moduleId;
        const userId = req.user._id;

        console.log('Member attempting to unenroll from module:', { moduleId, userId });

        // First check if the module exists and if the user is actually a member
        const module = await Module.findById(moduleId);
        if (!module) {
            return res.status(404).json({
                success: false,
                error: 'Module not found'
            });
        }

        // Check if user is the owner
        if (module.owner.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Module owner cannot unenroll. Transfer ownership or delete the module instead.'
            });
        }

        const result = await Module.updateOne(
            { _id: moduleId },
            { 
                $pull: { 
                    members: { 
                        user: userId 
                    } 
                } 
            }
        );

        console.log('Update result:', result);

        if (result.modifiedCount > 0) {
            res.json({
                success: true,
                message: 'Successfully removed from module'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Module not found or user not a member'
            });
        }
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove member'
        });
    }
});

// Log all requests to this router
router.use((req, res, next) => {
    console.log(`[Module Router] ${req.method} ${req.url}`);
    next();
});

// Error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File is too large. Maximum size is 25MB'
            });
        }
        return res.status(400).json({
            success: false,
            error: 'File upload error: ' + err.message
        });
    } else if (err) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
    next();
};

// Configure multer for file upload
const storage = multer.memoryStorage();
const fileProcessor = require('../utils/fileProcessor');

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = {
            // PDF documents
            'application/pdf': true,
            // Word documents
            'application/msword': true,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
            'application/vnd.oasis.opendocument.text': true,
            // PowerPoint presentations
            'application/vnd.ms-powerpoint': true,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
            'application/vnd.oasis.opendocument.presentation': true,
            // Images
            'image/jpeg': true,
            'image/png': true,
            'image/gif': true,
            'image/webp': true,
            'image/tiff': true,
            // Text files
            'text/plain': true,
            'text/rtf': true
        };

        if (allowedMimeTypes[file.mimetype]) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Supported formats: PDF, Word, PowerPoint, Images, and Text files.'));
        }
    }
});

// Module routes
router.post('/', verifyToken, (req, res, next) => {
    console.log('Module route hit');
    next();
}, upload.single('file'), handleMulterError, (req, res, next) => {
    console.log('File uploaded:', req.file);
    next();
}, ModuleController.createModule);

// Streaming module creation endpoint
router.post('/stream', verifyToken, (req, res, next) => {
    console.log('Module stream route hit');
    next();
}, upload.single('file'), handleMulterError, (req, res, next) => {
    console.log('File uploaded for streaming:', req.file);
    next();
}, ModuleController.createModuleStream);

router.get('/', verifyToken, ModuleController.getModules);
router.get('/:id', verifyToken, ModuleController.getModuleById);

// Module sharing routes
router.post('/:moduleId/share', verifyToken, ModuleController.shareModule);
router.post('/import', verifyToken, ModuleController.importModule);

// Learning materials and quiz routes
router.post('/materials/:subsectionId', verifyToken, upload.array('files'), handleMulterError, ModuleController.uploadLearningMaterial);
router.post('/quizzes/:subsectionId', verifyToken, ModuleController.generateQuizzes);
router.post('/quizzes/:subsectionId/stream', verifyToken, ModuleController.generateQuizzesStream);
// Fast single MCQ generation endpoint for parallel fetching
router.get('/generateOneMCQ', verifyToken, ModuleController.generateOneMCQ);
router.post('/generateOneMCQ', verifyToken, ModuleController.generateOneMCQ);
router.post('/quizzes/module/:moduleId', verifyToken, ModuleController.generateQuizzesForModule);
// GET /api/v1/modules/quizzes/:subsectionId
// Return existing quiz; DO NOT generate new quiz here
router.get('/quizzes/:subsectionId', verifyToken, async (req, res) => {
    try {
        const { subsectionId } = req.params;
        const userId = req.user?._id;
        const difficulty = req.query.difficulty || 'beginner';

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        // Check for existing UserQuiz first
        const UserQuiz = require('../models/UserQuiz.models');
        const userQuiz = await UserQuiz.findOne({ userId, subsectionId, difficulty });

        if (userQuiz) {
            // Return existing quiz
            return res.json({
                success: true,
                quiz: {
                    _id: userQuiz._id,
                    questions: userQuiz.questions,
                    currentIndex: userQuiz.currentIndex,
                    totalQuestions: userQuiz.questions.length,
                    difficulty: userQuiz.difficulty,
                    createdAt: userQuiz.createdAt
                },
                exists: true
            });
        }

        // If no quiz exists, return empty (frontend should trigger generation)
        return res.json({
            success: true,
            quiz: null,
            exists: false,
            message: 'No quiz found. Please generate quiz first.'
        });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// User content routes
router.post('/content/:sectionId', verifyToken, upload.array('files'), handleMulterError, ModuleController.uploadUserContent);

// Edit topic/subtopic name
router.patch('/content/:sectionId', verifyToken, async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { name } = req.body;

        if (!sectionId) {
            return res.status(400).json({
                success: false,
                error: 'Section ID is required'
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
            });
        }

        console.log('Searching for section:', sectionId);
        console.log('New name:', name);

        const module = await Module.findOne({
            'chapters.sections.subsections._id': sectionId
        });

        if (!module) {
            console.log('No module found with section:', sectionId);
            return res.status(404).json({
                success: false,
                error: 'Section not found'
            });
        }

        // Find and update the section name
        let found = false;
        for (const chapter of module.chapters) {
            if (!chapter.sections) continue;
            
            for (const section of chapter.sections) {
                if (!section.subsections) continue;
                
                const subsection = section.subsections.find(sub => sub._id.toString() === sectionId);
                if (subsection) {
                    subsection.name = name;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        if (!found) {
            console.log('Subsection not found in module');
            return res.status(404).json({
                success: false,
                error: 'Subsection not found in module'
            });
        }

        await module.save();
        console.log('Module updated successfully');

        res.status(200).json({
            success: true,
            message: 'Section name updated successfully'
        });
    } catch (error) {
        console.error('Error updating section name:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Member management
router.post('/:moduleId/members', verifyToken, ModuleController.addMember);
router.delete('/:moduleId', verifyToken, ModuleController.deleteModule);

module.exports = router;
