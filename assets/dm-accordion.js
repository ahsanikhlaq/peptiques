if (!customElements.get("dm-accordion")) {
  customElements.define(
    "dm-accordion",
    class DMAccordion extends HTMLElement {
      constructor() {
        super();

        this.intro = this.querySelector("#accordion-intro");
        this.content = this.querySelector("#accordion-content");

        this.addEventListener("click", this.onClick.bind(this));

      }

      openAccordion(){
        // const content = accordion.querySelector(".dm-accordion__content");
        this.classList.add("dm-accordion__active");
        //this.content.style.maxHeight = this.content.scrollHeight + "px";
        this.content.style.maxHeight = "fit-content";
      }

      closeAccordion(){
        // const content = accordion.querySelector(".dm-accordion__content");
        this.classList.remove("dm-accordion__active");
        this.content.style.maxHeight = null;
      }

      onClick(evt) {
        evt.preventDefault();
        
        if (this.content.style.maxHeight) {
          this.closeAccordion();
        } else {
          //accordions.forEach((accordion) => closeAccordion(accordion));
          this.openAccordion();
        }
      }

    }
  );
}
