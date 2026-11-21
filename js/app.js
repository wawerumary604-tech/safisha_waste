/* ============================================================
   SAFISHA — Shared App Logic
   Auth uses localStorage (works without a server).
   When the Express server is running the dashboard JS calls
   /api/* — but register/login always use localStorage so the
   app works by simply opening index.html in a browser.
   ============================================================ */

// ── localStorage helpers ──────────────────────────────────────
function getUsers()    { return JSON.parse(localStorage.getItem('sw_users')  || '[]');   }
function saveUsers(u)  { localStorage.setItem('sw_users',   JSON.stringify(u)); }
function getPosts()    { return JSON.parse(localStorage.getItem('sw_posts')  || '[]');   }
function savePosts(p)  { localStorage.setItem('sw_posts',   JSON.stringify(p)); }
// Session is stored per-role so a logged-in client and a logged-in driver
// don't overwrite each other's session in the same browser.
function _sessionKey(role) { return 'sw_session_' + (role || 'unknown'); }

function getSession() {
  // Try role-specific keys first, then fall back to old generic key
  var s = localStorage.getItem('sw_session_client')
       || localStorage.getItem('sw_session_driver')
       || localStorage.getItem('sw_session');
  return JSON.parse(s || 'null');
}
function saveSession(u) {
  localStorage.setItem(_sessionKey(u.role), JSON.stringify(u));
  // Keep generic key in sync for compatibility
  localStorage.setItem('sw_session', JSON.stringify(u));
}
function clearSession() {
  var s = getSession();
  if (s) localStorage.removeItem(_sessionKey(s.role));
  localStorage.removeItem('sw_session');
}

// ── ID generator ─────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type) {
  type = type || '';
  var t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.className = 'toast'; }, 3200);
}

// ── Modals ────────────────────────────────────────────────────
function openModal(name) {
  var el = document.getElementById('modal-' + name);
  if (el) el.classList.add('open');
}
function closeModal(name) {
  var el = document.getElementById('modal-' + name);
  if (el) el.classList.remove('open');
}
function switchModal(from, to) { closeModal(from); openModal(to); }

// Close on backdrop click
document.addEventListener('click', function (e) {
  document.querySelectorAll('.modal-overlay.open').forEach(function (ov) {
    if (e.target === ov) ov.classList.remove('open');
  });
});

// ── Navbar mobile ─────────────────────────────────────────────
function toggleMenu() {
  var nav = document.querySelector('.nav-links');
  if (nav) nav.classList.toggle('open');
}

// ── Role tabs — Register ──────────────────────────────────────
var currentRegRole = 'client';
function switchRegRole(role) {
  currentRegRole = role;
  document.getElementById('reg-client-tab').classList.toggle('active', role === 'client');
  document.getElementById('reg-driver-tab').classList.toggle('active', role === 'driver');
  var veh = document.getElementById('reg-vehicle-group');
  var lic = document.getElementById('reg-license-group');
  var isDriver = (role === 'driver');
  if (veh) { veh.style.display = isDriver ? '' : 'none'; document.getElementById('reg-vehicle').required = isDriver; }
  if (lic) { lic.style.display = isDriver ? '' : 'none'; document.getElementById('reg-license').required = isDriver; }
}

// ── Role tabs — Login ─────────────────────────────────────────
var currentLoginRole = 'client';
function switchLoginRole(role) {
  currentLoginRole = role;
  document.getElementById('login-client-tab').classList.toggle('active', role === 'client');
  document.getElementById('login-driver-tab').classList.toggle('active', role === 'driver');
}

