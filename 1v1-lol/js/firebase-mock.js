(function () {
  var STORAGE_KEY = "1v1_game_save_v3";
  var UID_KEY = "1v1_local_uid_v1";
  var STARTING_COINS = 99999;

  function getPersistentUid() {
    var uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      uid = "local_" + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(UID_KEY, uid);
    }
    return uid;
  }

  function base64UrlEncode(value) {
    var json = typeof value === "string" ? value : JSON.stringify(value);
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function createFakeFirebaseToken(uid, displayName) {
    var now = Math.floor(Date.now() / 1000);
    var header = base64UrlEncode({ alg: "RS256", typ: "JWT", kid: "local" });
    var payload = base64UrlEncode({
      iss: "https://securetoken.google.com/justbuild-cdb86",
      aud: "justbuild-cdb86",
      auth_time: now,
      user_id: uid,
      sub: uid,
      iat: now,
      exp: now + 3600 * 24 * 30,
      email: uid + "@players.local",
      email_verified: true,
      name: displayName,
      firebase: {
        identities: { "google.com": [uid + "@players.local"] },
        sign_in_provider: "google.com",
      },
    });
    return header + "." + payload + ".local_signature";
  }

  function buildDefaultGameDocument(uid, displayName) {
    return {
      UserId: uid,
      Nickname: displayName,
      HardCurrency: STARTING_COINS,
      SoftCurrency: STARTING_COINS,
      LoggedIn: true,
      IsSocialLoggedIn: true,
      CharacterSkins: [
        "lol.1v1.playerskins.pack.quick.default",
        "lol.1v1.playerskins.pack.1",
        "lol.1v1.playerskins.pack.2",
      ],
      EquippedCharacterSkin: "lol.1v1.playerskins.pack.quick.default",
      WeaponSkins: [
        "lol.1v1.weaponskins.melee.pickaxe.default",
        "lol.1v1.weaponskins.melee.pickaxe.chicken_leg",
      ],
      EquippedWeaponSkins: ["lol.1v1.weaponskins.melee.pickaxe.default"],
      OwnedEmotes: ["lol.1v1.playeremotes.pack.1"],
      EquippedEmotes: ["lol.1v1.playeremotes.pack.1"],
      Stats: { TotalGamesPlayed: 0, TotalKills: 0, TotalDeaths: 0 },
      Settings: { SettingsVersion: 2 },
    };
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== "object") target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

  function loadSavedDocument() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  window.getLocalPlayerProfile = function () {
    var uid = getPersistentUid();
    var displayName = "Player";
    var base = buildDefaultGameDocument(uid, displayName);
    var saved = loadSavedDocument();
    var doc = saved ? deepMerge(base, saved) : base;

    doc.UserId = uid;
    doc.Nickname = doc.Nickname || displayName;
    if (typeof doc.HardCurrency !== "number") doc.HardCurrency = STARTING_COINS;
    if (typeof doc.SoftCurrency !== "number") doc.SoftCurrency = STARTING_COINS;
    doc.LoggedIn = true;
    doc.IsSocialLoggedIn = true;

    if (!Array.isArray(doc.CharacterSkins)) {
      doc.CharacterSkins = base.CharacterSkins;
    }
    if (!doc.EquippedCharacterSkin) {
      doc.EquippedCharacterSkin = base.EquippedCharacterSkin;
    }
    if (!Array.isArray(doc.WeaponSkins)) {
      doc.WeaponSkins = base.WeaponSkins;
    }
    if (!Array.isArray(doc.EquippedWeaponSkins)) {
      doc.EquippedWeaponSkins = base.EquippedWeaponSkins;
    }

    return doc;
  };

  window.mergeLocalPlayerProfile = function (patch) {
    var doc = window.getLocalPlayerProfile();
    deepMerge(doc, patch || {});

    if (Array.isArray(patch && patch.CharacterSkins)) {
      var set = {};
      doc.CharacterSkins.forEach(function (id) {
        set[id] = true;
      });
      patch.CharacterSkins.forEach(function (id) {
        set[id] = true;
      });
      doc.CharacterSkins = Object.keys(set);
    }

    var next = JSON.stringify(doc);
    var prev = localStorage.getItem(STORAGE_KEY);
    if (prev !== next) {
      localStorage.setItem(STORAGE_KEY, next);
      if (typeof window.pushFirestoreUpdate === "function") {
        window.pushFirestoreUpdate();
      }
    }
    return doc;
  };

  window.buildLoginResult = function () {
    var doc = window.getLocalPlayerProfile();
    return {
      token: createFakeFirebaseToken(doc.UserId, doc.Nickname),
      displayName: doc.Nickname,
    };
  };

  var mockUser = {
    uid: getPersistentUid(),
    displayName: "Player",
    isAnonymous: false,
    email: getPersistentUid() + "@players.local",
    getIdToken: function () {
      return Promise.resolve(window.buildLoginResult().token);
    },
  };

  function makeDocRef() {
    return {
      set: function (data) {
        window.mergeLocalPlayerProfile(data || {});
        return Promise.resolve();
      },
      update: function (data) {
        window.mergeLocalPlayerProfile(data || {});
        return Promise.resolve();
      },
      get: function () {
        var profile = window.getLocalPlayerProfile();
        return Promise.resolve({
          exists: true,
          data: function () {
            return profile;
          },
        });
      },
      onSnapshot: function (successCallback) {
        if (typeof successCallback === "function") {
          successCallback({
            exists: true,
            data: function () {
              return window.getLocalPlayerProfile();
            },
          });
        }
        return function () {};
      },
    };
  }

  var authApi = {
    currentUser: mockUser,
    useDeviceLanguage: function () {},
    onAuthStateChanged: function (callback) {
      if (typeof callback === "function") callback(mockUser);
      return function () {};
    },
    signInWithPopup: function () {
      return Promise.resolve({ user: mockUser });
    },
    signInAnonymously: function () {
      return authApi.signInWithPopup();
    },
    signOut: function () {
      return Promise.resolve();
    },
    fetchSignInMethodsForEmail: function () {
      return Promise.resolve(["google.com"]);
    },
  };

  authApi.GoogleAuthProvider = function () {
    return { providerId: "google.com" };
  };
  authApi.FacebookAuthProvider = function () {
    return { providerId: "facebook.com" };
  };

  var remoteConfigApi = {
    settings: { minimumFetchIntervalMillis: 0 },
    defaultConfig: {},
    fetchAndActivate: function () {
      return Promise.resolve(true);
    },
    getAll: function () {
      var out = {};
      var defaults = this.defaultConfig || {};
      Object.keys(defaults).forEach(function (key) {
        out[key] = {
          asString: function () {
            return defaults[key];
          },
        };
      });
      return out;
    },
  };

  window.firebase = {
    initializeApp: function () {
      return {};
    },
    auth: function () {
      return authApi;
    },
    firestore: function () {
      return {
        collection: function () {
          return {
            doc: function () {
              return makeDocRef();
            },
          };
        },
      };
    },
    remoteConfig: function () {
      return remoteConfigApi;
    },
  };

  window.initializeFireBase = function () {};
  window.initializeFireBaseDev = window.initializeFireBase;
  window.firebaseLoaded = true;

  var unityLoginSent = false;

  window.notifyUnityLoginOnce = function () {
    if (unityLoginSent || !window.unityInstance || !window.unityInstance.SendMessage) {
      return;
    }
    unityLoginSent = true;
    var payload = JSON.stringify(window.buildLoginResult());
    try {
      window.unityInstance.SendMessage("FirebaseManager", "OnSignInPerformed", payload);
    } catch (e) {}
    try {
      window.unityInstance.SendMessage("FirebaseManager", "OnIdTokenReceived", payload);
    } catch (e) {}
  };
})();
