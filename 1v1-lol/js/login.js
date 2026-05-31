var tempErrorCreds;
var tempProviderName;

function loginSuccess(successCallback) {
  var resultObj = {
    token: "local-offline-token",
    displayName: "Player",
  };
  if (typeof successCallback === "function") {
    successCallback(resultObj);
  }
}

function retrieveIdToken(successCallback, errorCallback) {
  loginSuccess(successCallback);
}

function anonymousLogin(successCallback, errorCallback) {
  loginSuccess(successCallback);
}

function firebaseLogin(providerName, successCallback, errorCallback) {
  loginSuccess(successCallback);
}

function firebaseLogout() {
  return Promise.resolve();
}

function getCurrentUserDisplayName() {
  return "Player";
}

function getProvider(providerName) {
  return {};
}

function setModalContent(modalContentId, contentString) {
  var content = document.getElementById(modalContentId);
  if (content) {
    content.innerHTML = contentString;
  }
}

function continueLogin() {
  hideModal("generalModal");
}

function showModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) modal.style.display = "block";
}

function hideModal(modalId) {
  var modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}
