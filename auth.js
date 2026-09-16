// ── Authentication Module ──

function toggleAuthForm() {
  document.getElementById('auth-form-login').classList.toggle('hidden');
  document.getElementById('auth-form-register').classList.toggle('hidden');
  document.getElementById('auth-error').classList.add('hidden');
}

function updateNavUser() {
  if (!currentUser) return;
  const initial = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('sidebar-username').textContent = currentUser.name;
  document.getElementById('sidebar-userrole').textContent = currentUser.dept || currentUser.role;
  document.getElementById('topbar-avatar').textContent = initial;
  document.getElementById('topbar-name').textContent = currentUser.name;
  document.getElementById('topbar-role').textContent = currentUser.role === 'ADMIN' ? 'Creator' : currentUser.role;
}

function quickLogin(role) {
  currentUser = db.users[role];
  viewHistory = [];
  updateNavUser();
  navigateTo('dashboard', { replace: true });
}

// ── Launch Space CTA (homepage + top nav) ──
// Signed out: go to Sign In. Signed in: continue into the app.
function launchSpace() {
  if (!currentUser) { navigateTo('login'); return; }
  navigateTo('dashboard');
}

function doLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) { showAuthError('Please fill in all fields'); return; }

  // Check registered users first
  const found = Object.values(db.users).find(u => u.email === email);
  if (found) {
    currentUser = found;
    viewHistory = [];
    updateNavUser();
    navigateTo('dashboard', { replace: true });
    showToast('Welcome back, ' + currentUser.name + '!');
    return;
  }

  // Fallback to demo accounts by email pattern
  const role = email.includes('admin') || email.includes('khushi') ? 'owner'
    : email.includes('alex') ? 'editor' : 'viewer';
  quickLogin(role);
}

function doRegister() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const pass = document.getElementById('reg-pass').value;

  if (!name || !email || !pass) { showAuthError('Please fill in all fields'); return; }
  if (pass.length < 8) { showAuthError('Password must be at least 8 characters'); return; }
  if (Object.values(db.users).some(u => u.email === email)) { showAuthError('Email already registered'); return; }

  const id = 'user_' + Date.now();
  db.users[id] = { id, name, email, role: 'USER', dept: 'User', createdAt: new Date() };
  currentUser = db.users[id];
  viewHistory = [];
  updateNavUser();
  navigateTo('dashboard', { replace: true });
  showToast('Account created! Welcome, ' + name + '!');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function logout() {
  currentUser = null;
  currentSpaceId = null;
  viewHistory = [];
  if (countdownInterval) clearInterval(countdownInterval);
  document.getElementById('auth-nav').classList.remove('hidden');
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('topbar').classList.add('hidden');
  navigateTo('landing', { replace: true });
  showToast('Logged out successfully');
}
