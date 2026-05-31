const cache = {};
let callbackId = 0;

function getFirestoreListener(collection, documentId, successCallback, errorCallback) {
  callbackId++;
  const id = callbackId;

  function deliver(payload) {
    if (typeof successCallback === "function") {
      successCallback([id, payload]);
    }
  }

  deliver(JSON.stringify(getLocalPlayerProfile()));

  registerFirestoreListener(id, function (listenerId, payload) {
    deliver(payload);
  });

  cache[id] = function () {
    unregisterFirestoreListener(id);
    delete cache[id];
  };
  return id;
}

function detachFirestoreListener(id) {
  if (cache[id] !== undefined) {
    cache[id]();
  }
}
