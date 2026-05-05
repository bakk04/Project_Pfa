document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  // CSS fix to ensure no scrollbars appear in any view
  calendarEl.style.overflow = 'hidden';

  const removePopup = () => {
    document.querySelector('.fc-event-popup')?.remove();
  };

  const uniqueEvents = [
    // MONTH VIEW DATA
    {
      title: 'Team Hall YT',
      start: '2026-03-02',
      backgroundColor: '#EEF2FF',
      borderColor: '#6366F1',
      textColor: '#4338CA'
    },
    {
      title: 'Training Workshop',
      start: '2026-03-13T09:30:00',
      end: '2026-03-13T10:30:00',
      backgroundColor: '#FCE7F3',
      borderColor: '#EC4899',
      textColor: '#BE185D'
    },
    {
      title: 'Wellness Session',
      start: '2026-03-18',
      backgroundColor: '#ECFEFF',
      borderColor: '#06B6D4',
      textColor: '#0E7490'
    },
    {
      title: 'Team Activity',
      start: '2026-03-07',
      backgroundColor: '#FFF7ED',
      borderColor: '#F97316',
      textColor: '#9A3412'
    },

    // WEEK SYNC - BOTH ALL DAY AND TIME SLOT
    {
      title: 'Weekly Sync',
      start: '2026-03-23',
      allDay: true,
      backgroundColor: '#F0FDF4',
      borderColor: '#22C55E',
      textColor: '#15803D'
    },
    {
      title: 'Weekly Sync',
      start: '2026-03-23T09:00:00',
      end: '2026-03-23T10:00:00',
      backgroundColor: '#F0FDF4',
      borderColor: '#22C55E',
      textColor: '#15803D'
    },

    // PROJECT DEMO - BOTH ALL DAY AND TIME SLOT
    {
      title: 'Project Demo',
      start: '2026-03-26',
      allDay: true,
      backgroundColor: '#FAF5FF',
      borderColor: '#A855F7',
      textColor: '#7E22CE'
    },
    {
      title: 'Project Demo',
      start: '2026-03-26T09:00:00',
      end: '2026-03-26T10:30:00',
      backgroundColor: '#FAF5FF',
      borderColor: '#A855F7',
      textColor: '#7E22CE'
    }
  ];

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 650,
    contentHeight: 620,
    handleWindowResize: true,
    expandRows: true,
    eventDisplay: 'block',
    events: uniqueEvents,

    customButtons: {
      fcToday: {
        text: 'Today',
        click() { calendar.today(); }
      },
      addEvent: {
        text: '+ New Event',
        click() {
          document.querySelector('[data-hs-overlay="#add-event"]')?.click();
        }
      }
    },

    eventClick: function (info) {
      info.jsEvent.preventDefault();
      removePopup();

      const ev = info.event;
      const popup = document.createElement('div');
      popup.className = 'fc-event-popup fixed z-[9999] top-0 left-0 size-full overflow-x-hidden overflow-y-auto flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm flex-wrap';

      popup.innerHTML = `
        <div class="max-w-[400px] min-w-[300px] w-full p-6 bg-white border border-border-color rounded-lg shadow-xl">
          <div class="flex justify-between items-center mb-5 pb-5 border-b border-border-color">
            <h4>Event Details</h4>
            <button type="button" class="popup-close size-7 inline-flex justify-center items-center rounded-full border border-border-color bg-white text-gray-900 text-base hover:bg-danger hover:border-danger hover:text-white dark:hover:text-dark focus:outline-hidden focus:bg-danger cursor-pointer">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="mb-5 pb-5 border-b border-border-color">
            <img class="mb-4 rounded-md" src="assets/img/bg/calendar.jpg" alt="calendar">
            <p class="font-semibold text-dark mb-2">${ev.title}</p>
            <p class="mb-4 text-sm text-gray-600">An in company training workshop focused on enhancing employee skills through practical, hands on learning.</p>
            <p class="flex items-center gap-2 mb-3 text-sm">
              <i class="icon-calendar text-dark"></i>
              <span>${ev.start.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
            <p class="flex items-center gap-2 mb-3 text-sm">
              <i class="icon-clock text-dark"></i>
              ${ev.allDay ? 'All Day' : ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p class="flex items-center gap-2 text-sm">
              <i class="icon-map-pin text-dark"></i>
              Room 2A
            </p>
          </div>
          <div class="flex justify-between items-center">
            <div class="avatar-list-stacked">
              <img src="assets/img/avatar/avatar-27.jpg" alt="JS" class="w-6 h-6 inline-flex items-center justify-center hover:-translate-y-[0.188rem] hover:z-1 transition-transform duration-150 ease-in-out -me-3.5 rounded-full border border-border-color">
              <img src="assets/img/avatar/avatar-28.jpg" alt="AR" class="w-6 h-6 inline-flex items-center justify-center hover:-translate-y-[0.188rem] hover:z-1 transition-transform duration-150 ease-in-out -me-3.5 rounded-full border border-border-color">
              <img src="assets/img/avatar/avatar-29.jpg" alt="KM" class="w-6 h-6 inline-flex items-center justify-center hover:-translate-y-[0.188rem] hover:z-1 transition-transform duration-150 ease-in-out -me-3.5 rounded-full border border-border-color">
              <span class="w-6 h-6 inline-flex items-center justify-center hover:-translate-y-[0.188rem] text-[12px] bg-light text-dark -me-3.5 rounded-full border border-border-color"> 1+ </span>
            </div>
            <div class="flex items-center gap-2">
              <button data-hs-overlay="#edit-event" class="size-7 text-sm flex items-center cursor-pointer justify-center bg-white border border-border-color text-dark hover:text-primary rounded-full">
                <i class="icon-pencil-line"></i>
              </button>
              <a href="#" class="size-7 text-sm flex items-center justify-center bg-white border border-border-color text-dark hover:text-danger rounded-full">
                <i class="icon-trash-2"></i>
              </a>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(popup);
      popup.querySelector('.popup-close').onclick = removePopup;

      setTimeout(() => {
        window.addEventListener('click', function closeOut(e) {
          if (!popup.contains(e.target)) {
            removePopup();
            window.removeEventListener('click', closeOut);
          }
        }, { capture: true });
      }, 10);
    },

    headerToolbar: {
      start: 'prev,title,next',
      center: 'dayGridMonth,dayGridWeek,dayGridDay',
      end: 'fcToday addEvent',
    },

    views: {
      dayGridMonth: {
        displayEventTime: false,
        dayMaxEvents: true
      },
      dayGridWeek: {
        displayEventTime: true
      },
      dayGridDay: {
        displayEventTime: true
      }
    },

    eventDidMount(info) {
      const isMonthTab = info.view.type === 'dayGridMonth';
      const title = info.event.title;

      // Logic to prevent double-showing in Month view if needed
      // If it's month view and the event is the timed version, hide it to avoid duplicates
      if (isMonthTab && !info.event.allDay && (title === 'Weekly Sync' || title === 'Project Demo')) {
         info.el.style.display = 'none';
         return;
      }

      if (isMonthTab && (title === 'Strategy Meeting' || title === 'Tech Review')) {
        info.el.style.display = 'none';
        return;
      }

      info.el.style.backgroundColor = info.event.backgroundColor;
      info.el.style.borderColor = info.event.borderColor;
      info.el.style.color = info.event.textColor;
      info.el.style.borderRadius = '6px';

      const frame = info.el.querySelector('.fc-event-main');
      if (frame) {
        frame.style.padding = '2px 4px';
        frame.style.fontWeight = '600';
      }
    }
  });

  calendar.render();
});