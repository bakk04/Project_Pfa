"use client";

import React from 'react';
import Link from 'next/link';
import { Activity, Cpu, Heart, BarChart3, ShieldCheck, Zap } from 'lucide-react';

export default function ServicesPage() {
  const services = [
    {
      title: "SEHATI AI System",
      description: "Advanced artificial intelligence algorithms that analyze your health data in real-time to provide personalized insights and early detection of potential health risks.",
      icon: <Cpu className="service-icon" size={40} />,
      color: "blue"
    },
    {
      title: "rPPG Monitoring",
      description: "Non-contact vital signs monitoring using remote photoplethysmography. Measure heart rate, oxygen levels, and stress through your smartphone camera.",
      icon: <Heart className="service-icon" size={40} />,
      color: "red"
    },
    {
      title: "Diabetes Prediction",
      description: "State-of-the-art predictive modeling for diabetes risk assessment. Our system analyzes metabolic markers to provide high-accuracy risk profiles.",
      icon: <Activity className="service-icon" size={40} />,
      color: "green"
    },
    {
      title: "Health Analytics",
      description: "Comprehensive health reporting and trend analysis. Visualize your progress with intuitive dashboards and medical-grade data exports.",
      icon: <BarChart3 className="service-icon" size={40} />,
      color: "orange"
    },
    {
        title: "Medical Proxy",
        description: "Instant access to a network of specialized diabetes doctors near you. Get connected with the right experts when you need them most.",
        icon: <ShieldCheck className="service-icon" size={40} />,
        color: "teal"
    },
    {
        title: "Real-time Alerts",
        description: "Intelligent alert system that notifies you of significant changes in your vitals, ensuring timely intervention and peace of mind.",
        icon: <Zap className="service-icon" size={40} />,
        color: "purple"
    }
  ];

  return (
    <main className="main">
      {/* Page Title */}
      <div className="page-title" style={{ backgroundColor: '#f8f9fa', padding: '120px 0 60px 0' }}>
        <div className="container">
          <h1 className="display-4 font-bold text-slate-800">Our Services</h1>
          <nav className="breadcrumbs">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link href="/">Home</Link></li>
              <li className="breadcrumb-item active">Services</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Services Section */}
      <section id="services" className="services section py-5">
        <div className="container">
          <div className="row gy-4">
            {services.map((service, index) => (
              <div key={index} className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay={index * 100}>
                <div className="service-item item-blue position-relative p-5 rounded-4 border bg-white shadow-sm hover-shadow-lg transition-all h-100">
                  <div className={`icon mb-4 text-${service.color}`}>
                    {service.icon}
                  </div>
                  <Link href="#" className="stretched-link text-decoration-none">
                    <h3 className="font-bold text-slate-800 mb-3">{service.title}</h3>
                  </Link>
                  <p className="text-slate-600 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="why-us section py-5 bg-slate-50">
        <div className="container">
          <div className="row justify-content-center text-center mb-5">
            <div className="col-lg-8">
              <h2 className="font-bold text-slate-900 mb-3">The SEHATI Advantage</h2>
              <p className="text-slate-500">Integrating cutting-edge AI with medical expertise to provide the best health monitoring experience.</p>
            </div>
          </div>
          <div className="row gy-4">
             <div className="col-lg-4">
                <div className="p-4 bg-white rounded-4 shadow-sm h-100 border-t-4 border-primary">
                    <h4 className="font-bold mb-3">Enterprise Security</h4>
                    <p className="text-sm text-slate-500">Your health data is encrypted and stored with the highest security standards, ensuring complete privacy.</p>
                </div>
             </div>
             <div className="col-lg-4">
                <div className="p-4 bg-white rounded-4 shadow-sm h-100 border-t-4 border-primary">
                    <h4 className="font-bold mb-3">Clinical Accuracy</h4>
                    <p className="text-sm text-slate-500">Our AI models are trained on large clinical datasets and validated by medical professionals for superior accuracy.</p>
                </div>
             </div>
             <div className="col-lg-4">
                <div className="p-4 bg-white rounded-4 shadow-sm h-100 border-t-4 border-primary">
                    <h4 className="font-bold mb-3">User-Centric Design</h4>
                    <p className="text-sm text-slate-500">Simple, intuitive interfaces designed for all age groups, making health monitoring accessible to everyone.</p>
                </div>
             </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .hover-shadow-lg:hover {
          transform: translateY(-5px);
          box-shadow: 0 1rem 3rem rgba(0,0,0,.1) !important;
        }
        .service-item {
          border: 1px solid #eee;
        }
        .text-blue { color: #007bff; }
        .text-red { color: #dc3545; }
        .text-green { color: #28a745; }
        .text-orange { color: #fd7e14; }
        .text-teal { color: #20c997; }
        .text-purple { color: #6f42c1; }
      `}</style>
    </main>
  );
}
