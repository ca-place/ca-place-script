// ==UserScript==
// @name         Canada Bot
// @namespace
// @version      1
// @description  For Canada!
// @author       Canada Place Project
// @match        https://www.reddit.com/r/place/*
// @match        https://new.reddit.com/r/place/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @require	     https://cdn.jsdelivr.net/npm/toastify-js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// @updateURL    https://raw.githubusercontent.com/ca-place/ca-place-script/main/script.js
// @downloadURL  https://raw.githubusercontent.com/ca-place/ca-place-script/main/script.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

// Sorry for the messy code, rush and clean don't always go together ;)

var hasOrders = false;
var accessToken;
var currentOrderCanvas = document.createElement('canvas');
var currentOrderCtx = currentOrderCanvas.getContext('2d');
var currentPlaceCanvas = document.createElement('canvas');
var template_url = 'https://i.imgur.com/fufnTeR.png'

const COLOR_MAPPINGS = {
    '#BE0039': 1,
    '#FF4500': 2,
    '#FFA800': 3,
    '#FFD635': 4,
    '#00A368': 6,
    '#00CC78': 7,
    '#7EED56': 8,
    '#00756F': 9,
    '#009EAA': 10,
    '#2450A4': 12,
    '#3690EA': 13,
    '#51E9F4': 14,
    '#493AC1': 15,
    '#6A5CFF': 16,
    '#811E9F': 18,
    '#B44AC0': 19,
    '#FF3881': 22,
    '#FF99AA': 23,
    '#6D482F': 24,
    '#9C6926': 25,
    '#000000': 27,
    '#898D90': 29,
    '#D4D7D9': 30,
    '#FFFFFF': 31
};

var order = [];
for (var i = 0; i < 200000; i++) {
    order.push(i);
}
order.sort(() => Math.random() - 0.5);

(async function () {
    GM_addStyle(GM_getResourceText('TOASTIFY_CSS'));
    currentOrderCanvas.width = 2000;
    currentOrderCanvas.height = 1000;
    currentOrderCanvas.style.display = 'none';
    currentOrderCanvas = document.body.appendChild(currentOrderCanvas);
    currentPlaceCanvas.width = 2000;
    currentPlaceCanvas.height = 1000;
    currentPlaceCanvas.style.display = 'none';
    currentPlaceCanvas = document.body.appendChild(currentPlaceCanvas);

    Toastify({
        text: 'Getting Access Token...',
        duration: 10000
    }).showToast();
    accessToken = await getAccessToken();
    Toastify({
        text: 'Access Token collected!',
        duration: 10000
    }).showToast();

    currentOrderCtx = await getCanvasFromUrl(template_url, currentOrderCanvas);
    hasOrders = true;
    attemptPlace();
})();

async function attemptPlace() {
    if (!hasOrders) {
        setTimeout(attemptPlace, 2000); // probeer opnieuw in 2sec.
        return;
    }
    var ctx;
    try {
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('0'), currentPlaceCanvas, 0, 0);
        ctx = await getCanvasFromUrl(await getCurrentImageUrl('1'), currentPlaceCanvas, 1000, 0)
    } catch (e) {
        console.warn('Error retrieving Map: ', e);
        Toastify({
            text: 'Error retrieving map. Try again in 10 sec...',
            duration: 10000
        }).showToast();
        setTimeout(attemptPlace, 10000); // probeer opnieuw in 10sec.
        return;
    }

    const rgbaOrder = currentOrderCtx.getImageData(0, 0, 2000, 1000).data;
    const rgbaCanvas = ctx.getImageData(0, 0, 2000, 1000).data;

    for (const j of order) {
        for (var l = 0; l < 10; l++) {
            const i = (j * 10) + l;
            // negeer lege order pixels.
            if (rgbaOrder[(i * 4) + 3] === 0) continue;

            const hex = rgbToHex(rgbaOrder[(i * 4)], rgbaOrder[(i * 4) + 1], rgbaOrder[(i * 4) + 2]);
            // Deze pixel klopt.
            if (hex === rgbToHex(rgbaCanvas[(i * 4)], rgbaCanvas[(i * 4) + 1], rgbaCanvas[(i * 4) + 2])) continue;

            const x = i % 2000;
            const y = Math.floor(i / 2000);
            Toastify({
                text: `Trying to post pixel to ${x}, ${y}...`,
                duration: 10000
            }).showToast();

            const res = await place(x, y, COLOR_MAPPINGS[hex]);
            const data = await res.json();
            try {
                if (data.errors) {
                    const error = data.errors[0];
                    const nextPixel = error.extensions.nextAvailablePixelTs + 3000;
                    const nextPixelDate = new Date(nextPixel);
                    const delay = nextPixelDate.getTime() - Date.now();
                    Toastify({
                        text: `Pixel posted too soon! Next pixel will be placed at ${nextPixelDate.toLocaleTimeString()}.`,
                        duration: delay
                    }).showToast();
                    setTimeout(attemptPlace, delay);
                } else {
                    const nextPixel = data.data.act.data[0].data.nextAvailablePixelTimestamp + 3000;
                    const nextPixelDate = new Date(nextPixel);
                    const delay = nextPixelDate.getTime() - Date.now();
                    Toastify({
                        text: `Pixel posted on ${x}, ${y}! Next pixel will be placed at ${nextPixelDate.toLocaleTimeString()}.`,
                        duration: delay
                    }).showToast();
                    setTimeout(attemptPlace, delay);
                }
            } catch (e) {
                console.warn('something went wrong', e);
                Toastify({
                    text: `Analyze response error: ${e}.`,
                    duration: 10000
                }).showToast();
                setTimeout(attemptPlace, 10000);
            }

            return;
        }
    }

    Toastify({
        text: `All pixels are already in the right place! Try again in 30 sec...`,
        duration: 30000
    }).showToast();
    setTimeout(attemptPlace, 30000); // probeer opnieuw in 30sec.
}

