let autoClose = false;
let tabLimit = 10;
let saveTimer = null;
const pendingScrollPositions = new Map();
const REMINDER_ALARM = 'tabJanitorArchiveReminder';
const STALE_ARCHIVE_DAYS = 7;
const REMINDER_INTERVAL_MINUTES = 360; // every 6 hours
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const NOTIFICATION_ICON = 'icons/favicon-128x128.png';
const getDomainLabel = (url) => {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./, '') || hostname;
    } catch (err) {
        return 'unknown';
    }
};
const generateArchiveId = () => {
    if (self.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

function removeArchivedEntry(match, callback) {
    chrome.storage.local.get({ archived: [] }, (result) => {
        const items = result.archived;
        const index = items.findIndex((item) => {
            if (match.id && item.id) {
                return item.id === match.id;
            }
            return item.url === match.url && item.date === match.date;
        });

        if (index !== -1) {
            items.splice(index, 1);
            chrome.storage.local.set({ archived: items }, () => callback && callback(true));
        } else if (callback) {
            callback(false);
        }
    });
}

function scheduleReminderAlarm() {
    if (!chrome.alarms) {
        console.warn('Alarms API unavailable; reminder scheduling skipped.');
        return;
    }
    chrome.alarms.create(REMINDER_ALARM, { periodInMinutes: REMINDER_INTERVAL_MINUTES });
}

function handleReminderAlarm() {
    chrome.storage.local.get({ archived: [], lastReminder: 0 }, (data) => {
        const now = Date.now();
        if (now - data.lastReminder < REMINDER_COOLDOWN_MS) {
            return;
        }

        const cutoff = now - STALE_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
        const stale = data.archived.filter((item) => {
            const timestamp = item.date ? Date.parse(item.date) : NaN;
            return Number.isFinite(timestamp) && timestamp < cutoff;
        });

        if (stale.length === 0) {
            return;
        }

        chrome.notifications.create({
            type: 'basic',
            iconUrl: NOTIFICATION_ICON,
            title: 'Time to review archived tabs',
            message: `You have ${stale.length} tab${stale.length === 1 ? '' : 's'} archived for over ${STALE_ARCHIVE_DAYS} days.`
        });

        chrome.storage.local.set({ lastReminder: now });
    });
}

function loadSettings() {
    chrome.storage.local.get({ autoClose: false, tabLimit: 10 }, (settings) => {
        autoClose = settings.autoClose;
        tabLimit = settings.tabLimit;
    });
}

function saveCurrentTabs(tabs){
    chrome.storage.local.set({ current: tabs });
}

function captureCurrentTabs(){
        chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        const current = tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            // Store a readable timestamp for display/fallback
            date: new Date(tab.lastAccessed || Date.now()).toLocaleString()
        }));

        saveCurrentTabs(current);
    });
}

function scheduleCapture() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(captureCurrentTabs, 200); // debounce
};

loadSettings();
scheduleReminderAlarm();
handleReminderAlarm();

chrome.tabs.onCreated.addListener(() => {
    chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        if (!autoClose) return;
        if (tabs.length > tabLimit) {
            // Sort by ID (oldest first) or use 'lastAccessed' if available
            const overflow = tabs.slice(0, tabs.length - TAB_LIMIT);
            
            archiveTabs(overflow);
        }
    });
    scheduleCapture();
});

async function archiveTabs(tabsToKill, options = {}) {
    chrome.storage.local.get({ archived: [] }, async (result) => {
        let currentArchive = result.archived;
        const note = (options.note || '').trim();

        for (const tab of tabsToKill) {
            // Capture scroll position and visible text context
            const [{result: scrollData}] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
                    let textFragment = "";
                    if (el) {
                        // Get more text context - up to 20 words from the element
                        const text = el.innerText || el.textContent;
                        textFragment = text.split(' ').slice(0, 20).join(' ').trim();
                    }
                    return {
                        scrollY: window.scrollY,
                        scrollX: window.scrollX,
                        textFragment: textFragment
                    };
                }
            });

            // Create a "Smart URL" using scroll position and text context
            let smartUrl = tab.url;
            if (scrollData.textFragment) {
                // Try scroll-to-text fragment first
                smartUrl = `${tab.url}#:~:text=${encodeURIComponent(scrollData.textFragment)}`;
            } else if (scrollData.scrollY > 0) {
                // Fallback: store scroll position in a custom fragment
                smartUrl = `${tab.url}#tab-scroll-y=${Math.round(scrollData.scrollY)}`;
            }

            currentArchive.push({
                id: generateArchiveId(),
                title: tab.title,
                url: smartUrl,
                scrollY: scrollData.scrollY,
                date: new Date().toLocaleString(),
                favicon: tab.favIconUrl || '',
                domain: getDomainLabel(tab.url),
                note
            });

            chrome.tabs.remove(tab.id);
        }
        chrome.storage.local.set({ archived: currentArchive });
    });
}

function showNotification(count) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: NOTIFICATION_ICON,
        title: "Focus-Guard Active",
        message: `Closed ${count} tabs to save memory. Check your archive!`
    });
}

chrome.tabs.onRemoved.addListener(() => scheduleCapture());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    scheduleCapture();

    if (changeInfo.status === 'complete' && pendingScrollPositions.has(tabId)) {
        const scrollY = pendingScrollPositions.get(tabId);
        pendingScrollPositions.delete(tabId);

        if (typeof scrollY === 'number') {
            chrome.scripting.executeScript({
                target: { tabId },
                func: (y) => window.scrollTo(0, y),
                args: [scrollY]
            });
        }
    }
});
chrome.tabs.onActivated.addListener(() => scheduleCapture());
if (chrome.alarms) {
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === REMINDER_ALARM) {
            handleReminderAlarm();
        }
    });
}

// Handle archive requests from popup with scroll position capture
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'archiveSelectedTabs') {
        archiveTabs(request.tabs, { note: request.note });
        sendResponse({ success: true });
        return;
    }

    if (request.action === 'openArchivedTab') {
        chrome.tabs.create({ url: request.tab.url }, (tab) => {
            if (request.tab.scrollY) {
                pendingScrollPositions.set(tab.id, request.tab.scrollY);
            }
            sendResponse({ success: true });
        });
        return true; // asynchronous response
    }

    if (request.action === 'getSettings') {
        sendResponse({ autoClose, tabLimit });
        return false;
    }

    if (request.action === 'restoreArchivedTab') {
        chrome.tabs.create({ url: request.tab.url }, (tab) => {
            if (request.tab.scrollY) {
                pendingScrollPositions.set(tab.id, request.tab.scrollY);
            }
            removeArchivedEntry(request.tab, () => sendResponse({ success: true }));
        });
        return true;
    }

    if (request.action === 'updateSettings') {
        if (typeof request.autoClose === 'boolean') {
            autoClose = request.autoClose;
        }
        if (typeof request.tabLimit === 'number') {
            tabLimit = Math.max(2, Math.min(50, Math.round(request.tabLimit)));
        }
        chrome.storage.local.set({ autoClose, tabLimit }, () => sendResponse({ success: true }));
        return true;
    }
});

captureCurrentTabs();