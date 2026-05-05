"use client";

import Link from "next/link";

export default function FAQ() {
  const toggleFaq = (e: React.MouseEvent<HTMLDivElement>) => {
    const item = e.currentTarget.parentNode as HTMLElement;
    item.classList.toggle("faq-active");
  };

  return (
    <main className="main">
      {/* Page Title */}
      <div className="page-title position-relative">
        <div className="breadcrumbs">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link href="/"><i className="bi bi-house"></i> Home</Link></li>
              <li className="breadcrumb-item"><Link href="#">Category</Link></li>
              <li className="breadcrumb-item active current">Frequently Asked Questions</li>
            </ol>
          </nav>
        </div>

        <div className="title-wrapper">
          <h1>Frequently Asked Questions</h1>
          <p>Find answers to common questions regarding Sehati&apos;s AI-powered diabetes detection platform.</p>
        </div>
      </div>

      {/* Faq Section */}
      <section id="faq" className="faq section">
        <div className="container" data-aos="fade-up" data-aos-delay="100">
          <div className="row gy-5">
            <div className="col-lg-6" data-aos="zoom-out" data-aos-delay="200">
              <div className="faq-contact-card">
                <div className="card-icon">
                  <i className="bi bi-question-circle"></i>
                </div>
                <div className="card-content">
                  <h3>Still Have Questions?</h3>
                  <p>Our dedicated medical support team is ready to answer any questions about our biometrics technology and proactive care plans.</p>
                  <div className="contact-options">
                    <Link href="mailto:info@sehati.com" className="contact-option">
                      <i className="bi bi-envelope"></i>
                      <span>Email Support</span>
                    </Link>
                    <Link href="#" className="contact-option">
                      <i className="bi bi-chat-dots"></i>
                      <span>Live Chat</span>
                    </Link>
                    <Link href="tel:+15551234567" className="contact-option">
                      <i className="bi bi-telephone"></i>
                      <span>Call Us</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6" data-aos="fade-up" data-aos-delay="300">
              <div className="faq-accordion">
                <div className="faq-item faq-active">
                  <div className="faq-header" onClick={toggleFaq} style={{ cursor: 'pointer' }}>
                    <h3>How does Sehati&apos;s AI detection work?</h3>
                    <i className="bi bi-chevron-down faq-toggle"></i>
                  </div>
                  <div className="faq-content">
                    <p>
                      Sehati leverages state-of-the-art computer vision models and non-invasive biometrics to monitor vital signs continuously, predicting onset and managing diabetes highly accurately.
                    </p>
                  </div>
                </div>{/* End FAQ Item */}

                <div className="faq-item" data-aos="zoom-in" data-aos-delay="200">
                  <div className="faq-header" onClick={toggleFaq} style={{ cursor: 'pointer' }}>
                    <h3>Is the detection process safe and non-invasive?</h3>
                    <i className="bi bi-chevron-down faq-toggle"></i>
                  </div>
                  <div className="faq-content">
                    <p>
                      Yes, our process is entirely non-invasive. We use advanced sensors and smart technologies rather than traditional blood tests, ensuring maximum comfort and safety for our patients.
                    </p>
                  </div>
                </div>{/* End FAQ Item */}

                <div className="faq-item">
                  <div className="faq-header" onClick={toggleFaq} style={{ cursor: 'pointer' }}>
                    <h3>Can I connect Sehati to my smart devices?</h3>
                    <i className="bi bi-chevron-down faq-toggle"></i>
                  </div>
                  <div className="faq-content">
                    <p>
                      Absolutely. Sehati seamlessly integrates with major smart health devices like Samsung Health and Apple Health to provide a unified, continuous monitoring dashboard.
                    </p>
                  </div>
                </div>{/* End FAQ Item */}

                <div className="faq-item">
                  <div className="faq-header" onClick={toggleFaq} style={{ cursor: 'pointer' }}>
                    <h3>Are the AI diagnostics medically certified?</h3>
                    <i className="bi bi-chevron-down faq-toggle"></i>
                  </div>
                  <div className="faq-content">
                    <p>
                      Yes. Our platform has been rigorously tested in clinical trials and holds certifications from major health authorities including NABH and ISO 9001.
                    </p>
                  </div>
                </div>{/* End FAQ Item */}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
