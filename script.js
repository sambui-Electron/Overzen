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
const themeSelect = document.getElementById('theme-select');
const opacitySlider = document.getElementById('overlay-opacity-slider');
const opacityValue = document.getElementById('overlay-opacity-value');
const providerSelect = document.getElementById('provider-select');
const localSettings = document.getElementById('local-settings');
const localRunnerSelect = document.getElementById('local-runner-select');
const localPortInput = document.getElementById('local-port-input');
const shortenModelNamesSwitch = document.getElementById('shorten-model-names-switch');
const cloudSettings = document.getElementById('cloud-settings');
const cloudBaseUrlInput = document.getElementById('cloud-base-url');
const cloudModelInput = document.getElementById('cloud-model');
const cloudModelListSelect = document.getElementById('cloud-model-list');
const cloudModelListRow = document.getElementById('cloud-model-list-row');
const cloudApiKeyInput = document.getElementById('cloud-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const clearApiKeyBtn = document.getElementById('clear-api-key-btn');

// APP LOCK DOM ELEMENTS
const applockSwitch = document.getElementById('applock-switch');
const applockManage = document.getElementById('applock-manage');
const applockChangeBtn = document.getElementById('applock-change-btn');
const applockForm = document.getElementById('applock-form');
const applockCurrentRow = document.getElementById('applock-current-row');
const applockCurrentPin = document.getElementById('applock-current-pin');
const applockNewLabel = document.getElementById('applock-new-label');
const applockNewPin = document.getElementById('applock-new-pin');
const applockConfirmPin = document.getElementById('applock-confirm-pin');
const applockFormStatus = document.getElementById('applock-form-status');
const applockCancelBtn = document.getElementById('applock-cancel-btn');
const applockConfirmBtn = document.getElementById('applock-confirm-btn');
const applockDisableForm = document.getElementById('applock-disable-form');
const applockDisablePin = document.getElementById('applock-disable-pin');
const applockDisableStatus = document.getElementById('applock-disable-status');
const applockDisableCancelBtn = document.getElementById('applock-disable-cancel-btn');
const applockDisableConfirmBtn = document.getElementById('applock-disable-confirm-btn');
const lockNowBtn = document.getElementById('lock-now-btn');
const lockScreen = document.getElementById('lock-screen');
const pinBoxes = document.querySelectorAll('#pin-boxes .pin-box');
const lockErrorEl = document.getElementById('lock-error');

let lockStatus = { enabled: false };
let applockMode = null; // 'enable' | 'change'
let enteredPin = '';
const PIN_LENGTH = 4;

let appConfig = {};
let selectedTheme = 'dark';

// Wraps a native <select> in a custom-styled dropdown. The <select> stays in
// the DOM (hidden) as the single source of truth for .value - existing code
// that reads/writes modelSelect.value or listens for 'change' keeps working
// untouched. This avoids styling the native <select> directly, which is what
// caused the garbled/noisy rendering inside this app's transparent frameless
// window.
function enhanceSelect(selectEl, { onRefresh } = {}) {
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

    // Refresh lives INSIDE the dropdown itself - a pinned row at the top,
    // not a separate always-visible button next to the select.
    if (onRefresh) {
      const refreshItem = document.createElement('div');
      refreshItem.className = 'custom-select-refresh-option';
      refreshItem.innerHTML = '<span class="refresh-icon">⟳</span><span>Refresh models</span>';
      refreshItem.addEventListener('click', (e) => {
        e.stopPropagation();
        onRefresh();
        closeMenu();
      });
      menu.appendChild(refreshItem);

      const divider = document.createElement('div');
      divider.className = 'custom-select-divider';
      menu.appendChild(divider);
    }

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

const modelSelectUI = enhanceSelect(modelSelect, { onRefresh: fetchLocalModels });
const providerSelectUI = enhanceSelect(providerSelect);
const localRunnerSelectUI = enhanceSelect(localRunnerSelect);
const cloudModelListUI = enhanceSelect(cloudModelListSelect);
const themeSelectUI = enhanceSelect(themeSelect);

const DEFAULT_WELCOME = "Hello! Please select a model to start a local conversation.";

// Title-cases a model name for display purposes only (e.g. "llama3.1" ->
// "Llama3.1", "deepseek-r1" -> "Deepseek-R1"). Operates on each run of
// word characters independently so punctuation like "." "-" "_" stays put.
function toTitleCase(str) {
  return str.replace(/[A-Za-z0-9]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

// When the "Automatically shorten model name" setting is on, strips the
// ":" and everything after it (e.g. Ollama tags like "llama3.1:8b" -> "llama3.1").
function shortenModelName(name) {
  if (appConfig && appConfig.shortenModelNames) {
    const idx = name.indexOf(':');
    if (idx !== -1) return name.slice(0, idx);
  }
  return name;
}

// Builds the display label shown in the Model dropdown from a raw model
// name: optionally shortens it (settings toggle), then title-cases it.
function formatModelDisplayName(name) {
  return toTitleCase(shortenModelName(name));
}

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
        option.innerText = `${formatModelDisplayName(model.name)} (${sizeGb}GB)`;
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

  // 4.5 Strikethrough
  processedText = processedText.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  // 4.6 Links [text](url)
  processedText = processedText.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 5. Block-level structure: headers, lists, tables, blockquotes, rules, paragraphs
  processedText = renderMarkdownBlocks(processedText);

  // 6. Restore stashed HTML
  processedText = processedText.replace(/%%MDPH_(\d+)%%/g, (match, idx) => stash[Number(idx)]);

  return processedText;
}

// Splits a table row line into trimmed cell strings, respecting an optional
// leading/trailing pipe and escaped pipes ("\|") inside cell content.
function splitTableRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);

  const cells = [];
  let current = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|';
      i++;
    } else if (ch === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

// A GFM table separator row looks like "| --- | :--- | ---: | :---: |"
// (outer pipes optional, at least 1 dash per column, optional colons for alignment).
function isTableSeparatorRow(line) {
  const trimmed = line.trim();
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(trimmed) || /^\|?\s*:?-+:?\s*\|?$/.test(trimmed) && trimmed.includes('-');
}

function getColumnAlignments(sepLine) {
  return splitTableRow(sepLine).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });
}

