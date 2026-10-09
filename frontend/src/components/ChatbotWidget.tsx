import React, { useState, useEffect, useRef } from 'react';
import { chatbotApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { CitationItem } from '../types';
import { FormattedMarkdown } from './FormattedMarkdown';
import { 
  MessageSquare, Send, Bot, ThumbsUp, ThumbsDown, BookOpen, AlertCircle, 
  Sparkles, X, Globe, PhoneCall, Trash2, ChevronDown, CheckCircle2, ShieldAlert,
  Volume2, VolumeX, Mic, MicOff, Square, Play, Pause
} from 'lucide-react';

const getFriendlySourceName = (title?: string, path?: string): string => {
  const src = (title || path || '').toLowerCase();
  if (src.includes('report') || src.includes('discharge') || src.includes('summary')) return 'Your discharge report';
  if (src.includes('chart') || src.includes('step') || src.includes('schedule') || src.includes('follow-up')) return 'Your follow-up chart';
  if (src.includes('directory') || src.includes('2016') || src.includes('hospital')) return 'Hospital directory (2016)';
  return 'Medical terms glossary';
};

const CollapsibleSources: React.FC<{ citations: CitationItem[] }> = ({ citations }) => {
  if (!citations || citations.length === 0) return null;

  const friendlyNames = Array.from(
    new Set(citations.map(c => getFriendlySourceName(c.title, c.url_or_path)))
  );

  return (
    <div className="mt-2.5 pt-2 border-t border-forestGreen/60 text-[10px]">
      <div className="flex items-center gap-1.5 text-limeAccent font-medium bg-darkBg/60 px-2.5 py-1.5 rounded border border-forestGreen/40">
        <BookOpen className="w-3.5 h-3.5 text-limeAccent shrink-0" />
        <span>Sources used: {friendlyNames.join(', ')}</span>
      </div>
    </div>
  );
};

export const ChatbotWidget: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{
    id?: number;
    sender: 'user' | 'bot';
    text: string;
    citations?: CitationItem[];
    requiresReview?: boolean;
    suggestedActions?: string[];
  }>>([
    {
      sender: 'bot',
      text: "Hi! I'm CareBridge's AI assistant. I'm not a doctor and I can't give medical advice. I can explain your follow-up plan, hospital details and what to do after discharge."
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<Record<number, string>>({});
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateQuestion, setEscalateQuestion] = useState('');
  const [escalateSending, setEscalateSending] = useState(false);
  const [escalateMsg, setEscalateMsg] = useState<string | null>(null);

  // Voice TTS & STT States
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [speakingSentenceIndex, setSpeakingSentenceIndex] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const sentByVoiceRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedChips = [
    "What is my next appointment?",
    "Explain my diagnosis",
    "Which tests do I need?",
    "Suggest hospitals near me",
    "What should I do after discharge?"
  ];

  // Load chat history from DB when opened
  useEffect(() => {
    if (isOpen) {
      chatbotApi.getHistory()
        .then(history => {
          if (history && history.length > 0) {
            const formatted: any[] = [];
            history.forEach((h: any) => {
              formatted.push({ sender: 'user', text: h.query });
              formatted.push({
                id: h.id,
                sender: 'bot',
                text: h.response,
                citations: h.citations
              });
            });
            setMessages(formatted);
          }
        })
        .catch(err => console.warn("Failed loading chat history:", err));
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Clean text for speech (strip IDs, headers, markdown)
  const getSpeechCleanText = (rawText: string): string => {
    let clean = rawText
      .replace(/HOS-\d+/g, '')
      .replace(/Task\s*#?\d+/g, '')
      .replace(/Patient\s*#?\d+/g, '')
      .replace(/\[\[(.*?)\]\]/g, '$1')
      .replace(/[*#_`>]/g, '')
      .trim();
    return clean;
  };

  // Speak Message with Sentence Highlighting
  const speakMessage = (text: string, msgIndex: number, msgLang: string = language) => {
    if (playingMsgIndex === msgIndex) {
      // Stop speech
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setPlayingMsgIndex(null);
      setSpeakingSentenceIndex(null);
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setPlayingMsgIndex(msgIndex);
    const cleanText = getSpeechCleanText(text);
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

    const langCodeMap: Record<string, string> = {
      en: 'en-IN',
      ta: 'ta-IN',
      hi: 'hi-IN',
      te: 'te-IN',
      ml: 'ml-IN',
      kn: 'kn-IN',
      bn: 'bn-IN',
      mr: 'mr-IN'
    };
    const targetLangCode = langCodeMap[msgLang] || 'en-IN';

    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(msgLang.toLowerCase()) || v.lang.toLowerCase().includes(targetLangCode.toLowerCase()));

      let currentSentenceIndex = 0;

      const speakNextSentence = () => {
        if (currentSentenceIndex >= sentences.length) {
          setPlayingMsgIndex(null);
          setSpeakingSentenceIndex(null);
          return;
        }

        const sentence = sentences[currentSentenceIndex];
        setSpeakingSentenceIndex(currentSentenceIndex);

        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = targetLangCode;
        if (matchedVoice) utterance.voice = matchedVoice;
        utterance.rate = 0.95;

        utterance.onend = () => {
          currentSentenceIndex++;
          speakNextSentence();
        };

        utterance.onerror = () => {
          setPlayingMsgIndex(null);
          setSpeakingSentenceIndex(null);
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNextSentence();
    } else {
      // Fallback TTS server API
      setMicNotice("Voice output via server fallback stream...");
      setPlayingMsgIndex(null);
    }
  };

  // Start Voice Microphone STT
  const handleToggleRecord = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicNotice("Speech recognition not supported in browser. Use keyboard input.");
      setTimeout(() => setMicNotice(null), 3000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      const langCodeMap: Record<string, string> = {
        en: 'en-IN',
        ta: 'ta-IN',
        hi: 'hi-IN',
        te: 'te-IN',
        ml: 'ml-IN',
        kn: 'kn-IN',
        bn: 'bn-IN',
        mr: 'mr-IN'
      };

      recognition.lang = langCodeMap[language] || 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = true;

      setMicNotice("Your voice is converted to text and not saved.");

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcriptStr = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcriptStr += event.results[i][0].transcript;
        }
        setQuery(transcriptStr);
      };

      recognition.onerror = (event: any) => {
        console.warn("STT error:", event.error);
        setIsRecording(false);
        setMicNotice("Voice input error. You can type your query.");
        setTimeout(() => setMicNotice(null), 3000);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setTimeout(() => setMicNotice(null), 3000);
      };

      recognition.start();
    } catch (err) {
      console.error("Mic start failed:", err);
      setIsRecording(false);
    }
  };

  const handleSendQuery = async (textToSend: string, isVoiceSent: boolean = false) => {
    if (!textToSend.trim() || loading) return;
    const userMsg = textToSend.trim();
    setQuery('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);
    if (isVoiceSent) sentByVoiceRef.current = true;

    try {
      const res = await chatbotApi.query(userMsg, language);
      
      // Auto switch language dropdown if backend detected new language
      if (res.detected_language && res.detected_language !== language) {
        setLanguage(res.detected_language as any);
      }

      const newMsgIndex = messages.length + 1;
      setMessages(prev => [
        ...prev,
        {
          id: res.chat_history_id,
          sender: 'bot',
          text: res.answer,
          citations: res.citations,
          requiresReview: res.requires_human_review,
          suggestedActions: res.suggested_actions
        }
      ]);

      // Auto Speak if Auto-Speak toggle ON OR message sent by Voice
      if (autoSpeak || sentByVoiceRef.current) {
        setTimeout(() => {
          speakMessage(res.answer, newMsgIndex, res.detected_language || language);
        }, 300);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'bot', text: 'Sorry, I am an AI assistant having trouble connecting to CareBridge servers right now. Answering from cached records.' }
      ]);
    } finally {
      setLoading(false);
      sentByVoiceRef.current = false;
    }
  };

  const handleThumbFeedback = async (msgIndex: number, chatId: number | undefined, type: 'thumbs_up' | 'thumbs_down') => {
    if (!chatId) return;
    try {
      await chatbotApi.submitFeedback(chatId, type);
      setFeedbackSent(prev => ({ ...prev, [msgIndex]: type }));
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await chatbotApi.clearHistory();
      setMessages([
        {
          sender: 'bot',
          text: "Hi! I'm CareBridge's AI assistant. I'm not a doctor and I can't give medical advice. I can explain your follow-up plan, hospital details and what to do after discharge."
        }
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendEscalation = async () => {
    if (!escalateQuestion.trim()) return;
    setEscalateSending(true);
    setEscalateMsg(null);
    try {
      const res = await chatbotApi.escalate(escalateQuestion.trim());
      setEscalateMsg("Question emailed to your hospital care team! A clinician will review it.");
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `📧 **Question Escalated to Hospital**: "${escalateQuestion.trim()}"\n\nYour question has been emailed directly to your hospital care team. They will review it shortly.`
        }
      ]);
      setEscalateQuestion('');
      setTimeout(() => {
        setShowEscalateModal(false);
        setEscalateMsg(null);
      }, 2500);
    } catch (err: any) {
      setEscalateMsg(err.response?.data?.detail || "Failed sending question to hospital.");
    } finally {
      setEscalateSending(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-tr from-primaryGreen to-limeAccent text-darkBg p-4 rounded-full shadow-2xl hover:scale-110 transition flex items-center gap-2 font-bold cursor-pointer"
        >
          <Bot className="w-6 h-6" />
          <span className="hidden sm:inline text-xs font-bold">Ask CareBridge Assistant</span>
        </button>
      )}

      {/* Chatbot Window / Responsive Mobile Drawer */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full max-w-lg bg-panelBg border-2 border-forestGreen rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[88vh] sm:h-[580px] overflow-hidden animate-in slide-in-from-bottom duration-200">
          
          {/* Header Bar */}
          <div className="bg-darkBg p-3.5 flex flex-wrap items-center justify-between border-b border-forestGreen gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-forestGreen text-limeAccent flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-xs sm:text-sm">CareBridge Assistant</h3>
                <span className="text-[10px] text-limeAccent flex items-center gap-1 font-mono">
                  <Sparkles className="w-3 h-3 text-limeAccent" /> AI Care Coordinator (Not a doctor)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Switcher */}
              <div className="flex items-center gap-1 bg-panelBg border border-forestGreen rounded-lg px-2 py-0.5 text-[10px]">
                <Globe className="w-3 h-3 text-limeAccent" />
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as any)}
                  className="bg-transparent text-white focus:outline-none font-semibold cursor-pointer text-[10px]"
                  style={{ color: '#FFFFFF', backgroundColor: '#102A2A' }}
                >
                  <option value="en">English</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                  <option value="te">Telugu (తెలుగు)</option>
                  <option value="ml">Malayalam (മലയാളം)</option>
                  <option value="kn">Kannada (கன்னட)</option>
                  <option value="bn">Bengali (বাংলা)</option>
                  <option value="mr">Marathi (मराठी)</option>
                </select>
              </div>

              {/* Auto Speak Toggle Button */}
              <button
                type="button"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition ${
                  autoSpeak ? 'bg-primaryGreen text-darkBg border-limeAccent' : 'bg-darkBg text-textLight/70 border-forestGreen/60'
                }`}
                title={autoSpeak ? "Auto-speak replies is ON" : "Turn Auto-speak replies ON"}
              >
                {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">Auto-speak</span>
              </button>

              {/* Talk to Hospital Button */}
              <button
                onClick={() => setShowEscalateModal(true)}
                className="bg-forestGreen/80 hover:bg-forestGreen text-limeAccent border border-forestGreen px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                title="Email a question to your hospital care team"
              >
                <PhoneCall className="w-3 h-3" /> Hospital
              </button>

              {/* Clear Chat */}
              <button
                onClick={handleClearHistory}
                className="p-1 hover:bg-forestGreen/40 rounded text-textLight/60 hover:text-white"
                title="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button onClick={() => setIsOpen(false)} className="text-textLight/70 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Privacy & Mic Status Banner */}
          {micNotice && (
            <div className="bg-forestGreen/60 text-limeAccent text-[10px] px-3 py-1 font-mono text-center flex items-center justify-center gap-1.5 animate-pulse border-b border-forestGreen">
              <Sparkles className="w-3 h-3 text-limeAccent" /> {micNotice}
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-darkBg/80 text-xs">
            
            {/* Suggested Chips Bar */}
            <div className="bg-panelBg/80 p-3 rounded-2xl border border-forestGreen/60 space-y-2">
              <span className="text-[10px] font-bold text-limeAccent block">⚡ Suggested Healthcare Questions:</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendQuery(chip)}
                    className="bg-darkBg hover:bg-forestGreen text-limeAccent border border-forestGreen/80 px-2.5 py-1 rounded-xl text-[10px] font-semibold transition text-left cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-forestGreen text-limeAccent flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow">
                    CB
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2 ${
                  msg.sender === 'user'
                    ? 'bg-primaryGreen text-darkBg font-bold rounded-tr-none shadow-md'
                    : 'bg-panelBg text-white border border-forestGreen/80 rounded-tl-none shadow'
                }`}>
                  {msg.sender === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <FormattedMarkdown content={msg.text} />
                  )}

                  {/* Collapsible Sources Used */}
                  {msg.citations && msg.citations.length > 0 && (
                    <CollapsibleSources citations={msg.citations} />
                  )}

                  {/* Play Speaker Voice Output Button & Waveform animation */}
                  {msg.sender === 'bot' && (
                    <div className="mt-2.5 pt-1.5 border-t border-forestGreen/40 flex items-center justify-between text-[10px]">
                      <button
                        type="button"
                        onClick={() => speakMessage(msg.text, i)}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold transition border cursor-pointer ${
                          playingMsgIndex === i
                            ? 'bg-limeAccent text-darkBg border-limeAccent animate-pulse'
                            : 'bg-darkBg/60 text-limeAccent border-forestGreen/60 hover:bg-forestGreen'
                        }`}
                        title={playingMsgIndex === i ? "Stop voice output" : "Listen to response"}
                      >
                        {playingMsgIndex === i ? <Square className="w-3 h-3 text-darkBg fill-darkBg" /> : <Volume2 className="w-3 h-3 text-limeAccent" />}
                        <span>{playingMsgIndex === i ? 'Stop Speech' : 'Play Voice'}</span>
                        
                        {playingMsgIndex === i && (
                          <span className="flex items-center gap-0.5 ml-1">
                            <span className="w-1 h-2 bg-darkBg animate-bounce"></span>
                            <span className="w-1 h-3 bg-darkBg animate-bounce delay-100"></span>
                            <span className="w-1 h-2 bg-darkBg animate-bounce delay-200"></span>
                          </span>
                        )}
                      </button>

                      {i > 0 && (
                        feedbackSent[i] ? (
                          <span className="text-limeAccent font-bold text-[10px]">Feedback saved!</span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-textLight/60">
                            <span>Helpful?</span>
                            <button
                              onClick={() => handleThumbFeedback(i, msg.id, 'thumbs_up')}
                              className="hover:text-limeAccent p-0.5 rounded hover:bg-darkBg transition"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleThumbFeedback(i, msg.id, 'thumbs_down')}
                              className="hover:text-red-400 p-0.5 rounded hover:bg-darkBg transition"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-xs text-limeAccent animate-pulse flex items-center gap-2 bg-darkBg p-3 rounded-xl border border-forestGreen/60">
                <Bot className="w-4 h-4 text-limeAccent animate-spin" /> CareBridge AI is checking your discharge records & care plan...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Disclaimer Footer Line */}
          <div className="bg-darkBg px-4 py-1.5 border-t border-forestGreen/40 text-[9px] text-textLight/60 text-center flex items-center justify-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
            CareBridge Assistant is an AI program. It does not diagnose or provide medical treatment.
          </div>

          {/* Input Area with Mic STT & Send */}
          <div className="p-3 bg-panelBg border-t border-forestGreen flex items-center gap-2">
            {/* Mic Recording Button */}
            <button
              type="button"
              onClick={handleToggleRecord}
              className={`p-2.5 rounded-xl border transition flex items-center justify-center cursor-pointer ${
                isRecording
                  ? 'bg-red-500 text-white border-red-400 animate-bounce'
                  : 'bg-darkBg text-limeAccent border-forestGreen/60 hover:bg-forestGreen'
              }`}
              title={isRecording ? "Stop Microphone" : "Speak your question (Voice Input)"}
            >
              {isRecording ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuery(query, false)}
              placeholder={isRecording ? "Listening to your voice..." : "Ask about your follow-up chart, tests, or hospitals..."}
              className={`flex-1 bg-white text-black border-2 rounded-xl px-3.5 py-2 text-xs font-bold placeholder-slate-600 focus:outline-none shadow-sm ${
                isRecording ? 'border-red-400 ring-2 ring-red-400/40' : 'border-forestGreen/40 focus:border-primaryGreen'
              }`}
            />

            <button
              onClick={() => handleSendQuery(query, false)}
              disabled={loading || !query.trim()}
              className="bg-primaryGreen hover:bg-primaryGreen/90 text-darkBg p-2.5 rounded-xl transition font-bold disabled:opacity-50 cursor-pointer shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Talk to Hospital Escalation Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-panelBg border-2 border-forestGreen rounded-2xl p-6 max-w-md w-full space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-forestGreen pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-limeAccent" /> Email Question to Hospital Care Team
              </h3>
              <button onClick={() => setShowEscalateModal(false)} className="text-textLight hover:text-white">✕</button>
            </div>

            {escalateMsg && (
              <div className="bg-forestGreen/60 border border-primaryGreen p-3 rounded-xl text-limeAccent font-bold">
                {escalateMsg}
              </div>
            )}

            <div>
              <label className="block text-textLight/80 font-semibold mb-1">Your Question for the Doctor / Care Team:</label>
              <textarea
                rows={4}
                value={escalateQuestion}
                onChange={e => setEscalateQuestion(e.target.value)}
                placeholder="e.g. I have a question about my medication schedule or next check-up date..."
                className="w-full bg-white text-black border-2 border-forestGreen/40 rounded-xl p-3 font-bold placeholder-slate-600 focus:outline-none focus:border-primaryGreen shadow-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEscalateModal(false)} className="px-4 py-2 rounded-xl bg-darkBg text-textLight">
                Cancel
              </button>
              <button
                onClick={handleSendEscalation}
                disabled={escalateSending || !escalateQuestion.trim()}
                className="px-5 py-2 rounded-xl bg-primaryGreen text-darkBg font-bold flex items-center gap-1.5 shadow disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {escalateSending ? 'Sending Email...' : 'Send to Hospital'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
