import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "I'm your CRM assistant. I can help with visit planning, HCP insights, performance metrics, campaign management, and compliance questions.\n\nNote: I cannot provide medical advice or treatment recommendations. For clinical questions, please consult Medical Affairs.\n\nWhat can I help you with?",
    },
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await aiApi.sendCopilotMessage({
        conversationId: conversationId || undefined,
        message,
      });
      return data.data as { conversationId: string; response: string; metadata: Record<string, unknown> };
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMessage.isPending) return;
    const message = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    sendMessage.mutate(message);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI Copilot</h1>
          <p className="text-sm text-gray-500">
            CRM assistant — engagement strategies, visit planning, analytics
          </p>
        </div>
        <div className="text-xs text-gray-400">
          Powered by AI | No medical claims
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto card mb-4 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-pharma-blue text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about HCPs, visits, performance, campaigns..."
          className="input-field flex-1"
          disabled={sendMessage.isPending}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMessage.isPending}
          className="btn-primary"
        >
          Send
        </button>
      </div>
    </div>
  );
}
