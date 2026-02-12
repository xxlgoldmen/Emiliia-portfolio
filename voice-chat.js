
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, onDisconnect, remove, get } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

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

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Добавлена аналитика
const auth = getAuth(app);
const db = getDatabase(app);

// Глобальные переменные
let peer = null;
let localStream = null;
let currentCall = null;
let myPeerId = null;
let remoteAudio = null; // Будет инициализирован из DOM

// --- PEERJS ИНИЦИАЛИЗАЦИЯ ---
function initPeer(userId, userName) {
  if (peer) {
      console.log("PeerJS already initialized, skipping.");
      return;
  }

  // Санитизация ID: удаляем все спецсимволы, оставляем только буквы и цифры
  // PeerJS иногда капризничает с дефисами или подчеркиваниями в ID
  const cleanUserId = userId.replace(/[^a-zA-Z0-9]/g, '');

  console.log("Initializing PeerJS with ID:", cleanUserId);

  // Используем user.uid (очищенный) как фиксированный Peer ID
  peer = new Peer(cleanUserId, {
    host: 'peerjs.com',
    secure: true,
    path: '/',
    debug: 2,
    config: {
      'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' },
        { 'urls': 'stun:global.stun.twilio.com:3478' }
      ]
    }
  });

  peer.on('open', (id) => {
    myPeerId = id;
    console.log('My Peer ID:', id);
    
    // Сохраняем пользователя в Realtime Database
    saveUserToDB(userId, userName, id);
  });

  peer.on('call', (call) => {
    // Входящий звонок
    console.log("Входящий звонок от:", call.peer);
    showIncomingCallModal(call);
  });
  
  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    // Выводим ошибку в чат
    addSystemMessageToChat(`PeerJS Error (${err.type}): ${err.message}`);
    alert('Peer Error: ' + err.type); // ALERT для телефона
    
    // Игнорируем ошибки типа 'peer-unavailable', если пользователь отключился
    if (err.type !== 'peer-unavailable') {
        // alert('Ошибка соединения P2P: ' + err.type); // Дубликат убираем
    }
  });
}

function addSystemMessageToChat(text) {
    const chatMessages = document.getElementById('vc-chat-messages');
    if (chatMessages) {
        const div = document.createElement('div');
        div.className = "vc-message system-message";
        div.style.marginBottom = "4px";
        div.style.fontSize = "0.75rem";
        div.style.color = "red";
        div.innerHTML = `<strong>System:</strong> ${text}`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// --- FIREBASE LOGIC ---

// --- AUTH STATE LISTENER ---
// Перенесли инициализацию сюда
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Auth state changed: User logged in", user.uid);
    const name = user.displayName || user.email.split('@')[0];
    onUserAuth(user.uid, name);
  } else {
    console.log("Auth state changed: User logged out");
    if (peer) {
        peer.destroy();
        peer = null;
    }
    // Сброс UI
    if (loginPanel) loginPanel.classList.remove('hidden');
    if (usersPanel) usersPanel.classList.add('hidden');
    if (usersList) usersList.innerHTML = '';
  }
});

function saveUserToDB(userId, name, peerId) {
  // Ссылка на пользователя
  const userRef = ref(db, 'users/' + userId);
  
  set(userRef, {
    username: name,
    peerId: peerId,
    status: 'online'
  });

  // Удалять пользователя при отключении
  onDisconnect(userRef).remove();
}

// --- UI LOGIC ---
let chatWidget, loginPanel, usersPanel, usersList, callModal, incomingName;

