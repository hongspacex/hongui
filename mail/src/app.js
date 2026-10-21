(() => {
  const DOMAIN = 'hongspaces.com';
  const $ = (id) => document.getElementById(id);
  const state = { local: '', token: '', messages: [], selected: null, timer: null };

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._x);
    toast._x = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem('hongui_mail_v1') || '{}'); }
    catch { return {}; }
  }
  function saveStore(s) { localStorage.setItem('hongui_mail_v1', JSON.stringify(s)); }

  function setLocal(local) {
    state.local = local;
    $('local').textContent = local;
    const store = loadStore();
    store.local = local;
    store.tokens = store.tokens || {};
    state.token = store.tokens[local] || '';
    saveStore(store);
    if (state.token) {
      try {
        document.cookie = 'mb_' + encodeURIComponent(local) + '=' + encodeURIComponent(state.token) + '; Path=/; Max-Age=86400; SameSite=Lax; Secure';
      } catch {}
    }
    history.replaceState(null, '', '/#' + encodeURIComponent(local));
  }

  function headers(extra) {
    const h = Object.assign({ 'content-type': 'application/json' }, extra || {});
    if (state.token) h['x-mailbox-token'] = state.token;
    return h;
  }

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch(path, Object.assign({}, opts, { headers: headers(opts.headers) }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function setListening(mode, text) {
    $('dot').className = 'dot' + (mode === 'warn' ? ' warn' : mode === 'off' ? ' off' : '');
    $('statusText').textContent = text;
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }); }
    catch { return ''; }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function fmtListTime(ts) {
    try {
      const d = new Date(ts);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
  }

  function renderList() {
    const list = $('list');
    $('countLabel').textContent = state.messages.length + ' 封';
    if (!state.messages.length) {
      list.innerHTML = '<div class="empty">等待邮件到达…</div>';
      return;
    }
    list.innerHTML = '';
    state.messages.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item' + (state.selected === m.id ? ' active' : '');
      btn.innerHTML =
        '<div class="row">' +
          '<div class="from">' + escapeHtml(m.from_addr || '(未知发件人)') + '</div>' +
          '<div class="when">' + fmtListTime(m.received_at) + '</div>' +
        '</div>';
      btn.addEventListener('click', () => openMsg(m.id));
      list.appendChild(btn);
    });
  }

  async function refresh() {
    try {
      const data = await api('/api/inbox?box=' + encodeURIComponent(state.local));
      state.messages = data.messages || [];
      setListening('on', '正在监听收件… 最近同步 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      renderList();
      if (state.selected && !state.messages.some((m) => m.id === state.selected)) {
        state.selected = null;
        $('reader').innerHTML = '<div class="empty">选择一封邮件查看</div>';
      }
    } catch (e) {
      if (e.status === 401 || (e.data && e.data.needPin)) {
        setListening('warn', '此邮箱已设置 PIN，请先解锁');
        state.messages = [];
        renderList();
      } else if (e.status === 429) setListening('warn', '请求过于频繁，稍后再试');
      else setListening('off', e.message || '同步失败');
    }
  }

  async function openMsg(id) {
    state.selected = id;
    renderList();
    const reader = $('reader');
    reader.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/api/message/' + id + '?box=' + encodeURIComponent(state.local));
      const body = data.html
        ? data.html
        : '<pre style="white-space:pre-wrap;font-family:inherit;margin:0">' + escapeHtml(data.text || '(无正文)') + '</pre>';
      reader.innerHTML =
        '<div class="head"><div class="subj">' + escapeHtml(data.subject || '(无主题)') + '</div>' +
        '<div class="meta"><div>发件人：' + escapeHtml(data.from_addr || '') + '</div>' +
        '<div>时间：' + fmtTime(data.received_at) + '</div>' +
        '<div>收件：' + escapeHtml(data.to_addr || '') + '</div></div></div>' +
        '<div class="body-frame">' + body + '</div>' +
        '<div class="tools"><button type="button" id="btnDelOne">删除此邮件</button></div>';
      $('btnDelOne').onclick = async () => {
        await api('/api/message/' + id + '?box=' + encodeURIComponent(state.local), { method: 'DELETE' });
        state.selected = null;
        toast('已删除');
        reader.innerHTML = '<div class="empty">选择一封邮件查看</div>';
        refresh();
      };
      reader.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { toast(e.message || '打开失败'); }
  }

  function rememberToken(local, token) {
    if (!token) return;
    const store = loadStore();
    store.tokens = store.tokens || {};
    store.tokens[local] = token;
    state.token = token;
    saveStore(store);
    // cookie so <img> cid/proxy requests can authenticate without custom headers
    try {
      document.cookie = 'mb_' + encodeURIComponent(local) + '=' + encodeURIComponent(token) + '; Path=/; Max-Age=86400; SameSite=Lax; Secure';
    } catch {}
  }

  async function boot() {
    const store = loadStore();
    const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    let local = hash || store.local;
    if (!local) {
      const data = await api('/api/claim', { method: 'POST', body: JSON.stringify({}) });
      local = data.local;
      rememberToken(local, data.token);
    }
    setLocal(local);
    await api('/api/claim', { method: 'POST', body: JSON.stringify({ local }) });
    await refresh();
    clearInterval(state.timer);
    state.timer = setInterval(refresh, 5000);
  }

  $('btnCopy').onclick = async () => {
    const addr = state.local + '@' + DOMAIN;
    try { await navigator.clipboard.writeText(addr); toast('已复制 ' + addr); }
    catch { toast(addr); }
  };

  $('btnNew').onclick = async () => {
    const data = await api('/api/claim', { method: 'POST', body: JSON.stringify({}) });
    const store = loadStore();
    store.tokens = store.tokens || {};
    delete store.tokens[state.local];
    saveStore(store);
    state.token = '';
    setLocal(data.local);
    rememberToken(data.local, data.token);
    state.selected = null;
    $('reader').innerHTML = '<div class="empty">选择一封邮件查看</div>';
    toast('已新建邮箱');
    refresh();
  };

  $('btnCustom').onclick = () => { $('customRow').hidden = !$('customRow').hidden; };

  $('btnApplyCustom').onclick = async () => {
    const v = $('customInput').value.trim().toLowerCase().replace(/@.*/, '').replace(/[^a-z0-9._-]/g, '');
    try {
      await api('/api/claim', { method: 'POST', body: JSON.stringify({ local: v }) });
      setLocal(v);
      toast('已切换');
      refresh();
    } catch (e) { toast(e.message || '前缀不可用'); }
  };

  $('btnSetPin').onclick = async () => {
    const pin = $('pinInput').value;
    try {
      const data = await api('/api/pin', { method: 'POST', body: JSON.stringify({ local: state.local, pin }) });
      rememberToken(state.local, data.token);
      $('pinInput').value = '';
      toast(pin ? 'PIN 已设置' : '已取消 PIN');
      refresh();
    } catch (e) { toast(e.message || '设置失败'); }
  };

  $('btnUnlock').onclick = async () => {
    const pin = $('pinInput').value;
    try {
      const data = await api('/api/unlock', { method: 'POST', body: JSON.stringify({ local: state.local, pin }) });
      rememberToken(state.local, data.token);
      $('pinInput').value = '';
      toast('已解锁');
      refresh();
    } catch (e) { toast(e.message || '解锁失败'); }
  };

  $('btnRefresh').onclick = () => refresh();
  $('btnDelAll').onclick = async () => {
    if (!confirm('清空当前收件箱？')) return;
    try {
      await api('/api/inbox?box=' + encodeURIComponent(state.local), { method: 'DELETE' });
      state.selected = null;
      toast('已清空');
      refresh();
    } catch (e) { toast(e.message || '失败'); }
  };

  boot().catch((e) => setListening('off', e.message || '初始化失败'));
})();
