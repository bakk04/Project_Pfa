import Link from "next/link";

export default function Footer() {
  return (
    <footer id="footer" className="footer position-relative light-background">
      <div className="container footer-top">
        <div className="row gy-4">
          <div className="col-lg-4 col-md-6 footer-about">
            <Link href="/" className="logo d-flex align-items-center">
              <span className="sitename">Sehati</span>
            </Link>
            <div className="footer-contact pt-3">
              <p>A108 Adam Street</p>
              <p>New York, NY 535022</p>
              <p className="mt-3"><strong>Phone:</strong> <span>+1 5589 55488 55</span></p>
              <p><strong>Email:</strong> <span>info@sehati.com</span></p>
            </div>
            <div className="social-links d-flex mt-4">
              <Link href="#"><i className="bi bi-twitter-x"></i></Link>
              <Link href="#"><i className="bi bi-facebook"></i></Link>
              <Link href="#"><i className="bi bi-instagram"></i></Link>
              <Link href="#"><i className="bi bi-linkedin"></i></Link>
            </div>
          </div>

          <div className="col-lg-2 col-md-3 footer-links">
            <h4>Useful Links</h4>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/about">About us</Link></li>
              <li><Link href="/services">Services</Link></li>
              <li><Link href="/terms">Terms of service</Link></li>
              <li><Link href="/privacy">Privacy policy</Link></li>
            </ul>
          </div>

          <div className="col-lg-2 col-md-3 footer-links">
            <h4>Our Services</h4>
            <ul>
              <li><Link href="#">Diabetes Detection</Link></li>
              <li><Link href="#">AI Diagnostics</Link></li>
              <li><Link href="#">Patient Monitoring</Link></li>
              <li><Link href="#">Telehealth</Link></li>
              <li><Link href="#">Consultation</Link></li>
            </ul>
          </div>

          <div className="col-lg-2 col-md-3 footer-links">
            <h4>Hic solutasetp</h4>
            <ul>
              <li><Link href="#">Molestiae accusamus iure</Link></li>
              <li><Link href="#">Excepturi dignissimos</Link></li>
              <li><Link href="#">Suscipit distinctio</Link></li>
              <li><Link href="#">Dilecta</Link></li>
              <li><Link href="#">Sit quas consectetur</Link></li>
            </ul>
          </div>

          <div className="col-lg-2 col-md-3 footer-links">
            <h4>Nobis illum</h4>
            <ul>
              <li><Link href="#">Ipsam</Link></li>
              <li><Link href="#">Laudantium dolorum</Link></li>
              <li><Link href="#">Dinera</Link></li>
              <li><Link href="#">Trodelas</Link></li>
              <li><Link href="#">Flexo</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container copyright text-center mt-4">
        <p>© <span>Copyright</span> <strong className="px-1 sitename">Sehati</strong> <span>All Rights Reserved</span></p>
        <div className="credits">
          Designed by <Link href="https://bootstrapmade.com/">BootstrapMade</Link>
        </div>
      </div>
    </footer>
  );
}