function initVoiceChat() {
  console.log("Voice Chat: Start initialization...");
  
  chatWidget = document.getElementById('voice-chat-widget');
  loginPanel = document.getElementById('vc-login-panel');
  usersPanel = document.getElementById('vc-users-panel');
  usersList = document.getElementById('vc-users-list');
  callModal = document.getElementById('vc-call-modal');
  incomingName = document.getElementById('vc-incoming-name');
  
  // Инициализация аудио элемента
  remoteAudio = document.getElementById('remote-audio');
  if (!remoteAudio) {
      console.warn("Remote audio element not found, creating new Audio()");
      remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.playsInline = true;
  } else {
      console.log("Remote audio element found in DOM");
  }

  // Логирование наличия элементов
  const toggleBtn = document.getElementById('vc-toggle-btn');
  const content = document.getElementById('vc-content');
  
  console.log("Voice Chat: Toggle button exists?", !!toggleBtn);
  console.log("Voice Chat: Content exists?", !!content);

  // Обработчики кнопок
  document.getElementById('vc-login-btn')?.addEventListener('click', handleLogin);
  document.getElementById('vc-register-btn')?.addEventListener('click', handleRegister);
  document.getElementById('vc-logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('vc-accept-call')?.addEventListener('click', acceptCall);
  document.getElementById('vc-reject-call')?.addEventListener('click', rejectCall);
  document.getElementById('vc-end-call')?.addEventListener('click', endCurrentCall);
  document.getElementById('vc-test-mic-btn')?.addEventListener('click', testMicrophone);

  // Toggle виджета
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      console.log("Voice Chat: Toggle button clicked");
      if (content) {
        content.classList.toggle('hidden');
        console.log("Voice Chat: Content hidden state:", content.classList.contains('hidden'));
      } else {
        console.error("Voice Chat: Content element not found!");
      }
    });
  } else {
    console.error("Voice Chat: Toggle button not found during init!");
  }
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceChat);
} else {
  initVoiceChat();
}

// --- АУТЕНТИФИКАЦИЯ ---

function getFirebaseErrorMessage(error) {
  console.error("Firebase Error Details:", error);
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Этот email уже используется. Попробуйте войти.';
    case 'auth/invalid-email':
      return 'Некорректный формат email.';
    case 'auth/operation-not-allowed':
      return 'Ошибка конфигурации: Вход по Email/Паролю не включен в Firebase Console. Включите Provider "Email/Password" в разделе Authentication -> Sign-in method.';
    case 'auth/weak-password':
      return 'Пароль слишком простой. Используйте минимум 6 символов.';
    case 'auth/user-disabled':
      return 'Этот пользователь заблокирован.';
    case 'auth/user-not-found':
      return 'Пользователь с таким email не найден.';
    case 'auth/wrong-password':
      return 'Неверный пароль.';
    case 'auth/network-request-failed':
      return 'Ошибка сети. Проверьте подключение к интернету.';
    case 'auth/invalid-credential':
      return 'Неверный email или пароль. Если вы еще не зарегистрированы, нажмите кнопку "Регистрация".';
    default:
      return `Ошибка (${error.code}): ${error.message}`;
  }
}

async function handleLogin() {
  const email = document.getElementById('vc-email').value;
  const password = document.getElementById('vc-password').value;
  
  if (!email || !password) {
    alert("Пожалуйста, введите email и пароль");
    return;
  }

  console.log("Voice Chat: Attempting login for", email);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged сработает автоматически
  } catch (error) {
    console.error("Voice Chat: Login failed", error);
    alert(getFirebaseErrorMessage(error));
  }
}

async function handleRegister() {
  const email = document.getElementById('vc-email').value;
  const password = document.getElementById('vc-password').value;
  
  if (!email || !password) {
    alert("Пожалуйста, введите email и пароль");
    return;
  }
  
  console.log("Voice Chat: Attempting registration for", email);

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged сработает автоматически
  } catch (error) {
    console.error("Voice Chat: Registration failed", error);
    alert(getFirebaseErrorMessage(error));
  }
}

function handleLogout() {
  signOut(auth).then(() => {
    // onAuthStateChanged сработает автоматически
  });
}

