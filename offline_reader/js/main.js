// Version 2


let currentTopicData = null;
let currentFileName = 'topic.json';

// --- State Management ---
let currentPage = 1;
const POSTS_PER_PAGE = 50;
let activeFilters = { author: null, tag: null };
let isAiEnabled = false; // Global flag for AI feature availability

const FONT_SIZES = ['font-small', 'font-normal', 'font-large', 'font-xlarge', 'font-xxlarge', 'font-xxxlarge'];
let currentFontSizeIndex = 1;

document.addEventListener('DOMContentLoaded', () => {
    // --- API Key UI Logic ---
    const apiKeyInput = document.getElementById('gemini-api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyStatus = document.getElementById('api-key-status');

    function updateApiKeyUI() {
        const savedApiKey = localStorage.getItem('geminiApiKey');
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
            apiKeyInput.classList.add('hidden');
            saveApiKeyBtn.textContent = '更換金鑰';
            apiKeyStatus.textContent = '金鑰已儲存';
            apiKeyStatus.style.color = 'green';
        } else {
            apiKeyInput.classList.remove('hidden');
            saveApiKeyBtn.textContent = '儲存金鑰';
            apiKeyStatus.textContent = '尚未提供金鑰';
            apiKeyStatus.style.color = 'orange';
        }
    }

    saveApiKeyBtn.addEventListener('click', () => {
        const isKeySaved = !!localStorage.getItem('geminiApiKey');

        if (isKeySaved) {
            // Current state is "Change Key", so we show the input
            localStorage.removeItem('geminiApiKey'); // Remove key to allow re-entry
            updateApiKeyUI();
            apiKeyInput.focus();
            apiKeyStatus.textContent = '請輸入新的金鑰';
        } else {
            // Current state is "Save Key", so we save and hide the input
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                localStorage.setItem('geminiApiKey', apiKey);
                apiKeyStatus.textContent = '金鑰已儲存';
                apiKeyStatus.style.color = 'green';
                updateApiKeyUI();
                // Briefly show status then fade
                setTimeout(() => { apiKeyStatus.textContent = ''; }, 2000);
            } else {
                alert('API 金鑰不能為空。');
            }
        }
    });

    updateApiKeyUI(); // Set initial state on page load

    // Main file and save listeners
    document.getElementById('jsonFileInput').addEventListener('change', handleFileSelect);
    document.getElementById('saveChangesBtn').addEventListener('click', saveChanges);
    document.getElementById('download-topic-btn').addEventListener('click', handleDownloadTopic);
    
    // Jump to post listeners
    document.getElementById('jump-to-post-btn').addEventListener('click', jumpToPost);
    document.getElementById('jump-to-post-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            jumpToPost();
        }
    });

    // Floating controls listeners
    document.getElementById('font-decrease-btn').addEventListener('click', () => changeFontSize('decrease'));
    document.getElementById('font-increase-btn').addEventListener('click', () => changeFontSize('increase'));
    document.getElementById('scroll-to-top-btn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.getElementById('scroll-to-bottom-btn').addEventListener('click', () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));

    // Dark Mode Logic
    const toggleDarkModeBtn = document.getElementById('toggle-dark-mode-btn');
    toggleDarkModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // Reading Ruler Logic
    const ruler = document.createElement('div');
    ruler.id = 'reading-ruler';
    document.body.appendChild(ruler);
    const toggleRulerBtn = document.getElementById('toggle-ruler-btn');

    toggleRulerBtn.addEventListener('click', () => {
        document.body.classList.toggle('ruler-active');
        toggleRulerBtn.classList.toggle('active');
    });

    // Check backend status on startup
    checkBackendStatus();

    let lastMouseY = 0;
    let ticking = false;
    let lastHighlightedElement = null;

    window.addEventListener('mousemove', (e) => {
        lastMouseY = e.clientY;
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (!document.body.classList.contains('ruler-active')) {
                    if (lastHighlightedElement) {
                        lastHighlightedElement.classList.remove('reading-highlight');
                        lastHighlightedElement = null;
                    }
                    ruler.style.display = 'none';
                    ticking = false;
                    return;
                }
                const postBody = e.target.closest('.post-body');
                const isInsideScrollablePost = postBody && postBody.scrollHeight > postBody.clientHeight;
                if (isInsideScrollablePost) {
                    ruler.style.display = 'none';
                    const targetElement = e.target.closest('p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, div.codebox');
                    if (targetElement && postBody.contains(targetElement)) {
                        if (lastHighlightedElement !== targetElement) {
                            if (lastHighlightedElement) {
                                lastHighlightedElement.classList.remove('reading-highlight');
                            }
                            targetElement.classList.add('reading-highlight');
                            lastHighlightedElement = targetElement;
                        }
                    } else {
                        if (lastHighlightedElement) {
                            lastHighlightedElement.classList.remove('reading-highlight');
                            lastHighlightedElement = null;
                        }
                    }
                } else {
                    ruler.style.display = 'block';
                    ruler.style.top = lastMouseY + 'px';
                    if (lastHighlightedElement) {
                        lastHighlightedElement.classList.remove('reading-highlight');
                        lastHighlightedElement = null;
                    }
                }
                ticking = false;
            });
            ticking = true;
        }
    });

    updateFontSize();
});

