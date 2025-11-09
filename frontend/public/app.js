// Configuration
const BACKEND_URL = window.location.origin;
const API = `${BACKEND_URL}/api`;

// State
let currentSession = null;
let currentMode = 'casual';
let selectedFile = null;
let isTyping = false;

// Mode descriptions
const modeDescriptions = {
    casual: 'Rahat ve samimi sohbet',
    formal: 'Profesyonel ve resmi iletişim',
    professional: 'Detaylı ve teknik açıklamalar'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    createSession();
    autoResize(document.getElementById('messageInput'));
});

// Create new session
async function createSession() {
    try {
        const response = await fetch(`${API}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mode: currentMode })
        });
        
        const data = await response.json();
        currentSession = data.session_id;
        console.log('Session created:', currentSession);
    } catch (error) {
        console.error('Error creating session:', error);
        showToast('Hata', 'Oturum oluşturulamadı');
    }
}

// Select mode
function selectMode(mode) {
    currentMode = mode;
    
    // Update UI
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.mode === mode) {
            tab.classList.add('active');
        }
    });
    
    // Update description
    document.getElementById('modeDescription').textContent = modeDescriptions[mode];
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message && !selectedFile) return;
    if (!currentSession) {
        showToast('Hata', 'Oturum bulunamadı');
        return;
    }
    
    // Hide empty state
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    
    // Add user message to UI
    addMessage('user', message, selectedFile);
    
    // Clear input
    input.value = '';
    autoResize(input);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Upload file if exists
        let fileId = null;
        if (selectedFile) {
            fileId = await uploadFile(selectedFile);
            selectedFile = null;
            document.getElementById('filePreview').style.display = 'none';
        }
        
        // Send message to API
        const response = await fetch(`${API}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentSession,
                message: message,
                mode: currentMode,
                file_id: fileId
            })
        });
        
        const data = await response.json();
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add assistant message
        addMessage('assistant', data.assistant_message.content);
        
    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        showToast('Hata', 'Mesaj gönderilemedi');
    }
}

// Add message to chat
function addMessage(role, content, file = null) {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (file) {
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.style.marginBottom = '8px';
        fileInfo.style.opacity = '0.8';
        fileInfo.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>${file.name}</span>
        `;
        messageContent.appendChild(fileInfo);
    }
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = content;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageTime);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = 'typingIndicator';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    
    typingContent.appendChild(typingIndicator);
    typingDiv.appendChild(typingContent);
    chatMessages.appendChild(typingDiv);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    isTyping = true;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
    isTyping = false;
}

// File handling
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;
        
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('filePreview').style.display = 'flex';
        
        showToast('Dosya seçildi', file.name);
    }
}

function removeFile() {
    selectedFile = null;
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('fileInput').value = '';
}

async function uploadFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        return data.file_id;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

// Start new chat
async function startNewChat() {
    // Clear messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="empty-state" id="emptyState">
            <div class="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <h3>Hamsi AI'ya Hoş Geldiniz</h3>
            <p>Size nasıl yardımcı olabilirim? Sorularınızı sorabilir, dosya yükleyebilir veya konuşma modunu seçerek başlayabilirsiniz.</p>
        </div>
    `;
    
    // Clear file
    removeFile();
    
    // Create new session
    await createSession();
    
    showToast('Yeni sohbet başlatıldı', 'Temiz bir sayfa ile başlayabilirsiniz');
}

// Toast notification
function showToast(title, description) {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div>
            <div class="toast-title">${title}</div>
            <div class="toast-description">${description}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Auto-resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// Handle keyboard
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}
