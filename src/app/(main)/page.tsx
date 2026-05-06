import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="main">
      {/* Preload the hero video for better performance */}
      <link rel="preload" href="https://res.cloudinary.com/dr2fjkaye/video/upload/q_auto,f_auto/v1778071051/vid.mp4" as="video" type="video/mp4" />
      
      {/* Hero Section */}
      <section id="hero" className="hero section dark-background">
        <div className="container-fluid p-0">
          <div className="hero-wrapper">
            <div className="hero-image">
              <video
                className="img-fluid"
                width="100%"
                height="auto"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                poster="/assets/img/health/showcase-1.webp"
                style={{ objectFit: 'cover' }}
              >
                <source src="https://res.cloudinary.com/dr2fjkaye/video/upload/q_auto,f_auto/v1778071051/vid.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="hero-content">
              <div className="container">
                <div className="row">
                  <div className="col-lg-7 col-md-10" data-aos="fade-right" data-aos-delay="100">
                    <div className="content-box">
                      <span className="badge-accent" data-aos="fade-up" data-aos-delay="150">Leading Healthcare Specialists</span>
                      <h1 data-aos="fade-up" data-aos-delay="200">Advanced AI-Powered Diabetes Care</h1>
                      <p data-aos="fade-up" data-aos-delay="250">Sehati is a state-of-the-art smart AI-powered diabetes detection platform, revolutionizing family health care through advanced diagnostics.</p>

                      <div className="cta-group" data-aos="fade-up" data-aos-delay="300">
                        <Link href="/appointment" className="btn btn-primary">Book Appointment</Link>
                        <Link href="/services" className="btn btn-outline">Explore Services</Link>
                      </div>

                      <div className="info-badges" data-aos="fade-up" data-aos-delay="350">
                        <div className="badge-item">
                          <i className="bi bi-telephone-fill"></i>
                          <div className="badge-content">
                            <span>Emergency Line</span>
                            <strong>+1 (555) 987-6543</strong>
                          </div>
                        </div>
                        <div className="badge-item">
                          <i className="bi bi-clock-fill"></i>
                          <div className="badge-content">
                            <span>Working Hours</span>
                            <strong>Mon-Fri: 8AM-8PM</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="features-wrapper">
                  <div className="row gy-4">
                    <div className="col-lg-4">
                      <div className="feature-item" data-aos="fade-up" data-aos-delay="450">
                        <div className="feature-icon">
                          <i className="bi bi-heart-pulse-fill"></i>
                        </div>
                        <div className="feature-text">
                          <h3>AI Diagnostics</h3>
                          <p>Cutting-edge artificial intelligence for early detection and continuous monitoring.</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-lg-4">
                      <div className="feature-item" data-aos="fade-up" data-aos-delay="500">
                        <div className="feature-icon">
                          <i className="bi bi-lungs-fill"></i>
                        </div>
                        <div className="feature-text">
                          <h3>Smart Sensing</h3>
                          <p>Non-invasive biometrics using state-of-the-art computer vision models.</p>
                        </div>
                      </div>
                    </div>

                    <div className="col-lg-4">
                      <div className="feature-item" data-aos="fade-up" data-aos-delay="550">
                        <div className="feature-icon">
                          <i className="bi bi-capsule"></i>
                        </div>
                        <div className="feature-text">
                          <h3>Personalized Care</h3>
                          <p>Tailored treatment plans based on continuous, high-precision data analysis.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Home About Section */}
      <section id="home-about" className="home-about section">
        <div className="container" data-aos="fade-up" data-aos-delay="100">
          <div className="row gy-5 align-items-center">
            <div className="col-lg-6" data-aos="fade-right" data-aos-delay="200">
              <div className="about-image">
                <Image src="/assets/img/health/facilities-1.webp" alt="Modern Healthcare Facility" width={800} height={600} className="img-fluid rounded-3 mb-4" />
                <div className="experience-badge">
                  <span className="years">25+</span>
                  <span className="text">Years of Excellence</span>
                </div>
              </div>
            </div>

            <div className="col-lg-6" data-aos="fade-left" data-aos-delay="300">
              <div className="about-content">
                <h2>Committed to Exceptional Patient Care</h2>
                <p className="lead">Sehati leads the transition from reactive treatments to proactive, smart AI monitoring.</p>

                <p>We combine deep medical expertise with bleeding-edge technology to offer reliable, fast, and comfortable diabetes detection tools.</p>

                <div className="row g-4 mt-4">
                  <div className="col-md-6" data-aos="fade-up" data-aos-delay="400">
                    <div className="feature-item">
                      <div className="icon">
                        <i className="bi bi-heart-pulse"></i>
                      </div>
                      <h4>Compassionate Care</h4>
                      <p>Combining state-of-the-art tech with a human touch.</p>
                    </div>
                  </div>

                  <div className="col-md-6" data-aos="fade-up" data-aos-delay="500">
                    <div className="feature-item">
                      <div className="icon">
                        <i className="bi bi-star"></i>
                      </div>
                      <h4>Medical Excellence</h4>
                      <p>Validated by rigorous clinical trials and medical experts.</p>
                    </div>
                  </div>
                </div>

                <div className="cta-wrapper mt-4">
                  <Link href="/about" className="btn btn-primary">Learn More About Us</Link>
                  <Link href="/doctors" className="btn btn-outline">Meet Our Team</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-5 pt-4 certifications-row" data-aos="fade-up" data-aos-delay="600">
            <div className="col-12 text-center mb-4">
              <h4 className="certification-title">Our Accreditations</h4>
            </div>
            <div className="col-12">
              <div className="certifications">
                <div className="certification-item" data-aos="zoom-in" data-aos-delay="700">
                  <Image src="/assets/img/clients/clients-1.webp" alt="Certification" width={120} height={60} />
                </div>
                <div className="certification-item" data-aos="zoom-in" data-aos-delay="800">
                  <Image src="/assets/img/clients/clients-2.webp" alt="Certification" width={120} height={60} />
                </div>
                <div className="certification-item" data-aos="zoom-in" data-aos-delay="900">
                  <Image src="/assets/img/clients/clients-3.webp" alt="Certification" width={120} height={60} />
                </div>
                <div className="certification-item" data-aos="zoom-in" data-aos-delay="1000">
                  <Image src="/assets/img/clients/clients-4.webp" alt="Certification" width={120} height={60} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Departments Section */}
      <section id="featured-departments" className="featured-departments section">
        <div className="container section-title" data-aos="fade-up">
          <h2>Featured Departments</h2>
          <p>Explore our advanced specialized medical departments powered by AI.</p>
        </div>

        <div className="container" data-aos="fade-up" data-aos-delay="100">
          <div className="row gy-4">
            {/* Card 1 */}
            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="100">
              <div className="department-card">
                <div className="department-image">
                  <Image src="/assets/img/health/cardiology-3.webp" alt="Cardiology Department" width={600} height={400} className="img-fluid" />
                </div>
                <div className="department-content">
                  <div className="department-icon">
                    <i className="fas fa-heartbeat"></i>
                  </div>
                  <h3>Cardiology</h3>
                  <p>Comprehensive cardiovascular care with advanced diagnostic techniques and treatment options for heart conditions.</p>
                  <Link href="/department-details" className="btn-learn-more">
                    <span>Learn More</span>
                    <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="200">
              <div className="department-card">
                <div className="department-image">
                  <Image src="/assets/img/health/neurology-2.webp" alt="Neurology Department" width={600} height={400} className="img-fluid" />
                </div>
                <div className="department-content">
                  <div className="department-icon">
                    <i className="fas fa-brain"></i>
                  </div>
                  <h3>Neurology</h3>
                  <p>Expert neurological care specializing in brain and nervous system disorders, providing cutting-edge treatments.</p>
                  <Link href="/department-details" className="btn-learn-more">
                    <span>Learn More</span>
                    <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="300">
              <div className="department-card">
                <div className="department-image">
                  <Image src="/assets/img/health/orthopedics-4.webp" alt="Orthopedics Department" width={600} height={400} className="img-fluid" />
                </div>
                <div className="department-content">
                  <div className="department-icon">
                    <i className="fas fa-bone"></i>
                  </div>
                  <h3>Orthopedics</h3>
                  <p>Advanced musculoskeletal care focusing on bones, joints, and muscles with innovative surgical approaches.</p>
                  <Link href="/department-details" className="btn-learn-more">
                    <span>Learn More</span>
                    <i className="fas fa-arrow-right"></i>
                  </Link>
                </div>
              </div>
            </div>
            {/* Can add more if needed */}
          </div>
        </div>
      </section>

      {/* Call To Action Section */}
      <section id="call-to-action" className="call-to-action section">
        <div className="container" data-aos="fade-up" data-aos-delay="100">
          <div className="row justify-content-center">
            <div className="col-lg-8 text-center">
              <h2 data-aos="fade-up" data-aos-delay="200">Your Health is Our Priority</h2>
              <p data-aos="fade-up" data-aos-delay="250">Join Sehati today and take control of your health using state-of-the-art AI diagnostics and continuous monitoring.</p>
              <div className="cta-buttons" data-aos="fade-up" data-aos-delay="300">
                <Link href="/appointment" className="btn-primary">Book Appointment</Link>
                <Link href="/doctors" className="btn-secondary">Find a Doctor</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
