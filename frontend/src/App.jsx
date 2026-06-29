import { useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_ADMIN_API_BASE || 'http://localhost:4100';
const DEBUG = import.meta.env.VITE_ADMIN_DEBUG === 'true';

const LIST_TABS = [
  ['prebookings', 'Pre-bookings'],
  ['notify', 'Notify-Me'],
  ['newsletter', 'Newsletter'],
  ['contacts', 'Contacts'],
  ['oem', 'OEM'],
  ['orders', 'Orders'],
  ['users', 'Users'],
];

function debugLog(event, payload = {}) {
  if (!DEBUG) return;
  console.debug(`[visthar-admin] ${event}`, payload);
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => (
    /password|token|secret|authorization|cookie/i.test(key)
      ? [key, '[redacted]']
      : [key, redact(item)]
  )));
}

function summarizeBody(body) {
  if (body instanceof FormData) {
    const fields = {};
    const files = [];
    body.forEach((value, key) => {
      if (value instanceof File) {
        files.push({ field: key, name: value.name, type: value.type, size: value.size });
      } else {
        fields[key] = value;
      }
    });
    return { type: 'FormData', fields: redact(fields), files };
  }

  if (typeof body === 'string') {
    try {
      return redact(JSON.parse(body));
    } catch {
      return '[unparsed string body]';
    }
  }

  return body ? '[body present]' : undefined;
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const id = requestId();
  const startedAt = performance.now();
  debugLog('api.request', {
    requestId: id,
    method: options.method || 'GET',
    path,
    body: summarizeBody(options.body),
  });

  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'x-request-id': id,
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  debugLog('api.response', {
    requestId: id,
    method: options.method || 'GET',
    path,
    status: res.status,
    latencyMs: Math.round(performance.now() - startedAt),
    data: redact(data),
  });
  if (!res.ok) {
    debugLog('api.error', {
      requestId: id,
      method: options.method || 'GET',
      path,
      status: res.status,
      error: data.error || 'Request failed',
    });
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.endsWith('@visthar-lifestyle.com')) {
      setError('Only @visthar-lifestyle.com admins can log in');
      return;
    }

    try {
      setLoading(true);
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={submit}>
        <h1>Visthar Admin</h1>
        <p>Standalone admin console</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@visthar-lifestyle.com" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        {error && <div className="error">{error}</div>}
        <button disabled={loading}>{loading ? 'Signing in...' : 'Login as Admin'}</button>
      </form>
    </div>
  );
}

