import Image from "next/image";
import Link from "next/link";

export default function About() {
  return (
    <main className="main">
      {/* Page Title */}
      <div className="page-title">
        <div className="breadcrumbs">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link href="/"><i className="bi bi-house"></i> Home</Link></li>
              <li className="breadcrumb-item"><a href="#">Category</a></li>
              <li className="breadcrumb-item active current">About</li>
            </ol>
          </nav>
        </div>

        <div className="title-wrapper">
          <h1>About Sehati</h1>
          <p>Sehati is committed to revolutionizing diabetes care through advanced AI detection and smart sensing capabilities.</p>
        </div>
      </div>

      {/* About Section */}
      <section id="about" className="about section">
        <div className="container" data-aos="fade-up" data-aos-delay="100">
          <div className="row gy-4">
            <div className="col-lg-6">
              <div className="content">
                <h2>Committed to Excellence in Healthcare AI</h2>
                <p>
                  At Sehati, we combine state-of-the-art computer vision models with deep medical expertise to provide non-invasive, highly accurate diabetes detection and monitoring.
                </p>
                <p>
                  Our goal is to shift the paradigm from reactive to proactive care, enabling continuous, comfortable, and reliable monitoring for families worldwide.
                </p>

                <div className="stats-container" data-aos="fade-up" data-aos-delay="200">
                  <div className="row gy-4">
                    <div className="col-sm-6 col-lg-12 col-xl-6">
                      <div className="stat-item">
                        <div className="stat-number">
                          <span data-purecounter-start="0" data-purecounter-end="25" data-purecounter-duration="1" className="purecounter"></span>+
                        </div>
                        <div className="stat-label">Years of Combined Expertise</div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-lg-12 col-xl-6">
                      <div className="stat-item">
                        <div className="stat-number">
                          <span data-purecounter-start="0" data-purecounter-end="50000" data-purecounter-duration="2" className="purecounter"></span>+
                        </div>
                        <div className="stat-label">Patients Monitored</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cta-buttons" data-aos="fade-up" data-aos-delay="300">
                  <Link href="/doctors" className="btn-primary">Meet Our Experts</Link>
                  <Link href="/services" className="btn-secondary">View Our Tech</Link>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="image-section" data-aos="fade-left" data-aos-delay="200">
                <div className="main-image">
                  <Image src="/assets/img/health/consultation-3.webp" alt="Healthcare consultation" width={600} height={400} className="img-fluid" />
                </div>
                <div className="image-grid">
                  <div className="grid-item">
                    <Image src="/assets/img/health/facilities-2.webp" alt="Medical facility" width={300} height={200} className="img-fluid" />
                  </div>
                  <div className="grid-item">
                    <Image src="/assets/img/health/staff-5.webp" alt="Medical staff" width={300} height={200} className="img-fluid" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="certifications-section" data-aos="fade-up" data-aos-delay="400">
            <div className="row">
              <div className="col-lg-12">
                <div className="section-header">
                  <h3>Accreditations &amp; Certifications</h3>
                  <p>We are proud to be accredited by leading healthcare and AI regulatory organizations</p>
                </div>
                <div className="certifications-grid">
                  <div className="certification-item">
                    <Image src="/assets/img/clients/clients-1.webp" alt="JCI Accreditation" width={120} height={60} className="img-fluid" />
                  </div>
                  <div className="certification-item">
                    <Image src="/assets/img/clients/clients-2.webp" alt="NABH Certification" width={120} height={60} className="img-fluid" />
                  </div>
                  <div className="certification-item">
                    <Image src="/assets/img/clients/clients-3.webp" alt="ISO 9001" width={120} height={60} className="img-fluid" />
                  </div>
                  <div className="certification-item">
                    <Image src="/assets/img/clients/clients-4.webp" alt="CAP Accreditation" width={120} height={60} className="img-fluid" />
                  </div>
                  <div className="certification-item">
                    <Image src="/assets/img/clients/clients-5.webp" alt="Medical Board" width={120} height={60} className="img-fluid" />
                  </div>
                  <div className="certification-item">
                    <Image src="/assets/img/clients/clients-6.webp" alt="Healthcare Association" width={120} height={60} className="img-fluid" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
