// ── Dashboard View ──

function renderDashboard() {
  if (!currentUser) return;
  const name = currentUser.name.split(' ')[0];
  document.getElementById('dashboard-greeting').textContent = getGreeting() + ', ' + name;

  const mySpaces = getMySpaces();

  const active = mySpaces.filter(s => s.status === 'ACTIVE').length;
  const expiring = mySpaces.filter(s => s.status === 'WARNING').length;
  const archived = mySpaces.filter(s => s.status === 'ARCHIVED').length;

  // Real storage usage: sum of the actual sizes of uploaded files
  const usedBytes = spacesBytes(mySpaces.filter(s => s.status !== 'ARCHIVED'));
  const pct = Math.min(100, (usedBytes / STORAGE_QUOTA_BYTES) * 100).toFixed(0);

  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-expiring').textContent = expiring;
  document.getElementById('stat-archives').textContent = db.archives.length + ' ZIPs';
  document.getElementById('storage-pct').textContent = pct + '%';
  document.getElementById('storage-bar').style.width = pct + '%';
  document.getElementById('storage-used').textContent = formatBytes(usedBytes);

  document.getElementById('filter-count-all').textContent = active + expiring;
  document.getElementById('filter-count-active').textContent = active;
  document.getElementById('filter-count-warning').textContent = expiring;
  document.getElementById('filter-count-archived').textContent = archived;

  updateNotifBadge();
  renderExpiryBanner(mySpaces);
  renderSpacesGrid(mySpaces);
  renderVault();
  renderLandingTelemetry();
}

// Amber “expiring soon” banner for the Spaces the user can see
function renderExpiryBanner(spaces) {
  const bar = document.getElementById('notifications-bar');
  const warnings = spaces.filter(s => s.status === 'WARNING');
  if (warnings.length === 0) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  bar.classList.remove('hidden');
  bar.innerHTML = warnings.map(s =>
    `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2 flex items-center justify-between">
      <span class="text-[13px] text-amber-700"><strong>${s.name}</strong> is expiring soon!</span>
      <button onclick="openSpace('${s.id}')" class="text-[12px] font-medium text-amber-700 underline">View</button>
    </div>`
  ).join('');
}

// Landing hero telemetry - driven by real application state
function renderLandingTelemetry() {
  const active = db.spaces.filter(s => s.status === 'ACTIVE' || s.status === 'WARNING').length;
  const used = spacesBytes(db.spaces.filter(s => s.status === 'ACTIVE' || s.status === 'WARNING'));
  const pct = Math.min(100, (used / STORAGE_QUOTA_BYTES) * 100);
  const cluster = document.getElementById('landing-cluster');
  if (!cluster) return;
  cluster.textContent = active + ' active space' + (active === 1 ? '' : 's');
  document.getElementById('landing-archives').textContent = db.archives.length + ' archive' + (db.archives.length === 1 ? '' : 's');
  document.getElementById('landing-bar').style.width = pct.toFixed(pct > 0 && pct < 1 ? 1 : 0) + '%';
  document.getElementById('landing-storage').textContent = formatBytes(used) + ' of ' + formatBytes(STORAGE_QUOTA_BYTES) + ' allocated';
}

function openSpace(spaceId) {
  currentSpaceId = spaceId;
  navigateTo('space');
}

// ── Space action menu (three-dot) shared by dashboard + My Spaces cards ──
function spaceMenuButton(space) {
  return `<button onclick="toggleSpaceMenu(event, '${space.id}')" title="More actions" class="w-6 h-6 rounded-md text-muted hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-[16px]">more_vert</span></button>`;
}

function spaceMenu(space) {
  const archived = space.status === 'ARCHIVED';
  return `<div id="space-menu-${space.id}" class="hidden absolute right-4 top-14 w-44 bg-card border border-border rounded-lg shadow-lg py-1 z-30">
    <button onclick="event.stopPropagation();closeAllSpaceMenus();openSpace('${space.id}')" class="w-full text-left px-3 py-2 text-[12px] font-medium text-primary hover:bg-slate-50 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">open_in_new</span>Open Space</button>
    ${archived
      ? `<button onclick="event.stopPropagation();closeAllSpaceMenus();restoreSpace('${space.id}')" class="w-full text-left px-3 py-2 text-[12px] font-medium text-primary hover:bg-slate-50 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">unarchive</span>Restore Space</button>`
      : `<button onclick="event.stopPropagation();closeAllSpaceMenus();confirmArchiveSpace('${space.id}')" class="w-full text-left px-3 py-2 text-[12px] font-medium text-primary hover:bg-slate-50 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">inventory_2</span>Archive Space</button>`}
    <div class="h-px bg-border my-1"></div>
    <button onclick="event.stopPropagation();closeAllSpaceMenus();confirmDeleteSpace('${space.id}')" class="w-full text-left px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">delete</span>Delete Space</button>
  </div>`;
}

function toggleSpaceMenu(event, spaceId) {
  event.stopPropagation();
  const menu = document.getElementById('space-menu-' + spaceId);
  const wasOpen = menu && !menu.classList.contains('hidden');
  closeAllSpaceMenus();
  if (menu && !wasOpen) menu.classList.remove('hidden');
}

function closeAllSpaceMenus() {
  document.querySelectorAll('[id^="space-menu-"]').forEach(m => m.classList.add('hidden'));
}

