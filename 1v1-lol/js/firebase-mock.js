(function () {
  var STORAGE_KEY = "1v1_game_save_v2";
  var UID_KEY = "1v1_local_uid_v1";
  var STARTING_COINS = 99999;
  var listeners = [];
  var notifyScheduled = false;

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
      picture: "",
      firebase: {
        identities: { "google.com": [uid + "@players.local"] },
        sign_in_provider: "google.com",
      },
    });
    return header + "." + payload + ".local_signature";
  }

  function buildDefaultGameDocument(uid, displayName) {
    var now = Date.now();
    return {
      GeneralData: {
        ID: uid,
        Nickname: displayName,
        Country: "",
        Region: "",
        IsMigrated: true,
        SoftCurrency: STARTING_COINS,
        HardCurrency: STARTING_COINS,
        LOLCoins: STARTING_COINS,
        LoLTokens: STARTING_COINS,
        LOLTokens: STARTING_COINS,
        CreatedAt: new Date(now).toISOString(),
        Logins: {
          LastLoginTime: now,
          CurrentLoginTime: now,
          TotalLogins: 1,
          DailyConsecutiveLogins: 1,
        },
        Stats: {
          TotalGamesPlayed: 0,
          TotalKills: 0,
          TotalDeaths: 0,
          Victories: {},
          Defeats: {},
          Ties: {},
          ConsecutiveWins: 0,
        },
        Premium: { AdsDisabled: true, LTV: 0, DidMigrateAdsDisabled: true },
        NonconsumablePacks: [],
        XP: 0,
      },
      Settings: { Controls: {}, SettingsVersion: 2 },
      Skins: {
        EquippedChampionSkins: {},
        CharacterSkins: ["lol.1v1.playerskins.pack.quick.default"],
        EquippedCharacterSkin: "lol.1v1.playerskins.pack.quick.default",
        EquippedWeaponSkins: ["lol.1v1.weaponskins.melee.pickaxe.default"],
        WeaponSkins: [
          "lol.1v1.weaponskins.melee.pickaxe.default",
          "lol.1v1.weaponskins.melee.pickaxe.chicken_leg",
        ],
        OwnedEmotes: ["lol.1v1.playeremotes.pack.1"],
        EquippedEmotes: ["lol.1v1.playeremotes.pack.1"],
        CompensationVersion: 1,
      },
      BattlePass: { Seasons: {}, XPBankData: { XPLeft: 0 } },
      TrophyRoad: { Seasons: {} },
      RankRoad: { Seasons: {}, AccountRoad: { XP: 0, HighestXP: 0, AvailableRewards: [], ClaimedRewards: [] } },
      DailyRewards: { Rewards: [] },
      Equipment: { Equipment: {}, Loadouts: [], EquippedLoadout: 0 },
      Inventory: { LootBoxes: [], Spins: [], LootBoxesQueue: [], CachedRewards: {} },
      Champions: {
        OwnedChampions: { "lol.1v1.champions.quick": { Level: 1 } },
        SelectedChampion: "lol.1v1.champions.quick",
        ChampionShards: { "lol.1v1.champions.quick": 999 },
      },
      coins: STARTING_COINS,
      LC: STARTING_COINS,
      lol_coins: STARTING_COINS,
      loggedIn: true,
      isLoggedIn: true,
      hasAccount: true,
      displayName: displayName,
      uid: uid,
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

  function saveDocument(doc) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    scheduleNotify();
  }

  window.getLocalPlayerProfile = function () {
    var uid = getPersistentUid();
    var displayName = "Player";
    var base = buildDefaultGameDocument(uid, displayName);
    var saved = loadSavedDocument();
    var doc = saved ? deepMerge(base, saved) : base;
    if (!doc.GeneralData) doc.GeneralData = base.GeneralData;
    doc.GeneralData.ID = uid;
    doc.GeneralData.Nickname = doc.GeneralData.Nickname || displayName;
    if (typeof doc.GeneralData.LOLCoins !== "number") doc.GeneralData.LOLCoins = STARTING_COINS;
    if (typeof doc.GeneralData.HardCurrency !== "number") doc.GeneralData.HardCurrency = doc.GeneralData.LOLCoins;
    doc.GeneralData.LoLTokens = doc.GeneralData.LoLTokens || doc.GeneralData.LOLCoins;
    doc.GeneralData.LOLTokens = doc.GeneralData.LOLTokens || doc.GeneralData.LOLCoins;
    doc.coins = doc.GeneralData.LOLCoins;
    doc.LC = doc.GeneralData.LOLCoins;
    doc.lol_coins = doc.GeneralData.LOLCoins;
    doc.loggedIn = true;
    doc.isLoggedIn = true;
    doc.hasAccount = true;
    doc.displayName = doc.GeneralData.Nickname;
    doc.uid = uid;
    return doc;
  };

  window.mergeLocalPlayerProfile = function (patch) {
    var doc = window.getLocalPlayerProfile();
    deepMerge(doc, patch || {});
    if (patch && patch.GeneralData) deepMerge(doc.GeneralData, patch.GeneralData);
    if (typeof doc.GeneralData.LOLCoins === "number") {
      doc.coins = doc.GeneralData.LOLCoins;
      doc.LC = doc.GeneralData.LOLCoins;
      doc.lol_coins = doc.GeneralData.LOLCoins;
    }
    saveDocument(doc);
    return doc;
  };

  function scheduleNotify() {
    if (notifyScheduled) return;
    notifyScheduled = true;
    requestAnimationFrame(function () {
      notifyScheduled = false;
      notifyListeners();
    });
  }

  function notifyListeners() {
    var payload = JSON.stringify(window.getLocalPlayerProfile());
    listeners.slice().forEach(function (entry) {
      try {
        entry.success(entry.id, payload);
      } catch (e) {}
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

  window.buildLoginResult = function () {
    var doc = window.getLocalPlayerProfile();
    var uid = doc.uid || getPersistentUid();
    var displayName = doc.GeneralData.Nickname || "Player";
    return {
      token: createFakeFirebaseToken(uid, displayName),
      displayName: displayName,
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

  function makeDocRef(path) {
    return {
      path: path,
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

  var unityNotified = false;

  window.bootstrapLocalSession = function () {
    var result = window.buildLoginResult();
    mockUser.uid = getPersistentUid();
    authApi.currentUser = mockUser;
    authListeners.forEach(function (fn) {
      if (typeof fn === "function") fn(mockUser);
    });
    notifyListeners();

    if (!unityNotified && window.unityInstance && window.unityInstance.SendMessage) {
      unityNotified = true;
      var payload = JSON.stringify(result);
      var routes = [
        ["FirebaseManager", "OnSignInPerformed"],
        ["FirebaseManager", "OnIdTokenReceived"],
        ["FirebaseManager", "OnLoginStateChanged"],
        ["FirebaseUiHandler", "OnSignInPerformed"],
        ["FirebaseUiHandler", "OnIdTokenReceived"],
      ];
      for (var i = 0; i < routes.length; i++) {
        try {
          window.unityInstance.SendMessage(routes[i][0], routes[i][1], payload);
        } catch (e) {}
      }
    }
    return result;
  };
})();
