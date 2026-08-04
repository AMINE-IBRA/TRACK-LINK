function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function fullUrl(path) {
  return `${window.location.origin}${path}`;
}

async function createLink() {
  const btn = document.getElementById('createBtn');
  const label = document.getElementById('label').value.trim();
  const btnText = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');

  btn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');

  try {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || undefined }),
    });

    if (!res.ok) {
      throw new Error('Failed to create link');
    }

    const data = await res.json();
    if (!data || !data.url) {
      throw new Error('Invalid server response');
    }

    const url = fullUrl(data.url);

    document.getElementById('generatedUrl').value = url;
    document.getElementById('viewDashboard').href = `/dashboard/${data.id}`;
    document.getElementById('resultBox').classList.remove('hidden');
    showToast('Link created!');
    loadLinks();
  } catch {
    showToast('Failed to create link');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
  }
}

async function loadLinks() {
  const container = document.getElementById('linksList');

  try {
    const res = await fetch('/api/links');
    const links = await res.json();

    if (links.length === 0) {
      container.innerHTML = '<p class="empty-state">No links yet. Create one above.</p>';
      return;
    }

    container.innerHTML = links.map((link) => `
      <a href="/dashboard/${link.id}" class="link-item">
        <div class="link-item-info">
          <h3>${escapeHtml(link.label)}</h3>
          <p>${new Date(link.createdAt).toLocaleString()} · ${link.visitCount} visit${link.visitCount !== 1 ? 's' : ''}</p>
        </div>
        <span class="link-item-badge">${link.visitCount}</span>
      </a>
    `).join('');
  } catch {
    container.innerHTML = '<p class="empty-state">Could not load links.</p>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('createBtn').addEventListener('click', createLink);

document.getElementById('copyBtn').addEventListener('click', async () => {
  const input = document.getElementById('generatedUrl');
  await navigator.clipboard.writeText(input.value);
  showToast('Link copied!');
});

document.getElementById('refreshBtn').addEventListener('click', loadLinks);

document.getElementById('label').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createLink();
});

loadLinks();
