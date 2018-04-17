const $storage = browser.storage.local;
const contentScripts = [];
const state = {
    enabled: true,
    gains: {
        '40': 0.0,
        '64': 0.0,
        '125': 0.0,
        '250': 0.0,
        '500': 0.0,
        '1000': 0.0,
        '2000': 0.0,
        '4000': 0.0,
        '8000': 0.0,
        '16000': 0.0
    }
};

const STORAGE_KEY = '::state';
const MESSAGE_KEYS = {
    QUERY_STATE: 'query::state',
    UPDATE_STATE: 'update::state',
    UPDATE_GAIN: 'update::gain',
    UPDATE_ENABLED: 'update::enabled',
    SET_GAIN: 'set::gain',
    SET_ENABLED: 'set::enabled'
};

/**
 * Throttling function
 * @param {Function} func
 * @param {Number} threshold
 * @param {*=} [context]
 * @returns {Function}
 */
const throttle = function (func, threshold, context) {
    if (!threshold || threshold < 0) threshold = 250;
    let last;
    let deferred;
    return function () {
        const self = context || this;
        const now = +new Date();
        const args = arguments;
        if (last && now < last + threshold) {
            clearTimeout(deferred);
            deferred = setTimeout(function () {
                last = now;
                func.apply(self, args);
            }, threshold);
        } else {
            last = now;
            func.apply(self, args);
        }
    };
};

const broadcastMessage = throttle((msg) => {
    $storage.set({ [STORAGE_KEY]: state }).then(() => contentScripts.forEach(p => p.postMessage(msg)));
}, 100);

const storagePromise = $storage.get([STORAGE_KEY])
    .then(
        g => g[STORAGE_KEY] ? Promise.resolve(Object.assign(state, g[STORAGE_KEY])) : $storage.set({ [STORAGE_KEY]: state }),
        () => $storage.set({ [STORAGE_KEY]: state })
    );


storagePromise.finally(() => {
    browser.runtime.onConnect.addListener(port => {
        if (port.name === 'h5eq') {
            contentScripts.push(port);

            port.onDisconnect.addListener(() => {
                const ix = contentScripts.indexOf(port);
                if (ix > -1) {
                    contentScripts.splice(ix, 1);
                }
            });
        }

        port.onMessage.addListener(msg => {
            switch (msg.type) {
            case MESSAGE_KEYS.QUERY_STATE:
                port.postMessage({ type: MESSAGE_KEYS.UPDATE_STATE, state: state });
                break;
            case MESSAGE_KEYS.SET_GAIN:
                state.gains[msg.frequency] = msg.gain;
                broadcastMessage({ type: MESSAGE_KEYS.UPDATE_GAIN, frequency: msg.frequency, gain: msg.gain });
                break;
            case MESSAGE_KEYS.SET_ENABLED:
                state.enabled = msg.enabled;
                broadcastMessage({ type: MESSAGE_KEYS.UPDATE_ENABLED, enabled: state.enabled });
                break;
            default:
                console.error('Unrecognized message:', msg);
                break;
            }
        });
    });

    browser.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        sendResponse('hello!');
    });
});