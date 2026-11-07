document.addEventListener('DOMContentLoaded', loadProductDetail);

async function loadProductDetail() {
  const message = document.getElementById('productDetailMessage');
  const content = document.getElementById('productDetailContent');
  const productId = new URLSearchParams(window.location.search).get('id');

  if (!productId) {
    showProductError(message, content, 'Product not found.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}`);
    if (!response.ok) {
      if (response.status === 404) throw new Error('Product not found.');
      throw new Error('Product details could not be loaded.');
    }

    const body = await response.json();
    const product = body.data || body;
    const name = product.name || product.model || 'Product';
    const image = resolveProductImage(product);
    document.title = `${name} | Chaudhari Manufacturing`;
    document.getElementById('productDetailCategory').textContent = 'PRODUCT DETAILS';
    document.getElementById('productDetailName').textContent = name;
    const modelElement = document.getElementById('productDetailModel');
    modelElement.textContent = product.model ? `Model: ${product.model}` : '';
    modelElement.hidden = !product.model;
    document.getElementById('productDetailDescription').textContent =
      product.description || product.short || 'Product description is not available.';

    const imageElement = document.getElementById('productDetailImage');
    imageElement.src = image;
    imageElement.alt = name;
    imageElement.onerror = () => {
      imageElement.onerror = null;
      imageElement.src = fallbackProductImage(product);
    };

    renderSpecifications(product);
    document.getElementById('productDetailQuote').href =
      `enquiry.html?product=${encodeURIComponent(name)}`;
    message.hidden = true;
    content.hidden = false;
  } catch (error) {
    showProductError(message, content, error.message);
    console.error('Product detail unavailable.', error);
  }
}

function renderSpecifications(product) {
  const category = [
    product.category,
    product.categoryId,
    product.categoryName
  ].map(value => {
    if (value && typeof value === 'object') {
      return `${value.name || ''} ${value.categoryName || ''} ${value.categoryId || ''}`;
    }
    return String(value || '');
  }).join(' ').toLowerCase();

  if (category.includes('betelnut') || category.includes('supari')) {
    renderBetelnutSpecifications(product);
    return;
  }

  const excluded = new Set([
    'id', 'v', 'createdat', 'updatedat', 'name', 'description',
    'short', 'image', 'images', 'featuredimage', 'imageurl', 'keywords',
    'productid', 'category', 'categoryid', 'categoryname', 'price',
    'baseprice', 'packingcharges', 'transportcharges', 'gstpercentage', 'art',
    'tags', 'active', 'isactive'
  ]);
  const rows = [
    renderPriceBreakdown(product),
    ...Object.entries(product)
    .filter(([key, value]) =>
      !excluded.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase()) &&
      value !== undefined && value !== null && value !== ''
    )
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, character => character.toUpperCase());
      const displayValue = formatSpecificationValue(value);
      return `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(displayValue)}</span></div>`;
    })
  ].join('');

  document.getElementById('productDetailSpecs').innerHTML =
    rows || '<div><strong>Details</strong><span>Contact us for complete specifications.</span></div>';
}

function renderBetelnutSpecifications(product) {
  const specifications = product.specifications && typeof product.specifications === 'object'
    ? product.specifications
    : {};
  const allowedFields = [
    { label: 'Price', keys: ['price'] },
    { label: 'Model', keys: ['model'] },
    { label: 'Average', keys: ['average', 'avg'] },
    { label: 'Motor', keys: ['motor'] },
    { label: 'Operation', keys: ['operation'] },
    { label: 'Body Type', keys: ['bodytype'] }
  ];
  const rows = allowedFields
    .map(field => {
      const value = findSpecificationValue(field.keys, product, specifications);
      if (field.label === 'Price') {
        return renderPriceBreakdown(product, value);
      }
      if (value === undefined || value === null || value === '') return '';
      const displayValue = formatSpecificationValue(value);
      return `<div><strong>${escapeHtml(field.label)}</strong><span>${escapeHtml(displayValue)}</span></div>`;
    })
    .filter(Boolean)
    .join('');

  document.getElementById('productDetailSpecs').innerHTML =
    rows || '<div><strong>Details</strong><span>Contact us for complete specifications.</span></div>';
}

