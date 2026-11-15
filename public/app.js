// Vibely - Pinterest-inspired pastel social app (vanilla JS single page app)
const root = document.getElementById('app');
let token = localStorage.getItem('token');
let me = localStorage.getItem('username');

/* ================= Helpers ================= */

// Tiny DOM builder. Text is always inserted as text nodes (never HTML), which prevents XSS.
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

// Icons (static, trusted SVG strings only)
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  comment: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};
function icon(name) {
  const s = document.createElement('span');
  s.className = 'ico';
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return s;
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) logout();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function timeAgo(sqlDate) {
  const secs = Math.floor((Date.now() - new Date(sqlDate.replace(' ', 'T') + 'Z')) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

// Picks one of the 6 pastel colors from a name
function pick(key) {
  let n = 0;
  for (const ch of String(key)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n % 6;
}

function avatar(name, big = false) {
  return h('span', { class: `avatar c${pick(name)}${big ? ' lg' : ''}` }, name.charAt(0).toUpperCase());
}

function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

function openModal(content, wide = false) {
  const overlay = h('div', { class: 'overlay' });
  const box = h('div', { class: 'modal' + (wide ? ' wide' : '') },
    h('button', { class: 'close', 'aria-label': 'Close', onclick: () => close() }, icon('x')),
    content);
  overlay.append(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  function onKey(e) { if (e.key === 'Escape') close(); }
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('lock');
  }
  document.addEventListener('keydown', onKey);
  document.body.classList.add('lock');
  document.body.append(overlay);
  return close;
}

function confirmDialog(title, text, label, onConfirm) {
  let close;
  const yes = h('button', { class: 'btn danger', onclick: async () => {
    yes.disabled = true;
    try { await onConfirm(); } catch (err) { toast(err.message); }
    close();
  } }, label);
  close = openModal(h('div', { class: 'dialog' },
    h('h3', {}, title),
    h('p', { class: 'muted' }, text),
    h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => close() }, 'Cancel'), yes)));
}

function saveSession(data) {
  token = data.token;
  me = data.user.username;
  localStorage.setItem('token', token);
  localStorage.setItem('username', me);
}

function logout() {
  token = me = null;
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  location.hash = '';
  route();
}

/* ================= Login / Sign up ================= */

function renderAuth(mode = 'login') {
  const isLogin = mode === 'login';
  const error = h('p', { class: 'error' });
  const username = h('input', { placeholder: 'Username', autocomplete: 'username' });
  const password = h('input', { type: 'password', placeholder: 'Password', autocomplete: isLogin ? 'current-password' : 'new-password' });
  const submit = h('button', { class: 'btn block' }, isLogin ? 'Log in' : 'Create account');

  const form = h('form', { class: 'auth-form', onsubmit: async (e) => {
    e.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    try {
      const data = await api('/auth/' + (isLogin ? 'login' : 'register'), {
        method: 'POST',
        body: { username: username.value, password: password.value },
      });
      saveSession(data);
      location.hash = '#/home';
      route();
    } catch (err) {
      error.textContent = err.message;
      submit.disabled = false;
    }
  } }, username, password, error, submit);

  const floater = (text, c, f) => h('div', { class: `float ${c} ${f}` }, text);

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'logo' }, h('span', { class: 'logo-mark' }, '✦'), h('span', {}, 'Vibely')),
    h('h1', {}, 'Share your ', h('span', { class: 'grad' }, 'vibe'), '.'),
    h('p', {}, 'A cozy corner of the internet to share thoughts, find your people and spread good energy.'),
    h('div', { class: 'floaters' },
      floater('Soft mornings and strong coffee ☕', 'c1', 'f1'),
      floater('New playlist, who dis? 🎧', 'c4', 'f2'),
      floater('Weekend plans: absolutely nothing 🌿', 'c3', 'f3')));

  const side = h('section', { class: 'auth-side' },
    h('div', { class: 'auth-card' },
      h('h2', {}, isLogin ? 'Welcome back 👋' : 'Join Vibely ✨'),
      h('p', { class: 'muted' }, isLogin ? 'Log in to see what your people are posting.' : 'Create your account in 10 seconds.'),
      form,
      h('p', { class: 'switch' }, isLogin ? 'New here? ' : 'Already have an account? ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); renderAuth(isLogin ? 'register' : 'login'); } },
          isLogin ? 'Sign up' : 'Log in'))));

  root.replaceChildren(h('div', { class: 'auth-wrap' }, hero, side));
}

