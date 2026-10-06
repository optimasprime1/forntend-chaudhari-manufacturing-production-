document.addEventListener('DOMContentLoaded', loadBetelnutModels);

async function loadBetelnutModels() {
  const grid = document.getElementById('betelnutModelGrid');
  const message = document.getElementById('betelnutModelMessage');

  try {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Products could not be loaded.');

    const body = await response.json();
    const rows = Array.isArray(body) ? body : body.data;
    if (!Array.isArray(rows)) throw new Error('Products API returned an invalid response.');

    const products = rows.filter(product => {
      const category = `${product.category || ''} ${product.categoryId || ''}`.toLowerCase();
      return category.includes('betelnut') || category.includes('supari');
    });

    grid.innerHTML = products.map(product => {
      const id = product.id || product.productId || product.slug || product._id;
      const name = product.name || product.model || id || 'Betelnut Machine';
      const model = product.model || product.productId || id || 'Model unavailable';
      const description = product.short || product.shortDescription || product.description || 'Contact us for product details.';
      const image = resolveCategoryImage(product);
      const detailUrl = `product-detail.html?id=${encodeURIComponent(id)}`;

      return `
        <a class="category-product-card" href="${escapeCategoryValue(detailUrl)}">
          <img src="${escapeCategoryValue(image)}" alt="${escapeCategoryValue(name)}">
          <div class="card-body">
            <h3>${escapeCategoryValue(name)}</h3>
            <span class="category-product-model">${escapeCategoryValue(model)}</span>
            <p>${escapeCategoryValue(description)}</p>
            <span class="btn btn-small">See Details</span>
          </div>
        </a>
      `;
    }).join('');

    message.textContent = products.length
      ? `${products.length} Betelnut machine model${products.length === 1 ? '' : 's'} available.`
      : 'No Betelnut machine models found in MongoDB.';
  } catch (error) {
    grid.innerHTML = '';
    message.textContent = 'Products could not be loaded. Please check that the backend is running.';
    console.error('Betelnut models unavailable.', error);
  }
}

function resolveCategoryImage(product) {
  const modelImages = {
    CRL01: 'assets/images/03196af5-1ff4-436a-9618-dd7680ef54bf.png',
    KRY10: 'assets/images/4a4a47d9-373b-49be-886a-3ea266f3357c.png',
    KTK04: 'assets/images/625b923e-db57-459b-8cfc-a887c485758e.png'
  };
  const model = [product.model, product.productId, product.id, product.slug, product._id]
    .find(value => typeof value === 'string' && modelImages[value.trim().toUpperCase()]);
  if (model) return modelImages[model.trim().toUpperCase()];

  const category = [
    product.category && typeof product.category === 'object'
      ? product.category.name || product.category.categoryName || product.category.categoryId
      : product.category,
    product.categoryId,
    product.categoryName
  ].filter(Boolean).join(' ').toLowerCase();
  if (category.includes('almond')) {
    return 'assets/images/de5fbc53-f5bd-45a6-adb1-28283e892226.png';
  }

  const fallback = 'assets/images/947418eb-9873-41ce-8302-8c2256c72f1d.png';
  const image = product.image || product.featuredImage;
  if (typeof image !== 'string' || !image) return fallback;
  if (/^https?:\/\//i.test(image)) return image;

  const fileName = image.replace(/\\/g, '/').split('/').pop();
  const localImages = new Set([
    '947418eb-9873-41ce-8302-8c2256c72f1d.png',
    'de5fbc53-f5bd-45a6-adb1-28283e892226.png'
  ]);
  return localImages.has(fileName) ? `assets/images/${fileName}` : fallback;
}

function escapeCategoryValue(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}
