function showLootBox(onComplete, message = '') {
  lootBoxActive = true;
  const container = document.getElementById('game-container');
  if (!container) return;

  // Create loot box container
  const boxWrapper = document.createElement('div');
  boxWrapper.style.position = 'absolute';
  boxWrapper.style.left = '50%';
  boxWrapper.style.top = '50%';
  boxWrapper.style.transform = 'translate(-50%, -50%)';
  boxWrapper.style.display = 'flex';
  boxWrapper.style.flexDirection = 'column';
  boxWrapper.style.alignItems = 'center';
  boxWrapper.style.gap = '10px';
  boxWrapper.style.zIndex = 10000;

  // Message above box
  const msgDiv = document.createElement('div');
  msgDiv.style.color = 'gold'; // make text pop
  msgDiv.style.fontSize = '18px';
  msgDiv.style.textAlign = 'center';
  msgDiv.style.minHeight = '24px';
  msgDiv.innerText = message;

  // Box itself (scaled to SKIN_PREVIEW_SIZE)
  const box = document.createElement('div');
  box.style.width = SKIN_PREVIEW_SIZE + 'px';
  box.style.height = SKIN_PREVIEW_SIZE + 'px';
  box.style.background = '#333';
  box.style.border = '3px solid gold';
  box.style.borderRadius = '12px';
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.cursor = 'pointer';
  box.style.fontSize = Math.floor(SKIN_PREVIEW_SIZE * 0.22) + 'px'; // scale emoji
  box.style.color = 'white';
  box.innerText = '🎁'; // gift icon initially

  boxWrapper.appendChild(msgDiv);
  boxWrapper.appendChild(box);
  container.appendChild(boxWrapper);

  box.addEventListener('click', () => {
    // Get locked skins
    const lockedSkinKeys = Object.keys(ALL_SKINS).filter(key => !unlockedSkins.includes(key));
    let newSkinKey;
    if (lockedSkinKeys.length > 0) {
      newSkinKey = lockedSkinKeys[Math.floor(Math.random() * lockedSkinKeys.length)];
      const newSkin = ALL_SKINS[newSkinKey];

      // Unlock
      unlockedSkins.push(newSkinKey);
      localStorage.setItem('unlockedSkins', JSON.stringify(unlockedSkins));
      updateSkinMenuArrows();

      // Set current
      currentSkin = newSkinKey;
      currentSkinIndex = unlockedSkins.indexOf(currentSkin);
      localStorage.setItem('currentSkin', currentSkin);
      updateSkinDisplay();

      msgDiv.innerText = `Unlocked: ${newSkin.name}`;

      // Show full preview (body + wings) inside box
      box.innerHTML = '';
      const previewURL = createSkinPreview(newSkinKey);
      const img = new Image();
      img.src = previewURL;
      img.style.width = SKIN_PREVIEW_SIZE * 0.9 + 'px';
      img.style.height = SKIN_PREVIEW_SIZE * 0.9 + 'px';
      box.appendChild(img);
    } else {
      // All skins unlocked: show rat emoji
      msgDiv.innerText = 'All skins unlocked!';
      box.style.background = '#666';
      box.innerText = '🐀';
    }

    // sparkles
    for (let i = 0; i < 15; i++) spawnTinyProgressParticle();

    setTimeout(() => {
      boxWrapper.remove();
      lootBoxActive = false; // set inactive after box disappears
      if (onComplete) onComplete(); // call the callback after delay
    }, 1500);
  });
}