function place(x, y, color) {
    return fetch('https://gql-realtime-2.reddit.com/query', {
        method: 'POST',
        body: JSON.stringify({
            'operationName': 'setPixel',
            'variables': {
                'input': {
                    'actionName': 'r/replace:set_pixel',
                    'PixelMessageData': {
                        'coordinate': {
                            'x': x,
                            'y': y
                        },
                        'colorIndex': color,
                        'canvasIndex': (x > 999 ? 1 : 0)
                    }
                }
            },
            'query': 'mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n'
        }),
        headers: {
            'origin': 'https://hot-potato.reddit.com',
            'referer': 'https://hot-potato.reddit.com/',
            'apollographql-client-name': 'mona-lisa',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
}

async function getAccessToken() {
    const usingOldReddit = window.location.href.includes('new.reddit.com');
    const url = usingOldReddit ? 'https://new.reddit.com/r/place/' : 'https://www.reddit.com/r/place/';
    const response = await fetch(url);
    const responseText = await response.text();

    // TODO: ew
    return responseText.split('\"accessToken\":\"')[1].split('"')[0];
}

async function getCurrentImageUrl(id = '0') {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('wss://gql-realtime-2.reddit.com/query', 'graphql-ws');

        ws.onopen = () => {
            ws.send(JSON.stringify({
                'type': 'connection_init',
                'payload': {
                    'Authorization': `Bearer ${accessToken}`
                }
            }));
            ws.send(JSON.stringify({
                'id': '1',
                'type': 'start',
                'payload': {
                    'variables': {
                        'input': {
                            'channel': {
                                'teamOwner': 'AFD2022',
                                'category': 'CANVAS',
                                'tag': id
                            }
                        }
                    },
                    'extensions': {},
                    'operationName': 'replace',
                    'query': 'subscription replace($input: SubscribeInput!) {\n  subscribe(input: $input) {\n    id\n    ... on BasicMessage {\n      data {\n        __typename\n        ... on FullFrameMessageData {\n          __typename\n          name\n          timestamp\n        }\n      }\n      __typename\n    }\n    __typename\n  }\n}'
                }
            }));
        };

        ws.onmessage = (message) => {
            const { data } = message;
            const parsed = JSON.parse(data);

            // TODO: ew
            if (!parsed.payload || !parsed.payload.data || !parsed.payload.data.subscribe || !parsed.payload.data.subscribe.data) return;

            ws.close();
            resolve(parsed.payload.data.subscribe.data.name + `?noCache=${Date.now() * Math.random()}`);
        }

        ws.onerror = reject;
    });
}

function getCanvasFromUrl(url, canvas, x = 0, y = 0) {
    return new Promise((resolve, reject) => {
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, x, y);
            resolve(ctx);
        };
        img.onerror = reject;
        img.src = url;
    });
}

function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
