'use client';

import { useState } from "react";
import Link from "next/link";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      
      // Reset to idle after 5 seconds
      setTimeout(() => setStatus('idle'), 5000);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
      // Reset to idle after 5 seconds
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <main className="main">
      <style jsx>{`
        .btn-submit {
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          color: white;
          width: 100%;
        }

        .btn-idle { background-color: #3B82F6; }
        .btn-loading { background-color: #94a3b8; cursor: wait; }
        .btn-success { background-color: #10b981; transform: scale(1.02); }
        .btn-error { background-color: #ef4444; }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @keyframes successPop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        .success-icon {
          animation: successPop 0.5s ease-out forwards;
        }
      `}</style>

      {/* Page Title */}
      <div className="page-title">
        <div className="breadcrumbs">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link href="/"><i className="bi bi-house"></i> Home</Link></li>
              <li className="breadcrumb-item"><a href="#">Category</a></li>
              <li className="breadcrumb-item active current">Contact</li>
            </ol>
          </nav>
        </div>

        <div className="title-wrapper">
          <h1>Contact</h1>
          <p>Get in touch with Sehati for any inquiries regarding our AI-powered diabetes detection platform.</p>
        </div>
      </div>

      {/* Contact Section */}
      <section id="contact" className="contact section">
        <div className="container">
          <div className="contact-wrapper">
            <div className="contact-info-panel">
              <div className="contact-info-header">
                <h3>Contact Information</h3>
                <p>We are available to answer your questions and help you set up our smart sensing diagnostics.</p>
              </div>

              <div className="contact-info-cards">
                <div className="info-card">
                  <div className="icon-container">
                    <i className="bi bi-pin-map-fill"></i>
                  </div>
                  <div className="card-content">
                    <h4>Our Location</h4>
                    <p>Rabat, Morocco</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="icon-container">
                    <i className="bi bi-envelope-open"></i>
                  </div>
                  <div className="card-content">
                    <h4>Email Us</h4>
                    <p>info@sehati.com</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="icon-container">
                    <i className="bi bi-telephone-fill"></i>
                  </div>
                  <div className="card-content">
                    <h4>Call Us</h4>
                    <p>+212 (5) 123-4567</p>
                  </div>
                </div>

                <div className="info-card">
                  <div className="icon-container">
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <div className="card-content">
                    <h4>Working Hours</h4>
                    <p>Monday-Saturday: 9AM - 7PM</p>
                  </div>
                </div>
              </div>

              <div className="social-links-panel">
                <h5>Follow Us</h5>
                <div className="social-icons">
                  <a href="#"><i className="bi bi-facebook"></i></a>
                  <a href="#"><i className="bi bi-twitter-x"></i></a>
                  <a href="#"><i className="bi bi-instagram"></i></a>
                  <a href="#"><i className="bi bi-linkedin"></i></a>
                  <a href="#"><i className="bi bi-youtube"></i></a>
                </div>
              </div>
            </div>

            <div className="contact-form-panel">
              <div className="map-container">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3306.44222!2d-6.84165!3d34.020882!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda76b87194f4c7d%3A0x6b63d9a1501c0c66!2sRabat%2C%20Morocco!5e0!3m2!1sen!2sma!4v1676961268712!5m2!1sen!2sma" 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen={true} 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>

              <div className="form-container">
                <h3>Send Us a Message</h3>
                <p>Fill out the form below to reach our medical experts and AI diagnostic engineers.</p>

                <form onSubmit={handleSubmit} className="php-email-form">
                  <div className="form-floating mb-3">
                    <input 
                      type="text" 
                      className="form-control" 
                      id="nameInput" 
                      name="name" 
                      placeholder="Full Name" 
                      value={formData.name}
                      onChange={handleChange}
                      required 
                    />
                    <label htmlFor="nameInput">Full Name</label>
                  </div>

                  <div className="form-floating mb-3">
                    <input 
                      type="email" 
                      className="form-control" 
                      id="emailInput" 
                      name="email" 
                      placeholder="Email Address" 
                      value={formData.email}
                      onChange={handleChange}
                      required 
                    />
                    <label htmlFor="emailInput">Email Address</label>
                  </div>

                  <div className="form-floating mb-3">
                    <input 
                      type="text" 
                      className="form-control" 
                      id="subjectInput" 
                      name="subject" 
                      placeholder="Subject" 
                      value={formData.subject}
                      onChange={handleChange}
                      required 
                    />
                    <label htmlFor="subjectInput">Subject</label>
                  </div>

                  <div className="form-floating mb-3">
                    <textarea 
                      className="form-control" 
                      id="messageInput" 
                      name="message" 
                      placeholder="Your Message" 
                      style={{ height: "150px" }} 
                      value={formData.message}
                      onChange={handleChange}
                      required
                    ></textarea>
                    <label htmlFor="messageInput">Your Message</label>
                  </div>

                  <div className="d-grid mt-4">
                    <button 
                      type="submit" 
                      disabled={status === 'loading'}
                      className={`btn-submit btn-${status}`}
                    >
                      {status === 'idle' && (
                        <>
                          <span>Send Message</span>
                          <i className="bi bi-send-fill"></i>
                        </>
                      )}
                      {status === 'loading' && (
                        <>
                          <div className="spinner"></div>
                          <span>Sending Inquiry...</span>
                        </>
                      )}
                      {status === 'success' && (
                        <>
                          <i className="bi bi-check-circle-fill success-icon"></i>
                          <span>Message Sent!</span>
                        </>
                      )}
                      {status === 'error' && (
                        <>
                          <i className="bi bi-exclamation-triangle-fill"></i>
                          <span>Failed to Send</span>
                        </>
                      )}
                    </button>
                    {status === 'error' && (
                      <p className="text-danger mt-2 small text-center">{errorMessage}</p>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
