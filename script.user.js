// ==UserScript==
// @name         Canada Bot
// @namespace
// @version      2.0.4
// @description  For Canada!
// @author       Canada Place Project
// @match        https://www.reddit.com/r/place/*
// @match        https://new.reddit.com/r/place/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @require	     https://cdn.jsdelivr.net/npm/toastify-js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// @updateURL    https://raw.githubusercontent.com/ca-place/ca-place-script/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/ca-place/ca-place-script/main/script.user.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

var socket
var order = undefined
var accessToken
var currentOrderCanvas = document.createElement('canvas')
var currentOrderCtx = currentOrderCanvas.getContext('2d')
var currentPlaceCanvas = document.createElement('canvas')
var cnc_url = 'https://i.imgur.com/y7CoPhr.png'

// Global constants
const DEFAULT_TOAST_DURATION_MS = 10000

const COLOR_MAPPINGS = {
  '#6D001A': 0,
  '#BE0039': 1,
  '#BD0038': 1, //a small hack as our template is wrong BE0039 is the right colour
  '#FF4500': 2,
  '#FFA800': 3,
  '#FFD635': 4,
  '#FFF8B8': 5,
  '#00A368': 6,
  '#00CC78': 7,
  '#7EED56': 8,
  '#00756F': 9,
  '#009EAA': 10,
  '#00CCC0': 11,
  '#2450A4': 12,
  '#3690EA': 13,
  '#51E9F4': 14,
  '#493AC1': 15,
  '#6A5CFF': 16,
  '#94B3FF': 17,
  '#811E9F': 18,
  '#B44AC0': 19,
  '#E4ABFF': 20,
  '#DE107F': 21,
  '#FF3881': 22,
  '#FF99AA': 23,
  '#6D482F': 24,
  '#9C6926': 25,
  '#FFB470': 26,
  '#000000': 27,
  '#515252': 28,
  '#898D90': 29,
  '#D4D7D9': 30,
  '#FFFFFF': 31,
}

let getRealWork = (rgbaOrder) => {
  let order = []
  for (var i = 0; i < 4000000; i++) {
    if (rgbaOrder[i * 4 + 3] !== 0) {
      order.push(i)
    }
  }
  return order
}

let getPendingWork = (work, rgbaOrder, rgbaCanvas) => {
  let pendingWork = []
  for (const i of work) {
    if (rgbaOrderToHex(i, rgbaOrder) !== rgbaOrderToHex(i, rgbaCanvas)) {
      pendingWork.push(i)
    }
  }
  return pendingWork
}

