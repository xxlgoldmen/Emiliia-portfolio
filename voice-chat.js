// --- VOICE CHAT SCRIPT (TELEGRAM STYLE v2) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, remove, push, onChildAdded, onChildRemoved } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

console.log("Voice Chat: Module Loaded");

try {
  // --- КОНФИГУРАЦИЯ FIREBASE ---
  const firebaseConfig = {
    apiKey: "AIzaSyDJIVI9rbW5vFq_wkROfGhyScN_8IYlP6E",
    authDomain: "white-noise-x.firebaseapp.com",
    projectId: "white-noise-x",
    storageBucket: "white-noise-x.firebasestorage.app",
    messagingSenderId: "510765000340",
    appId: "1:510765000340:web:646150c99f261cf755b681",
    measurementId: "G-KLREV9HM1P"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  // --- UI ELEMENTS ---
  const btn = document.getElementById('chat-toggle-btn');
  const win = document.getElementById('chat-window');
  const minimizeBtn = document.getElementById('chat-minimize-btn');
  const loader = document.getElementById('chat-loader-spinner');
  
  // --- SOUND SYSTEM ---
  const sessionStartTime = Date.now();
  let welcomeMessageShown = false;
  const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // 'Pop' sound
  notificationSound.volume = 0.5;

  // Unlock Audio for iOS/Safari (Autoplay Policy)
  function unlockAudio() {
      notificationSound.play().then(() => {
          notificationSound.pause();
          notificationSound.currentTime = 0;
          console.log("Audio context unlocked");
          // Remove listeners after success
          document.removeEventListener('click', unlockAudio);
          document.removeEventListener('touchstart', unlockAudio);
      }).catch(e => {
          console.log("Audio unlock waiting for interaction...");
      });
  }

  // Bind unlock to document interactions
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  function playNotificationSound() {
      notificationSound.currentTime = 0;
      notificationSound.play().catch(e => console.warn("Sound play blocked:", e));
  }
  
  // Auth UI
  const loginPanel = document.getElementById('auth-ui');
  const loginForm = document.getElementById('login-form');
  const loginConfirm = document.getElementById('login-confirm');
  const confirmNameDisplay = document.getElementById('confirm-name-display');
  const usernameInput = document.getElementById('username-input');
  const loginBtn = document.getElementById('login-btn');
  const confirmYesBtn = document.getElementById('confirm-yes-btn');
  const confirmNoBtn = document.getElementById('confirm-no-btn');
  
  // App Content
  const appContent = document.getElementById('app-content');
  const usersStrip = document.getElementById('users-strip'); // Horizontal list

  // Chat UI
  const msgInput = document.getElementById('msg-input');
  const sendBtn = document.getElementById('msg-send-btn');
  const msgArea = document.getElementById('chat-messages');
  const typingIndicator = document.getElementById('typing-indicator');
  const waitingMessage = document.getElementById('waiting-message');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  
  // --- STATE ---
  let userId = null;
  let userName = null;
  let allMessageKeys = []; // Track all message IDs for auto-cleanup

  // Call Modal
  const callPopup = document.getElementById('call-popup');
  const callFromName = document.getElementById('call-from-name');
  const btnAccept = document.getElementById('btn-accept');
  const btnDecline = document.getElementById('btn-decline');

  // 1. Toggle Logic
  if (btn && win) {
    btn.onclick = () => {
      win.classList.toggle('chat-visible');
      if (win.classList.contains('chat-visible')) {
          // Clear notification when opening
          btn.classList.remove('has-notification');
          
          // Show welcome message if logged in and not shown
          if (auth.currentUser && !welcomeMessageShown) {
              showWelcomeMessage();
          }

          // Autofocus logic (wait for transition)
          setTimeout(() => {
              if (auth.currentUser) {
                  msgInput?.focus();
              } else {
                  usernameInput?.focus();
              }
          }, 350);
      } else {
          if(loader) loader.style.display = 'none';
      }
    };
  }
  
  // Minimize Logic
  if (minimizeBtn && win) {
    minimizeBtn.onclick = () => {
      win.classList.remove('chat-visible');
    };
  }

  // Close on Click Outside
  document.addEventListener('click', (e) => {
      if (!win || !btn) return;
      // If chat is open, and click is NOT on chat window AND NOT on toggle button
      if (win.classList.contains('chat-visible') && 
          !win.contains(e.target) && 
          !btn.contains(e.target)) {
          win.classList.remove('chat-visible');
      }
  });

  // Close on Escape Key
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && win && win.classList.contains('chat-visible')) {
          win.classList.remove('chat-visible');
      }
  });

  // Clear Chat Button Logic
  if (clearChatBtn) {
      clearChatBtn.onclick = () => {
          if (msgArea) {
              // Only remove message bubbles, keep waiting message/typing indicator
              const bubbles = msgArea.querySelectorAll('.message-bubble');
              bubbles.forEach(b => b.remove());
              
              // Note: We do NOT clear allMessageKeys, because that tracks server state
              // This button is "visually clear for me only"
          }
      };
  }

  // --- AUTH LOGIC ---
  let pendingUsername = '';

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const name = usernameInput?.value?.trim();
      
      if (!name) return alert("Пожалуйста, введите ваше имя");
      if (name.length < 2) return alert("Имя слишком короткое");
      
      pendingUsername = name;
      
      // Switch to confirmation view
      if(loginForm) loginForm.style.display = 'none';
      if(loginConfirm) {
          loginConfirm.style.display = 'flex';
          if(confirmNameDisplay) confirmNameDisplay.textContent = pendingUsername;
      }
    });
  }

  if (confirmNoBtn) {
      confirmNoBtn.addEventListener('click', () => {
          // Go back to input
          if(loginConfirm) loginConfirm.style.display = 'none';
          if(loginForm) loginForm.style.display = 'flex';
          usernameInput?.focus();
      });
  }

  if (confirmYesBtn) {
      confirmYesBtn.addEventListener('click', async () => {
        if (!pendingUsername) return;
        
        if (loader) loader.style.display = 'block';

        try {
             const result = await signInAnonymously(auth);
             // Update Profile with Nickname
             await updateProfile(result.user, {
                 displayName: pendingUsername
             });
             
             // Force update database to ensure correct name immediately
             // (Fixes potential race condition where onAuthStateChanged sees 'Guest')
             update(ref(db, 'users/' + result.user.uid), { 
                 username: pendingUsername,
                 status: 'online'
             });

             // We will handle the rest in onAuthStateChanged
         } catch (error) {
            alert("Ошибка входа: " + error.message);
            if (loader) loader.style.display = 'none';
            // Reset UI on error
            if(loginConfirm) loginConfirm.style.display = 'none';
            if(loginForm) loginForm.style.display = 'flex';
        }
      });
  }

  // Auth State Listener
  onAuthStateChanged(auth, (user) => {
    if (loader) loader.style.display = 'none';
    
    if (user) {
      const name = user.displayName || 'Guest';
      onUserAuth(user.uid, name);
    } else {
      if (loginPanel) loginPanel.style.display = 'flex';
      if (appContent) appContent.style.display = 'none';
      if (usersStrip) usersStrip.innerHTML = '';
    }
  });

  function onUserAuth(userId, userName) {
    if (loginPanel) loginPanel.style.display = 'none';
    if (appContent) appContent.style.display = 'flex';
    
    // Save status
    const userStatusRef = ref(db, 'users/' + userId);
    set(userStatusRef, { username: userName, status: 'online' });
    onDisconnect(userStatusRef).remove();
    
    // Show welcome message if chat is already open (e.g. login form used inside chat)
    if (win && win.classList.contains('chat-visible') && !welcomeMessageShown) {
        showWelcomeMessage();
    }

    // Listen for users
    let onlineUsersCount = 0; // Store user count locally
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const newCount = data ? Object.keys(data).length : 0;
      
      // Bounce logic: specific trigger when count goes from <=1 to >1
      if (onlineUsersCount > 0 && onlineUsersCount <= 1 && newCount > 1) {
          // Trigger bounce
          if(btn) {
              btn.classList.add('bounce-once');
              setTimeout(() => {
                  btn.classList.remove('bounce-once');
              }, 1000);
          }
      }

      onlineUsersCount = newCount;
      
      updateUserList(data, userId);
      updateTypingUI(data, userId);
    });

    // --- MESSAGING LOGIC ---
    if (sendBtn && msgInput) {
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        
        let typingTimeout;

        const sendMessage = () => {
            const text = msgInput.value;
            if(!text.trim()) return;
            
            // Determine status based on online users
            // If more than 1 user (me + someone else), set to 'read', else 'sent'
            const status = onlineUsersCount > 1 ? 'read' : 'sent';

            push(ref(db, 'messages'), {
                text: text,
                uid: userId,
                name: userName,
                timestamp: Date.now(),
                status: status
            });
            msgInput.value = '';
            
            // Reset typing immediately on send
            update(ref(db, 'users/' + userId), { isTyping: false });
            clearTimeout(typingTimeout);
        };

        newSendBtn.onclick = sendMessage;
        
        // Enter to send (using keydown for better compatibility)
        msgInput.onkeydown = (e) => {
            if(e.key === 'Enter') {
                e.preventDefault(); // Prevent default newline if it were a textarea, or form submission
                sendMessage();
            }
        };

        // Typing Listener
        msgInput.addEventListener('input', () => {
             update(ref(db, 'users/' + userId), { isTyping: true });
             
             clearTimeout(typingTimeout);
             typingTimeout = setTimeout(() => {
                 update(ref(db, 'users/' + userId), { isTyping: false });
             }, 3000);
        });
    }

    // Listen for Messages (using onChildAdded for stability)
    const messagesRef = ref(db, 'messages');
    
    // Clear once on init if needed, or just let it append. 
    // Since onChildAdded fires for existing data, we clear manually before attaching if we wanted a fresh start,
    // but here we just append. To avoid duplication on re-auth, we can clear:
    if(msgArea) msgArea.innerHTML = '';

    onChildAdded(messagesRef, (snapshot) => {
        if(!msgArea) return;
        
        const msg = snapshot.val();
        const msgKey = snapshot.key;
        
        // Track key
        if (!allMessageKeys.includes(msgKey)) {
            allMessageKeys.push(msgKey);
        }

        // Auto-cleanup: If > 50 messages, delete oldest
        if (allMessageKeys.length > 50) {
            const keyToRemove = allMessageKeys.shift();
            // Delete from Firebase
            remove(ref(db, 'messages/' + keyToRemove));
        }
        
        const div = document.createElement('div');
        div.setAttribute('data-msg-id', msgKey); // For removal logic
        const isMe = msg.uid === userId;
        
        // Format time
        const date = new Date(msg.timestamp || Date.now());
        const timeStr = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');

        div.className = `message-bubble ${isMe ? 'me' : 'other'}`;
        
        // Status Icon Logic
        let statusIcon = '';
        if (isMe) {
            if (msg.status === 'read') {
                statusIcon = '<i class="fas fa-check-double" style="color: #3b82f6;"></i>'; // Blue double check
            } else {
                statusIcon = '<i class="fas fa-check" style="color: #9ca3af;"></i>'; // Grey single check
            }
        }

        div.innerHTML = `
            ${!isMe ? `<span class="msg-sender">${msg.name}</span>` : ''}
            ${msg.text}
            <div class="msg-meta">
                <span>${timeStr}</span>
                ${statusIcon}
            </div>
        `;
        
        msgArea.appendChild(div);
        
        // Sound for new incoming messages
        if (!isMe && msg.timestamp > sessionStartTime) {
            playNotificationSound();
            
            // Pulse effect if chat is closed
            if (win && !win.classList.contains('chat-visible')) {
                btn.classList.add('has-notification');
            }
        }

        // Smart Scroll: Scroll to bottom
        // We use a small timeout to ensure rendering is complete
        setTimeout(() => {
            msgArea.scrollTop = msgArea.scrollHeight;
        }, 10);
    });

    // Handle Message Removal (from auto-cleanup)
    onChildRemoved(messagesRef, (snapshot) => {
        const msgKey = snapshot.key;
        
        // Remove from local tracking array if present
        const index = allMessageKeys.indexOf(msgKey);
        if (index > -1) {
            allMessageKeys.splice(index, 1);
        }

        // Remove from DOM
        if (msgArea) {
            const bubble = msgArea.querySelector(`.message-bubble[data-msg-id="${msgKey}"]`);
            if (bubble) {
                bubble.remove();
            }
        }
    });

    // --- CALL LOGIC ---
    const myCallRef = ref(db, 'calls/' + userId);
    onValue(myCallRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data && data.status === 'ringing') {
           callPopup.classList.add('active');
           callFromName.textContent = data.fromName || 'Unknown';
           
           // Play sound (once per state change to ringing)
           playNotificationSound();
           
           // Pulse effect for call (even if open, but especially if closed)
           if (btn) btn.classList.add('has-notification');

           btnAccept.onclick = () => {
               openJitsiRoom(data.room);
               remove(myCallRef);
               callPopup.classList.remove('active');
           };
           
           btnDecline.onclick = () => {
               remove(myCallRef);
               callPopup.classList.remove('active');
           };

      } else {
           callPopup.classList.remove('active');
      }
    });
  }

  function updateTypingUI(data, currentUserId) {
    if (!typingIndicator || !data) return;
    
    const typingUsers = [];
    Object.entries(data).forEach(([uid, info]) => {
        if (uid !== currentUserId && info.isTyping) {
            typingUsers.push(info.username || 'Someone');
        }
    });

    if (typingUsers.length > 0) {
        const text = typingUsers.join(', ') + (typingUsers.length === 1 ? ' is typing...' : ' are typing...');
        typingIndicator.textContent = text;
        typingIndicator.style.opacity = '1';
    } else {
        typingIndicator.style.opacity = '0';
        // Clear text after fade out
        setTimeout(() => { 
            if(typingIndicator.style.opacity === '0') typingIndicator.textContent = ''; 
        }, 300);
    }
  }

  function updateUserList(data, currentUserId) {
    if (!usersStrip) return;
    usersStrip.innerHTML = ''; 
    
    // Check user count for waiting message
    let userCount = 0;
    if (data) {
        userCount = Object.keys(data).length;
    }

    if (waitingMessage) {
        // If only me (1) or no one (0), show message
        if (userCount <= 1) {
            waitingMessage.style.display = 'block';
        } else {
            waitingMessage.style.display = 'none';
        }
    }

    if (!data) return;
    
    Object.entries(data).forEach(([uid, userInfo]) => {
      if (uid !== currentUserId) {
        const item = document.createElement('div');
        item.className = 'user-item';
        
        const firstLetter = (userInfo.username || '?').charAt(0).toUpperCase();
        
        item.innerHTML = `
            <div class="user-avatar online">
                ${firstLetter}
                <button class="user-call-btn" title="Call">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
            <span class="user-name">${userInfo.username}</span>
        `;
        
        // Call button action
        const btn = item.querySelector('.user-call-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevent triggering parent click
                startCall(uid);
            };
        }
        
        usersStrip.appendChild(item);
      }
    });
  }

  function showWelcomeMessage() {
      if(!msgArea) return;
      
      const div = document.createElement('div');
      div.className = 'message-bubble system';
      div.innerHTML = `
        <strong>Добро пожаловать в чат Эмилии!</strong><br>
        Вы можете обмениваться сообщениями и совершать звонки через Jitsi.<br>
        Нажмите на <i class="fas fa-phone"></i> рядом с именем пользователя в сети.
      `;
      
      msgArea.appendChild(div);
      msgArea.scrollTop = msgArea.scrollHeight;
      welcomeMessageShown = true;
  }

  function openJitsiRoom(roomName) {
    // 1. Audio wakeup for iOS Safari
    const silentAudio = document.createElement('audio');
    silentAudio.autoplay = true; // Might be blocked without user interaction context, but worth a shot if inside a click handler
    silentAudio.play().catch(e => console.log("Audio wakeup attempt:", e));

    // 2. Updated URL with Config
    const url = `https://meet.ffmuc.net/${roomName}#config.startWithAudioMuted=false&config.prejoinPageEnabled=false&config.startWithVideoMuted=false`;
    window.open(url, '_blank');
  }

  function startCall(targetUserId) {
    if (!auth.currentUser) return;
    const roomName = 'Emiliia_' + Date.now();
    
    openJitsiRoom(roomName);
    
    const targetCallRef = ref(db, 'calls/' + targetUserId);
    set(targetCallRef, {
      from: auth.currentUser.uid,
      fromName: auth.currentUser.displayName || 'Guest',
      room: roomName,
      status: 'ringing'
    });
    
    onDisconnect(targetCallRef).remove();
  }

} catch (globalError) {
  console.error("CRITICAL ERROR IN VOICE CHAT:", globalError);
}