function onUserAuth(userId, userName) {
  // Убедимся, что элементы найдены (на случай если вызов раньше DOMContentLoaded)
  if (!loginPanel || !usersPanel) {
      initVoiceChat(); // Попытка инициализации если null
  }
  if (loginPanel) loginPanel.classList.add('hidden');
  if (usersPanel) usersPanel.classList.remove('hidden');
  
  // Инициализация PeerJS
  // initPeer(userId, userName); -> УБРАНО! Теперь только по кнопке.
  
  // Показываем кнопку активации
  const activateBtn = document.getElementById('vc-activate-btn');
  const activationArea = document.getElementById('vc-activation-area');
  
  if (activateBtn && activationArea) {
      activationArea.classList.remove('hidden');
      // Удаляем старые слушатели (клонированием)
      const newBtn = activateBtn.cloneNode(true);
      activateBtn.parentNode.replaceChild(newBtn, activateBtn);
      
      newBtn.addEventListener('click', async () => {
          try {
              console.log("Activating voice chat...");
              newBtn.disabled = true;
              newBtn.textContent = "Подключение...";
              
              // 1. Resume AudioContext
              await resumeAudioContext();
              
              // 2. Get UserMedia
              localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
              console.log("Microphone access granted for activation");
              
              // 3. Init Peer
              initPeer(userId, userName);
              
              // Скрываем кнопку после успеха
              activationArea.classList.add('hidden');
              
          } catch (err) {
              console.error("Activation failed:", err);
              alert("Ошибка активации: " + err.message);
              newBtn.disabled = false;
              newBtn.textContent = "Попробовать снова";
          }
      });
  }
  
  // Слушаем список пользователей
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snapshot) => {
    updateUserList(snapshot.val(), userId);
  });
  
  // Инициализация чата
  initChat(userId, userName);
}

function updateUserList(data, currentUserId) {
  usersList.innerHTML = '';
  
  if (!data) {
    usersList.innerHTML = '<li class="text-center text-sm text-gray-500">Никого нет онлайн</li>';
    return;
  }

  let hasOtherUsers = false;

  Object.entries(data).forEach(([uid, userInfo]) => {
    if (uid !== currentUserId) { // Не показываем себя
      hasOtherUsers = true;
      const li = document.createElement('li');
      li.className = "vc-user-item";
      li.innerHTML = `
        <span>${userInfo.username}</span>
        <button class="vc-call-btn" onclick="startCall('${userInfo.peerId}', '${userInfo.username}')" title="Call">
          <i class="fa-solid fa-phone"></i>
        </button>
      `;
      usersList.appendChild(li);
    }
  });

  if (!hasOtherUsers) {
    usersList.innerHTML = '<li class="text-center text-sm text-gray-500">Никого нет онлайн (только вы)</li>';
  }
}

