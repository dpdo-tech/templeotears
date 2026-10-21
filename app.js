(function () {
  'use strict';
  var S = window.SHOP;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- утилиты ----------
  // Чистим пользовательский ввод: без управляющих символов, с ограничением длины.
  function clean(v, max) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);
  }
  function rub(n) { return n.toLocaleString('ru-RU') + ' ' + S.currency; }
  function setMsg(el, text, cls) { el.textContent = text; el.className = 'muted ' + (cls || ''); }
  function sha256(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } t.remove();
    });
  }

  // ---------- данные продавца и даты ----------
  var sellerMap = { name: S.seller.name, inn: S.seller.inn, ogrnip: S.seller.ogrnip, email: S.seller.email, phone: S.seller.phone, city: S.seller.city };
  Object.keys(sellerMap).forEach(function (k) {
    $$('.seller-' + k).forEach(function (el) { el.textContent = sellerMap[k]; });
  });
  var today = new Date().toLocaleDateString('ru-RU');
  $$('.today').forEach(function (el) { el.textContent = today; });
  $('#price-main').textContent = rub(S.price);
  $('#price-spec').textContent = rub(S.price);
  $('#return-addr').textContent = 'Получатель возврата:\n' + S.seller.returnAddress;
  if (S.telegramUser) {
    var a = document.createElement('a');
    a.href = 'https://t.me/' + encodeURIComponent(S.telegramUser);
    a.rel = 'noopener noreferrer'; a.target = '_blank';
    a.textContent = '@' + S.telegramUser;
    var tg = $('#tg-line'); tg.textContent = ''; tg.appendChild(a);
  }

  // ---------- лексикон ----------
  var LEX = [
    ['PSL', 'шкала оценки внешности по форуму PSL'],
    ['HTN', 'high-tier normie, нормис высокого уровня'],
    ['MTN', 'mid-tier normie, нормис среднего уровня'],
    ['LTN', 'low-tier normie, нормис низкого уровня'],
    ['CHAD', 'эталон привлекательного мужчины в сленге'],
    ['MOG', 'превзойти кого-то внешностью'],
    ['LOOKSMAX', 'прокачка внешности всеми способами'],
    ['MEWING', 'постановка языка ради «правильной» челюсти'],
    ['CT', 'canthal tilt, наклон линии глаз'],
    ['GA', 'gonial angle, угол нижней челюсти'],
    ['FWHR', 'отношение ширины лица к высоте'],
    ['IPD', 'расстояние между зрачками'],
    ['PFL', 'длина глазной щели'],
    ['UEE', 'открытость верхнего века'],
    ['NW', 'шкала Норвуда, про залысины'],
    ['SMV', 'sexual market value, «рыночная стоимость»']
  ];
  var grid = $('#lex-grid');
  var marq = $('#marquee');
  function addTagSet() {
    LEX.forEach(function (p) { var s = document.createElement('span'); s.textContent = p[0]; marq.appendChild(s); });
  }
  addTagSet(); addTagSet(); // дважды для бесшовной прокрутки
  LEX.forEach(function (p) {
    var c = document.createElement('div'); c.className = 'card';
    var b = document.createElement('b'); b.textContent = p[0];
    var s = document.createElement('span'); s.textContent = p[1];
    c.appendChild(b); c.appendChild(s); grid.appendChild(c);
  });

  // ---------- роутер вкладок ----------
  var routes = $$('[data-route]').map(function (s) { return s.getAttribute('data-route'); });
  function show() {
    var h = location.hash.replace(/^#\/?/, '');
    var r = routes.indexOf(h) > -1 ? h : 'home';
    $$('[data-route]').forEach(function (s) { s.hidden = s.getAttribute('data-route') !== r; });
    $$('.bar [data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === r); });
    if (r !== 'home' || routes.indexOf(h) > -1 || !h) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', show);
  show();
  $$('[data-scroll]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = document.getElementById(a.getAttribute('data-scroll'));
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ---------- заказ ----------
  var discount = 0;
  var form = $('#order-form');
  function updateTotal() { $('#total').textContent = rub(Math.round(S.price * (100 - discount) / 100)); }
  updateTotal();

  $('#promo-apply').addEventListener('click', function () {
    var code = clean(form.elements.promo.value, 40).toUpperCase();
    var msg = $('#promo-msg');
    if (!code) { discount = 0; updateTotal(); setMsg(msg, ''); return; }
    sha256(code).then(function (h) {
      if (Object.prototype.hasOwnProperty.call(S.promos, h)) {
        discount = Math.min(90, Math.max(0, +S.promos[h] || 0));
        setMsg(msg, 'Промокод применён: скидка ' + discount + '%.', 'ok');
      } else {
        discount = 0; setMsg(msg, 'Такого промокода нет.', 'err');
      }
      updateTotal();
    });
  });

  var lastSend = 0;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#order-msg');
    var f = form.elements;
    if (f.website.value) return; // ловушка для ботов
    var name = clean(f.name.value, 80), contact = clean(f.contact.value, 80), size = clean(f.size.value, 4);
    if (!name || !contact || ['S', 'M', 'L', 'XL'].indexOf(size) < 0) { setMsg(msg, 'Заполните имя, контакт и размер.', 'err'); return; }
    if (!f.agree.checked) { setMsg(msg, 'Нужно согласие с офертой и политикой приватности.', 'err'); return; }
    if (Date.now() - lastSend < 3000) return; // от двойных кликов и ботов
    lastSend = Date.now();
    var total = Math.round(S.price * (100 - discount) / 100);
    var text = 'Заказ THE LARP TRIAD\nИмя: ' + name + '\nКонтакт: ' + contact + '\nРазмер: ' + size +
      '\nСкидка: ' + discount + '%\nИтого: ' + total + ' ' + S.currency;
    if (S.telegramUser) {
      var url = 'https://t.me/' + encodeURIComponent(S.telegramUser) + '?text=' + encodeURIComponent(text);
      window.open(url, '_blank', 'noopener,noreferrer');
      setMsg(msg, 'Откроется Telegram. Отправьте сообщение, пока оно не отправлено, заказ не принят.', 'ok');
    } else {
      copyText(text).then(function () {
        setMsg(msg, 'Сообщение скопировано. Отправьте его продавцу, пока оно не отправлено, заказ не принят.', 'ok');
      }, function () { setMsg(msg, text, ''); });
    }
  });

  // ---------- возврат ----------
  var rform = $('#return-form'), rout = $('#return-out'), rtext = $('#return-text');
  var rmsg = $('#r-msg');
  rform.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = rform.elements;
    if (f.website.value) return; // ловушка для ботов
    var v = {
      fio: clean(f.fio.value, 120), order: clean(f.order.value, 60), contact: clean(f.contact.value, 100),
      reason: clean(f.reason.value, 60), comment: clean(f.comment.value, 500), refund: clean(f.refund.value, 80)
    };
    if (!v.fio || !v.order || !v.contact || !v.reason || !v.refund) { setMsg(rmsg, 'Заполните все обязательные поля.', 'err'); rout.hidden = false; return; }
    var text =
      'Заявление на возврат товара\n\n' +
      'Кому: ' + S.seller.name + ' (ИНН ' + S.seller.inn + ')\n' +
      'От: ' + v.fio + '\n' +
      'Контакт: ' + v.contact + '\n' +
      'Дата: ' + new Date().toLocaleDateString('ru-RU') + '\n\n' +
      'Прошу принять возврат товара THE LARP TRIAD (футболка) по заказу: ' + v.order + '.\n' +
      'Причина возврата: ' + v.reason + '.\n' +
      (v.comment ? 'Комментарий: ' + v.comment + '\n' : '') +
      'Способ возврата денежных средств: ' + v.refund + '.\n\n' +
      'Товар не использовался, товарный вид и ярлыки сохранены.\n' +
      'Номер накладной СДЭК для возврата пришлю дополнительно.\n\n' +
      'Подпись: ' + v.fio;
    rtext.textContent = text; rout.hidden = false; setMsg(rmsg, '');
    var subj = 'Заявление на возврат, заказ ' + v.order;
    $('#r-mail').href = 'mailto:' + encodeURIComponent(S.seller.email).replace(/%40/g, '@') +
      '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(text);
    rout.scrollIntoView({ behavior: 'smooth' });
  });
  $('#r-copy').addEventListener('click', function () {
    copyText(rtext.textContent).then(function () { setMsg(rmsg, 'Скопировано.', 'ok'); }, function () { setMsg(rmsg, 'Не удалось скопировать, выделите текст вручную.', 'err'); });
  });
  $('#r-txt').addEventListener('click', function () {
    var url = URL.createObjectURL(new Blob([rtext.textContent], { type: 'text/plain;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = 'zayavlenie-na-vozvrat.txt';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  $('#r-print').addEventListener('click', function () { window.print(); });

  // ---------- кнопки СДЭК ----------
  $$('[data-cdek]').forEach(function (a) {
    var key = a.getAttribute('data-cdek');
    var url = S.cdek[key];
    if (!/^https:\/\/([a-z0-9-]+\.)*cdek\.ru\//i.test(url || '')) { a.hidden = true; return; } // только официальный домен
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  });

  // ---------- музыка ----------
  // Браузеры запрещают автозапуск со звуком, поэтому музыка стартует при первом
  // касании или клике по странице. Кнопка в углу включает и выключает звук.
  var bgm = $('#bgm'), mbtn = $('#music');
  if (bgm && mbtn) {
    var userOff = false;
    function setUi(on) {
      mbtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      mbtn.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
    }
    function play() {
      bgm.volume = 0.5;
      try { bgm.load(); } catch (e) {}
      var p = bgm.play();
      if (p && p.then) p.then(function () { setUi(true); mbtn.title = 'Музыка'; }, function (err) {
        setUi(false);
        if (err && err.name === 'NotSupportedError') mbtn.title = 'Файл музыки не найден или не поддерживается';
      });
    }
    function firstGesture(e) {
      if (mbtn.contains(e.target)) return; // клик по самой кнопке обрабатывает её обработчик
      if (!userOff && bgm.paused) play();
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.removeEventListener(t, firstGesture); });
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.addEventListener(t, firstGesture, { passive: true }); });
    mbtn.addEventListener('click', function () {
      if (bgm.paused) { userOff = false; play(); } else { userOff = true; bgm.pause(); setUi(false); }
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { document.removeEventListener(t, firstGesture); });
    });
  }

  // ---------- просмотр фото: приближение, сдвиг, листание ----------
  var lb = $('#lb'), lbImg = $('#lb-img'), lbStage = $('#lb-stage');
  var gallery = $$('.tee-pair .tee');
  if (lb && lbImg && gallery.length) {
    var cur = 0, sc = 1, tx = 0, ty = 0, MIN = 1, MAX = 6, ptrs = {}, lastDist = 0, lastMid = null, lastTap = 0, opener = null;
    function apply() {
      if (sc <= 1.001) { sc = 1; tx = 0; ty = 0; }
      lbImg.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
    }
    function setScale(ns, px, py) { // px, py: точка относительно центра окна
      ns = Math.min(MAX, Math.max(MIN, ns));
      tx = px - (px - tx) * (ns / sc); ty = py - (py - ty) * (ns / sc); sc = ns; apply();
    }
    function rel(e) { var r = lbStage.getBoundingClientRect(); return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }; }
    function show(i) {
      cur = (i + gallery.length) % gallery.length;
      lbImg.src = gallery[cur].currentSrc || gallery[cur].src; lbImg.alt = gallery[cur].alt || '';
      sc = 1; tx = 0; ty = 0; apply();
      var multi = gallery.length > 1; $('#lb-prev').hidden = !multi; $('#lb-next').hidden = !multi;
    }
    function open(i) { opener = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; show(i); $('#lb-x').focus(); }
    function close() { lb.hidden = true; document.body.style.overflow = ''; ptrs = {}; if (opener && opener.focus) opener.focus(); }
    gallery.forEach(function (img, i) {
      img.tabIndex = 0; img.setAttribute('role', 'button');
      img.addEventListener('click', function () { open(i); });
      img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    $('#lb-x').addEventListener('click', close);
    $('#lb-prev').addEventListener('click', function () { show(cur - 1); });
    $('#lb-next').addEventListener('click', function () { show(cur + 1); });
    $('#lb-in').addEventListener('click', function () { setScale(sc * 1.5, 0, 0); });
    $('#lb-out').addEventListener('click', function () { setScale(sc / 1.5, 0, 0); });
    $('#lb-reset').addEventListener('click', function () { sc = 1; apply(); });
    lbStage.addEventListener('wheel', function (e) {
      e.preventDefault(); var p = rel(e); setScale(sc * (e.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
    }, { passive: false });
    lbStage.addEventListener('dblclick', function (e) { var p = rel(e); if (sc > 1.01) { sc = 1; apply(); } else setScale(2.5, p.x, p.y); });
    lbStage.addEventListener('pointerdown', function (e) {
      lbStage.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      lbStage.classList.add('drag'); lastDist = 0;
      if (e.pointerType === 'touch') { var now = Date.now(); if (now - lastTap < 300) { var p = rel(e); if (sc > 1.01) { sc = 1; apply(); } else setScale(2.5, p.x, p.y); } lastTap = now; }
    });
    lbStage.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      var prev = ptrs[e.pointerId]; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length >= 2) { // щипок
        var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        var r = lbStage.getBoundingClientRect(), mx = (a.x + b.x) / 2 - r.left - r.width / 2, my = (a.y + b.y) / 2 - r.top - r.height / 2;
        if (lastDist) setScale(sc * d / lastDist, mx, my);
        lastDist = d;
      } else if (sc > 1) { tx += e.clientX - prev.x; ty += e.clientY - prev.y; apply(); }
    });
    function up(e) { delete ptrs[e.pointerId]; lastDist = 0; if (!Object.keys(ptrs).length) lbStage.classList.remove('drag'); }
    lbStage.addEventListener('pointerup', up); lbStage.addEventListener('pointercancel', up);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(cur - 1);
      else if (e.key === 'ArrowRight') show(cur + 1);
      else if (e.key === '+' || e.key === '=') setScale(sc * 1.3, 0, 0);
      else if (e.key === '-') setScale(sc / 1.3, 0, 0);
    });
    window.addEventListener('hashchange', function () { if (!lb.hidden) close(); });
  }
})();
