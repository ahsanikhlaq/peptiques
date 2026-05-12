// https://swiperjs.com/swiper-api#initialize-swiper
if (!customElements.get('dm-swiper')) {
  customElements.define(
    'dm-swiper',
    class DMSwiper extends HTMLElement {
      constructor() {
        super();
        try {
          const defaultConfig = {
            spaceBetween: 30,
            centeredSlides: true,
            // Uncomment this and it will break the header
            // slidesPerView: 1,
            // breakpoints: {
            //   '@0.75': {
            //     slidesPerView: 4,
            //     spaceBetween: 20
            //   }
            // },
            autoplay: {
              delay: 2500,
              disableOnInteraction: false
            },
            pagination: {
              el: '.swiper-pagination',
              clickable: true
            },
            navigation: {
              nextEl: '.swiper-button-next',
              prevEl: '.swiper-button-prev'
            }
          };

          // Get custom config from data attribute
          const customConfig = this.dataset.config ? JSON.parse(this.dataset.config) : {};

          // Merge default config with custom config
          const {
            modules,
            'data-dm-element': ignored,
            ...config
          } = { ...defaultConfig, ...customConfig };

          console.log('config swiper', config);

          new Swiper(this, config);
        } catch (error) {
          console.error('Error initializing swipper:', error);
        }
      }
    }
  );
}
