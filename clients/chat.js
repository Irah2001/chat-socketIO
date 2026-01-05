class ChatApp {
    constructor() {
        this.API_URL = 'http://localhost:3000';
        this.socket = null;
        this.user = null;
        this.currentRoom = '';
        this.typingTimeout = null;

        this.dom = {
            loginScreen: document.getElementById('login-screen'),
            chatContainer: document.getElementById('chat-container'),
            loginForm: document.getElementById('login-form'),
            loginError: document.getElementById('login-error'),
            messages: document.getElementById('messages'),
            messageForm: document.getElementById('message-form'),
            messageInput: document.getElementById('message-input'),
            roomList: document.getElementById('rooms-list'),
            userList: document.getElementById('user-list'),
            typingIndicator: document.getElementById('typing-indicator'),
            roomTitle: document.getElementById('current-room-name'),
            adminPanel: document.getElementById('admin-panel'),
            btnCreateRoom: document.getElementById('btn-create-room'),
            btnLogout: document.getElementById('btn-logout'),
            inputNewRoom: document.getElementById('new-room-name'),
            inputNickname: document.getElementById('new-nickname-input'),
            btnChangeNick: document.getElementById('btn-change-nick'),
            loginTitle: document.getElementById('login-title'),
            loginSubtitle: document.getElementById('login-subtitle'),
            passwordContainer: document.getElementById('password-container'),
            loginPassword: document.getElementById('login-password'),
            toggleAdmin: document.getElementById('toggle-admin'),
            errorText: document.getElementById('error-text'),
        };

        this.init();
    }

    init() {
        this.dom.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.dom.toggleAdmin.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAdminMode();
        });

        this.dom.messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));

        this.dom.messageInput.addEventListener('input', () => this.handleTyping());

        this.dom.btnChangeNick.addEventListener('click', () => this.changeNickname());

        this.dom.btnCreateRoom.addEventListener('click', () => this.createRoom());
        this.dom.btnLogout.addEventListener('click', () => this.logout());
    }

    // --- Gestion Authentification ---
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const endpoint = this.isAdminMode ? '/auth/login' : '/auth/guest';
        const payload = this.isAdminMode 
            ? { username, password } 
            : { username };

        try {
            const res = await fetch(`${this.API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Échec de la connexion');
            }

            const data = await res.json();

            this.user = { 
                username: data.username, 
                role: data.role, 
                token: data.access_token 
            };

            this.startChatSession();
        } catch (err) {
            console.error(err);
            this.dom.errorText.textContent = err.message;
            this.dom.loginError.style.display = 'block';
        }
    }

    toggleAdminMode() {
        this.isAdminMode = !this.isAdminMode;
        
        if (this.isAdminMode) {
            this.dom.passwordContainer.style.display = 'block';
            this.dom.loginPassword.setAttribute('required', 'true');
            this.dom.loginTitle.textContent = "Connexion Admin";
            this.dom.loginSubtitle.textContent = "Veuillez saisir vos identifiants.";
            this.dom.toggleAdmin.innerHTML = '<i class="fas fa-user"></i> Retour mode Invité';
        } else {
            this.dom.passwordContainer.style.display = 'none';
            this.dom.loginPassword.removeAttribute('required');
            this.dom.loginTitle.textContent = "Bienvenue";
            this.dom.loginSubtitle.textContent = "Choisissez un pseudo pour rejoindre le chat.";
            this.dom.toggleAdmin.innerHTML = '<i class="fas fa-lock"></i> Accès Administrateur';
        }
    }

    logout() {
        if (this.socket) this.socket.disconnect();
        this.user = null;
        this.currentRoom = '';
        this.resetUI();
    }

    // --- Gestion Socket ---
    startChatSession() {
        // UI Switch
        this.dom.loginScreen.style.display = 'none';
        this.dom.chatContainer.style.display = 'flex';
        this.dom.loginError.style.display = 'none';

        if (this.user.role === 'admin') {
            this.dom.adminPanel.style.display = 'block';
        }

        // Connexion Socket
        this.socket = io(this.API_URL, {
            auth: { token: this.user.token }
        });

        this.setupSocketListeners();
    }

    setupSocketListeners() {
        const s = this.socket;

        s.on('connect_error', () => {
            alert("Erreur d'authentification");
            this.logout();
        });

        s.on('joinedRoom', (room) => {
            this.currentRoom = room;
            this.dom.roomTitle.textContent = room;
            this.dom.messages.innerHTML = '';
            this.updateActiveRoomButton();
        });

        s.on('roomList', (rooms) => this.renderRooms(rooms));
        s.on('users', (users) => this.renderUsers(users));
        s.on('message', (data) => this.renderMessage(data));
        s.on('error', (msg) => alert("⚠️ " + msg));
        
        s.on('userTyping', (data) => {
            const el = this.dom.typingIndicator;
            if (data.isTyping) {
                el.textContent = `${data.username} écrit...`;
                el.classList.add('typing-dots');
            } else {
                el.textContent = '';
                el.classList.remove('typing-dots');
            }
        });

        s.on('nicknameUpdated', (newNick) => {
            this.user.username = newNick;
            alert(`Pseudo changé en : ${newNick}`);
            this.dom.inputNickname.value = '';
        });
    }

    // --- Actions Chat ---
    handleSendMessage(e) {
        e.preventDefault();
        const content = this.dom.messageInput.value.trim();
        if (content && this.socket) {
            this.socket.emit('message', { content });
            this.socket.emit('typing', false);
            clearTimeout(this.typingTimeout);
            this.dom.messageInput.value = '';
        }
    }

    handleTyping() {
        if (!this.socket) return;
        this.socket.emit('typing', true);
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('typing', false);
        }, 2000);
    }

    switchRoom(roomName) {
        if (this.currentRoom === roomName) return;
        this.socket.emit('joinRoom', roomName);
    }

    createRoom() {
        const name = this.dom.inputNewRoom.value.trim();
        if (name) {
            this.socket.emit('createRoom', name);
            this.dom.inputNewRoom.value = '';
        }
    }

    deleteRoom(name) {
        if (confirm(`Supprimer la salle "${name}" ?`)) {
            this.socket.emit('deleteRoom', name);
        }
    }

    // --- Rendu UI ---
    renderRooms(rooms) {
        const container = this.dom.roomList;
        container.innerHTML = '';

        // Ajout manuel de Support pour l'admin si pas présent
        if (this.user.role === 'admin' && !rooms.includes('Support')) {
            this.renderRoomButton('Support', container);
        }

        rooms.forEach(room => this.renderRoomButton(room, container));
        this.updateActiveRoomButton();
    }

    renderRoomButton(roomName, container) {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;';

        const btn = document.createElement('button');
        btn.className = 'room-btn';
        btn.innerHTML = `<i class="fas fa-hashtag"></i> ${roomName}`;
        btn.dataset.room = roomName;
        btn.onclick = () => this.switchRoom(roomName);
        btn.style.cssText = 'width:100%; margin:0;';

        div.appendChild(btn);

        if (this.user.role === 'admin' && roomName !== 'Lobby' && roomName !== 'Support') {
            const delIcon = document.createElement('i');
            delIcon.className = 'fas fa-trash delete-room-btn';
            delIcon.style.marginLeft = '10px';
            delIcon.style.cursor = 'pointer';
            delIcon.style.color = '#dc3545';
            delIcon.onclick = () => this.deleteRoom(roomName);
            div.appendChild(delIcon);
        }

        container.appendChild(div);
    }

    renderUsers(users) {
        this.dom.userList.innerHTML = '';
        users.forEach(u => {
            const li = document.createElement('li');
            const badgeClass = u.role === 'admin' ? 'role-admin' : 'role-user';
            li.innerHTML = `${u.username} <span class="role-badge ${badgeClass}">${u.role}</span>`;
            this.dom.userList.appendChild(li);
        });
    }

    renderMessage(data) {
        const item = document.createElement('div');
        item.classList.add('message-item');

        if (data.role === 'system') {
            item.classList.add('system-message');
            item.innerHTML = `<i class="fas fa-info-circle"></i> ${data.content}`;
            this.dom.messages.appendChild(item);
            this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
            return;
        }
        
        const isMe = data.sender === this.user.username;
        item.classList.add(isMe ? 'self-message' : 'other-message');

        const date = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const badge = data.role === 'admin' ? '<span class="role-badge role-admin">ADMIN</span>' : '';

        item.innerHTML = `
            <div class="message-header">
                ${isMe ? date : `${data.sender} ${badge} • ${date}`}
            </div>
            <div class="message-content">${data.content}</div>
        `;

        this.dom.messages.appendChild(item);
        this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }

    updateActiveRoomButton() {
        document.querySelectorAll('.room-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.room === this.currentRoom) btn.classList.add('active');
        });
    }

    resetUI() {
        this.dom.messages.innerHTML = '';
        this.dom.userList.innerHTML = '';
        document.getElementById('login-password').value = '';
        this.dom.adminPanel.style.display = 'none';
        this.dom.chatContainer.style.display = 'none';
        this.dom.loginScreen.style.display = 'flex';
    }

    changeNickname() {
        const newNick = this.dom.inputNickname.value.trim();
        if (newNick && this.socket) {
            this.socket.emit('changeNickname', newNick);
        }
    }
}

// Démarrage de l'application
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});