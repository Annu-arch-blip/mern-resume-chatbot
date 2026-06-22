const Chat = require('../models/Chat');

const VALID_MODES = ['resume', 'jobmatch', 'interview'];

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

// System prompts define the assistant's persona + behavior for each mode.
// These are sent once per request as the first message in the chat history
// passed to Ollama, so the model stays in character turn after turn.
const SYSTEM_PROMPTS = {
  resume: `You are a professional resume coach who provides ATS-focused feedback. For EVERY resume the user shares:

1. FIRST, calculate and display an ATS score at the very start:
   "ATS Score: XX/100" (where XX is a number between 0-100)

2. Then list 3-5 specific weak sections (e.g., "Experience - lacks metrics", "Skills - missing keywords")

3. Identify 3-5 missing keywords for typical roles in their field

4. Give 3-5 actionable improvement suggestions with examples

Format example:
ATS Score: 72/100

Weak sections:
- Experience: lacks quantifiable metrics
- Skills: missing React, Node.js keywords  
- Education: unclear graduation date

Missing keywords:
- React, Node.js, REST APIs, MongoDB, TypeScript

Improvements:
1. Add numbers to achievements (e.g., "Improved performance by 40%" instead of "Improved performance")
2. Use strong action verbs (Developed, Built, Implemented vs Worked on)
3. Include specific technologies with versions when relevant

Keep responses practical and focused. Avoid generic praise without substance. ALWAYS start with ATS Score.`,

  jobmatch: `You are a career advisor specializing in job matching. Help the user figure out which roles fit their background, and how well their resume/skills match a specific job description when they share one.
When the user pastes a job description, compare it against what you know of their background from the conversation and call out: matching skills, missing skills/qualifications, and how to position their experience for that role.
Ask the user for their resume summary, target role, or a job posting if you don't have enough context yet.
Be honest about gaps, not just encouraging.`,

  interview: `You are an interview preparation coach. Help the user practice for job interviews through realistic, conversational mock interviews.
Ask one interview question at a time (behavioral, technical, or role-specific based on context the user gives you). After the user answers, give brief constructive feedback (what was strong, what to improve, e.g. STAR method structure) before asking the next question.
Adapt difficulty and topic to the role/level the user mentions. If they haven't specified a role yet, ask what role/company they're preparing for.`,
};

function getSystemPrompt(mode) {
  return SYSTEM_PROMPTS[mode];
}

// Calls the local Ollama server's chat endpoint.
// messages: array of { role: 'system' | 'user' | 'assistant', content: string }
async function callOllama(messages) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`Ollama request failed (${response.status}): ${errText}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const reply = data?.message?.content?.trim();

  if (!reply) {
    throw new Error('Ollama returned an empty response.');
  }

  return reply;
}

// POST /api/analyze
// Body: { text, mode, conversationId? }
// - If conversationId is provided, appends to that existing thread.
// - Otherwise starts a new conversation thread for that mode.
// Verifies JWT (via middleware) -> calls Ollama -> saves to MongoDB -> returns AI reply.
async function analyze(req, res) {
  try {
    const { text, mode, conversationId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text is required.' });
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return res.status(400).json({
        message: "Mode must be one of: 'resume', 'jobmatch', 'interview'.",
      });
    }

    // Find existing conversation or start a new one for this user + mode.
    let conversation;
    if (conversationId) {
      conversation = await Chat.findOne({ _id: conversationId, userId: req.userId, mode });
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found.' });
      }
    } else {
      conversation = new Chat({ userId: req.userId, mode, messages: [] });
    }

    // Build the message list to send to Ollama: system prompt + prior turns + new user message.
    const ollamaMessages = [
      { role: 'system', content: getSystemPrompt(mode) },
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    const aiReply = await callOllama(ollamaMessages);

    conversation.messages.push({ role: 'user', content: text });
    conversation.messages.push({ role: 'assistant', content: aiReply });
    await conversation.save();

    return res.status(200).json({
      reply: aiReply,
      conversationId: conversation._id,
      mode: conversation.mode,
    });
  } catch (err) {
    console.error('Analyze error:', err.message);

    // ECONNREFUSED means the Ollama server isn't running locally.
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return res.status(502).json({
        message: 'Could not reach the local Ollama server. Make sure "ollama serve" is running.',
      });
    }
    if (err.status === 404) {
      return res.status(502).json({
        message: `Ollama model "${OLLAMA_MODEL}" not found. Run: ollama pull ${OLLAMA_MODEL}`,
      });
    }

    return res.status(500).json({ message: 'Server error while analyzing text.' });
  }
}

// GET /api/history
// Returns a list of the logged-in user's conversation threads (newest first),
// optionally filtered by mode via ?mode=resume|jobmatch|interview.
async function getHistory(req, res) {
  try {
    const { mode } = req.query;
    const filter = { userId: req.userId };

    if (mode) {
      if (!VALID_MODES.includes(mode)) {
        return res.status(400).json({
          message: "Mode must be one of: 'resume', 'jobmatch', 'interview'.",
        });
      }
      filter.mode = mode;
    }

    const conversations = await Chat.find(filter).sort({ updatedAt: -1 });
    return res.status(200).json(conversations);
  } catch (err) {
    console.error('History error:', err.message);
    return res.status(500).json({ message: 'Server error while fetching history.' });
  }
}

// GET /api/conversation/:id
// Returns a single conversation thread's full message history.
async function getConversation(req, res) {
  try {
    const conversation = await Chat.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    return res.status(200).json(conversation);
  } catch (err) {
    console.error('Get conversation error:', err.message);
    return res.status(500).json({ message: 'Server error while fetching conversation.' });
  }
}

module.exports = { analyze, getHistory, getConversation };