// Turns a flat string (already inline-formatted) into headers/lists/tables/
// blockquotes/rules/paragraphs.
function renderMarkdownBlocks(text) {
  const lines = text.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
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
  const closeBlockquote = () => {
    if (inBlockquote) { html += '</blockquote>'; inBlockquote = false; }
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line === '') {
      flushParagraph();
      closeLists();
      closeBlockquote();
      i++;
      continue;
    }

    if (/^%%MDPH_\d+%%$/.test(line)) {
      flushParagraph();
      closeLists();
      closeBlockquote();
      html += line;
      i++;
      continue;
    }

    // Horizontal rule: a standalone line of 3+ -, * or _
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      closeLists();
      closeBlockquote();
      html += '<hr>';
      i++;
      continue;
    }

    // Table: a row containing a pipe, immediately followed by a valid
    // "---|---|---" style separator row.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      flushParagraph();
      closeLists();
      closeBlockquote();

      const headerCells = splitTableRow(line);
      const alignments = getColumnAlignments(lines[i + 1]);
      i += 2;

      const bodyRows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }

      const alignAttr = (idx) => alignments[idx] ? ` style="text-align:${alignments[idx]}"` : '';

      html += '<table><thead><tr>';
      headerCells.forEach((cell, idx) => {
        html += `<th${alignAttr(idx)}>${cell}</th>`;
      });
      html += '</tr></thead><tbody>';
      bodyRows.forEach((row) => {
        html += '<tr>';
        headerCells.forEach((_, idx) => {
          html += `<td${alignAttr(idx)}>${row[idx] !== undefined ? row[idx] : ''}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      continue;
    }

    // Blockquote (the leading ">" has already been HTML-escaped to "&gt;"
    // by this point, since block parsing runs after the escaping step)
    const bqMatch = line.match(/^&gt;\s?(.*)$/);
    if (bqMatch) {
      flushParagraph();
      closeLists();
      if (!inBlockquote) { html += '<blockquote>'; inBlockquote = true; }
      html += `<p>${bqMatch[1]}</p>`;
      i++;
      continue;
    }
    closeBlockquote();

    const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      closeLists();
      const level = headerMatch[1].length;
      html += `<h${level}>${headerMatch[2]}</h${level}>`;
      i++;
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${ulMatch[1]}</li>`;
      i++;
      continue;
    }

    const olMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${olMatch[1]}</li>`;
      i++;
      continue;
    }

    closeLists();
    paragraphBuffer.push(line);
    i++;
  }

  flushParagraph();
  closeLists();
  closeBlockquote();
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

// Renders a friendlier error state in an AI message bubble: a plain-language
// explanation of what went wrong, followed by a short, concrete tip on what
// to do next. This replaces bare/technical error strings with something a
// non-technical user can actually act on.
function renderErrorReply(msgDiv, explanation, advice) {
  let answerEl = msgDiv.querySelector('.ai-answer');
  if (!answerEl) {
    answerEl = document.createElement('div');
    answerEl.className = 'ai-answer';
    msgDiv.appendChild(answerEl);
  }
  answerEl.innerHTML = `
    <p class="error-explanation">${explanation}</p>
    <div class="error-advice"><strong>Tip:</strong><span>${advice}</span></div>
  `;
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
  if (provider === 'ollama' && !selectedModel) {
    appendMessage(text, true);
    const noModelMsg = appendMessage("");
    renderErrorReply(
      noModelMsg,
      "I don't have a model to talk to yet, so I can't reply to that.",
      "Pick a model from the dropdown at the top of the sidebar. If the list says \"Offline\" or \"No models\", start Ollama (or your chosen local runner) and click the refresh icon next to Models."
    );
    return;
  }

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
        const lower = (message || '').toLowerCase();
        let advice = "Double-check your API key, Base URL, and Model name in Settings \u2192 AI Provider, then try again.";
        if (lower.includes('no api key')) {
          advice = "Open Settings \u2192 AI Provider and add an API key for your cloud provider, then click Save.";
        } else if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid') && lower.includes('key')) {
          advice = "Your API key may be missing or incorrect. Re-enter it in Settings \u2192 AI Provider and Save.";
        } else if (lower.includes('404') || lower.includes('model')) {
          advice = "Check that the Model name in Settings \u2192 AI Provider is spelled correctly and is supported by your Base URL.";
        } else if (lower.includes('429')) {
          advice = "You've hit a rate limit or quota. Wait a bit and try again, or check your usage/billing with the provider.";
        } else if (lower.includes('econnrefused') || lower.includes('network') || lower.includes('fetch failed') || lower.includes('enotfound')) {
          advice = "Check your internet connection and that the Base URL in Settings \u2192 AI Provider is correct.";
        }
        renderErrorReply(
          aiMessageElement,
          `I couldn't get a response from the cloud API. The provider said: "${message}"`,
          advice
        );
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
    renderErrorReply(
      aiMessageElement,
      "I couldn't reach the local model runner, so I can't respond right now.",
      `Make sure your local runner (e.g. Ollama) is running on port ${(appConfig && appConfig.localPort) || DEFAULT_LOCAL_PORT}, then click the refresh icon next to Models and try again.`
    );
  }
}

