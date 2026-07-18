// 1. WINDOW CONTROLS & OVERLAY COUPLING
document.getElementById('close-btn').addEventListener('click', () => window.api.close());
document.getElementById('min-btn').addEventListener('click', () => window.api.minimize());
document.getElementById('max-btn').addEventListener('click', () => window.api.maximizeToggle());

window.api.onMaximized(() => document.getElementById('max-btn').classList.add('maximized'));
window.api.onUnmaximized(() => document.getElementById('max-btn').classList.remove('maximized'));

// 2. OLLAMA CONFIGURATION & DOM ELEMENTS
const DEFAULT_LOCAL_PORT = 11434;
function getOllamaHost() {
  const port = (appConfig && appConfig.localPort) || DEFAULT_LOCAL_PORT;
  return `http://localhost:${port}`;
}
const modelSelect = document.getElementById('model-select');
const statusText = document.getElementById('status-text');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const refreshBtn = document.getElementById('refresh-models-btn');
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const overlayBtn = document.getElementById('zen-mode-btn');
const zenExitBtn = document.getElementById('zen-exit-btn');
const appContainer = document.querySelector('.app-container');
const sidebarElement = document.querySelector('.sidebar');

// SETTINGS DOM ELEMENTS
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsSaveStatus = document.getElementById('settings-save-status');
const themeSwitch = document.getElementById('theme-switch');
const opacitySlider = document.getElementById('overlay-opacity-slider');
const opacityValue = document.getElementById('overlay-opacity-value');
const providerSelect = document.getElementById('provider-select');
const localSettings = document.getElementById('local-settings');
const localRunnerSelect = document.getElementById('local-runner-select');
const localPortInput = document.getElementById('local-port-input');
const cloudSettings = document.getElementById('cloud-settings');
const cloudBaseUrlInput = document.getElementById('cloud-base-url');
const cloudModelInput = document.getElementById('cloud-model');
const cloudApiKeyInput = document.getElementById('cloud-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const clearApiKeyBtn = document.getElementById('clear-api-key-btn');

let appConfig = {};
let selectedTheme = 'dark';

// Wraps a native <select> in a custom-styled dropdown. The <select> stays in
// the DOM (hidden) as the single source of truth for .value - existing code
// that reads/writes modelSelect.value or listens for 'change' keeps working
// untouched. This avoids styling the native <select> directly, which is what
// caused the garbled/noisy rendering inside this app's transparent frameless
// window.
function enhanceSelect(selectEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';
  if (selectEl.id) wrapper.classList.add(`custom-select-for-${selectEl.id}`);
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.classList.add('native-select-hidden');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  wrapper.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu hidden';
  wrapper.appendChild(menu);

  function syncLabel() {
    const opt = selectEl.options[selectEl.selectedIndex];
    trigger.textContent = opt ? opt.textContent : '';
  }

  function closeMenu() {
    menu.classList.add('hidden');
    trigger.classList.remove('open');
  }

  function openMenu() {
    menu.innerHTML = '';
    Array.from(selectEl.options).forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-select-option' + (idx === selectEl.selectedIndex ? ' selected' : '');
      item.textContent = opt.textContent;
      item.addEventListener('click', () => {
        selectEl.selectedIndex = idx;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        syncLabel();
        closeMenu();
      });
      menu.appendChild(item);
    });
    menu.classList.remove('hidden');
    trigger.classList.add('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('hidden')) openMenu(); else closeMenu();
  });
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeMenu();
  });

  syncLabel();
  return { syncLabel };
}

let chatsData = JSON.parse(localStorage.getItem('ollama_chats_history')) || {};
let currentChatId = null;

const modelSelectUI = enhanceSelect(modelSelect);
const providerSelectUI = enhanceSelect(providerSelect);
const localRunnerSelectUI = enhanceSelect(localRunnerSelect);

const DEFAULT_WELCOME = "Hello! Please select a model to start a local conversation.";

