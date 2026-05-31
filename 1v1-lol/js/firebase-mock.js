(function () {
  var STORAGE_KEY = "1v1_local_profile_v1";
  var STARTING_COINS = 99999;
  var listeners = [];
  var mockUser = {
    uid: "local-player",
    displayName: "Player",
    isAnonymous: false,
    getIdToken: function () {
      return Promise.resolve("local-offline-token");
    },
  };

  function loadProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function saveProfile(profile) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    notifyListeners();
  }

  function defaultProfile() {
    return {
      coins: STARTING_COINS,
      LC: STARTING_COINS,
      lol_coins: STARTING_COINS,
      coinBalance: STARTING_COINS,
      balance: STARTING_COINS,
      displayName: "Player",
      name: "Player",
      loggedIn: true,
      isLoggedIn: true,
      hasAccount: true,
      ownedSkins: [],
      owned_skins: [],
      skins: [],
      playerSkins: [],
      purchasedSkins: [],
      items: [],
      email: "player@local",
      uid: mockUser.uid,
    };
  }

  window.getLocalPlayerProfile = function () {
    var profile = loadProfile();
    if (!profile) {
      profile = defaultProfile();
      saveProfile(profile);
    }
    if (typeof profile.coins !== "number") {
      profile.coins = STARTING_COINS;
    }
    profile.LC = profile.coins;
    profile.lol_coins = profile.coins;
    profile.coinBalance = profile.coins;
    profile.balance = profile.coins;
    profile.loggedIn = true;
    profile.isLoggedIn = true;
    profile.hasAccount = true;
    profile.displayName = profile.displayName || "Player";
    profile.uid = mockUser.uid;
    return profile;
  };

  window.mergeLocalPlayerProfile = function (patch) {
    var profile = window.getLocalPlayerProfile();
    if (patch && typeof patch === "object") {
      for (var key in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          profile[key] = patch[key];
        }
      }
    }
    if (typeof profile.coins === "number") {
      profile.LC = profile.coins;
      profile.lol_coins = profile.coins;
      profile.coinBalance = profile.coins;
      profile.balance = profile.coins;
    }
    saveProfile(profile);
    return profile;
  };

  function notifyListeners() {
    var profile = window.getLocalPlayerProfile();
    var payload = JSON.stringify(profile);
    listeners.slice().forEach(function (entry) {
      try {
        entry.success(entry.id, payload);
      } catch (e) {
        console.warn("firestore listener error", e);
      }
    });
  }

  window.registerFirestoreListener = function (id, successCallback) {
    listeners.push({ id: id, success: successCallback });
    notifyListeners();
  };

  window.unregisterFirestoreListener = function (id) {
    listeners = listeners.filter(function (entry) {
      return entry.id !== id;
    });
  };

  function makeDocRef(path) {
    return {
      path: path,
      set: function (data, options) {
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
      onSnapshot: function (successCallback, errorCallback) {
        var id = listeners.length + 1;
        registerFirestoreListener(id, function (listenerId, payload) {
          successCallback({
            exists: true,
            data: function () {
              return JSON.parse(payload);
            },
          });
        });
        return function () {
          unregisterFirestoreListener(id);
        };
      },
    };
  }

  function makeCollectionRef(name) {
    return {
      doc: function (documentId) {
        return makeDocRef(name + "/" + documentId);
      },
    };
  }

  var authListeners = [];

  var authApi = {
    currentUser: mockUser,
    useDeviceLanguage: function () {},
    onAuthStateChanged: function (callback) {
      if (typeof callback === "function") {
        callback(mockUser);
      }
      authListeners.push(callback);
      return function () {
        authListeners = authListeners.filter(function (fn) {
          return fn !== callback;
        });
      };
    },
    signInWithPopup: function () {
      authApi.currentUser = mockUser;
      authListeners.forEach(function (fn) {
        if (typeof fn === "function") fn(mockUser);
      });
      return Promise.resolve({ user: mockUser });
    },
    signInAnonymously: function () {
      authApi.currentUser = mockUser;
      return Promise.resolve({ user: mockUser });
    },
    signOut: function () {
      authApi.currentUser = mockUser;
      return Promise.resolve();
    },
    fetchSignInMethodsForEmail: function () {
      return Promise.resolve(["google.com"]);
    },
    GoogleAuthProvider: function () {
      return {};
    },
    FacebookAuthProvider: function () {
      return {};
    },
  };

  authApi.GoogleAuthProvider = function () {
    return {};
  };
  authApi.FacebookAuthProvider = function () {
    return {};
  };

  var remoteConfigDefaults = {};

  var remoteConfigApi = {
    settings: { minimumFetchIntervalMillis: 0 },
    defaultConfig: remoteConfigDefaults,
    fetchAndActivate: function () {
      return Promise.resolve(true);
    },
    getAll: function () {
      var out = {};
      var defaults = this.defaultConfig || remoteConfigDefaults;
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
        collection: function (name) {
          return makeCollectionRef(name);
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
})();