/* ================= Layout ================= */

function renderShell(content, active) {
  const q = h('input', { type: 'search', placeholder: 'Search people', autocomplete: 'off', 'aria-label': 'Search people' });
  const search = h('form', { class: 'searchbar', onsubmit: (e) => {
    e.preventDefault();
    const v = q.value.trim();
    if (v) location.hash = '#/search/' + encodeURIComponent(v);
  } }, icon('search'), q);

  const link = (href, ico, label, key) =>
    h('a', { href, class: 'navlink' + (active === key ? ' active' : '') }, icon(ico), h('span', {}, label));

  const nav = h('nav', { class: 'nav' },
    link('#/home', 'home', 'Home', 'home'),
    link('#/explore', 'compass', 'Explore', 'explore'),
    link('#/u/' + me, 'user', 'Profile', 'profile'),
    h('a', { href: '#', class: 'navlink', onclick: (e) => { e.preventDefault(); logout(); } }, icon('logout'), h('span', {}, 'Logout')));

  const header = h('header', { class: 'topbar' },
    h('a', { class: 'logo', href: '#/home' }, h('span', { class: 'logo-mark' }, '✦'), h('span', { class: 'logo-text' }, 'Vibely')),
    search, nav);

  root.replaceChildren(header, h('main', { class: 'page' }, content));
  window.scrollTo(0, 0);
}

function emptyState(emoji, title, text) {
  return h('div', { class: 'empty' }, h('div', { class: 'emoji' }, emoji), h('h3', {}, title), h('p', {}, text));
}

function skeletons() {
  return [170, 230, 140, 210, 180, 250].map((px) => h('div', { class: 'skeleton', style: `height:${px}px` }));
}

/* ================= Pins (posts) ================= */

async function toggleLike(p, paint) {
  try {
    const r = await api(`/posts/${p.id}/like`, { method: 'POST' });
    p.liked = r.liked;
    p.like_count = r.like_count;
    paint();
  } catch (err) { toast(err.message); }
}

function pinCard(p, reload) {
  const likeBtn = h('button', { 'aria-label': 'Like' });
  const cmtBtn = h('button', { 'aria-label': 'Comments' });

  function paint() {
    likeBtn.className = 'act' + (p.liked ? ' on' : '');
    likeBtn.replaceChildren(icon('heart'), String(p.like_count));
    cmtBtn.className = 'act';
    cmtBtn.replaceChildren(icon('comment'), String(p.comment_count));
  }
  paint();

  likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(p, paint); });
  cmtBtn.addEventListener('click', (e) => { e.stopPropagation(); openPost(p, paint); });

  const actions = h('div', { class: 'pin-actions' }, likeBtn, cmtBtn);
  if (p.username === me) {
    actions.append(h('button', { class: 'act del', 'aria-label': 'Delete post', onclick: (e) => {
      e.stopPropagation();
      confirmDialog('Delete this post?', "This can't be undone.", 'Delete', async () => {
        await api(`/posts/${p.id}`, { method: 'DELETE' });
        toast('Post deleted');
        reload();
      });
    } }, icon('trash')));
  }

  const card = h('article', { class: `pin c${p.id % 6}${p.content.length < 60 ? ' big' : ''}` },
    h('div', { class: 'pin-head' },
      avatar(p.username),
      h('div', {},
        h('a', { class: 'pin-user', href: '#/u/' + p.username, onclick: (e) => e.stopPropagation() }, p.username),
        h('span', { class: 'pin-meta' }, timeAgo(p.created_at)))),
    h('p', { class: 'pin-text' }, p.content),
    actions);

  card.addEventListener('click', () => openPost(p, paint));
  return card;
}

function renderPins(list, posts, empty, reload) {
  if (!posts.length) {
    list.className = '';
    list.replaceChildren(empty);
    return;
  }
  list.className = 'masonry';
  list.replaceChildren(...posts.map((p) => pinCard(p, reload)));
}

