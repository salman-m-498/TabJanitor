const TAB_LIMIT = 10;

let autoClose = false
let saveTimer = null;

function saveCurrentTabs(tabs){
    chrome.storage.local.set({ current: tabs });
}

function captureCurrentTabs(){
        chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        const current = tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url }));

        saveCurrentTabs(current);
    });
}

function scheduleCapture() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(captureCurrentTabs, 200); // debounce
};

chrome.tabs.onCreated.addListener(() => {
    chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        if (!autoClose) return;
        if (tabs.length > TAB_LIMIT) {
            // Sort by ID (oldest first) or use 'lastAccessed' if available
            const overflow = tabs.slice(0, tabs.length - TAB_LIMIT);
            
            archiveTabs(overflow);
        }
    });
    scheduleCapture();
});

function archiveTabs(tabsToKill) {
    chrome.storage.local.get({ archived: [] }, (result) => {
        let currentArchive = result.archived;
        
        tabsToKill.forEach(tab => {
            currentArchive.push({
                title: tab.title,
                url: tab.url,
                date: new Date().toLocaleString()
            });
            chrome.tabs.remove(tab.id);
        });

        chrome.storage.local.set({ archived: currentArchive }, () => {
            console.log("Tabs archived and closed.");
            console.log(`Archived and closed ${tabsToKill.length} tabs.`);
            console.log("Current archive:", currentArchive);
            showNotification(tabsToKill.length);
        });
    });
}

function showNotification(count) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png", // You'll need a small 128x128 icon
        title: "Focus-Guard Active",
        message: `Closed ${count} tabs to save memory. Check your archive!`
    });
}

chrome.tabs.onRemoved.addListener(() => scheduleCapture());
chrome.tabs.onUpdated.addListener(() => scheduleCapture());
chrome.tabs.onActivated.addListener(() => scheduleCapture());

captureCurrentTabs();