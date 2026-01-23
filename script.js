console.log("Tailwind one-page project loaded");

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const icon = btn ? btn.querySelector('i') : null;
  const overlay = document.getElementById('mobile-overlay');
  const links = menu ? menu.querySelectorAll('a') : [];
  
  let isMenuOpen = false;

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
      menu.classList.remove('-translate-y-2', 'opacity-0', 'invisible');
      menu.classList.add('translate-y-0', 'opacity-100', 'visible');
      overlay.classList.remove('hidden');
      setTimeout(() => overlay.classList.remove('opacity-0'), 10);
      icon.classList.remove('fa-bars');
      icon.classList.add('fa-times');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
    } else {
      menu.classList.remove('translate-y-0', 'opacity-100', 'visible');
      menu.classList.add('-translate-y-2', 'opacity-0', 'invisible');
      overlay.classList.add('opacity-0');
      setTimeout(() => overlay.classList.add('hidden'), 300);
      icon.classList.remove('fa-times');
      icon.classList.add('fa-bars');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
    }
  }

  if (btn && menu && overlay) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    overlay.addEventListener('click', toggleMenu);

    links.forEach(link => {
      link.addEventListener('click', () => {
        if (isMenuOpen) toggleMenu();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMenuOpen) {
        toggleMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (isMenuOpen && !menu.contains(e.target) && !btn.contains(e.target)) {
        toggleMenu();
      }
    });
  }

  const form = document.getElementById('contact-form');
  if (form) {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const submitBtn = document.getElementById('submit-btn');

    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const messageError = document.getElementById('message-error');

    const validateName = () => {
      const value = nameInput.value.trim();
      const isValid = value.length >= 2 && /^[a-zA-Zа-яА-Я\s]+$/.test(value);
      updateFieldStatus(nameInput, nameError, isValid, 'Name must contain at least 2 letters.');
      return isValid;
    };

    const validateEmail = () => {
      const value = emailInput.value.trim();
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      updateFieldStatus(emailInput, emailError, isValid, 'Please enter a valid email.');
      return isValid;
    };

    const validateMessage = () => {
      const value = messageInput.value.trim();
      const isValid = value.length >= 10;
      updateFieldStatus(messageInput, messageError, isValid, 'Message must be at least 10 characters long.');
      return isValid;
    };

    const updateFieldStatus = (input, errorEl, isValid, errorMessage) => {
      if (isValid) {
        input.classList.remove('border-red-500', 'focus:ring-red-500');
        input.classList.add('border-green-500', 'focus:ring-green-500');
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      } else {
        if (input.value.trim() === '') {
           input.classList.remove('border-green-500', 'focus:ring-green-500', 'border-red-500', 'focus:ring-red-500');
           errorEl.classList.add('hidden');
        } else {
           input.classList.remove('border-green-500', 'focus:ring-green-500');
           input.classList.add('border-red-500', 'focus:ring-red-500');
           errorEl.textContent = errorMessage;
           errorEl.classList.remove('hidden');
        }
      }
    };

    const validateForm = () => {
      const isNameValid = validateName();
      const isEmailValid = validateEmail();
      const isMessageValid = validateMessage();

      if (isNameValid && isEmailValid && isMessageValid) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'cursor-pointer');
      } else {
        submitBtn.disabled = true;
        submitBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'cursor-pointer');
      }
    };

    nameInput.addEventListener('input', validateForm);
    emailInput.addEventListener('input', validateForm);
    messageInput.addEventListener('input', validateForm);

    validateForm();
    
    // Demo submission handler
    submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!submitBtn.disabled) {
            const formData = {
                name: nameInput.value,
                email: emailInput.value,
                message: messageInput.value
            };
            
            alert(`Demo message ready!\n\nTo: dido@keemail.me\nFrom: ${formData.name} (${formData.email})\nMessage: ${formData.message}\n\n(This is a demo form. No email was sent.)`);
            
            // Do not reset form so user can see their input
        }
    });
  }
});
