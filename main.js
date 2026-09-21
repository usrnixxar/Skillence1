/**
 * Skillence Academy - Single-Page Scroll Animation & Navigation Engine
 * 100% Custom Vanilla JavaScript - Single-Page Architecture.
 */

(function () {
  'use strict';

  // ==========================================
  // CONFIGURATION
  // ==========================================
  const CONFIG = {
    FRAME_DIR: 'skillence_frames_30fps_clean',
    SCROLL_PX_PER_FRAME: 10,  // Scroll distance per animation frame
    LERP_FACTOR: 0.28,         // Fluid physics interpolation
    CONCURRENCY_LIMIT: 10      // Concurrent image load threads
  };

  /**
   * Build the array of 240 unique frames (removes duplicate 30fps conversion frames).
   * Original 300 frames had duplicate twins at (i % 5 === 3).
   * Removing them gives 240 unique, non-repeating frames from frame_0001 to frame_0300.
   */
  const FRAME_URLS = [];
  for (let i = 1; i <= 300; i++) {
    if (i % 5 !== 3) {
      const padded = String(i).padStart(4, '0');
      FRAME_URLS.push(`${CONFIG.FRAME_DIR}/frame_${padded}.png`);
    }
  }

  const TOTAL_FRAMES = FRAME_URLS.length; // Exactly 240 unique frames

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const canvas = document.getElementById('frame-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const heroSection = document.getElementById('home');
  const heroViewport = document.querySelector('.hero-sticky-viewport');
  const loaderOverlay = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderStatus = document.getElementById('loader-status');
  const scrollCue = document.getElementById('scroll-cue');
  const siteHeader = document.getElementById('site-header');
  const mobileToggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  const navItems = document.querySelectorAll('.nav-link');

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const frameImages = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let targetFrameIndex = 0;
  let currentFrameFloat = 0;
  let lastRenderedIndex = -1;
  let isInitialFrameRendered = false;
  let heroAnimationDistance = 0;

  // ==========================================
  // VIEWPORT & CANVAS SIZING
  // ==========================================
  function updateDimensions() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Crisp high-DPI canvas sizing
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // Hero track height: corresponds to playing the 240 frames
    heroAnimationDistance = (TOTAL_FRAMES - 1) * CONFIG.SCROLL_PX_PER_FRAME;
    if (heroSection) {
      heroSection.style.height = `${heroAnimationDistance + height}px`;
    }

    // Redraw current frame
    if (lastRenderedIndex >= 0) {
      drawFrame(lastRenderedIndex);
    }
  }

  // ==========================================
  // FRAME RENDERING (ASPECT RATIO & RIGHT ALIGNMENT)
  // ==========================================
  function getClosestLoadedImage(requestedIndex) {
    if (frameImages[requestedIndex] && frameImages[requestedIndex].complete && frameImages[requestedIndex].naturalWidth > 0) {
      return frameImages[requestedIndex];
    }

    // Bidirectional outwards search for nearest loaded frame
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = requestedIndex - offset;
      if (prev >= 0 && frameImages[prev] && frameImages[prev].complete && frameImages[prev].naturalWidth > 0) {
        return frameImages[prev];
      }
      const next = requestedIndex + offset;
      if (next < TOTAL_FRAMES && frameImages[next] && frameImages[next].complete && frameImages[next].naturalWidth > 0) {
        return frameImages[next];
      }
    }
    return null;
  }

  function drawFrame(frameIndex) {
    const img = getClosestLoadedImage(frameIndex);
    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const hRatio = cw / iw;
    const vRatio = ch / ih;
    const ratio = Math.min(hRatio, vRatio);

    const renderW = Math.round(iw * ratio);
    const renderH = Math.round(ih * ratio);

    let offsetX = Math.round((cw - renderW) / 2);
    const offsetY = Math.round((ch - renderH) / 2);

    // On desktop (>= 1024px): Shift portrait to the right half so Nisar's face
    // is positioned in the right 55% column with zero text overlap
    if (window.innerWidth >= 1024) {
      const desiredCenter = cw * 0.70;
      const targetOffsetX = Math.round(desiredCenter - (renderW / 2));
      offsetX = Math.min(cw - renderW, Math.max(0, targetOffsetX));
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cw, ch);

    ctx.drawImage(img, 0, 0, iw, ih, offsetX, offsetY, renderW, renderH);
    lastRenderedIndex = frameIndex;
  }

  // ==========================================
  // ACTIVE NAVBAR STATE (PRECISE DOCUMENT OFFSET)
  // ==========================================
  function updateActiveNavLink() {
    const scrollY = window.scrollY;
    const headerHeight = siteHeader?.offsetHeight || 75;
    const sectionIds = ['home', 'about', 'courses', 'skills', 'projects', 'contact'];
    let currentActiveId = 'home';

    for (const id of sectionIds) {
      const elem = document.getElementById(id);
      if (elem) {
        // True absolute document top coordinate
        const elemTop = elem.getBoundingClientRect().top + window.pageYOffset - headerHeight - 40;
        if (scrollY >= elemTop) {
          currentActiveId = id;
        }
      }
    }

    // Bottom of document edge case
    if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 70)) {
      currentActiveId = 'contact';
    }

    navItems.forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentActiveId}`) {
        link.classList.add('active');
      }
    });
  }

  // ==========================================
  // SCROLL PROGRESS COORDINATION
  // ==========================================
  function handleScroll() {
    const scrollY = Math.max(0, window.scrollY);

    // Frosted glass header blur
    if (scrollY > 40) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }

    // Fade scroll prompt
    if (scrollY > 30 && scrollCue) {
      scrollCue.classList.add('is-scrolled');
    } else if (scrollCue) {
      scrollCue.classList.remove('is-scrolled');
    }

    // Coordinate 3D Animation track:
    // Only advances within heroAnimationDistance
    const effectiveDistance = Math.max(1, heroAnimationDistance);
    const animProgress = Math.min(1, Math.max(0, scrollY / effectiveDistance));

    targetFrameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(animProgress * (TOTAL_FRAMES - 1)))
    );

    // Hero content subtle dim as user scrolls through frames
    if (heroViewport) {
      if (scrollY <= heroAnimationDistance) {
        if (animProgress > 0.45) {
          const fadeOut = Math.max(0, 1 - (animProgress - 0.45) / 0.45);
          heroViewport.style.opacity = fadeOut.toFixed(2);
        } else {
          heroViewport.style.opacity = '1';
        }
        heroViewport.style.pointerEvents = animProgress > 0.85 ? 'none' : 'auto';
      } else {
        heroViewport.style.opacity = '0';
        heroViewport.style.pointerEvents = 'none';
      }
    }

    // Update active navbar highlight without altering URL or triggering routes
    updateActiveNavLink();
  }

  // ==========================================
  // RENDER LOOP (requestAnimationFrame)
  // ==========================================
  function renderLoop() {
    const diff = targetFrameIndex - currentFrameFloat;

    if (Math.abs(diff) > 0.005) {
      currentFrameFloat += diff * CONFIG.LERP_FACTOR;
    } else {
      currentFrameFloat = targetFrameIndex;
    }

    const roundedIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentFrameFloat)));
    if (roundedIndex !== lastRenderedIndex) {
      drawFrame(roundedIndex);
    }

    requestAnimationFrame(renderLoop);
  }

  // ==========================================
  // PRELOADER ENGINE
  // ==========================================
  function updateLoaderUI() {
    const percent = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
    if (loaderBar) loaderBar.style.width = `${percent}%`;
    if (loaderStatus) loaderStatus.textContent = `${percent}%`;

    if (loadedCount >= TOTAL_FRAMES) {
      setTimeout(() => {
        loaderOverlay.classList.add('is-loaded');
      }, 250);
    } else if (loadedCount >= 25 && !loaderOverlay.classList.contains('is-loaded')) {
      loaderOverlay.classList.add('is-loaded');
    }
  }

  function loadImage(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = FRAME_URLS[index];

      img.onload = () => {
        frameImages[index] = img;
        loadedCount++;
        updateLoaderUI();

        if (index === 0 && !isInitialFrameRendered) {
          isInitialFrameRendered = true;
          drawFrame(0);
        } else if (Math.round(currentFrameFloat) === index) {
          drawFrame(index);
        }

        resolve(img);
      };

      img.onerror = () => {
        loadedCount++;
        updateLoaderUI();
        resolve(null);
      };
    });
  }

  async function preloadAllFrames() {
    await loadImage(0);

    const queue = [];
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      queue.push(i);
    }

    let nextIdx = 0;
    const workers = new Array(CONFIG.CONCURRENCY_LIMIT).fill(null).map(async () => {
      while (nextIdx < queue.length) {
        const item = queue[nextIdx++];
        await loadImage(item);
      }
    });

    await Promise.all(workers);
  }

  // ==========================================
  // SINGLE-PAGE SMOOTH SCROLL NAVIGATION (FIX)
  // ==========================================
  function setupSinglePageNavigation() {
    // Intercept all in-page anchor clicks: #home, #about, #courses, #skills, #projects, #contact
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault(); // Prevent any page reload or separate route navigation

          const headerOffset = siteHeader?.offsetHeight || 75;
          const elementPosition = targetElem.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: Math.max(0, offsetPosition),
            behavior: 'smooth'
          });

          // Close mobile menu if open
          if (window.innerWidth <= 768 && navLinks) {
            navLinks.style.display = 'none';
          }
        }
      });
    });
  }

  // ==========================================
  // SKILLS SECTION ANIMATED CAROUSELS
  // ==========================================
  function setupSkillsCarousels() {
    function initCarousel(trackId, prevBtnId, nextBtnId, viewportId) {
      const track = document.getElementById(trackId);
      const prevBtn = document.getElementById(prevBtnId);
      const nextBtn = document.getElementById(nextBtnId);
      const viewport = document.getElementById(viewportId);

      if (!track || !prevBtn || !nextBtn || !viewport) return;

      const cards = Array.from(track.children);
      if (cards.length === 0) return;

      let currentIndex = 0;
      let isPointerDown = false;
      let startX = 0;
      let startTranslate = 0;
      let currentDelta = 0;

      function getStepSize() {
        const firstCard = cards[0];
        const cardWidth = firstCard.getBoundingClientRect().width;
        const style = window.getComputedStyle(track);
        const gap = parseFloat(style.gap) || 16;
        return { cardWidth, gap, step: cardWidth + gap };
      }

      function getMaxIndex() {
        const { step, gap } = getStepSize();
        const viewportWidth = viewport.clientWidth;
        const visibleCount = Math.max(1, Math.round((viewportWidth + gap) / step));
        return Math.max(0, cards.length - visibleCount);
      }

      function updateSlide(animate = true) {
        const maxIndex = getMaxIndex();
        if (currentIndex > maxIndex) {
          currentIndex = 0;
        } else if (currentIndex < 0) {
          currentIndex = maxIndex;
        }

        const { step } = getStepSize();
        const targetOffset = currentIndex * step;

        track.style.transition = animate ? 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
        track.style.transform = `translateX(-${targetOffset}px)`;
      }

      // Button Controls
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const maxIndex = getMaxIndex();
        if (currentIndex >= maxIndex) {
          currentIndex = 0; // Loop back to start smoothly
        } else {
          currentIndex++;
        }
        updateSlide(true);
      });

      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const maxIndex = getMaxIndex();
        if (currentIndex <= 0) {
          currentIndex = maxIndex; // Loop to end smoothly
        } else {
          currentIndex--;
        }
        updateSlide(true);
      });

      // Keyboard Accessibility
      viewport.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextBtn.click();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevBtn.click();
        }
      });

      // Touch & Mouse Drag
      viewport.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isPointerDown = true;
        startX = e.clientX;
        currentDelta = 0;
        const { step } = getStepSize();
        startTranslate = -currentIndex * step;
        track.style.transition = 'none';
        viewport.setPointerCapture(e.pointerId);
      });

      viewport.addEventListener('pointermove', (e) => {
        if (!isPointerDown) return;
        currentDelta = e.clientX - startX;
        track.style.transform = `translateX(${startTranslate + currentDelta}px)`;
      });

      function handlePointerEnd(e) {
        if (!isPointerDown) return;
        isPointerDown = false;
        try {
          viewport.releasePointerCapture(e.pointerId);
        } catch (_) {}

        const threshold = 35;
        const maxIndex = getMaxIndex();

        if (currentDelta < -threshold) {
          if (currentIndex >= maxIndex) {
            currentIndex = 0;
          } else {
            currentIndex++;
          }
        } else if (currentDelta > threshold) {
          if (currentIndex <= 0) {
            currentIndex = maxIndex;
          } else {
            currentIndex--;
          }
        }
        updateSlide(true);
      }

      viewport.addEventListener('pointerup', handlePointerEnd);
      viewport.addEventListener('pointercancel', handlePointerEnd);

      // Window resize listener
      window.addEventListener('resize', () => {
        updateSlide(false);
      }, { passive: true });

      // Initial alignment
      setTimeout(() => {
        updateSlide(false);
      }, 50);
    }

    // Initialize Software & Tools Carousel
    initCarousel('software-track', 'software-prev', 'software-next', 'software-viewport');

    // Initialize AI Tools Carousel
    initCarousel('ai-track', 'ai-prev', 'ai-next', 'ai-viewport');
  }

  // ==========================================
  // MOBILE NAVIGATION TOGGLE
  // ==========================================
  function setupMobileMenu() {
    if (!mobileToggle || !navLinks) return;

    mobileToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('mobile-open');
      mobileToggle.classList.toggle('is-active', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
    });

    // Close mobile menu on clicking any nav item
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileToggle.classList.remove('is-active');
        document.body.classList.remove('nav-open');
      });
    });

    // Close on outside tap
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('mobile-open') &&
          !navLinks.contains(e.target) &&
          !mobileToggle.contains(e.target)) {
        navLinks.classList.remove('mobile-open');
        mobileToggle.classList.remove('is-active');
        document.body.classList.remove('nav-open');
      }
    });
  }

  // ==========================================
  // LEAD FORM MODAL / POPUP COMPONENT
  // ==========================================
  function setupLeadFormModal() {
    const backdrop = document.getElementById('lead-modal-backdrop');
    const modalContainer = document.getElementById('lead-modal');
    const closeBtn = document.getElementById('lead-modal-close');
    const formView = document.getElementById('lead-form-view');
    const successView = document.getElementById('lead-success-view');
    const form = document.getElementById('lead-form');
    const submitBtn = document.getElementById('lead-submit-btn');
    const btnText = submitBtn ? submitBtn.querySelector('.lead-btn-text') : null;
    const btnSpinner = document.getElementById('lead-btn-spinner');
    const closeSuccessBtn = document.getElementById('lead-close-success-btn');
    const globalError = document.getElementById('lead-global-error');
    const globalErrorText = document.getElementById('lead-global-error-text');

    // Input elements
    const nameInput = document.getElementById('lead-fullname');
    const phoneInput = document.getElementById('lead-phone');
    const emailInput = document.getElementById('lead-email');
    const courseSelect = document.getElementById('lead-course');
    const locationInput = document.getElementById('lead-location');
    const messageInput = document.getElementById('lead-message');

    // Error message elements
    const errorName = document.getElementById('error-lead-fullname');
    const errorPhone = document.getElementById('error-lead-phone');
    const errorEmail = document.getElementById('error-lead-email');
    const errorCourse = document.getElementById('error-lead-course');
    const errorLocation = document.getElementById('error-lead-location');

    if (!backdrop || !modalContainer || !form) return;

    let lastFocusedElement = null;
    let isSubmitting = false;

    // Open Modal
    function openModal(triggerElem) {
      lastFocusedElement = triggerElem || document.activeElement;

      // Close mobile menu if open
      if (window.innerWidth <= 768 && navLinks) {
        navLinks.style.display = 'none';
      }

      backdrop.classList.add('is-active');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');

      // Focus first input after slight animation tick
      setTimeout(() => {
        if (formView.style.display !== 'none' && nameInput) {
          nameInput.focus();
        } else if (closeSuccessBtn) {
          closeSuccessBtn.focus();
        }
      }, 80);
    }

    // Close Modal
    function closeModal() {
      backdrop.classList.remove('is-active');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');

      // Return focus to triggering button
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        setTimeout(() => {
          lastFocusedElement.focus();
        }, 150);
      }

      // If closed while in success view, reset to form view for next time
      setTimeout(() => {
        if (successView && successView.style.display !== 'none') {
          resetToFormView();
        }
        clearAllErrors();
        hideGlobalError();
      }, 350);
    }

    function resetToFormView() {
      form.reset();
      formView.style.display = 'block';
      successView.style.display = 'none';
      clearAllErrors();
      hideGlobalError();
    }

    function showGlobalError(msg) {
      if (globalError) {
        if (globalErrorText) globalErrorText.textContent = msg || 'Something went wrong. Please try again.';
        globalError.style.display = 'flex';
      }
    }

    function hideGlobalError() {
      if (globalError) {
        globalError.style.display = 'none';
      }
    }

    function setFieldError(inputElem, errorElem, message) {
      if (errorElem) {
        errorElem.textContent = message;
      }
      if (inputElem) {
        inputElem.classList.add('has-error');
        const wrapper = inputElem.closest('.lead-phone-wrapper');
        if (wrapper) wrapper.classList.add('has-error');
      }
    }

    function clearFieldError(inputElem, errorElem) {
      if (errorElem) {
        errorElem.textContent = '';
      }
      if (inputElem) {
        inputElem.classList.remove('has-error');
        const wrapper = inputElem.closest('.lead-phone-wrapper');
        if (wrapper) wrapper.classList.remove('has-error');
      }
    }

    function clearAllErrors() {
      clearFieldError(nameInput, errorName);
      clearFieldError(phoneInput, errorPhone);
      clearFieldError(emailInput, errorEmail);
      clearFieldError(courseSelect, errorCourse);
      clearFieldError(locationInput, errorLocation);
    }

    // Phone Input: Digits only, max 10 digits
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
        if (e.target.value !== cleaned) {
          e.target.value = cleaned;
        }
        if (cleaned.length === 10) {
          clearFieldError(phoneInput, errorPhone);
        }
      });
      phoneInput.addEventListener('keydown', (e) => {
        // Disallow non-numeric keys except control keys
        const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'];
        if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey && !/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      });
    }

    // Clear errors on input / change
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        if (nameInput.value.trim().length >= 2) clearFieldError(nameInput, errorName);
      });
    }
    if (emailInput) {
      emailInput.addEventListener('input', () => {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) clearFieldError(emailInput, errorEmail);
      });
    }
    if (courseSelect) {
      courseSelect.addEventListener('change', () => {
        if (courseSelect.value && courseSelect.value !== 'Select a course') clearFieldError(courseSelect, errorCourse);
      });
    }
    if (locationInput) {
      locationInput.addEventListener('input', () => {
        if (locationInput.value.trim().length >= 1) clearFieldError(locationInput, errorLocation);
      });
    }

    // Form Validation
    function validateForm() {
      let isValid = true;
      let firstInvalid = null;

      // 1. Full Name
      const nameVal = nameInput ? nameInput.value.trim() : '';
      if (!nameVal || nameVal.length < 2) {
        setFieldError(nameInput, errorName, 'Please enter your full name.');
        isValid = false;
        if (!firstInvalid) firstInvalid = nameInput;
      } else {
        clearFieldError(nameInput, errorName);
      }

      // 2. Phone Number (10 digits)
      const phoneVal = phoneInput ? phoneInput.value.trim() : '';
      if (!phoneVal || !/^\d{10}$/.test(phoneVal)) {
        setFieldError(phoneInput, errorPhone, 'Please enter a valid 10-digit phone number.');
        isValid = false;
        if (!firstInvalid) firstInvalid = phoneInput;
      } else {
        clearFieldError(phoneInput, errorPhone);
      }

      // 3. Email
      const emailVal = emailInput ? emailInput.value.trim() : '';
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        setFieldError(emailInput, errorEmail, 'Please enter a valid email address.');
        isValid = false;
        if (!firstInvalid) firstInvalid = emailInput;
      } else {
        clearFieldError(emailInput, errorEmail);
      }

      // 4. Course
      const courseVal = courseSelect ? courseSelect.value : '';
      if (!courseVal || courseVal === 'Select a course') {
        setFieldError(courseSelect, errorCourse, 'Please select a course.');
        isValid = false;
        if (!firstInvalid) firstInvalid = courseSelect;
      } else {
        clearFieldError(courseSelect, errorCourse);
      }

      // 5. Location
      const locVal = locationInput ? locationInput.value.trim() : '';
      if (!locVal) {
        setFieldError(locationInput, errorLocation, 'Please enter your city/location.');
        isValid = false;
        if (!firstInvalid) firstInvalid = locationInput;
      } else {
        clearFieldError(locationInput, errorLocation);
      }

      if (firstInvalid) {
        firstInvalid.focus();
      }

      return isValid;
    }

    // Form Submit Handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      hideGlobalError();

      if (!validateForm()) {
        return;
      }

      isSubmitting = true;
      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnSpinner) btnSpinner.style.display = 'inline-flex';

      const payload = {
        fullName: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim(),
        course: courseSelect.value,
        location: locationInput.value.trim(),
        message: messageInput ? messageInput.value.trim() : '',
        submittedAt: new Date().toISOString(),
        source: 'Website Contact Form'
      };

      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data && data.success) {
          // Success State
          formView.style.display = 'none';
          successView.style.display = 'flex';
          form.reset();
          clearAllErrors();
          if (closeSuccessBtn) closeSuccessBtn.focus();
        } else {
          // Server validation or error
          const errMsg = (data && data.error) ? data.error : 'Something went wrong. Please try again.';
          showGlobalError(errMsg);
        }
      } catch (err) {
        // Network / connection error
        showGlobalError('Something went wrong. Please try again.');
      } finally {
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (btnSpinner) btnSpinner.style.display = 'none';
      }
    });

    // Close Button Click
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
    if (closeSuccessBtn) {
      closeSuccessBtn.addEventListener('click', closeModal);
    }

    // Click outside modal container to close
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });

    // Prevent clicks inside modal from propagating to backdrop
    modalContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // ESC key closes modal & Trap focus
    document.addEventListener('keydown', (e) => {
      if (!backdrop.classList.contains('is-active')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }

      // Trap focus
      if (e.key === 'Tab') {
        const focusable = modalContainer.querySelectorAll(
          'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const visibleFocusable = Array.from(focusable).filter(
          (el) => el.offsetParent !== null && !el.disabled
        );

        if (visibleFocusable.length === 0) return;

        const firstEl = visibleFocusable[0];
        const lastEl = visibleFocusable[visibleFocusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    });

    // Attach to ALL "Contact Us" buttons across the entire website
    function attachContactButtons() {
      const allButtons = Array.from(document.querySelectorAll('a, button'));
      const contactButtons = allButtons.filter((el) => {
        if (el.closest('#lead-modal')) return false;
        const text = el.textContent.trim().toLowerCase();
        const href = el.getAttribute('href') || '';
        return (
          text.includes('contact us') ||
          el.classList.contains('btn-hire') ||
          (el.classList.contains('btn') && href === '#contact')
        );
      });

      contactButtons.forEach((btn) => {
        // Use capture phase to intercept before smooth scroll or tel: handlers
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          openModal(this);
        }, true);
      });
    }

    attachContactButtons();
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    updateDimensions();
    window.addEventListener('resize', updateDimensions, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    requestAnimationFrame(renderLoop);
    preloadAllFrames();
    setupSkillsCarousels();
    setupSinglePageNavigation();
    setupMobileMenu();
    setupLeadFormModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

