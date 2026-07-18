/* ── Announcements: user-facing slideshow + admin CRUD ────────────
   Slideshow shown once per user (auto, on bootstrap) and replayable
   in full via the Profile "Що нового?" entry. Admin CRUD lives here
   too since this is a self-contained feature with no prior home. */

/* ── Slideshow ─────────────────────────────────────────────────── */

let _anSlides = [];
let _anCurrent = 0;
let _anTouchStartX = 0;

function _anBuildSlideHtml(a, i) {
  const hasText = !!(a.title || a.description);
  const textBlock = hasText ? `
    <div class="an-slide-title">${esc(a.title || '')}</div>
    ${a.description ? `<div class="an-slide-desc">${esc(a.description)}</div>` : ''}
  ` : '';

  if (a.photoData) {
    return `<div class="an-slide" data-idx="${i}">
      <img class="an-slide-photo" src="${esc(a.photoData)}" alt="">
      ${hasText ? `<div class="an-slide-card an-slide-card-photo">${textBlock}</div>` : ''}
    </div>`;
  }
  return `<div class="an-slide" data-idx="${i}">
    <div class="an-slide-card an-slide-card-solid">${textBlock}</div>
  </div>`;
}

function _anGoTo(idx) {
  const slides = document.querySelectorAll('#announce-slides .an-slide');
  const dots = document.querySelectorAll('#announce-dots .an-dot');
  const leaving = _anCurrent;
  slides[leaving].classList.remove('an-active');
  slides[leaving].classList.add('an-prev');
  setTimeout(() => slides[leaving].classList.remove('an-prev'), 300);
  dots[leaving].classList.remove('an-dot-active');
  _anCurrent = idx;
  slides[_anCurrent].classList.add('an-active');
  dots[_anCurrent].classList.add('an-dot-active');
}

function openAnnouncementSlideshow(list) {
  if (!list || !list.length) return;
  _anSlides = list;
  _anCurrent = 0;

  document.getElementById('announce-slides').innerHTML = list.map(_anBuildSlideHtml).join('');
  document.getElementById('announce-dots').innerHTML = list.map((a, i) =>
    `<div class="an-dot${i === 0 ? ' an-dot-active' : ''}" data-dot="${i}"></div>`
  ).join('');
  document.querySelector('#announce-slides .an-slide').classList.add('an-active');

  document.querySelectorAll('#announce-dots .an-dot').forEach((d, i) => {
    d.addEventListener('click', () => _anGoTo(i));
  });

  document.getElementById('announce-overlay').classList.remove('an-hidden');
}

function closeAnnouncementSlideshow() {
  document.getElementById('announce-overlay').classList.add('an-hidden');
  const ids = _anSlides.map(a => a.id);
  _anSlides = [];
  if (ids.length) {
    API.announcements.markSeen(ids).catch(() => {});
  }
}

document.getElementById('announce-close').addEventListener('click', closeAnnouncementSlideshow);

(() => {
  const overlay = document.getElementById('announce-overlay');
  overlay.addEventListener('touchstart', e => { _anTouchStartX = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    if (!_anSlides.length) return;
    const dx = e.changedTouches[0].clientX - _anTouchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && _anCurrent < _anSlides.length - 1) _anGoTo(_anCurrent + 1);
      else if (dx > 0 && _anCurrent > 0) _anGoTo(_anCurrent - 1);
    }
  }, { passive: true });
})();

async function checkUnseenAnnouncements() {
  try {
    const unseen = await API.announcements.unseen();
    openAnnouncementSlideshow(unseen);
  } catch (e) { /* silent — non-critical */ }
}

async function openWhatsNew() {
  try {
    const active = await API.announcements.active();
    if (!active.length) { showToast('Поки що немає оголошень', 'info'); return; }
    openAnnouncementSlideshow(active);
  } catch (e) {
    showToast('Помилка завантаження оголошень', 'error');
  }
}

