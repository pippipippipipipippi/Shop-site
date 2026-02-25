document.documentElement.setAttribute("data-appjs", "loaded");

const STORAGE_KEY = "simple_shop_cart_v1";

function yen(n) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function cartCount(cart) {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

function calcSubtotal(cart) {
  const map = new Map((window.PRODUCTS || []).map((p) => [p.id, p]));
  let sum = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const p = map.get(id);
    if (!p) continue;
    sum += p.price * qty;
  }
  return sum;
}

// 送料（例）: 小計4000円以上は無料、それ以外600円
function calcShipping(subtotal) {
  if (subtotal === 0) return 0;
  if (subtotal >= 4000) return 0;
  return 600;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  const sort = document.getElementById("sortSelect")?.value || "featured";

  let items = [...(window.PRODUCTS || [])];

  if (q) {
    items = items.filter((p) =>
      (p.name + " " + p.desc + " " + p.tag).toLowerCase().includes(q)
    );
  }

  if (sort === "priceAsc") items.sort((a, b) => a.price - b.price);
  if (sort === "priceDesc") items.sort((a, b) => b.price - a.price);
  if (sort === "nameAsc") items.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  grid.innerHTML = items
    .map(
      (p) => `
      <article class="card">
        <div class="card__img" aria-hidden="true">${p.icon}</div>
        <div class="card__body">
          <div class="card__row">
            <h3 class="card__title">${escapeHtml(p.name)}</h3>
          </div>
          <p class="card__desc">${escapeHtml(p.desc)}</p>
          <div class="card__row">
            <span class="pill">${escapeHtml(p.tag)}</span>
            <span class="price">${yen(p.price)}</span>
          </div>
          <button class="button button--primary" type="button" data-add="${p.id}">
            カートに追加
          </button>
        </div>
      </article>
    `
    )
    .join("");

  grid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.getAttribute("data-add")));
  });
}

function renderCart() {
  const cart = loadCart();

  const badge = document.getElementById("cartBadge");
  if (badge) badge.textContent = `${cartCount(cart)}点`;

  const cartItems = document.getElementById("cartItems");
  if (!cartItems) return;

  const map = new Map((window.PRODUCTS || []).map((p) => [p.id, p]));
  const entries = Object.entries(cart).filter(([id, qty]) => map.has(id) && qty > 0);

  if (entries.length === 0) {
    cartItems.innerHTML = `
      <div class="summary">
        <p style="margin:0; color: var(--muted); line-height:1.7;">
          カートは空です。商品を追加してください。
        </p>
      </div>
    `;
  } else {
    cartItems.innerHTML = entries
      .map(([id, qty]) => {
        const p = map.get(id);
        const line = p.price * qty;
        return `
          <div class="cartItem">
            <div class="cartItem__icon" aria-hidden="true">${p.icon}</div>
            <div class="cartItem__main">
              <div class="cartItem__top">
                <div>
                  <p class="cartItem__name">${escapeHtml(p.name)}</p>
                  <div class="cartItem__meta">${escapeHtml(p.tag)} ・ ${yen(p.price)} / 個</div>
                </div>
                <div style="text-align:right;">
                  <div class="price">${yen(line)}</div>
                  <button class="button button--danger" type="button" data-remove="${id}">削除</button>
                </div>
              </div>

              <div class="cartItem__actions">
                <div class="qty" role="group" aria-label="数量">
                  <button type="button" data-dec="${id}">−</button>
                  <span>${qty}</span>
                  <button type="button" data-inc="${id}">＋</button>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  cartItems.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", () => changeQty(b.getAttribute("data-inc"), +1))
  );
  cartItems.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", () => changeQty(b.getAttribute("data-dec"), -1))
  );
  cartItems.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => removeFromCart(b.getAttribute("data-remove")))
  );

  const subtotal = calcSubtotal(cart);
  const shipping = calcShipping(subtotal);
  const total = subtotal + shipping;

  const subtotalEl = document.getElementById("subtotal");
  const shippingEl = document.getElementById("shipping");
  const totalEl = document.getElementById("total");
  if (subtotalEl) subtotalEl.textContent = yen(subtotal);
  if (shippingEl) shippingEl.textContent = yen(shipping);
  if (totalEl) totalEl.textContent = yen(total);
}

function addToCart(id) {
  const cart = loadCart();
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  renderCart();
}

function changeQty(id, delta) {
  const cart = loadCart();
  const next = (cart[id] || 0) + delta;
  if (next <= 0) delete cart[id];
  else cart[id] = next;
  saveCart(cart);
  renderCart();
}

function removeFromCart(id) {
  const cart = loadCart();
  delete cart[id];
  saveCart(cart);
  renderCart();
}

function clearCart() {
  saveCart({});
  renderCart();
}

// ✅ Stripeへ飛ばす（失敗理由を必ずアラート表示）
async function goCheckout(e) {
  e.preventDefault();

  try {
    const cart = loadCart();
    const items = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ id, qty }));

    if (items.length === 0) {
      alert("カートが空です。");
      return;
    }

    const API_BASE = "https://simple-shop-api.toytoy0517.workers.dev";
    const endpoint = `${API_BASE}/api/create-checkout-session`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    const text = await res.text();

    if (!res.ok) {
      alert(`APIエラー: ${res.status}\n${text.slice(0, 400)}`);
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      alert(`JSONじゃない返答です:\n${text.slice(0, 400)}`);
      return;
    }

    if (!data?.url) {
      alert(`urlが返ってきません:\n${text.slice(0, 400)}`);
      return;
    }

    location.href = data.url;
  } catch (err) {
    alert(`例外:\n${String(err)}`);
  }
}

function setup() {
  renderProducts();
  renderCart();

  const search = document.getElementById("searchInput");
  const sort = document.getElementById("sortSelect");
  search?.addEventListener("input", renderProducts);
  sort?.addEventListener("change", renderProducts);

  document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
  document.getElementById("checkoutBtn")?.addEventListener("click", goCheckout);
  document.getElementById("checkoutBtnTop")?.addEventListener("click", goCheckout);
}

document.addEventListener("DOMContentLoaded", setup);
