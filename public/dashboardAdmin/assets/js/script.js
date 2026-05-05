/*
Author       : Dreams Technologies
Template Name: Dreams AI - Tailwind Admin Dashboard
*/
(function() {
	"use strict";

	var wrapper = document.querySelector(".main-wrapper");
	var overlay = document.createElement("div");
	overlay.className = "sidebar-overlay";
	if (wrapper && wrapper.parentNode) {
		wrapper.parentNode.insertBefore(overlay, wrapper);
	}


	// Sidebar
	function initSidebarMenu() {
		document.querySelectorAll(".sidebar-menu a").forEach(function(link) {
			link.addEventListener("click", function(e) {
				var submenu = this.nextElementSibling;
				var parent = this.parentElement;

				if (parent.classList.contains("submenu")) {
					e.preventDefault();

					if (!this.classList.contains("subdrop")) {
						var parentUl = this.closest("ul");
						parentUl.querySelectorAll("ul").forEach(function(ul) {
							ul.style.display = "none";
						});
						parentUl.querySelectorAll("a.subdrop").forEach(function(a) {
							a.classList.remove("subdrop");
						});

						if (submenu && submenu.tagName === "UL") {
							submenu.style.display = "block";
						}
						this.classList.add("subdrop");
					} else {
						this.classList.remove("subdrop");
						if (submenu && submenu.tagName === "UL") {
							submenu.style.display = "none";
						}
					}
				}
			});
		});

		document.querySelectorAll(".sidebar-menu ul li.submenu a.active").forEach(function(activeLink) {
			var parentUl = activeLink.closest("ul");
			var parentLink = parentUl ? parentUl.previousElementSibling : null;
			if (parentLink && parentLink.tagName === "A") {
				parentLink.classList.add("active", "subdrop");
				parentUl.style.display = "block";
			}
		});
	}


	document.addEventListener("DOMContentLoaded", function() {
		// ==========================================
		// 1️⃣ CHECK BODY data-parent FIRST (PRIORITY)
		// ==========================================
		const htmlParent = document.documentElement.dataset.parent;

		if (htmlParent) {
			const parentLink = document.querySelector(
				`.tab-item a[data-parent="${htmlParent}"]`,
			);

			if (parentLink) {
				activateMenu(parentLink);
				return;
			}
		}

		// ==========================================
		// 2️⃣ NORMAL URL LOGIC (FALLBACK)
		// ==========================================
		const pathName = window.location.pathname || "";
		const currentPage = pathName.split("/").pop() || "index.html";

		function getNormalizedPage(page) {
			if (document.querySelector(`.tab-item a[href="${page}"]`)) {
				return page;
			}

			const parts = page.split(".");
			if (parts.length < 2) return page;

			const ext = parts.pop();
			const base = parts.join(".");
			const lastDash = base.lastIndexOf("-");
			if (lastDash === -1) return page;

			const maybeBase = `${base.slice(0, lastDash)}.${ext}`;

			if (document.querySelector(`.tab-item a[href="${maybeBase}"]`)) {
				return maybeBase;
			}

			return page;
		}

		const normalizedPage = getNormalizedPage(currentPage);

		const matchedLink = document.querySelector(
			`.tab-item a[href="${normalizedPage}"]`,
		);

		if (matchedLink) {
			activateMenu(matchedLink);
		}

		// ==========================================
		// 🔥 COMMON ACTIVATION FUNCTION
		// ==========================================
		function activateMenu(link) {
			const allLinks = document.querySelectorAll(".tab-item a");
			const allTabs = document.querySelectorAll("#sidebar-tabs a");
			const allTabContents = document.querySelectorAll(".tab-item");

			// Remove all active classes
			allLinks.forEach((l) => l.classList.remove("active"));
			allTabs.forEach((t) => t.classList.remove("active"));
			allTabContents.forEach((tc) => tc.classList.add("hidden"));

			// Activate link
			link.classList.add("active");

			// Show correct tab content
			const parentTab = link.closest(".tab-item");
			if (parentTab) {
				parentTab.classList.remove("hidden");

				const parentTabId = parentTab.id;

				allTabs.forEach((tab) => {
					if (tab.getAttribute("data-hs-tab") === "#" + parentTabId) {
						tab.classList.add("active");
					}
				});
			}

			// Expand submenu if exists
			const submenu = link.closest(".submenu");
			if (submenu) {
				const submenuList = submenu.querySelector("ul");
				if (submenuList) submenuList.style.display = "block";

				const parentLink = submenu.querySelector("a");
				if (parentLink) parentLink.classList.add("active");
			}
		}
	});

	// Initialize Sidebar
	initSidebarMenu();

	// (old jQuery mobile toggle removed; see vanilla handler further below)

	// Mouse Over
	document.addEventListener("mouseover", function(e) {
		e.stopPropagation();
		var body = document.body;
		var toggleBtn = document.getElementById("toggle_btn");
		if (body.classList.contains("mini-sidebar") && toggleBtn && toggleBtn.offsetParent !== null) {
			var targ = e.target.closest(".sidebar, .header-left");
			if (targ) {
				body.classList.add("expand-menu");
				document.querySelectorAll(".subdrop + ul").forEach(function(ul) {
					ul.style.display = "block";
				});
			} else {
				body.classList.remove("expand-menu");
				document.querySelectorAll(".subdrop + ul").forEach(function(ul) {
					ul.style.display = "none";
				});
			}
			e.preventDefault();
		}
	});

	// Toggle Button
	document.addEventListener("click", function(e) {
		var btn = e.target.closest("#toggle_btn, #toggle_btn2");
		if (!btn) return;
		e.preventDefault();
		e.stopPropagation();

		var body = document.body;
		var html = document.documentElement;
		var isMini = body.classList.contains("mini-sidebar");
		var isFullWidth = html.getAttribute("data-layout") === "full-width";
		var isHidden = html.getAttribute("data-layout") === "hidden";

		if (isMini) {
			body.classList.remove("mini-sidebar");
			btn.classList.add("active");
			localStorage.setItem("screenModeNightTokenState", "night");
			requestAnimationFrame(function() {
				document.querySelectorAll(".header-left").forEach(function(el) {
					el.classList.add("active");
				});
			});
		} else {
			body.classList.add("mini-sidebar");
			btn.classList.remove("active");
			localStorage.removeItem("screenModeNightTokenState");
			requestAnimationFrame(function() {
				document.querySelectorAll(".header-left").forEach(function(el) {
					el.classList.remove("active");
				});
			});
		}

		// If <html> has data-layout="full-width", apply full-width class to <body>
		if (isFullWidth) {
			body.classList.add("full-width");
			body.classList.remove("mini-sidebar");
			var sidebarOverlay = document.querySelector(".sidebar-overlay");
			if (sidebarOverlay) sidebarOverlay.classList.add("opened");
		} else {
			body.classList.remove("full-width");
		}

		// If <html> has data-layout="hidden", apply hidden-layout class to <body>
		if (isHidden) {
			body.classList.toggle("hidden-layout");
			body.classList.remove("mini-sidebar");
		}
	});

	// Sidebar close handler
	document.addEventListener("click", function(e) {
		if (e.target.closest(".sidebar-close") || e.target.closest(".sidebar-overlay")) {
			document.body.classList.remove("full-width");
		}
	});

	// Sidebar
	function colinit() {
		document.querySelectorAll(".sidebar-right ul a").forEach(function(link) {
			link.addEventListener("click", function(e) {
				var parentLi = this.parentElement;

				if (parentLi.classList.contains("submenu")) {
					e.preventDefault();
				}

				if (!this.classList.contains("subdrop")) {
					var parentUl = this.closest("ul");
					parentUl.querySelectorAll("ul").forEach(function(ul) {
						ul.style.display = "none";
					});
					parentUl.querySelectorAll("a").forEach(function(a) {
						a.classList.remove("subdrop");
					});
					var nextUl = this.nextElementSibling;
					if (nextUl && nextUl.tagName === "UL") {
						nextUl.style.display = "block";
					}
					this.classList.add("subdrop");
				} else {
					this.classList.remove("subdrop");
					var nextUl = this.nextElementSibling;
					if (nextUl && nextUl.tagName === "UL") {
						nextUl.style.display = "none";
					}
				}
			});
		});

		// Open parent menus for active submenu
		document.querySelectorAll(".sidebar-right ul li.submenu a.active").forEach(function(activeLink) {
			var li = activeLink.closest("li.submenu");
			while (li) {
				var firstLink = li.querySelector("a");
				if (firstLink) firstLink.classList.add("subdrop");
				var submenu = firstLink ? firstLink.nextElementSibling : null;
				if (submenu && submenu.tagName === "UL") submenu.style.display = "block";
				li = li.parentElement ? li.parentElement.closest("li.submenu") : null;
			}
		});
	}
	colinit();

	// Initialize Flatpickr on elements with data-provider="flatpickr"
	document.querySelectorAll('[data-provider="flatpickr"]').forEach((el) => {
		const config = {
			disableMobile: true,
		};

		// --- 1. Handle Wrap Mode ---
		if (el.getAttribute("data-wrap") === "true") {
			config.wrap = true;

			// Crucial: This manually updates the <span> text
			config.onChange = function(selectedDates, dateStr, instance) {
				// Find the span INSIDE the current picker container
				const displaySpan = instance.element.querySelector('[data-input-span]');
				if (displaySpan) {
					displaySpan.textContent = dateStr;
				}
			};
		}

		if (el.hasAttribute("data-date-format")) {
			config.dateFormat = el.getAttribute("data-date-format");
		}
		if (el.hasAttribute("data-enable-time")) {
			config.enableTime = true;
			config.dateFormat = config.dateFormat ?
				`${config.dateFormat} H:i` :
				"Y-m-d H:i";
		}
		if (el.hasAttribute("data-altFormat")) {
			config.altInput = true;
			config.altFormat = el.getAttribute("data-altFormat");
		}
		if (el.hasAttribute("data-minDate")) {
			config.minDate = el.getAttribute("data-minDate");
		}
		if (el.hasAttribute("data-maxDate")) {
			config.maxDate = el.getAttribute("data-maxDate");
		}
		if (el.hasAttribute("data-default-date")) {
			const defaultDate = el.getAttribute("data-default-date");
			// Check if it's a valid date string
			if (
				!["true", "false", "", null].includes(defaultDate) &&
				!isNaN(Date.parse(defaultDate))
			) {
				config.defaultDate = defaultDate;
			}
		}
		if (el.hasAttribute("data-multiple-date")) {
			config.mode = "multiple";
		}
		if (el.hasAttribute("data-range-date")) {
			config.mode = "range";
		}
		if (el.hasAttribute("data-inline-date")) {
			config.inline = true;
			const inlineDate = el.getAttribute("data-inline-date");
			if (
				!["true", "false", "", null].includes(inlineDate) &&
				!isNaN(Date.parse(inlineDate))
			) {
				config.defaultDate = inlineDate;
			}
		}
		if (el.hasAttribute("data-disable-date")) {
			config.disable = el.getAttribute("data-disable-date").split(",");
		}
		if (el.hasAttribute("data-week-number")) {
			config.weekNumbers = true;
		}
		flatpickr(el, config);
	});

	// Time Picker
	document.querySelectorAll('[data-provider="timepickr"]').forEach((item) => {
		const attrs = item.attributes;
		const config = {
			enableTime: true,
			noCalendar: true,
			dateFormat: "H:i",
		};

		if (attrs["data-time-hrs"]) {
			config.time_24hr = true;
		}

		if (attrs["data-min-time"]) {
			config.minTime = attrs["data-min-time"].value;
		}

		if (attrs["data-max-time"]) {
			config.maxTime = attrs["data-max-time"].value;
		}

		if (attrs["data-default-time"]) {
			config.defaultDate = attrs["data-default-time"].value;
		}

		if (attrs["data-time-inline"]) {
			config.inline = true;
			config.defaultDate = attrs["data-time-inline"].value;
		}

		flatpickr(item, config);
	});

	// Choices
	function initChoices() {
		document.querySelectorAll("[data-choices]").forEach((item) => {
			const config = {
				allowHTML: true,
			};
			const attrs = item.attributes;

			if (attrs["data-choices-groups"]) {
				config.placeholderValue = "This is a placeholder set in the config";
			}
			if (attrs["data-choices-search-false"]) {
				config.searchEnabled = false;
			}
			if (attrs["data-choices-search-true"]) {
				config.searchEnabled = true;
			}
			if (attrs["data-choices-removeItem"]) {
				config.removeItemButton = true;
			}
			if (attrs["data-choices-sorting-false"]) {
				config.shouldSort = false;
			}
			if (attrs["data-choices-sorting-true"]) {
				config.shouldSort = true;
			}
			if (attrs["data-choices-multiple-remove"]) {
				config.removeItemButton = true;
			}
			if (attrs["data-choices-limit"]) {
				config.maxItemCount = parseInt(attrs["data-choices-limit"].value);
			}
			if (attrs["data-choices-editItem-true"]) {
				config.editItems = true;
			}
			if (attrs["data-choices-editItem-false"]) {
				config.editItems = false;
			}
			if (attrs["data-choices-text-unique-true"]) {
				config.duplicateItemsAllowed = false;
			}
			if (attrs["data-choices-text-disabled-true"]) {
				config.addItems = false;
			}

			const instance = new Choices(item, config);

			if (attrs["data-choices-text-disabled-true"]) {
				instance.disable();
			}
		});
	}

	// Call it when the DOM is ready
	document.addEventListener("DOMContentLoaded", initChoices);

	// Sidebar Footer Toggle
	const closeBtn = document.querySelector(".close");
	const sidebarFooter = document.querySelector(".sidebar-footer");
	const sidebar = document.querySelector(".sidebar");

	if (closeBtn && sidebarFooter && sidebar) {
		closeBtn.addEventListener("click", function() {
			sidebarFooter.style.display = "none";
			sidebar.classList.add("active");
		});
	}

	// Full Screen
	if (document.querySelector(".btnFullscreen")) {
		const toggleFullscreen = function() {
			if (!document.fullscreenElement) {
				document.documentElement.requestFullscreen();
			} else {
				if (document.exitFullscreen) {
					document.exitFullscreen();
				}
			}
		};
		document.querySelectorAll(".btnFullscreen").forEach(function(btn) {
			btn.addEventListener("click", toggleFullscreen);
		});
	}

	// Alert Close Button (vanilla JS)
	document.querySelectorAll(".close-alert-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const alert = btn.closest('[role="alert"]');
			if (!alert) return;
			// Optional: simple fade-out using CSS class, or remove immediately
			alert.remove();
		});
	});

	// Prompt View
	document.addEventListener("DOMContentLoaded", () => {
		const cards = document.querySelectorAll(".prompt-card");
		const textarea = document.getElementById("prompt-textarea");

		cards.forEach((card) => {
			card.addEventListener("click", () => {
				// 1. Remove 'active' class from all cards to reset them
				cards.forEach((c) => c.classList.remove("active"));

				// 2. Add 'active' class to the clicked card
				card.classList.add("active");

				// 3. Update the textarea with the <p> content
				const textContent = card.querySelector("p")?.innerText;
				if (textarea && textContent) {
					textarea.value = textContent;
					textarea.focus();
				}
			});
		});
	});

	// Prompt View
	document.getElementById("analyze-btn")?.addEventListener("click", () => {
		document.querySelector(".analysis-content")?.classList.add("hidden");
		const copyBtn = document.querySelector("#copy-btn");
		if (copyBtn) {
			copyBtn.disabled = false;
			copyBtn.classList.remove("disabled");
		}

		// ✅ Get text from DIV
		const sourceDiv = document.getElementById("analysis-source");
		const analysisText = sourceDiv.textContent.trim();

		showLineByLine(analysisText, "analysis-output");
	});

	function showLineByLine(text, elementId) {
		const lines = text.split("\n");
		const output = document.getElementById(elementId);
		output.textContent = "";
		let index = 0;

		function typeLine() {
			if (index < lines.length) {
				// Remove leading/trailing spaces per line
				output.textContent += lines[index].trim() + "\n";
				index++;
				setTimeout(typeLine, 150);
			}
		}
		typeLine();
	}

	// Toggle Mobile Menu (#menu_btn, #mobile_btn) - vanilla JS wrapper
	document.addEventListener("click", function(e) {
		const menuBtn =
			e.target.closest("#menu_btn") || e.target.closest("#mobile_btn");
		const sidebarClose = e.target.closest(".sidebar-close");
		const sidebarOverlayClick = e.target.closest(".sidebar-overlay");

		// Cached elements
		const wrapperEl = document.querySelector(".main-wrapper");
		const overlayEl = document.querySelector(".sidebar-overlay");
		const htmlEl = document.documentElement;

		if (menuBtn) {
			e.preventDefault();
			if (wrapperEl) wrapperEl.classList.toggle("slide-nav");
			if (overlayEl) overlayEl.classList.toggle("opened");
			htmlEl.classList.toggle("menu-opened");
		}

		if (sidebarClose || sidebarOverlayClick) {
			if (wrapperEl) wrapperEl.classList.remove("slide-nav");
			if (overlayEl) overlayEl.classList.remove("opened");
			htmlEl.classList.remove("menu-opened");
		}
	});

	// Alert Play Voice Player
	document.addEventListener("DOMContentLoaded", function() {
		// Select ALL play buttons
		const playButtons = document.querySelectorAll(".show-voice-play");
		const playerBar = document.querySelector(".play-voice");
		const closeBtn = document.querySelector(".close-play-btn");

		// Use a loop to attach the click event to every button found
		playButtons.forEach((button) => {
			button.addEventListener("click", function() {
				if (playerBar) {
					// Show with smooth transition
					playerBar.classList.add(
						"opacity-100",
						"translate-y-0",
						"pointer-events-auto",
					);
					playerBar.classList.remove(
						"opacity-0",
						"translate-y-10",
						"pointer-events-none",
					);
				}
			});
		});

		// Hide logic stays the same (since there is usually only one player bar)
		if (closeBtn && playerBar) {
			closeBtn.addEventListener("click", function() {
				playerBar.classList.add(
					"opacity-0",
					"translate-y-10",
					"pointer-events-none",
				);
				playerBar.classList.remove(
					"opacity-100",
					"translate-y-0",
					"pointer-events-auto",
				);
			});
		}
	});

	// Show code preview
	document.addEventListener("click", function(e) {
		const btn = e.target.closest('[data-toggle="code"]');
		if (!btn) return;

		const card = btn.closest(".preview-card");
		const preview = card?.querySelector(".preview-content");
		const code = card?.querySelector(".code");
		const text = btn.querySelector(".code-btn");

		if (!preview || !code || !text) return;

		// Toggle visibility
		preview.classList.toggle("hidden");
		code.classList.toggle("hidden");

		// Toggle button text
		text.textContent =
			text.textContent.trim() === "Show Code" ? "Show Preview" : "Show Code";
	});

	// Copy Code
	document.addEventListener("click", function(e) {
		const copyBtn = e.target.closest("[data-copy]");
		if (!copyBtn) return;

		const code = copyBtn.closest("pre")?.querySelector("code");
		if (!code) return;

		const text = code.innerText;
		navigator.clipboard.writeText(text).then(() => {
			const span = copyBtn.querySelector("span");
			if (!span) return;

			const oldText = span.textContent;
			span.textContent = "Copied!";
			setTimeout(() => (span.textContent = oldText), 1500);
		});
	});

	// Collapse
	document.querySelectorAll("[data-collapse-btn]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const box = btn
				.closest("div")
				.parentElement.querySelector("[data-collapse-box]");

			if (box.style.maxHeight) {
				box.style.maxHeight = null;
			} else {
				box.style.maxHeight = box.scrollHeight + "px";
			}
		});
	});

	// Collapse Horizontal
	document.querySelectorAll("[data-collapse-btn]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const box = btn.parentElement.querySelector("[data-collapse-box]");
			const content = box.firstElementChild;

			if (box.style.width && box.style.width !== "0px") {
				box.style.width = "0px";
			} else {
				box.style.width = content.scrollWidth + "px";
			}
		});
	});

	// Hide script
	document.addEventListener("DOMContentLoaded", () => {
		const form = document.querySelector(".policy-form");
		const btn = document.querySelector(".edit-policy-btn");

		if (!form || !btn) return;

		// 1. Initial State: Hide and prepare for animation
		form.style.display = "none";
		form.style.overflow = "hidden";
		form.style.transition = "all 0.5s ease-in-out";
		form.style.maxHeight = "0";
		form.style.opacity = "0";

		btn.addEventListener("click", (e) => {
			e.preventDefault();

			if (form.style.display === "none") {
				// SHOW FORM
				form.style.display = "block";

				// Double requestAnimationFrame allows the display:block to register so the animation plays
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						form.style.maxHeight = "1000px"; // Adjust based on form height
						form.style.opacity = "1";
						btn.textContent = "Close";
					});
				});
			} else {
				// HIDE FORM
				form.style.maxHeight = "0";
				form.style.opacity = "0";
				btn.innerHTML = '<i class="icon-pencil-line me-2"></i>Edit Prompt';

				// Wait for animation to finish before setting display:none
				setTimeout(() => {
					form.style.display = "none";
				}, 500);
			}
		});
	});

	// Multiple Targets Collapse
	document.querySelectorAll("[data-collapse-target]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const targets = btn.getAttribute("data-collapse-target").split(",");

			targets.forEach((selector) => {
				const box = document.querySelector(selector.trim());
				if (!box) return;

				if (box.style.maxHeight && box.style.maxHeight !== "0px") {
					box.style.maxHeight = "0px";
				} else {
					box.style.maxHeight = box.scrollHeight + "px";
				}
			});
		});
	});

	// Use the DOMContentLoaded event to trigger the text display simulation
	document.addEventListener("DOMContentLoaded", () => {
		setTimeout(() => {
			// Target ALL loading-state elements
			document
				.querySelectorAll(".loading-state")
				.forEach((el) => el.classList.add("hidden"));

			// Target ALL content-state elements
			document
				.querySelectorAll(".content-state")
				.forEach((el) => el.classList.remove("hidden"));
		}, 1000);
	});

	// Video play card
	document.querySelectorAll(".video-card").forEach((card) => {
		const video = card.querySelector(".video");
		const overlay = card.querySelector(".videoOverlay");
		const button = card.querySelector(".playPauseBtn");
		const playIcon = card.querySelector(".playIcon");
		const pauseIcon = card.querySelector(".pauseIcon");

		function updateUI(isPlaying) {
			playIcon.classList.toggle("hidden", isPlaying);
			pauseIcon.classList.toggle("hidden", !isPlaying);
			overlay.classList.toggle("opacity-0", isPlaying);
		}

		// Play / Pause
		button.addEventListener("click", (e) => {
			e.stopPropagation();

			if (video.paused) {
				video.play();
				updateUI(true);
			} else {
				video.pause();
				updateUI(false);
			}
		});

		// Hover behavior (show pause icon only when playing)
		card.addEventListener("mouseenter", () => {
			if (!video.paused) overlay.classList.remove("opacity-0");
		});

		card.addEventListener("mouseleave", () => {
			if (!video.paused) overlay.classList.add("opacity-0");
		});

		// Reset on end
		video.addEventListener("ended", () => {
			updateUI(false);
		});
	});

	// Tag (vanilla JS)
	document.querySelectorAll(".tag-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document.querySelectorAll(".tag-btn").forEach((b) => {
				b.classList.remove(
					"active",
					"!border-primary",
					"text-primary",
					"bg-primary/5",
				);
			});
			btn.classList.add(
				"active",
				"!border-primary",
				"text-primary",
				"bg-primary/5",
			);
		});
	});

	// Textarea Suffle Text
	document.addEventListener("DOMContentLoaded", () => {
		const messages = [
			"Create Flyer on Grand Opening of Special Event for Store",
			"Product Launch Event for new Medical Innovations",
			"Volleyball Playoff Game at Riverstone Center",
			"Raise awareness about Health",
		];

		let currentIndex = 0;

		// 2. Select the button and textarea
		const btn = document.getElementById("shuffle-btn");
		const txtArea = document.getElementById("shuffle-text");

		if (btn) {
			btn.addEventListener("click", () => {
				txtArea.value = messages[currentIndex];
				currentIndex = (currentIndex + 1) % messages.length;
			});
		}
	});

	// Theme Active
	const themeCards = document.querySelectorAll(".theme-card");
	themeCards.forEach((card) => {
		card.addEventListener("click", function() {
			const currentActive = document.querySelector(".theme-card.active");
			if (currentActive) {
				currentActive.classList.remove("active");
			}
			this.classList.add("active");
		});
	});

	document.addEventListener("DOMContentLoaded", () => {
		const panels = document.querySelectorAll(".media-panel");

		document.querySelectorAll("[data-hs-tab]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const targetId = btn.getAttribute("data-hs-tab");

				if (btn.id === "tab-13") {
					// ALL → show everything
					panels.forEach((p) => p.classList.remove("hidden"));
				} else {
					// Others → show one
					panels.forEach((p) => p.classList.add("hidden"));
					document.querySelector(targetId)?.classList.remove("hidden");
				}
			});
		});
	});

	// Presentation Active
	const tabTriggers = document.querySelectorAll(".tab-trigger");
	const allPanels = document.querySelectorAll(".slide-panel");

	tabTriggers.forEach((trigger) => {
		trigger.addEventListener("click", function() {
			const targetId = this.getAttribute("data-target");
			const targetPanel = document.querySelector(targetId);

			// 1. Toggle Active State on Triggers
			tabTriggers.forEach((t) => t.classList.remove("active"));
			this.classList.add("active");

			// 2. Reset and Reorder Panels
			allPanels.forEach((panel) => {
				panel.style.order = "1";
			});

			if (targetPanel) {
				targetPanel.style.order = "-1";
				targetPanel.scrollIntoView({
					behavior: "smooth",
					block: "nearest"
				});
			}
		});
	});

	// Toast (no external dependency)
	const __dreamsToasts = [];

	function tostifyCustomClose(el) {
		const toast = el?.closest?.('.toastify');
		if (!toast) return;

		toast.dispatchEvent(new CustomEvent('dreams:toast:close', {
			bubbles: true
		}));
	}

	function __repositionDreamsToasts() {
		const baseTop = 20; // px
		const gap = 12; // px
		let top = baseTop;

		__dreamsToasts.forEach((t) => {
			if (!t.isConnected) return;
			t.style.top = `${top}px`;
			const height = t.getBoundingClientRect().height || 0;
			top += height + gap;
		});
	}

	function __showDreamsToast({
		html,
		className = "",
		duration = 3000
	}) {
		const toast = document.createElement('div');
		toast.className = `toastify ${className}`.trim();
		toast.setAttribute('role', 'status');
		toast.setAttribute('aria-live', 'polite');

		// Inline styles ensure consistent behavior even if utility classes differ per page.
		toast.style.position = 'fixed';
		toast.style.right = '20px';
		toast.style.opacity = '0';
		toast.style.transform = 'translateY(-16px)';
		toast.style.transition = 'opacity 300ms ease, transform 300ms ease, top 300ms ease';
		toast.innerHTML = html;

		const close = () => {
			if (toast.dataset.closing === '1') return;
			toast.dataset.closing = '1';
			toast.style.opacity = '0';
			toast.style.transform = 'translateY(-16px)';
			window.setTimeout(() => {
				const idx = __dreamsToasts.indexOf(toast);
				if (idx >= 0) __dreamsToasts.splice(idx, 1);
				toast.remove();
				__repositionDreamsToasts();
			}, 350);
		};

		toast.addEventListener('dreams:toast:close', close);

		document.body.appendChild(toast);
		__dreamsToasts.unshift(toast);
		__repositionDreamsToasts();

		requestAnimationFrame(() => {
			toast.style.opacity = '1';
			toast.style.transform = 'translateY(0)';
		});

		if (typeof duration === 'number' && duration > 0) {
			window.setTimeout(close, duration);
		}

		return {
			close
		};
	}

	document.addEventListener('DOMContentLoaded', () => {
		// Toast trigger (UI Toasts page)
		(function() {
			let i = 0;
			const callToast = document.querySelector("#hs-new-toast");
			if (!callToast) return;

			const toastMarkup1 = `
           <div class="max-w-xs relative bg-white border border-border-color rounded-lg shadow-lg" role="alert" tabindex="-1" aria-labelledby="hs-toast-avatar-label">
               <div class="flex gap-x-3 p-4">
                   <img class="shrink-0 size-8 rounded-full" src="assets/img/avatar/avatar-01.jpg" alt="Avatar">
                   <button type="button" data-toast-close class="absolute top-3 end-3 inline-flex shrink-0 justify-center items-center size-5 rounded-lg text-layer-foreground opacity-50 hover:opacity-100 focus:outline-hidden focus:opacity-100" aria-label="Close">
                   <span class="sr-only">Close</span>
                       <i class="icon-x"></i>
                   </button>
                   <div class="grow pe-4">
                       <h3 id="hs-toast-avatar-label" class="text-layer-foreground font-medium text-sm">
                           <span class="font-semibold">James</span> mentioned you in a comment
                       </h3>
                   <div class="mt-1 text-sm text-muted-foreground-2">
                       Nice work! Keep it up!
                   </div>
                   <div class="mt-3">
                   <button type="button" class="text-primary decoration-2 hover:underline font-medium text-sm focus:outline-hidden focus:underline">
                       Mark as read
                   </button>
                   </div>
               </div>
             </div>
           </div>
         `;
			const toastMarkup2 = `
           <div class="flex gap-x-3 p-4">
             <p class="text-sm text-layer-foreground">Your email has been sent</p>
             <div class="ms-auto">
               <button type="button" data-toast-close class="inline-flex shrink-0 justify-center items-center size-5 rounded-lg text-layer-foreground opacity-50 hover:opacity-100 focus:outline-hidden focus:opacity-100" aria-label="Close">
                 <span class="sr-only">Close</span>
               <i class="icon-x"></i>                
               </button>
             </div>
           </div>
         `;

			callToast.addEventListener("click", () => {
				__showDreamsToast({
					html: i % 3 ? toastMarkup1 : toastMarkup2,
					className: "z-90 w-80 bg-white text-sm text-dark border border-border-color rounded-lg shadow-lg",
					duration: 3000
				});

				i++;
			});
		})();
	});

	// Audio
	const allWaveforms = document.querySelectorAll(".waveform");

	allWaveforms.forEach((waveformContainer) => {
		// 2. For each container, find its specific bars
		const bars = waveformContainer.querySelectorAll(".bar");

		waveformContainer.addEventListener(
			"click",
			() => {
				// 3. Trigger the animation only for the bars inside the clicked container
				bars.forEach((bar, index) => {
					// Update color
					bar.classList.remove("bg-gray-500", "bg-gray-600", "bg-gray-700");
					bar.classList.add("bg-primary");

					// Add the wave animation
					bar.classList.add("animate-wave");

					// Stagger the bounce for the "wave" look
					bar.style.animationDelay = `${index * 0.1}s`;
				});
			}, {
				once: true
			},
		);
	});

	// Printer
	document.addEventListener("DOMContentLoaded", function() {
		const printBtn = document.getElementById("printButton");
		if (printBtn) {
			printBtn.addEventListener("click", function() {
				window.print();
			});
		}
	});

	// Select Table Checkbox (vanilla JS)
	const masterSelectAll = document.getElementById("select-all");
	if (masterSelectAll) {
		masterSelectAll.addEventListener("change", function() {
			const checked = this.checked;
			document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
				cb.checked = checked;
			});
		});
	}

	// Checkbox Select Row
	document.querySelectorAll(".row-master").forEach((master) => {
		master.addEventListener("change", function() {
			const tr = this.closest("tr");
			if (!tr) return;

			tr.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
				if (cb !== this) cb.checked = this.checked;
			});
		});
	});

	// Sidebar Scroll to Active Item
	document.addEventListener("DOMContentLoaded", function() {
		const simpleBarElement = document.querySelector(".sidebar-scroll");

		// Ensure SimpleBar instance exists
		if (simpleBarElement && SimpleBar.instances.has(simpleBarElement)) {
			const simpleBar = SimpleBar.instances.get(simpleBarElement);

			// Wait for SimpleBar to finish initialization
			requestAnimationFrame(() => {
				const scrollContainer = simpleBar.getScrollElement();
				const activeItem = simpleBarElement.querySelector(".active");

				if (activeItem) {
					// Scroll so that the active item is at the top
					scrollContainer.scrollTop = activeItem.offsetTop;
				}
			});
		}
	});

	// Floating label toggle (replaces inline oninput handlers)
	document.addEventListener("DOMContentLoaded", function() {
		document.addEventListener("input", function(e) {
			if (e.target.matches("[data-float-label]")) {
				e.target.classList.toggle("has-value", e.target.value.length > 0);
			}
		});
	});

	// Video hover play (replaces inline onmouseover/onmouseout)
	document.addEventListener("mouseover", function(e) {
		var video = e.target.closest("[data-hover-play]");
		if (video) video.play();
	});
	document.addEventListener("mouseout", function(e) {
		var video = e.target.closest("[data-hover-play]");
		if (video) video.pause();
	});

	// Copy prompt text (replaces non-functional inline onclick="copyText(this)")
	document.addEventListener("click", function(e) {
		var btn = e.target.closest("[data-copy-text]");
		if (!btn) return;
		var card = btn.closest(".card") || btn.closest("[class*='rounded']");
		if (!card) return;
		var promptEl = card.querySelector(".copy-text") || card.querySelector("p, h4, h6");
		if (promptEl) {
			navigator.clipboard.writeText(promptEl.textContent.trim());
		}
	});

	// Toast close button (replaces inline onclick in toast markup)
	document.addEventListener("click", function(e) {
		var btn = e.target.closest("[data-toast-close]");
		if (btn) tostifyCustomClose(btn);
	});
})();