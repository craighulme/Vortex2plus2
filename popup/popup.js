//Made by Inuk
let lightModeToggle = document.getElementById('lightMode')
let lightMode = localStorage.getItem('theme')
if (lightMode==='true') {
    lightMode=true;
    lightModeToggle.click();
    (async function () {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: tabId.id },
            func: () => {
                localStorage.setItem("theme", 'light');
                document.documentElement.setAttribute('theme', 'light');
            },
        });
    })();
}
lightModeToggle.onclick = async function () {
    lightMode = !lightMode
    localStorage.setItem("theme", lightMode);
    console.log('toggled')
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0];

    if (lightMode) {
        chrome.scripting.executeScript({
            target: { tabId: tabId.id },
            func: () => {
                localStorage.setItem("theme", 'light');
                document.documentElement.setAttribute('theme', 'light');
            },
        });
    } else {
        chrome.scripting.executeScript({
            target: { tabId: tabId.id },
            func: () => {
                localStorage.setItem("theme", 'dark');
                document.documentElement.removeAttribute('theme');
            },
        });
    }

}