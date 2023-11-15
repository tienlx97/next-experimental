if (process.env.NEXT_RUNTIME === "edge") {
    module.exports = require("next/dist/server/future/route-modules/app-route/module.js");
} else {
    if (process.env.NODE_ENV === "development") {
        module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");
    } else if (process.env.TURBOPACK) {
        module.exports = require("next/dist/compiled/next-server/app-route-turbo.runtime.prod.js");
    } else {
        module.exports = require("next/dist/compiled/next-server/app-route.runtime.prod.js");
    }
}

//# sourceMappingURL=module.compiled.js.map