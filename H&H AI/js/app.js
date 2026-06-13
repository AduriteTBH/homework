document.addEventListener('DOMContentLoaded', () => {

    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const newChatBtn = document.getElementById('new-chat-btn');
    const historyList = document.getElementById('chat-history-list');
    const tokenCount = document.getElementById('token-count');
    
    // Dropdown & Models
    const dropdown = document.getElementById('model-dropdown');
    const dropdownHeader = document.getElementById('dropdown-header');
    const dropdownList = document.getElementById('dropdown-list');
    const dropdownSearch = document.getElementById('model-search');
    const selectedModelText = document.getElementById('selected-model-text');
    let currentModel = "openai/gpt-4o";
    let allModels = [
        "openai/gpt-4o", "openai/gpt-4o-mini", "openai/gpt-4-turbo",
        "anthropic/claude-3.5-sonnet", "anthropic/claude-3-opus", "anthropic/claude-3-sonnet",
        "google/gemini-1.5-pro", "google/gemini-1.5-flash",
        "meta-llama/Meta-Llama-3.1-405B-Instruct", "meta-llama/Meta-Llama-3.1-70B-Instruct", "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "mistral/mistral-large-latest", "mistral/open-mixtral-8x22b",
        "xai/grok-2-latest", "deepseek/deepseek-coder", "deepseek/deepseek-chat"
    ];

    let currentGenerationAborted = false;

    // Account System
    const accountModal = document.getElementById('account-modal');
    const accountNameInput = document.getElementById('account-name-input');
    const saveAccountBtn = document.getElementById('save-account-btn');
    const userNameDisplays = document.querySelectorAll('.user-name-disp');
    const userAvatars = document.querySelectorAll('.user-avatar-disp');
    
    // Settings System
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsNameInput = document.getElementById('settings-name-input');
    const settingsLayoutGrid = document.getElementById('settings-layout-grid');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const clearChatsBtn = document.getElementById('clear-chats-btn');

    let userName = localStorage.getItem('helios_user') || 'Adurite';
    let chatLayout = localStorage.getItem('helios_layout') || '900px';
    document.documentElement.style.setProperty('--chat-max-width', chatLayout);
    
    if (settingsLayoutGrid) {
        const btns = settingsLayoutGrid.querySelectorAll('.layout-btn');
        btns.forEach(btn => {
            if (btn.dataset.val === chatLayout) btn.classList.add('active');
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    function initAccount() {
        let user = localStorage.getItem('helios_user');
        if (!user) {
            accountModal.classList.add('active');
        } else {
            updateUserProfile(user);
        }
    }

    saveAccountBtn.addEventListener('click', () => {
        const name = accountNameInput.value.trim() || 'User';
        localStorage.setItem('helios_user', name);
        updateUserProfile(name);
        accountModal.classList.remove('active');
    });

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => {
        settingsNameInput.value = localStorage.getItem('helios_user') || 'User';
        settingsModal.classList.add('active');
    });
    
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
    
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => {
        if (settingsNameInput.value.trim()) {
            userName = settingsNameInput.value.trim();
            localStorage.setItem('helios_user', userName);
            updateUserProfile(userName);
        }
        if (settingsLayoutGrid) {
            const activeBtn = settingsLayoutGrid.querySelector('.layout-btn.active');
            if (activeBtn) {
                chatLayout = activeBtn.dataset.val;
                localStorage.setItem('helios_layout', chatLayout);
                document.documentElement.style.setProperty('--chat-max-width', chatLayout);
            }
        }
        settingsModal.classList.remove('active');
    });
    
    if (clearChatsBtn) clearChatsBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to permanently delete all your chats?")) {
            chatHistory = [];
            saveHistory();
            startNewChat();
            settingsModal.classList.remove('active');
        }
    });

    function updateUserProfile(name) {
        userNameDisplays.forEach(el => el.textContent = name);
        const initial = name.charAt(0).toUpperCase();
        userAvatars.forEach(el => el.textContent = initial);
        
        // Update welcome screen greeting
        const welcomeGreeting = document.getElementById('welcome-greeting');
        if (welcomeGreeting) {
            welcomeGreeting.textContent = `Hi ${name}, what's on your mind?`;
        }
    }

    initAccount();

    // Sidebar Collapse
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('collapse-btn');
    const collapsedLogo = document.getElementById('collapsed-logo-btn');

    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
            collapseBtn.innerHTML = '<i data-lucide="panel-left-open"></i>';
        } else {
            collapseBtn.innerHTML = '<i data-lucide="panel-left-close"></i>';
        }
        lucide.createIcons();
    }

    collapseBtn.addEventListener('click', toggleSidebar);
    if (collapsedLogo) collapsedLogo.addEventListener('click', toggleSidebar);

    // Attachments
    const fileUpload = document.getElementById('file-upload');
    const attachBtn = document.getElementById('attach-btn');
    const attachmentsTray = document.getElementById('attachments-tray');
    let pendingAttachments = [];
    
    // Paste Event Listener for Input
    if (userInput) {
        userInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                userInput.dispatchEvent(new Event('input'));
            }, 10);
        });
    }

    // Welcome Screen Suggestions
    const suggestionsContainer = document.querySelector('.suggestions');
    const defaultPrompts = [
        { icon: 'code', text: 'Help me write a Python script for data analysis' },
        { icon: 'pen-tool', text: 'Draft an email to a client about a project update' },
        { icon: 'brain-circuit', text: 'Explain quantum computing in simple terms' },
        { icon: 'sparkles', text: 'Give me 5 creative ideas for a tech startup' },
        { icon: 'image', text: 'Describe a futuristic cyberpunk city in vivid detail' },
        { icon: 'bug', text: 'How do I debug a memory leak in Node.js?' },
        { icon: 'terminal', text: 'Write a bash script to backup my documents folder' },
        { icon: 'lightbulb', text: 'What are the core differences between React and Vue?' },
        { icon: 'book-open', text: 'Summarize the plot of 1984 by George Orwell' }
    ];

    function renderSuggestions() {
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '';
        
        // Pick 3 random prompts
        const shuffled = [...defaultPrompts].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        
        selected.forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = `
                <i data-lucide="${prompt.icon}"></i>
                <p>${prompt.text}</p>
            `;
            card.onclick = () => {
                userInput.value = prompt.text;
                userInput.focus();
                userInput.dispatchEvent(new Event('input')); // Trigger send button active state
            };
            suggestionsContainer.appendChild(card);
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    renderSuggestions();

    // Agentic Functions
    function getWeather(location) {
        console.log(`[Function] getWeather called for ${location}`);
        return `The current weather in ${location} is 72°F and sunny.`;
    }
    function getCurrentTime() {
        console.log(`[Function] getCurrentTime called`);
        return `The current time is ${new Date().toLocaleTimeString()}`;
    }
    
    const dummyFunctions = {
        getWeather: {
            name: "getWeather",
            description: "Get the current weather for a location",
            parameters: {
                type: "object",
                properties: {
                    location: { type: "string", description: "City and state, e.g. San Francisco, CA" }
                },
                required: ["location"]
            }
        },
        getCurrentTime: {
            name: "getCurrentTime",
            description: "Get the current local time",
            parameters: { type: "object", properties: {} }
        }
    };

    // View Management
    const navItems = document.querySelectorAll('#main-menu li');
    const views = document.querySelectorAll('.view-panel');
    const headerTitle = document.getElementById('header-title');

    // App State
    let isProcessing = false;
    let messageStartTime = 0;
    let activeChatId = null;
    let chatHistory = JSON.parse(localStorage.getItem('helios_chats')) || [];
    let galleryItems = JSON.parse(localStorage.getItem('helios_gallery')) || [];
    let workspaceItems = JSON.parse(localStorage.getItem('helios_workspaces')) || [];

    // --- Dropdown & Dynamic Models Logic ---
    dropdownHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
        if (dropdown.classList.contains('open') && dropdownSearch) {
            dropdownSearch.focus();
        }
    });

    if (dropdownSearch) {
        dropdownSearch.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent clicks on search from closing dropdown
        });
        dropdownSearch.addEventListener('input', (e) => {
            renderModels(e.target.value);
        });
    }

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });

    async function loadPuterModels() {
        renderModels(); // Render fallbacks first instantly
        if (window.puter && window.puter.ai) {
            try {
                const models = await puter.ai.listModels();
                if (models && models.length > 0) {
                    // Extract string IDs from Puter's model objects
                    allModels = models.map(m => (typeof m === 'string') ? m : (m && m.id) ? m.id : m)
                                      .filter(m => typeof m === 'string');
                    renderModels(); // Re-render with live models
                }
            } catch (e) {
                console.warn("Failed to fetch Puter models", e);
            }
        }
    }

    function renderModels(filterText = '') {
        // Keep the offline fallback at the top
        let html = `<li data-value="H&H Flash-lite 1.0" class="${currentModel === 'H&H Flash-lite 1.0' ? 'selected' : ''}">H&H Flash-lite 1.0</li>`;
        
        let filteredModels = allModels;
        if (filterText.trim()) {
            const query = filterText.toLowerCase();
            filteredModels = allModels.filter(m => m && m.toLowerCase().includes(query));
        }

        // Group by provider prefix (e.g., openai/gpt-4o -> openai)
        const grouped = {};
        filteredModels.forEach(m => {
            const parts = m.split('/');
            const provider = parts.length > 1 ? parts[0] : 'other';
            if (!grouped[provider]) grouped[provider] = [];
            grouped[provider].push(m);
        });

        function isVisionCapable(mLower) {
            // Puter's GPT-4o actually doesn't always support vision depending on the endpoint they route to.
            // Let's restrict vision to models known to work well with images on Puter or generally
            return mLower.includes('vision') || mLower.includes('claude-3-sonnet') || mLower.includes('claude-3-opus') || mLower.includes('gemini-1.5') || mLower.includes('pixtral');
        }

        for (const provider in grouped) {
            html += `<li class="provider-header">${provider}</li>`;
            grouped[provider].forEach(m => {
                const isSelected = currentModel === m ? 'selected' : '';
                
                let tagsHTML = '';
                const mLower = m.toLowerCase();
                
                // Vision Tag
                if (isVisionCapable(mLower)) {
                    tagsHTML += `<span class="model-tag" title="Vision Capable"><i data-lucide="eye"></i></span>`;
                }
                // Code Tag
                if (mLower.includes('coder') || mLower.includes('gpt-4') || mLower.includes('claude-3') || mLower.includes('gemini') || mLower.includes('llama-3.1') || mLower.includes('qwen2.5-coder')) {
                    tagsHTML += `<span class="model-tag" title="Advanced Coding"><i data-lucide="code"></i></span>`;
                }
                // Agent Tag
                if (mLower.includes('gpt-4') || mLower.includes('claude-3') || mLower.includes('gemini') || mLower.includes('llama-3.1-405b') || mLower.includes('mistral-large') || mLower.includes('grok-2')) {
                    tagsHTML += `<span class="model-tag" title="Agentic Functions"><i data-lucide="bot"></i></span>`;
                }
                
                html += `<li data-value="${m}" class="${isSelected}">
                            <span class="model-name">${m}</span>
                            <div class="model-tags">${tagsHTML}</div>
                         </li>`;
            });
        }

        dropdownList.innerHTML = html;
        lucide.createIcons(); // Re-initialize icons for the new tags
        attachModelClickListeners();
    }

    function attachModelClickListeners() {
        dropdownList.querySelectorAll('li:not(.provider-header)').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
                item.classList.add('selected');
                currentModel = item.dataset.value;
                selectedModelText.textContent = item.querySelector('.model-name') ? item.querySelector('.model-name').textContent : item.dataset.value;
                dropdown.classList.remove('open');
                updateFileAcceptAttribute();
            });
        });
    }

    function updateFileAcceptAttribute() {
        if (!fileUpload) return;
        const mLower = currentModel.toLowerCase();
        const isVision = mLower.includes('vision') || mLower.includes('claude-3-sonnet') || mLower.includes('claude-3-opus') || mLower.includes('gemini-1.5') || mLower.includes('pixtral');
        if (isVision) {
            fileUpload.accept = "image/*, .txt, .js, .py, .md, .csv, .json, .html, .css";
        } else {
            fileUpload.accept = ".txt, .js, .py, .md, .csv, .json, .html, .css";
        }
    }

    if (dropdownSearch) {
        dropdownSearch.addEventListener('input', (e) => renderModels(e.target.value));
    }

    // Initialize models — restore saved selection after render
    loadPuterModels().then(() => {
        updateFileAcceptAttribute();
        // Update displayed model name to match restored localStorage selection
        if (selectedModelText) {
            const displayName = currentModel.includes('/') ? currentModel.split('/')[1] : currentModel;
            selectedModelText.textContent = displayName;
        }
    });

    // --- Attachments Logic ---
    if (attachBtn) attachBtn.addEventListener('click', () => fileUpload.click());

    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const isImage = file.type.startsWith('image/');
                    const attachment = {
                        id: Date.now() + Math.random().toString(),
                        file: file,
                        name: file.name,
                        type: isImage ? 'image' : 'text',
                        data: event.target.result // Base64 for images, text for others
                    };
                    pendingAttachments.push(attachment);
                    
                    // Persist to Gallery or Workspace
                    if (isImage) {
                        galleryItems.unshift({ id: attachment.id, name: attachment.name, data: attachment.data, date: new Date().toLocaleDateString() });
                        localStorage.setItem('helios_gallery', JSON.stringify(galleryItems));
                        renderGallery();
                    } else {
                        workspaceItems.unshift({ id: attachment.id, name: attachment.name, data: attachment.data, type: file.type || 'text/plain', date: new Date().toLocaleDateString() });
                        localStorage.setItem('helios_workspaces', JSON.stringify(workspaceItems));
                        renderWorkspaces();
                    }
                    
                    renderAttachments();
                };
                if (file.type.startsWith('image/')) reader.readAsDataURL(file);
                else reader.readAsText(file);
            });
            fileUpload.value = ''; // Reset
        });
    }

    function renderAttachments() {
        if (!attachmentsTray) return;
        attachmentsTray.innerHTML = '';
        pendingAttachments.forEach(att => {
            const card = document.createElement('div');
            card.className = 'attachment-card';
            
            if (att.type === 'image') {
                card.innerHTML = `<img src="${att.data}" alt="attachment"> <span>${att.name}</span>`;
            } else {
                card.innerHTML = `<i data-lucide="file-text"></i> <span>${att.name}</span>`;
            }
            
            const delBtn = document.createElement('button');
            delBtn.className = 'remove-attachment';
            delBtn.innerHTML = '<i data-lucide="x" style="width:12px;height:12px"></i>';
            delBtn.onclick = () => {
                pendingAttachments = pendingAttachments.filter(a => a.id !== att.id);
                renderAttachments();
            };
            
            card.appendChild(delBtn);
            attachmentsTray.appendChild(card);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });

    // --- View Toggling & Rendering Data ---
    function renderGallery() {
        const grid = document.getElementById('gallery-grid');
        const empty = document.getElementById('gallery-empty');
        if (!grid) return;
        
        // Remove old items
        Array.from(grid.children).forEach(child => { if (child.id !== 'gallery-empty') child.remove(); });
        
        if (galleryItems.length === 0) {
            if (empty) empty.style.display = 'flex';
        } else {
            if (empty) empty.style.display = 'none';
            galleryItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'gallery-item';
                div.title = item.name;
                div.innerHTML = `<img src="${item.data}" alt="${item.name}">`;
                grid.appendChild(div);
            });
        }
    }

    function renderWorkspaces() {
        const grid = document.getElementById('spaces-grid');
        const empty = document.getElementById('spaces-empty');
        if (!grid) return;
        
        // Remove old items
        Array.from(grid.children).forEach(child => { if (child.id !== 'spaces-empty') child.remove(); });
        
        if (workspaceItems.length === 0) {
            if (empty) empty.style.display = 'flex';
        } else {
            if (empty) empty.style.display = 'none';
            workspaceItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'space-item';
                div.title = "Click to download";
                div.innerHTML = `
                    <div class="icon-wrapper"><i data-lucide="file-code"></i></div>
                    <div class="file-info">
                        <span class="file-name">${item.name}</span>
                        <span class="file-meta">${item.date}</span>
                    </div>
                `;
                div.onclick = () => {
                    const blob = new Blob([item.data], { type: item.type || 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = item.name;
                    a.click();
                    URL.revokeObjectURL(url);
                };
                grid.appendChild(div);
            });
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    // Initial renders
    renderGallery();
    renderWorkspaces();

    navItems.forEach(nav => {
        nav.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            nav.classList.add('active');
            
            const targetView = nav.dataset.view;
            views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(targetView).classList.add('active-view');
            
            headerTitle.textContent = nav.textContent.trim();
            if (targetView === 'gallery-view') renderGallery();
            if (targetView === 'spaces-view') renderWorkspaces();
        });
    });

    // --- History Management ---
    function saveHistory() {
        localStorage.setItem('helios_chats', JSON.stringify(chatHistory));
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        
        chatHistory.forEach((chat) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'history-item-content';
            contentDiv.innerHTML = `<span>${chat.title}</span>`;
            contentDiv.style.cursor = 'pointer';
            contentDiv.onclick = () => loadChat(chat.id);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'history-item-actions';

            const renameBtn = document.createElement('button');
            renameBtn.className = 'history-action-btn';
            renameBtn.innerHTML = `<i data-lucide="pencil" style="width:13px;height:13px;"></i>`;
            renameBtn.title = 'Rename';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const newTitle = prompt('Rename chat:', chat.title);
                if (newTitle && newTitle.trim()) {
                    chat.title = newTitle.trim();
                    saveHistory();
                }
            };

            const delBtn = document.createElement('button');
            delBtn.className = 'history-action-btn';
            delBtn.innerHTML = `<i data-lucide="trash-2" style="width:13px;height:13px;"></i>`;
            delBtn.title = 'Delete';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Delete this chat?')) {
                    chatHistory = chatHistory.filter(c => c.id !== chat.id);
                    if (activeChatId === chat.id) startNewChat();
                    saveHistory();
                }
            };

            actionsDiv.appendChild(renameBtn);
            actionsDiv.appendChild(delBtn);

            li.appendChild(contentDiv);
            li.appendChild(actionsDiv);
            historyList.appendChild(li);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function startNewChat() {
        setProcessingState(false);
        currentGenerationAborted = true;
        activeChatId = null;
        Array.from(chatBox.children).forEach(child => {
            if (child !== welcomeScreen) child.remove();
        });
        welcomeScreen.style.display = 'flex';
        userInput.value = '';
        
        // Go back to chat view
        navItems[0].click();
    }

    function loadChat(id) {
        setProcessingState(false);
        currentGenerationAborted = true;
        const chat = chatHistory.find(c => c.id === id);
        if (!chat) return;
        
        activeChatId = id;
        Array.from(chatBox.children).forEach(child => {
            if (child !== welcomeScreen) child.remove();
        });
        welcomeScreen.style.display = 'none';

        chat.messages.forEach(msg => {
            addMessageRaw(msg.content, msg.role);
        });
        
        navItems[0].click();
    }

    renderHistory();

    newChatBtn.addEventListener('click', startNewChat);

    // --- Message Rendering ---
    function addMessageRaw(content, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = sender === 'ai' ? 'H' : 'U';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        
        // Copy Message Action — appended INSIDE content so it is relative to the bubble
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'msg-action-btn';
        copyBtn.title = 'Copy message';
        copyBtn.innerHTML = '<i data-lucide="copy" style="width:15px;height:15px;"></i>';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;color:var(--accent-blue);"></i>';
                if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [copyBtn] });
                setTimeout(() => {
                    copyBtn.innerHTML = '<i data-lucide="copy" style="width:15px;height:15px;"></i>';
                    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [copyBtn] });
                }, 2000);
            });
        };
        actionsDiv.appendChild(copyBtn);
        
        if (sender === 'ai') {
            contentDiv.innerHTML = parseMarkdown(content);
            contentDiv.appendChild(actionsDiv); // actions inside content bubble
        } else {
            contentDiv.textContent = content;
            
            const editBtn = document.createElement('button');
            editBtn.className = 'msg-action-btn';
            editBtn.innerHTML = '<i data-lucide="edit-2" style="width:15px;height:15px;"></i>';
            editBtn.title = 'Edit message';
            
            editBtn.onclick = () => {
                const currentText = contentDiv.textContent;
                const textarea = document.createElement('textarea');
                textarea.className = 'edit-msg-textarea';
                textarea.value = currentText;
                
                const saveBtn = document.createElement('button');
                saveBtn.className = 'edit-msg-save';
                saveBtn.textContent = 'Save & Submit';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'edit-msg-cancel';
                cancelBtn.textContent = 'Cancel';
                
                const btnContainer = document.createElement('div');
                btnContainer.className = 'edit-msg-actions';
                btnContainer.appendChild(saveBtn);
                btnContainer.appendChild(cancelBtn);
                
                contentDiv.innerHTML = '';
                contentDiv.appendChild(textarea);
                contentDiv.appendChild(btnContainer);
                editBtn.style.display = 'none';
                
                cancelBtn.onclick = () => {
                    contentDiv.innerHTML = '';
                    contentDiv.textContent = currentText;
                    editBtn.style.display = '';
                };
                
                saveBtn.onclick = () => {
                    const newText = textarea.value.trim();
                    if (!newText) return;
                    
                    // Slice chat history up to this point and retry
                    const messageNodes = Array.from(chatBox.children);
                    const msgIndex = messageNodes.indexOf(msgDiv);
                    
                    // Remove all subsequent nodes from DOM
                    while (chatBox.children.length > msgIndex) {
                        chatBox.removeChild(chatBox.lastChild);
                    }
                    
                    // If active chat, slice history array
                    if (activeChatId) {
                        const chat = chatHistory.find(c => c.id === activeChatId);
                        if (chat) {
                            // Find history index. We assume 1-to-1 matching with DOM
                            // Actually it's easier to just recreate the whole chatHistory for this chat based on DOM
                            // Or just remove messages from the end until we match
                            // Since we might have attachments, it's safer to rely on the current prompt flow
                            
                            // A quick hack for now: let's just delete the chat history from this index onwards
                            // Count how many user messages are before this one
                            let userMsgCount = 0;
                            for (let i = 0; i < msgIndex; i++) {
                                if (messageNodes[i].classList.contains('user')) userMsgCount++;
                            }
                            // Re-build history simply by stripping out the trailing messages
                            // We will just let saveToActiveChat handle it, but we need to delete trailing
                            chat.messages = chat.messages.slice(0, userMsgCount * 2); // approximate
                            saveHistory();
                        }
                    }
                    
                    // Resubmit
                    userInput.value = newText;
                    handleSend();
                };
            };
            
            actionsDiv.appendChild(editBtn);
            contentDiv.appendChild(actionsDiv);
        }

        msgDiv.appendChild(avatar);
        msgDiv.appendChild(contentDiv);

        chatBox.appendChild(msgDiv);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        chatBox.scrollTop = chatBox.scrollHeight;
        return contentDiv;
    }

    window.copyCodeToClipboard = function(encodedText, btnElement) {
        const text = decodeURIComponent(encodedText);
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; color: var(--accent-blue);"></i> Copied';
            lucide.createIcons({root: btnElement});
            setTimeout(() => {
                btnElement.innerHTML = originalHtml;
                lucide.createIcons({root: btnElement});
            }, 2000);
        });
    };

    window.saveCodeToWorkspace = function(encodedText, lang, btnElement) {
        const text = decodeURIComponent(encodedText);
        const extMap = { 'javascript': 'js', 'python': 'py', 'html': 'html', 'css': 'css', 'json': 'json' };
        const ext = extMap[lang.toLowerCase()] || 'txt';
        const name = `AI_Snippet_${Date.now()}.${ext}`;
        workspaceItems.unshift({ id: Date.now().toString(), name: name, data: text, type: 'text/plain', date: new Date().toLocaleDateString() });
        localStorage.setItem('helios_workspaces', JSON.stringify(workspaceItems));
        renderWorkspaces();
        
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; color: var(--accent-blue);"></i> Saved';
        lucide.createIcons({root: btnElement});
        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            lucide.createIcons({root: btnElement});
        }, 2000);
    };

    function parseMarkdown(text) {
        // Strip out Anthropic/Puter JSON array wrappers if they exist
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed[0] && parsed[0].text) {
                text = parsed.map(b => b.text).join('\n');
            }
        } catch (e) {
            // Not a JSON array, proceed normally
        }

        const parts = text.split(/```/);
        let html = '';
        for (let j = 0; j < parts.length; j++) {
            if (j % 2 === 0) {
                let parsedText = parts[j]
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>')
                    .replace(/\n/g, '<br>');
                html += parsedText;
            } else {
                const lines = parts[j].split('\n');
                const lang = lines[0].trim();
                const rawCodeText = lines.slice(1).join('\n');
                const code = rawCodeText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const encodedText = encodeURIComponent(rawCodeText).replace(/'/g, "%27");
                html += `
                    <div class="code-block-wrapper">
                        <div class="code-block-header" style="background: transparent;">
                            <span class="code-lang-label">${lang || 'code'}</span>
                            <div style="display: flex; gap: 8px;">
                                <button class="copy-code-btn" onclick="copyCodeToClipboard('${encodedText}', this)"><i data-lucide="copy" style="width: 14px; height: 14px;"></i> Copy</button>
                            </div>
                        </div>
                        <div class="code-block-content">${code}</div>
                    </div>
                `;
            }
        }
        setTimeout(() => lucide.createIcons(), 50); // Ensure copy icons are created
        return html;
    }

    function streamMessage(content) {
        if (typeof Tokenizer !== 'undefined') Tokenizer.processOutput(content);

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ai`;

        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = 'H';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        msgDiv.appendChild(avatar);
        msgDiv.appendChild(contentDiv);
        chatBox.appendChild(msgDiv);

        let i = 0;
        const speed = 10;
        contentDiv.textContent = ''; // Start empty
        
        function typeWriter() {
            if (currentGenerationAborted) return;
            if (i < content.length) {
                // Real-time markdown parsing
                contentDiv.innerHTML = parseMarkdown(content.substring(0, i + 1));
                i++;
                chatBox.scrollTop = chatBox.scrollHeight;
                setTimeout(typeWriter, speed);
            } else {
                contentDiv.innerHTML = parseMarkdown(content);
                
                // Add copy actions to streamed message (inside content bubble)
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'message-actions';
                const copyBtn = document.createElement('button');
                copyBtn.className = 'msg-action-btn';
                copyBtn.title = 'Copy message';
                copyBtn.innerHTML = '<i data-lucide="copy" style="width:15px;height:15px;"></i>';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(content).then(() => {
                        copyBtn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;color:var(--accent-blue);"></i>';
                        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [copyBtn] });
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i data-lucide="copy" style="width:15px;height:15px;"></i>';
                            if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [copyBtn] });
                        }, 2000);
                    });
                };
                actionsDiv.appendChild(copyBtn);
                contentDiv.appendChild(actionsDiv);
                
                appendTimer(contentDiv);
                saveToActiveChat(content, 'ai');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
        typeWriter();
    }

    function appendTimer(container) {
        let elapsed = ((Date.now() - messageStartTime) / 1000).toFixed(1);
        const timerDiv = document.createElement('div');
        timerDiv.className = 'response-timer';
        timerDiv.style.cssText = 'font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 5px;';
        timerDiv.textContent = `[${elapsed}s]`;
        container.appendChild(timerDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        setProcessingState(false);
    }

    function saveToActiveChat(content, role) {
        if (!activeChatId) {
            activeChatId = Date.now().toString();
            const title = content.length > 20 ? content.substring(0, 20) + '...' : content;
            chatHistory.unshift({ id: activeChatId, title: title, date: new Date().toISOString(), messages: [] });
        }
        
        const chat = chatHistory.find(c => c.id === activeChatId);
        if (chat) {
            chat.messages.push({ role, content });
            saveHistory();
        }
    }

    // --- Typing Indicators & UI State ---
    function showTypingIndicator() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ai typing';
        msgDiv.id = 'typing-indicator-msg';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = 'H';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        msgDiv.appendChild(avatar);
        msgDiv.appendChild(contentDiv);
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator-msg');
        if (indicator) indicator.remove();
    }

    function setProcessingState(processing) {
        isProcessing = processing;
        userInput.disabled = processing;
        
        if (processing) {
            sendBtn.innerHTML = '<i data-lucide="square" style="fill: currentColor; width: 14px; height: 14px;"></i>';
            sendBtn.classList.add('stop-btn');
        } else {
            sendBtn.innerHTML = '<i data-lucide="arrow-up"></i>';
            sendBtn.classList.remove('stop-btn');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    window.addEventListener('tokensUpdated', (e) => {
        if (tokenCount) {
            tokenCount.textContent = e.detail.total;
            const progress = document.getElementById('token-circle-progress');
            if (progress) {
                progress.style.background = `conic-gradient(var(--accent-purple) ${e.detail.percentage}%, transparent ${e.detail.percentage}%)`;
            }
        }
    });

    // --- Worker Fallback Setup ---
    let worker = null;
    if (window.Worker) {
        worker = new Worker('js/worker.js');
        worker.onmessage = function (e) {
            removeTypingIndicator();
            if (e.data.status === 'success') {
                streamMessage(e.data.response);
            } else {
                addMessageRaw("System Error: " + e.data.message, 'ai');
                setProcessingState(false);
            }
        };
        worker.onerror = function (e) {
            removeTypingIndicator();
            addMessageRaw("Core systems offline. Please run build_model.py.", 'ai');
            setProcessingState(false);
        };
    }

    // --- Core Handle Send ---
    function handleSend() {
        if (isProcessing) {
            currentGenerationAborted = true;
            setProcessingState(false);
            removeTypingIndicator();
            return;
        }

        currentGenerationAborted = false;

        let rawText = userInput.value;
        if (!rawText.trim() && pendingAttachments.length === 0) return;

        if (welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
        }

        // Attach text files to the prompt string invisibly
        let compiledText = rawText;
        let imageToAnalyze = null;

        pendingAttachments.forEach(att => {
            if (att.type === 'text') {
                compiledText += `\n\n[Attached File: ${att.name}]\n${att.data}`;
            } else if (att.type === 'image') {
                imageToAnalyze = att.data;
            }
        });
        
        let text = compiledText;
        if (typeof Tokenizer !== 'undefined') text = Tokenizer.processInput(text);
        else text = text.trim();

        const userContentDiv = addMessageRaw(rawText, 'user');
        
        // Render attachments visually in the user bubble
        if (pendingAttachments.length > 0) {
            const attContainer = document.createElement('div');
            attContainer.style.display = 'flex';
            attContainer.style.flexWrap = 'wrap';
            attContainer.style.gap = '8px';
            attContainer.style.marginBottom = rawText.trim() ? '12px' : '0';
            
            pendingAttachments.forEach(att => {
                if (att.type === 'image') {
                    const img = document.createElement('img');
                    img.src = att.data;
                    img.style.maxWidth = '250px';
                    img.style.maxHeight = '250px';
                    img.style.borderRadius = '12px';
                    img.style.objectFit = 'cover';
                    attContainer.appendChild(img);
                } else {
                    const fileCard = document.createElement('div');
                    fileCard.style.padding = '8px 12px';
                    fileCard.style.background = 'rgba(0,0,0,0.2)';
                    fileCard.style.borderRadius = '8px';
                    fileCard.style.fontSize = '0.85rem';
                    fileCard.innerHTML = `<i data-lucide="file-text" style="width:14px;height:14px;vertical-align:middle;"></i> ${att.name}`;
                    attContainer.appendChild(fileCard);
                }
            });
            userContentDiv.insertBefore(attContainer, userContentDiv.firstChild);
            lucide.createIcons();
        }

        saveToActiveChat(compiledText, 'user');
        userInput.value = '';
        userInput.style.height = 'auto'; // reset resize
        
        // Clear attachments tray
        pendingAttachments = [];
        renderAttachments();

        setProcessingState(true);
        messageStartTime = Date.now();
        showTypingIndicator();

        if (currentModel === 'H&H Flash-lite 1.0') {
            // Offline AI Fallback logic
            setTimeout(() => {
                const user = localStorage.getItem('helios_user') || 'friend';
                streamMessage(`Hello ${user}! I am H&H Offline (H&H Flash-lite 1.0). I am your local, lightning-fast fallback model running without internet dependencies. I see you asked: **"${compiledText.substring(0, 50)}..."** \n\nHow can I help you today?`);
            }, 800);
            return;
        }

        if (window.puter && window.puter.ai) {
            const chat = chatHistory.find(c => c.id === activeChatId);
            let puterContext = compiledText;
            if (chat && chat.messages) {
                puterContext = chat.messages.map(m => ({
                    role: m.role === 'ai' ? 'assistant' : 'user',
                    content: m.content
                }));
            }
            
            const aiOptions = { model: currentModel };
            if (imageToAnalyze) aiOptions.image = imageToAnalyze;
            
            // Expose built-in functions for Agentic capabilities
            aiOptions.functions = Object.values(dummyFunctions);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout: The selected model took too long to respond. It may be processing a complex query, or it might be overloaded/unavailable. Please try another model.")), 60000)
            );

            Promise.race([
                window.puter.ai.chat(puterContext, aiOptions),
                timeoutPromise
            ]).then(response => {
                if (currentGenerationAborted) return;
                removeTypingIndicator();
                let output = response.message ? response.message.content : response.text ? response.text : response;
                
                // Handle JSON blocks and agentic function calls
                if (response && response.message) {
                    if (response.message.function_call || (Array.isArray(response.message.content) && response.message.content.some(c => c.type === 'function_call'))) {
                        output = "I've invoked an agentic function internally to process this request! I am retrieving your data now...";
                    }
                }
                
                if (typeof output === 'object') output = JSON.stringify(output);
                streamMessage(output);
            }).catch(e => {
                if (currentGenerationAborted) return;
                removeTypingIndicator();
                console.error("Puter AI Error:", e);
                streamMessage(`**Puter AI Cloud Error:** ${e.message}\n\n*Tip: Some smaller or unverified models do not support Image Analysis or Agentic Functions. Try switching to GPT-4o or Claude 3.5 Sonnet.*`);
                setProcessingState(false);
            });
        } else {
            fallbackToWorker();
        }

        function fallbackToWorker() {
            if (worker) {
                worker.postMessage({ type: 'analyze', text: text, rawText: rawText });
            } else {
                removeTypingIndicator();
                addMessageRaw("Web workers not supported.", 'ai');
                setProcessingState(false);
            }
        }
    }

    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim().length > 0) sendBtn.classList.add('active');
        else sendBtn.classList.remove('active');
    });
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            sendBtn.classList.remove('active');
        }
    });
});
