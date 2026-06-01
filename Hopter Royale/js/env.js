(function () {
  var isFile = location.protocol === 'file:';
  var isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var isSecure = window.isSecureContext;
  var isGithubPages = location.hostname.indexOf('github.io') !== -1;

  window.HR_ENV = {
    isFile: isFile,
    isLocalhost: isLocalhost,
    isSecure: isSecure,
    isGithubPages: isGithubPages,
    multiplayerOk: isSecure && !isFile,
  };

  function applyMenuMode() {
    var multiPanel = document.getElementById('multiplayer-panel');
    var fileHint = document.getElementById('file-mode-hint');
    var githubBtn = document.getElementById('btn-open-github');
    var localOnlyHint = document.getElementById('local-only-hint');
    var banner = document.getElementById('env-banner');

    if (banner) banner.classList.add('hidden');

    if (isFile) {
      if (multiPanel) multiPanel.classList.add('panel-disabled');
      var hostBtn = document.querySelector('.portal-item[data-action="host"]');
      var joinBtn = document.querySelector('.portal-item[data-action="join"]');
      if (hostBtn) hostBtn.classList.add('disabled');
      if (joinBtn) joinBtn.classList.add('disabled');
      if (fileHint) fileHint.classList.remove('hidden');
    } else {
      if (multiPanel) multiPanel.classList.remove('panel-disabled');
      if (fileHint) fileHint.classList.add('hidden');
      if (localOnlyHint) localOnlyHint.classList.add('hidden');
    }

    if (isGithubPages || (isSecure && !isFile)) {
      if (githubBtn) githubBtn.classList.add('hidden');
    }

    if (isGithubPages && localOnlyHint) {
      localOnlyHint.classList.add('hidden');
    }
  }

  function guardMultiplayer() {
    if (!window.HR_ENV.multiplayerOk) {
      var msg = isFile
        ? 'Multiplayer needs GitHub Pages or local/Play-Local.bat. Singleplayer works here.'
        : 'Multiplayer needs HTTPS or localhost.';
      if (window.HR && HR.setMenuStatus) HR.setMenuStatus(msg);
      return false;
    }
    return true;
  }

  window.HR_ENV.applyMenuMode = applyMenuMode;
  window.HR_ENV.guardMultiplayer = guardMultiplayer;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMenuMode);
  } else {
    applyMenuMode();
  }
})();
