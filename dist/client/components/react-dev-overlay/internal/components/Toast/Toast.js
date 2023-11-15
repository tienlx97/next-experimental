"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Toast", {
    enumerable: true,
    get: function() {
        return Toast;
    }
});
const _interop_require_wildcard = require("@swc/helpers/_/_interop_require_wildcard");
const _react = /*#__PURE__*/ _interop_require_wildcard._(require("react"));
const Toast = function Toast(param) {
    let { onClick, children, className } = param;
    return /*#__PURE__*/ _react.createElement("div", {
        "data-nextjs-toast": true,
        onClick: onClick,
        className: className
    }, /*#__PURE__*/ _react.createElement("div", {
        "data-nextjs-toast-wrapper": true
    }, children));
};

if ((typeof exports.default === 'function' || (typeof exports.default === 'object' && exports.default !== null)) && typeof exports.default.__esModule === 'undefined') {
  Object.defineProperty(exports.default, '__esModule', { value: true });
  Object.assign(exports.default, exports);
  module.exports = exports.default;
}

//# sourceMappingURL=Toast.js.map