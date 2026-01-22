const TAB_LIMIT = 10;

// Listen for new tabs being created
chrome.tabs.onCreated.addListener(() => {
    chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        if (tabs.length > TAB_LIMIT) {
            // Sort by ID (oldest first) or use 'lastAccessed' if available
            const overflow = tabs.slice(0, tabs.length - TAB_LIMIT);
            
            archiveTabs(overflow);
        }
    });

    chrome.tabs.query({ pinned: false, currentWindow: true }, (tabs) => {
        const currentTabs = tabs.map(tab => ({ id: tab.id, title: tab.title }));

        currentTabs(currentTabs);
    });
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

function currentTabs(tabs){
    chrome.storage.local.get({ current: [] }, (data) => {
        let currentTabs = data.current;
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