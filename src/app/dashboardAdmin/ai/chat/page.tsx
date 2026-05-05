'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const initialMessages = [
  { id: 1, text: "Hello! I am Shati AI, your advanced medical assistant. How can I assist you with clinical data or system analytics today?", sender: 'AI' },
];

const ShatiAIChatPage = () => {
  const { data: session } = useSession();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { id: Date.now(), text: input, sender: 'User' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // In a real production app, you would fetch from your AI API here:
    // const response = await fetch('/api/ai/shati', { method: 'POST', body: JSON.stringify({ message: input }) });
    
    // Simulating Shati AI response
    setTimeout(() => {
      let aiResponse = "I am processing your request regarding clinical analytics.";
      
      if (input.toLowerCase().includes('patient')) {
        aiResponse = "Currently, there are 1,284 patients registered. 452 are active within the last 24 hours.";
      } else if (input.toLowerCase().includes('test')) {
        aiResponse = "A total of 8,492 tests have been performed. The system success rate is currently 99.9%.";
      } else if (input.toLowerCase().includes('status')) {
        aiResponse = "All systems are operational. Average processing time is 124ms.";
      }

      const aiMsg = { 
        id: Date.now() + 1, 
        text: aiResponse, 
        sender: 'AI' 
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">Shati AI <span className="text-xs font-normal text-gray-500 ms-2">Production Assistant</span></h3>
      </div>

      <div className="bg-white rounded-xl border border-border-color h-[calc(100vh-250px)] flex flex-col shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-border-color bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <i className="ph-duotone ph-sparkle text-xl"></i>
            </div>
            <div>
              <h6 className="font-bold text-gray-900">Shati AI</h6>
              <div className="flex items-center gap-1.5">
                <span className="size-2 bg-success rounded-full animate-pulse"></span>
                <p className="text-[10px] font-semibold text-success uppercase tracking-wider">Operational</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><i className="ph ph-phone"></i></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><i className="ph ph-video-camera"></i></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><i className="ph ph-dots-three-vertical"></i></button>
          </div>
        </div>

        {/* Chat Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'User' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex flex-col max-w-[80%]">
                <div className={`p-4 rounded-2xl shadow-sm ${
                  msg.sender === 'User' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white border border-border-color text-gray-800 rounded-tl-none'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
                <span className={`text-[10px] text-gray-400 mt-1.5 ${msg.sender === 'User' ? 'text-right' : 'text-left'}`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-border-color p-3 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1">
                  <span className="size-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                  <span className="size-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="size-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-border-color bg-white">
          <div className="flex items-center gap-3">
            <button className="p-2 text-gray-400 hover:text-primary transition-colors">
              <i className="ph-bold ph-plus-circle text-2xl"></i>
            </button>
            <div className="relative flex-1">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Shati AI anything about the medical system..." 
                className="w-full ps-4 pe-12 py-3 bg-gray-50 border border-border-color rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className={`absolute end-1.5 top-1/2 -translate-y-1/2 size-9 rounded-lg flex items-center justify-center transition-all ${
                  input.trim() ? 'bg-primary text-white hover:bg-primary-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <i className="ph-bold ph-paper-plane-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShatiAIChatPage;
