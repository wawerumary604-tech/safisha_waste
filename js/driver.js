/* ============================================================
   SAFISHA — Driver Dashboard  (localStorage)
   ============================================================ */

(function () {

  // ── Auth guard ─────────────────────────────────────────────
  // Read specifically the driver session so a logged-in client
  // session doesn't bleed in.
  var session = JSON.parse(localStorage.getItem('sw_session_driver') || 'null');
  if (!session || session.role !== 'driver') {
    window.location.href = 'index.html';
    return;
  }

  // ── Populate header ───────────────────────────────────────
  document.getElementById('welcome-name').textContent      = session.full_name.split(' ')[0];
  document.getElementById('driver-name-top').textContent   = session.full_name;
  document.getElementById('driver-avatar-top').textContent = session.full_name.charAt(0).toUpperCase();

  // ── Populate profile ──────────────────────────────────────
  document.getElementById('profile-name').value    = session.full_name;
  document.getElementById('profile-email').value   = session.email;
  document.getElementById('profile-phone').value   = session.phone;
  document.getElementById('profile-vehicle').value = session.vehicle || '—';
  document.getElementById('profile-license').value = session.license || '—';
  document.getElementById('profile-since').value   = fmtDate(session.created_at);
  document.getElementById('profile-avatar-big').textContent = session.full_name.charAt(0).toUpperCase();

  // ── Online toggle ─────────────────────────────────────────
  window.toggleDriverStatus = function () {
    var cb  = document.getElementById('driver-online');
    var lbl = document.getElementById('status-label');
    lbl.textContent = cb.checked ? 'Online' : 'Offline';
    lbl.className   = cb.checked ? 'status-online' : 'status-offline';
  };

  loadOverview();
  renderAvailableJobs();
  renderMyJobs();

  // ================================================================
  //  OVERVIEW
  // ================================================================
  function loadOverview() {
    var allPosts  = getPosts();
    var available = allPosts.filter(function (p) { return p.status === 'Pending'; });
    var mine      = allPosts.filter(function (p) { return p.driverId === session.id; });
    var accepted  = mine.filter(function (p) { return p.status === 'Accepted'; });
    var collected = mine.filter(function (p) { return p.status === 'Collected' || p.status === 'At Facility'; });
    var sent      = mine.filter(function (p) { return p.status === 'At Facility'; });

    document.getElementById('stat-available').textContent = available.length;
    document.getElementById('stat-accepted').textContent  = accepted.length;
    document.getElementById('stat-done').textContent      = collected.length;
    document.getElementById('stat-sent').textContent      = sent.length;

    var highJobs = available.filter(function (p) { return p.urgency === 'High'; });
    var banner   = document.getElementById('urgency-alert');
    if (banner) banner.style.display = highJobs.length ? '' : 'none';

    var actEl  = document.getElementById('driver-activity');
    var recent = mine.slice().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    }).slice(0, 5);

    if (!recent.length) {
      actEl.innerHTML = '<div class="empty-state">No activity yet. Accept your first job!</div>';
      return;
    }
    actEl.innerHTML = recent.map(function (p) {
      var dotClass = {
        'Accepted':    'dot-accepted',
        'Collected':   'dot-collected',
        'At Facility': 'dot-facility'
      }[p.status] || 'dot-pending';
      return '<div class="activity-item">'
        + '<span class="activity-dot ' + dotClass + '"></span>'
        + '<span class="activity-text"><strong>' + escHtml(p.waste_type) + '</strong> &mdash; ' + escHtml(p.location) + '</span>'
        + '<span class="activity-time">' + timeAgo(p.created_at) + '</span>'
        + '</div>';
    }).join('');
  }

  // ================================================================
  //  AVAILABLE JOBS
  // ================================================================
  window.renderAvailableJobs = function () {
    var tf = (document.getElementById('filter-type')    || {}).value || 'all';
    var uf = (document.getElementById('filter-urgency') || {}).value || 'all';

    var posts = getPosts().filter(function (p) { return p.status === 'Pending'; });
    if (tf !== 'all') posts = posts.filter(function (p) { return p.waste_type === tf; });
    if (uf !== 'all') posts = posts.filter(function (p) { return p.urgency    === uf; });

    posts.sort(function (a, b) {
      var ord = { High: 0, Medium: 1, Low: 2 };
      if (ord[a.urgency] !== ord[b.urgency]) return ord[a.urgency] - ord[b.urgency];
      return new Date(b.created_at) - new Date(a.created_at);
    });

    var listEl = document.getElementById('available-jobs-list');
    if (!posts.length) {
      listEl.innerHTML = '<div class="empty-state">No available jobs right now. Check back soon!</div>';
      return;
    }

    listEl.innerHTML = posts.map(function (p) {
      return '<div class="post-card">'
        + '<div class="post-card-header">'
        +   '<div><div class="post-type">' + escHtml(p.waste_type) + '</div>'
        +   '<div class="post-date">Posted ' + timeAgo(p.created_at) + '</div></div>'
        +   urgencyPill(p.urgency)
        + '</div>'
        + '<div class="post-meta">'
        +   '<div class="post-meta-row"><i class="fa-solid fa-location-dot"></i> '   + escHtml(p.location)     + '</div>'
        +   '<div class="post-meta-row"><i class="fa-solid fa-weight-hanging"></i> ' + escHtml(p.weight_range) + '</div>'
        +   '<div class="post-meta-row"><i class="fa-solid fa-calendar-day"></i> '   + p.pickup_date + ' &middot; ' + escHtml(p.time_slot) + '</div>'
        +   '<div class="post-meta-row"><i class="fa-solid fa-user"></i> Client: '    + escHtml(p.clientName  || '') + '</div>'
        +   '<div class="post-meta-row"><i class="fa-solid fa-phone"></i> '           + escHtml(p.clientPhone || '') + '</div>'
        + '</div>'
        + '<div class="post-desc">' + escHtml(p.description) + '</div>'
        + '<div class="post-actions">'
        +   '<button class="btn btn-primary btn-sm" onclick="acceptJob(\'' + p.id + '\')">'
        +   '<i class="fa-solid fa-truck"></i> Accept Job</button>'
        + '</div>'
        + '</div>';
    }).join('');
  };

  // ── Accept job ────────────────────────────────────────────
  window.acceptJob = function (id) {
    var posts = getPosts();
    var post  = posts.find(function (p) { return p.id === id; });
    if (!post) return;
    if (post.status !== 'Pending') {
      showToast('<i class="fa-solid fa-circle-xmark"></i> Job already taken.', 'error');
      renderAvailableJobs();
      return;
    }
    post.status      = 'Accepted';
    post.driverId    = session.id;
    post.driver_name = session.full_name;
    post.accepted_at = new Date().toISOString();
    savePosts(posts);

    showToast('<i class="fa-solid fa-circle-check"></i> Job accepted! Check My Collections.', 'success');
    loadOverview();
    renderAvailableJobs();
  };

  // ================================================================
  //  MY JOBS
  // ================================================================
  window.renderMyJobs = function () {
    var fval  = (document.getElementById('filter-myjobs') || {}).value || 'all';
    var posts = getPosts().filter(function (p) { return p.driverId === session.id; });

    if (fval !== 'all') posts = posts.filter(function (p) { return p.status === fval; });
    posts.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    var listEl = document.getElementById('my-jobs-list');
    if (!posts.length) {
      listEl.innerHTML = '<div class="empty-state">No collections yet. Accept a job from Available Jobs.</div>';
      return;
    }

    listEl.innerHTML = posts.map(function (p) {
      var actions = '';
      if (p.status === 'Accepted') {
        actions = '<button class="btn btn-success btn-sm" onclick="markCollected(\'' + p.id + '\')">'
          + '<i class="fa-solid fa-circle-check"></i> Mark Collected</button>';
      }
      if (p.status === 'Collected') {
        actions = '<button class="btn btn-warning btn-sm" onclick="openFacilityModal(\'' + p.id + '\')">'
          + '<i class="fa-solid fa-industry"></i> Send to Facility</button>';
      }
      var facilityInfo = p.facility_name ? '<div class="post-meta-row"><i class="fa-solid fa-industry"></i> Facility: <strong>' + escHtml(p.facility_name) + '</strong></div>' : '';
      var bidInfo      = p.starting_bid  ? '<div class="post-meta-row"><i class="fa-solid fa-money-bill-wave"></i> Bid: <strong>KES ' + Number(p.starting_bid).toLocaleString() + '</strong></div>' : '';

      return '<div class="post-card">'
        + '<div class="post-card-header">'
        +   '<div><div class="post-type">' + escHtml(p.waste_type) + '</div>'
        +   '<div class="post-date">Posted ' + timeAgo(p.created_at) + '</div></div>'
        +   statusBadge(p.status)
        + '</div>'
        + urgencyPill(p.urgency)
        + '<div class="post-meta">'
        +   '<div class="post-meta-row"><i class="fa-solid fa-location-dot"></i> '   + escHtml(p.location)     + '</div>'
        +   '<div class="post-meta-row"><i class="fa-solid fa-weight-hanging"></i> ' + escHtml(p.weight_range) + '</div>'
        +   '<div class="post-meta-row"><i class="fa-solid fa-user"></i> Client: '    + escHtml(p.clientName   || '') + '</div>'
        +   facilityInfo + bidInfo
        + '</div>'
        + '<div class="post-desc">' + escHtml(p.description) + '</div>'
        + (actions ? '<div class="post-actions">' + actions + '</div>' : '')
        + '</div>';
    }).join('');
  };

  // ── Mark collected ────────────────────────────────────────
  window.markCollected = function (id) {
    var posts = getPosts();
    var post  = posts.find(function (p) { return p.id === id; });
    if (!post) return;
    post.status       = 'Collected';
    post.collected_at = new Date().toISOString();
    savePosts(posts);
    showToast('<i class="fa-solid fa-circle-check"></i> Waste marked as collected!', 'success');
    loadOverview();
    renderMyJobs();
  };

  // ── Facility modal ────────────────────────────────────────
  window.openFacilityModal = function (id) {
    var posts = getPosts();
    var post  = posts.find(function (p) { return p.id === id; });
    if (!post) return;
    document.getElementById('facility-post-id').value  = id;
    document.getElementById('facility-summary').value  = post.waste_type + ' · ' + post.weight_range + ' · ' + post.location;
    document.getElementById('facility-vehicle').value  = session.vehicle || 'Not specified';
    document.getElementById('facility-notes').value    = '';
    document.getElementById('facility-bid').value      = '';
    document.getElementById('facility-name').value     = '';
    document.getElementById('modal-facility').classList.add('open');
  };

  window.closeFacilityModal = function () {
    document.getElementById('modal-facility').classList.remove('open');
  };

  window.handleSendToFacility = function (e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

    var postId      = document.getElementById('facility-post-id').value;
    var facName     = document.getElementById('facility-name').value;
    var notes       = document.getElementById('facility-notes').value.trim();
    var startingBid = document.getElementById('facility-bid').value;

    var posts = getPosts();
    var post  = posts.find(function (p) { return p.id === postId; });
    if (!post) return;

    post.status        = 'At Facility';
    post.facility_name = facName;
    post.driver_notes  = notes;
    post.starting_bid  = startingBid;
    post.sent_at       = new Date().toISOString();
    savePosts(posts);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Send to Facility';

    closeFacilityModal();
    showToast('<i class="fa-solid fa-industry"></i> Waste sent to ' + facName + '!', 'success');
    loadOverview();
    renderMyJobs();
  };

})();
