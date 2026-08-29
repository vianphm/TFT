/**
 * Nap dau tien tren moi trang renderer (truoc cac script khac) de bat loi
 * chay ngam (script hong cu phap, exception khong bat duoc...) va day ra
 * console.error - nho vay cong cu smoke test (scripts/smoke.js) moi thay
 * duoc thay vi im lang bo qua.
 */
(function () {
  'use strict';
  window.addEventListener('error', function (event) {
    var where = event.filename ? ' (' + event.filename + ':' + event.lineno + ')' : '';
    console.error('Loi chua bat: ' + (event.message || event.error) + where);
  });
  window.addEventListener('unhandledrejection', function (event) {
    console.error('Promise bi tu choi khong bat: ' + (event.reason && event.reason.message || event.reason));
  });
  document.addEventListener('securitypolicyviolation', function (event) {
    console.error('CSP vi pham: ' + event.violatedDirective + ' - ' + event.blockedURI +
      ' tai ' + event.sourceFile + ':' + event.lineNumber + ':' + event.columnNumber);
  });
})();
