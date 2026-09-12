document.addEventListener('DOMContentLoaded', async () => {
  const listContainer = document.getElementById('list-container');
  const createBtn = document.getElementById('create-btn');
  async function loadItems() {
    try {
      const res = await fetch('/api/projects');
      if (res.redirected) { window.location.href = res.url; return; }
      const data = await res.json();
      if (!data.success) throw new Error('Failed to load');
      if (data.items.length === 0) {
        listContainer.innerHTML = '<p>No projects found.</p>';
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
    const title = prompt('Enter Project Title:');
    const clientId = prompt('Enter Client ID:');
    if (!title || !clientId) return;
    await fetch('/api/projects', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title, description: 'New project', clientId })
    });
    loadItems();
  });
  loadItems();
});