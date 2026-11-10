const grid = document.querySelector("#product-grid");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#product-search");
const filterButtons = [...document.querySelectorAll(".filter-chip")];
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
const productDialog = document.querySelector("#product-dialog");
const productDialogContent = document.querySelector("#product-dialog-content");

let activeFilter = "All";
let latestRequest = 0;
let latestProductDetailsRequest = 0;
let lastProductCard = null;
let catalogProducts = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function debounce(callback, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function showProductLoadingState() {
  grid.setAttribute("aria-busy", "true");
  emptyState.hidden = true;
  grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="product-card product-card--skeleton" aria-hidden="true">
      <div class="product-body">
        <span class="product-skeleton-line product-skeleton-line--title"></span>
        <span class="product-skeleton-line product-skeleton-line--short"></span>
        <span class="product-skeleton-line"></span>
        <span class="product-skeleton-line product-skeleton-line--medium"></span>
      </div>
    </div>
  `).join("");
}

function formatSpecification(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "Price on request";
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

function formatFieldName(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderProductDetails(product) {
  const hiddenFields = new Set([
    "_id",
    "__v",
    "productId",
    "category",
    "categoryId",
    "categoryName",
    "art",
    "isActive",
    "name",
    "model",
    "average",
    "description",
    "price",
    "images",
    "specifications",
    "tags",
    "createdAt",
    "updatedAt",
    "migratedToCategoryCollection",
  ]);
  const customSpecifications = Object.entries(product).filter(
    ([key, value]) => !hiddenFields.has(key) && value !== null && value !== undefined && value !== "",
  );
  const average = product.average
    ? formatSpecification(product.average)
    : "Not specified";
  const specifications = [
    ["Name", product.name],
    ...(product.model ? [["Model", product.model]] : []),
    ["Average", average],
    ...Object.entries(product.specifications && typeof product.specifications === "object" ? product.specifications : {}),
    ...customSpecifications,
  ];
  const specificationList = specifications.length
    ? `
      <section class="product-dialog__specifications" aria-labelledby="product-specifications-title">
        <h3 id="product-specifications-title">Specifications</h3>
        <dl>
          ${specifications.map(([name, value]) => `
            <div>
              <dt>${escapeHtml(formatFieldName(name))}</dt>
              <dd>${escapeHtml(formatSpecification(value))}</dd>
            </div>
          `).join("")}
        </dl>
      </section>
    `
    : "";
  const tags = Array.isArray(product.tags) && product.tags.length
    ? `<p class="product-dialog__tags">${product.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</p>`
    : "";
  const categoryProductsSection = catalogProducts.length
    ? `
      <section class="product-dialog__other-products" aria-labelledby="category-products-title">
        <h3 id="category-products-title">More products</h3>
        <div class="product-dialog__product-grid">
          ${catalogProducts.map((item) => {
            return `
              <button class="product-dialog__product-card" type="button" data-related-product-id="${escapeHtml(item.productId || item._id)}">
                <span class="product-dialog__product-name"><strong>Name:</strong> ${escapeHtml(item.name)}</span>
                <span class="product-dialog__product-field"><strong>Price:</strong> ${escapeHtml(formatPrice(item.price))}</span>
                <span class="product-dialog__product-field"><strong>Average:</strong> ${escapeHtml(item.average ? formatSpecification(item.average) : "Not specified")}</span>
                <span class="product-dialog__product-description">${escapeHtml(item.description)}</span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `
    : "";

  productDialogContent.innerHTML = `
    <button class="product-dialog__close" type="button" data-close-product-dialog aria-label="Close product details">×</button>
    <h2 id="product-dialog-title">${escapeHtml(product.name)}</h2>
    <p class="product-dialog__price"><strong>Price:</strong> ${escapeHtml(formatPrice(product.price))}</p>
    ${specificationList}
    <p class="product-dialog__description">${escapeHtml(product.description)}</p>
    ${tags}
    ${categoryProductsSection}
  `;
}

async function openProductDetails(productId, card) {
  const requestId = ++latestProductDetailsRequest;
  if (!productDialog.open) lastProductCard = card;
  productDialogContent.innerHTML = `
    <button class="product-dialog__close" type="button" data-close-product-dialog aria-label="Close product details">×</button>
    <p class="product-dialog__status" role="status">Loading product details...</p>
  `;
  if (!productDialog.open) productDialog.showModal();

  try {
    const response = await window.ChaudhariAPI.get(`products/${encodeURIComponent(productId)}`);
    if (requestId !== latestProductDetailsRequest || !productDialog.open) return;
    const categoryQuery = new URLSearchParams({ categoryId: response.data.categoryId, limit: "100" });
    const catalogResponse = await window.ChaudhariAPI.get(`products?${categoryQuery.toString()}`);
    if (requestId !== latestProductDetailsRequest || !productDialog.open) return;
    catalogProducts = Array.isArray(catalogResponse.data) ? catalogResponse.data : [];
    renderProductDetails(response.data);
  } catch (error) {
    if (requestId !== latestProductDetailsRequest || !productDialog.open) return;
    productDialogContent.innerHTML = `
      <button class="product-dialog__close" type="button" data-close-product-dialog aria-label="Close product details">×</button>
      <p class="product-dialog__status" role="alert">${escapeHtml(error.message || "Unable to load product details.")}</p>
    `;
    console.error("Unable to load product details from the backend:", error);
  }
}

function renderProducts(products) {
  grid.innerHTML = products
    .map(
      (product) => {
        const name = escapeHtml(product.name);
        const showNutDetails = ["ALMOND", "BETELNUT"].includes(String(product.categoryId || "").toUpperCase());
        const average = product.average
          ? `<p class="product-card__average"><strong>Average:</strong> ${escapeHtml(formatSpecification(product.average))}</p>`
          : showNutDetails
            ? '<p class="product-card__average"><strong>Average:</strong> Not specified</p>'
            : "";
        const price = `<p class="product-card__price"><strong>Price:</strong> ${escapeHtml(formatPrice(product.price))}</p>`;
        return `
        <article class="product-card" data-product-id="${escapeHtml(product.productId || product._id)}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="View details for ${name}">
          <div class="product-body">
            <h3>${showNutDetails ? `<span class="product-card__name-label">Name:</span> ${name}` : name}</h3>
            ${price}
            ${average}
            <p>${escapeHtml(product.description)}</p>
            <span class="product-link">View machine <span aria-hidden="true">→</span></span>
          </div>
        </article>
      `;
      },
    )
    .join("");

  emptyState.hidden = products.length !== 0;
}

grid.addEventListener("click", (event) => {
  const card = event.target.closest(".product-card");
  if (card) openProductDetails(card.dataset.productId, card);
});

grid.addEventListener("keydown", (event) => {
  const card = event.target.closest(".product-card");
  if (!card || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  openProductDetails(card.dataset.productId, card);
});

productDialogContent.addEventListener("click", (event) => {
  const relatedProduct = event.target.closest("[data-related-product-id]");
  if (relatedProduct) {
    openProductDetails(relatedProduct.dataset.relatedProductId, relatedProduct);
    return;
  }
  if (event.target.closest("[data-close-product-dialog]")) productDialog.close();
});

productDialog.addEventListener("click", (event) => {
  if (event.target === productDialog) productDialog.close();
});

productDialog.addEventListener("close", () => {
  if (lastProductCard?.isConnected) lastProductCard.focus();
});

async function loadProducts() {
  const requestId = ++latestRequest;
  const query = searchInput.value.trim();
  const params = new URLSearchParams();
  if (activeFilter !== "All") params.set("category", activeFilter);

  const endpoint = query ? "products/search" : "products";
  if (query) params.set("q", query);

  showProductLoadingState();

  try {
    const response = await window.ChaudhariAPI.get(`${endpoint}?${params.toString()}`);
    if (requestId !== latestRequest) return;
    const products = Array.isArray(response.data) ? response.data : [];
    renderProducts(products);
    grid.setAttribute("aria-busy", "false");
  } catch (error) {
    if (requestId !== latestRequest) return;
    grid.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Products couldn't load. Please try again in a moment.";
    grid.setAttribute("aria-busy", "false");
    console.error("Unable to load products from the backend:", error);
  }
}

searchInput.addEventListener("input", debounce(loadProducts, 250));

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => filterButton.classList.toggle("active", filterButton === button));
    loadProducts();
  });
});

menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

mainNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

loadProducts();
