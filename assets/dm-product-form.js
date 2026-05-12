if (!customElements.get('dm-product-form')) {
  customElements.define(
    'dm-product-form',
    class DMProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.form.querySelector('[name=id]').disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart =
          document.querySelector('cart-notification') || document.querySelector('dm-cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');

        if (document.querySelector('dm-cart-drawer'))
          this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        // this.querySelector('.loading__spinner').classList.remove('hidden');

        function fetchConfig(type = 'json') {
          return {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: `application/${type}` }
          };
        }

        const config = fetchConfig('javascript');

        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.section)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;
        let cart = '/cart/add';
        try {
          cart = routes?.cart_add_url ?? window.routes?.cart_add_url ?? '/cart/add';
        } catch (e) {}
        fetch(`${cart}`, config)
          .then((response) => response.json())
          .then((response) => {
            console.log('response', response);
            if (response.status) {
              if (response.status === 422) {
                // Create and show toast notification
                this.showToast(response.description || response.message || 'An error occurred');
                return ;
              }

              dm_publish(DM_PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButton.querySelector('span').classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              // Check shopiweb & horizon cart drawer
              const shopifyWebCart = document.querySelector('#offcanvas-cart');
              const horizonCart = document.querySelector('cart-drawer-component > dialog');
              console.log('shopifyWebCart', shopifyWebCart);
              console.log('horizonCart', horizonCart);
              if (shopifyWebCart) {
                shopifyWebCart.classList.toggle('show');
                const shopiwebBackdrop = document.querySelector('.offcanvas-backdrop');
                let newBackdrop;
                if (shopiwebBackdrop) {
                  shopiwebBackdrop.classList.add('show');
                  newBackdrop = shopiwebBackdrop;
                } else {
                  // Create the div
                  newBackdrop = document.createElement('div');
                  newBackdrop.className = 'offcanvas-backdrop fade show';

                  // Add click handler
                  newBackdrop.addEventListener('click', () => {
                    shopifyWebCart.classList.toggle('show');
                    newBackdrop.remove();
                  });

                  // Insert before </body>
                  document.body.appendChild(newBackdrop);
                }
                // Add click handler to #offcanvas-cart button.btn-close
                const closeButton = shopifyWebCart.querySelector('button.btn-close');
                if (closeButton && newBackdrop) {
                  closeButton.addEventListener('click', () => {
                    shopifyWebCart.classList.toggle('show');
                    newBackdrop.remove();
                  });
                }
              } else if (horizonCart) {
                // Also dispatch a generic cart update event
                const cartUpdateEvent = new CustomEvent('cart:update', {
                  bubbles: true,
                  detail: {
                    resource: response,
                    sourceId: formData.get('id'),
                    data: {
                      source: 'product-form',
                      itemCount: response.item_count,
                      sections: response.sections
                    }
                  }
                });

                document.dispatchEvent(cartUpdateEvent);
                setTimeout(() => {
                  // Refresh cart icon
                  const cartIcon = document.querySelector('cart-icon');
                  if (cartIcon) {
                    cartIcon.ensureCartBubbleIsCorrect();
                  }

                  // Add open as attribute if not already present
                  horizonCart.showModal();

                  // Handle backdrop clicks by listening to clicks on the dialog itself
                  horizonCart.addEventListener('click', (event) => {
                    // If the click target is the dialog itself (not a child element),
                    // it means the user clicked on the backdrop
                    if (event.target === horizonCart) {
                      horizonCart.close();
                    }
                  });
                }, 100);
              } else {
                window.location = window.routes?.cart_url ?? '/cart';
                return;
              }
            }

            if (!this.error)
              dm_publish(DM_PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              this.cart.renderContents(response);
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('dm-is-empty'))
              this.cart.classList.remove('dm-is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            //this.querySelector('.loading__spinner').classList.add('hidden');
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage =
          this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      showToast(message) {
        // Create toast container
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 20px;
          background: #ff4444;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          max-width: 300px;
          word-wrap: break-word;
          z-index: 10000;
          transform: translateY(100px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        toast.textContent = message;
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
          toast.style.transform = 'translateY(0)';
          toast.style.opacity = '1';
        });
        
        // Remove after 3 seconds
        setTimeout(() => {
          toast.style.transform = 'translateY(100px)';
          toast.style.opacity = '0';
          
          setTimeout(() => {
            if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
            }
          }, 300);
        }, 3000);
      }
    }
  );
}
