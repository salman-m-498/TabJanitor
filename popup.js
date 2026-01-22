const listDiv = document.getElementById('list');
        chrome.storage.local.get({ archived: [] }, (data) => {
            data.archived.reverse().forEach(item => {
                const div = document.createElement('div');
                div.className = 'tab-item';
                div.innerHTML = `
                    <a href="${item.url}" target="_blank">${item.title}</a><br>
                    <span class="date">${item.date || ''}</span>
                `;
                listDiv.appendChild(div);
            });
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
    headerDiv.style.fontWeight = 'bold';
    headerDiv.style.marginBottom = '8px';
    headerDiv.innerHTML = `
        <span style="display: inline-block; width: calc(100% - 30px); vertical-align: middle;">Current Tabs</span>
        <span style="display: inline-block; width: 30px; text-align: center;">Select</span>
    `;
    currentListDiv.appendChild(headerDiv);

    const checkboxes = [];
    let lastCheckedIndex = null;

    const updateSelection = (box, checked) => {
        const { url, title, date } = box.dataset;
        const idx = selectedTabs.findIndex(tab => tab.url === url);
        if (checked && idx === -1) {
            selectedTabs.push({ url, title, date });
        } else if (!checked && idx !== -1) {
            selectedTabs.splice(idx, 1);
        }
    };

    safe.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tab-item';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        
        const contentDiv = document.createElement('div');
        contentDiv.style.flex = '1';
        contentDiv.innerHTML = `
            <a href="${item.url}" target="_blank">${item.title}</a><br>
            <span class="date">${item.date || ''}</span>
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.marginLeft = '10px';
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
    chrome.storage.local.get({ archived: [], current: [] }, (data) => {
        const updatedArchive = data.archived.concat(selectedTabs.map(tab => ({
            title: tab.title,
            url: tab.url,
            date: tab.date || new Date().toLocaleString()
        })));

        // Remove these tabs from the browser and update storage
        chrome.storage.local.set({ archived: updatedArchive }, () => {
            selectedTabs.forEach(tab => {
                chrome.tabs.query({ url: tab.url }, (tabs) => {
                    tabs.forEach(t => chrome.tabs.remove(t.id));
                });
            });

            // Clear selection and refresh lists
            selectedTabs.length = 0;
            location.reload();
        });
    });
};