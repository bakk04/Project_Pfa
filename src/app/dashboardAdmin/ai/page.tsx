'use client';

import React from 'react';
import Link from 'next/link';

const AIToolsPage = () => {
  const tools = [
    { title: 'Shati AI Assistant', desc: 'Advanced clinical diagnosis support and patient data analysis.', icon: 'ph-duotone ph-sparkle', color: 'bg-primary', href: '/dashboardAdmin/ai/chat' },
    { title: 'Medical Report Generator', desc: 'Automatically generate detailed patient reports from health data.', icon: 'ph-duotone ph-file-text', color: 'bg-blue-500', href: '#' },
    { title: 'System Analytics AI', desc: 'Deep insights into system performance and usage patterns.', icon: 'ph-duotone ph-chart-line-up', color: 'bg-orange-500', href: '/dashboardAdmin' },
    { title: 'Clinical Settings', desc: 'Configure Shati AI parameters and medical thresholds.', icon: 'ph-duotone ph-gear-six', color: 'bg-purple-500', href: '#' },
  ];

  return (
    <>
      <div className="flex items-center justify-between flex-wrap page-breadcrumb gap-3 mb-6">
        <div className="my-auto">
          <h3 className="text-xl font-bold">Shati AI Integration Hub</h3>
          <p className="text-sm text-gray-500">Manage and deploy intelligent medical modules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tools.map((tool, index) => (
          <div key={index} className="bg-white rounded-xl border border-border-color p-6 hover:shadow-xl transition-all duration-300 group">
            <div className={`size-14 rounded-2xl ${tool.color} text-white flex items-center justify-center mb-5 shadow-lg shadow-${tool.color.split('-')[1]}/20 group-hover:scale-110 transition-transform`}>
              <i className={`${tool.icon} text-3xl`}></i>
            </div>
            <h5 className="font-bold text-lg mb-2 text-gray-900">{tool.title}</h5>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">{tool.desc}</p>
            <Link href={tool.href} className="text-primary font-bold text-sm inline-flex items-center group-hover:gap-2 transition-all">
              Launch Module <i className="ph ph-arrow-right ms-1"></i>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-primary-gradient rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl shadow-primary/20">
        <div className="relative z-10 max-w-2xl">
          <h4 className="text-2xl font-bold mb-3">Enterprise-Grade AI Security</h4>
          <p className="text-white/80 mb-6">Shati AI uses state-of-the-art encryption and follows strict HIPAA/GDPR compliance for all medical data processing. Your patient data never leaves the secure clinical environment.</p>
          <button className="bg-white text-primary font-bold px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors shadow-lg">Learn about Security Architecture</button>
        </div>
        <div className="absolute right-[-50px] bottom-[-50px] opacity-10 rotate-12">
            <i className="ph-duotone ph-shield-check text-[300px]"></i>
        </div>
      </div>
    </>
  );
};

export default AIToolsPage;