// INTERACTIVITIES
sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
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

  const wrapper = slider.closest('.custom-slider');
  if (!wrapper) return;
  const fill = wrapper.querySelector('.custom-slider-fill');
  const thumb = wrapper.querySelector('.custom-slider-thumb');
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
}

// theme is one of 'dark' | 'light' | 'mocha'
function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  document.body.classList.toggle('mocha-theme', theme === 'mocha');
  const darkSheet = document.getElementById('hljs-theme-dark');
  const lightSheet = document.getElementById('hljs-theme-light');
  if (darkSheet && lightSheet) {
    // Mocha reuses the dark highlight.js sheet - only true Light gets the light one.
    darkSheet.disabled = theme === 'light';
    lightSheet.disabled = theme !== 'light';
  }
}

function setThemeButtons(theme) {
  themeSelect.value = theme;
  themeSelectUI.syncLabel();
}

// Pulls the history of previously-used cloud model names from persisted
// config storage and shows them as a pickable list, so switching to Cloud
// API surfaces what's already been used instead of an empty text field.
async function populateCloudModelsList() {
  let savedModels = [];
  try {
    savedModels = await window.api.getCloudModels();
  } catch (err) {
    savedModels = [];
  }

  cloudModelListSelect.innerHTML = '';

  if (!savedModels || savedModels.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = 'No saved models yet';
    cloudModelListSelect.appendChild(opt);
    cloudModelListRow.classList.add('hidden');
  } else {
    savedModels.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.innerText = name;
      cloudModelListSelect.appendChild(opt);
    });
    cloudModelListRow.classList.remove('hidden');

    // Reflect whatever is currently in the Model text field, if it's one
    // of the saved entries, so the two controls stay in sync on open.
    const currentIdx = savedModels.indexOf(cloudModelInput.value.trim());
    cloudModelListSelect.selectedIndex = currentIdx >= 0 ? currentIdx : 0;
  }

  cloudModelListUI.syncLabel();
}

