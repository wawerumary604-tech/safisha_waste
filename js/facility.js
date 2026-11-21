/* ============================================================
   SAFISHA — Sorting Facility View  (localStorage)
   ============================================================ */

(function () {

  loadFacilityOverview();
  renderIncoming();
  renderBidding();
  renderCompleted();

  // ================================================================
  //  OVERVIEW
  // ================================================================
  function loadFacilityOverview() {
    var posts    = getPosts();
    var atFac    = posts.filter(function (p) { return p.status === 'At Facility'; });
    var done     = posts.filter(function (p) { return p.bid_winner; });
    var active   = atFac.filter(function (p) { return p.starting_bid && !p.bid_winner; });
    var totalBid = atFac.reduce(function (s, p) { return s + (p.starting_bid ? Number(p.starting_bid) : 0); }, 0);

    document.getElementById('fac-incoming').textContent    = atFac.length;
    document.getElementById('fac-active-bids').textContent = active.length;
    document.getElementById('fac-completed').textContent   = done.length;
    document.getElementById('fac-total-bid').textContent   = 'KES ' + totalBid.toLocaleString();

    var feedEl = document.getElementById('facility-feed');
    var all = atFac.concat(done).sort(function (a, b) {
      return new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at);
    }).slice(0, 8);

    if (!all.length) {
      feedEl.innerHTML = '<div class="empty-state">No waste received yet.</div>';
      return;
    }
    feedEl.innerHTML = all.map(function (p) {
      return '<div class="activity-item">'
        + '<span class="activity-dot dot-facility"></span>'
        + '<span class="activity-text"><strong>' + escHtml(p.waste_type) + '</strong> from '
        + escHtml(p.clientName || '') + ' &mdash; ' + escHtml(p.facility_name || '—') + '</span>'
        + '<span class="activity-time">' + timeAgo(p.sent_at || p.created_at) + '</span>'
        + '</div>';
    }).join('');
  }

  // ================================================================
  //  INCOMING
  // ================================================================
  window.renderIncoming = function () {
    var posts = getPosts().filter(function (p) { return p.status === 'At Facility'; });
    posts.sort(function (a, b) { return new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at); });
    var el = document.getElementById('incoming-list');
    if (!posts.length) { el.innerHTML = '<div class="empty-state">No incoming shipments yet.</div>'; return; }
    el.innerHTML = posts.map(function (p) { return buildCard(p, 'incoming'); }).join('');
  };

  // ================================================================
  //  BIDDING
  // ================================================================
  window.renderBidding = function () {
    var posts = getPosts().filter(function (p) {
      return p.status === 'At Facility' && p.starting_bid && !p.bid_winner;
    });
    posts.sort(function (a, b) { return Number(b.starting_bid) - Number(a.starting_bid); });
    var el = document.getElementById('bidding-list');
    if (!posts.length) { el.innerHTML = '<div class="empty-state">No active bids right now.</div>'; return; }
    el.innerHTML = posts.map(function (p) { return buildCard(p, 'bidding'); }).join('');
  };

  // ================================================================
  //  COMPLETED
  // ================================================================
  window.renderCompleted = function () {
    var posts = getPosts().filter(function (p) { return p.bid_winner; });
    posts.sort(function (a, b) {
      return new Date(b.completed_at || b.sent_at) - new Date(a.completed_at || a.sent_at);
    });
    var el = document.getElementById('completed-list');
    if (!posts.length) { el.innerHTML = '<div class="empty-state">No completed lots yet.</div>'; return; }
    el.innerHTML = posts.map(function (p) { return buildCard(p, 'completed'); }).join('');
  };

  // ================================================================
  //  BUILD CARD
  // ================================================================
  function buildCard(p, view) {
    var bidHtml = '';

    if (view === 'incoming' && p.starting_bid && !p.bid_winner) {
      bidHtml = '<div class="bid-price"><i class="fa-solid fa-gavel"></i> Starting Bid: KES '
        + Number(p.starting_bid).toLocaleString() + '</div>';
    }

    if (view === 'bidding') {
      bidHtml = '<div class="bid-price"><i class="fa-solid fa-gavel"></i> KES '
        + Number(p.starting_bid).toLocaleString() + '</div>'
        + '<form onsubmit="placeBid(event,\'' + p.id + '\')" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">'
        + '<input type="text" placeholder="Your company name" required style="flex:1;min-width:140px;padding:8px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.85rem;">'
        + '<input type="number" placeholder="Bid (KES)" min="' + p.starting_bid + '" required style="width:130px;padding:8px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.85rem;">'
        + '<button type="submit" class="btn btn-primary btn-sm"><i class="fa-solid fa-gavel"></i> Bid</button>'
        + '</form>';
    }

    if (view === 'completed') {
      bidHtml = '<div class="bid-price"><i class="fa-solid fa-trophy"></i> Won: KES '
        + Number(p.winning_bid || p.starting_bid).toLocaleString() + '</div>'
        + '<div class="facility-name"><i class="fa-solid fa-building"></i> Winner: <strong>'
        + escHtml(p.bid_winner || '—') + '</strong></div>';
    }

    var notes = p.driver_notes
      ? '<div style="font-size:.82rem;color:#6b7280;margin-top:4px;"><i class="fa-solid fa-note-sticky"></i> '
        + escHtml(p.driver_notes) + '</div>'
      : '';

    return '<div class="post-card">'
      + '<div class="post-card-header">'
      +   '<div><div class="post-type">' + escHtml(p.waste_type) + '</div>'
      +   '<div class="post-date">Received ' + timeAgo(p.sent_at || p.created_at) + '</div></div>'
      +   statusBadge(p.bid_winner ? 'Completed' : p.status)
      + '</div>'
      + urgencyPill(p.urgency)
      + '<div class="post-meta">'
      +   '<div class="post-meta-row"><i class="fa-solid fa-location-dot"></i> '   + escHtml(p.location)         + '</div>'
      +   '<div class="post-meta-row"><i class="fa-solid fa-weight-hanging"></i> ' + escHtml(p.weight_range)     + '</div>'
      +   '<div class="post-meta-row"><i class="fa-solid fa-industry"></i> '       + escHtml(p.facility_name || '—') + '</div>'
      +   '<div class="post-meta-row"><i class="fa-solid fa-truck"></i> Driver: '  + escHtml(p.driver_name  || '—') + '</div>'
      +   '<div class="post-meta-row"><i class="fa-solid fa-user"></i> Client: '   + escHtml(p.clientName   || '—') + '</div>'
      + '</div>'
      + notes
      + bidHtml
      + (view === 'incoming' && !p.starting_bid
        ? '<div class="post-actions"><button class="btn btn-warning btn-sm">'
        +   '<i class="fa-solid fa-clock"></i> Awaiting Bid</button></div>'
        : '')
      + '</div>';
  }

  // ================================================================
  //  PLACE BID
  // ================================================================
  window.placeBid = function (e, postId) {
    e.preventDefault();
    var inputs  = e.target.querySelectorAll('input');
    var company = inputs[0].value.trim();
    var amount  = inputs[1].value;

    var posts = getPosts();
    var post  = posts.find(function (p) { return p.id === postId; });
    if (!post) return;

    post.bid_winner  = company;
    post.winning_bid = amount;
    post.completed_at = new Date().toISOString();
    savePosts(posts);

    showToast('<i class="fa-solid fa-trophy"></i> Bid placed by ' + escHtml(company) + '!', 'success');
    loadFacilityOverview();
    renderIncoming();
    renderBidding();
    renderCompleted();
  };

})();