async function fetchLocalModels() {
  try {
    statusText.innerText = "Scanning";
    statusText.style.color = "#a1a1aa";
    const response = await fetch(`${getOllamaHost()}/api/tags`);
    if (!response.ok) throw new Error('Offline');
    const data = await response.json();
    modelSelect.innerHTML = ''; 

    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        const sizeGb = (model.size / (1024 * 1024 * 1024)).toFixed(2);
        option.innerText = `${model.name} (${sizeGb}GB)`;
        modelSelect.appendChild(option);
      });
      statusText.innerText = "Online";
      statusText.style.color = "#a1a1aa";
    } else {
      modelSelect.innerHTML = '<option value="">No models</option>';
      statusText.innerText = "Empty";
    }
  } catch (error) {
    modelSelect.innerHTML = '<option value="">Offline</option>';
    statusText.innerText = "Offline";
    statusText.style.color = "#ef4444";
  }
  modelSelectUI.syncLabel();
}

function formatMarkdown(text) {
  let processedText = text;

  // Balance an odd number of open fences while a response is still streaming in
  const fenceMatches = processedText.match(/```/g);
  const fenceCount = fenceMatches ? fenceMatches.length : 0;
  if (fenceCount % 2 !== 0) {
    processedText += '\n```';
  }

  // Anything we render to raw HTML up-front (code blocks, inline code) gets
  // stashed behind a placeholder so the bold/italic/header rules below can't
  // reach inside and mangle it.
  const stash = [];
  const stashHtml = (html) => {
    const token = `%%MDPH_${stash.length}%%`;
    stash.push(html);
    return token;
  };

  // 1. Fenced code blocks
  processedText = processedText.replace(/```(\w*)[\r\n]+([\s\S]*?)```/g, (match, language, code) => {
    const lang = language.toLowerCase().trim();
    const langClass = lang ? `class="language-${lang}"` : '';
    const safeCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return stashHtml(`<pre><code ${langClass}>${safeCode}</code></pre>`);
  });

  // 2. Escape whatever raw HTML-sensitive characters remain in normal text
  processedText = processedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Inline code `like this`
  processedText = processedText.replace(/`([^`\n]+)`/g, (match, code) => stashHtml(`<code class="inline-code">${code}</code>`));

  // 4. Bold / italic (order matters: *** before ** before *)
  processedText = processedText.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  processedText = processedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processedText = processedText.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // 5. Block-level structure: headers, lists, paragraphs
  processedText = renderMarkdownBlocks(processedText);

  // 6. Restore stashed HTML
  processedText = processedText.replace(/%%MDPH_(\d+)%%/g, (match, idx) => stash[Number(idx)]);

  return processedText;
}

// Turns a flat string (already inline-formatted) into headers/lists/paragraphs.
function renderMarkdownBlocks(text) {
  const lines = text.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      html += `<p>${paragraphBuffer.join('<br>')}</p>`;
      paragraphBuffer = [];
    }
  };
  const closeLists = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '') {
      flushParagraph();
      closeLists();
      continue;
    }

    if (/^%%MDPH_\d+%%$/.test(line)) {
      flushParagraph();
      closeLists();
      html += line;
      continue;
    }

    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      closeLists();
      const level = headerMatch[1].length;
      html += `<h${level}>${headerMatch[2]}</h${level}>`;
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${ulMatch[1]}</li>`;
      continue;
    }

    const olMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${olMatch[1]}</li>`;
      continue;
    }

    closeLists();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  closeLists();
  return html;
}

// Splits a raw model response into { thoughts, answer, thinking } based on
// <think>...</think> tags, which local reasoning models (e.g. deepseek-r1,
// qwq) emit inline. Works incrementally while the tag is still open/streaming.
function parseThinking(rawText) {
  const openTag = '<think>';
  const closeTag = '</think>';
  const openIdx = rawText.indexOf(openTag);

  if (openIdx === -1) {
    return { thoughts: '', answer: rawText, thinking: false };
  }

  const closeIdx = rawText.indexOf(closeTag, openIdx);
  if (closeIdx === -1) {
    return {
      thoughts: rawText.slice(openIdx + openTag.length),
      answer: rawText.slice(0, openIdx),
      thinking: true
    };
  }

  const thoughts = rawText.slice(openIdx + openTag.length, closeIdx);
  const answer = rawText.slice(0, openIdx) + rawText.slice(closeIdx + closeTag.length);
  return { thoughts, answer, thinking: false };
}

function ensureThoughtsDropdown(msgDiv) {
  let dropdown = msgDiv.querySelector('.thoughts-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'thoughts-dropdown';
    dropdown.innerHTML = `
      <button type="button" class="thoughts-toggle">
        <span class="chevron">▶</span>
        <span class="thoughts-label">Thinking…</span>
      </button>
      <div class="thoughts-content"></div>
    `;
    dropdown.querySelector('.thoughts-toggle').addEventListener('click', () => {
      dropdown.classList.toggle('open');
    });
    msgDiv.insertBefore(dropdown, msgDiv.firstChild);
  }
  return dropdown;
}

// Renders/updates an AI message bubble from raw (possibly still-streaming) text.
function updateAiMessage(msgDiv, rawText, isDone) {
  const { thoughts, answer, thinking } = parseThinking(rawText);

  if (thoughts.trim()) {
    const dropdown = ensureThoughtsDropdown(msgDiv);
    dropdown.querySelector('.thoughts-content').innerText = thoughts.trim();
    dropdown.querySelector('.thoughts-label').innerText = (thinking && !isDone) ? 'Thinking…' : 'Thoughts';
  }

  let answerEl = msgDiv.querySelector('.ai-answer');
  if (!answerEl) {
    answerEl = document.createElement('div');
    answerEl.className = 'ai-answer';
    msgDiv.appendChild(answerEl);
  }

  answerEl.innerHTML = formatMarkdown(answer);
  answerEl.querySelectorAll('pre code').forEach((el) => {
    hljs.highlightElement(el);
  });
}

function appendMessage(text, isUser = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = isUser ? 'message user-message' : 'message ai-message';
  
  if (isUser) {
    msgDiv.innerText = text;
  } else {
    updateAiMessage(msgDiv, text, true);
  }
  
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msgDiv;
}

function startNewChat() {
  currentChatId = 'chat_' + Date.now();
  chatMessages.innerHTML = '';
  appendMessage(DEFAULT_WELCOME, false);
  renderHistoryList();
}

function loadChat(chatId) {
  currentChatId = chatId;
  chatMessages.innerHTML = '';
  const chat = chatsData[chatId];
  if (chat && chat.messages.length > 0) {
    chat.messages.forEach(msg => appendMessage(msg.text, msg.isUser));
  } else {
    appendMessage(DEFAULT_WELCOME, false);
  }
  renderHistoryList();
}

function deleteChat(chatId, event) {
  event.stopPropagation();
  delete chatsData[chatId];
  localStorage.setItem('ollama_chats_history', JSON.stringify(chatsData));
  if (currentChatId === chatId) startNewChat(); else renderHistoryList();
}

function renderHistoryList() {
  historyList.innerHTML = '';
  const sortedIds = Object.keys(chatsData).sort((a, b) => chatsData[b].updatedAt - chatsData[a].updatedAt);

  sortedIds.forEach(id => {
    const item = document.createElement('div');
    item.className = 'history-item' + (id === currentChatId ? ' active' : '');
    item.addEventListener('click', () => loadChat(id));

    const titleSpan = document.createElement('span');
    titleSpan.innerText = chatsData[id].title;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-history-btn';
    delBtn.innerHTML = '&times;'; 
    delBtn.addEventListener('click', (e) => deleteChat(id, e));

    item.appendChild(titleSpan);
    item.appendChild(delBtn);
    historyList.appendChild(item);
  });
}

async function handleSendMessage() {
  const text = chatInput.value.trim();
  const provider = appConfig.apiProvider || 'ollama';
  const selectedModel = modelSelect.value;

  if (!text) return;
  if (provider === 'ollama' && !selectedModel) return;

  appendMessage(text, true);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  if (!chatsData[currentChatId]) {
    chatsData[currentChatId] = {
      title: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
      messages: [],
      updatedAt: Date.now()
    };
  }
  chatsData[currentChatId].messages.push({ text: text, isUser: true });
  chatsData[currentChatId].updatedAt = Date.now();
  localStorage.setItem('ollama_chats_history', JSON.stringify(chatsData));
  renderHistoryList();

  const aiMessageElement = appendMessage("");
  let fullAiResponse = "";

  const finalizeAndSave = () => {
    chatsData[currentChatId].messages.push({ text: fullAiResponse, isUser: false });
    localStorage.setItem('ollama_chats_history', JSON.stringify(chatsData));
  };

  // ---------- CLOUD API PATH ----------
  if (provider === 'cloud') {
    window.api.cloudChat(text, appConfig.cloudModel, {
      onChunk: (chunk) => {
        fullAiResponse += chunk;
        updateAiMessage(aiMessageElement, fullAiResponse, false);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      onDone: () => {
        updateAiMessage(aiMessageElement, fullAiResponse, true);
        finalizeAndSave();
      },
      onError: (message) => {
        const answerEl = aiMessageElement.querySelector('.ai-answer') || aiMessageElement;
        answerEl.innerText = `Error: ${message}`;
      }
    });
    return;
  }

  // ---------- LOCAL OLLAMA PATH ----------
  try {
    const response = await fetch(`${getOllamaHost()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, prompt: text, stream: true })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim() !== '') {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            fullAiResponse += parsed.response;
            updateAiMessage(aiMessageElement, fullAiResponse, false);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }
      }
    }
    updateAiMessage(aiMessageElement, fullAiResponse, true);
    finalizeAndSave();
  } catch (error) {
    const answerEl = aiMessageElement.querySelector('.ai-answer') || aiMessageElement;
    answerEl.innerText = "Error connecting to model.";
  }
}