function commentRow(c) {
  return h('div', { class: 'comment' },
    avatar(c.username),
    h('div', { class: 'bubble' },
      h('b', {}, c.username), c.content,
      h('div', { class: 'pin-meta' }, timeAgo(c.created_at))));
}

// Pin close-up: post on the left, comments on the right
function openPost(p, paintCard) {
  let close;
  const like = h('button', { 'aria-label': 'Like' });
  const paintLike = () => {
    like.className = 'act' + (p.liked ? ' on' : '');
    like.replaceChildren(icon('heart'), String(p.like_count));
  };
  paintLike();
  like.addEventListener('click', () => toggleLike(p, () => { paintLike(); paintCard(); }));

  const list = h('div', { class: 'comment-list' }, h('p', { class: 'muted' }, 'Loading comments...'));
  const input = h('input', { placeholder: 'Add a comment', maxlength: '200' });
  const form = h('form', { class: 'comment-form', onsubmit: async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    try {
      const c = await api(`/posts/${p.id}/comments`, { method: 'POST', body: { content: text } });
      list.querySelector('.note')?.remove();
      list.append(commentRow(c));
      list.scrollTop = list.scrollHeight;
      input.value = '';
      p.comment_count++;
      paintCard();
    } catch (err) { toast(err.message); }
  } }, input, h('button', { class: 'btn small' }, 'Send'));

  api(`/posts/${p.id}/comments`).then((comments) => {
    list.replaceChildren(...comments.map(commentRow));
    if (!comments.length) list.append(h('p', { class: 'muted note' }, 'No comments yet. Be the first! 💬'));
  }).catch((err) => { list.textContent = err.message; });

  close = openModal(h('div', { class: `post-modal c${p.id % 6}` },
    h('div', { class: 'left' },
      h('div', { class: 'pin-head' }, avatar(p.username),
        h('div', {}, h('a', { class: 'pin-user', href: '#/u/' + p.username, onclick: () => close() }, p.username),
          h('span', { class: 'pin-meta' }, timeAgo(p.created_at)))),
      h('p', { class: 'pin-text' }, p.content)),
    h('div', { class: 'right' },
      h('div', { class: 'row' }, h('b', {}, 'Comments'), like),
      list, form)), true);
}

/* ================= Pages ================= */

function composer(onPosted) {
  const ta = h('textarea', { placeholder: "What's your vibe today?", maxlength: '280', rows: '3' });
  const count = h('span', { class: 'count' }, '0 / 280');
  const err = h('p', { class: 'error' });
  const btn = h('button', { class: 'btn' }, 'Share');
  ta.addEventListener('input', () => { count.textContent = `${ta.value.length} / 280`; });
  btn.addEventListener('click', async () => {
    err.textContent = '';
    btn.disabled = true;
    try {
      await api('/posts', { method: 'POST', body: { content: ta.value } });
      ta.value = '';
      count.textContent = '0 / 280';
      toast('Shared! ✨');
      onPosted();
    } catch (e) { err.textContent = e.message; }
    btn.disabled = false;
  });
  return h('div', { class: 'composer' }, avatar(me),
    h('div', { class: 'composer-main' }, ta, err, h('div', { class: 'row' }, count, btn)));
}

function pageFeed(scope) {
  const isFeed = scope === 'feed';
  const list = h('div', { class: 'masonry' }, ...skeletons());

  async function load() {
    try {
      const posts = await api('/posts?scope=' + scope);
      renderPins(list, posts, isFeed
        ? emptyState('🌸', 'Your feed is quiet', 'Share your first post or follow people from Explore.')
        : emptyState('🌈', 'Nothing here yet', 'Be the first to share a vibe!'), load);
    } catch (err) { list.className = ''; list.textContent = err.message; }
  }

  const content = h('div', {},
    h('h1', { class: 'page-title' }, isFeed ? `Hey ${me} ✨` : 'Discover new vibes 🌈'),
    h('p', { class: 'page-sub' }, isFeed ? 'Here is what your people are up to.' : 'Fresh posts from everyone on Vibely.'),
    h('div', { class: 'tabs' },
      h('a', { href: '#/home', class: 'tab' + (isFeed ? ' on' : '') }, 'Following'),
      h('a', { href: '#/explore', class: 'tab' + (!isFeed ? ' on' : '') }, 'Explore')),
    isFeed ? composer(load) : null,
    list);

  renderShell(content, isFeed ? 'home' : 'explore');
  load();
}