(async function () {
  GM_addStyle(GM_getResourceText('TOASTIFY_CSS'))
  currentOrderCanvas.width = 2000
  currentOrderCanvas.height = 2000
  currentOrderCanvas.style.display = 'none'
  currentOrderCanvas = document.body.appendChild(currentOrderCanvas)
  currentPlaceCanvas.width = 2000
  currentPlaceCanvas.height = 2000
  currentPlaceCanvas.style.display = 'none'
  currentPlaceCanvas = document.body.appendChild(currentPlaceCanvas)

  Toastify({
    text: 'Getting Access Token...',
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast()

  accessToken = await getAccessToken()

  Toastify({
    text: 'Collected!!',
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast()


  Toastify({
    text: `Getting template...`,
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast()
  currentOrderCtx = await getCanvasFromUrl(
    cnc_url,
    currentOrderCanvas,
    0,
    0,
    true,
  )
  order = getRealWork(currentOrderCtx.getImageData(0, 0, 2000, 2000).data)
  Toastify({
    text: `New map loaded, ${order.length} pixels in total`,
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast()

  attemptPlace()

  setInterval(async () => {
    accessToken = await getAccessToken()
  }, 30 * 60 * 1000)
})()


async function attemptPlace() {
  if (order == undefined) {
    setTimeout(attemptPlace, 2000) // probeer opnieuw in 2sec.
    return
  }
  var ctx
  try {
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl('0'),
      currentPlaceCanvas,
      0,
      0,
      false,
    )
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl('1'),
      currentPlaceCanvas,
      1000,
      0,
      false,
    )
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl('2'),
      currentPlaceCanvas,
      0,
      1000,
      false,
    )
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl('3'),
      currentPlaceCanvas,
      1000,
      1000,
      false,
    )
  } catch (e) {
    console.warn('Error retrieving map: ', e)
    Toastify({
      text: 'Error retrieving map. Try again in 10 sec...',
      duration: DEFAULT_TOAST_DURATION_MS,
    }).showToast()
    setTimeout(attemptPlace, 10000) // Try again in 10sec.
    return
  }

  const rgbaOrder = currentOrderCtx.getImageData(0, 0, 2000, 2000).data
  const rgbaCanvas = ctx.getImageData(0, 0, 2000, 2000).data
  const work = getPendingWork(order, rgbaOrder, rgbaCanvas)

  if (work.length === 0) {
    Toastify({
      text: `All pixels are already in the right place! Try again in 30 sec...`,
      duration: 30000,
    }).showToast()
    setTimeout(attemptPlace, 30000) // Try again in 30sec.
    return
  }

  const percentComplete = 100 - Math.ceil((work.length * 100) / order.length)
  const workRemaining = work.length
  const idx = Math.floor(Math.random() * work.length)
  const i = work[idx]
  const x = i % 2000
  const y = Math.floor(i / 2000)
  const hex = rgbaOrderToHex(i, rgbaOrder)

  Toastify({
    text: `Trying to place pixel ${x}, ${y}... (${percentComplete}% complete, ${workRemaining} left)`,
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast()

  console.log(
    `Trying to place pixel ${x}, ${y}... (${percentComplete}% complete, ${workRemaining} left)`,
  )

  const res = await place(x, y, COLOR_MAPPINGS[hex])
  const data = await res.json()
  try {
    if (data.errors) {
      const error = data.errors[0]
      console.log('data.errors :>> ', data.errors)
      try {
        const nextPixel = error.extensions.nextAvailablePixelTs + 3000
        const nextPixelDate = new Date(nextPixel)
        const delay = nextPixelDate.getTime() - Date.now()
        const toast_duration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS
        Toastify({
          text: `You are on cooldown! Next pixel at ${nextPixelDate.toLocaleTimeString()}.`,
          duration: toast_duration,
        }).showToast()
        setTimeout(attemptPlace, delay)
      } catch (e) {
        console.log("If you ignore it it doesn't exist." + e)
        Toastify({
          text: `You are on cooldown!`,
          duration: 1000,
        }).showToast()
        setTimeout(attemptPlace, 20000)
      }
    } else {
      const nextPixel =
        data.data.act.data[0].data.nextAvailablePixelTimestamp + 3000
      const nextPixelDate = new Date(nextPixel)
      const delay = nextPixelDate.getTime() - Date.now()
      const toast_duration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS
      console.log(
        `Pixel placed at ${x}, ${y}! Next pixel will be placed at ${nextPixelDate.toLocaleTimeString()}`,
      )
      Toastify({
        text: `Pixel placed at ${x}, ${y}! Next pixel will be placed at ${nextPixelDate.toLocaleTimeString()}. Click to zoom to placed pixel`,
        duration: toast_duration,
        destination: `https://www.reddit.com/r/place/?cx=${x}&cy=${y}&px=2`,
        newWindow: true,
      }).showToast()
      setTimeout(attemptPlace, delay)
    }
  } catch (e) {
    console.warn('Response analysis error', e)
    Toastify({
      text: `Response analysis error: ${e}.`,
      duration: DEFAULT_TOAST_DURATION_MS,
    }).showToast()
    setTimeout(attemptPlace, 10000)
  }
}

async function place(x, y, color) {
  return await fetch('https://gql-realtime-2.reddit.com/query', {
    method: 'POST',
    body: JSON.stringify({
      operationName: 'setPixel',
      variables: {
        input: {
          actionName: 'r/replace:set_pixel',
          PixelMessageData: {
            coordinate: {
              x: x % 1000,
              y: y % 1000,
            },
            colorIndex: color,
            canvasIndex: getCanvas(x, y),
          },
        },
      },
      query:
        'mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n',
    }),
    headers: {
      origin: 'https://hot-potato.reddit.com',
      referer: 'https://hot-potato.reddit.com/',
      'apollographql-client-name': 'mona-lisa',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  }).catch((error) => console.error('Error placing Pixel: ', error))
}

function getCanvas(x, y) {
  if (x <= 999) {
    console.log('Canvas: ', y <= 999 ? 0 : 2)
    return y <= 999 ? 0 : 2
  } else {
    console.log('Canvas: ', y <= 999 ? 1 : 3)
    return y <= 999 ? 1 : 3
  }
}

async function getAccessToken() {
  const usingOldReddit = window.location.href.includes('new.reddit.com')
  const url = usingOldReddit
    ? 'https://new.reddit.com/r/place/'
    : 'https://www.reddit.com/r/place/'
  const response = await fetch(url)
  const responseText = await response.text()

  // TODO: ew
  return responseText.split('"accessToken":"')[1].split('"')[0]
}

async function getCurrentImageUrl(id = '0') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      'wss://gql-realtime-2.reddit.com/query',
      'graphql-ws',
    )

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'connection_init',
          payload: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      )
      ws.send(
        JSON.stringify({
          id: '1',
          type: 'start',
          payload: {
            variables: {
              input: {
                channel: {
                  teamOwner: 'AFD2022',
                  category: 'CANVAS',
                  tag: id,
                },
              },
            },
            extensions: {},
            operationName: 'replace',
            query:
              'subscription replace($input: SubscribeInput!) {\n  subscribe(input: $input) {\n    id\n    ... on BasicMessage {\n      data {\n        __typename\n        ... on FullFrameMessageData {\n          __typename\n          name\n          timestamp\n        }\n      }\n      __typename\n    }\n    __typename\n  }\n}',
          },
        }),
      )
    }

    ws.onmessage = (message) => {
      const { data } = message
      const parsed = JSON.parse(data)

      // TODO: ew
      if (
        !parsed.payload ||
        !parsed.payload.data ||
        !parsed.payload.data.subscribe ||
        !parsed.payload.data.subscribe.data
      )
        return

      ws.close()
      resolve(
        parsed.payload.data.subscribe.data.name +
          `?noCache=${Date.now() * Math.random()}`,
      )
    }

    ws.onerror = reject
  })
}

function getCanvasFromUrl(url, canvas, x = 0, y = 0, clearCanvas = false) {
  return new Promise((resolve, reject) => {
    let loadImage = (ctx) => {
      var img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (clearCanvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(img, x, y)
        resolve(ctx)
      }
      img.onerror = () => {
        Toastify({
          text: 'Error retrieving folder. Try again in 3 sec...',
          duration: 3000,
        }).showToast()
        setTimeout(() => loadImage(ctx), 3000)
      }
      img.src = url
    }
    loadImage(canvas.getContext('2d'))
  })
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  )
}

let rgbaOrderToHex = (i, rgbaOrder) =>
  rgbToHex(rgbaOrder[i * 4], rgbaOrder[i * 4 + 1], rgbaOrder[i * 4 + 2])
