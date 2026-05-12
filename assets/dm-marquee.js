// https://github.com/Vahan0799/infinite-marquee?tab=readme-ov-file
if (!customElements.get('dm-marquee')) {
  customElements.define(
    'dm-marquee',
    class DMMarquee extends HTMLElement {
      constructor() {
        super();
        // Initialize vanilla-marquee
        try{
          const speed = this.dataset.speed ?? 100;
          

          const animationSpeed = Math.max(90000 - (speed * 150), 0)

          console.log("animationSpeed", animationSpeed, "Speed", speed);
         
          new InfiniteMarquee({
            element: this,
            speed: animationSpeed,
            //smoothEdges: true,
            pauseOnHover: true,
            direction: 'left',
            //gap: '15px',
            duplicateCount: 5,
            mobileSettings: {
              speed: animationSpeed
            }
          });
        } catch (error) {
          console.error('Error initializing vanilla-marquee:', error);
        }
      }
    }
  );
}