// Picking a saved model fills the editable Model field with it (kept as a
// separate control so the user can still type a brand-new model name).
cloudModelListSelect.addEventListener('change', () => {
  if (cloudModelListSelect.value) {
    cloudModelInput.value = cloudModelListSelect.value;
  }
});

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
  shortenModelNamesSwitch.checked = !!config.shortenModelNames;

  cloudBaseUrlInput.value = config.cloudApiBaseUrl || '';
  cloudModelInput.value = config.cloudModel || '';
  cloudApiKeyInput.value = '';
  apiKeyStatus.innerText = config.hasApiKey ? 'A key is saved.' : 'No key saved.';
  if (providerSelect.value === 'cloud') {
    populateCloudModelsList();
  }

  lockStatus = await window.api.lock.status();
  applockSwitch.checked = lockStatus.enabled;
  applockManage.classList.toggle('hidden', !lockStatus.enabled);
  resetApplockForms();
  syncLockButtonVisibility();
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
  // discard any half-finished PIN entry and restore the switch to the real state
  resetApplockForms();
  applockSwitch.checked = lockStatus.enabled;
}

settingsBtn.addEventListener('click', openSettingsModal);
settingsCloseBtn.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});

themeSelect.addEventListener('change', () => {
  selectedTheme = themeSelect.value;
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

  // Switching to Cloud API: pull the saved-model history from storage so
  // the user can pick a previously-used model instead of retyping it.
  if (providerSelect.value === 'cloud') {
    populateCloudModelsList();
  }
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
  const shortenModelNamesChanged = !!appConfig.shortenModelNames !== shortenModelNamesSwitch.checked;

  const result = await window.api.setConfig({
    theme: selectedTheme,
    overlayOpacity,
    apiProvider: providerSelect.value,
    localRunner: localRunnerSelect.value,
    localPort: Number(localPortInput.value) || DEFAULT_LOCAL_PORT,
    shortenModelNames: shortenModelNamesSwitch.checked,
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

  if (providerSelect.value === 'cloud') {
    populateCloudModelsList();
  }

  // Re-render the local model dropdown's labels immediately if the
  // shorten-name preference changed, instead of waiting for the next refresh.
  if (shortenModelNamesChanged) {
    Array.from(modelSelect.options).forEach((opt) => {
      if (!opt.value) return;
      const sizeMatch = opt.innerText.match(/\(([^)]+)\)\s*$/);
      const sizeSuffix = sizeMatch ? ` (${sizeMatch[1]})` : '';
      opt.innerText = `${formatModelDisplayName(opt.value)}${sizeSuffix}`;
    });
    modelSelectUI.syncLabel();
  }

  settingsSaveStatus.innerText = 'Saved!';
  settingsSaveStatus.classList.add('show');
  setTimeout(() => settingsSaveStatus.classList.remove('show'), 1500);
});

// ---------- APP LOCK: LOCK SCREEN ----------
function renderPinBoxes() {
  pinBoxes.forEach((box, i) => {
    box.classList.toggle('filled', i < enteredPin.length);
    box.classList.toggle('active', i === enteredPin.length);
  });
}

// Keeps the sidebar "Lock" button in sync with whether App Lock is on,
// the instant it's toggled - not just the next time settings are reopened.
function syncLockButtonVisibility() {
  lockNowBtn.classList.toggle('hidden', !lockStatus.enabled);
}

function showLockScreen() {
  enteredPin = '';
  lockErrorEl.innerText = '\u00A0';
  renderPinBoxes();
  lockScreen.classList.remove('hidden');
}

function hideLockScreen() {
  enteredPin = '';
  renderPinBoxes();
  lockScreen.classList.add('hidden');
}

async function attemptUnlock() {
  if (enteredPin.length !== PIN_LENGTH) return;
  const pinToCheck = enteredPin;
  const result = await window.api.lock.verify(pinToCheck);
  if (result && result.success) {
    hideLockScreen();
  } else {
    lockErrorEl.innerText = 'Incorrect PIN';
    enteredPin = '';
    renderPinBoxes();
    lockScreen.classList.add('shake');
    setTimeout(() => lockScreen.classList.remove('shake'), 350);
  }
}

function handlePinInput(digit) {
  if (enteredPin.length >= PIN_LENGTH) return;
  enteredPin += digit;
  lockErrorEl.innerText = '\u00A0';
  renderPinBoxes();
  if (enteredPin.length === PIN_LENGTH) {
    // brief pause so the last box visibly fills before we verify
    setTimeout(attemptUnlock, 150);
  }
}

function handlePinBackspace() {
  enteredPin = enteredPin.slice(0, -1);
  lockErrorEl.innerText = '\u00A0';
  renderPinBoxes();
}

document.addEventListener('keydown', (e) => {
  if (lockScreen.classList.contains('hidden')) return;
  if (e.key >= '0' && e.key <= '9') {
    handlePinInput(e.key);
  } else if (e.key === 'Backspace') {
    handlePinBackspace();
  } else if (e.key === 'Enter') {
    attemptUnlock();
  }
});

lockNowBtn.addEventListener('click', () => {
  if (lockStatus.enabled) showLockScreen();
});

// ---------- APP LOCK: SETTINGS PANEL ----------
function resetApplockForms() {
  applockForm.classList.add('hidden');
  applockDisableForm.classList.add('hidden');
  applockFormStatus.innerText = '';
  applockDisableStatus.innerText = '';
  applockCurrentPin.value = '';
  applockNewPin.value = '';
  applockConfirmPin.value = '';
  applockDisablePin.value = '';
}

function openApplockForm(mode) {
  applockMode = mode;
  resetApplockForms();
  applockForm.classList.remove('hidden');
  applockCurrentRow.classList.toggle('hidden', mode !== 'change');
  applockNewLabel.innerText = mode === 'change' ? 'New PIN (4 digits)' : 'Create PIN (4 digits)';
}

function openApplockDisableForm() {
  resetApplockForms();
  applockDisableForm.classList.remove('hidden');
}

applockSwitch.addEventListener('change', () => {
  if (applockSwitch.checked) {
    openApplockForm('enable');
  } else {
    applockSwitch.checked = true; // stays visually on until the PIN is confirmed
    openApplockDisableForm();
  }
});

applockChangeBtn.addEventListener('click', () => openApplockForm('change'));

applockCancelBtn.addEventListener('click', () => {
  applockForm.classList.add('hidden');
  applockSwitch.checked = lockStatus.enabled;
});

applockConfirmBtn.addEventListener('click', async () => {
  const newPin = applockNewPin.value.trim();
  const confirmPin = applockConfirmPin.value.trim();

  if (!/^\d{4}$/.test(newPin)) {
    applockFormStatus.innerText = 'PIN must be exactly 4 digits.';
    return;
  }
  if (newPin !== confirmPin) {
    applockFormStatus.innerText = 'PINs do not match.';
    return;
  }

  if (applockMode === 'enable') {
    const result = await window.api.lock.enable(newPin);
    if (result.success) {
      lockStatus.enabled = true;
      applockSwitch.checked = true;
      applockManage.classList.remove('hidden');
      applockForm.classList.add('hidden');
      syncLockButtonVisibility();
    } else {
      applockFormStatus.innerText = result.error || 'Failed to enable App Lock.';
    }
  } else if (applockMode === 'change') {
    const currentPin = applockCurrentPin.value.trim();
    const result = await window.api.lock.changePin(currentPin, newPin);
    if (result.success) {
      applockForm.classList.add('hidden');
      settingsSaveStatus.innerText = 'PIN updated!';
      settingsSaveStatus.classList.add('show');
      setTimeout(() => settingsSaveStatus.classList.remove('show'), 1500);
    } else {
      applockFormStatus.innerText = result.error || 'Incorrect current PIN.';
    }
  }
});

applockDisableCancelBtn.addEventListener('click', () => {
  applockDisableForm.classList.add('hidden');
  applockSwitch.checked = true;
});

applockDisableConfirmBtn.addEventListener('click', async () => {
  const pin = applockDisablePin.value.trim();
  const result = await window.api.lock.disable(pin);
  if (result.success) {
    lockStatus.enabled = false;
    applockSwitch.checked = false;
    applockManage.classList.add('hidden');
    applockDisableForm.classList.add('hidden');
    syncLockButtonVisibility();
  } else {
    applockDisableStatus.innerText = result.error || 'Incorrect PIN.';
  }
});

async function initConfig() {
  appConfig = await window.api.getConfig();
  applyTheme(appConfig.theme || 'dark');

  lockStatus = await window.api.lock.status();
  syncLockButtonVisibility();
  if (lockStatus.enabled) {
    showLockScreen();
  }
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