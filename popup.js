const autoCloseToggle = document.getElementById('auto-close-toggle');
const tabLimitInput = document.getElementById('tab-limit');
const settingsState = { autoClose: false, tabLimit: 10 };

function syncSettingsUI() {
    autoCloseToggle.checked = settingsState.autoClose;
    tabLimitInput.value = settingsState.tabLimit;
}

function persistSettings() {
    chrome.runtime.sendMessage({
        action: 'updateSettings',
        autoClose: settingsState.autoClose,
        tabLimit: settingsState.tabLimit
    });
}

chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
    if (!settings) return;
    settingsState.autoClose = Boolean(settings.autoClose);
    settingsState.tabLimit = settings.tabLimit || 10;
    syncSettingsUI();
});

autoCloseToggle.addEventListener('change', () => {
    settingsState.autoClose = autoCloseToggle.checked;
    persistSettings();
});

tabLimitInput.addEventListener('change', () => {
    const parsed = parseInt(tabLimitInput.value, 10);
    if (!Number.isNaN(parsed)) {
        settingsState.tabLimit = Math.max(2, Math.min(50, parsed));
        tabLimitInput.value = settingsState.tabLimit;
        persistSettings();
    }
});

const listDiv = document.getElementById('list');
const archiveNoteInput = document.getElementById('archive-note');
const archiveSearchInput = document.getElementById('archive-search');
const archiveDomainFilter = document.getElementById('archive-domain-filter');
const archiveAgeFilter = document.getElementById('archive-age-filter');
const loadMoreArchiveBtn = document.getElementById('load-more-archive');
const ARCHIVE_PAGE_SIZE = 15;
const archiveState = { records: [], filtered: [], visibleCount: ARCHIVE_PAGE_SIZE };

const getDomainLabel = (url) => {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./, '') || hostname;
    } catch (err) {
        return 'unknown';
    }
};

const createArchiveRow = (item) => {
    const div = document.createElement('div');
    div.className = 'tab-item';

    const header = document.createElement('div');
    header.className = 'row-head';

    if (item.favicon) {
        const icon = document.createElement('img');
        icon.className = 'favicon';
        icon.src = item.favicon;
        icon.alt = '';
        header.appendChild(icon);
    }

    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.textContent = item.title || item.url;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'openArchivedTab', tab: item });
    });
    header.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const domainLabel = item.domain || getDomainLabel(item.url);
    meta.innerHTML = `
        <span>${domainLabel}</span>
        <span>${item.date || ''}</span>
    `;

    div.appendChild(header);
    div.appendChild(meta);
    if (item.note) {
        const note = document.createElement('div');
        note.className = 'note';
        note.textContent = item.note;
        div.appendChild(note);
    }

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'inline-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'restoreArchivedTab', tab: item }, () => {
            location.reload();
        });
    });
    div.appendChild(restoreBtn);
    return div;
};

const renderArchiveList = () => {
    listDiv.innerHTML = '';
    if (archiveState.filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tab-item';
        empty.textContent = 'No archived tabs match your filters yet.';
        listDiv.appendChild(empty);
        loadMoreArchiveBtn.style.display = 'none';
        return;
    }

    const visibleItems = archiveState.filtered.slice(0, archiveState.visibleCount);
    visibleItems.forEach(item => listDiv.appendChild(createArchiveRow(item)));

    if (archiveState.visibleCount < archiveState.filtered.length) {
        loadMoreArchiveBtn.style.display = 'block';
        loadMoreArchiveBtn.disabled = false;
        loadMoreArchiveBtn.textContent = `Load more (${archiveState.filtered.length - archiveState.visibleCount} left)`;
    } else {
        loadMoreArchiveBtn.style.display = 'none';
    }
};

const applyArchiveFilters = (resetVisible = false) => {
    if (resetVisible) {
        archiveState.visibleCount = ARCHIVE_PAGE_SIZE;
    }

    const query = archiveSearchInput.value.trim().toLowerCase();
    const domain = archiveDomainFilter.value;
    const ageFilter = archiveAgeFilter.value;
    let cutoff = null;

    if (ageFilter !== 'all') {
        const days = parseInt(ageFilter, 10);
        cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    }

    archiveState.filtered = archiveState.records.filter(item => {
        const domainLabel = item.domain || getDomainLabel(item.url);
        const domainMatch = domain === 'all' || domainLabel === domain;

        let ageMatch = true;
        if (cutoff) {
            const timestamp = item.date ? Date.parse(item.date) : NaN;
            ageMatch = Number.isFinite(timestamp) ? timestamp >= cutoff : false;
        }

        let searchMatch = true;
        if (query) {
            const text = `${item.title || ''} ${item.url || ''}`.toLowerCase();
            searchMatch = text.includes(query);
        }

        return domainMatch && ageMatch && searchMatch;
    });

    renderArchiveList();
};

