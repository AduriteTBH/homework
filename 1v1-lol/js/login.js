var tempErrorCreds;
var tempProviderName;

function deliverLoginResult(successCallback, errorCallback) {
  var resultObj = window.buildLoginResult();

  if (typeof successCallback === "function") {
    successCallback(resultObj);
    return;
  }

  if (typeof errorCallback === "function") {
    errorCallback("User is null");
  }
}

function retrieveIdToken(successCallback, errorCallback) {
  if (firebase.auth().currentUser === null) {
    if (typeof errorCallback === "function") {
      errorCallback("User is null");
    }
    return;
  }
  deliverLoginResult(successCallback, errorCallback);
}

function anonymousLogin(successCallback, errorCallback) {
  deliverLoginResult(successCallback, errorCallback);
}

function firebaseLogin(providerName, successCallback, errorCallback) {
  if (providerName === "anonymous") {
    anonymousLogin(successCallback, errorCallback);
    return;
  }

  var user = firebase.auth().currentUser;
  if (user != null && !user.isAnonymous) {
    retrieveIdToken(successCallback, errorCallback);
    return;
  }

  firebase
    .auth()
    .signInWithPopup({})
    .then(function () {
      deliverLoginResult(successCallback, errorCallback);
    })
    .catch(function () {
      deliverLoginResult(successCallback, errorCallback);
    });
}

function firebaseLogout() {
  return Promise.resolve();
}

function getCurrentUserDisplayName() {
  return window.getLocalPlayerProfile().Nickname || "Player";
}

function getProvider(providerName) {
  if (providerName && providerName.indexOf("facebook") !== -1) {
    return new firebase.auth.FacebookAuthProvider();
  }
  return new firebase.auth.GoogleAuthProvider();
}

function setModalContent(modalContentId, contentString) {
  var content = document.getElementById(modalContentId);
  if (content) {
    content.innerHTML = contentString;
  }
}

function continueLogin() {
  hideModal("generalModal");
  firebaseLogin(tempProviderName || "google.com");
}

function showModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) modal.style.display = "block";
}

function hideModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}
