/* ============================================================
   SAFISHA — Client Dashboard  (localStorage)
   ============================================================ */

(function () {

  // ── Auth guard ─────────────────────────────────────────────
  // Read specifically the client session so a logged-in driver
  // session doesn't bleed in.
  var session = JSON.parse(localStorage.getItem('sw_session_client') || 'null');
  if (!session || session.role !== 'client') {
    window.location.href = 'index.html';
    return;
  }

  // ── Set today as min pickup date ──────────────────────────
  var dateInput = document.getElementById('waste-date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  // ── Populate header ───────────────────────────────────────
  document.getElementById('welcome-name').textContent    = session.full_name.split(' ')[0];
  document.getElementById('client-name-top').textContent = session.full_name;
  document.getElementById('client-avatar').textContent   = session.full_name.charAt(0).toUpperCase();

  // ── Populate profile ──────────────────────────────────────
  document.getElementById('profile-name').value     = session.full_name;
  document.getElementById('profile-email').value    = session.email;
  document.getElementById('profile-phone').value    = session.phone;
  document.getElementById('profile-location').value = session.location;
  document.getElementById('profile-since').value    = fmtDate(session.created_at);
  document.getElementById('profile-avatar-big').textContent = session.full_name.charAt(0).toUpperCase();

  loadOverview();
  renderMyPosts();

  // ================================================================
  //  POST GARBAGE
  // ================================================================
  window.handlePostGarbage = function (e) {
    e.preventDefault();

    var btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    var urgency = document.querySelector('input[name="urgency"]:checked');

    var post = {
      id:           genId(),
      clientId:     session.id,
      clientName:   session.full_name,
      clientPhone:  session.phone,
      waste_type:   document.getElementById('waste-type').value,
      weight_range: document.getElementById('waste-weight').value,
      location:     document.getElementById('waste-location').value.trim(),
      description:  document.getElementById('waste-desc').value.trim(),
      pickup_date:  document.getElementById('waste-date').value,
      time_slot:    document.getElementById('waste-time').value,
      urgency:      urgency ? urgency.value : 'Medium',
      status:       'Pending',
      created_at:   new Date().toISOString(),
      driverId:     null,
      driver_name:  null,
      facility_name:null,
      collected_at: null,
      sent_at:      null,
      starting_bid: null
    };

    var posts = getPosts();
    posts.push(post);
    savePosts(posts);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';

    showToast('<i class="fa-solid fa-circle-check"></i> Garbage request posted!', 'success');
    e.target.reset();

    // Switch to My Posts tab and re-render
    var mypostsLink = document.querySelector('.nav-item[onclick*="myposts"]');
    showPanel('myposts', mypostsLink);
    renderMyPosts();
    loadOverview();
  };

  // ================================================================
  //  OVERVIEW
  // ================================================================
  function loadOverview() {
    var posts     = getPosts().filter(function (p) { return p.clientId === session.id; });
    var total     = posts.length;
    var pending   = posts.filter(function (p) { return p.status === 'Pending'; }).length;
    var collected = posts.filter(function (p) { return p.status === 'Collected'; }).length;
    var facility  = posts.filter(function (p) { return p.status === 'At Facility'; }).length;

    document.getElementById('stat-total').textContent     = total;
    document.getElementById('stat-pending').textContent   = pending;
    document.getElementById('stat-collected').textContent = collected;
    document.getElementById('stat-facility').textContent  = facility;

    var actEl  = document.getElementById('recent-activity');
    var recent = posts.slice().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    }).slice(0, 5);

    if (!recent.length) {
      actEl.innerHTML = '<div class="empty-state">No activity yet. Post your first garbage request!</div>';
      return;
    }
    actEl.innerHTML = recent.map(function (p) {
      var dotClass = {
        'Pending':     'dot-pending',
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
  //  MY POSTS
  // ================================================================
  window.renderMyPosts = function () {
    var filter = document.getElementById('filter-status');
    var fval   = filter ? filter.value : 'all';
    var posts  = getPosts().filter(function (p) { return p.clientId === session.id; });

    if (fval !== 'all') posts = posts.filter(function (p) { return p.status === fval; });
    posts.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

    var listEl = document.getElementById('my-posts-list');
    if (!posts.length) {
      listEl.innerHTML = '<div class="empty-state">No posts found. Use "Post Garbage" to create one.</div>';
      return;
    }

    listEl.innerHTML = posts.map(function (p) {
      var driverInfo   = p.driver_name   ? '<div class="post-meta-row"><i class="fa-solid fa-truck"></i> Driver: <strong>'   + escHtml(p.driver_name)   + '</strong></div>' : '';
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
        +   '<div class="post-meta-row"><i class="fa-solid fa-calendar-day"></i> '   + p.pickup_date + ' &middot; ' + escHtml(p.time_slot) + '</div>'
        +   driverInfo + facilityInfo + bidInfo
        + '</div>'
        + '<div class="post-desc">' + escHtml(p.description) + '</div>'
        + (p.status === 'Pending'
          ? '<div class="post-actions"><button class="btn btn-danger btn-sm" onclick="deletePost(\'' + p.id + '\')">'
          +   '<i class="fa-solid fa-trash-can"></i> Cancel</button></div>'
          : '')
        + '</div>';
    }).join('');
  };

  window.deletePost = function (id) {
    if (!confirm('Cancel this garbage request?')) return;
    var posts = getPosts().filter(function (p) { return p.id !== id; });
    savePosts(posts);
    showToast('<i class="fa-solid fa-circle-info"></i> Request cancelled.', 'info');
    renderMyPosts();
    loadOverview();
  };

})();
