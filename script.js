console.log("Project Loaded - Vanilla JS & CSS");

// Mobile Menu Initialization
window.initMobileMenu = function() {
  const oldBtn = document.getElementById('mobile-menu-btn');
  if (!oldBtn) return;

  // 1. Clone & Replace first to ensure we work with the live element and strip old listeners
  const btn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(btn, oldBtn);

  // 2. Get references
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-overlay');
  const icon = btn.querySelector('i');
  const links = menu ? menu.querySelectorAll('a') : [];

  if (!menu || !overlay) return;

  // 3. Define Toggle Function
  function toggleMenu() {
    const isOpen = menu.classList.toggle('is-open');
    overlay.classList.toggle('is-open');
    
    if (icon) {
      if (isOpen) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Close menu');
      } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Open menu');
      }
    }
  }

  // 4. Add Event Listeners
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  overlay.onclick = toggleMenu;

  links.forEach(link => {
    link.onclick = () => {
      if (menu.classList.contains('is-open')) toggleMenu();
    };
  });

  // Global listeners
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      toggleMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (menu.classList.contains('is-open') && 
        !menu.contains(e.target) && 
        !btn.contains(e.target)) {
      toggleMenu();
    }
  });
};

// Fade In Animation Observer
window.initFadeIn = function() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in-section').forEach(section => {
    observer.observe(section);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  window.initMobileMenu();
  window.initFadeIn();
});