// INTERACTIVITIES
sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
refreshBtn.addEventListener('click', fetchLocalModels);
newChatBtn.addEventListener('click', startNewChat);

// TOGGLE ZEN MODE EVENTS
overlayBtn.addEventListener('click', () => window.api.toggleOverlay());
zenExitBtn.addEventListener('click', () => window.api.toggleOverlay());

window.api.onOverlayEnabled(() => {
  appContainer.classList.add('overlay-active');
  sidebarElement.classList.add('zen-collapsed'); // hides model/history, keeps footer icons
  chatMessages.style.padding = '20px 15px';
  document.querySelector('.chat-input-container').style.padding = '15px 15px 25px 15px';
  overlayBtn.classList.add('active');
});

window.api.onOverlayDisabled(() => {
  appContainer.classList.remove('overlay-active');
  sidebarElement.classList.remove('zen-collapsed');
  chatMessages.style.padding = '40px 15% 20px 15%';
  document.querySelector('.chat-input-container').style.padding = '20px 15% 30px 15%';
  overlayBtn.classList.remove('active');
});

// ---------- SETTINGS ----------
function updateSliderFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const val = Number(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  const isLight = document.body.classList.contains('light-theme');
  const fillColor = isLight ? '#18181b' : '#f4f4f5';
  const trackColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)';
  slider.style.setProperty('--slider-fill', `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${pct}%, ${trackColor} ${pct}%, ${trackColor} 100%)`);
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  const darkSheet = document.getElementById('hljs-theme-dark');
  const lightSheet = document.getElementById('hljs-theme-light');
  if (darkSheet && lightSheet) {
    darkSheet.disabled = theme === 'light';
    lightSheet.disabled = theme !== 'light';
  }
}

