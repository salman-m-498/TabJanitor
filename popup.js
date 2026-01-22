const listDiv = document.getElementById('list');
        chrome.storage.local.get({ archived: [] }, (data) => {
            data.archived.reverse().forEach(item => {
                const div = document.createElement('div');
                div.className = 'tab-item';
                div.innerHTML = `
                    <a href="${item.url}" target="_blank">${item.title}</a><br>
                    <span class="date">${item.date}</span>
                `;
                listDiv.appendChild(div);
            });
        });

        document.getElementById('clear').onclick = () => {
            chrome.storage.local.set({ archived: [] }, () => location.reload());
        };

const currentListDiv = document.getElementById('current-list');
        chrome.storage.local.get({ current: [] }, (data) => {
            // Add header with "Select" column
            const headerDiv = document.createElement('div');
            headerDiv.style.fontWeight = 'bold';
            headerDiv.style.marginBottom = '8px';
            headerDiv.innerHTML = `
                <span style="display: inline-block; width: calc(100% - 30px); vertical-align: middle;">Current Tabs</span>
                <span style="display: inline-block; width: 30px; text-align: center;">Select</span>
            `;
            currentListDiv.appendChild(headerDiv);

            const selectedTabs = [];

            data.current.forEach(item => {
                const div = document.createElement('div');
                div.className = 'tab-item';
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';
                
                const contentDiv = document.createElement('div');
                contentDiv.style.flex = '1';
                contentDiv.innerHTML = `
                    <a href="${item.url}" target="_blank">${item.title}</a><br>
                    <span class="date">${item.date}</span>
                `;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.style.marginLeft = '10px';
                checkbox.dataset.url = item.url; // Store the tab URL
                checkbox.dataset.title = item.title;
                checkbox.dataset.date = item.date;
                
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedTabs.push({ url: item.url, title: item.title, date: item.date });
                    } else {
                        selectedTabs = selectedTabs.filter(tab => tab.url !== item.url);
                    }
                });
            });
        });

const archiveSelectedBtn = document.createElement('button').onclick = () => {
    if (selectedTabs.length === 0) return;
    chrome.storage.local.get({ archived: [], current: [] }, (data) => {
        const updated = data.archived.concat(selectedTabs);
        chrome.storage.local.set({ archived: updated }, () => {
            selectedTabs.forEach(tab => {
                chrome.tabs.query({ url: tab.url }, (tabs) => {
                    tabs.forEach(t => chrome.tabs.remove(t.id));
                });
            });
            selectedTabs = [];
            location.reload();
        });
    });
};