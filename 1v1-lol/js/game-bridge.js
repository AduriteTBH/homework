window.cpmstarAPI = function () {};

window.InitRV = function InitRV() {
  if (window.unityInstance && window.unityInstance.SendMessage) {
    window.unityInstance.SendMessage("MainMenuManagers", "RvReady");
  }
};

function requestNewAd() {}

function unityAdFinishedCallback() {
  if (window.unityInstance && window.unityInstance.SendMessage) {
    window.unityInstance.SendMessage("MainMenuManagers", "OnWebCallback");
  }
}

function xsollaPurchase(token, isSandbox, onPurchaseComplete) {
  if (typeof onPurchaseComplete === "function") {
    onPurchaseComplete("true");
  }
}

var sessionBootstrapped = false;

function onUnityReady() {
  if (typeof checkAdBlock === "function") {
    checkAdBlock();
  }
  if (typeof sendConfig === "function") {
    sendConfig();
  }
  if (!sessionBootstrapped && typeof bootstrapLocalSession === "function") {
    sessionBootstrapped = true;
    bootstrapLocalSession();
  }
}