// ================================================================
//  REGISTER
// ================================================================
function handleRegister(e) {
  e.preventDefault();

  var btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';

  var name     = document.getElementById('reg-name').value.trim();
  var email    = document.getElementById('reg-email').value.trim().toLowerCase();
  var phone    = document.getElementById('reg-phone').value.trim();
  var location = document.getElementById('reg-location').value.trim();
  var password = document.getElementById('reg-password').value;

  // Basic validation
  if (!name || !email || !phone || !location || !password) {
    showToast('<i class="fa-solid fa-circle-xmark"></i> Please fill in all fields.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
    return;
  }
  if (password.length < 6) {
    showToast('<i class="fa-solid fa-circle-xmark"></i> Password must be at least 6 characters.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
    return;
  }

  var users = getUsers();

  // Duplicate email check
  if (users.find(function (u) { return u.email === email; })) {
    showToast('<i class="fa-solid fa-circle-xmark"></i> Email already registered. Please login.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
    return;
  }

  var user = {
    id:         genId(),
    role:       currentRegRole,
    full_name:  name,
    email:      email,
    phone:      phone,
    location:   location,
    password:   password,               // plain text — localStorage only
    vehicle:    currentRegRole === 'driver' ? document.getElementById('reg-vehicle').value.trim() : '',
    license:    currentRegRole === 'driver' ? document.getElementById('reg-license').value.trim() : '',
    created_at: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);

  // Save session without password
  var sessionUser = Object.assign({}, user);
  delete sessionUser.password;
  saveSession(sessionUser);

  showToast('<i class="fa-solid fa-circle-check"></i> Account created! Redirecting...', 'success');
  btn.disabled = false;
  btn.innerHTML = 'Create Account';

  setTimeout(function () { redirectByRole(user.role); }, 1000);
}

// ================================================================
//  LOGIN
// ================================================================
function handleLogin(e) {
  e.preventDefault();

  var btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

  var email    = document.getElementById('login-email').value.trim().toLowerCase();
  var password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('<i class="fa-solid fa-circle-xmark"></i> Please enter your email and password.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Login';
    return;
  }

  var users = getUsers();
  var user  = users.find(function (u) {
    return u.email === email &&
           u.password === password &&
           u.role === currentLoginRole;
  });

  if (!user) {
    showToast('<i class="fa-solid fa-circle-xmark"></i> Invalid email, password, or role. Try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = 'Login';
    return;
  }

  var sessionUser = Object.assign({}, user);
  delete sessionUser.password;
  saveSession(sessionUser);

  showToast('<i class="fa-solid fa-circle-check"></i> Welcome back, ' + user.full_name + '!', 'success');
  btn.disabled = false;
  btn.innerHTML = 'Login';

  setTimeout(function () { redirectByRole(user.role); }, 900);
}

// ── Redirect by role ─────────────────────────────────────────
function redirectByRole(role) {
  if (role === 'client')      window.location.href = 'client.html';
  else if (role === 'driver') window.location.href = 'driver.html';
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  // Only clear the session for the role currently active on this page
  var s = getSession();
  if (s) localStorage.removeItem(_sessionKey(s.role));
  localStorage.removeItem('sw_session');
  window.location.href = 'index.html';
}

// ── Dashboard panel switching ─────────────────────────────────
function showPanel(name, linkEl) {
  document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
  if (linkEl) linkEl.classList.add('active');

  var titleEl = document.getElementById('topbar-title');
  if (titleEl && linkEl) titleEl.textContent = linkEl.querySelector('span:last-child').textContent;

  if (name === 'myposts'   && typeof renderMyPosts       === 'function') renderMyPosts();
  if (name === 'available' && typeof renderAvailableJobs === 'function') renderAvailableJobs();
  if (name === 'myjobs'    && typeof renderMyJobs        === 'function') renderMyJobs();
  if (name === 'incoming'  && typeof renderIncoming      === 'function') renderIncoming();
  if (name === 'bidding'   && typeof renderBidding       === 'function') renderBidding();
  if (name === 'completed' && typeof renderCompleted     === 'function') renderCompleted();
}

function toggleSidebar() {
  var s = document.getElementById('sidebar');
  if (s) s.classList.toggle('open');
}

function scrollTo(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ── Date helpers ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(iso) {
  var diff = Date.now() - new Date(iso).getTime();
  var m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

// ── Status badge ─────────────────────────────────────────────
function statusBadge(status) {
  var map = {
    'Pending':     'status-pending',
    'Accepted':    'status-accepted',
    'Collected':   'status-collected',
    'At Facility': 'status-facility',
    'Completed':   'status-completed'
  };
  var icon = {
    'Pending':     '<i class="fa-solid fa-clock"></i>',
    'Accepted':    '<i class="fa-solid fa-truck"></i>',
    'Collected':   '<i class="fa-solid fa-circle-check"></i>',
    'At Facility': '<i class="fa-solid fa-industry"></i>',
    'Completed':   '<i class="fa-solid fa-trophy"></i>'
  };
  return '<span class="status-badge ' + (map[status] || '') + '">'
       + (icon[status] || '') + ' ' + status + '</span>';
}

// ── Urgency pill ─────────────────────────────────────────────
function urgencyPill(u) {
  var cls = { Low: 'urg-low', Medium: 'urg-medium', High: 'urg-high' };
  var ico = {
    Low:    '<i class="fa-solid fa-circle-dot" style="color:#16a34a"></i>',
    Medium: '<i class="fa-solid fa-circle-dot" style="color:#d97706"></i>',
    High:   '<i class="fa-solid fa-circle-dot" style="color:#dc2626"></i>'
  };
  return '<span class="urgency-pill ' + (cls[u] || '') + '">'
       + (ico[u] || '') + ' ' + u + '</span>';
}

// ── HTML escape ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
