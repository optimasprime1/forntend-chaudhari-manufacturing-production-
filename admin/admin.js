(() => {
  'use strict';

  const root = document.getElementById('adminRoot');
  const toastRegion = document.getElementById('toastRegion');
  const perPage = 10;
  let admin = null;
  let activeProductImage = '';
  let productPage = 1;
  let productSearch = '';
  let productCategory = '';
  let searchTimer;

  const routePath = window.location.pathname.replace(/\/+$/, '') || '/admin';
  const apiRoot = API_BASE.replace(/\/+$/, '');
  const apiOrigin = apiRoot.replace(/\/api$/, '');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function safeImage(value) {
    const image = String(value || '');
    if (/^https?:\/\//i.test(image) || image.startsWith('/photos/') || image.startsWith('/assets/')) return image;
    return '';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function toast(message, isError = false) {
    const item = document.createElement('div');
    item.className = `toast${isError ? ' error' : ''}`;
    item.textContent = message;
    toastRegion.append(item);
    window.setTimeout(() => item.remove(), 3800);
  }

  function noticeAfterNavigation(message) {
    window.sessionStorage.setItem('adminNotice', message);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store'
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      if (response.ok) throw new Error('The server returned an invalid response.');
    }
    if (!response.ok) {
      if (response.status === 401 && routePath !== '/admin/login' && !path.startsWith('/admin/login')) {
        window.location.replace('/admin/login');
      }
      throw new Error(body.message || 'Something went wrong. Please try again.');
    }
    return body;
  }

  function showLoading(message = 'Loading...') {
    root.innerHTML = `<div class="loading-state"><span class="spinner"></span>${escapeHtml(message)}</div>`;
  }

  function sidebarLink(href, label, icon, selected) {
    return `<a class="side-link${selected ? ' active' : ''}" href="${href}"><span class="nav-icon">${icon}</span>${label}</a>`;
  }

  function renderShell(title, subtitle, selected, content) {
    const initials = String(admin.name || admin.email).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    root.innerHTML = `
      <div class="shell" id="adminShell">
        <aside class="sidebar">
          <a class="brand" href="/admin/dashboard"><span class="brand-mark">C</span><span><span class="brand-name">Chaudhari Manufacturing</span><span class="brand-caption">ADMIN PANEL</span></span></a>
          <p class="nav-label">WORKSPACE</p>
          <nav class="side-nav" aria-label="Admin navigation">
            ${sidebarLink('/admin/dashboard', 'Dashboard', '▦', selected === 'dashboard')}
            ${sidebarLink('/admin/products', 'Products', '◇', selected === 'products')}
            ${sidebarLink('/admin/categories', 'Categories', '▤', selected === 'categories')}
            ${sidebarLink('/admin/settings', 'Settings', '⚙', selected === 'settings')}
          </nav>
          <div class="sidebar-bottom"><button class="side-link side-logout" id="sidebarLogout"><span class="nav-icon">↪</span>Logout</button></div>
        </aside>
        <section class="main-area">
          <header class="topbar">
            <div class="topbar-left"><button class="menu-toggle" id="menuToggle" aria-label="Toggle navigation">☰</button><div><h1 class="page-title">${escapeHtml(title)}</h1><p class="page-subtitle">${escapeHtml(subtitle)}</p></div></div>
            <div class="topbar-right"><a class="icon-button" href="/index.html" target="_blank" rel="noopener" title="View website" aria-label="View website">↗</a>
              <div class="admin-menu"><button class="admin-menu-toggle" id="adminMenuToggle" aria-expanded="false" aria-haspopup="true"><span class="admin-chip"><span class="avatar">${escapeHtml(initials)}</span><span><span class="admin-chip-name">${escapeHtml(admin.name)}</span><span class="admin-chip-role">Administrator</span></span><span class="menu-caret">⌄</span></span></button>
                <div class="admin-menu-panel" id="adminMenuPanel" hidden><a href="/admin/settings">Account settings</a><button id="headerLogout">Logout</button></div>
              </div>
            </div>
          </header>
          <div class="content">${content}</div>
        </section>
      </div>`;
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('adminShell').classList.toggle('sidebar-open');
    });
    const menuButton = document.getElementById('adminMenuToggle');
    const menuPanel = document.getElementById('adminMenuPanel');
    const shell = document.getElementById('adminShell');
    shell.addEventListener('click', event => {
      if (event.target === shell) shell.classList.remove('sidebar-open');
      if (event.target instanceof Element && !event.target.closest('.admin-menu')) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuPanel.hidden = true;
      }
    });
    document.getElementById('sidebarLogout').addEventListener('click', logout);
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      menuPanel.hidden = isOpen;
    });
    document.getElementById('headerLogout').addEventListener('click', logout);
  }

  async function confirmAction(title, message, actionLabel = 'Delete') {
    const dialog = document.getElementById('confirmDialog');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const submit = document.getElementById('confirmSubmit');
    submit.textContent = actionLabel;
    submit.classList.toggle('button-danger', actionLabel === 'Delete');
    submit.classList.toggle('button-primary', actionLabel !== 'Delete');
    dialog.showModal();
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
  }

  async function logout() {
    try {
      await api('/admin/logout', { method: 'POST' });
    } finally {
      window.location.replace('/admin/login');
    }
  }

  function renderLogin() {
    root.innerHTML = `
      <section class="login-page">
        <div class="login-visual">
          <a class="brand" href="/index.html"><span class="brand-mark">C</span><span><span class="brand-name">Chaudhari Manufacturing</span><span class="brand-caption">ADMIN PANEL</span></span></a>
          <div class="login-message"><p class="eyebrow">ADMINISTRATION</p><h1>Manage your catalog with confidence.</h1><p>A secure workspace for your product portfolio, categories, and account settings.</p></div>
          <p class="login-foot">© ${new Date().getFullYear()} Chaudhari Manufacturing</p>
        </div>
        <div class="login-form-side">
          <form class="login-form" id="loginForm">
            <h2>Welcome back</h2><p>Sign in to your administration account.</p>
            <div class="field"><label for="loginEmail">Email address</label><input id="loginEmail" type="email" autocomplete="username" required placeholder="name@company.com"></div>
            <div class="field"><label for="loginPassword">Password</label><div class="password-wrap"><input id="loginPassword" type="password" autocomplete="current-password" required><button class="password-toggle" type="button" id="passwordToggle">Show</button></div></div>
            <button class="button button-primary login-submit" type="submit">Sign in</button><p class="login-error" id="loginError" role="alert"></p>
          </form>
        </div>
      </section>`;
    const password = document.getElementById('loginPassword');
    document.getElementById('passwordToggle').addEventListener('click', event => {
      password.type = password.type === 'password' ? 'text' : 'password';
      event.currentTarget.textContent = password.type === 'password' ? 'Show' : 'Hide';
    });
    document.getElementById('loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const error = document.getElementById('loginError');
      button.disabled = true;
      button.textContent = 'Signing in...';
      error.textContent = '';
      try {
        await api('/admin/login', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('loginEmail').value.trim(),
            password: password.value
          })
        });
        noticeAfterNavigation('Login successful');
        window.location.replace('/admin/dashboard');
      } catch (exception) {
        error.textContent = exception.message || 'Unable to sign in.';
      } finally {
        button.disabled = false;
        button.textContent = 'Sign in';
      }
    });
  }

  function imageMarkup(image, name = '') {
    const source = safeImage(image);
    return source
      ? `<img class="product-thumb" src="${escapeHtml(source)}" alt="${escapeHtml(name)}" loading="lazy">`
      : '<span class="product-thumb placeholder" aria-label="No image">◇</span>';
  }

  function productRows(rows, mode = 'dashboard') {
    const includeSpecs = mode === 'products';
    if (!rows.length) return `<tr><td colspan="${includeSpecs ? 10 : 6}"><div class="empty-state">No products found. Add a product or adjust your search.</div></td></tr>`;
    return rows.map(product => `
      <tr>
        <td>${imageMarkup(product.image, product.name)}</td>
        <td><div class="product-cell"><div class="product-name">${escapeHtml(product.name || 'Untitled product')}</div></div></td>
        <td>${escapeHtml(product.model || product.productId || '—')}</td>
        ${includeSpecs ? `<td><span class="category-pill">${escapeHtml(product.category || product.categoryId || 'Uncategorized')}</span></td><td>${escapeHtml(product.average || '—')}</td><td>${escapeHtml(product.motor || '—')}</td><td>${escapeHtml(product.operation || '—')}</td><td>${escapeHtml(product.bodyType || '—')}</td>` : `<td><span class="category-pill">${escapeHtml(product.category || product.categoryId || 'Uncategorized')}</span></td>`}
        <td>${escapeHtml(formatDate(product.createdAt))}</td>
        <td><div class="table-actions"><button class="icon-button" data-view-product="${escapeHtml(product._id || product.id || product.productId)}" title="View" aria-label="View product">⌕</button><a class="icon-button" href="/admin/products/edit/${encodeURIComponent(product._id || product.id || product.productId)}" title="Edit" aria-label="Edit product">✎</a><button class="icon-button danger" data-delete-product="${escapeHtml(product._id || product.id || product.productId)}" title="Delete" aria-label="Delete product">×</button></div></td>
      </tr>`).join('');
  }

  function bindProductActions(container) {
    container.querySelectorAll('[data-delete-product]').forEach(button => {
      button.addEventListener('click', () => deleteProduct(button.dataset.deleteProduct, button));
    });
    container.querySelectorAll('[data-view-product]').forEach(button => {
      button.addEventListener('click', () => viewProduct(button.dataset.viewProduct));
    });
  }

  async function deleteProduct(id, button) {
    if (!(await confirmAction('Delete Product?', 'Are you sure you want to delete this product?'))) return;
    button.disabled = true;
    try {
      await api(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Product deleted successfully');
      if (routePath === '/admin/products') await loadProductsPage();
      else if (routePath === '/admin/dashboard') await loadDashboard();
      else window.location.reload();
    } catch (error) {
      toast(error.message || 'Unable to delete product.', true);
      button.disabled = false;
    }
  }

  async function viewProduct(id) {
    try {
      const result = await api(`/admin/products/${encodeURIComponent(id)}`);
      const product = result.data;
      const detailDialog = document.createElement('dialog');
      detailDialog.className = 'dialog';
      detailDialog.innerHTML = `
        <form method="dialog"><button class="dialog-close" aria-label="Close">×</button>
          <p class="eyebrow">PRODUCT DETAILS</p><h2>${escapeHtml(product.name || product.model)}</h2>
          <p>Model ${escapeHtml(product.model || '—')} · ${escapeHtml(product.category || product.categoryId || 'Uncategorized')}</p>
          <div class="table-wrap"><pre style="max-height:38vh;overflow:auto;padding:12px;border-radius:7px;background:#f5f8f9;font-size:11px;white-space:pre-wrap">${escapeHtml(JSON.stringify(product, null, 2))}</pre></div>
          <div class="dialog-actions"><button type="button" class="button button-secondary" id="copyProductJson">Copy Product JSON</button><a class="button button-primary" href="/admin/products/edit/${encodeURIComponent(product._id || product.id || id)}">Edit Product</a></div>
        </form>`;
      document.body.append(detailDialog);
      detailDialog.showModal();
      detailDialog.addEventListener('close', () => detailDialog.remove(), { once: true });
      detailDialog.querySelector('#copyProductJson').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(product, null, 2));
          toast('Product JSON copied');
        } catch {
          toast('Unable to copy product JSON. Check clipboard permissions.', true);
        }
      });
    } catch (error) {
      toast(error.message || 'Unable to load product details.', true);
    }
  }

  async function loadDashboard() {
    renderShell('Dashboard', 'An overview of your product catalog.', 'dashboard', '<div class="loading-state"><span class="spinner"></span>Loading dashboard...</div>');
    const content = document.querySelector('.content');
    try {
      const result = await api('/admin/dashboard/stats');
      const data = result.data;
      content.innerHTML = `
        <div class="content-heading"><div><h2>Good day, ${escapeHtml(admin.name.split(' ')[0])}</h2><p>Here is what is happening with your catalog today.</p></div><a class="button button-primary" href="/admin/products/add">＋ Add New Product</a></div>
        <div class="stats-grid">
          <article class="stat-card"><span class="stat-icon">◇</span><div class="stat-label">Total Products</div><div class="stat-value">${Number(data.totalProducts) || 0}</div><div class="stat-note">Products in your catalog</div></article>
          <article class="stat-card"><span class="stat-icon">▤</span><div class="stat-label">Total Categories</div><div class="stat-value">${Number(data.totalCategories) || 0}</div><div class="stat-note">Organized product groups</div></article>
          <article class="stat-card"><span class="stat-icon">↗</span><div class="stat-label">Recently Added</div><div class="stat-value">${Number(data.recentlyAddedProducts) || 0}</div><div class="stat-note">Added in the last 30 days</div></article>
          <article class="stat-card"><span class="stat-icon">✓</span><div class="stat-label">Admin Status</div><div class="stat-value" style="font-size:21px">Active</div><div class="stat-note">${escapeHtml(admin.email)}</div></article>
        </div>
        <div class="dashboard-grid">
          <section class="panel table-panel"><div class="panel-header"><div><h3>Recently added products</h3><p>The latest updates to your catalog</p></div><a class="button button-secondary button-small" href="/admin/products">View all</a></div>
            <div class="table-wrap"><table><thead><tr><th>Image</th><th>Product name</th><th>Model</th><th>Category</th><th>Created date</th><th>Actions</th></tr></thead><tbody>${productRows(data.recentProducts || [])}</tbody></table></div>
          </section>
          <div class="panel"><div class="panel-header"><div><h3>Quick actions</h3><p>Common catalog tasks</p></div></div><div class="panel-body">
            <div class="quick-actions"><a class="quick-action" href="/admin/products/add"><span>＋ Add New Product</span><span>›</span></a><a class="quick-action" href="/admin/products"><span>Manage Products</span><span>›</span></a><a class="quick-action" href="/admin/categories"><span>Manage Categories</span><span>›</span></a><a class="quick-action" href="/admin/settings"><span>Settings</span><span>›</span></a></div>
            <div class="admin-status" style="margin-top:16px"><span class="status-dot"></span><span><span class="status-title">Account secured</span><span class="status-note">Signed in as ${escapeHtml(admin.name)}</span></span></div>
          </div></div>
        </div>`;
      bindProductActions(content);
    } catch (error) {
      content.innerHTML = `<div class="panel"><div class="empty-state">${escapeHtml(error.message || 'Unable to load dashboard.')}</div></div>`;
    }
  }

  async function loadProductsPage() {
    renderShell('Products', 'Search, manage, and update your products.', 'products', `
      <div class="content-heading"><div><h2>All products</h2><p>Manage the machines and product details shown on your website.</p></div><a class="button button-primary" href="/admin/products/add">＋ Add New Product</a></div>
      <section class="panel table-panel"><div class="toolbar">
        <label class="search-box"><span class="search-symbol">⌕</span><input id="productSearch" type="search" placeholder="Search name, model, product ID..." value="${escapeHtml(productSearch)}"></label>
        <select id="productCategory"><option value="">All categories</option></select>
      </div><div class="table-wrap"><table><thead><tr><th>Image</th><th>Product name</th><th>Model</th><th>Category</th><th>Average capacity</th><th>Motor</th><th>Operation</th><th>Body type</th><th>Created date</th><th>Actions</th></tr></thead><tbody id="productTable"><tr><td colspan="10"><div class="loading-state"><span class="spinner"></span>Loading products...</div></td></tr></tbody></table></div><div id="productPagination"></div></section>`);
    const search = document.getElementById('productSearch');
    const categorySelect = document.getElementById('productCategory');
    search.addEventListener('input', () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        productSearch = search.value.trim();
        productPage = 1;
        fetchProducts();
      }, 250);
    });
    categorySelect.addEventListener('change', () => {
      productCategory = categorySelect.value;
      productPage = 1;
      fetchProducts();
    });
    try {
      const categories = await api('/admin/categories');
      categorySelect.innerHTML += (categories.data || []).map(category =>
        `<option value="${escapeHtml(category.categoryId)}">${escapeHtml(category.name)}</option>`).join('');
      categorySelect.value = productCategory;
    } catch (error) {
      toast(error.message || 'Unable to load categories.', true);
    }
    await fetchProducts();
  }

  async function fetchProducts() {
    const table = document.getElementById('productTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="10"><div class="loading-state"><span class="spinner"></span>Loading products...</div></td></tr>';
    const params = new URLSearchParams({ page: String(productPage), limit: String(perPage) });
    if (productSearch) params.set('q', productSearch);
    if (productCategory) params.set('category', productCategory);
    try {
      const result = await api(`/admin/products?${params}`);
      table.innerHTML = productRows(result.data || [], 'products');
      bindProductActions(document.querySelector('.content'));
      renderPagination(result.pagination || { page: 1, pages: 1, total: result.count || 0 });
    } catch (error) {
      table.innerHTML = `<tr><td colspan="10"><div class="empty-state">${escapeHtml(error.message || 'Unable to load products.')}</div></td></tr>`;
    }
  }

  function renderPagination(pagination) {
    const target = document.getElementById('productPagination');
    if (!target) return;
    const page = Number(pagination.page) || 1;
    const pages = Number(pagination.pages) || 1;
    const first = Math.max(1, Math.min(page - 2, pages - 4));
    const last = Math.min(pages, first + 4);
    let buttons = `<button class="page-button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>`;
    for (let index = first; index <= last; index += 1) {
      buttons += `<button class="page-button${index === page ? ' active' : ''}" data-page="${index}">${index}</button>`;
    }
    buttons += `<button class="page-button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Next</button>`;
    target.innerHTML = `<div class="pagination"><span>Showing ${pagination.total ? (page - 1) * perPage + 1 : 0}–${Math.min(page * perPage, pagination.total || 0)} of ${pagination.total || 0} products</span><div class="page-buttons">${buttons}</div></div>`;
    target.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
      productPage = Number(button.dataset.page);
      fetchProducts();
    }));
  }

  async function loadProductForm(isEdit, productId) {
    renderShell(isEdit ? 'Edit Product' : 'Add Product', 'Keep your product catalog accurate and up to date.', 'products', '<div class="loading-state"><span class="spinner"></span>Loading product form...</div>');
    const content = document.querySelector('.content');
    let product = {};
    let categories = [];
    try {
      const categoryResponse = await api('/admin/categories');
      categories = categoryResponse.data || [];
      if (isEdit) product = (await api(`/admin/products/${encodeURIComponent(productId)}`)).data;
    } catch (error) {
      content.innerHTML = `<div class="panel"><div class="empty-state">${escapeHtml(error.message || 'Unable to load product form.')}</div></div>`;
      return;
    }
    activeProductImage = product.image || '';
    content.innerHTML = `
      <div class="content-heading"><div><h2>${isEdit ? 'Update product' : 'Create a product'}</h2><p>${isEdit ? 'Edit product information and save your changes.' : 'Enter the details that customers will see in your product catalog.'}</p></div><a class="button button-secondary" href="/admin/products">← Back to products</a></div>
      <form id="productForm">
        <section class="form-card"><h3>Product information</h3><p>Core details and catalog identification.</p>
          <div class="form-grid">
            <div class="field"><label for="name">Product name *</label><input id="name" name="name" required maxlength="160" value="${escapeHtml(product.name || '')}" placeholder="Product name"></div>
            <div class="field"><label for="model">Model *</label><input id="model" name="model" required maxlength="100" value="${escapeHtml(product.model || '')}" placeholder="Model"></div>
            <div class="field"><label for="categoryId">Category *</label><select id="categoryId" name="categoryId" required><option value="">Select Category</option>${categories.map(category => `<option value="${escapeHtml(category.categoryId)}" ${String(category.categoryId).toUpperCase() === String(product.categoryId || '').toUpperCase() ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="productId">Product ID <span class="optional">(defaults to model)</span></label><input id="productId" name="productId" maxlength="120" value="${escapeHtml(product.productId || product.id || '')}" placeholder="Product ID"></div>
            <div class="field"><label for="slug">Slug <span class="optional">(generated when blank)</span></label><input id="slug" name="slug" maxlength="180" value="${escapeHtml(product.slug || '')}" placeholder="product-name-model"></div>
            <div class="field"><label for="operation">Operation *</label><select id="operation" name="operation" required><option value="">Select Operation</option>${['Semiautomatic', 'Automatic', 'Manual'].map(value => `<option ${product.operation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
          </div>
        </section>
        <section class="form-card"><h3>Product specifications</h3><p>Technical details used in the product listing and details.</p>
          <div class="form-grid">
            <div class="field"><label for="average">Average capacity *</label><input id="average" name="average" required maxlength="100" value="${escapeHtml(product.average || '')}" placeholder="15kg/hr."></div>
            <div class="field"><label for="motor">Motor *</label><input id="motor" name="motor" required maxlength="180" value="${escapeHtml(product.motor || '')}" placeholder="0.5 HP motor, single phase"></div>
            <div class="field"><label for="bodyType">Body type *</label><input id="bodyType" name="bodyType" required maxlength="180" value="${escapeHtml(product.bodyType || '')}" placeholder="Metal body & S.S. body cover"></div>
            <div class="field"><label for="keywords">Search keywords <span class="optional">(optional)</span></label><input id="keywords" name="keywords" maxlength="400" value="${escapeHtml(product.keywords || '')}" placeholder="Search terms"></div>
            <div class="field full"><label for="description">Description <span class="optional">(optional)</span></label><textarea id="description" name="description" maxlength="5000" placeholder="Describe this product...">${escapeHtml(product.description || '')}</textarea></div>
          </div>
        </section>
        <section class="form-card"><h3>Product image</h3><p>Upload a product image (JPG, PNG, WebP, or GIF, up to 5 MB).</p>
          <div class="image-upload"><div class="image-preview" id="productImagePreview">${activeProductImage && safeImage(activeProductImage) ? `<img src="${escapeHtml(safeImage(activeProductImage))}" alt="Product image preview">` : 'No image selected'}</div>
            <div class="upload-buttons"><label class="button button-secondary" for="productImageFile">Upload image</label><input id="productImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden><button class="button button-quiet" type="button" id="removeProductImage">Remove image</button></div><span class="upload-hint">The image is stored by the backend and is not embedded in the page.</span>
          </div>
        </section>
        <p id="productFormError" class="form-error" role="alert"></p>
        <div class="form-footer">${isEdit ? '<button type="button" class="button button-secondary" id="copyEditJson">Copy Product JSON</button>' : ''}<a class="button button-quiet" href="/admin/products">Cancel</a><button class="button button-primary" type="submit">${isEdit ? 'Save Changes' : 'Create Product'}</button></div>
      </form>`;
    document.getElementById('name').addEventListener('input', () => {
      const model = document.getElementById('model').value.trim();
      const idField = document.getElementById('productId');
      if (!idField.value || (!isEdit && idField.dataset.auto === 'true')) {
        idField.value = model;
        idField.dataset.auto = 'true';
      }
    });
    document.getElementById('model').addEventListener('input', event => {
      const idField = document.getElementById('productId');
      if (!idField.value || idField.dataset.auto === 'true' || (!isEdit && !idField.value)) {
        idField.value = event.currentTarget.value.trim();
        idField.dataset.auto = 'true';
      }
    });
    document.getElementById('productId').addEventListener('input', event => {
      event.currentTarget.dataset.auto = 'false';
    });
    document.getElementById('removeProductImage').addEventListener('click', () => {
      activeProductImage = '';
      renderImagePreview('');
    });
    document.getElementById('productImageFile').addEventListener('change', uploadProductImage);
    if (isEdit) {
      document.getElementById('copyEditJson').addEventListener('click', async () => {
        try {
          const latest = (await api(`/admin/products/${encodeURIComponent(productId)}`)).data;
          await navigator.clipboard.writeText(JSON.stringify(latest, null, 2));
          toast('Product JSON copied');
        } catch (error) {
          toast(error.message || 'Unable to copy product JSON.', true);
        }
      });
    }
    document.getElementById('productForm').addEventListener('submit', event => saveProduct(event, isEdit, productId));
  }

  function renderImagePreview(image) {
    const preview = document.getElementById('productImagePreview');
    preview.innerHTML = image && safeImage(image) ? `<img src="${escapeHtml(safeImage(image))}" alt="Product image preview">` : 'No image selected';
  }

  async function uploadProductImage(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be 5 MB or smaller.', true);
      input.value = '';
      return;
    }
    const form = new FormData();
    form.append('image', file);
    const button = document.querySelector('label[for="productImageFile"]');
    input.disabled = true;
    button.textContent = 'Uploading...';
    button.setAttribute('aria-disabled', 'true');
    try {
      const result = await api('/admin/uploads', { method: 'POST', body: form });
      activeProductImage = `${apiOrigin}${result.data.image}`;
      renderImagePreview(activeProductImage);
      toast('Image uploaded successfully');
    } catch (error) {
      toast(error.message || 'Image upload failed.', true);
    } finally {
      button.textContent = 'Upload image';
      button.removeAttribute('aria-disabled');
      input.disabled = false;
      input.value = '';
    }
  }

  async function saveProduct(event, isEdit, productId) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const error = document.getElementById('productFormError');
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.image = activeProductImage;
    if (!payload.productId) payload.productId = payload.model;
    if (!payload.slug) payload.slug = `${payload.name}-${payload.model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    for (const field of ['name', 'model', 'categoryId', 'average', 'motor', 'operation', 'bodyType']) {
      payload[field] = String(payload[field] || '').trim();
    }
    button.disabled = true;
    button.textContent = isEdit ? 'Saving product...' : 'Creating product...';
    error.textContent = '';
    try {
      await api(isEdit ? `/admin/products/${encodeURIComponent(productId)}` : '/admin/products', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      noticeAfterNavigation(isEdit ? 'Product updated successfully' : 'Product added successfully');
      window.location.assign('/admin/products');
    } catch (exception) {
      error.textContent = exception.message || 'Unable to save product.';
      toast(error.textContent, true);
      button.disabled = false;
      button.textContent = isEdit ? 'Save Changes' : 'Create Product';
    }
  }

  async function loadCategoriesPage() {
    renderShell('Categories', 'Organize products into customer-facing categories.', 'categories', '<div class="loading-state"><span class="spinner"></span>Loading categories...</div>');
    const content = document.querySelector('.content');
    try {
      const result = await api('/admin/categories');
      const categories = result.data || [];
      content.innerHTML = `
        <div class="content-heading"><div><h2>All categories</h2><p>Categories connect directly to existing products in your catalog.</p></div><button class="button button-primary" id="addCategory">＋ Add Category</button></div>
        <section class="panel table-panel"><div class="table-wrap"><table><thead><tr><th>Category image</th><th>Category name</th><th>Category ID</th><th>Total products</th><th>Created date</th><th>Actions</th></tr></thead><tbody>
          ${categories.length ? categories.map(category => `<tr><td>${imageMarkup(category.image, category.name)}</td><td><strong>${escapeHtml(category.name)}</strong></td><td>${escapeHtml(category.categoryId)}</td><td>${Number(category.totalProducts) || 0}</td><td>${escapeHtml(formatDate(category.createdAt))}</td><td><div class="table-actions"><button class="icon-button" data-edit-category="${escapeHtml(category._id)}" title="Edit" aria-label="Edit category">✎</button><button class="icon-button danger" data-delete-category="${escapeHtml(category._id)}" title="Delete" aria-label="Delete category">×</button></div></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">No categories found. Add a category to get started.</div></td></tr>'}
        </tbody></table></div></section>`;
      document.getElementById('addCategory').addEventListener('click', () => openCategoryForm());
      content.querySelectorAll('[data-edit-category]').forEach(button => button.addEventListener('click', () => {
        const category = categories.find(item => String(item._id) === button.dataset.editCategory);
        if (category) openCategoryForm(category);
      }));
      content.querySelectorAll('[data-delete-category]').forEach(button => button.addEventListener('click', () => deleteCategory(button.dataset.deleteCategory, button)));
    } catch (error) {
      content.innerHTML = `<div class="panel"><div class="empty-state">${escapeHtml(error.message || 'Unable to load categories.')}</div></div>`;
    }
  }

  function openCategoryForm(category = null) {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    let image = category?.image || '';
    dialog.innerHTML = `
      <form method="dialog" id="categoryForm" novalidate>
        <button class="dialog-close" type="button" aria-label="Close">×</button>
        <p class="eyebrow">PRODUCT CATALOG</p><h2>${category ? 'Edit category' : 'Add category'}</h2>
        <p>${category ? 'Update category details. Linked products will stay associated.' : 'Create a category for organizing products.'}</p>
        <div class="field"><label for="categoryName">Category name *</label><input id="categoryName" required maxlength="100" value="${escapeHtml(category?.name || '')}" placeholder="Almond"></div>
        <div class="field" style="margin-top:13px"><label for="categoryId">Category ID *</label><input id="categoryId" required maxlength="50" value="${escapeHtml(category?.categoryId || '')}" placeholder="ALMOND"></div>
        <div class="field" style="margin-top:13px"><label for="categoryDescription">Description</label><textarea id="categoryDescription" maxlength="2000" placeholder="Category description...">${escapeHtml(category?.description || '')}</textarea></div>
        <div class="field" style="margin-top:13px"><label>Category image</label><div class="image-upload"><div class="image-preview" id="categoryImagePreview">${image && safeImage(image) ? `<img src="${escapeHtml(safeImage(image))}" alt="Category preview">` : 'No image selected'}</div><div class="upload-buttons"><label class="button button-secondary" for="categoryImageFile">Upload image</label><input id="categoryImageFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden><button id="removeCategoryImage" type="button" class="button button-quiet">Remove image</button></div></div></div>
        <p class="form-error" id="categoryFormError" role="alert"></p>
        <div class="dialog-actions"><button type="button" class="button button-quiet" id="cancelCategory">Cancel</button><button class="button button-primary" type="submit">${category ? 'Save Category' : 'Create Category'}</button></div>
      </form>`;
    document.body.append(dialog);
    dialog.showModal();
    const close = () => { if (dialog.open) dialog.close(); };
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('.dialog-close').addEventListener('click', close);
    dialog.querySelector('#cancelCategory').addEventListener('click', close);
    dialog.querySelector('#removeCategoryImage').addEventListener('click', () => {
      image = '';
      dialog.querySelector('#categoryImagePreview').textContent = 'No image selected';
    });
    dialog.querySelector('#categoryImageFile').addEventListener('change', async event => {
      const input = event.currentTarget;
      const file = input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast('Image must be 5 MB or smaller.', true);
        input.value = '';
        return;
      }
      const form = new FormData();
      form.append('image', file);
      try {
        const result = await api('/admin/uploads', { method: 'POST', body: form });
        image = `${apiOrigin}${result.data.image}`;
        dialog.querySelector('#categoryImagePreview').innerHTML = `<img src="${escapeHtml(image)}" alt="Category preview">`;
        toast('Image uploaded successfully');
      } catch (error) {
        toast(error.message || 'Image upload failed.', true);
      }
      input.value = '';
    });
    dialog.querySelector('#categoryForm').addEventListener('submit', async event => {
      event.preventDefault();
      const button = dialog.querySelector('button[type="submit"]');
      const formError = dialog.querySelector('#categoryFormError');
      button.disabled = true;
      button.textContent = category ? 'Saving...' : 'Creating...';
      const payload = {
        name: dialog.querySelector('#categoryName').value.trim(),
        categoryId: dialog.querySelector('#categoryId').value.trim(),
        description: dialog.querySelector('#categoryDescription').value.trim(),
        image
      };
      try {
        await api(category ? `/admin/categories/${encodeURIComponent(category._id)}` : '/admin/categories', {
          method: category ? 'PUT' : 'POST',
          body: JSON.stringify(payload)
        });
        close();
        toast(category ? 'Category updated successfully' : 'Category added successfully');
        await loadCategoriesPage();
      } catch (error) {
        formError.textContent = error.message || 'Unable to save category.';
        button.disabled = false;
        button.textContent = category ? 'Save Category' : 'Create Category';
      }
    });
  }

  async function deleteCategory(id, button) {
    if (!(await confirmAction('Delete Category?', 'Are you sure you want to delete this category? Categories with linked products cannot be deleted.'))) return;
    button.disabled = true;
    try {
      await api(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Category deleted successfully');
      await loadCategoriesPage();
    } catch (error) {
      toast(error.message || 'Unable to delete category.', true);
      button.disabled = false;
    }
  }

  async function loadSettings() {
    renderShell('Settings', 'Manage your admin account and security.', 'settings', '<div class="loading-state"><span class="spinner"></span>Loading account settings...</div>');
    const content = document.querySelector('.content');
    content.innerHTML = `
      <div class="content-heading"><div><h2>Account settings</h2><p>Your profile and access security.</p></div></div>
      <div class="settings-grid">
        <section class="panel"><div class="panel-header"><div><h3>Admin account</h3><p>Account details and status</p></div></div><div class="panel-body">
          <dl class="detail-list">
            <div class="detail-item"><dt>Admin name</dt><dd>${escapeHtml(admin.name)}</dd></div>
            <div class="detail-item"><dt>Admin email</dt><dd>${escapeHtml(admin.email)}</dd></div>
            <div class="detail-item"><dt>Role</dt><dd>${escapeHtml(admin.role || 'admin')}</dd></div>
            <div class="detail-item"><dt>Account status</dt><dd class="status-active">${admin.isActive ? 'Active' : 'Inactive'}</dd></div>
            <div class="detail-item"><dt>Created date</dt><dd>${escapeHtml(formatDate(admin.createdAt))}</dd></div>
            <div class="detail-item"><dt>Last login</dt><dd>${escapeHtml(formatDate(admin.lastLoginAt))}</dd></div>
          </dl>
        </div></section>
        <section class="panel"><div class="panel-header"><div><h3>Change password</h3><p>Use a unique password with at least 12 characters.</p></div></div><div class="panel-body">
          <form id="passwordForm">
            <div class="field"><label for="currentPassword">Current password</label><input id="currentPassword" type="password" autocomplete="current-password" required></div>
            <div class="field" style="margin-top:14px"><label for="newPassword">New password</label><input id="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
            <div class="field" style="margin-top:14px"><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>
            <p class="form-error" id="passwordError" role="alert"></p><button class="button button-primary" type="submit">Update Password</button>
          </form>
        </div></section>
      </div>`;
    document.getElementById('passwordForm').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      const error = document.getElementById('passwordError');
      const newPassword = document.getElementById('newPassword').value;
      if (newPassword !== document.getElementById('confirmPassword').value) {
        error.textContent = 'New passwords do not match.';
        return;
      }
      button.disabled = true;
      button.textContent = 'Updating password...';
      error.textContent = '';
      try {
        const result = await api('/admin/change-password', {
          method: 'PUT',
          body: JSON.stringify({
            currentPassword: document.getElementById('currentPassword').value,
            newPassword,
            confirmPassword: document.getElementById('confirmPassword').value
          })
        });
        noticeAfterNavigation(result.message || 'Password changed successfully');
        window.location.replace('/admin/login');
      } catch (exception) {
        error.textContent = exception.message || 'Unable to change password.';
        button.disabled = false;
        button.textContent = 'Update Password';
      }
    });
  }

  async function start() {
    const notice = window.sessionStorage.getItem('adminNotice');
    if (notice) {
      window.sessionStorage.removeItem('adminNotice');
      toast(notice);
    }
    if (routePath === '/admin/login') {
      try {
        await api('/admin/me');
        window.location.replace('/admin/dashboard');
        return;
      } catch (error) {
        renderLogin();
        return;
      }
    }
    try {
      admin = (await api('/admin/me')).data;
    } catch {
      window.location.replace('/admin/login');
      return;
    }
    if (routePath === '/admin' || routePath === '/admin/dashboard') return loadDashboard();
    if (routePath === '/admin/products') return loadProductsPage();
    if (routePath === '/admin/products/add') return loadProductForm(false, '');
    const editMatch = routePath.match(/^\/admin\/products\/edit\/([^/]+)$/);
    if (editMatch) return loadProductForm(true, decodeURIComponent(editMatch[1]));
    if (routePath === '/admin/categories') return loadCategoriesPage();
    if (routePath === '/admin/settings') return loadSettings();
    window.location.replace('/admin/dashboard');
  }

  start();
})();