function setThemeButtons(theme) {
  themeSwitch.checked = theme === 'dark';
}

async function populateSettingsForm() {
  const config = await window.api.getConfig();
  appConfig = config;

  selectedTheme = config.theme || 'dark';
  setThemeButtons(selectedTheme);

  const pct = Math.round((config.overlayOpacity || 0.8) * 100);
  opacitySlider.value = pct;
  opacityValue.innerText = `${pct}%`;
  updateSliderFill(opacitySlider);

  providerSelect.value = config.apiProvider || 'ollama';
  providerSelectUI.syncLabel();
  cloudSettings.classList.toggle('hidden', providerSelect.value !== 'cloud');
  localSettings.classList.toggle('hidden', providerSelect.value !== 'ollama');

  localRunnerSelect.value = config.localRunner || 'ollama';
  localRunnerSelectUI.syncLabel();
  localPortInput.value = config.localPort || DEFAULT_LOCAL_PORT;

  cloudBaseUrlInput.value = config.cloudApiBaseUrl || '';
  cloudModelInput.value = config.cloudModel || '';
  cloudApiKeyInput.value = '';
  apiKeyStatus.innerText = config.hasApiKey ? 'A key is saved.' : 'No key saved.';
}

function openSettingsModal() {
  populateSettingsForm();
  settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
  cloudApiKeyInput.value = '';
  // revert any live theme preview that wasn't saved
  applyTheme(appConfig.theme || 'dark');
}

