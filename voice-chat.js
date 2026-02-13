
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
let currentCall = null;

// --- FIREBASE LOGIC ---

// --- AUTH STATE LISTENER ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Auth state changed: User logged in", user.uid);
    const name = user.displayName || user.email.split('@')[0];
    onUserAuth(user.uid, name);
  } else {
    console.log("Auth state changed: User logged out");
    // Сброс UI
    if (loginPanel) loginPanel.classList.remove('hidden');
    if (usersPanel) usersPanel.classList.add('hidden');
    if (usersList) usersList.innerHTML = '';
  }
});

function saveUserToDB(userId, name) {
  // Ссылка на пользователя
  const userRef = ref(db, 'users/' + userId);
  
  set(userRef, {
    username: name,
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
  
  // Toggle виджета
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      console.log("Voice Chat: Toggle button clicked");
      if (content) {
        content.classList.toggle('hidden');
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
  
  // Слушаем список пользователей
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snapshot) => {
    updateUserList(snapshot.val(), userId);
  });
  
  // Слушаем входящие вызовы
  const incomingCallRef = ref(db, 'users/' + userId + '/incomingCall');
  onValue(incomingCallRef, (snapshot) => {
    const callData = snapshot.val();
    if (callData) {
      console.log("Входящий вызов:", callData);
      showIncomingCallModal(callData, userId);
    } else {
      // Если вызов отменен или принят
      if (!callModal.classList.contains('hidden')) {
        callModal.classList.add('hidden');
      }
    }
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
        <button class="vc-call-btn" onclick="startCall('${uid}', '${userInfo.username}')" title="Call">
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

// ... (код чата без изменений) ...

// --- JITSI ЗВОНКИ ---

// Глобальная функция для вызова из HTML
window.startCall = (targetUserId, targetUserName) => {
  const currentUserId = auth.currentUser.uid;
  const currentUserName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
  
  // 1. Генерируем ID комнаты
  const roomName = 'EmiliiaChat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  console.log(`Starting call to ${targetUserName} in room: ${roomName}`);
  
  // 2. Открываем Jitsi СРАЗУ (синхронно, чтобы не заблокировал Safari)
  openJitsiRoom(roomName);
  
  // 3. Записываем приглашение в Firebase (асинхронно в фоне)
  const callRef = ref(db, 'users/' + targetUserId + '/incomingCall');
  set(callRef, {
    from: currentUserId,
    fromName: currentUserName,
    room: roomName,
    timestamp: Date.now()
  }).catch(error => {
    console.error("Ошибка отправки вызова:", error);
    alert("Не удалось отправить уведомление о звонке: " + error.message);
  });
};

let currentIncomingCallData = null;

function showIncomingCallModal(callData, myUserId) {
  currentIncomingCallData = callData;
  incomingName.textContent = "Входящий звонок от " + callData.fromName;
  callModal.classList.remove('hidden');
  
  // Сохраняем myUserId в замыкании для accept/reject
  callModal.dataset.userId = myUserId;
}

function acceptCall() {
  if (!currentIncomingCallData) return;
  
  const roomName = currentIncomingCallData.room;
  // const myUserId = callModal.dataset.userId; // Не обязательно, используем auth
  
  console.log("Accepting call, joining room:", roomName);
  
  // 1. Открываем Jitsi СРАЗУ
  openJitsiRoom(roomName);
  
  // 2. Очищаем приглашение в БД (асинхронно)
  const callRef = ref(db, 'users/' + auth.currentUser.uid + '/incomingCall');
  remove(callRef).then(() => {
      callModal.classList.add('hidden');
      currentIncomingCallData = null;
  }).catch(err => console.error("Ошибка при принятии звонка:", err));
}

async function rejectCall() {
  if (!currentIncomingCallData) return;
  
  console.log("Rejecting call");
  
  // Очищаем приглашение
  const callRef = ref(db, 'users/' + auth.currentUser.uid + '/incomingCall');
  await remove(callRef);
  
  callModal.classList.add('hidden');
  currentIncomingCallData = null;
}

function openJitsiRoom(roomName) {
  // Открываем в новой вкладке - самый надежный способ для iOS Safari
  // Используем публичный бесплатный сервер meet.jit.si
  const url = `https://meet.jit.si/${roomName}`;
  window.open(url, '_blank');
}

// --- UTILS ---
// (Функции микрофона и аудио больше не нужны для Jitsi в iframe/new window, но можно оставить для отладки или удалить)
async function testMicrophone() {
    console.log("Testing microphone...");
    // Jitsi сам проверит микрофон, эта функция теперь чисто информативная
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        alert("Микрофон доступен! Jitsi должен работать корректно.");
    } catch (err) {
        alert("Ошибка доступа к микрофону: " + err.message);
    }
}
