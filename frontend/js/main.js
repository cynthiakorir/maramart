(function () {
  const api = window.MaraMartAPI;
  const page = document.body.dataset.page;
  let toastTimer;
  let cart = null;
  let categories = [];
  let products = [];
  let activeCategory = 'all';

  const $ = (selector) => document.querySelector(selector);

  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3800);
  }

  function setBusy(button, busy, text) {
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = text || 'Please wait…';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function makeMuted(text) {
    const paragraph = document.createElement('p');
    paragraph.className = 'muted';
    paragraph.textContent = text;
    return paragraph;
  }

  function setFormMessage(message, isError) {
    const node = $('#form-message');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', Boolean(isError));
  }

  async function loadAccount() {
    const token = api.getToken();
    const label = $('#account-label');
    const button = $('#account-button');
    if (!token) {
      if (label) label.textContent = 'Welcome, guest';
      if (button) button.textContent = 'Sign in';
      return;
    }
    if (label) label.textContent = 'Welcome, shopper';
    if (button) button.textContent = 'Sign out';
    try {
      const profile = await api.request('/accounts/profile/');
      if (label) label.textContent = `Welcome, ${profile.username || 'shopper'}`;
      const fullName = $('#checkout-form [name="full_name"]');
      const phone = $('#checkout-form [name="phone_number"]');
      if (fullName && !fullName.value) {
        fullName.value = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      }
      if (phone && !phone.value && profile.phone_number) phone.value = profile.phone_number;
    } catch (error) {
      if (/authentication credentials|not authenticated|invalid token/i.test(error.message)) {
        api.setToken(null);
        if (label) label.textContent = 'Welcome, guest';
        if (button) button.textContent = 'Sign in';
      }
    }
  }

  async function updateCartCount() {
    const counter = $('#cart-count');
    if (!counter) return;
    if (!api.getToken()) {
      counter.textContent = '0';
      return;
    }
    try {
      const result = await api.request('/cart/');
      counter.textContent = String((result.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0));
    } catch (error) {
      counter.textContent = '0';
    }
  }

  function bindHeader() {
    const accountButton = $('#account-button');
    if (accountButton) {
      accountButton.addEventListener('click', () => {
        if (api.getToken()) {
          api.setToken(null);
          showToast('You have signed out.');
          window.location.href = 'index.html';
        } else {
          window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html')}`;
        }
      });
    }
  }

  function productImage(image) {
    if (!image) return null;
    try {
      return new URL(image, new URL(api.base).origin).href;
    } catch (error) {
      return null;
    }
  }

  function makeProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card';
    const imageArea = document.createElement('div');
    imageArea.className = 'product-image';
    const imageUrl = productImage(product.image);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = product.name || 'MaraMart product';
      image.loading = 'lazy';
      image.addEventListener('error', () => image.replaceWith(placeholder()), { once: true });
      imageArea.append(image);
    } else {
      imageArea.append(placeholder());
    }
    if (product.category_name) {
      const category = document.createElement('span');
      category.className = 'product-category';
      category.textContent = product.category_name;
      imageArea.append(category);
    }
    const info = document.createElement('div');
    info.className = 'product-info';
    const name = document.createElement('h3');
    name.textContent = product.name || 'Product';
    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = product.description || 'A good find for your everyday market.';
    const bottom = document.createElement('div');
    bottom.className = 'product-bottom';
    const priceWrap = document.createElement('div');
    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = api.formatPrice(product.price);
    const stock = document.createElement('div');
    stock.className = 'product-stock';
    stock.textContent = Number(product.stock) > 0 ? `${product.stock} available` : 'Currently unavailable';
    priceWrap.append(price, stock);
    const add = document.createElement('button');
    add.className = 'add-button';
    add.type = 'button';
    add.textContent = '+';
    add.setAttribute('aria-label', `Add ${product.name || 'product'} to cart`);
    add.disabled = Number(product.stock) < 1;
    add.addEventListener('click', () => addToCart(product.id, add));
    bottom.append(priceWrap, add);
    info.append(name, description, bottom);
    card.append(imageArea, info);
    return card;
  }

  function placeholder() {
    const icon = document.createElement('span');
    icon.className = 'image-placeholder';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✿';
    return icon;
  }

  async function addToCart(productId, button) {
    if (!api.getToken()) {
      window.location.href = `login.html?next=${encodeURIComponent('products.html')}`;
      return;
    }
    setBusy(button, true, '…');
    try {
      await api.request('/cart/add/', {
        method: 'POST',
        body: JSON.stringify({ product: productId, quantity: 1 }),
      });
      await updateCartCount();
      showToast('Added to your cart.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(button, false);
    }
  }

  async function loadCatalog() {
    const status = $('#products-status');
    const grid = $('#product-grid');
    const featured = $('#featured-products');
    const message = $('#home-status');
    if (!grid && !featured) return;
    try {
      const requests = [api.request('/products/')];
      if ($('#category-list')) requests.push(api.request('/products/categories/'));
      const result = await Promise.all(requests);
      products = Array.isArray(result[0]) ? result[0] : [];
      categories = Array.isArray(result[1]) ? result[1] : [];
      if (featured) {
        featured.replaceChildren();
        products.slice(0, 4).forEach((product) => featured.append(makeProductCard(product)));
        if (message) message.textContent = products.length ? '' : 'No products are available right now.';
      }
      if (grid) {
        renderCategories();
        renderProducts();
      }
    } catch (error) {
      if (status) status.textContent = error.message;
      if (message) message.textContent = error.message;
    }
  }

  function renderCategories() {
    const list = $('#category-list');
    if (!list) return;
    list.replaceChildren();
    [{ id: 'all', name: 'All products' }, ...categories].forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `category-chip${String(activeCategory) === String(category.id) ? ' is-active' : ''}`;
      button.textContent = category.name;
      button.addEventListener('click', () => {
        activeCategory = category.id;
        renderCategories();
        renderProducts();
      });
      list.append(button);
    });
  }

  function renderProducts() {
    const grid = $('#product-grid');
    if (!grid) return;
    const search = ($('#search-input')?.value || '').trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesCategory = activeCategory === 'all' || String(product.category) === String(activeCategory);
      const text = `${product.name || ''} ${product.description || ''} ${product.category_name || ''}`.toLowerCase();
      return matchesCategory && text.includes(search);
    });
    grid.replaceChildren();
    filtered.forEach((product) => grid.append(makeProductCard(product)));
    const status = $('#products-status');
    if (status) {
      status.textContent = !products.length
        ? 'No products are available right now.'
        : !filtered.length ? 'No products match your search.' : '';
    }
  }

  function requireSignIn() {
    if (api.getToken()) return true;
    window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html')}`;
    return false;
  }

  async function loadCart() {
    const host = $('#cart-content');
    const status = $('#cart-status');
    if (!host) return;
    if (!requireSignIn()) return;
    status.textContent = 'Loading your cart…';
    try {
      cart = await api.request('/cart/');
      status.textContent = '';
      renderCart();
      await updateCartCount();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function renderCart() {
    const host = $('#cart-content');
    if (!host) return;
    host.replaceChildren();
    const items = cart?.items || [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const text = document.createElement('p');
      text.textContent = 'Your cart is empty. Your next good find is waiting.';
      const link = document.createElement('a');
      link.className = 'button button-dark';
      link.href = 'products.html';
      link.textContent = 'Browse products';
      empty.append(text, link);
      host.append(empty);
      return;
    }
    const list = document.createElement('div');
    items.forEach((item) => list.append(makeCartItem(item)));
    const total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const summary = document.createElement('div');
    summary.className = 'cart-summary';
    const amount = document.createElement('strong');
    amount.textContent = `Subtotal: ${api.formatPrice(total)}`;
    const checkout = document.createElement('a');
    checkout.className = 'button button-dark';
    checkout.href = 'checkout.html';
    checkout.textContent = 'Continue to checkout';
    summary.append(amount, checkout);
    host.append(list, summary);
  }

  function makeCartItem(item) {
    const row = document.createElement('div');
    row.className = 'cart-item';
    const name = document.createElement('p');
    name.className = 'cart-item-name';
    name.textContent = item.product_name || `Product #${item.product}`;
    const subtotal = document.createElement('span');
    subtotal.className = 'cart-item-price';
    subtotal.textContent = api.formatPrice(item.subtotal);
    const controls = document.createElement('div');
    controls.className = 'cart-item-controls';
    const decrease = quantityButton('−', `Decrease ${name.textContent}`, () => changeQuantity(item, -1));
    const quantity = document.createElement('span');
    quantity.textContent = String(item.quantity);
    const increase = quantityButton('+', `Increase ${name.textContent}`, () => changeQuantity(item, 1));
    controls.append(decrease, quantity, increase);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-item';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeCartItem(item.id));
    row.append(name, subtotal, controls, remove);
    return row;
  }

  function quantityButton(label, name, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quantity-button';
    button.textContent = label;
    button.setAttribute('aria-label', name);
    button.addEventListener('click', onClick);
    return button;
  }

  async function changeQuantity(item, change) {
    const quantity = Number(item.quantity) + change;
    try {
      if (quantity < 1) {
        await api.request(`/cart/remove/${item.id}/`, { method: 'DELETE' });
      } else {
        await api.request(`/cart/update/${item.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
      }
      await loadCart();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function removeCartItem(itemId) {
    try {
      await api.request(`/cart/remove/${itemId}/`, { method: 'DELETE' });
      await loadCart();
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadCheckout() {
    if (!requireSignIn()) return;
    const status = $('#checkout-status');
    try {
      cart = await api.request('/cart/');
      await updateCartCount();
      renderCheckoutSummary();
      if (!cart.items?.length) {
        status.textContent = 'Your cart is empty. Add products before checking out.';
        $('#checkout-form').hidden = true;
      }
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function renderCheckoutSummary() {
    const host = $('#checkout-items');
    if (!host) return;
    host.replaceChildren();
    const items = cart?.items || [];
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'checkout-row';
      const name = document.createElement('span');
      name.textContent = `${item.product_name || `Product #${item.product}`} × ${item.quantity}`;
      const subtotal = document.createElement('strong');
      subtotal.textContent = api.formatPrice(item.subtotal);
      row.append(name, subtotal);
      host.append(row);
    });
    const total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    $('#checkout-total').textContent = api.formatPrice(total);
  }

  async function placeOrder(event) {
    event.preventDefault();
    const button = $('#place-order-button');
    setBusy(button, true, 'Placing order…');
    const body = Object.fromEntries(new FormData($('#checkout-form')));
    try {
      const result = await api.request('/orders/create/', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const order = result.order;
      $('#checkout-form').hidden = true;
      $('#checkout-status').textContent = result.message || 'Order placed successfully.';
      const confirmation = $('#order-confirmation');
      confirmation.hidden = false;
      confirmation.replaceChildren();
      const message = document.createElement('p');
      message.textContent = `Order #${order.id} is placed. Request an M-Pesa prompt to complete payment.`;
      const pay = document.createElement('button');
      pay.type = 'button';
      pay.className = 'button button-dark';
      pay.textContent = 'Pay with M-Pesa';
      pay.addEventListener('click', () => initiatePayment(order.id, pay));
      const back = document.createElement('a');
      back.className = 'button button-outline';
      back.href = 'index.html';
      back.textContent = 'Continue shopping';
      confirmation.append(message, pay, document.createTextNode(' '), back);
     
      await updateCartCount();
    } catch (error) {
      $('#checkout-status').textContent = error.message;
    } finally {
      setBusy(button, false);
    }
  }

  async function initiatePayment(orderId, button) {
    setBusy(button, true, 'Requesting…');
    try {
      const result = await api.request('/payments/initiate/', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId }),
      });
      showToast(result.message || 'M-Pesa prompt sent. Check your phone to complete payment.');
      button.textContent = 'Prompt sent';
      button.disabled = true;
    } catch (error) {
      showToast(error.message);
      setBusy(button, false);
    }
  }

  function loginRedirect() {
    const requested = new URLSearchParams(window.location.search).get('next') || 'index.html';
    const allowed = new Set(['index.html', 'products.html', 'cart.html', 'checkout.html']);
    return allowed.has(requested) ? requested : 'index.html';
  }

  async function bindLogin() {
    const form = $('#login-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      setBusy(button, true, 'Signing in…');
      setFormMessage('', false);
      try {
        const result = await api.request('/accounts/login/', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        if (!result.token) throw new Error('The server did not return an authentication token.');
        api.setToken(result.token);
        window.location.href = loginRedirect();
      } catch (error) {
        setFormMessage(error.message, true);
      } finally {
        setBusy(button, false);
      }
    });
  }

  async function bindRegister() {
    const form = $('#register-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      setBusy(button, true, 'Creating account…');
      setFormMessage('', false);
      try {
        await api.request('/accounts/register/', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        window.location.href = 'login.html?registered=1';
      } catch (error) {
        setFormMessage(error.message, true);
      } finally {
        setBusy(button, false);
      }
    });
    if (new URLSearchParams(window.location.search).has('registered')) {
      setFormMessage('Account created. Sign in with your new username and password.', false);
    }
  }
async function init() {
  bindHeader();
  await loadAccount();
  await updateCartCount();

  if (page === 'home' || page === 'products') {
    await loadCatalog();
    const search = $('#search-input');
    if (search) search.addEventListener('input', renderProducts);
  }

  if (page === 'login') await bindLogin();
  if (page === 'register') await bindRegister();
  if (page === 'cart') await loadCart();

  if (page === 'checkout') {
    $('#checkout-form')?.addEventListener('submit', placeOrder);
    await loadCheckout();

    const confirmation = $('#order-confirmation');

    if (confirmation) {
      confirmation.hidden = false;
      confirmation.replaceChildren();

      const message = document.createElement('p');
      message.textContent = 'Resume payment for Order #12 (KSh 800).';

      const pay = document.createElement('button');
      pay.type = 'button';
      pay.className = 'button button-dark';
      pay.textContent = 'Pay with M-Pesa';
      pay.addEventListener('click', () => initiatePayment(12, pay));

      confirmation.append(message, pay);
    }
  }
}

init();
  
  
})();
