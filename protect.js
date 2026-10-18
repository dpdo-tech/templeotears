// Защита на стороне клиента. Это сдерживание, а не абсолютная защита:
// всё, что браузер показывает пользователю, он может получить.
(function () {
  'use strict';

  // 1. Запрет открытия сайта во фрейме (clickjacking, зеркала через iframe)
  try {
    if (window.top !== window.self) { window.top.location.replace(window.self.location.href); }
  } catch (e) { document.documentElement.textContent = ''; }

  // 1b. Блокировка клонов: на чужом домене сайт не работает
  try {
    var hosts = (window.SHOP && window.SHOP.allowedHosts) || [];
    if (hosts.length && hosts.indexOf(location.hostname) === -1) {
      var orig = 'https://' + hosts[0] + location.pathname;
      document.documentElement.innerHTML = '<body style="background:#0a0a0a;color:#fff;font:18px sans-serif;padding:40px;text-align:center">' +
        '<h1>Это копия сайта</h1><p>Оформлять заказы здесь небезопасно. Настоящий сайт: ' + hosts[0] + '</p></body>';
      throw new Error('blocked');
    }
  } catch (e) { if (e && e.message === 'blocked') return; }

  // 2. Сдерживание копирования кода и картинок
  var block = function (e) { e.preventDefault(); return false; };
  document.addEventListener('contextmenu', block);
  document.addEventListener('dragstart', block);
  document.addEventListener('copy', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (t && t.closest && t.closest('#return-text')) return;
    e.preventDefault();
  });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F12' ||
        (ctrl && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
        (ctrl && (k === 'u' || k === 's')) ||
        (e.metaKey && e.altKey && (k === 'i' || k === 'u' || k === 'j'))) {
      e.preventDefault();
    }
  });

  // 3. Предупреждение в консоли
  try {
    console.log('%cСтоп', 'font:900 48px sans-serif;color:#f33');
    console.log('%cНе вставляйте сюда чужой код: так крадут данные заказов.', 'font:16px sans-serif');
  } catch (e) {}

  // 4. Заморозка конфигурации и прототипов от подмены
  try {
    if (window.SHOP) {
      Object.freeze(window.SHOP.seller); Object.freeze(window.SHOP.cdek);
      Object.freeze(window.SHOP.promos); Object.freeze(window.SHOP);
    }
  } catch (e) {}
})();