settingsBtn.addEventListener('click', openSettingsModal);
settingsCloseBtn.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

themeSwitch.addEventListener('change', () => {
  selectedTheme = themeSwitch.checked ? 'dark' : 'light';
  applyTheme(selectedTheme); // live preview, confirmed on Save
  updateSliderFill(opacitySlider);
});

opacitySlider.addEventListener('input', () => {
  const pct = Number(opacitySlider.value);
  opacityValue.innerText = `${pct}%`;
  window.api.previewOverlayOpacity(pct / 100); // live preview if overlay mode is on
  updateSliderFill(opacitySlider);
});

providerSelect.addEventListener('change', () => {
  cloudSettings.classList.toggle('hidden', providerSelect.value !== 'cloud');
  localSettings.classList.toggle('hidden', providerSelect.value !== 'ollama');
});

// Picking a runner auto-fills its default port (still editable by the user).
// Picking "Custom" clears the field so the user can type their own port.
localRunnerSelect.addEventListener('change', () => {
  const opt = localRunnerSelect.options[localRunnerSelect.selectedIndex];
  const defaultPort = opt ? opt.dataset.port : '';
  if (localRunnerSelect.value === 'custom') {
    localPortInput.value = '';
    localPortInput.focus();
  } else {
    localPortInput.value = defaultPort || '';
  }
});

clearApiKeyBtn.addEventListener('click', async () => {
  const result = await window.api.clearApiKey();
  apiKeyStatus.innerText = result.hasApiKey ? 'A key is saved.' : 'No key saved.';
  cloudApiKeyInput.value = '';
});

settingsSaveBtn.addEventListener('click', async () => {
  const overlayOpacity = Number(opacitySlider.value) / 100;

  const result = await window.api.setConfig({
    theme: selectedTheme,
    overlayOpacity,
    apiProvider: providerSelect.value,
    localRunner: localRunnerSelect.value,
    localPort: Number(localPortInput.value) || DEFAULT_LOCAL_PORT,
    cloudApiBaseUrl: cloudBaseUrlInput.value.trim(),
    cloudModel: cloudModelInput.value.trim()
  });

  const newKey = cloudApiKeyInput.value.trim();
  if (newKey) {
    const keyResult = await window.api.setApiKey(newKey);
    apiKeyStatus.innerText = keyResult.hasApiKey ? 'A key is saved.' : 'No key saved.';
    cloudApiKeyInput.value = '';
  }

  appConfig = result.config;
  applyTheme(appConfig.theme);

  settingsSaveStatus.innerText = 'Saved!';
  settingsSaveStatus.classList.add('show');
  setTimeout(() => settingsSaveStatus.classList.remove('show'), 1500);
});

async function initConfig() {
  appConfig = await window.api.getConfig();
  applyTheme(appConfig.theme || 'dark');
}

window.addEventListener('DOMContentLoaded', async () => {
  await initConfig();
  fetchLocalModels();
  const sortedIds = Object.keys(chatsData).sort((a, b) => chatsData[b].updatedAt - chatsData[a].updatedAt);
  if (sortedIds.length > 0) loadChat(sortedIds[0]); else startNewChat();
});