window.addEventListener('scroll', () => {
    const controls = document.getElementById('floating-controls');
    if (window.scrollY > 300) {
        controls.classList.add('visible');
    } else {
        controls.classList.remove('visible');
    }
});

function changeFontSize(direction) {
    if (direction === 'increase' && currentFontSizeIndex < FONT_SIZES.length - 1) {
        currentFontSizeIndex++;
    } else if (direction === 'decrease' && currentFontSizeIndex > 0) {
        currentFontSizeIndex--;
    }
    updateFontSize();
}

function updateFontSize() {
    const body = document.body;
    FONT_SIZES.forEach(sizeClass => body.classList.remove(sizeClass));
    body.classList.add(FONT_SIZES[currentFontSizeIndex]);
    document.getElementById('font-decrease-btn').disabled = (currentFontSizeIndex === 0);
    document.getElementById('font-increase-btn').disabled = (currentFontSizeIndex === FONT_SIZES.length - 1);
}

async function checkBackendStatus() {
    try {
        const response = await fetch('/status');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        isAiEnabled = data.ai_enabled;
        console.log('Backend status:', data);
        if (!isAiEnabled) {
            console.warn('AI features disabled. Set GEMINI_API_KEY to enable.');
        }
    } catch (error) {
        isAiEnabled = false;
        console.error('Could not connect to local AI service. Make sure it is running. AI features disabled.');
    }
}

function handleDownloadTopic() {
    const topicIdInput = document.getElementById('topic-id-input');
    const topicId = topicIdInput.value.trim();

        if (!topicId || !/^\d+$/.test(topicId)) {
        alert('請輸入有效的主題 ID (純數字)。');
        topicIdInput.focus();
        return;
    }

    const baseUrl = 'https://bodhicitta2.eastus2.cloudapp.azure.com/';
    const downloadUrl = `${baseUrl}export_topic.php?t=${topicId}`;
    window.open(downloadUrl, '_blank');
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    currentFileName = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            currentTopicData = JSON.parse(e.target.result);
            clearFilter();
            document.getElementById('saveChangesBtn').style.display = 'inline-block';
        } catch (error) {
            alert('錯誤：無法解析或渲染檔案。請確認檔案格式是否正確。');
            console.error("File processing error:", error);
        }
    };
    reader.readAsText(file);
}

function updateAndRender() {
    if (!currentTopicData) return;

    let posts = currentTopicData.posts;
    if (activeFilters.author) {
        posts = posts.filter(p => p.author === activeFilters.author);
    }
    if (activeFilters.tag) {
        posts = posts.filter(p => p.tags && p.tags.includes(activeFilters.tag));
    }

    const viewData = { ...currentTopicData, posts: posts };
    
    currentPage = 1;
    renderCurrentPage(viewData);
    setupPaginationControls(viewData);
    updateClearButton();
}

function jumpToPost() {
    if (activeFilters.author || activeFilters.tag) {
        alert('為確保樓層號正確，跳轉前將清除篩選。');
        clearFilter();
        setTimeout(() => jumpToPostById(document.getElementById('jump-to-post-input').value), 100);
        return;
    }
    jumpToPostById(document.getElementById('jump-to-post-input').value);
}