/* ── Admin CRUD ────────────────────────────────────────────────── */

let announcementsAdminList = [];
let editingAnnouncementId = null;
let pendingPhotoData = null;

async function openAnnouncementsAdminModal() {
  openModal('modal-announcements-admin');
  await refreshAnnouncementsAdminList();
}

async function refreshAnnouncementsAdminList() {
  const list = document.getElementById('ann-admin-list');
  list.innerHTML = '<div style="color:var(--text-sec);font-size:13px;padding:12px 0">Завантаження...</div>';
  try {
    announcementsAdminList = await API.announcements.adminList();
  } catch (e) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">Помилка: ${esc(e.message)}</div>`;
    return;
  }
  renderAnnouncementsAdminList();
}

function renderAnnouncementsAdminList() {
  const list = document.getElementById('ann-admin-list');
  if (!announcementsAdminList.length) {
    list.innerHTML = '<div style="color:var(--text-sec);font-size:13px;padding:12px 0">Ще немає оголошень</div>';
    return;
  }
  list.innerHTML = announcementsAdminList.map((a, i) => {
    const snippet = a.title || a.description || '(лише фото)';
    return `<div class="ann-row" data-id="${a.id}">
      ${a.photoData
        ? `<img class="ann-row-thumb" src="${esc(a.photoData)}" alt="">`
        : `<div class="ann-row-placeholder">📢</div>`}
      <div class="ann-row-body">
        <div class="ann-row-title">${esc(snippet)}</div>
        ${a.title && a.description ? `<div class="ann-row-desc">${esc(a.description)}</div>` : ''}
      </div>
      <div class="ann-row-actions">
        <button class="ann-icon-btn" data-act="up" ${i === 0 ? 'disabled style="opacity:0.3"' : ''}>↑</button>
        <button class="ann-icon-btn" data-act="down" ${i === announcementsAdminList.length - 1 ? 'disabled style="opacity:0.3"' : ''}>↓</button>
        <button class="ach-toggle-btn ${a.active ? 'on' : 'off'}" data-act="toggle">${a.active ? 'Увімк.' : 'Вимк.'}</button>
        <button class="ann-icon-btn" data-act="edit">✎</button>
        <button class="ann-icon-btn" data-act="delete">🗑</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.ann-row').forEach(row => {
    const id = parseInt(row.dataset.id);
    const a = announcementsAdminList.find(x => x.id === id);
    row.querySelector('[data-act="up"]')?.addEventListener('click', () => moveAnnouncement(id, -1));
    row.querySelector('[data-act="down"]')?.addEventListener('click', () => moveAnnouncement(id, 1));
    row.querySelector('[data-act="toggle"]').addEventListener('click', () => toggleAnnouncementActive(a));
    row.querySelector('[data-act="edit"]').addEventListener('click', () => openEditAnnouncement(a));
    row.querySelector('[data-act="delete"]').addEventListener('click', () => deleteAnnouncement(a));
  });
}

async function moveAnnouncement(id, direction) {
  const idx = announcementsAdminList.findIndex(a => a.id === id);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= announcementsAdminList.length) return;
  [announcementsAdminList[idx], announcementsAdminList[swapIdx]] = [announcementsAdminList[swapIdx], announcementsAdminList[idx]];
  renderAnnouncementsAdminList();
  try {
    await API.announcements.reorder(announcementsAdminList.map(a => a.id));
  } catch (e) {
    showToast('Помилка збереження порядку', 'error');
    await refreshAnnouncementsAdminList();
  }
}

async function toggleAnnouncementActive(a) {
  try {
    const updated = await API.announcements.setActive(a.id, !a.active);
    a.active = updated.active;
    renderAnnouncementsAdminList();
  } catch (e) {
    showToast('Помилка: ' + (e.message || 'невідома'), 'error');
  }
}

async function deleteAnnouncement(a) {
  const ok = await uiConfirm('Видалити це оголошення?');
  if (!ok) return;
  try {
    await API.announcements.delete(a.id);
    announcementsAdminList = announcementsAdminList.filter(x => x.id !== a.id);
    renderAnnouncementsAdminList();
  } catch (e) {
    showToast('Помилка видалення', 'error');
  }
}

function _anResetForm() {
  editingAnnouncementId = null;
  pendingPhotoData = null;
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-description').value = '';
  document.getElementById('ann-photo-preview').src = '';
  document.getElementById('ann-photo-preview').classList.add('hidden');
  document.getElementById('ann-photo-remove').style.display = 'none';
  document.getElementById('ann-photo-input').value = '';
}

function openCreateAnnouncement() {
  _anResetForm();
  document.getElementById('ann-form-title').textContent = 'Нове оголошення';
  document.getElementById('ann-submit').textContent = 'Зберегти';
  openModal('modal-announcement-form');
}

function openEditAnnouncement(a) {
  _anResetForm();
  editingAnnouncementId = a.id;
  pendingPhotoData = a.photoData || null;
  document.getElementById('ann-form-title').textContent = 'Редагувати оголошення';
  document.getElementById('ann-submit').textContent = 'Зберегти';
  document.getElementById('ann-title').value = a.title || '';
  document.getElementById('ann-description').value = a.description || '';
  if (a.photoData) {
    const preview = document.getElementById('ann-photo-preview');
    preview.src = a.photoData;
    preview.classList.remove('hidden');
    document.getElementById('ann-photo-remove').style.display = '';
  }
  openModal('modal-announcement-form');
}

function resizeImageToBase64(file, maxDim = 2048, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не вдалося прочитати файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не вдалося завантажити зображення'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        // Downscale in halving steps: a single drawImage pass from a large
        // source aliases badly; halving keeps the smoothing kernel effective.
        let src = img;
        let sw = img.width, sh = img.height;
        while (sw / 2 >= width && sh / 2 >= height) {
          sw = Math.round(sw / 2);
          sh = Math.round(sh / 2);
          const step = document.createElement('canvas');
          step.width = sw;
          step.height = sh;
          const sctx = step.getContext('2d');
          sctx.imageSmoothingQuality = 'high';
          sctx.drawImage(src, 0, 0, sw, sh);
          src = step;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('ann-photo-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pendingPhotoData = await resizeImageToBase64(file);
    const preview = document.getElementById('ann-photo-preview');
    preview.src = pendingPhotoData;
    preview.classList.remove('hidden');
    document.getElementById('ann-photo-remove').style.display = '';
  } catch (err) {
    showToast(err.message || 'Помилка обробки фото', 'error');
  }
});

document.getElementById('ann-photo-remove').addEventListener('click', () => {
  pendingPhotoData = null;
  document.getElementById('ann-photo-input').value = '';
  document.getElementById('ann-photo-preview').src = '';
  document.getElementById('ann-photo-preview').classList.add('hidden');
  document.getElementById('ann-photo-remove').style.display = 'none';
});

document.getElementById('ann-submit').addEventListener('click', async () => {
  const title = document.getElementById('ann-title').value.trim() || null;
  const description = document.getElementById('ann-description').value.trim() || null;
  const photoData = pendingPhotoData;

  if (!title && !description && !photoData) {
    showToast('Додайте заголовок, опис або фото', 'error');
    return;
  }

  const payload = { title, description, photoData };
  const btn = document.getElementById('ann-submit');
  btn.disabled = true;
  try {
    if (editingAnnouncementId) {
      await API.announcements.update(editingAnnouncementId, payload);
    } else {
      await API.announcements.create(payload);
    }
    closeModal('modal-announcement-form');
    showToast('Збережено', 'success');
    await refreshAnnouncementsAdminList();
  } catch (e) {
    showToast('Помилка: ' + (e.message || 'невідома'), 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('ann-create-btn').addEventListener('click', openCreateAnnouncement);
