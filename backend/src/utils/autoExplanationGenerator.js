function paragraphize(lines) {
    return lines.map(p => p.trim()).filter(Boolean).join('\n\n');
}

function generateAutoExplanation(topic) {
    const cleanTopic = topic || 'This topic';

    const paragraphs = [
        `${cleanTopic} — definition and scope: Clearly define the concept, outline its purpose, and place it within the syllabus so learners know exactly what is being assessed.`,
        `Step-by-step working and practical use: Describe how ${cleanTopic} operates in practice, the sequence of actions or signals involved, and how practitioners apply it during implementation or analysis.`,
        `Exam importance, advantages, and limits: Highlight why ${cleanTopic} appears on exams, the core strengths that make it valuable, and the common limitations or pitfalls students must be able to discuss.`,
        `Real-world application and exam framing: Show how ${cleanTopic} is used in real scenarios, then connect those examples to likely exam prompts to build transfer and recall.`
    ];

    const keyPoints = [
        `Clear definition and purpose of ${cleanTopic}`,
        `Step-by-step workflow or process for ${cleanTopic}`,
        `Two to three real-world use cases to anchor understanding`,
        `Key advantages and limitations for exam discussion`,
        `Exam-ready phrasing and common question angles`
    ];

    const examples = [
        `Industry application: Applying ${cleanTopic} in a live project to improve reliability and decision-making.`,
        `Academic framing: Using ${cleanTopic} as a structured example when answering a long-form exam question.`
    ];

    return {
        title: `${cleanTopic} — Exam-Ready Explanation`,
        explanation: paragraphize(paragraphs),
        keyPoints,
        examples,
        source: 'AI Auto Generated',
        confidence: 'High'
    };
}

module.exports = { generateAutoExplanation };

