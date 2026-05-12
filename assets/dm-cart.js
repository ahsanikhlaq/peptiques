let dm_subscribers = {};

const DM_ON_CHANGE_DEBOUNCE_TIMER = 300;

const DM_PUB_SUB_EVENTS = {
  cartUpdate: 'cart-update',
  quantityUpdate: 'quantity-update',
  optionValueSelectionChange: 'option-value-selection-change',
  variantChange: 'variant-change',
  cartError: 'cart-error'
};

function dm_subscribe(eventName, callback) {
  if (dm_subscribers[eventName] === undefined) {
    dm_subscribers[eventName] = [];
  }

  dm_subscribers[eventName] = [...dm_subscribers[eventName], callback];

  return function unsubscribe() {
    dm_subscribers[eventName] = dm_subscribers[eventName].filter((cb) => {
      return cb !== callback;
    });
  };
}

function dm_publish(eventName, data) {
  if (dm_subscribers[eventName]) {
    const promises = dm_subscribers[eventName].map((callback) => callback(data));
    return Promise.all(promises);
  } else {
    return Promise.resolve();
  }
}

function dm_fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: `application/${type}`
    }
  };
}

function dm_debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// CART DRAWER
class DMCartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#DM_CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-button') ?? document.querySelector('cart-drawer-component > button');
    if (!cartLink) return;
    
    // Remove any existing on:click attributes or similar
    cartLink.removeAttribute('on:click');
    cartLink.removeAttribute('onclick');
    
    // Alternative: Clone element to remove all event listeners (uncomment if needed)
    // const newCartLink = cartLink.cloneNode(true);
    // cartLink.parentNode.replaceChild(newCartLink, cartLink);
    // cartLink = newCartLink; // Update reference
    
    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation(); // Prevents other listeners on same element
      this.open(cartLink);
    }, true); // Use capture phase to trigger before bubble phase listeners
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation(); // Prevents other listeners on same element
        this.open(cartLink);
      }
    }, true); // Use capture phase to trigger before bubble phase listeners
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role'))
      this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('dm-is-empty')
          ? this.querySelector('.dm-drawer__inner-empty')
          : document.querySelector('dm-cart-drawer #DM_CartDrawer');
        const focusElement =
          this.querySelector('.dm_drawer__inner') || this.querySelector('.drawer__close');
        dm_trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    dm_removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute(
        'aria-expanded',
        !event.currentTarget.closest('details').hasAttribute('open')
      );
    });

    cartDrawerNote.parentElement.addEventListener('keyup', dm_onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.dm_drawer__inner').classList.contains('dm-is-empty') &&
      this.querySelector('.dm_drawer__inner').classList.remove('dm-is-empty');
    this.productId = parsedState.id;

    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      const newSection = this.getSectionInnerHTML(
        parsedState.sections[section.section],
        section.selector
      );
      sectionElement.innerHTML = newSection;
    });

    setTimeout(() => {
      this.querySelector('#DM_CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector)?.innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'dm-cart-drawer',
        section: 'dm-cart-drawer',
        selector: 'dm-cart-drawer #DM_CartDrawer'
      },
      {
        id: 'dm-cart-count-bubble',
        section: 'dm-cart-icon-bubble'
      }
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}
customElements.define('dm-cart-drawer', DMCartDrawer);

// CART ITEMS
class DMCartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement = document.querySelector('dm-cart-drawer #DM_CartDrawer-LineItemStatus');

    const debouncedOnChange = dm_debounce((event) => {
      this.onChange(event);
    }, DM_ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = dm_subscribe(DM_PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute('name')
    );
  }

  onCartUpdate() {
    fetch('/cart?section_id=main-cart-items')
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const sourceQty = html.querySelector('cart-items');
        if (sourceQty?.innerHTML) {
          this.innerHTML = sourceQty.innerHTML;
        }
      })
      .catch((e) => {
        console.error('Error updating cart items', e);
      });
  }

  getSectionsToRender() {
    return [
      // {
      //   id: "main-cart-items",
      //   section: document.getElementById("main-cart-items").dataset.id,
      //   selector: ".js-contents",
      // },
      {
        id: 'dm-cart-count-bubble',
        section: 'dm-cart-icon-bubble'
      }
      // {
      //   id: "cart-live-region-text",
      //   section: "cart-live-region-text",
      //   selector: ".shopify-section",
      // },
      // {
      //   id: "main-cart-footer",
      //   section: document.getElementById("main-cart-footer").dataset.id,
      //   selector: ".js-contents",
      // },
    ];
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, { ...dm_fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.querySelector(`dm-cart-items #Quantity-${line}`) ||
          document.querySelector(`dm-cart-drawer #Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('dm-is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('dm-cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('dm-is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper)
          cartDrawerWrapper.classList.toggle('dm-is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace = section.specialSelector ?
            document.querySelector(section.specialSelector) :
            document.getElementById(section.id).querySelector(section.selector) ||
            document.getElementById(section.id);

          if (elementToReplace) {
            const newSection = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
            // if(section.id ==="DM_CartDrawer"){
            // console.log('elementToReplace', {section} );
            // console.log("parseState", parsedState.sections);
            // console.log("elementToReplace", elementToReplace);
            // console.log("newSection", newSection)
            // }
           

            elementToReplace.innerHTML = newSection;
          }

        });
        const updatedValue = parsedState.items[line - 1]
          ? parsedState.items[line - 1].quantity
          : undefined;
        let message = '';
        if (
          items.length === parsedState.items.length &&
          updatedValue !== parseInt(quantityElement.value)
        ) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.querySelector(`dm-cart-items #CartItem-${line}`) ||
          document.querySelector(`dm-cart-drawer #DM_CartDrawer-Item-${line}`);

        // console.log('lineItem', lineItem, name);

        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? dm_trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          dm_trapFocus(
            cartDrawerWrapper.querySelector('.dm-drawer__inner-empty'),
            cartDrawerWrapper.querySelector('a')
          );
        } else if (document.querySelector('dm-cart-items .cart-item') && cartDrawerWrapper) {
          dm_trapFocus(cartDrawerWrapper, document.querySelector('dm-cart-items .cart-item__name'));
        }
        dm_publish(DM_PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items' });
      })
      .catch((err) => {
        console.error('Error updating quantity', err);
        this.querySelectorAll('.loading-overlay').forEach((overlay) =>
          overlay.classList.add('hidden')
        );
        const errors =
          document.querySelector('dm-cart-items #cart-errors') ||
          document.querySelector('dm-cart-drawer #DM_CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.querySelector(`dm-cart-items #Line-item-error-${line}`) ||
      document.querySelector(`dm-cart-drawer #CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').innerHTML = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.querySelector('dm-cart-items #cart-live-region-text') ||
      document.querySelector('dm-cart-drawer #CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector)?.innerHTML;
  }

  enableLoading(line) {
    const mainCartItems =
      document.querySelector('dm-cart-items #main-cart-items') ||
      document.querySelector('dm-cart-drawer #DM-CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay`);
    const cartDrawerItemElements = this.querySelectorAll(`#DM_CartDrawer-Item-${line} .loading-overlay`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) =>
      overlay.classList.remove('hidden')
    );

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems =
      document.querySelector('dm-cart-items #main-cart-items') ||
      document.querySelector('dm-cart-drawer #DM-CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(
      `dm-cart-items #CartItem-${line} .loading-overlay`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `dm-cart-drawer #DM_CartDrawer-Item-${line} .loading-overlay`
    );

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('dm-cart-items', DMCartItems);

class DMCartDrawerItems extends DMCartItems {
  getSectionsToRender() {
    return [
      {
        id: 'DM_CartDrawer',
        section: 'dm-cart-drawer',
        selector: '.dm_drawer__inner',
        specialSelector: "dm-cart-drawer #DM_CartDrawer .dm_drawer__inner"
      },
      {
        id: 'dm-cart-count-bubble',
        section: 'dm-cart-icon-bubble'
      }
    ];
  }
}

customElements.define('dm-cart-drawer-items', DMCartDrawerItems);

// CART NOTE
if (!customElements.get('dm-cart-note')) {
  customElements.define(
    'dm-cart-note',
    class DMCartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'change',
          dm_debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, {
              ...dm_fetchConfig(),
              ...{ body }
            });
          }, DM_ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

// CART REMOVE BUTTON
class DMCartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('dm-cart-items') || this.closest('dm-cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}
customElements.define('dm-cart-remove-button', DMCartRemoveButton);

// QUANTITY INPUT
class DmQuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });
    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach((button) =>
      button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = dm_subscribe(
      DM_PUB_SUB_EVENTS.quantityUpdate,
      this.validateQtyRules.bind(this)
    );
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    const name = event?.target?.name ?? event?.target?.parentElement?.name ?? event?.target?.parentElement?.parentElement?.name;


    if (name === 'plus') {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.dataset.min === previousValue && name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', parseInt(value) <= parseInt(this.input.min));
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', value >= max);
    }
  }
}

customElements.define('dm-quantity-input', DmQuantityInput);

// CART DISCOUNT
function dm_handleDiscountForm(e) {
  e.preventDefault();

  const discountInput = e.target.querySelector('[name=cart-discount-field]');
  const discountError = e.target.querySelector('.cart-discount-form__error');
  const discountValue = discountInput.value;
  if (discountValue === undefined || discountValue.length === 0) {
    discountError.style.display = 'block';
    return;
  }
  discountError.style.display = 'none';
  const checkoutBaseUrl = '/checkout?discount=';
  const newCheckoutUrl = checkoutBaseUrl + discountValue;
  window.location.href = newCheckoutUrl;
}

function dm_handleDiscountFormChange(e) {
  const discountErros = document.querySelectorAll('.cart-discount-form__error');
  discountErros.forEach((error) => {
    error.style.display = 'none';
  });
}

// HELPER FUNCTIONS
const dm_trapFocusHandlers = {};

function dm_getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

function dm_removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', dm_trapFocusHandlers.focusin);
  document.removeEventListener('focusout', dm_trapFocusHandlers.focusout);
  document.removeEventListener('keydown', dm_trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function dm_trapFocus(container, elementToFocus = container) {
  var elements = dm_getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  dm_removeTrapFocus();

  dm_trapFocusHandlers.focusin = (event) => {
    if (event.target !== container && event.target !== last && event.target !== first) return;

    document.addEventListener('keydown', dm_trapFocusHandlers.keydown);
  };

  dm_trapFocusHandlers.focusout = function () {
    document.removeEventListener('keydown', dm_trapFocusHandlers.keydown);
  };

  dm_trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if ((event.target === container || event.target === first) && event.shiftKey) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', dm_trapFocusHandlers.focusout);
  document.addEventListener('focusin', dm_trapFocusHandlers.focusin);

  elementToFocus.focus();

  if (
    elementToFocus.tagName === 'INPUT' &&
    ['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
    elementToFocus.value
  ) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

function dm_onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}
