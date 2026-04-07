const API = '/api';

// ==================== State ====================
let currentUser = null;
let rules = [];
let logsPage = 1;
let currentEditRuleId = null;
let currentEditUserId = null;

// ==================== Utils ====================
function showToast(message, type = 'success') {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
  });
  Toast.fire({
    icon: type === 'success' ? 'success' : 'error',
    title: message,
  });
}

async function api(url, options = {}) {
  try {
    const res = await fetch(`${API}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'same-origin',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (error) {
    // Jangan throw untuk 401 saat checkAuth — biarkan caller handle
    if (error.message === 'Unauthorized') {
      // Hanya reload jika user sudah pernah login (session expired)
      if (currentUser) {
        currentUser = null;
        showLogin();
      }
    }
    throw error;
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID');
}

function truncate(str, len = 50) {
  return str && str.length > len ? str.substring(0, len) + '...' : str;
}

// ==================== Auth ====================
async function checkAuth() {
  try {
    const res = await api('/auth/me');
    currentUser = res.data;
    showDashboard();
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('dashboardPage').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboardPage').style.display = 'block';
  document.getElementById('userDisplay').textContent = currentUser?.displayName || '';

  // Hide users nav for non-admin
  if (currentUser?.role !== 'admin') {
    document.getElementById('navUsers').style.display = 'none';
  }

  loadDashboard();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    currentUser = res.data;
    showDashboard();
    Swal.fire({
      icon: 'success',
      title: 'Login Berhasil!',
      text: `Selamat datang, ${currentUser.displayName}`,
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Login Gagal',
      text: error.message,
    });
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  currentUser = null;
  showLogin();
  showToast('Logged out');
});

// ==================== Navigation ====================
document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
  });
});

function navigateTo(page) {
  // Stop session polling kalau pindah halaman
  if (page !== 'session') {
    stopSessionPolling();
  }

  document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    session: 'Session & QR',
    rules: 'Auto-Reply Rules',
    logs: 'Message Logs',
    'ai-settings': 'AI Settings',
    users: 'User Management',
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

  if (page === 'dashboard') loadDashboard();
  if (page === 'session') loadSession();
  if (page === 'rules') loadRules();
  if (page === 'logs') loadLogs();
  if (page === 'ai-settings') loadAISettings();
  if (page === 'users') loadUsers();
}

document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('show');
});

// ==================== Dashboard ====================
async function loadDashboard() {
  try {
    const stats = await api('/session/stats');
    const d = stats.data;

    const statusEl = document.getElementById('statConnection');
    statusEl.textContent = d.connectionStatus;
    statusEl.className = `fw-bold mt-1 ${d.connectionStatus === 'connected' ? 'text-success' : 'text-danger'}`;

    document.getElementById('statActiveRules').textContent = d.activeRules;
    document.getElementById('statTodayMsgs').textContent = d.todayMessages;
    document.getElementById('statTotalMsgs').textContent = d.totalMessages;

    document.getElementById('infoBotName').textContent = d.botNumber ? 'WA Bot' : '-';
    document.getElementById('infoBotNumber').textContent = d.botNumber || '-';

    const statusBadge = document.getElementById('infoStatus');
    statusBadge.textContent = d.connectionStatus;
    statusBadge.className = `status-badge status-${d.connectionStatus}`;

    document.getElementById('infoInMsg').textContent = d.incomingMessages;
    document.getElementById('infoOutMsg').textContent = d.outgoingMessages;
    document.getElementById('infoTotalRules').textContent = d.totalRules;
  } catch (error) {
    console.error(error);
  }
}

// ==================== Session ====================
let sessionPollInterval = null;
let lastQrCode = null;

async function loadSession() {
  try {
    const session = await api('/session');
    const d = session.data;

    const statusEl = document.getElementById('sessionStatus');
    statusEl.textContent = d.status;
    statusEl.className = `status-badge status-${d.status}`;

    document.getElementById('sessionBotNumber').textContent = d.botNumber || '-';
    document.getElementById('sessionBotName').textContent = d.botName || '-';

    // Render QR
    const qrContainer = document.getElementById('qrCodeContainer');
    if (d.qrCode) {
      // Hanya re-render kalau QR berubah (biar nggak flicker)
      if (d.qrCode !== lastQrCode) {
        lastQrCode = d.qrCode;
        qrContainer.innerHTML = '<div id="qrCodeImage"></div>';
        try {
          new QRCode(document.getElementById('qrCodeImage'), {
            text: d.qrCode,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.L,
          });
        } catch (e) {
          qrContainer.innerHTML = `<p class="text-danger"><i class="bi bi-exclamation-triangle"></i> Gagal render QR: ${e.message}</p>`;
        }
      }

      // Start polling kalau masih ada QR (belum di-scan)
      startSessionPolling();
    } else if (d.status === 'connected') {
      lastQrCode = null;
      qrContainer.innerHTML = '<p class="text-success"><i class="bi bi-check-circle"></i> Bot sudah terhubung. Tidak perlu QR.</p>';
      stopSessionPolling();
    } else {
      lastQrCode = null;
      qrContainer.innerHTML = '<p class="text-muted">Menunggu QR code...</p>';
      startSessionPolling();
    }
  } catch (error) {
    console.error(error);
  }
}

function startSessionPolling() {
  stopSessionPolling();
  sessionPollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/session', { credentials: 'same-origin' });
      const data = await res.json();
      const d = data.data;

      // Update status badge
      const statusEl = document.getElementById('sessionStatus');
      statusEl.textContent = d.status;
      statusEl.className = `status-badge status-${d.status}`;

      document.getElementById('sessionBotNumber').textContent = d.botNumber || '-';

      // Update QR kalau berubah
      const qrContainer = document.getElementById('qrCodeContainer');
      if (d.qrCode && d.qrCode !== lastQrCode) {
        lastQrCode = d.qrCode;
        qrContainer.innerHTML = '<div id="qrCodeImage"></div>';
        try {
          new QRCode(document.getElementById('qrCodeImage'), {
            text: d.qrCode,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.L,
          });
        } catch (e) {
          qrContainer.innerHTML = `<p class="text-danger"><i class="bi bi-exclamation-triangle"></i> Gagal render QR</p>`;
        }
      }

      // Kalau status berubah jadi connected, refresh full
      if (d.status === 'connected' && !d.qrCode) {
        stopSessionPolling();
        loadSession();
        showToast('✅ WhatsApp berhasil terhubung!');
      }
    } catch (e) {}
  }, 2000);
}

function stopSessionPolling() {
  if (sessionPollInterval) {
    clearInterval(sessionPollInterval);
    sessionPollInterval = null;
  }
}

document.getElementById('reconnectBtn')?.addEventListener('click', async () => {
  const result = await Swal.fire({
    title: 'Reset Session?',
    text: 'Ini akan memutus koneksi WhatsApp dan generate QR baru.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Ya, Reset!',
    cancelButtonText: 'Batal',
  });

  if (!result.isConfirmed) return;

  try {
    await api('/session/reconnect', { method: 'POST' });
    showToast('Restarting WhatsApp connection...');

    // Polling session status sampai QR muncul
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/session', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.data?.qrCode || data.data?.status === 'disconnected') {
          clearInterval(pollInterval);
          loadSession();
        }
      } catch (e) {}

      if (attempts > 20) clearInterval(pollInterval); // Stop after 10s
    }, 500);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ==================== Rules ====================
async function loadRules() {
  try {
    const res = await api('/rules');
    rules = res.data;
    renderRules();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderRules() {
  const tbody = document.getElementById('rulesBody');
  if (rules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Belum ada rule</td></tr>';
    return;
  }

  tbody.innerHTML = rules.map(rule => {
    const imageBadge = rule.image_url ? '<span class="badge bg-info me-1">🖼️ Image</span>' : '';
    return `
    <tr>
      <td><span class="badge bg-${rule.type === 'keyword' ? 'primary' : 'warning'}">${rule.type}</span></td>
      <td><code>${truncate(rule.pattern, 30)}</code></td>
      <td>${truncate(rule.reply_text, 40)} ${imageBadge}</td>
      <td>
        <span class="badge bg-${rule.is_active ? 'success' : 'secondary'}">
          ${rule.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editRule(${rule.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-${rule.is_active ? 'secondary' : 'success'} me-1" onclick="toggleRule(${rule.id})">
          <i class="bi bi-${rule.is_active ? 'pause' : 'play'}"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteRule(${rule.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function editRule(id) {
  const rule = rules.find(r => r.id === id);
  if (!rule) return;

  currentEditRuleId = id;
  document.getElementById('ruleModalTitle').textContent = 'Edit Rule';
  document.getElementById('ruleId').value = id;
  document.getElementById('ruleType').value = rule.type;
  document.getElementById('rulePattern').value = rule.pattern;
  document.getElementById('ruleReply').value = rule.reply_text;
  document.getElementById('ruleImageUrl').value = rule.image_url || '';
  updatePatternHelp(rule.type);

  new bootstrap.Modal(document.getElementById('ruleModal')).show();
}

async function toggleRule(id) {
  try {
    await api(`/rules/${id}/toggle`, { method: 'PATCH' });
    showToast('Rule toggled');
    loadRules();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteRule(id) {
  const result = await Swal.fire({
    title: 'Hapus Rule?',
    text: 'Rule ini akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal',
  });

  if (!result.isConfirmed) return;
  try {
    await api(`/rules/${id}`, { method: 'DELETE' });
    showToast('Rule dihapus');
    loadRules();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('addRuleBtn')?.addEventListener('click', () => {
  currentEditRuleId = null;
  document.getElementById('ruleModalTitle').textContent = 'Add Rule';
  document.getElementById('ruleForm').reset();
  document.getElementById('ruleId').value = '';
  updatePatternHelp('keyword');
});

document.getElementById('ruleType')?.addEventListener('change', (e) => {
  updatePatternHelp(e.target.value);
});

function updatePatternHelp(type) {
  document.getElementById('rulePatternHelp').textContent =
    type === 'regex' ? 'Pattern regex JavaScript. e.g. ^halo|hi|hey' : 'Exact keyword yang harus match';
}

document.getElementById('saveRuleBtn')?.addEventListener('click', async () => {
  const type = document.getElementById('ruleType').value;
  const pattern = document.getElementById('rulePattern').value;
  const reply_text = document.getElementById('ruleReply').value;
  const image_url = document.getElementById('ruleImageUrl').value;

  if (!pattern || !reply_text) {
    showToast('Pattern dan Reply Text wajib diisi', 'error');
    return;
  }

  try {
    const body = { type, pattern, reply_text };
    if (image_url) body.image_url = image_url;

    if (currentEditRuleId) {
      await api(`/rules/${currentEditRuleId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showToast('Rule diupdate');
    } else {
      await api('/rules', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('Rule dibuat');
    }
    bootstrap.Modal.getInstance(document.getElementById('ruleModal')).hide();
    loadRules();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ==================== Logs ====================
async function loadLogs(page = 1) {
  logsPage = page;
  const direction = document.getElementById('logDirection').value;

  let params = `page=${page}&limit=50`;
  if (direction) params += `&direction=${direction}`;

  try {
    const res = await api(`/logs?${params}`);
    renderLogs(res.data, res.pagination);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderLogs(data, pagination) {
  const tbody = document.getElementById('logsBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Belum ada log</td></tr>';
    document.getElementById('logsPagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = data.map(log => {
    // Source badge
    let sourceBadge = '';
    if (log.reply_source === 'rule') {
      sourceBadge = '<span class="badge bg-primary">📋 Rule</span>';
    } else if (log.reply_source === 'ai') {
      sourceBadge = '<span class="badge bg-success">🤖 AI</span>';
    } else if (log.reply_source === 'fallback') {
      sourceBadge = '<span class="badge bg-warning text-dark">⚠️ Fallback</span>';
    } else if (log.reply_source === 'off_topic') {
      sourceBadge = '<span class="badge bg-danger">🚫 Off-topic</span>';
    } else if (log.direction === 'in') {
      sourceBadge = '<span class="badge bg-secondary">—</span>';
    }

    return `
    <tr>
      <td>${formatDate(log.created_at)}</td>
      <td><span class="badge bg-${log.direction === 'in' ? 'info' : 'success'}">${log.direction === 'in' ? '📥 In' : '📤 Out'}</span></td>
      <td>${log.from_number}</td>
      <td>${log.to_number}</td>
      <td>${truncate(log.message_body, 60)}</td>
      <td>${sourceBadge}</td>
    </tr>`;
  }).join('');

  // Pagination
  const pagEl = document.getElementById('logsPagination');
  let html = '';
  for (let i = 1; i <= pagination.totalPages; i++) {
    html += `<li class="page-item ${i === pagination.page ? 'active' : ''}">
      <a class="page-link" href="#" onclick="loadLogs(${i}); return false;">${i}</a>
    </li>`;
  }
  pagEl.innerHTML = html;
}

document.getElementById('refreshLogs')?.addEventListener('click', () => loadLogs(logsPage));
document.getElementById('logDirection')?.addEventListener('change', () => loadLogs(1));

// Flush logs
async function flushLogs(days = null) {
  const confirmText = days
    ? `Hapus semua log lebih lama dari ${days} hari?`
    : 'Hapus SEMUA log? Tindakan ini tidak bisa dibatalkan.';

  const result = await Swal.fire({
    title: days ? `Hapus Log > ${days} Hari?` : 'Hapus Semua Log?',
    text: confirmText,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal',
  });

  if (!result.isConfirmed) return;

  try {
    const url = days ? `/logs?days=${days}` : '/logs';
    const res = await api(url, { method: 'DELETE' });
    showToast(res.message);
    loadLogs(1);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('flushAllBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  flushLogs();
});

document.getElementById('flush7dBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  flushLogs(7);
});

document.getElementById('flush30dBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  flushLogs(30);
});

// ==================== AI Settings ====================
async function loadAISettings() {
  try {
    const res = await api('/ai-settings');
    const s = res.data;

    document.getElementById('aiEnabled').checked = s.is_enabled === 1;
    document.getElementById('groqApiKey').value = s.groq_api_key || '';
    document.getElementById('groqModel').value = s.groq_model || 'llama-3.3-70b-versatile';
    document.getElementById('systemPrompt').value = s.system_prompt || '';
    document.getElementById('allowedTopics').value = s.allowed_topics || '';
    document.getElementById('blockedKeywords').value = s.blocked_keywords || '';
    document.getElementById('offTopicReply').value = s.off_topic_reply || '';
    document.getElementById('fallbackReply').value = s.fallback_reply || '';
    document.getElementById('maxHistory').value = s.max_history || 20;
    document.getElementById('rateLimitSeconds').value = s.rate_limit_seconds || 5;
    document.getElementById('replyDelayMin').value = s.reply_delay_min_ms || 1000;
    document.getElementById('replyDelayMax').value = s.reply_delay_max_ms || 3000;
    document.getElementById('autoCreateRules').checked = s.auto_create_rules === 1;
    document.getElementById('autoRuleThreshold').value = s.auto_rule_threshold || 2;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('aiSettingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    is_enabled: document.getElementById('aiEnabled').checked ? 1 : 0,
    groq_model: document.getElementById('groqModel').value,
    system_prompt: document.getElementById('systemPrompt').value,
    allowed_topics: document.getElementById('allowedTopics').value,
    blocked_keywords: document.getElementById('blockedKeywords').value,
    off_topic_reply: document.getElementById('offTopicReply').value,
    fallback_reply: document.getElementById('fallbackReply').value,
    max_history: parseInt(document.getElementById('maxHistory').value),
    rate_limit_seconds: parseInt(document.getElementById('rateLimitSeconds').value),
    reply_delay_min_ms: parseInt(document.getElementById('replyDelayMin').value),
    reply_delay_max_ms: parseInt(document.getElementById('replyDelayMax').value),
    auto_create_rules: document.getElementById('autoCreateRules').checked ? 1 : 0,
    auto_rule_threshold: parseInt(document.getElementById('autoRuleThreshold').value),
  };

  // Hanya kirim API key kalau user isi (bukan kosong)
  const newApiKey = document.getElementById('groqApiKey').value;
  if (newApiKey) {
    body.groq_api_key = newApiKey;
  }

  try {
    await api('/ai-settings', { method: 'PUT', body: JSON.stringify(body) });
    showToast('AI settings berhasil disimpan');
    // Refresh cache
    await fetch('/api/ai-settings', { credentials: 'same-origin' });
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('resetAISettingsBtn')?.addEventListener('click', async () => {
  const result = await Swal.fire({
    title: 'Reset AI Settings?',
    text: 'Semua pengaturan AI akan dikembalikan ke default.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Ya, Reset!',
    cancelButtonText: 'Batal',
  });

  if (!result.isConfirmed) return;

  try {
    await api('/ai-settings/reset', { method: 'POST' });
    showToast('AI settings berhasil direset');
    loadAISettings();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ==================== Users ====================
async function loadUsers() {
  if (currentUser?.role !== 'admin') return;
  try {
    const res = await api('/auth/users');
    renderUsers(res.data);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = users.map(user => `
    <tr>
      <td><code>${user.username}</code></td>
      <td>${user.display_name}</td>
      <td><span class="badge bg-${user.role === 'admin' ? 'danger' : 'info'}">${user.role}</span></td>
      <td><span class="badge bg-${user.is_active ? 'success' : 'secondary'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editUser(${user.id}, '${user.username}', '${user.display_name}', '${user.role}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function editUser(id, username, displayName, role) {
  currentEditUserId = id;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userId').value = id;
  document.getElementById('userUsername').value = username;
  document.getElementById('userDisplayName').value = displayName;
  document.getElementById('userRole').value = role;
  document.getElementById('userPassword').value = '';
  new bootstrap.Modal(document.getElementById('userModal')).show();
}

async function deleteUser(id) {
  const result = await Swal.fire({
    title: 'Hapus User?',
    text: 'User ini akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal',
  });

  if (!result.isConfirmed) return;
  try {
    await api(`/auth/users/${id}`, { method: 'DELETE' });
    showToast('User dihapus');
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

document.getElementById('addUserBtn')?.addEventListener('click', () => {
  currentEditUserId = null;
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
});

document.getElementById('saveUserBtn')?.addEventListener('click', async () => {
  const username = document.getElementById('userUsername').value;
  const display_name = document.getElementById('userDisplayName').value;
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRole').value;

  if (!username || !display_name) {
    showToast('Username dan Display Name wajib diisi', 'error');
    return;
  }

  try {
    if (currentEditUserId) {
      const body = { display_name, role };
      if (password) body.password = password;
      await api(`/auth/users/${currentEditUserId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showToast('User diupdate');
    } else {
      if (!password) {
        showToast('Password wajib untuk user baru', 'error');
        return;
      }
      await api('/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, display_name, role }),
      });
      showToast('User dibuat');
    }
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    loadUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ==================== Init ====================
checkAuth();

// Auto refresh stats every 30s
setInterval(() => {
  if (document.getElementById('page-dashboard').classList.contains('active')) {
    loadDashboard();
  }
}, 30000);
