if (!customElements.get('dm-product-hero-section')) {
  customElements.define(
    'dm-product-hero-section',
    class ProductHero extends HTMLElement {
      constructor() {
        super();
        this.setListeners();
      }

      setListeners() {
        this.addEventListener('click', (event) => {
          const mediaElement = event.target.closest('[data-media-id]');
          if (mediaElement && mediaElement.closest('[data-dm-element="product-images-gallery"]')) {
            this.handleMediaClick(mediaElement);
            // const mediaId = mediaElement.getAttribute('data-media-id');
          }
        });
      }

      _createVideoElement(sourceVideoElement) {
        const newVideo = document.createElement('video');
        const source = sourceVideoElement.querySelector('source');

        if (source) {
          const newSource = document.createElement('source');
          newSource.src = source.src;
          newSource.type = source.type || 'video/mp4';
          newVideo.appendChild(newSource);
        }

        ['playsinline', 'autoplay', 'loop', 'muted'].forEach(attr => {
          if (sourceVideoElement.hasAttribute(attr)) {
            newVideo.setAttribute(attr, sourceVideoElement.getAttribute(attr) || '');
          }
        });

        newVideo.load(); // Pre-load the video
        return newVideo;
      }

      _createImageElement(sourceImageElement) {
        const newImage = document.createElement('img');
        newImage.src = sourceImageElement.src;
        // Consider copying alt text if available
        if (sourceImageElement.alt) {
          newImage.alt = sourceImageElement.alt;
        }
        return newImage;
      }

      _replaceMediaElement(targetContainer, newElement, oldElement) {
        newElement.className = oldElement.className;
        newElement.style.cssText = oldElement.style.cssText; // Use cssText for styles
        oldElement.remove();
        targetContainer.appendChild(newElement);
      }

      handleMediaClick(clickedMediaElement) {
        const clickedVideoElement = clickedMediaElement.querySelector('video');
        const clickedImageElement = clickedMediaElement.querySelector('img');
        const isClickedMediaVideo = Boolean(clickedVideoElement);

        const targetMediaContainer = document.querySelector('div#product-hero-main-image');
        if (!targetMediaContainer) return; // Exit if target container not found

        const targetVideoElement = targetMediaContainer.querySelector('video');
        const targetImageElement = targetMediaContainer.querySelector('img');
        const isTargetMediaVideo = Boolean(targetVideoElement);

        if (isClickedMediaVideo && isTargetMediaVideo) {
          // Swap video sources
          const clickedSource = clickedVideoElement.querySelector('source');
          const targetSource = targetVideoElement.querySelector('source');
          if (clickedSource && targetSource) {
            targetSource.src = clickedSource.src;
            targetVideoElement.load();
          }
        } else if (!isClickedMediaVideo && !isTargetMediaVideo) {
          // Swap image sources
          if (targetImageElement && clickedImageElement) {
             targetImageElement.src = clickedImageElement.src;
             // Consider updating srcset if used
             if (clickedImageElement.srcset) {
                targetImageElement.srcset = clickedImageElement.srcset;
             }
          }
        } else if (!isClickedMediaVideo && isTargetMediaVideo) {
          // Replace video with image
          if (targetVideoElement && clickedImageElement) {
            const newImage = this._createImageElement(clickedImageElement);
            this._replaceMediaElement(targetMediaContainer, newImage, targetVideoElement);
          }
        } else if (isClickedMediaVideo && !isTargetMediaVideo) {
          // Replace image with video
          if (targetImageElement && clickedVideoElement) {
            const newVideo = this._createVideoElement(clickedVideoElement);
            this._replaceMediaElement(targetMediaContainer, newVideo, targetImageElement);
          }
        }
      }
    }
  );
}