async function pageProfile(username) {
  const content = h('div', {}, h('div', { class: 'masonry' }, ...skeletons()));
  renderShell(content, username === me ? 'profile' : '');
  try {
    const u = await api('/users/' + encodeURIComponent(username));
    const followers = h('b', {}, String(u.followers));
    const bioEl = h('p', { class: 'bio' }, u.bio || (u.is_me ? 'Add a bio to tell people about you.' : 'No bio yet.'));
    const stat = (num, label) => h('div', { class: 'stat' }, num, h('span', {}, label));

    const actions = h('div', {});
    if (u.is_me) {
      actions.append(h('button', { class: 'btn ghost', onclick: () => {
        const ta = h('textarea', { rows: '4', maxlength: '160', placeholder: 'Tell people about you...' });
        ta.value = u.bio;
        let close;
        const save = h('button', { class: 'btn', onclick: async () => {
          try {
            const r = await api('/users/me', { method: 'PUT', body: { bio: ta.value } });
            u.bio = r.bio;
            bioEl.textContent = r.bio || 'Add a bio to tell people about you.';
            toast('Bio updated ✨');
            close();
          } catch (err) { toast(err.message); }
        } }, 'Save');
        close = openModal(h('div', { class: 'dialog' }, h('h3', {}, 'Edit your bio'), h('p', { class: 'muted' }, 'Up to 160 characters.'), ta, h('div', { class: 'row end' }, save)));
      } }, 'Edit bio'));
    } else {
      const followBtn = h('button', { class: u.is_following ? 'btn ghost' : 'btn' }, u.is_following ? 'Following' : 'Follow');
      followBtn.addEventListener('click', async () => {
        try {
          const r = await api(`/users/${encodeURIComponent(u.username)}/follow`, { method: 'POST' });
          followBtn.textContent = r.is_following ? 'Following' : 'Follow';
          followBtn.className = r.is_following ? 'btn ghost' : 'btn';
          followers.textContent = String(r.followers);
        } catch (err) { toast(err.message); }
      });
      actions.append(followBtn);
    }

    const list = h('div', {});
    const reload = () => pageProfile(username);
    renderPins(list, u.posts, emptyState('🫧', 'No posts yet', u.is_me ? 'Share your first vibe from Home.' : 'Check back soon.'), reload);

    content.replaceChildren(
      h('div', { class: `cover c${pick(u.username)}` }),
      h('div', { class: 'profile-card' },
        avatar(u.username, true),
        h('h2', {}, '@' + u.username),
        bioEl,
        h('div', { class: 'stats' },
          stat(String(u.post_count), 'Posts'),
          h('div', { class: 'stat' }, followers, h('span', {}, 'Followers')),
          stat(String(u.following), 'Following')),
        actions),
      list);
  } catch (err) {
    content.replaceChildren(emptyState('🔍', 'Oops', err.message));
  }
}

async function pageSearch(query) {
  const content = h('div', {},
    h('h1', { class: 'page-title' }, `People matching "${query}"`),
    h('p', { class: 'page-sub' }, 'Tap a person to see their profile.'));
  renderShell(content, '');
  try {
    const users = await api('/users/search?q=' + encodeURIComponent(query));
    if (!users.length) return content.append(emptyState('🔍', 'No one found', 'Try a different name.'));
    content.append(h('div', { class: 'people' }, users.map((u) =>
      h('a', { class: `person c${pick(u.username)}`, href: '#/u/' + u.username },
        avatar(u.username),
        h('div', { class: 'info' }, h('b', {}, '@' + u.username), h('span', {}, u.bio || 'No bio yet')),
        h('span', { class: 'btn ghost small' }, 'View')))));
  } catch (err) { content.append(emptyState('😕', 'Something went wrong', err.message)); }
}

/* ================= Router ================= */

function route() {
  if (!token) return renderAuth('login');
  const [, page, arg] = location.hash.split('/');
  const param = arg ? decodeURIComponent(arg) : '';
  if (page === 'explore') return pageFeed('all');
  if (page === 'u' && param) return pageProfile(param);
  if (page === 'search') return pageSearch(param);
  return pageFeed('feed');
}

window.addEventListener('hashchange', route);
route();