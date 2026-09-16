// ── Application State ──
let currentUser = null;
let currentSpaceId = null;
let currentView = 'landing';
let currentSpaceTab = 'files';
let currentFilter = 'all';
let countdownInterval = null;
let pendingMembers = [];
let viewHistory = [];
let mySpacesTab = 'active';

// ── Storage quotas (single source of truth for every storage calculation) ──
const STORAGE_QUOTA_BYTES = 20 * 1024 * 1024 * 1024;   // 20 GB ephemeral allowance
const SPACE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;       // 5 GB per Space
const VAULT_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;      // 50 GB cold storage allowance

// ── Demo Database ──
const db = {
  users: {
    owner:  { id: 'owner',  name: 'Khushi Patel', email: 'khushi@demo.com',  role: 'ADMIN', dept: 'Computer Eng.' },
    editor: { id: 'editor', name: 'Alex Chen',    email: 'alex@demo.com',    role: 'USER', dept: 'Engineering' },
    viewer: { id: 'viewer', name: 'Sam Wilson',   email: 'sam@demo.com',     role: 'USER', dept: 'Design' },
  },
  spaces: [],
  files: {},
  activities: {},
  archives: [],
  members: {},
  notifications: [],
  extensionRequests: [],
  inviteRequests: [],  // join requests from link or email invites
};

// ── Helper: Get greeting based on time of day ──
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Helper: Format file size ──
function formatSize(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes || 0) + ' B';
}

// ── Helper: Format any byte count using real data only ──
function formatBytes(bytes) {
  return formatSize(bytes || 0);
}

// ── Helper: Format a stored timestamp as a readable local date + time ──
function formatDateTime(value) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ── Storage helpers: every number is derived from actual uploaded file sizes ──
function spaceBytes(spaceId) {
  return (db.files[spaceId] || []).reduce((sum, f) => sum + (f.size || 0), 0);
}

function spacesBytes(spaces) {
  return spaces.reduce((sum, s) => sum + spaceBytes(s.id), 0);
}

function archiveBytes() {
  return db.archives.reduce((sum, a) => sum + (a.bytes || 0), 0);
}

// ── Workspace queries ──
function isMemberOf(space) {
  if (!currentUser || !space) return false;
  if (space.ownerId === currentUser.id) return true;
  return (db.members[space.id] || []).some(m => m.userId === currentUser.id);
}

// Spaces the current user can see (deleted Spaces are excluded everywhere)
function getMySpaces() {
  if (!currentUser) return [];
  return db.spaces.filter(s => s.status !== 'DELETED' && isMemberOf(s));
}

// Spaces the current user created
function getOwnedSpaces() {
  if (!currentUser) return [];
  return db.spaces.filter(s => s.status !== 'DELETED' && s.ownerId === currentUser.id);
}

// ── Activity + notification writers ──
function addActivity(spaceId, action, meta) {
  if (!spaceId || !db.activities[spaceId]) return;
  db.activities[spaceId].push({
    action,
    user: (meta && meta.by) || (currentUser ? currentUser.name : 'System'),
    time: new Date(),
    meta: meta || {}
  });
}

const NOTIF_META = {
  SPACE_CREATED:       { icon: 'add_box',        tint: 'text-brand bg-brand-50' },
  SPACE_WARNING:       { icon: 'schedule',       tint: 'text-amber-600 bg-amber-50' },
  SPACE_EXPIRED:       { icon: 'event_busy',     tint: 'text-red-600 bg-red-50' },
  SPACE_ARCHIVED:      { icon: 'inventory_2',    tint: 'text-purple-600 bg-purple-50' },
  SPACE_RESTORED:      { icon: 'unarchive',      tint: 'text-emerald-600 bg-emerald-50' },
  SPACE_DELETED:       { icon: 'delete',         tint: 'text-red-600 bg-red-50' },
  FILE_UPLOADED:       { icon: 'upload_file',    tint: 'text-slate-600 bg-slate-100' },
  MEMBER_ADDED:        { icon: 'person_add',     tint: 'text-slate-600 bg-slate-100' },
  EXTENSION_REQUESTED: { icon: 'pending_actions', tint: 'text-amber-600 bg-amber-50' },
  EXTENSION_APPROVED:  { icon: 'check_circle',   tint: 'text-emerald-600 bg-emerald-50' },
  EXTENSION_REJECTED:  { icon: 'cancel',         tint: 'text-red-600 bg-red-50' },
  JOIN_REQUESTED:     { icon: 'group_add',      tint: 'text-blue-600 bg-blue-50' },
  JOIN_APPROVED:      { icon: 'check_circle',   tint: 'text-emerald-600 bg-emerald-50' },
  JOIN_DECLINED:      { icon: 'cancel',         tint: 'text-red-600 bg-red-50' },
  INVITE_SENT:        { icon: 'mail',           tint: 'text-brand bg-brand-50' },
};

function pushNotification(type, title, message, spaceId) {
  db.notifications.unshift({
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type, title, message,
    spaceId: spaceId || null,
    at: new Date(),
    read: false
  });
  updateNotifBadge();
}

function isMyNotification(n) {
  if (!n.spaceId) return true;
  const space = db.spaces.find(s => s.id === n.spaceId);
  return space ? isMemberOf(space) : false;
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const unread = db.notifications.filter(n => isMyNotification(n) && !n.read).length;
  badge.textContent = unread > 9 ? '9+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
  badge.classList.toggle('flex', unread > 0);
}

// ── Helper: Format relative time ──
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}