document.addEventListener('click', closeAllSpaceMenus);

function filterSpaces(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => {
    if (b.dataset.filter === filter) {
      b.classList.add('bg-white', 'text-primary', 'font-semibold', 'shadow-xs');
    } else {
      b.classList.remove('bg-white', 'text-primary', 'font-semibold', 'shadow-xs');
    }
  });
  renderDashboard();
}

function renderSpacesGrid(spaces) {
  // Archived workspaces never show in the active list - they live in My Spaces > Archived
  const filtered = currentFilter === 'all'
    ? spaces.filter(s => s.status !== 'ARCHIVED')
    : spaces.filter(s => s.status === currentFilter);
  const grid = document.getElementById('spaces-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-muted">
      <span class="material-symbols-outlined text-[48px] text-slate-300 mb-3 block">folder_open</span>
      <p class="font-medium text-[14px]">No spaces ${currentFilter !== 'all' ? 'with status ' + currentFilter : ''}</p>
      <button onclick="navigateTo('create-space')" class="mt-3 text-[13px] text-brand hover:underline">Create your first Space</button>
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(s => {
    const total = (s.expiryAt - s.startAt) || 1;
    const elapsed = Math.min(1, Math.max(0, (Date.now() - s.startAt) / total));
    const elapsedPct = (elapsed * 100).toFixed(0);
    const remaining = s.expiryAt - Date.now();
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const fileCount = (db.files[s.id] || []).length;
    const storage = formatBytes(spaceBytes(s.id));
    const members = db.members[s.id] || [];
    const memberCount = members.length;

    const statusBadge = {
      ACTIVE: remaining > 48*3600000 ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-amber-50 text-amber-700 border border-amber-200',
      WARNING: 'bg-amber-50 text-amber-700 border border-amber-200',
      ARCHIVING: 'bg-blue-50 text-blue-700 border border-blue-200',
      ARCHIVED: 'bg-purple-50 text-purple-700 border border-purple-200',
      DELETED: 'bg-red-50 text-red-700 border border-red-200',
    };
    const progressColor = elapsed > 0.8 ? 'bg-red-500' : elapsed > 0.5 ? 'bg-amber-500' : 'bg-brand';
    const expiryLabel = remaining > 0 ? `Expires in ${days}d ${hours}h` : 'Expired';
    const autoDate = new Date(s.expiryAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `<div class="relative p-5 rounded-xl bg-card border border-border shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-display text-[15px] font-semibold text-primary tracking-tight hover:text-brand transition-colors cursor-pointer" onclick="openSpace('${s.id}')">${s.name}</h3>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="px-2 py-0.5 rounded text-[11px] font-medium ${statusBadge[s.status] || statusBadge.ACTIVE}">${expiryLabel}</span>
            ${spaceMenuButton(s)}
          </div>
        </div>
        <p class="text-[13px] text-muted line-clamp-2 leading-relaxed">${s.purpose || s.description || 'No description'}</p>
        <div class="space-y-1.5 pt-1">
          <div class="flex justify-between text-[11px] text-muted">
            <span>Auto-archive ${autoDate}</span>
            <span class="font-mono ${elapsed > 0.8 ? 'text-red-500' : elapsed > 0.5 ? 'text-amber-600' : 'text-muted'} font-medium">${elapsedPct}% elapsed</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div class="h-full ${progressColor} rounded-full" style="width: ${Math.min(100, elapsedPct)}%"></div>
          </div>
        </div>
      </div>
      <div class="pt-3 border-t border-border flex items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <div class="flex -space-x-2">
            ${members.slice(0, 3).map((m, i) => `<div class="w-6 h-6 rounded-full bg-brand/${10 + i*20} text-brand text-[10px] font-semibold flex items-center justify-center border border-white">${m.name.charAt(0)}</div>`).join('')}
            ${memberCount > 3 ? `<div class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center justify-center border border-white">+${memberCount - 3}</div>` : ''}
          </div>
          <span class="text-[12px] text-muted">${memberCount} members</span>
          <span class="text-slate-300">•</span>
          <span class="font-mono text-[11px] text-muted">${fileCount} files</span>
          <span class="text-slate-300">•</span>
          <span class="font-mono text-[11px] text-muted">${storage}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openSpace('${s.id}')" class="px-3 py-1.5 rounded-lg bg-brand text-white text-[12px] font-medium hover:bg-brand-700 transition shadow-xs">Open Space</button>
        </div>
      </div>
      ${spaceMenu(s)}
    </div>`;
  }).join('');
}

// ── Vault (dashboard section) ──

function renderVault() {
  const vaultList = document.getElementById('vault-list');
  const vaultEmpty = document.getElementById('vault-empty');
  if (db.archives.length === 0) {
    vaultList.classList.add('hidden');
    vaultEmpty.classList.remove('hidden');
    return;
  }
  vaultList.classList.remove('hidden');
  vaultEmpty.classList.add('hidden');
  vaultList.innerHTML = db.archives.map(a => `
    <div class="p-4 rounded-xl bg-card border border-border shadow-xs flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg zip-icon flex items-center justify-center text-white">
          <span class="material-symbols-outlined text-[18px]">folder_zip</span>
        </div>
        <div>
          <p class="text-[13px] font-semibold text-primary">${a.name}.zip</p>
          <p class="text-[11px] text-muted">${a.files} files • ${a.size}</p>
        </div>
      </div>
      <button onclick="downloadZip('${a.id}')" class="px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium text-primary hover:bg-slate-50 transition">Download</button>
    </div>
  `).join('');
}

// ── Vault View ──

function renderVaultView() {
  const now = new Date();
  const thisMonth = db.archives.filter(a => {
    const d = new Date(a.archivedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  document.getElementById('vault-stat-total').textContent = db.archives.length;
  document.getElementById('vault-stat-storage').textContent = formatBytes(archiveBytes());
  document.getElementById('vault-stat-monthly').textContent = thisMonth;
  const tbody = document.getElementById('vault-table');
  if (db.archives.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-muted italic">No archives yet. A ZIP snapshot is stored whenever a Space expires or is deleted.</td></tr>';
    return;
  }
  tbody.innerHTML = db.archives.map(a => {
    const date = new Date(a.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const reason = a.reason === 'MANUAL_DELETE' ? 'Deleted by owner' : 'Expired automatically';
    return `<tr class="hover:bg-slate-50">
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-brand text-[18px]">folder_zip</span>
          <div>
            <span class="font-medium text-primary">${a.name}.zip</span><br>
            <span class="text-[11px] text-muted font-mono">${reason}</span>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-muted">${a.purpose || 'No description'}</td>
      <td class="px-6 py-4 text-muted">${date}</td>
      <td class="px-6 py-4"><span class="font-medium text-primary">${a.files} files</span><br><span class="text-[11px] text-muted">${a.size}</span></td>
      <td class="px-6 py-4 text-right">
        <button onclick="downloadZip('${a.id}')" class="px-3 py-1.5 rounded-lg bg-brand text-white text-[12px] font-medium hover:bg-brand-700 transition">Download</button>
      </td>
    </tr>`;
  }).join('');
}

function exportVaultIndex() {
  if (db.archives.length === 0) { showToast('There are no archives to export'); return; }
  const rows = [['Archive', 'Source Space', 'Archived At', 'Files', 'Size']]
    .concat(db.archives.map(a => [
      a.name + '.zip',
      a.purpose || '',
      new Date(a.archivedAt).toISOString(),
      a.files,
      a.size
    ]));
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'flashspace-vault-index.csv';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Vault index exported');
}

// ── Space Detail ──

function renderSpaceDetail() {
  const space = db.spaces.find(s => s.id === currentSpaceId);
  if (!space) { navigateTo('dashboard'); return; }

  document.getElementById('breadcrumb-space').textContent = space.name;
  document.getElementById('space-title').textContent = space.name;
  document.getElementById('space-purpose-text').textContent = space.purpose || space.description || '';

  const statusColors = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    WARNING: 'bg-amber-50 text-amber-700 border border-amber-200',
    ARCHIVING: 'bg-blue-50 text-blue-700 border border-blue-200',
    ARCHIVED: 'bg-purple-50 text-purple-700 border border-purple-200',
    DELETED: 'bg-red-50 text-red-700 border border-red-200',
  };
  const badge = document.getElementById('space-status-badge');
  badge.textContent = space.status;
  badge.className = 'px-2 py-0.5 rounded text-[11px] font-medium ' + (statusColors[space.status] || '');

  // Start / End come from the lifespan the user selected when creating the Space
  document.getElementById('space-start-date').textContent = formatDateTime(space.startAt);
  document.getElementById('space-expiry-date').textContent = formatDateTime(space.expiryAt);

  const fileCount = (db.files[space.id] || []).length;
  const bytes = spaceBytes(space.id);
  const storagePct = Math.min(100, (bytes / SPACE_QUOTA_BYTES) * 100);
  document.getElementById('space-storage-bar').style.width = storagePct + '%';
  document.getElementById('space-storage-text').textContent = formatBytes(bytes) + ' / ' + formatBytes(SPACE_QUOTA_BYTES);

  const members = db.members[space.id] || [];
  document.getElementById('space-members-count').textContent = members.length + ' members active';

  const isOwner = space.ownerId === currentUser?.id;
  document.getElementById('space-access-level').textContent = isOwner ? 'Owner (Admin)' : 'Member';

  const isArchived = space.status === 'ARCHIVED';
  toggleEl('space-delete-btn', isOwner);
  toggleEl('space-archive-btn', isOwner && !isArchived);
  toggleEl('space-restore-btn', isOwner && isArchived);

  document.getElementById('files-count-badge').textContent = fileCount;

  // Overview tab
  document.getElementById('overview-files').textContent = fileCount;
  document.getElementById('overview-members').textContent = members.length;
  const remaining = space.expiryAt - Date.now();
  const rDays = Math.floor(remaining / 86400000);
  const rHours = Math.floor((remaining % 86400000) / 3600000);
  document.getElementById('overview-time').textContent = remaining > 0 ? rDays + 'd ' + rHours + 'h' : 'Expired';

  // Warning
  const warning = document.getElementById('expiry-warning');
  if (space.status === 'WARNING') {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }

  // Countdown
  updateCountdown(space);

  // Render current tab
  switchSpaceTab(currentSpaceTab);
}

function toggleEl(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !show);
}

function updateCountdown(space) {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  const el = document.getElementById('space-countdown');
  if (!el) return;
  if (space.status === 'ARCHIVED') {
    el.textContent = 'Archived';
    el.className = 'font-mono text-[13px] font-medium text-purple-600';
    return;
  }
  function tick() {
    const remaining = space.expiryAt - Date.now();
    if (remaining <= 0) {
      el.textContent = 'Expired';
      el.className = 'font-mono text-[13px] font-medium text-red-600';
      return;
    }
    const d = Math.floor(remaining / 86400000);
    const h = Math.floor((remaining % 86400000) / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${d}d ${h}h ${m}m ${s}s`;
    el.className = remaining < 3600000
      ? 'font-mono text-[13px] font-medium text-red-600 countdown-urgent'
      : remaining < 86400000
        ? 'font-mono text-[13px] font-medium text-amber-600'
        : 'font-mono text-[13px] font-medium text-muted';
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function switchSpaceTab(tab) {
  currentSpaceTab = tab;
  document.querySelectorAll('.space-tab').forEach(t => {
    if (t.dataset.stab === tab) {
      t.classList.add('text-brand', 'border-b-2', 'border-brand');
      t.classList.remove('text-muted');
    } else {
      t.classList.remove('text-brand', 'border-b-2', 'border-brand');
      t.classList.add('text-muted');
    }
  });
  document.querySelectorAll('.space-nav-link').forEach(l => {
    if (l.dataset.stab === tab) {
      l.classList.add('bg-surface-container', 'text-brand', 'font-semibold', 'rounded-lg');
    } else {
      l.classList.remove('bg-surface-container', 'text-brand', 'font-semibold', 'rounded-lg');
    }
  });
  ['overview', 'files', 'members', 'activity', 'settings'].forEach(t => {
    const el = document.getElementById('space-tab-' + t);
    if (el) {
      if (t === tab) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });
  if (tab === 'files') renderFiles();
  if (tab === 'members') renderMembers();
  if (tab === 'activity') renderActivity();
}

function renderFiles() {
  const files = db.files[currentSpaceId] || [];
  const list = document.getElementById('files-list');
  const empty = document.getElementById('files-empty');
  if (files.length === 0) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  list.classList.remove('hidden');
  empty.classList.add('hidden');
  list.innerHTML = files.map(f => {
    const size = formatSize(f.size);
    return `<div class="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-slate-300 transition">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-brand text-[18px]">description</span>
        <div>
          <p class="text-[13px] font-medium text-primary">${f.name}</p>
          <p class="text-[11px] text-muted">${size} • Uploaded by ${f.uploadedBy}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="p-1.5 rounded hover:bg-slate-100 text-muted hover:text-primary transition">
          <span class="material-symbols-outlined text-[16px]">download</span>
        </button>
        <button class="p-1.5 rounded hover:bg-slate-100 text-muted hover:text-red-500 transition">
          <span class="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderMembers() {
  const space = db.spaces.find(s => s.id === currentSpaceId);
  const isOwner = space && space.ownerId === currentUser?.id;
  const members = db.members[currentSpaceId] || [];

  // Current members table
  document.getElementById('members-count-label').textContent = members.length + ' member' + (members.length !== 1 ? 's' : '');
  const tbody = document.getElementById('members-table');
  tbody.innerHTML = members.map(m => {
    const joinedDate = m.joinedAt ? formatDateTime(m.joinedAt) : (m.status === 'INVITED' ? 'Pending' : 'Since creation');
    return `<tr>
      <td class="px-6 py-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-brand/10 text-brand text-[11px] font-bold flex items-center justify-center">${m.name.charAt(0)}</div>
          <div>
            <p class="font-medium text-primary">${m.name}</p>
            <p class="text-[11px] text-muted">${m.email}</p>
          </div>
        </div>
      </td>
      <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-medium ${m.role === 'OWNER' ? 'bg-brand-50 text-brand' : 'bg-slate-100 text-primary'}">${m.role}</span></td>
      <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-medium ${m.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : m.status === 'INVITED' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}">${m.status}</span></td>
      <td class="px-6 py-3 text-muted text-[12px]">${joinedDate}</td>
    </tr>`;
  }).join('');

  // Invite section (only for owners)
  document.getElementById('invite-section').classList.toggle('hidden', !isOwner);

  // Pending join requests (only for owners)
  const pending = db.inviteRequests.filter(r => r.spaceId === currentSpaceId && r.status === 'PENDING');
  const pendingSection = document.getElementById('pending-requests-section');
  pendingSection.classList.toggle('hidden', !isOwner || pending.length === 0);
  const pendingTbody = document.getElementById('pending-requests-table');
  pendingTbody.innerHTML = pending.map(r => `<tr>
    <td class="px-6 py-3">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">${r.userName.charAt(0)}</div>
        <div>
          <p class="font-medium text-primary">${r.userName}</p>
          <p class="text-[11px] text-muted">${r.userEmail}</p>
        </div>
      </div>
    </td>
    <td class="px-6 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-medium ${r.type === 'LINK' ? 'bg-blue-50 text-blue-700' : 'bg-brand-50 text-brand'}">${r.type === 'LINK' ? 'Link Request' : 'Email Invite'}</span></td>
    <td class="px-6 py-3 text-muted text-[12px]">${timeAgo(new Date(r.requestedAt).getTime())}</td>
    <td class="px-6 py-3 text-right">
      <div class="inline-flex gap-2">
        <button onclick="acceptJoinRequest('${r.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-medium hover:bg-emerald-100 transition">Accept</button>
        <button onclick="declineJoinRequest('${r.id}')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[12px] font-medium hover:bg-red-100 transition">Decline</button>
      </div>
    </td>
  </tr>`).join('');
}

// ── Invite via Link ──

let currentInviteLink = '';

function generateInviteLink() {
  const space = db.spaces.find(s => s.id === currentSpaceId);
  if (!space) return;
  const token = btoa(space.id + '_' + Date.now()).replace(/=/g, '').substring(0, 24);
  currentInviteLink = window.location.origin + window.location.pathname + '#join=' + token;
  document.getElementById('invite-link-input').value = currentInviteLink;
  document.getElementById('copy-link-btn').classList.remove('hidden');
  showToast('Invite link generated! Share it with collaborators.');
}

function copyInviteLink() {
  const input = document.getElementById('invite-link-input');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Invite link copied to clipboard!');
  }).catch(() => {
    document.execCommand('copy');
    showToast('Invite link copied!');
  });
}

// ── Invite via Email ──

function inviteByEmail() {
  const emailInput = document.getElementById('email-invite-input');
  const roleSelect = document.getElementById('email-invite-role');
  const email = emailInput.value.trim();
  const role = roleSelect.value;
  if (!email) { showToast('Please enter an email address'); return; }
  if (!email.includes('@')) { showToast('Please enter a valid email address'); return; }

  const space = db.spaces.find(s => s.id === currentSpaceId);
  if (!space) return;

  // Check if already a member
  const existing = (db.members[currentSpaceId] || []).find(m => m.email === email);
  if (existing) { showToast('This user is already a member of this Space'); return; }

  // Check for existing pending request
  const existingRequest = db.inviteRequests.find(r =>
    r.spaceId === currentSpaceId && r.userEmail === email && r.status === 'PENDING'
  );
  if (existingRequest) { showToast('An invitation for this email is already pending'); return; }

  // Find or create the invited user
  let invitedUser = Object.values(db.users).find(u => u.email === email);
  const userName = invitedUser ? invitedUser.name : email.split('@')[0];
  const userId = invitedUser ? invitedUser.id : 'invited_' + Date.now();

  // Create the invite request
  db.inviteRequests.push({
    id: 'invreq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    spaceId: currentSpaceId,
    spaceName: space.name,
    type: 'EMAIL',
    role: role,
    userId: userId,
    userName: userName,
    userEmail: email,
    invitedBy: currentUser.name,
    requestedAt: new Date(),
    status: 'PENDING'
  });

  // Add activity
  addActivity(currentSpaceId, 'MEMBER_INVITED', { by: currentUser.name, member: email });

  // Push notification to the invited user
  pushNotification('INVITE_SENT', 'Workspace invitation',
    `${currentUser.name} invited you to join "${space.name}" as ${role}.`, currentSpaceId);

  emailInput.value = '';
  showToast('Invitation sent to ' + email);
  renderMembers();
}

// ── Accept / Decline Join Requests ──

function acceptJoinRequest(requestId) {
  const req = db.inviteRequests.find(r => r.id === requestId);
  if (!req || req.status !== 'PENDING') return;
  req.status = 'ACCEPTED';
  req.resolvedAt = new Date();

  // Add user as a member
  const space = db.spaces.find(s => s.id === req.spaceId);
  if (!db.members[req.spaceId]) db.members[req.spaceId] = [];
  db.members[req.spaceId].push({
    userId: req.userId,
    name: req.userName,
    email: req.userEmail,
    role: req.role || 'EDITOR',
    status: 'ACTIVE',
    joinedAt: new Date()
  });

  addActivity(req.spaceId, 'MEMBER_JOINED', { by: req.userName });
  pushNotification('JOIN_APPROVED', 'Join request approved',
    `${req.userName} is now a member of "${req.spaceName}".`, req.spaceId);

  showToast(req.userName + ' has been added to the Space');
  if (currentView === 'space' && currentSpaceId === req.spaceId) renderMembers();
  if (currentView === 'notifications') renderNotificationsView();
}

function declineJoinRequest(requestId) {
  const req = db.inviteRequests.find(r => r.id === requestId);
  if (!req || req.status !== 'PENDING') return;
  req.status = 'DECLINED';
  req.resolvedAt = new Date();

  pushNotification('JOIN_DECLINED', 'Join request declined',
    `The join request from ${req.userName} for "${req.spaceName}" was declined.`, req.spaceId);

  showToast('Join request from ' + req.userName + ' declined');
  if (currentView === 'space' && currentSpaceId === req.spaceId) renderMembers();
  if (currentView === 'notifications') renderNotificationsView();
}

function renderActivity() {
  const activities = db.activities[currentSpaceId] || [];
  const timeline = document.getElementById('activity-timeline');
  const empty = document.getElementById('activity-empty');
  if (activities.length === 0) {
    timeline.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  timeline.classList.remove('hidden');
  empty.classList.add('hidden');
  timeline.innerHTML = activities.map(a => {
    const time = new Date(a.time).toLocaleString();
    return `<div class="flex items-start gap-3">
      <div class="w-2 h-2 rounded-full bg-brand mt-2 flex-shrink-0"></div>
      <div>
        <p class="text-[13px] text-primary"><strong>${a.user}</strong> ${a.action.replace(/_/g, ' ').toLowerCase()}</p>
        <p class="text-[11px] text-muted">${time}</p>
      </div>
    </div>`;
  }).join('');
}

// ── Profile ──

function renderProfile() {
  if (!currentUser) return;
  document.getElementById('profile-avatar').textContent = currentUser.name.charAt(0);
  document.getElementById('profile-name').textContent = currentUser.name;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role').textContent = currentUser.role;
  document.getElementById('profile-edit-name').value = currentUser.name;
  const owned = db.spaces.filter(s => s.ownerId === currentUser.id);
  document.getElementById('profile-spaces').textContent = owned.length;
  const totalFiles = owned.reduce((sum, s) => sum + (db.files[s.id]?.length || 0), 0);
  document.getElementById('profile-files').textContent = totalFiles;
  document.getElementById('profile-archives').textContent = db.archives.filter(a => owned.some(s => s.id === a.spaceId)).length;
}

function updateProfileName() {
  const name = document.getElementById('profile-edit-name').value;
  if (!name) return;
  currentUser.name = name;
  updateNavUser();
  showToast('Display name updated!');
}

// ── My Spaces ──

function switchMySpacesTab(tab) {
  mySpacesTab = tab;
  renderMySpaces();
}

function renderMySpaces() {
  if (!currentUser) return;
  const owned = getOwnedSpaces();
  const active = owned.filter(s => s.status !== 'ARCHIVED');
  const archived = owned.filter(s => s.status === 'ARCHIVED');

  document.getElementById('my-count-active').textContent = active.length;
  document.getElementById('my-count-archived').textContent = archived.length;

  document.querySelectorAll('.my-tab').forEach(b => {
    const on = b.dataset.mytab === mySpacesTab;
    b.classList.toggle('bg-white', on);
    b.classList.toggle('text-primary', on);
    b.classList.toggle('font-semibold', on);
    b.classList.toggle('shadow-xs', on);
  });

  renderMyStorageGraph(owned);

  const list = mySpacesTab === 'archived' ? archived : active;
  const grid = document.getElementById('my-spaces-grid');
  if (list.length === 0) {
    grid.innerHTML = mySpacesTab === 'archived'
      ? `<div class="col-span-full text-center py-12 text-muted"><span class="material-symbols-outlined text-[48px] text-slate-300 mb-3 block">inventory_2</span><p class="font-medium text-[14px]">You have not archived any Space yet</p><p class="text-[12px] mt-1">Use the three-dot menu on an active Space to archive it.</p></div>`
      : `<div class="col-span-full text-center py-12 text-muted"><span class="material-symbols-outlined text-[48px] text-slate-300 mb-3 block">folder_open</span><p class="font-medium text-[14px]">You have not created any Space yet</p><button onclick="navigateTo('create-space')" class="mt-3 text-[13px] text-brand hover:underline">Create your first Space</button></div>`;
    return;
  }
  grid.innerHTML = list.map(s => mySpaceCard(s)).join('');
}

// Storage usage graph for the workspaces this user created
function renderMyStorageGraph(spaces) {
  const used = spacesBytes(spaces.filter(s => s.status !== 'ARCHIVED'));
  const archived = spacesBytes(spaces.filter(s => s.status === 'ARCHIVED'));
  const total = Math.max(STORAGE_QUOTA_BYTES, used + archived);
  const free = Math.max(0, total - used - archived);
  const share = v => (total ? (v / total) * 100 : 0);

  const setBar = (id, value) => {
    const el = document.getElementById(id);
    el.style.width = share(value) + '%';
    // keep tiny but non-zero usage visible instead of rounding to an invisible sliver
    el.style.minWidth = value > 0 ? '4px' : '0';
  };
  setBar('my-storage-used-bar', used);
  setBar('my-storage-archived-bar', archived);
  setBar('my-storage-free-bar', free);
  document.getElementById('my-storage-used').textContent = formatBytes(used);
  document.getElementById('my-storage-archived').textContent = formatBytes(archived);
  document.getElementById('my-storage-free').textContent = formatBytes(free);

  const usedPct = share(used + archived);
  document.getElementById('my-storage-pct').textContent = (usedPct > 0 && usedPct < 1 ? usedPct.toFixed(1) : usedPct.toFixed(0)) + '% used';
  document.getElementById('my-storage-total').textContent = formatBytes(used + archived) + ' of ' + formatBytes(total) + ' allocated';
}

function mySpaceCard(s) {
  const bytes = spaceBytes(s.id);
  const fileCount = (db.files[s.id] || []).length;
  const members = db.members[s.id] || [];
  const remaining = s.expiryAt - Date.now();
  const days = Math.max(0, Math.floor(remaining / 86400000));
  const hours = Math.max(0, Math.floor((remaining % 86400000) / 3600000));
  const isArchived = s.status === 'ARCHIVED';
  const badge = isArchived
    ? 'bg-purple-50 text-purple-700 border border-purple-200'
    : s.status === 'WARNING'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  const label = isArchived ? 'Archived' : remaining > 0 ? `Expires in ${days}d ${hours}h` : 'Expired';
  const total = (s.expiryAt - s.startAt) || 1;
  const elapsed = Math.min(1, Math.max(0, (Date.now() - s.startAt) / total));
  const elapsedPct = (elapsed * 100).toFixed(0);
  const progressColor = elapsed > 0.8 ? 'bg-red-500' : elapsed > 0.5 ? 'bg-amber-500' : 'bg-brand';
  const tailLabel = isArchived
    ? 'Archived ' + new Date(s.archivedAt || s.expiryAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Auto-archive ' + new Date(s.expiryAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `<div class="relative p-5 rounded-xl bg-card border border-border shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4">
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-display text-[15px] font-semibold text-primary tracking-tight hover:text-brand transition-colors cursor-pointer truncate" onclick="openSpace('${s.id}')">${s.name}</h3>
        <div class="flex items-center gap-1 flex-shrink-0">
          <span class="px-2 py-0.5 rounded text-[11px] font-medium ${badge}">${label}</span>
          ${spaceMenuButton(s)}
        </div>
      </div>
      <p class="text-[13px] text-muted line-clamp-2 leading-relaxed">${s.purpose || s.description || 'No description'}</p>
      <div class="space-y-1.5 pt-1">
        <div class="flex justify-between text-[11px] text-muted">
          <span>${tailLabel}</span>
          <span class="font-mono ${elapsed > 0.8 ? 'text-red-500' : elapsed > 0.5 ? 'text-amber-600' : 'text-muted'} font-medium">${elapsedPct}% elapsed</span>
        </div>
        <div class="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full ${progressColor} rounded-full" style="width: ${Math.min(100, elapsedPct)}%"></div>
        </div>
      </div>
    </div>
    <div class="pt-3 border-t border-border flex items-center justify-between gap-2">
      <div class="flex items-center gap-3">
        <span class="text-[12px] text-muted">${members.length} members</span>
        <span class="text-slate-300">•</span>
        <span class="font-mono text-[11px] text-muted">${fileCount} files</span>
        <span class="text-slate-300">•</span>
        <span class="font-mono text-[11px] text-muted">${formatBytes(bytes)}</span>
      </div>
      <button onclick="openSpace('${s.id}')" class="px-3 py-1.5 rounded-lg bg-brand text-white text-[12px] font-medium hover:bg-brand-700 transition shadow-xs">Open Space</button>
    </div>
    ${spaceMenu(s)}
  </div>`;
}

// ── Notifications ──

function renderNotificationsView() {
  const list = db.notifications.filter(isMyNotification);
  const container = document.getElementById('notifications-list');
  const empty = document.getElementById('notifications-empty');
  const unread = list.filter(n => !n.read).length;

  document.getElementById('notifications-subtitle').textContent = list.length === 0
    ? 'Activity from your workspaces.'
    : list.length + ' event' + (list.length === 1 ? '' : 's') + ' • ' + unread + ' unread';

  if (list.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  container.innerHTML = list.slice(0, 60).map(n => {
    const meta = NOTIF_META[n.type] || { icon: 'notifications', tint: 'text-slate-600 bg-slate-100' };
    const space = n.spaceId ? db.spaces.find(s => s.id === n.spaceId) : null;
    // Check if this notification has an associated pending join request
    const pendingRequest = n.type === 'INVITE_SENT' && n.spaceId
      ? db.inviteRequests.find(r => r.spaceId === n.spaceId && r.status === 'PENDING' && r.invitedBy !== currentUser?.name)
      : null;
    // For JOIN_REQUESTED notifications, find the pending request by space
    const joinRequest = n.type === 'JOIN_REQUESTED' && n.spaceId && currentUser
      ? db.inviteRequests.find(r => r.spaceId === n.spaceId && r.status === 'PENDING' && db.spaces.find(s => s.id === r.spaceId)?.ownerId === currentUser.id)
      : null;
    return `<div class="p-4 rounded-xl border shadow-xs flex items-start gap-3 ${n.read ? 'bg-card border-border' : 'bg-brand-50/40 border-brand/30'}">
      <div class="w-9 h-9 rounded-lg ${meta.tint} flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-[18px]">${meta.icon}</span></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-3">
          <p class="text-[13px] font-semibold text-primary">${n.title}</p>
          <span class="text-[11px] text-muted flex-shrink-0">${timeAgo(new Date(n.at).getTime())}</span>
        </div>
        <p class="text-[12px] text-muted mt-0.5">${n.message}</p>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          ${space ? `<button onclick="openSpace('${space.id}')" class="text-[12px] font-medium text-brand hover:underline">Open ${space.name}</button>` : ''}
          ${pendingRequest ? `
            <button onclick="acceptJoinRequest('${pendingRequest.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 transition">Accept</button>
            <button onclick="declineJoinRequest('${pendingRequest.id}')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-medium hover:bg-red-100 transition">Decline</button>
          ` : ''}
          ${joinRequest ? `
            <button onclick="acceptJoinRequest('${joinRequest.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 transition">Accept</button>
            <button onclick="declineJoinRequest('${joinRequest.id}')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-medium hover:bg-red-100 transition">Decline</button>
          ` : ''}
        </div>
      </div>
      ${n.read ? '' : '<span class="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1.5"></span>'}
    </div>`;
  }).join('');

  // Everything the user can see is considered read once the page is opened
  db.notifications.forEach(n => { if (isMyNotification(n)) n.read = true; });
  updateNotifBadge();
}

function markAllNotificationsRead() {
  db.notifications.forEach(n => { if (isMyNotification(n)) n.read = true; });
  updateNotifBadge();
  renderNotificationsView();
}

// ── Admin Portal (all figures derived from live application data) ──

function renderAdmin() {
  const users = Object.keys(db.users).length;
  const active = db.spaces.filter(s => s.status === 'ACTIVE').length;
  const warning = db.spaces.filter(s => s.status === 'WARNING').length;
  const pending = db.extensionRequests.filter(r => r.status === 'PENDING');
  const jobs = db.spaces.filter(s => s.status === 'ARCHIVED' || s.status === 'DELETED').length;
  const packaged = db.archives.length;

  document.getElementById('admin-total-users').textContent = users;
  document.getElementById('admin-active-spaces').textContent = active;
  document.getElementById('admin-warning-window').textContent = warning;
  document.getElementById('admin-pending-tickets').textContent = pending.length;
  document.getElementById('admin-pending-note').textContent = pending.length
    ? pending.length + ' awaiting sign-off'
    : 'No pending requests';
  document.getElementById('admin-pipeline').textContent = jobs
    ? Math.round(Math.min(1, packaged / jobs) * 100) + '%'
    : '0%';
  document.getElementById('admin-pipeline-note').textContent = jobs
    ? packaged + ' of ' + jobs + ' finished Spaces packaged'
    : 'No archival jobs yet';

  const reqBody = document.getElementById('admin-requests-table');
  if (pending.length === 0) {
    reqBody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-muted italic">No pending extension requests.</td></tr>';
  } else {
    reqBody.innerHTML = pending.map(r => {
      const space = db.spaces.find(s => s.id === r.spaceId);
      return `<tr>
        <td class="px-6 py-3 font-medium text-primary">${r.spaceName}</td>
        <td class="px-6 py-3 text-muted">${r.requestedBy}</td>
        <td class="px-6 py-3 text-muted">${formatDateTime(space ? space.expiryAt : r.currentExpiry)}</td>
        <td class="px-6 py-3 text-muted">${timeAgo(new Date(r.requestedAt).getTime())}</td>
        <td class="px-6 py-3 text-right">
          <div class="inline-flex gap-2">
            <button onclick="approveExtension('${r.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-medium hover:bg-emerald-100 transition">Approve</button>
            <button onclick="rejectExtension('${r.id}')" class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[12px] font-medium hover:bg-red-100 transition">Reject</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  const logs = [];
  Object.keys(db.activities).forEach(spaceId => {
    const space = db.spaces.find(s => s.id === spaceId);
    (db.activities[spaceId] || []).forEach(a => logs.push({
      action: a.action, user: a.user, time: a.time,
      spaceName: space ? space.name : 'Unknown space'
    }));
  });
  logs.sort((a, b) => new Date(b.time) - new Date(a.time));

  const logBody = document.getElementById('admin-logs-table');
  if (logs.length === 0) {
    logBody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-muted italic">No daemon activity recorded yet.</td></tr>';
  } else {
    logBody.innerHTML = logs.slice(0, 10).map(a => `<tr>
      <td class="px-6 py-3 text-muted font-mono text-[12px]">${a.action.replace(/_/g, ' ')}</td>
      <td class="px-6 py-3 text-primary">${a.spaceName}</td>
      <td class="px-6 py-3 text-muted">${a.user}</td>
      <td class="px-6 py-3 text-muted">${formatDateTime(a.time)}</td>
    </tr>`).join('');
  }
}

function approveExtension(requestId) {
  const req = db.extensionRequests.find(r => r.id === requestId);
  if (!req || req.status !== 'PENDING') return;
  req.status = 'APPROVED';
  req.resolvedAt = new Date();
  const space = db.spaces.find(s => s.id === req.spaceId);
  if (space) {
    space.expiryAt = new Date(Math.max(space.expiryAt, Date.now()) + 48 * 3600000);
    if (space.status === 'WARNING') space.status = 'ACTIVE';
    addActivity(space.id, 'EXTENSION_APPROVED', { by: currentUser ? currentUser.name : 'Admin' });
    pushNotification('EXTENSION_APPROVED', 'Extension approved', `"${space.name}" now ends ${formatDateTime(space.expiryAt)}.`, space.id);
  }
  showToast('Extension approved');
  renderAdmin();
  if (currentView === 'space') renderSpaceDetail();
}

function rejectExtension(requestId) {
  const req = db.extensionRequests.find(r => r.id === requestId);
  if (!req || req.status !== 'PENDING') return;
  req.status = 'REJECTED';
  req.resolvedAt = new Date();
  const space = db.spaces.find(s => s.id === req.spaceId);
  if (space) {
    addActivity(space.id, 'EXTENSION_REJECTED', { by: currentUser ? currentUser.name : 'Admin' });
    pushNotification('EXTENSION_REJECTED', 'Extension rejected', `The extension request for "${space.name}" was declined.`, space.id);
  }
  showToast('Extension rejected');
  renderAdmin();
}
