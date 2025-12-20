import React from 'react';
import './GameSession.css';

const SKILLS = {
    // Learning Skills
    QUICK_LEARNER: {
        id: 'quick-learner',
        name: 'Quick Learner',
        description: 'Gain 15% more XP from correct answers',
        icon: '📚',
        requires: [],
        maxLevel: 3,
        bonusPerLevel: 0.15 // 15% XP bonus per level
    },
    COMBO_MASTER: {
        id: 'combo-master',
        name: 'Combo Master',
        description: 'Increase combo XP bonus by 5% per level',
        icon: '⚡',
        requires: ['quick-learner'],
        maxLevel: 5,
        bonusPerLevel: 0.05
    },

    // Power-up Skills
    POWER_DURATION: {
        id: 'power-duration',
        name: 'Extended Power',
        description: 'Power-ups last 20% longer',
        icon: '⌛',
        requires: [],
        maxLevel: 3,
        bonusPerLevel: 0.20
    },
    POWER_POTENCY: {
        id: 'power-potency',
        name: 'Power Boost',
        description: 'Power-ups are 25% more effective',
        icon: '💪',
        requires: ['power-duration'],
        maxLevel: 3,
        bonusPerLevel: 0.25
    },

    // Recovery Skills
    SECOND_CHANCE: {
        id: 'second-chance',
        name: 'Second Chance',
        description: 'Chance to keep your combo on wrong answers',
        icon: '🎯',
        requires: ['combo-master'],
        maxLevel: 3,
        bonusPerLevel: 0.15 // 15% chance per level
    },
    STREAK_SHIELD: {
        id: 'streak-shield',
        name: 'Streak Shield',
        description: 'Wrong answers reduce streak by 1 instead of resetting it',
        icon: '🛡️',
        requires: ['second-chance'],
        maxLevel: 1
    }
};

const skillTreeLayout = [
    // Level 1 (Base skills)
    [
        'quick-learner',
        'power-duration'
    ],
    // Level 2
    [
        'combo-master'
    ],
    // Level 3
    [
        'power-potency',
        'second-chance'
    ],
    // Level 4
    [
        'streak-shield'
    ]
];

export default function SkillTree({ 
    unlockedSkills = new Set(),
    skillLevels = {},
    skillPoints = 0,
    onSkillUnlock
}) {
    const canUnlockSkill = (skillId) => {
        const skill = SKILLS[skillId];
        if (!skill) return false;

        // Check if we have points
        if (skillPoints <= 0) return false;

        // Check if already at max level
        const currentLevel = skillLevels[skillId] || 0;
        if (currentLevel >= skill.maxLevel) return false;

        // Check if requirements are met
        return skill.requires.every(reqId => unlockedSkills.has(reqId));
    };

    const handleSkillClick = (skillId) => {
        if (canUnlockSkill(skillId)) {
            onSkillUnlock(skillId);
        }
    };

    const renderSkill = (skillId) => {
        const skill = SKILLS[skillId];
        if (!skill) return null;

        const unlocked = unlockedSkills.has(skillId);
        const level = skillLevels[skillId] || 0;
        const canUnlock = canUnlockSkill(skillId);

        return (
            <div
                key={skillId}
                className={`skill-node ${unlocked ? 'unlocked' : ''} ${canUnlock ? 'can-unlock' : ''}`}
                onClick={() => handleSkillClick(skillId)}
                title={`${skill.name} (Level ${level}/${skill.maxLevel})
${skill.description}
${canUnlock ? '✨ Click to unlock!' : ''}`}
            >
                <div className="skill-icon">{skill.icon}</div>
                {level > 0 && (
                    <div className="skill-level">
                        {level}
                    </div>
                )}
            </div>
        );
    };

    const renderConnectors = () => {
        // Render lines connecting related skills
        // This could be done with SVG lines or CSS
        return null; // Implement skill tree connection lines
    };

    return (
        <div className="skill-tree">
            <div className="skill-points">
                Skill Points: {skillPoints}
            </div>
            
            {skillTreeLayout.map((row, rowIndex) => (
                <div key={rowIndex} className="skill-row">
                    {row.map(skillId => renderSkill(skillId))}
                </div>
            ))}
            
            {renderConnectors()}
        </div>
    );
}