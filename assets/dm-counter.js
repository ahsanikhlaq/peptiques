if (!customElements.get('dm-counter')) {
  customElements.define('dm-counter', class DMCounter extends HTMLElement {
    constructor() {
      super();
      this.currentSeconds = 0;
      this.intervalId = null;
    }

    connectedCallback() {
      // Parse initial time from data attribute (in minutes)
      const startingFrom = parseInt(this.dataset.startingfrom, 10) || 0;
      this.currentSeconds = startingFrom * 60;
      
      // Initial render
      this.updateDisplay();
      
      // Start countdown
      this.startTimer();
    }

    disconnectedCallback() {
      this.stopTimer();
    }

    startTimer() {
      this.intervalId = setInterval(() => {
        this.currentSeconds = Math.max(this.currentSeconds - 1, 0);
        
        if (this.currentSeconds <= 0) {
          this.stopTimer();
        }
        
        this.updateDisplay();
      }, 1000);
    }

    stopTimer() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    formatTime(totalSeconds) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return {
        hours: hours.toString().padStart(2, '0'),
        minutes: minutes.toString().padStart(2, '0'),
        seconds: seconds.toString().padStart(2, '0')
      };
    }

    updateDisplay() {
      const { hours, minutes, seconds } = this.formatTime(this.currentSeconds);
      
      // Update DOM elements
      if (this.hoursElement) this.hoursElement.textContent = hours;
      if (this.minutesElement) this.minutesElement.textContent = minutes;
      if (this.secondsElement) this.secondsElement.textContent = seconds;
    }

    // Getters for DOM elements
    get hoursElement() {
      return this.querySelector('[data-dm-counter-hours]');
    }

    get minutesElement() {
      return this.querySelector('[data-dm-counter-minutes]');
    }

    get secondsElement() {
      return this.querySelector('[data-dm-counter-seconds]');
    }
  });
}