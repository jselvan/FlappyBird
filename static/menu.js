class Menu {
  SKIN_PREVIEW_SIZE = 100; // pixels
  constructor() {
    this.menu = document.getElementById('skin-menu');
    // this.startButton = document.getElementById('start-button');
    // this.skinButton = document.getElementById('skin-button');
    // this.scoreDisplay = document.getElementById('score-display');
    // this.highScoreDisplay = document.getElementById('high-score-display');

    this.unlockedSkins = JSON.parse(localStorage.getItem('unlockedSkins') || '["Classic"]'); // always have Classic
    this.updateArrows();

    this.currentSkin = localStorage.getItem('currentSkin') || 'Classic';
    this.currentSkinIndex = this.unlockedSkins.indexOf(this.currentSkin) || 0;
    this.previewURLs = {}

    this.leftArrow = document.getElementById('skin-left');
    this.rightArrow = document.getElementById('skin-right');
    this.leftArrow.addEventListener('click', () => {
      this.currentSkinIndex--;
      if (this.currentSkinIndex < 0) this.currentSkinIndex = this.unlockedSkins.length - 1;
      this.updateSkinDisplay(this.currentSkinIndex);
      this.updateArrows();
    });
    this.rightArrow.addEventListener('click', () => {
      this.currentSkinIndex++;
      if (this.currentSkinIndex >= this.unlockedSkins.length) this.currentSkinIndex = 0;
      this.updateSkinDisplay(this.currentSkinIndex);
      this.updateArrows();
    });
  }

  updateSkinDisplay(index) {
    this.currentSkin = this.unlockedSkins[index];
    localStorage.setItem('currentSkin', this.currentSkin);

    const skinData = ALL_SKINS[currentSkin];
    const display = document.getElementById('current-skin-display');
    const nameDisplay = document.getElementById('skin-name');

    if (display && skinData) {
      nameDisplay.innerText = skinData.name;
      if (!this.previewURLs[this.currentSkin]) {
        this.previewURLs[this.currentSkin] = this.createPreview(this.currentSkin);
      }
      const previewURL = this.previewURLs[this.currentSkin];

      display.innerHTML = ''; // clear previous preview
      const img = document.createElement('img');
      img.src = previewURL;
      img.width = this.SKIN_PREVIEW_SIZE;
      img.height = this.SKIN_PREVIEW_SIZE;
      display.appendChild(img);
    }

  }

  updateArrows() {
    const leftArrow = document.getElementById('skin-left');
    const rightArrow = document.getElementById('skin-right');

    if (this.unlockedSkins.length <= 1) {
      // Only one skin: disable arrows
      leftArrow.disabled = true;
      rightArrow.disabled = true;
      leftArrow.style.opacity = 0;
      rightArrow.style.opacity = 0;
      leftArrow.style.cursor = 'default';
      rightArrow.style.cursor = 'default';
    } else {
      leftArrow.disabled = false;
      rightArrow.disabled = false;
      leftArrow.style.opacity = 1;
      rightArrow.style.opacity = 1;
      leftArrow.style.cursor = 'pointer';
      rightArrow.style.cursor = 'pointer';
    }
  }

  createPreview(skinName) {
    const skin = ALL_SKINS[skinName];
    const previewURL = this.previewURLs[skinName];
    // Create a canvas for the preview
    const canvas = document.createElement('canvas');
    canvas.width = this.SKIN_PREVIEW_SIZE;
    canvas.height = this.SKIN_PREVIEW_SIZE;
    const ctx = canvas.getContext('2d');

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const size = this.SKIN_PREVIEW_SIZE; // draw wings and body at full preview size

    // --- Back wing ---
    if (skin.backWing && skin.backWing.complete) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(0); // resting angle
      ctx.drawImage(skin.backWing, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    // --- Body ---
    if (skin.body && skin.body.complete) {
      ctx.drawImage(skin.body, centerX - size / 2, centerY - size / 2, size, size);
    }

    // --- Front wing ---
    if (skin.frontWing && skin.frontWing.complete) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(0); // resting angle
      ctx.drawImage(skin.frontWing, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    return canvas.toDataURL(); // returns a preview image URL
  }
  show() {
    if (this.menu) this.menu.style.display = 'block';
    this.updateSkinDisplay(this.currentSkinIndex);
  }
  hide() {
    if (this.menu) this.menu.style.display = 'none';
  }
}