function Inventory({ refreshTick }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    sku: '',
    slug: '',
    name: '',
    category: 'future-products',
    tagline: '',
    badge: 'NEW',
    price: 0,
    stock: 0,
    status: 'active',
    notes: '',
    features: '',
    specs: '',
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api('/api/admin/inventory');
      setItems(data.items || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [refreshTick]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      imageFiles.forEach((file) => body.append('images', file));
      debugLog('inventory.create.submit', {
        sku: form.sku,
        slug: form.slug,
        imageCount: imageFiles.length,
        files: imageFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
      });

      await api('/api/admin/inventory', { method: 'POST', body });
      setForm({
        sku: '',
        slug: '',
        name: '',
        category: 'future-products',
        tagline: '',
        badge: 'NEW',
        price: 0,
        stock: 0,
        status: 'active',
        notes: '',
        features: '',
        specs: '',
      });
      setImageFiles([]);
      setFileInputKey((value) => value + 1);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStock = async (id, nextStock) => {
    try {
      await api(`/api/admin/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ stock: Number(nextStock) }),
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeItem = async (id) => {
    try {
      await api(`/api/admin/inventory/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2>Inventory Management</h2>
      <form className="grid" onSubmit={create}>
        <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
        <input placeholder="Product slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Category slug" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input placeholder="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        <input placeholder="Badge" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
        <input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        <input placeholder="Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
        <input placeholder="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <input placeholder="Features, comma separated" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
        <input placeholder='Specs JSON, e.g. {"Power":"65W"}' value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} />
        <input
          key={fileInputKey}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
        />
        <button>Create Item</button>
      </form>
      {error && <div className="error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Images</th><th>SKU</th><th>Name</th><th>Stock</th><th>Price</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  <div className="thumbs">
                    {(it.images || []).slice(0, 3).map((image) => (
                      <img key={image.key || image.url} src={image.url} alt={it.name} />
                    ))}
                  </div>
                </td>
                <td>{it.sku}</td>
                <td>{it.name}</td>
                <td>
                  <input
                    className="small"
                    type="number"
                    defaultValue={it.stock}
                    onBlur={(e) => updateStock(it.id, e.target.value)}
                  />
                </td>
                <td>{it.price}</td>
                <td>{it.status}</td>
                <td><button className="danger" onClick={() => removeItem(it.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminApp({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ email: '', phone: '', address: '', hq: '', instagram: '', twitter: '', youtube: '', linkedin: '', company: '' });
  const [activeList, setActiveList] = useState('prebookings');
  const [listData, setListData] = useState([]);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const activeListLabel = useMemo(() => LIST_TABS.find(([id]) => id === activeList)?.[1] || activeList, [activeList]);

  const loadStats = async () => {
    try {
      const data = await api('/api/admin/stats');
      setStats(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api('/api/admin/site-settings');
      setSettings({ ...settings, ...(data.settings || {}) });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const loadList = async (name) => {
    try {
      const data = await api(`/api/admin/list/${name}`);
      setListData(data.items || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { loadStats(); loadSettings(); }, [refreshTick]);
  useEffect(() => { loadList(activeList); }, [activeList, refreshTick]);

  const saveSettings = async () => {
    try {
      await api('/api/admin/site-settings', { method: 'PUT', body: JSON.stringify(settings) });
      setRefreshTick((v) => v + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    onLogout();
  };

  return (
    <div className="layout">
      <aside className="sidebar card">
        <h2>Admin Console</h2>
        <div className="sub">{user.email}</div>
        <button onClick={() => setRefreshTick((v) => v + 1)}>Refresh</button>
        <button onClick={logout}>Logout</button>
      </aside>
      <main className="main">
        {error && <div className="error">{error}</div>}

        <section className="card stats">
          <h2>Dashboard Stats</h2>
          <div className="chips">
            {stats && Object.entries(stats).map(([k, v]) => (
              <div key={k} className="chip"><span>{k}</span><strong>{String(v)}</strong></div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Contact / Site Settings</h2>
          <div className="grid">
            {Object.keys(settings).map((key) => (
              <input
                key={key}
                placeholder={key}
                value={settings[key] || ''}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              />
            ))}
          </div>
          <button onClick={saveSettings}>Save Settings</button>
        </section>

        <section className="card">
          <h2>Operational Lists: {activeListLabel}</h2>
          <div className="tabs">
            {LIST_TABS.map(([id, label]) => (
              <button key={id} className={id === activeList ? 'active' : ''} onClick={() => setActiveList(id)}>{label}</button>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(listData[0] ? Object.keys(listData[0]).slice(0, 7) : ['No data']).map((k) => <th key={k}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {listData.length === 0 ? (
                  <tr><td colSpan={7}>No records</td></tr>
                ) : listData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(row).slice(0, 7).map((k) => <td key={k}>{typeof row[k] === 'object' ? JSON.stringify(row[k]).slice(0, 80) : String(row[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Inventory refreshTick={refreshTick} />
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/auth/me');
        setUser(data.user || null);
      } catch {
        setUser(null);
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  if (!checked) return <div className="auth-wrap"><div className="card">Loading...</div></div>;
  if (!user) return <LoginScreen onLogin={setUser} />;
  return <AdminApp user={user} onLogout={() => setUser(null)} />;
}
