document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('clickMe');
  button.addEventListener('click', async () => {
    // アクティブなタブを取得してスクリプトを実行するサンプル
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          document.body.style.backgroundColor = '#f0f0f0';
          alert('Background color changed by extension!');
        }
      });
    }
  });
});