function renderPriceBreakdown(product, price = product.price) {
  const displayPrice = getProductTotalPrice(product, price);
  const charges = [
    ['Base Price', product.basePrice],
    ['Packing Charges', product.packingCharges],
    ['Transport Charges', product.transportCharges],
    ['GST', product.gstPercentage, true]
  ];
  const chargeRows = charges.map(([label, value, isPercentage]) => {
    const displayValue = value === null || value === undefined || value === ''
      ? 'Not added yet'
      : isPercentage
        ? `${formatSpecificationValue(value)}%`
        : formatProductPrice(value);
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue)}</dd></div>`;
  }).join('');

  return `
    <div class="specification-price-row">
      <strong>Price</strong>
      <details class="price-breakdown">
        <summary>${escapeHtml(formatProductPrice(displayPrice))}</summary>
        <dl>
          ${chargeRows}
          <div class="price-breakdown-total">
            <dt>Product Price</dt>
            <dd>${escapeHtml(formatProductPrice(displayPrice))}</dd>
          </div>
        </dl>
      </details>
    </div>
  `;
}

function getProductTotalPrice(product, price = product.price) {
  const savedPrice = Number(price);
  if (price !== null && price !== undefined && price !== '' && Number.isFinite(savedPrice) && savedPrice >= 0) {
    return savedPrice;
  }

  const charges = [product.basePrice, product.packingCharges, product.transportCharges, product.gstPercentage];
  if (charges.some(value => value === null || value === undefined || value === '')) return null;
  if (charges.some(value => typeof value !== 'number' && typeof value !== 'string')) return null;

  const [basePrice, packingCharges, transportCharges, gstPercentage] = charges.map(Number);
  if (
    ![basePrice, packingCharges, transportCharges, gstPercentage].every(Number.isFinite) ||
    [basePrice, packingCharges, transportCharges, gstPercentage].some(value => value < 0) ||
    gstPercentage > 100
  ) {
    return null;
  }

  const taxableAmount = basePrice + packingCharges + transportCharges;
  return taxableAmount + taxableAmount * gstPercentage / 100;
}

function findSpecificationValue(keys, product, specifications) {
  const normalizedKeys = new Set(keys);
  for (const source of [specifications, product]) {
    for (const [key, value] of Object.entries(source)) {
      if (normalizedKeys.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase())) {
        return value;
      }
    }
  }
  return undefined;
}

function formatSpecificationValue(value) {
  if (Array.isArray(value)) return value.map(formatSpecificationValue).join(', ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${formatSpecificationValue(item)}`)
      .join(', ');
  }
  return String(value ?? '');
}

function resolveProductImage(product) {
  if (isAlmondProduct(product)) {
    return 'assets/images/de5fbc53-f5bd-45a6-adb1-28283e892226.png';
  }

  const modelImages = {
    CRL01: 'assets/images/03196af5-1ff4-436a-9618-dd7680ef54bf.png',
    KRY10: 'assets/images/4a4a47d9-373b-49be-886a-3ea266f3357c.png',
    KTK04: 'assets/images/625b923e-db57-459b-8cfc-a887c485758e.png'
  };
  const model = [product.model, product.productId, product.id, product.slug, product._id]
    .find(value => typeof value === 'string' && modelImages[value.trim().toUpperCase()]);
  if (model) return modelImages[model.trim().toUpperCase()];

  const fallback = fallbackProductImage(product);
  const image = product.image || product.featuredImage || product.image_url || product.images;
  if (typeof image !== 'string' || !image) return fallback;
  if (/^https?:\/\//i.test(image)) return image;

  const fileName = image.replace(/\\/g, '/').split('/').pop();
  const localImages = new Set([
    '947418eb-9873-41ce-8302-8c2256c72f1d.png',
    'de5fbc53-f5bd-45a6-adb1-28283e892226.png',
    '5c1abfb5-9577-4a7b-94a6-26ca39982110.png'
  ]);
  return localImages.has(fileName) ? `assets/images/${fileName}` : fallback;
}

function isAlmondProduct(product) {
  const category = [
    product.category && typeof product.category === 'object'
      ? product.category.name || product.category.categoryName || product.category.categoryId
      : product.category,
    product.categoryId,
    product.categoryName
  ].filter(Boolean).join(' ').toLowerCase();
  return category.includes('almond');
}

function fallbackProductImage(product) {
  const category = [
    product.category && typeof product.category === 'object'
      ? product.category.name || product.category.categoryName || product.category.categoryId
      : product.category,
    product.categoryId,
    product.categoryName
  ].filter(Boolean).join(' ').toLowerCase();
  const fallback = category.includes('almond')
    ? 'assets/images/de5fbc53-f5bd-45a6-adb1-28283e892226.png'
    : category.includes('betelnut') || category.includes('supari')
      ? 'assets/images/947418eb-9873-41ce-8302-8c2256c72f1d.png'
      : 'assets/images/5c1abfb5-9577-4a7b-94a6-26ca39982110.png';
  return fallback;
}

function showProductError(message, content, text) {
  message.textContent = text;
  message.hidden = false;
  content.hidden = true;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}
