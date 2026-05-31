const cache = {};
let callbackId = 0;
let lastPayload = "";

function getFirestoreListener(collection, documentId, successCallback, errorCallback) {
  callbackId++;
  const id = callbackId;
  const payload = JSON.stringify(getLocalPlayerProfile());
  lastPayload = payload;

  cache[id] = successCallback;

  if (typeof successCallback === "function") {
    successCallback([id, payload]);
  }

  return id;
}

function detachFirestoreListener(id) {
  delete cache[id];
}

window.pushFirestoreUpdate = function () {
  const payload = JSON.stringify(getLocalPlayerProfile());
  if (payload === lastPayload) return;
  lastPayload = payload;

  Object.keys(cache).forEach(function (key) {
    const cb = cache[key];
    if (typeof cb === "function") {
      cb([parseInt(key, 10), payload]);
    }
  });
};