function processCodeBlocksWithCopy() {
  // Find all code that has a header/footer
  const preElements = document.querySelectorAll('.chat-messages pre');

  preElements.forEach((preEl) => {
    
    if (preEl.dataset.processed === 'true' || preEl.querySelector('.code-footer') || preEl.querySelector('.code-header')) {
      return;
    }

    const codeEl = preEl.querySelector('code');
    if (!codeEl) return;

    //Mark this block as immediately processed to prevent the MutationObserver from scanning it.
    preEl.dataset.processed = 'true';

    // 2. Extract the programming language name from the class
    let langName = 'CODE';
    const classes = Array.from(codeEl.classList);
    const langClass = classes.find(c => c.startsWith('language-') || c.startsWith('lang-') || c.includes('hljs'));
    if (langClass && !langClass.includes('hljs')) {
      langName = langClass.replace('language-', '').replace('lang-', '').toUpperCase();
    }

    // 3. Backup code
    const clonedCodeEl = codeEl.cloneNode(true);

    // 4. Create a clean 3-level structure
    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `<span>${langName}</span>`;

    const footer = document.createElement('div');
    footer.className = 'code-footer';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-code-btn';
    copyBtn.setAttribute('title', 'Copy code');
    copyBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;

    // Copy text logic for clone
    copyBtn.addEventListener('click', async () => {
      const textToCopy = clonedCodeEl.innerText;
      try {
        await navigator.clipboard.writeText(textToCopy);
        
        const toast = document.createElement('div');
        toast.className = 'copied-toast';
        toast.innerText = 'Copied!';
        footer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => toast.remove(), 200);
        }, 1500);
      } catch (err) {
        console.error('Lỗi copy:', err);
      }
    });

    footer.appendChild(copyBtn);

    // 5. Clear the existing content of the pre tag and load the new 3-level structure.
    preEl.innerHTML = '';
    preEl.appendChild(header);
    preEl.appendChild(clonedCodeEl);
    preEl.appendChild(footer);
  });
}

// Launch observer to monitor the safe chat frame
const observer = new MutationObserver((mutations) => {
  // Pause observation while modifying DOM content to avoid triggering an infinite loop.
  observer.disconnect();
  
  processCodeBlocksWithCopy();
  
  // After processing is complete, re-enable monitoring as usual.
  startObserver();
});

function startObserver() {
  const chatContainer = document.querySelector('.chat-messages');
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  startObserver();
  processCodeBlocksWithCopy();
  
  // Fallback in case of delayed DOM rendering 
  setTimeout(() => {
    processCodeBlocksWithCopy();
    startObserver();
  }, 1000);
});

const observeCodeBlocks = () => {
  const targetNode = document.querySelector('.chat-messages') || document.body;

  const checkAndFormatCode = (preElement) => {
    const codeElement = preElement.querySelector('code');
    if (!codeElement || preElement.classList.contains('short-code-checked')) return;

    // Mark as checked to avoid infinite loops
    preElement.classList.add('short-code-checked');

    // Count lines
    const lineCount = codeElement.textContent.trim().split('\n').length;

    // If 2 lines or fewer, treat as short code
    if (lineCount <= 2) {
      preElement.classList.add('short-code');
      
      const header = preElement.querySelector('.code-header');
      const footer = preElement.querySelector('.code-footer');
      if (header) header.style.setProperty('display', 'none', 'important');
      if (footer) footer.style.setProperty('display', 'none', 'important');
    }
  };

  // Check existing elements immediately
  targetNode.querySelectorAll('pre').forEach(checkAndFormatCode);

  // Watch for newly added elements (dynamic markdown rendering)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches('pre')) {
            checkAndFormatCode(node);
          }
          node.querySelectorAll('pre').forEach(checkAndFormatCode);
        }
      });
    });
  });

  observer.observe(targetNode, { childList: true, subtree: true });
};

// Start watching
observeCodeBlocks();