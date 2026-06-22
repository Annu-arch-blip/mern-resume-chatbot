import React, { useEffect, useRef, useState } from 'react';
import api from '../api';

const MODES = [
  { key: 'resume', label: 'Resume Improvement' },
  { key: 'jobmatch', label: 'Job Matching' },
  { key: 'interview', label: 'Interview Prep' },
];

const MODE_PLACEHOLDER = {
  resume: 'Paste a section of your resume, or describe what you want feedback on...',
  jobmatch: 'Paste a job description, or tell me about your target role...',
  interview: 'Tell me what role/company you want to practice for, or just say "start"...',
};

export default function Chat({ user, onLogout }) {
  const [mode, setMode] = useState('resume');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const scrollRef = useRef(null);
  const [uploadingFile, setUpload ] = useState(null);
  const [fileContent, setFileContent] = useState('');

  useEffect(() => {
    fetchThreads(mode);
    setConversationId(null);
    setMessages([]);
    setError('');
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function fetchThreads(forMode) {
    setThreadsLoading(true);
    try {
      const res = await api.get('/api/history', { params: { mode: forMode } });
      setThreads(res.data);
    } catch (err) {
      console.error('Failed to load threads:', err.response?.data?.message || err.message);
    } finally {
      setThreadsLoading(false);
    }
  }

  async function openThread(thread) {
    setConversationId(thread._id);
    setMessages(thread.messages || []);
    setError('');
  }

  function startNewThread() {
    setConversationId(null);
    setMessages([]);
    setError('');
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUpload (file.name);

    try {
      const text = await file.text();
      const cleanedText = text.trim();
      
      if (!cleanedText) {
        setError('File appears to be empty.');
        setFileContent('');
        setInput('');
      } else {
        setFileContent(cleanedText);
        setInput(cleanedText);
      }
    } catch (err) {
      console.error('File upload error:', err);
      setError('Failed to read file. Make sure it\'s a .txt file.');
      setFileContent('');
      setInput('');
    } finally {
      setUpload (null);
    }
  }

  function clearFile() {
    setFileContent('');
    setInput('');
    setUpload (null);
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError('');
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await api.post('/api/analyze', {
        text,
        mode,
        conversationId: conversationId || undefined,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
      if (!conversationId) {
        setConversationId(res.data.conversationId);
      }
      fetchThreads(mode);
    } catch (err) {
      const message = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  }

  function threadPreview(thread) {
    const firstUserMsg = thread.messages?.find((m) => m.role === 'user');
    if (!firstUserMsg) return 'New conversation';
    return firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">AI Career Assistant</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={handleLogout} className="text-sm text-red-600 hover:underline font-medium">
            Logout
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              mode === m.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        <aside className="w-64 border-r border-gray-200 bg-white p-4 hidden md:flex flex-col">
          <button
            onClick={startNewThread}
            className="mb-4 w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-md py-2 transition-colors"
          >
            + New Conversation
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {threadsLoading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : threads.length === 0 ? (
              <p className="text-xs text-gray-400">No conversations yet in this mode.</p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread._id}
                  onClick={() => openThread(thread)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    conversationId === thread._id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                  }`}
                >
                  <p className="font-medium truncate">{threadPreview(thread)}</p>
                  <p className="text-gray-400 mt-0.5">
                    {new Date(thread.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-16">
                {mode === 'resume' && 'Paste resume text below to start getting feedback.'}
                {mode === 'jobmatch' && 'Share a job description or your target role to begin.'}
                {mode === 'interview' && 'Tell me what role you want to practice for, and we\'ll begin a mock interview.'}
              </div>
            ) : (
              messages.map((msg, idx) => {
                const atsMatch = msg.content?.match(/ATS Score[:\s]+(\d+)/i);
                const atsScore = atsMatch ? parseInt(atsMatch[1]) : null;

                return (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                    }`}>
                      {msg.role === 'assistant' && atsScore && (
                        <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                              atsScore >= 80 ? 'bg-green-100 text-green-700' :
                              atsScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {atsScore}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">ATS Score</p>
                              <p className="text-xs text-gray-500">
                                {atsScore >= 80 ? 'Excellent — ready to apply!' :
                                 atsScore >= 60 ? 'Good — minor improvements needed' :
                                 'Needs improvement — focus on key areas'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 md:px-8">
              <div className="bg-red-50 text-red-600 text-sm rounded-md px-3 py-2 mb-2">
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="border-t border-gray-200 bg-white px-4 md:px-8 py-4">
            <div className="mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
                  📎 Upload Resume (.txt)
                </span>
                {uploadingFile && <span className="text-xs text-gray-500">Loading: {uploadingFile}</span>}
              </label>

              {fileContent && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <span>✓ File loaded</span>
                  <button onClick={clearFile} className="text-red-500 hover:text-red-700 underline">
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                rows={2}
                placeholder={MODE_PLACEHOLDER[mode]}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md px-5 transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}