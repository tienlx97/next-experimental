import { ACTION, RSC_HEADER, RSC_CONTENT_TYPE_HEADER } from "../../client/components/app-router-headers";
import { isNotFoundError } from "../../client/components/not-found";
import { getURLFromRedirectError, isRedirectError } from "../../client/components/redirect";
import RenderResult from "../render-result";
import { FlightRenderResult } from "./flight-render-result";
import { filterReqHeaders, actionsForbiddenHeaders } from "../lib/server-ipc/utils";
import { appendMutableCookies, getModifiedCookieValues } from "../web/spec-extension/adapters/request-cookies";
import { NEXT_CACHE_REVALIDATED_TAGS_HEADER, NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER } from "../../lib/constants";
function formDataFromSearchQueryString(query) {
    const searchParams = new URLSearchParams(query);
    const formData = new FormData();
    for (const [key, value] of searchParams){
        formData.append(key, value);
    }
    return formData;
}
function nodeHeadersToRecord(headers) {
    const record = {};
    for (const [key, value] of Object.entries(headers)){
        if (value !== undefined) {
            record[key] = Array.isArray(value) ? value.join(", ") : `${value}`;
        }
    }
    return record;
}
function getForwardedHeaders(req, res) {
    // Get request headers and cookies
    const requestHeaders = req.headers;
    const requestCookies = requestHeaders["cookie"] ?? "";
    // Get response headers and Set-Cookie header
    const responseHeaders = res.getHeaders();
    const rawSetCookies = responseHeaders["set-cookie"];
    const setCookies = (Array.isArray(rawSetCookies) ? rawSetCookies : [
        rawSetCookies
    ]).map((setCookie)=>{
        // remove the suffixes like 'HttpOnly' and 'SameSite'
        const [cookie] = `${setCookie}`.split(";", 1);
        return cookie;
    });
    // Merge request and response headers
    const mergedHeaders = filterReqHeaders({
        ...nodeHeadersToRecord(requestHeaders),
        ...nodeHeadersToRecord(responseHeaders)
    }, actionsForbiddenHeaders);
    // Merge cookies
    const mergedCookies = requestCookies.split("; ").concat(setCookies).join("; ");
    // Update the 'cookie' header with the merged cookies
    mergedHeaders["cookie"] = mergedCookies;
    // Remove headers that should not be forwarded
    delete mergedHeaders["transfer-encoding"];
    return new Headers(mergedHeaders);
}
async function addRevalidationHeader(res, { staticGenerationStore, requestStore }) {
    var _staticGenerationStore_revalidatedTags;
    await Promise.all(staticGenerationStore.pendingRevalidates || []);
    // If a tag was revalidated, the client router needs to invalidate all the
    // client router cache as they may be stale. And if a path was revalidated, the
    // client needs to invalidate all subtrees below that path.
    // To keep the header size small, we use a tuple of
    // [[revalidatedPaths], isTagRevalidated ? 1 : 0, isCookieRevalidated ? 1 : 0]
    // instead of a JSON object.
    // TODO-APP: Currently the prefetch cache doesn't have subtree information,
    // so we need to invalidate the entire cache if a path was revalidated.
    // TODO-APP: Currently paths are treated as tags, so the second element of the tuple
    // is always empty.
    const isTagRevalidated = ((_staticGenerationStore_revalidatedTags = staticGenerationStore.revalidatedTags) == null ? void 0 : _staticGenerationStore_revalidatedTags.length) ? 1 : 0;
    const isCookieRevalidated = getModifiedCookieValues(requestStore.mutableCookies).length ? 1 : 0;
    res.setHeader("x-action-revalidated", JSON.stringify([
        [],
        isTagRevalidated,
        isCookieRevalidated
    ]));
}
async function createRedirectRenderResult(req, res, redirectUrl, staticGenerationStore) {
    res.setHeader("x-action-redirect", redirectUrl);
    // if we're redirecting to a relative path, we'll try to stream the response
    if (redirectUrl.startsWith("/")) {
        var _staticGenerationStore_incrementalCache;
        const forwardedHeaders = getForwardedHeaders(req, res);
        forwardedHeaders.set(RSC_HEADER, "1");
        const host = req.headers["host"];
        const proto = ((_staticGenerationStore_incrementalCache = staticGenerationStore.incrementalCache) == null ? void 0 : _staticGenerationStore_incrementalCache.requestProtocol) || "https";
        const fetchUrl = new URL(`${proto}://${host}${redirectUrl}`);
        if (staticGenerationStore.revalidatedTags) {
            var _staticGenerationStore_incrementalCache_prerenderManifest_preview, _staticGenerationStore_incrementalCache_prerenderManifest, _staticGenerationStore_incrementalCache1;
            forwardedHeaders.set(NEXT_CACHE_REVALIDATED_TAGS_HEADER, staticGenerationStore.revalidatedTags.join(","));
            forwardedHeaders.set(NEXT_CACHE_REVALIDATE_TAG_TOKEN_HEADER, ((_staticGenerationStore_incrementalCache1 = staticGenerationStore.incrementalCache) == null ? void 0 : (_staticGenerationStore_incrementalCache_prerenderManifest = _staticGenerationStore_incrementalCache1.prerenderManifest) == null ? void 0 : (_staticGenerationStore_incrementalCache_prerenderManifest_preview = _staticGenerationStore_incrementalCache_prerenderManifest.preview) == null ? void 0 : _staticGenerationStore_incrementalCache_prerenderManifest_preview.previewModeId) || "");
        }
        // Ensures that when the path was revalidated we don't return a partial response on redirects
        // if (staticGenerationStore.pathWasRevalidated) {
        forwardedHeaders.delete("next-router-state-tree");
        // }
        try {
            const headResponse = await fetch(fetchUrl, {
                method: "HEAD",
                headers: forwardedHeaders,
                next: {
                    // @ts-ignore
                    internal: 1
                }
            });
            if (headResponse.headers.get("content-type") === RSC_CONTENT_TYPE_HEADER) {
                const response = await fetch(fetchUrl, {
                    method: "GET",
                    headers: forwardedHeaders,
                    next: {
                        // @ts-ignore
                        internal: 1
                    }
                });
                // copy the headers from the redirect response to the response we're sending
                for (const [key, value] of response.headers){
                    if (!actionsForbiddenHeaders.includes(key)) {
                        res.setHeader(key, value);
                    }
                }
                return new FlightRenderResult(response.body);
            }
        } catch (err) {
            // we couldn't stream the redirect response, so we'll just do a normal redirect
            console.error(`failed to get redirect response`, err);
        }
    }
    return new RenderResult(JSON.stringify({}));
}
var // Used to compare Host header and Origin header.
HostType;
(function(HostType) {
    HostType["XForwardedHost"] = "x-forwarded-host";
    HostType["Host"] = "host";
})(HostType || (HostType = {}));
/**
 * Ensures the value of the header can't create long logs.
 */ function limitUntrustedHeaderValueForLogs(value) {
    return value.length > 100 ? value.slice(0, 100) + "..." : value;
}
export async function handleAction({ req, res, ComponentMod, serverModuleMap, generateFlight, staticGenerationStore, requestStore, serverActions, ctx }) {
    let actionId = req.headers[ACTION.toLowerCase()];
    const contentType = req.headers["content-type"];
    const isURLEncodedAction = req.method === "POST" && contentType === "application/x-www-form-urlencoded";
    const isMultipartAction = req.method === "POST" && (contentType == null ? void 0 : contentType.startsWith("multipart/form-data"));
    const isFetchAction = actionId !== undefined && typeof actionId === "string" && req.method === "POST";
    // If it's not a Server Action, skip handling.
    if (!(isFetchAction || isURLEncodedAction || isMultipartAction)) {
        return;
    }
    if (staticGenerationStore.isStaticGeneration) {
        throw new Error("Invariant: server actions can't be handled during static rendering");
    }
    const originDomain = typeof req.headers["origin"] === "string" ? new URL(req.headers["origin"]).host : undefined;
    const forwardedHostHeader = req.headers["x-forwarded-host"];
    const hostHeader = req.headers["host"];
    const host = forwardedHostHeader ? {
        type: "x-forwarded-host",
        value: forwardedHostHeader
    } : hostHeader ? {
        type: "host",
        value: hostHeader
    } : undefined;
    // This is to prevent CSRF attacks. If `x-forwarded-host` is set, we need to
    // ensure that the request is coming from the same host.
    if (!originDomain) {
        // This might be an old browser that doesn't send `host` header. We ignore
        // this case.
        console.warn("Missing `origin` header from a forwarded Server Actions request.");
    } else if (!host || originDomain !== host.value) {
        var _serverActions_allowedOrigins;
        // If the customer sets a list of allowed origins, we'll allow the request.
        // These are considered safe but might be different from forwarded host set
        // by the infra (i.e. reverse proxies).
        if (serverActions == null ? void 0 : (_serverActions_allowedOrigins = serverActions.allowedOrigins) == null ? void 0 : _serverActions_allowedOrigins.includes(originDomain)) {
        // Ignore it
        } else {
            if (host) {
                // This seems to be an CSRF attack. We should not proceed the action.
                console.error(`\`${host.type}\` header with value \`${limitUntrustedHeaderValueForLogs(host.value)}\` does not match \`origin\` header with value \`${limitUntrustedHeaderValueForLogs(originDomain)}\` from a forwarded Server Actions request. Aborting the action.`);
            } else {
                // This is an attack. We should not proceed the action.
                console.error(`\`x-forwarded-host\` or \`host\` headers are not provided. One of these is needed to compare the \`origin\` header from a forwarded Server Actions request. Aborting the action.`);
            }
            const error = new Error("Invalid Server Actions request.");
            if (isFetchAction) {
                res.statusCode = 500;
                await Promise.all(staticGenerationStore.pendingRevalidates || []);
                const promise = Promise.reject(error);
                try {
                    // we need to await the promise to trigger the rejection early
                    // so that it's already handled by the time we call
                    // the RSC runtime. Otherwise, it will throw an unhandled
                    // promise rejection error in the renderer.
                    await promise;
                } catch  {
                // swallow error, it's gonna be handled on the client
                }
                return {
                    type: "done",
                    result: await generateFlight(ctx, {
                        actionResult: promise,
                        // if the page was not revalidated, we can skip the rendering the flight tree
                        skipFlight: !staticGenerationStore.pathWasRevalidated
                    })
                };
            }
            throw error;
        }
    }
    // ensure we avoid caching server actions unexpectedly
    res.setHeader("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate");
    let bound = [];
    const { actionAsyncStorage } = ComponentMod;
    let actionResult;
    let formState;
    try {
        await actionAsyncStorage.run({
            isAction: true
        }, async ()=>{
            if (process.env.NEXT_RUNTIME === "edge") {
                // Use react-server-dom-webpack/server.edge
                const { decodeReply, decodeAction, decodeFormState } = ComponentMod;
                const webRequest = req;
                if (!webRequest.body) {
                    throw new Error("invariant: Missing request body.");
                }
                if (isMultipartAction) {
                    // TODO-APP: Add streaming support
                    const formData = await webRequest.request.formData();
                    if (isFetchAction) {
                        bound = await decodeReply(formData, serverModuleMap);
                    } else {
                        const action = await decodeAction(formData, serverModuleMap);
                        const actionReturnedState = await action();
                        formState = decodeFormState(actionReturnedState, formData);
                        // Skip the fetch path
                        return;
                    }
                } else {
                    let actionData = "";
                    const reader = webRequest.body.getReader();
                    while(true){
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }
                        actionData += new TextDecoder().decode(value);
                    }
                    if (isURLEncodedAction) {
                        const formData = formDataFromSearchQueryString(actionData);
                        bound = await decodeReply(formData, serverModuleMap);
                    } else {
                        bound = await decodeReply(actionData, serverModuleMap);
                    }
                }
            } else {
                // Use react-server-dom-webpack/server.node which supports streaming
                const { decodeReply, decodeReplyFromBusboy, decodeAction, decodeFormState } = require(`./react-server.node`);
                if (isMultipartAction) {
                    if (isFetchAction) {
                        const busboy = require("busboy");
                        const bb = busboy({
                            headers: req.headers
                        });
                        req.pipe(bb);
                        bound = await decodeReplyFromBusboy(bb, serverModuleMap);
                    } else {
                        // Convert the Node.js readable stream to a Web Stream.
                        const readableStream = new ReadableStream({
                            start (controller) {
                                req.on("data", (chunk)=>{
                                    controller.enqueue(new Uint8Array(chunk));
                                });
                                req.on("end", ()=>{
                                    controller.close();
                                });
                                req.on("error", (err)=>{
                                    controller.error(err);
                                });
                            }
                        });
                        // React doesn't yet publish a busboy version of decodeAction
                        // so we polyfill the parsing of FormData.
                        const fakeRequest = new Request("http://localhost", {
                            method: "POST",
                            // @ts-expect-error
                            headers: {
                                "Content-Type": contentType
                            },
                            body: readableStream,
                            duplex: "half"
                        });
                        const formData = await fakeRequest.formData();
                        const action = await decodeAction(formData, serverModuleMap);
                        const actionReturnedState = await action();
                        formState = await decodeFormState(actionReturnedState, formData);
                        // Skip the fetch path
                        return;
                    }
                } else {
                    const chunks = [];
                    for await (const chunk of req){
                        chunks.push(Buffer.from(chunk));
                    }
                    const actionData = Buffer.concat(chunks).toString("utf-8");
                    const readableLimit = (serverActions == null ? void 0 : serverActions.bodySizeLimit) ?? "1 MB";
                    const limit = require("next/dist/compiled/bytes").parse(readableLimit);
                    if (actionData.length > limit) {
                        const { ApiError } = require("../api-utils");
                        throw new ApiError(413, `Body exceeded ${readableLimit} limit.
To configure the body size limit for Server Actions, see: https://nextjs.org/docs/app/api-reference/functions/server-actions#size-limitation`);
                    }
                    if (isURLEncodedAction) {
                        const formData = formDataFromSearchQueryString(actionData);
                        bound = await decodeReply(formData, serverModuleMap);
                    } else {
                        bound = await decodeReply(actionData, serverModuleMap);
                    }
                }
            }
            // actions.js
            // app/page.js
            //   action worker1
            //     appRender1
            // app/foo/page.js
            //   action worker2
            //     appRender
            // / -> fire action -> POST / -> appRender1 -> modId for the action file
            // /foo -> fire action -> POST /foo -> appRender2 -> modId for the action file
            let actionModId;
            try {
                actionModId = serverModuleMap[actionId].id;
            } catch (err) {
                // When this happens, it could be a deployment skew where the action came
                // from a different deployment. We'll just return a 404 with a message logged.
                console.error(`Failed to find Server Action "${actionId}". This request might be from an older or newer deployment.`);
                return {
                    type: "not-found"
                };
            }
            const actionHandler = ComponentMod.__next_app__.require(actionModId)[actionId];
            const returnVal = await actionHandler.apply(null, bound);
            // For form actions, we need to continue rendering the page.
            if (isFetchAction) {
                await addRevalidationHeader(res, {
                    staticGenerationStore,
                    requestStore
                });
                actionResult = await generateFlight(ctx, {
                    actionResult: Promise.resolve(returnVal),
                    // if the page was not revalidated, we can skip the rendering the flight tree
                    skipFlight: !staticGenerationStore.pathWasRevalidated
                });
            }
        });
        return {
            type: "done",
            result: actionResult,
            formState
        };
    } catch (err) {
        if (isRedirectError(err)) {
            const redirectUrl = getURLFromRedirectError(err);
            // if it's a fetch action, we don't want to mess with the status code
            // and we'll handle it on the client router
            await addRevalidationHeader(res, {
                staticGenerationStore,
                requestStore
            });
            if (isFetchAction) {
                return {
                    type: "done",
                    result: await createRedirectRenderResult(req, res, redirectUrl, staticGenerationStore)
                };
            }
            if (err.mutableCookies) {
                const headers = new Headers();
                // If there were mutable cookies set, we need to set them on the
                // response.
                if (appendMutableCookies(headers, err.mutableCookies)) {
                    res.setHeader("set-cookie", Array.from(headers.values()));
                }
            }
            res.setHeader("Location", redirectUrl);
            res.statusCode = 303;
            return {
                type: "done",
                result: new RenderResult("")
            };
        } else if (isNotFoundError(err)) {
            res.statusCode = 404;
            await addRevalidationHeader(res, {
                staticGenerationStore,
                requestStore
            });
            if (isFetchAction) {
                const promise = Promise.reject(err);
                try {
                    // we need to await the promise to trigger the rejection early
                    // so that it's already handled by the time we call
                    // the RSC runtime. Otherwise, it will throw an unhandled
                    // promise rejection error in the renderer.
                    await promise;
                } catch  {
                // swallow error, it's gonna be handled on the client
                }
                return {
                    type: "done",
                    result: await generateFlight(ctx, {
                        skipFlight: false,
                        actionResult: promise,
                        asNotFound: true
                    })
                };
            }
            return {
                type: "not-found"
            };
        }
        if (isFetchAction) {
            res.statusCode = 500;
            await Promise.all(staticGenerationStore.pendingRevalidates || []);
            const promise = Promise.reject(err);
            try {
                // we need to await the promise to trigger the rejection early
                // so that it's already handled by the time we call
                // the RSC runtime. Otherwise, it will throw an unhandled
                // promise rejection error in the renderer.
                await promise;
            } catch  {
            // swallow error, it's gonna be handled on the client
            }
            return {
                type: "done",
                result: await generateFlight(ctx, {
                    actionResult: promise,
                    // if the page was not revalidated, we can skip the rendering the flight tree
                    skipFlight: !staticGenerationStore.pathWasRevalidated
                })
            };
        }
        throw err;
    }
}

//# sourceMappingURL=action-handler.js.map