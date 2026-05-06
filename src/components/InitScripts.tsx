'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    AOS: any;
    GLightbox: any;
    Swiper: any;
    Isotope: any;
    imagesLoaded: any;
    PureCounter: any;
  }
}

export default function InitScripts() {
  const pathname = usePathname();

  useEffect(() => {
    // We dynamically import AOS and Swiper from the window object (loaded via Script tags in layout)
    // or trigger a custom event that main.js listens to.
    
    // For AOS
    const initAOS = () => {
      if (typeof window !== 'undefined' && window.AOS) {
        window.AOS.init({
          duration: 600,
          easing: 'ease-in-out',
          once: true,
          mirror: false
        });
        window.AOS.refresh();
      }
    };

    initAOS();
    // Re-init after a short delay to ensure DOM is fully rendered
    const timer = setTimeout(initAOS, 500);
    const timerLong = setTimeout(initAOS, 2000);

    // For GLightbox
    if (typeof window !== 'undefined' && window.GLightbox) {
      window.GLightbox({
        selector: '.glightbox'
      });
    }

    // Swiper initialization (similar to main.js)
    if (typeof window !== 'undefined' && window.Swiper) {
      document.querySelectorAll(".init-swiper").forEach(function(swiperElement) {
        let configStr = swiperElement.querySelector(".swiper-config")?.innerHTML.trim();
        if (configStr) {
          let config = JSON.parse(configStr);
          if (swiperElement.classList.contains("swiper-tab")) {
            // custom pagination init if needed, usually just Swiper
            new window.Swiper(swiperElement, config);
          } else {
            new window.Swiper(swiperElement, config);
          }
        }
      });
    }

    // Isotope
    if (typeof window !== 'undefined' && window.Isotope && window.imagesLoaded) {
      document.querySelectorAll('.isotope-layout').forEach(function(isotopeItem) {
        let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
        let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
        let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

        let initIsotope: any;
        window.imagesLoaded(isotopeItem.querySelector('.isotope-container'), function() {
          initIsotope = new window.Isotope(isotopeItem.querySelector('.isotope-container'), {
            itemSelector: '.isotope-item',
            layoutMode: layout,
            filter: filter,
            sortBy: sort
          });
        });

        isotopeItem.querySelectorAll('.isotope-filters li').forEach(function(filters) {
          filters.addEventListener('click', function() {
            isotopeItem.querySelector('.isotope-filters .filter-active')?.classList.remove('filter-active');
            filters.classList.add('filter-active');
            if (initIsotope) {
              initIsotope.arrange({
                filter: filters.getAttribute('data-filter')
              });
            }
            if (typeof window.AOS !== 'undefined') {
              window.AOS.refresh();
            }
          }, false);
        });
      });
    }

    // PureCounter
    if (typeof window !== 'undefined' && window.PureCounter) {
      new window.PureCounter();
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(timerLong);
    };

  }, [pathname]); // Re-run on path changes

  return null;
}