function jumpToPostById(postIndex) {
    if (!postIndex) return;
    postIndex = parseInt(postIndex, 10);

    if (postIndex > 0 && postIndex <= currentTopicData.posts.length) {
        const targetPage = Math.ceil(postIndex / POSTS_PER_PAGE);
        
        if (targetPage !== currentPage) {
            currentPage = targetPage;
            const fullView = { ...currentTopicData, posts: currentTopicData.posts };
            renderCurrentPage(fullView);
            setupPaginationControls(fullView);
        }

        requestAnimationFrame(() => {
            const postElement = document.querySelector(`.post[data-post-index="${postIndex}"]`);
            if (postElement) {
                postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                postElement.classList.add('jump-highlight');
                setTimeout(() => postElement.classList.remove('jump-highlight'), 2000);
            }
        });
    } else {
        alert(`樓層號 ${postIndex} 超出範圍 (1-${currentTopicData.posts.length})`);
    }
}

function renderCurrentPage(data) {
    window.scrollTo({ top: 0, behavior: 'instant' });

    const topicTitleEl = document.getElementById('topicTitle');
    const postsContainerEl = document.getElementById('postsContainer');

    topicTitleEl.textContent = data.topic_title || '無標題';
    postsContainerEl.innerHTML = '';

    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE;
    const postsToRender = data.posts.slice(start, end);

    if (postsToRender.length > 0) {
        postsToRender.forEach((post) => {
            const originalPost = currentTopicData.posts.find(p => p.post_id === post.post_id);
            const postGlobalIndex = originalPost ? currentTopicData.posts.indexOf(originalPost) + 1 : 0;

            const postElement = document.createElement('div');
            postElement.className = 'post';
            postElement.dataset.postId = post.post_id;
            postElement.dataset.postIndex = postGlobalIndex;
            postElement.dataset.author = post.author;
            postElement.dataset.tags = JSON.stringify(post.tags || []);
            postElement.dataset.summary = post.summary || '';
            postElement.dataset.chatHistory = JSON.stringify(post.chat_history || []);

            if (post.is_highlighted) postElement.classList.add('highlighted');
            if (post.ai_summarize) postElement.classList.add('ai-summarize-marked');

            const postHeader = document.createElement('div');
            postHeader.className = 'post-header';
            
            const authorDiv = document.createElement('div');
            authorDiv.className = 'post-author';
            const authorStrong = document.createElement('strong');
            authorStrong.className = 'author-link';
            authorStrong.textContent = post.author;
            authorStrong.addEventListener('click', () => filterByAuthor(post.author));
            authorDiv.appendChild(authorStrong);
            authorDiv.append(' 寫道：');

            const metaDiv = document.createElement('div');
            metaDiv.className = 'post-meta';
            let idElement = post.post_url ? `<a href="${post.post_url}" target="_blank" title="前往原始文章"><span class="post-id">(ID: ${post.post_id})</span></a>` : `<span class="post-id">(ID: ${post.post_id})</span>`;
            metaDiv.innerHTML = `<span class="post-index">#${postGlobalIndex}</span>${idElement} <span class="post-time">${new Date(post.post_time).toLocaleString()}</span>`;

            postHeader.appendChild(authorDiv);
            postHeader.appendChild(metaDiv);
            postElement.appendChild(postHeader);

            const summaryElement = document.createElement('textarea');
            summaryElement.className = 'post-summary-editor';
            summaryElement.value = post.summary || '';
            summaryElement.placeholder = '點此編輯或點擊 AI 按鈕生成摘要...';
            summaryElement.addEventListener('input', function() {
                postElement.dataset.summary = this.value;
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
            postElement.appendChild(summaryElement);
            setTimeout(() => { if (summaryElement.scrollHeight) { summaryElement.style.height = (summaryElement.scrollHeight) + 'px'; } }, 10);

            const tagsElement = document.createElement('div');
            tagsElement.className = 'post-tags';
            if (post.tags && post.tags.length > 0) {
                post.tags.forEach(tagText => tagsElement.appendChild(createTagElement(tagText)));
            }
            postElement.appendChild(tagsElement);

            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'post-controls';

            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-content';
            toggleButton.textContent = '閱讀全文';
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const postBody = postElement.querySelector('.post-body');
                postBody.classList.toggle('collapsed');
                e.currentTarget.textContent = postBody.classList.contains('collapsed') ? '閱讀全文' : '收合文章';
            });
            controlsContainer.appendChild(toggleButton);

            const highlightButton = document.createElement('button');
            highlightButton.className = 'highlight-btn';
            highlightButton.textContent = '標註';
            highlightButton.addEventListener('click', (e) => {
                e.stopPropagation();
                postElement.classList.toggle('highlighted');
            });
            controlsContainer.appendChild(highlightButton);

            const aiSummarizeButton = document.createElement('button');
            aiSummarizeButton.className = 'ai-summarize-btn';
            aiSummarizeButton.textContent = '產生 AI 摘要';
            aiSummarizeButton.disabled = !isAiEnabled;
            aiSummarizeButton.title = isAiEnabled ? '使用 Gemini AI 生成摘要' : '本地 AI 服務未啟用';
            aiSummarizeButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const originalText = aiSummarizeButton.textContent;
                try {
                    aiSummarizeButton.textContent = '生成中...';
                    aiSummarizeButton.disabled = true;

                    const apiKey = document.getElementById('gemini-api-key-input').value;
                    if (!apiKey) {
                        throw new Error('尚未提供 Gemini API 金鑰。');
                    }

                                        const response = await fetch('/summarize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ post_html: post.post_html, api_key: apiKey }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP 錯誤: ${response.status}`);
                    }

                    const data = await response.json();
                    const summaryEditor = postElement.querySelector('.post-summary-editor');
                    if (summaryEditor) {
                        summaryEditor.value = data.summary;
                        summaryEditor.dispatchEvent(new Event('input'));
                    }

                } catch (error) {
                    alert(`生成摘要時發生錯誤：\n${error.message}`);
                } finally {
                    aiSummarizeButton.textContent = '產生 AI 摘要';
                    aiSummarizeButton.disabled = !isAiEnabled;
                }
            });
            controlsContainer.appendChild(aiSummarizeButton);

            // AI Chat Button
            const aiChatButton = document.createElement('button');
            aiChatButton.className = 'ai-chat-btn';
            aiChatButton.textContent = 'AI 對話';
            aiChatButton.disabled = !isAiEnabled;
            aiChatButton.title = isAiEnabled ? '與 AI 針對此文章進行對話' : '本地 AI 服務未啟用';
            aiChatButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const chatContainer = postElement.querySelector('.chat-container');
                if (chatContainer) {
                    chatContainer.style.display = chatContainer.style.display === 'none' ? 'flex' : 'none';
                }
            });
            controlsContainer.appendChild(aiChatButton);

            postElement.appendChild(controlsContainer);

            const addTagContainer = document.createElement('div');
            addTagContainer.className = 'add-tag-container';
            const tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.className = 'add-tag-input';
            tagInput.placeholder = '新增自訂標籤...';
            const addTagButton = document.createElement('button');
            addTagButton.className = 'add-tag-btn';
            addTagButton.textContent = '新增';
            addTagButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const newTagText = tagInput.value.trim();
                if (newTagText) {
                    const currentTags = JSON.parse(postElement.dataset.tags);
                    if (!currentTags.includes(newTagText)) {
                        currentTags.push(newTagText);
                        postElement.dataset.tags = JSON.stringify(currentTags);
                        tagsElement.appendChild(createTagElement(newTagText));
                    }
                    tagInput.value = '';
                }
            });
            tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTagButton.click(); } });
            addTagContainer.appendChild(tagInput);
            addTagContainer.appendChild(addTagButton);
            postElement.appendChild(addTagContainer);

            const postBody = document.createElement('div');
            postBody.className = 'post-body collapsed';
            postBody.innerHTML = '<div class="content">' + post.post_html + '</div>';
            postElement.appendChild(postBody);

            // Chat Container (initially hidden)
            const chatContainer = document.createElement('div');
            chatContainer.className = 'chat-container';
            chatContainer.style.display = 'none';

            const chatHistory = document.createElement('div');
            chatHistory.className = 'chat-history';
            // Load and display saved chat history here
            const savedHistory = JSON.parse(postElement.dataset.chatHistory);
            savedHistory.forEach(msg => {
                appendChatMessage(chatHistory, msg.parts[0], msg.role === 'user' ? 'user-message' : 'model-message');
            });

            const chatInputContainer = document.createElement('div');
            chatInputContainer.className = 'chat-input-container';

            const chatInput = document.createElement('textarea');
            chatInput.className = 'chat-input';
            chatInput.placeholder = '在此輸入您想對 AI 說的話...';

            const chatSendButton = document.createElement('button');
            chatSendButton.className = 'chat-send-btn';
            chatSendButton.textContent = '發送';
            
            // Event listener for sending chat messages
            chatSendButton.addEventListener('click', async () => {
                const userMessage = chatInput.value.trim();
                if (!userMessage) return;

                // Append user message to history UI
                appendChatMessage(chatHistory, userMessage, 'user-message');
                const thinkingMessage = appendChatMessage(chatHistory, 'AI 正在思考中...', 'model-message thinking');

                chatInput.value = '';
                chatInput.disabled = true;
                chatSendButton.disabled = true;

                // Get current chat history from dataset
                let history = JSON.parse(postElement.dataset.chatHistory || '[]');

                // Add user message to history for API call
                history.push({ role: 'user', parts: [userMessage] });

                try {
                    const apiKey = document.getElementById('gemini-api-key-input').value;
                    if (!apiKey) {
                        alert('請先輸入您的 Gemini API 金鑰。');
                        thinkingMessage.remove();
                        appendChatMessage(chatHistory, '錯誤：未提供 API 金鑰。', 'model-message error');
                        chatInput.disabled = false;
                        chatSendButton.disabled = false;
                        return;
                    }

                    const response = await fetch('/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            api_key: apiKey,
                            history: history,
                            // Also send the post content for context, in case the history is empty
                            prompt: `這是關於文章「${post.post_title}」的對話。文章內容：\n${postElement.querySelector('.post-summary-editor').value}`
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP 錯誤: ${response.status}`);
                    }

                    const data = await response.json();
                    
                    // Remove thinking message and append model response
                    thinkingMessage.remove();
                    appendChatMessage(chatHistory, data.reply, 'model-message');

                    // Add model response to history for next API call
                    history.push({ role: 'model', parts: [data.reply] });

                    // Update dataset with the new history
                    postElement.dataset.chatHistory = JSON.stringify(history);

                } catch (error) {
                    thinkingMessage.remove();
                    appendChatMessage(chatHistory, `錯誤： ${error.message}`, 'model-message error');
                } finally {
                    chatInput.disabled = false;
                    chatSendButton.disabled = false;
                    chatInput.focus();
                }
            });

            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    chatSendButton.click();
                }
            });

            chatInputContainer.appendChild(chatInput);
            chatInputContainer.appendChild(chatSendButton);
            chatContainer.appendChild(chatHistory);
            chatContainer.appendChild(chatInputContainer);
            postElement.appendChild(chatContainer);

            postsContainerEl.appendChild(postElement);
        });
    } else {
        postsContainerEl.textContent = '沒有符合篩選條件的文章。';
    }
    initYouTubeLazyLoad();
}

function setupPaginationControls(data) {
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';

    if (!data || data.posts.length <= POSTS_PER_PAGE) return;

    const totalPages = Math.ceil(data.posts.length / POSTS_PER_PAGE);

    const paginationWrapper = document.createElement('div');
    paginationWrapper.className = 'pagination';

    const jumpWrapper = document.createElement('div');
    jumpWrapper.className = 'pagination-jump';
    const jumpInput = document.createElement('input');
    jumpInput.type = 'text';
    jumpInput.inputMode = 'numeric';
    jumpInput.pattern = '[0-9]*';
    jumpInput.className = 'pagination-jump-input';
    jumpInput.value = currentPage;
    const jumpBtn = document.createElement('button');
    jumpBtn.textContent = '跳頁';
    const handleJump = () => {
        const pageNum = parseInt(jumpInput.value, 10);
        if (pageNum >= 1 && pageNum <= totalPages) {
            currentPage = pageNum;
            renderCurrentPage(data);
            setupPaginationControls(data);
        } else {
            alert(`頁碼超出範圍 (1-${totalPages})`);
            jumpInput.value = currentPage;
        }
    };
    jumpBtn.addEventListener('click', handleJump);
    jumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleJump(); } });
    jumpWrapper.appendChild(jumpInput);
    jumpWrapper.appendChild(jumpBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 頁`;

    const firstBtn = document.createElement('button');
    firstBtn.textContent = '第一頁';
    firstBtn.disabled = currentPage === 1;
    firstBtn.addEventListener('click', () => { currentPage = 1; renderCurrentPage(data); setupPaginationControls(data); });

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一頁';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { currentPage--; renderCurrentPage(data); setupPaginationControls(data); });

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一頁';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { currentPage++; renderCurrentPage(data); setupPaginationControls(data); });

    const lastBtn = document.createElement('button');
    lastBtn.textContent = '最後一頁';
    lastBtn.disabled = currentPage === totalPages;
    lastBtn.addEventListener('click', () => { currentPage = totalPages; renderCurrentPage(data); setupPaginationControls(data); });

    paginationWrapper.appendChild(firstBtn);
    paginationWrapper.appendChild(prevBtn);
    paginationWrapper.appendChild(pageInfo);
    paginationWrapper.appendChild(nextBtn);
    paginationWrapper.appendChild(lastBtn);
    paginationWrapper.appendChild(jumpWrapper);

    container.appendChild(paginationWrapper);
}

function createTagElement(tagText) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = tagText;
    tag.addEventListener('click', (e) => { 
        e.stopPropagation();
        filterByTag(tagText);
    });
    return tag;
}

function filterByTag(selectedTag) {
    activeFilters.tag = selectedTag;
    activeFilters.author = null;
    updateAndRender();
}

function filterByAuthor(selectedAuthor) {
    activeFilters.author = selectedAuthor;
    activeFilters.tag = null;
    updateAndRender();
}

function updateClearButton() {
    let clearButton = document.getElementById('clearFilterBtn');
    if (!activeFilters.author && !activeFilters.tag) {
        if (clearButton) clearButton.style.display = 'none';
        return;
    }

    if (!clearButton) {
        clearButton = document.createElement('button');
        clearButton.id = 'clearFilterBtn';
        clearButton.onclick = clearFilter;
        document.getElementById('topicContainer').insertBefore(clearButton, document.getElementById('postsContainer'));
    }
    
    const filterText = activeFilters.author ? `作者：${activeFilters.author}` : `標籤：${activeFilters.tag}`;
    clearButton.textContent = `清除篩選：${filterText}`;
    clearButton.style.display = 'block';
}

function clearFilter() {
    activeFilters.author = null;
    activeFilters.tag = null;
    if (currentTopicData) {
        updateAndRender();
    }
}

function saveChanges() {
    if (!currentTopicData) {
        alert('沒有載入的檔案可供儲存。');
        return;
    }

    const dataToSave = JSON.parse(JSON.stringify(currentTopicData));

    const allPostsInDOM = document.querySelectorAll('.post');
    allPostsInDOM.forEach(postElement => {
        const postId = parseInt(postElement.dataset.postId, 10);
        const postInData = dataToSave.posts.find(p => p.post_id === postId);
        if (postInData) {
            postInData.is_highlighted = postElement.classList.contains('highlighted');
            postInData.tags = JSON.parse(postElement.dataset.tags);
            postInData.summary = postElement.dataset.summary;
            postInData.ai_summarize = postElement.classList.contains('ai-summarize-marked');
            if (postElement.dataset.chatHistory) {
                postInData.chat_history = JSON.parse(postElement.dataset.chatHistory);
            }
        }
    });

    const jsonString = JSON.stringify(dataToSave, null, 4);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    let newFileName = currentFileName.includes('_edited') ? currentFileName : currentFileName.replace(/(\.\w+)$/, '_edited$1');
    a.download = newFileName;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`變更已儲存！\n檔案名稱為：${newFileName}`);
}

function appendChatMessage(historyElement, text, className) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${className}`;
    
    // Render Markdown for model messages, otherwise use plain text
    if (className.includes('model-message')) {
        messageElement.innerHTML = marked.parse(text); // Use marked.js to parse Markdown
    } else {
        messageElement.textContent = text;
    }

    historyElement.appendChild(messageElement);
    // Scroll to the bottom of the history
    historyElement.scrollTop = historyElement.scrollHeight;
    return messageElement; // Return the element so it can be removed if it's a thinking indicator
}

function initYouTubeLazyLoad() {
    const placeholders = document.querySelectorAll('.youtube-placeholder');
    if (!('IntersectionObserver' in window)) {
        placeholders.forEach(p => replacePlaceholderWithIframe(p));
        return;
    }
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const placeholder = entry.target;
                replacePlaceholderWithIframe(placeholder);
                observer.unobserve(placeholder);
            }
        });
    }, { rootMargin: '50px 0px' });
    placeholders.forEach(p => observer.observe(p));
}

function replacePlaceholderWithIframe(placeholder) {
    const videoId = placeholder.dataset.videoid;
    if (!videoId) return;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=0`);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    videoWrapper.appendChild(iframe);
    placeholder.parentNode.replaceChild(videoWrapper, placeholder);
}