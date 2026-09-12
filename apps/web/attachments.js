document.addEventListener('DOMContentLoaded', async () => {
  const listContainer = document.getElementById('list-container');
  const createBtn = document.getElementById('create-btn');
  async function loadItems() {
    try {
      const res = await fetch('/api/attachments');
      if (res.redirected) { window.location.href = res.url; return; }
      const data = await res.json();
      if (!data.success) throw new Error('Failed to load');
      if (data.items.length === 0) {
        listContainer.innerHTML = '<p>No attachments found.</p>';
        return;
      }
      let html = '<ul class="item-list" style="list-style:none; padding:0;">';
      for (const item of data.items) {
        html += '<li class="card" style="margin-bottom:1rem; padding:1rem; border:1px solid #ddd; border-radius:8px;"><pre>' + JSON.stringify(item, null, 2) + '</pre></li>';
      }
      html += '</ul>';
      listContainer.innerHTML = html;
    } catch(err) {
      listContainer.innerHTML = '<p class="error">Error loading data.</p>';
    }
  }
  createBtn.addEventListener('click', async () => {
    const filename = prompt('Enter Filename:');
    const projectId = prompt('Enter Project ID:');
    if (!filename || !projectId) return;
    await fetch('/api/attachments', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename, mimeType: 'text/plain', description: 'Uploaded file', projectId })
    });
    loadItems();
  });
  loadItems();
});