// --- TEXT CHAT ---
function initChat(userId, userName) {
  const chatInput = document.getElementById('vc-chat-input');
  const chatSendBtn = document.getElementById('vc-chat-send-btn');
  const chatMessages = document.getElementById('vc-chat-messages');

  if (!chatInput || !chatSendBtn || !chatMessages) return;

  // Отправка сообщений
  const sendMessage = () => {
    const text = chatInput.value.trim();
    if (!text) return;

    const msgRef = ref(db, 'messages/' + Date.now());
    set(msgRef, {
      sender: userName,
      text: text,
      timestamp: Date.now()
    });
    chatInput.value = '';
  };

  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Получение сообщений
  const messagesRef = ref(db, 'messages');
  // Ограничиваем последними 50 сообщениями
  // (В реальном проекте лучше использовать query и limitToLast, но здесь упростим)
  onValue(messagesRef, (snapshot) => {
    chatMessages.innerHTML = '';
    const msgs = snapshot.val();
    if (msgs) {
      // Преобразуем в массив и сортируем
      const msgArray = Object.values(msgs).sort((a, b) => a.timestamp - b.timestamp);
      // Берем последние 20
      msgArray.slice(-20).forEach(msg => {
        const div = document.createElement('div');
        div.className = "vc-message";
        div.style.marginBottom = "4px";
        div.style.fontSize = "0.85rem";
        div.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
        chatMessages.appendChild(div);
      });
      // Автоскролл вниз
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
}

// --- ЗВОНКИ ---

// Глобальная функция для вызова из HTML
window.startCall = async (remotePeerId, remoteName) => {
  console.log("Starting call to:", remoteName);
  
  try {
    // 1. Сначала запрашиваем доступ к микрофону (GetUserMedia)
    // Это должно быть ПЕРВЫМ действием после клика.
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // 2. "Будим" AudioContext (для iOS Safari)
    await resumeAudioContext();
    
    // 3. Только когда есть поток и аудио готово — звоним
    const call = peer.call(remotePeerId, localStream);
    handleCallStream(call);
    
    alert(`Звоним пользователю ${remoteName}...`);
    currentCall = call;
    
    // Показываем кнопку сброса
    document.getElementById('vc-active-call-controls').classList.remove('hidden');
    
  } catch (err) {
    console.error("Ошибка доступа к медиа:", err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Пожалуйста, разрешите доступ к микрофону в настройках Safari или вашего браузера.');
    } else {
        alert("Не удалось получить доступ к микрофону: " + err.message);
    }
  }
};

let incomingCallInstance = null;

function showIncomingCallModal(call) {
  incomingCallInstance = call;
  incomingName.textContent = "Входящий звонок..."; // Можно передать метаданные, если PeerJS позволяет, или искать по ID
  callModal.classList.remove('hidden');
}

async function acceptCall() {
  console.log("Accepting call...");
  
  callModal.classList.add('hidden');
  
  try {
    // 1. Сначала микрофон
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    // 2. Будим аудио
    await resumeAudioContext();
    
    // 3. Отвечаем на звонок
    if (incomingCallInstance) {
      incomingCallInstance.answer(localStream);
      handleCallStream(incomingCallInstance);
      currentCall = incomingCallInstance;
      document.getElementById('vc-active-call-controls').classList.remove('hidden');
    } else {
      console.error("No incoming call instance found!");
    }
  } catch (err) {
    console.error(err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Пожалуйста, разрешите доступ к микрофону в настройках Safari или вашего браузера.');
    } else {
        alert("Ошибка при принятии вызова: " + err.message);
    }
  }
}

function rejectCall() {
  if (incomingCallInstance) {
    incomingCallInstance.close();
  }
  callModal.classList.add('hidden');
}

function endCurrentCall() {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (remoteAudio) {
      remoteAudio.srcObject = null;
  }
  document.getElementById('vc-active-call-controls').classList.add('hidden');
  // Не показываем алерт, так как это действие пользователя, 
  // но можно оставить, если нужно подтверждение.
  // alert("Звонок завершен"); 
}

function handleCallStream(call) {
  call.on('stream', (remoteStream) => {
    // Воспроизведение удаленного звука
    remoteAudio.srcObject = remoteStream;
    // play() может требовать взаимодействия, но мы уже кликнули
    remoteAudio.play().catch(e => console.error("Auto-play failed", e));
  });
  
  call.on('close', () => {
    endCurrentCall();
  });
}

// --- UTILS ---
async function testMicrophone() {
    console.log("Testing microphone...");
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        alert("ВНИМАНИЕ: Ваш сайт работает по HTTP. На iPhone и большинстве устройств доступ к микрофону работает ТОЛЬКО по HTTPS!");
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone access granted");
        alert("Успех! Браузер дал доступ к микрофону.\nTracks: " + stream.getAudioTracks().length);
        
        // Сразу останавливаем, это только тест
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {
        console.error("Microphone test failed:", err);
        alert(`Ошибка доступа к микрофону:\nName: ${err.name}\nMessage: ${err.message}`);
    }
}

// Хак для iOS AudioContext
async function resumeAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Создаем тишину, чтобы "разбудить" аудио
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.001; // Почти тишина
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(0);
    setTimeout(() => oscillator.stop(), 100);
  }
}