const hydrateDomainFilter = () => {
    const domains = Array.from(new Set(archiveState.records.map(item => item.domain || getDomainLabel(item.url)))).filter(Boolean).sort();
    archiveDomainFilter.innerHTML = '<option value="all">All domains</option>' +
        domains.map(domain => `<option value="${domain}">${domain}</option>`).join('');
};

chrome.storage.local.get({ archived: [] }, (data) => {
    archiveState.records = data.archived.slice().reverse();
    hydrateDomainFilter();
    applyArchiveFilters(true);
});

archiveSearchInput.addEventListener('input', () => applyArchiveFilters(true));
archiveDomainFilter.addEventListener('change', () => applyArchiveFilters(true));
archiveAgeFilter.addEventListener('change', () => applyArchiveFilters(true));

loadMoreArchiveBtn.addEventListener('click', () => {
    archiveState.visibleCount += ARCHIVE_PAGE_SIZE;
    renderArchiveList();
});

document.getElementById('clear').onclick = () => {
    chrome.storage.local.set({ archived: [] }, () => location.reload());
};

const currentListDiv = document.getElementById('current-list');
const selectedTabs = [];

chrome.storage.local.get({ current: [] }, (data) => {
    const safe = data.current.filter(item => item && item.url && item.title);
    if (safe.length !== data.current.length) {
        chrome.storage.local.set({ current: safe }); // clean bad entries
    }
    // Add header with "Select" column
    const headerDiv = document.createElement('div');
    headerDiv.className = 'current-header';
    headerDiv.innerHTML = `
        <span>Current Tabs</span>
        <span>Select</span>
    `;
    currentListDiv.appendChild(headerDiv);

    const checkboxes = [];
    let lastCheckedIndex = null;

    const updateSelection = (box, checked) => {
        const { id, url, title, date } = box.dataset;
        const parsedId = Number(id);
        const numericId = Number.isFinite(parsedId) ? parsedId : null;
        const idx = selectedTabs.findIndex(tab => (numericId !== null ? tab.id === numericId : tab.url === url));
        if (checked && idx === -1) {
            selectedTabs.push({ id: numericId, url, title, date });
        } else if (!checked && idx !== -1) {
            selectedTabs.splice(idx, 1);
        }
    };

    safe.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tab-item current-row';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'current-content';
        contentDiv.innerHTML = `
            <a href="${item.url}" target="_blank">${item.title}</a><br>
            <span class="date">${item.date || ''}</span>
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'ios-checkbox';
        checkbox.dataset.id = item.id;
        checkbox.dataset.url = item.url;
        checkbox.dataset.title = item.title;
        checkbox.dataset.date = item.date || new Date().toLocaleString();

        const idx = checkboxes.length;
        checkboxes.push(checkbox);
        
        checkbox.addEventListener('click', (e) => {
            const targetState = checkbox.checked;

            if (e.shiftKey && lastCheckedIndex !== null) {
                const start = Math.min(lastCheckedIndex, idx);
                const end = Math.max(lastCheckedIndex, idx);
                for (let i = start; i <= end; i++) {
                    const cb = checkboxes[i];
                    cb.checked = targetState;
                    updateSelection(cb, targetState);
                }
            } else {
                updateSelection(checkbox, targetState);
                lastCheckedIndex = idx;
            }
        });

        div.appendChild(contentDiv);
        div.appendChild(checkbox);
        currentListDiv.appendChild(div);
    });
});

document.getElementById('archive-selected').onclick = () => {
    if (selectedTabs.length === 0) return;
    
    // Get the actual tab objects to pass to archiveTabs
    chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        const tabsToArchive = tabs.filter(tab => {
            return selectedTabs.some(selected => {
                if (typeof selected.id === 'number') {
                    return tab.id === selected.id;
                }
                return selected.url === tab.url;
            });
        });
        const note = (archiveNoteInput.value || '').trim();
        
        // Use the background archiveTabs function to capture scroll position
        chrome.runtime.sendMessage(
            { action: 'archiveSelectedTabs', tabs: tabsToArchive, note },
            () => {
                selectedTabs.length = 0;
                archiveNoteInput.value = '';
                location.reload();
            }
        );
    });
};