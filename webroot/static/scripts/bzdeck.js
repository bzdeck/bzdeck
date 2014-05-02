/**
 * BzDeck Application Logic
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

/* ----------------------------------------------------------------------------------------------
 * Data
 * ---------------------------------------------------------------------------------------------- */

BzDeck.data = {};

/* ----------------------------------------------------------------------------------------------
 * Options
 * ---------------------------------------------------------------------------------------------- */

BzDeck.options = {
  api: {
    endpoint: 'https://api-dev.bugzilla.mozilla.org/latest/',
    extra_fields: [
      'attachments', 'blocks', 'cc', 'comments', 'depends_on', 'dupe_of', 'flags', 'groups',
      'history', 'is_cc_accessible', 'is_confirmed', 'is_creator_accessible', 'see_also',
      'update_token'
    ]
  },
  app: {
    manifest: location.origin + '/manifest.webapp'
  },
  grid: {
    default_columns: [
      // Custom
      { id: '_starred', type: 'boolean' },
      { id: '_unread', type: 'boolean', hidden: true },
      // Name
      { id: 'id', type: 'integer' },
      { id: 'alias', hidden: true },
      { id: 'summary' },
      // Status
      { id: 'status', hidden: true },
      { id: 'resolution', hidden: true },
      { id: 'target_milestone', hidden: true },
      // Affected
      { id: 'classification', hidden: true },
      { id: 'product' },
      { id: 'component' },
      { id: 'version', hidden: true },
      { id: 'platform', hidden: true },
      { id: 'op_sys', hidden: true },
      // Importance
      { id: 'severity', hidden: true },
      { id: 'priority', hidden: true },
      // Notes
      { id: 'whiteboard', hidden: true },
      { id: 'keywords', hidden: true },
      { id: 'url', hidden: true },
      // People
      { id: 'creator', hidden: true },
      { id: 'assigned_to', hidden: true },
      { id: 'qa_contact', hidden: true },
      // Dates
      { id: 'creation_time', type: 'time', hidden: true },
      { id: 'last_change_time', type: 'time' },
    ]
  }
};

/* ----------------------------------------------------------------------------------------------
 * Bootstrap
 * ---------------------------------------------------------------------------------------------- */

BzDeck.bootstrap = {};

BzDeck.bootstrap.check_requirements = function () {
  let features = [
    'toLocaleFormat' in Date.prototype, // Gecko specific
    'mozMatchesSelector' in Element.prototype, // Gecko specific; prefixed
    'Proxy' in window, // Firefox 4
    'IDBObjectStore' in window, // Firefox 4
    'mozGetAll' in IDBObjectStore.prototype, // Gecko specific; prefixed
    'matchMedia' in window, // Firefox 6
    'WeakMap' in window, // Firefox 6
    'Set' in window, // Firefox 13
    'MutationObserver' in window, // Firefox 14
    'buttons' in MouseEvent.prototype, // Firefox 15
    'isNaN' in Number, // Firefox 15
    'scrollTopMax' in Element.prototype, // Firefox 16
    'isInteger' in Number, // Firefox 16
    'indexedDB' in window, // unprefixed in Firefox 16
    'onwheel' in window, // Firefox 17
    'contains' in String.prototype, // Firefox 19
    'origin' in location, // Firefox 21
    'HTMLTemplateElement' in window, // Firefox 22
    'Notification' in window, // Firefox 22
    'remove' in Element.prototype, // Firefox 23
    'parseInt' in Number, // Firefox 25
    'createTBody' in HTMLTableElement.prototype // Firefox 25
  ];

  try {
    // (Strict) feature detection & arrow function expression (Firefox 22)
    if (!features.every(item => item)) {
      throw new Error;
    }

    // Iterator and destructuring assignment (Firefox 2)
    // for...of loop (Firefox 13)
    for (let [key, value] of Iterator(['a', 'b', 'c'])) if (key === 1) {}

    // Direct Proxy (Firefox 18; constructor)
    new Proxy({}, {});

    // Spread operation in function calls (Firefox 27)
    [0, 1, 2].push(...[3, 4, 5]);
  } catch (ex) {
    return false;
  }

  return true;
};

BzDeck.bootstrap.start = function () {
  this.$form = document.querySelector('#app-login form');
  this.$input = this.$form.querySelector('[role="textbox"]');
  this.$button = this.$form.querySelector('[role="button"]');
  BzDeck.global.$statusbar = document.querySelector('#app-login [role="status"]');

  this.open_database();
};

BzDeck.bootstrap.open_database = function () {
  let req = indexedDB.open('BzDeck'); // Version 1

  req.addEventListener('error', event => {
    BzDeck.global.show_status('ERROR: Cannot open the database.'); // l10n
  });

  // The database is created or upgraded
  req.addEventListener('upgradeneeded', event => {
    let db = BzDeck.model.db = event.target.result,
        stores = {
          // Bugzilla data
          bugs: { keyPath: 'id' },
          attachments: { keyPath: 'id' },
          users: { keyPath: 'id' },
          bugzilla: { keyPath: 'key' },
          // BzDeck data
          accounts: { keyPath: 'id' }, // the key is Bugzilla account ID
          subscriptions: { keyPath: 'id' },
          prefs: { keyPath: 'key' }
        };

    for (let [name, option] of Iterator(stores)) if (!db.objectStoreNames.contains(name)) {
      db.createObjectStore(name, option);
    }
  });

  req.addEventListener('success', event => {
    BzDeck.model.db = event.target.result;

    this.load_config();
    this.load_account();
    this.load_prefs();
  });
};

BzDeck.bootstrap.load_config = function () {
  BzDeck.model.db.transaction('bugzilla').objectStore('bugzilla').get('config')
                                         .addEventListener('success', event => {
    let result = event.target.result;

    if (result) {
      // Cache found
      BzDeck.data.bugzilla_config = result.value;

      return;
    }

    if (!navigator.onLine) {
      // Offline; give up
      BzDeck.global.show_status('You have to go online to load data.'); // l10n

      return;
    }

    // Load the Bugzilla config in background
    BzDeck.core.request('GET', 'configuration?cached_ok=1', data => {
      if (!data || !data.version) {
        // Give up
        BzDeck.global.show_status('ERROR: Bugzilla configuration could not be loaded. \
          The instance might be offline.'); // l10n
        this.$input.disabled = this.$button.disabled = true;

        return;
      }

      // The config is loaded successfully
      BzDeck.data.bugzilla_config = data;
      BzDeck.model.db.transaction('bugzilla', 'readwrite').objectStore('bugzilla')
                                                          .add({ key: 'config', value: data });
    });
  });
};

BzDeck.bootstrap.load_account = function () {
  BzDeck.model.db.transaction('accounts').objectStore('accounts').openCursor()
                                         .addEventListener('success', event => {
    let cursor = event.target.result;

    if (cursor) {
      // Cache found (the first entry)
      BzDeck.data.account = cursor.value;
      BzDeck.core.load_subscriptions();

      return;
    }

    this.show_login_form();
  });
};

BzDeck.bootstrap.load_prefs = function () {
  let db = BzDeck.model.db,
      prefs = {};

  db.transaction('prefs').objectStore('prefs').mozGetAll()
                         .addEventListener('success', event => {
    for (let { key, value } of event.target.result) {
      prefs[key] = value;
    }

    BzDeck.data.prefs = new Proxy(prefs, {
      set: (obj, key, value) => {
        obj[key] = value;
        db.transaction('prefs', 'readwrite').objectStore('prefs').put({ key: key, value: value });
      }
    });
  });
};

BzDeck.bootstrap.show_login_form = function (firstrun = true) {
  this.$form.setAttribute('aria-hidden', 'false');
  this.$input.disabled = this.$button.disabled = false;
  this.$input.focus();

  if (!firstrun) {
    return;
  }

  this.$form.addEventListener('submit', event => {
    if (!this.processing) {
      // User is trying to re-login
      this.relogin = true;
      this.processing = true;
    }

    navigator.onLine ? this.validate_account()
                     : BzDeck.global.show_status('You have to go online to sign in.'); // l10n

    event.preventDefault();

    return false;
  });

  BzDeck.global.show_status('');
};

BzDeck.bootstrap.validate_account = function () {
  BzDeck.global.show_status('Confirming account...'); // l10n
  this.$input.disabled = this.$button.disabled = true;

  BzDeck.core.request('GET', 'user/' + encodeURIComponent(this.$input.value), data => {
    let status;

    if (!data) {
      // Network error?
      status = 'ERROR: Failed to sign in.'; // l10n
    }

    if (data.error || !data.name) {
      // User not found
      status = 'ERROR: ' + (data.message || 'The user could not be found. \
                            Please check your email adress and try again.'); // l10n
    }

    if (status) {
      BzDeck.global.show_status(status); // l10n
      this.$input.disabled = this.$button.disabled = false;

      return;
    }

    // User found, now load his/her data
    BzDeck.data.account = data;
    BzDeck.model.db.transaction('accounts', 'readwrite').objectStore('accounts').add(data);
    BzDeck.core.load_subscriptions();
  });
};

BzDeck.bootstrap.setup_ui = function () {
  if (this.relogin) {
    // UI has already been set up, skip this process
    this.finish();

    return;
  }

  BzDeck.global.show_status('Loading UI...'); // l10n

  let datetime = FlareTail.util.datetime,
      prefs = BzDeck.data.prefs,
      theme = prefs['ui.theme.selected'],
      FTut = FlareTail.util.theme,
      $root = document.documentElement;

  // Automatically update relative dates on the app
  datetime.options.updater_enabled = true;

  // Date format
  let (value = prefs['ui.date.relative']) {
    datetime.options.relative = value !== undefined ? value : true;
  }

  // Date timezone
  let (value = prefs['ui.date.timezone']) {
    datetime.options.timezone = value || 'local';
  }

  // Timeline: Font
  let (value = prefs['ui.timeline.font.family']) {
    $root.setAttribute('data-timeline-font-family', value || 'monospace');
  }

  // Timeline: Changes
  let (value = prefs['ui.timeline.show_cc_changes']) {
    $root.setAttribute('data-timeline-show-cc-changes', value !== undefined ? value : false);
  }

  // Timeline: Attachments
  let (value = prefs['ui.timeline.display_attachments_inline']) {
    $root.setAttribute('data-timeline-display-attachments-inline', value !== undefined ? value : true);
  }

  // Activate widgets
  BzDeck.homepage = new BzDeck.HomePage();
  BzDeck.toolbar.setup();
  BzDeck.sidebar.setup();
  BzDeck.DetailsPage.swipe.init();

  // Check the requested URL to open the specific folder or tab if needed
  FlareTail.util.event.dispatch(window, 'popstate');

  // Change the theme
  if (theme && FTut.list.contains(theme)) {
    FTut.selected = theme;
  }

  // Preload images from CSS
  FTut.preload_images(() => {});

  // Authorize a notification
  FlareTail.util.app.auth_notification();

  // Update UI & Show a notification
  BzDeck.core.toggle_unread_ui(true);

  window.addEventListener('UI:toggle_unread', event => {
    let bugs = [...event.detail.bugs];

    if (!event.detail.loaded) {
      return;
    }

    if (bugs.length === 0) {
      BzDeck.global.show_status('No new bugs to download'); // l10n
      return;
    }

    bugs.sort((a, b) => new Date(b.last_change_time) - new Date(a.last_change_time));

    let status = bugs.length > 1 ? 'You have %d unread bugs'.replace('%d', bugs.length)
                                 : 'You have 1 unread bug', // l10n
        extract = [(bug.id + ' - ' + bug.summary) for (bug of bugs.slice(0, 3))].join('\n');

    BzDeck.global.show_status(status);
    BzDeck.global.show_notification(status, extract);
  });

  this.finish();
};

BzDeck.bootstrap.finish = function () {
  // Timer to check for updates
  BzDeck.core.timers.load_subscriptions = window.setInterval(() => {
    BzDeck.core.load_subscriptions();
  }, 600000); // Call every 10 minutes

  // Register the app for an activity on Firefox OS
  BzDeck.global.register_activity_handler();

  BzDeck.global.show_status('Loading complete.'); // l10n
  BzDeck.session.login();
  this.processing = false;
};

/* ----------------------------------------------------------------------------------------------
 * Core
 * ---------------------------------------------------------------------------------------------- */

BzDeck.core = {};
BzDeck.core.timers = {};

BzDeck.core.load_subscriptions = function () {
  this.firstrun = false;
  BzDeck.global.show_status('Checking for new bugs...'); // l10n

  BzDeck.model.get_all_subscriptions(subscriptions => {
    let email = BzDeck.data.account.name,
        _query = { email1: email, email1_type: 'equals_any', resolution: '---' },
        fields = { cc: 'cc', reported: 'creator', assigned: 'assigned_to', qa: 'qa_contact' },
        needinfo_sub = { id: 'needinfo', query: { quicksearch: 'needinfo?' + email }};

    if (subscriptions.length) {
      BzDeck.model.get_all_bugs(bugs => {
        // List all starred bugs to check the last modified dates
        let ids = [bug.id for (bug of bugs) if (bug._starred)];

        if (ids.length) {
          subscriptions.push({ query: { id: ids.join() } });
        }

        // needinfo? migration
        if ([sub.id for (sub of subscriptions)].indexOf('needinfo') === -1) {
          subscriptions.push(needinfo_sub);
        }

        this.fetch_subscriptions(subscriptions);
      });

      // Hide the app intro copy from existing users
      document.querySelector('#app-intro').style.display = 'none';

      return;
    }

    this.firstrun = true;

    // No cache available; try to create the default store
    if (!navigator.onLine) {
      // Offline; give up
      BzDeck.global.show_status('You have to go online to load data.'); // l10n

      return;
    }

    for (let [name, field] of Iterator(fields)) {
      let query = FlareTail.util.object.clone(_query);

      query['email1_' + field] = 1;
      subscriptions.push({ id: name, query: query });
    }

    subscriptions.push(needinfo_sub);
    this.fetch_subscriptions(subscriptions);
  });
};

BzDeck.core.fetch_subscriptions = function (subscriptions) {
  if (!navigator.onLine) {
    // Skip loading the latest subscription data
    this.load_bugs(subscriptions);

    return;
  }

  let loaded = 0,
      len = Object.keys(subscriptions).length;

  // Load bug list from Bugzilla
  for (let [i, sub] of Iterator(subscriptions)) {
    let index = i; // Redefine the variable to make it available in the following event
    sub.query['include_fields'] = 'id,last_change_time';

    this.request('GET', 'bug' + FlareTail.util.request.build_query(sub.query), data => {
      if (!data || !Array.isArray(data.bugs)) {
        // Give up
        BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n

        return;
      }

      // One subscription data loaded; update database with the bug list
      subscriptions[index].bugs = data.bugs;
      loaded++;

      if (loaded === len) {
        // All subscription data loaded
        BzDeck.model.save_subscriptions(subscriptions);
        this.load_bugs(subscriptions);
      }
    });
  }
};

BzDeck.core.load_bugs = function (subscriptions) {
  let boot = BzDeck.bootstrap.processing,
      cached_time = {},
      requesting_bugs = [];

  BzDeck.global.show_status('Loading bugs...'); // l10n

  // Step 1: look for bugs in the local storage
  let _get = () => {
    BzDeck.model.get_all_bugs(bugs => {
      for (let bug of bugs) {
        cached_time[bug.id] = bug.last_change_time;
      }

      if (Object.keys(cached_time).length > 0) {
        if (navigator.onLine) {
          _list();
        } else if (boot) {
          // Skip loading the latest bug data
          BzDeck.bootstrap.setup_ui();
        }

        return;
      }

      if (!navigator.onLine) {
        // Offline; give up
        BzDeck.global.show_status('You have to go online to load data.'); // l10n
      }

      // No cache available; try to retrieve bugs anyway
      _list();
    });
  };

  // Step 2: determine which bugs should be loaded from Bugzilla
  let _list = () => {
    for (let sub of subscriptions) {
      for (let bug of sub.bugs) {
        let cache = cached_time[bug.id];

        if ((!cache || bug.last_change_time > cache) && requesting_bugs.indexOf(bug.id) === -1) {
          requesting_bugs.push(bug.id);
        }
      }
    }

    if (requesting_bugs.length > 0) {
      _retrieve();
    } else if (boot) {
      BzDeck.bootstrap.setup_ui();
    } else {
      BzDeck.global.show_status('No new bugs to download'); // l10n
    }
  };

  let opt = BzDeck.options,
      default_fields = opt.api.default_fields
                     = [id for ({ id } of opt.grid.default_columns) if (!id.startsWith('_'))],
      query = { include_fields: default_fields.join() },
      loaded_bugs = [];

  // Step 3: load the listed bugs from Bugzilla
  let _retrieve = () => {
    // Load 100 bugs each
    for (let i = 0, len = requesting_bugs.length; i < len; i += 100) {
      query.id = requesting_bugs.slice(i, i + 100).join();

      this.request('GET', 'bug' + FlareTail.util.request.build_query(query), data => {
        if (!data || !Array.isArray(data.bugs)) {
          // Give up
          BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n

          return;
        }

        for (let bug of data.bugs) {
          bug._update_needed = true; // Flag to update details
          bug._unread = !this.firstrun; // If the session is firstrun, mark all bugs read
        }

        loaded_bugs.push(...data.bugs);

        // Finally load the UI modules
        if (boot && loaded_bugs.length === len) {
          BzDeck.model.save_bugs(loaded_bugs, bugs => {
            BzDeck.bootstrap.setup_ui();
          });
        }
      });
    }
  };

  // Start processing
  _get();
};

BzDeck.core.load_bug_details = function (ids, callback = null) {
  let query = {
    id: ids.join(),
    include_fields: 'id,' + BzDeck.options.api.extra_fields.join(),
    exclude_fields: 'attachments.data'
  };

  this.request('GET', 'bug' + FlareTail.util.request.build_query(query), data => {
    if (!data) {
      // Give up
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n

      return;
    }

    for (let _bug of data.bugs) {
      BzDeck.model.get_bug_by_id(_bug.id, bug => {
        for (let [field, value] of Iterator(_bug)) {
          bug[field] = value;
        }

        bug._update_needed = false;
        BzDeck.model.save_bug(bug);

        if (callback) {
          callback(bug);
        }
      });
    }
  });
};

BzDeck.core.toggle_star = function (id, value) {
  // Save in DB
  BzDeck.model.get_bug_by_id(id, bug => {
    if (bug) {
      bug._starred = value;
      BzDeck.model.save_bug(bug);
      this.toggle_star_ui();
    }
  });
};

BzDeck.core.toggle_star_ui = function () {
  BzDeck.model.get_all_bugs(bugs => {
    FlareTail.util.event.dispatch(window, 'UI:toggle_star', { detail: {
      bugs: new Set([bug for (bug of bugs) if (bug._starred)]),
      ids: new Set([bug.id for (bug of bugs) if (bug._starred)])
    }});
  });
};

BzDeck.core.toggle_unread = function (id, value) {
  // Save in DB
  BzDeck.model.get_bug_by_id(id, bug => {
    if (bug && bug._unread !== value) {
      bug._unread = value;
      BzDeck.model.save_bug(bug);
      this.toggle_unread_ui();
    }
  });
};

BzDeck.core.toggle_unread_ui = function (loaded = false) {
  BzDeck.model.get_all_bugs(bugs => {
    FlareTail.util.event.dispatch(window, 'UI:toggle_unread', { detail: {
      loaded: loaded,
      bugs: new Set([bug for (bug of bugs) if (bug._unread)]),
      ids: new Set([bug.id for (bug of bugs) if (bug._unread)])
    }});
  });
};

BzDeck.core.request = function (method, query, callback) {
  if (!navigator.onLine) {
    BzDeck.global.show_status('You have to go online to load data.'); // l10n

    return;
  }

  let xhr = new XMLHttpRequest(),
      api = BzDeck.options.api;

  xhr.open(method, api.endpoint + query, true);
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.addEventListener('load', event => {
    let text = event.target.responseText;
    callback(text ? JSON.parse(text) : null);
  });
  xhr.addEventListener('error', event => {
    callback(null);
  });
  xhr.send(null);
};

/* ----------------------------------------------------------------------------------------------
 * Model
 * ---------------------------------------------------------------------------------------------- */

BzDeck.model = {};
BzDeck.model.cache = {};

BzDeck.model.get_bug_by_id = function (id, callback, record_time = true) {
  let cache = this.cache.bugs,
      store = this.db.transaction('bugs', 'readwrite').objectStore('bugs');

  if (cache) {
    let bug = cache.get(id);

    if (bug) {
      if (record_time) {
        bug._last_viewed = Date.now();
        cache.set(id, bug);
        store.put(bug);
      }

      callback(bug);

      return;
    }
  }

  store.get(id).addEventListener('success', event => {
    let bug = event.target.result;

    if (bug && record_time) {
      bug._last_viewed = Date.now();

      if (cache) {
        cache.set(id, bug);
      }

      store.put(bug); // Save
    }

    callback(bug);
  });
};

BzDeck.model.get_bugs_by_ids = function (ids, callback) {
  let cache = this.cache.bugs,
      ids = [...ids]; // Accept both an Array and a Set as the first argument

  if (cache) {
    callback([bug for ([id, bug] of [...cache]) if (ids.indexOf(id) > -1)]);

    return;
  }

  this.db.transaction('bugs').objectStore('bugs')
                             .mozGetAll().addEventListener('success', event => {
    callback([bug for (bug of event.target.result) if (ids.indexOf(bug.id) > -1)]);
  });
};

BzDeck.model.get_all_bugs = function (callback) {
  let cache = this.cache.bugs;

  if (cache) {
    callback([bug for ([id, bug] of [...cache])]); // Convert Map to Array

    return;
  }

  this.db.transaction('bugs').objectStore('bugs')
                             .mozGetAll().addEventListener('success', event => {
    let bugs = event.target.result; // array of Bug

    callback(bugs);

    if (bugs && !cache) {
      this.cache.bugs = new Map([[bug.id, bug] for (bug of bugs)]);
    }
  });
};

BzDeck.model.save_bug = function (bug, callback) {
  this.save_bugs([bug], callback);
};

BzDeck.model.save_bugs = function (bugs, callback = () => {}) {
  let cache = this.cache.bugs,
      transaction = this.db.transaction('bugs', 'readwrite'),
      store = transaction.objectStore('bugs');

  transaction.addEventListener('complete', () => {
    callback(bugs);
  });

  if (!cache) {
    cache = this.cache.bugs = new Map();
  }

  for (let bug of bugs) if (bug.id) {
    cache.set(bug.id, bug);
    store.put(bug);
  }
};

BzDeck.model.fetch_bugs_by_ids = function (ids, callback) {
  let query = { id: [...ids].join(), include_fields: BzDeck.options.api.default_fields.join() };

  if (!query.id.length) {
    return;
  }

  BzDeck.core.request('GET', 'bug' + FlareTail.util.request.build_query(query), data => {
    if (data && Array.isArray(data.bugs)) {
      this.save_bugs(data.bugs);
      callback(data.bugs);
    } else {
      callback([]);
    }
  });
};

BzDeck.model.get_subscription_by_id = function (id, callback) {
  let cache = this.cache.subscriptions;

  if (cache) {
    callback(cache.get(id));

    return;
  }

  this.db.transaction('subscriptions').objectStore('subscriptions').get(id)
                                      .addEventListener('success', event => {
    callback(event.target.result);
  });
};

BzDeck.model.get_all_subscriptions = function (callback) {
  let cache = this.cache.subscriptions;

  if (cache) {
    callback([sub for ([id, sub] of [...cache])]); // Convert Map to Array

    return;
  }

  this.db.transaction('subscriptions').objectStore('subscriptions').mozGetAll()
                                      .addEventListener('success', event => {
    callback(event.target.result);
  });
};

BzDeck.model.save_subscriptions = function (subscriptions) {
  let store = this.db.transaction('subscriptions', 'readwrite').objectStore('subscriptions'),
      cache = this.cache.subscriptions;

  if (!cache) {
    cache = this.cache.subscriptions = new Map();
  }

  for (let sub of subscriptions) if (sub.id) {
    store.put(sub);
    cache.set(sub.id, sub);
  }
};

/* ----------------------------------------------------------------------------------------------
 * Session
 * ---------------------------------------------------------------------------------------------- */

BzDeck.session = {};

BzDeck.session.login = function () {
  let $app_login = document.querySelector('#app-login'),
      $app_body = document.querySelector('#app-body');

  BzDeck.global.$statusbar = document.querySelector('#statusbar');

  $app_login.setAttribute('aria-hidden', 'true');
  $app_body.removeAttribute('aria-hidden');

  // TODO: focus handling

  // GA
  if (_gaq) {
    _gaq.push(['_trackEvent', 'Session', 'Login'], ['_setCustomVar', 1, 'Login', 'true', 2]);
  }
};

BzDeck.session.logout = function () {
  let $app_login = document.querySelector('#app-login'),
      $app_body = document.querySelector('#app-body');

  BzDeck.global.$statusbar = $app_login.querySelector('[role="status"]');
  BzDeck.global.show_status('You have logged out.'); // l10n

  $app_login.removeAttribute('aria-hidden');
  $app_body.setAttribute('aria-hidden', 'true');

  BzDeck.bootstrap.show_login_form(false);

  // Terminate timers
  for (let [key, timer] of Iterator(BzDeck.core.timers)) {
    window.clearInterval(timer);
  }

  // Delete the account data
  BzDeck.model.db.transaction('accounts', 'readwrite').objectStore('accounts')
                                                      .delete(BzDeck.data.account.id);
  delete BzDeck.data.account;

  // GA
  if (_gaq) {
    _gaq.push(['_setCustomVar', 1, 'Login', 'false', 2], ['_trackEvent', 'Session', 'Logout']);
  }
};

/* ----------------------------------------------------------------------------------------------
 * Global
 * ---------------------------------------------------------------------------------------------- */

BzDeck.global = {};

BzDeck.global.install_app = function () {
  FlareTail.util.app.install(BzDeck.options.app.manifest, event => {
    if (event.type === 'success') {
      document.querySelector('#main-menu--app--install').setAttribute('aria-disabled', 'true');
    }
  });
};

BzDeck.global.show_status = function (message) {
  this.$statusbar.textContent = message;
};

BzDeck.global.show_notification = function (title, body) {
  FlareTail.util.app.show_notification(title, {
    body: body,
    icon: '/static/images/logo/icon-256.png'
  });
};

BzDeck.global.register_activity_handler = function () {
  // Match BMO's bug detail pages.
  // TODO: Implement a handler for attachments
  let re = /^https?:\/\/(?:bugzilla\.mozilla\.org\/show_bug\.cgi\?id=|bugzil\.la\/)(\d+)$/;

  // Not implemented yet on Firefox OS nor Firefox for Android
  if (typeof navigator.mozRegisterActivityHandler === 'function') {
    navigator.mozRegisterActivityHandler({
      name: 'view',
      filters: {
        type: 'url',
        url: {
          required: true,
          regexp: re
        }
      }
    });
  }

  if (typeof navigator.mozSetMessageHandler === 'function') {
    navigator.mozSetMessageHandler('activity', req => {
      if (req.source.url.match(re)) {
        BzDeck.detailspage = new BzDeck.DetailsPage(Number.parseInt(RegExp.$1));
      }
    });
  }
};

BzDeck.global.fill_template = function ($template, bug, clone = false) {
  if (!$template) {
    return null;
  }

  let $content,
      FTw = FlareTail.widget;

  if (!clone) {
    $content = $template;
  } else {
    $content = $template.cloneNode(true).firstElementChild;

    // Assign unique IDs
    $content.id = $content.id.replace(/TID/, bug.id);

    if ($content.hasAttribute('aria-labelledby')) {
      $content.setAttribute('aria-labelledby',
                            $content.getAttribute('aria-labelledby').replace(/TID/, bug.id));
    }

    for (let attr of ['id', 'aria-controls', 'aria-labelledby']) {
      for (let $element of $content.querySelectorAll('[' + attr +']')) {
        $element.setAttribute(attr, $element.getAttribute(attr).replace(/TID/, bug.id));
      }
    }

    // Star on the header
    let $star_checkbox = $content.querySelector('[role="checkbox"][data-field="_starred"]');
    (new FTw.Checkbox($star_checkbox)).bind('Toggled', event => {
      BzDeck.core.toggle_star(bug.id, event.detail.checked);
    });

    for (let $area of $content.querySelectorAll('.scrollable')) {
      // Custom scrollbar
      let scrollbar = new FTw.ScrollBar($area);

      if (scrollbar && $area.classList.contains('bug-timeline')) {
        scrollbar.onkeydown_extend = BzDeck.global.handle_timeline_keydown.bind(scrollbar);
      }

      $area.tabIndex = 0;
    }
  }

  $content.dataset.id = bug.id;
  $content.setAttribute('aria-busy', 'true');

  if (!bug.summary) {
    // The bug is being loaded
    return $content;
  }

  let config = BzDeck.data.bugzilla_config,
      classifications = config.classification,
      products = config.product,
      strip_tags = str => FlareTail.util.string.strip_tags(str).replace(/\s*\(more\ info\)$/i, '');

  for (let $element of $content.querySelectorAll('[data-field]')) {
    let key = $element.getAttribute('data-field'),
        value = bug[key];

    if (BzDeck.options.api.extra_fields.indexOf(key) > -1) {
      continue; // BzDeck.global.fill_template_details
    }

    if (key.endsWith('_time')) {
      FlareTail.util.datetime.fill_element($element, value, { relative: false });

      if (key === 'creation_time') {
        $element.itemProp.value = 'datePublished';
      }

      if (key === 'last_change_time') {
        $element.itemProp.value = 'dateModified';
      }

      continue;
    }

    if (key === 'keywords' && Array.isArray(value)) {
      let $ul = $element.appendChild(document.createElement('ul')),
          $_li = document.createElement('li');

      $_li.setAttribute('role', 'button');
      $_li.itemProp.value = 'keywords';

      for (let _value of value) {
        let $li = $ul.appendChild($_li.cloneNode(true));
        $li.textContent = _value;
        new FTw.Button($li);
      }

      continue;
    }

    if (key === 'classification') {
      try {
        $element.title = strip_tags(classifications[bug.classification].description);
      } catch (ex) {} // The classification has been renamed or removed
    }

    if (key === 'product') {
      try {
        $element.title = strip_tags(products[bug.product].description);
      } catch (ex) {} // The product has been renamed or removed
    }

    if (key === 'component') {
      try {
        $element.title = strip_tags(products[bug.product].component[bug.component].description);
      } catch (ex) {} // The product or component has been renamed or removed
    }

    if (['creator', 'assigned_to', 'qa_contact'].indexOf(key) > -1) {
      $element.querySelector('[itemprop="name"]').textContent = value.real_name || value.name || '';

      continue;
    }

    if (key === 'url' && value) {
      let $link = $element.appendChild(document.createElement('a'));
      $link.href = $link.text = value;
      $link.setAttribute('role', 'link');

      continue;
    }

    if (key === '_starred') {
      $element.setAttribute('aria-checked', value ? 'true' : 'false');

      continue;
    }

    if (value) {
      $element.textContent = value;

      continue;
    }

    $element.innerHTML = '&nbsp;';
  }

  $content.removeAttribute('aria-busy');

  let $timeline = $content.querySelector('.bug-timeline');

  if (!$timeline) {
    return $content;
  }

  $timeline.setAttribute('aria-busy', 'true');
  BzDeck.global.show_status('Loading...'); // l10n

  // Empty timeline while keeping the template and scrollbar
  for (let $comment of $timeline.querySelectorAll('[itemprop="comment"]')) {
    $comment.remove();
  }

  if (bug.comments && !bug._update_needed) {
    this.fill_template_details($content, bug);
  } else {
    // Load comments, history, flags and attachments' metadata
    BzDeck.core.load_bug_details([bug.id], bug => {
      this.fill_template_details($content, bug);
    });
  }

  return $content;
};

BzDeck.global.fill_template_details = function ($content, bug) {
  // When the comments and history are loaded async, the template can be removed
  // or replaced at the time of call, if other bug is selected by user
  if (!$content || Number.parseInt($content.dataset.id) !== bug.id) {
    return;
  }

  let $placeholder,
      conf_field = BzDeck.data.bugzilla_config.field,
      prefs = BzDeck.data.prefs,
      datetime = FlareTail.util.datetime;

  // dupe_of
  $placeholder = $content.querySelector('[data-field="resolution"]');

  if ($placeholder && bug.resolution === 'DUPLICATE' && bug.dupe_of) {
    $placeholder.textContent = 'DUPLICATE of ' + bug.dupe_of; // l10n
  }

  // CC
  $placeholder = $content.querySelector('[data-field="cc"]');

  if ($placeholder) {
    if (Array.isArray(bug.cc)) {
      let $ul = $placeholder.querySelector('ul'),
          $_li = $ul.removeChild($ul.firstElementChild);

      for (let value of bug.cc) {
        let $li = $ul.appendChild($_li.cloneNode(true));
        $li.querySelector('[itemprop="name"]').textContent = value.name;
      }
    } else {
      $placeholder.innerHTML = '&nbsp;';
    }
  }

  // Depends on & Blocks
  for (let field of ['depends_on', 'blocks']) {
    $placeholder = $content.querySelector('[data-field="' + field + '"]');

    if ($placeholder) {
      let $ul = $placeholder.appendChild(document.createElement('ul'));

      if (Array.isArray(bug[field])) {
        for (let value of bug[field]) {
          let $li = $ul.appendChild(document.createElement('li'));
          $li.textContent = value;
          $li.setAttribute('role', 'button');
          $li.setAttribute('data-bug-id', value);

          (new FlareTail.widget.Button($li)).bind('Pressed', event => {
            BzDeck.detailspage = new BzDeck.DetailsPage(
              Number.parseInt(event.target.textContent)
            );
          });
        }
      } else {
        $placeholder.innerHTML = '&nbsp;';
      }
    }
  }

  // See Also
  $placeholder = $content.querySelector('[data-field="see_also"]');

  if ($placeholder) {
    if (Array.isArray(bug.see_also)) {
      let $ul = $placeholder.appendChild(document.createElement('ul'));

      for (let value of bug.see_also) {
        let $li = $ul.appendChild(document.createElement('li')),
            $link = $li.appendChild(document.createElement('a'));

        $link.href = $link.text = value;
        $link.setAttribute('role', 'link');
      }
    } else {
      $placeholder.innerHTML = '&nbsp;';
    }
  }

  // Attachments
  $placeholder = $content.querySelector('[data-field="attachments"]');

  if ($placeholder && bug.attachments && bug.attachments.length) {
    let $tab = $content.querySelector('[role="tab"][id$="-tab-attachments"]');

    if ($tab) {
      $tab.setAttribute('aria-hidden', 'false');
    }

    for (let $section of $placeholder.querySelectorAll('section[data-attachment-id]')) {
      $section.remove();
    }

    let $entry_tmpl = $placeholder.querySelector('[itemprop="associatedMedia"]');

    for (let att of bug.attachments) {
      let $entry = $placeholder.appendChild($entry_tmpl.cloneNode(true));
      $entry.dataset.attachmentId = att.id;
      $entry.setAttribute('aria-hidden', 'false');

      let $link = $entry.querySelector('[itemprop="url"]');
      $link.href = '/bug/' + bug.id + '/attachment/' + att.id;
      $link.dataset.attachmentId = att.id;

      let $title = $link.querySelector('[itemprop="name"]');

      if (att.is_obsolete) {
        let $_title = document.createElement('del');
        $_title.itemProp.value = 'name';
        $link.replaceChild($_title, $title);
        $title = $_title;
      }

      $title.itemValue = att.description;

      $entry.querySelector('[itemprop="contentSize"]')
            .itemValue = (att.size / 1024).toFixed(2) + ' KB'; // l10n
      $entry.querySelector('[itemprop="encodingFormat"]')
            .itemValue = att.is_patch ? 'Patch' : att.content_type; // l10n
      $entry.querySelector('[itemprop="creator"] [itemprop="name"]')
            .itemValue = att.attacher.name;

      datetime.fill_element($entry.querySelector('[itemprop="uploadDate"]'),
                            att.creation_time, { relative: false });

      let $flags = $entry.querySelector('.flags');

      if (att.flags) {
        for (let flag of att.flags) {
          $flags.appendChild(document.createElement('li'))
                .textContent = flag.setter.name + ': ' + flag.name + flag.status;
        }
      } else {
        $flags.appendChild(document.createElement('li')).textContent = 'No Flags'; // l10n
      }
    }
  }

  // Flags
  $placeholder = $content.querySelector('[data-field="flags"]');

  if ($placeholder) {
    let $ul = $placeholder.querySelector('ul');

    if ($ul) {
      $ul.remove();
    }

    if (!bug.flags) {
      $placeholder.setAttribute('aria-hidden', 'true');
    } else {
      $placeholder.removeAttribute('aria-hidden');
      $ul = $placeholder.appendChild(document.createElement('ul'));

      for (let flag of bug.flags) {
        $ul.appendChild(document.createElement('li'))
           .textContent = flag.setter.name + ': ' + flag.name + flag.status;
      }
    }
  }

  // History
  $placeholder = $content.querySelector('[data-field="history"]');

  if ($placeholder && bug.history && bug.history.length) {
    let $tab = $content.querySelector('[role="tab"][id$="-tab-history"]');

    if ($tab) {
      $tab.setAttribute('aria-hidden', 'false');
    }

    let $tbody = $placeholder.querySelector('tbody');

    let change_cell_content = (field, content) => {
      if (['blocks', 'depends_on'].indexOf(field) > -1) {
        return content.replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>');
      }

      return content.replace('@', '&#8203;@'); // ZERO WIDTH SPACE
    }

    for (let history of bug.history) {
      for (let [i, change] of Iterator(history.changes)) {
        let $row = $tbody.insertRow(-1);

        if (i === 0) {
          let $cell_when = $row.appendChild(document.createElement('th')),
              $cell_who = $row.insertCell(-1);

          $cell_when.dataset.item = 'when';
          $cell_who.innerHTML = history.changer.name.replace('@', '&#8203;@');
          $cell_who.dataset.item = 'who';
          $cell_who.rowSpan = $cell_when.rowSpan = history.changes.length;

          datetime.fill_element($cell_when.appendChild(document.createElement('time')),
                                history.change_time, { relative: false });
        }

        let _field = conf_field[change.field_name] ||
                     // Bug 909055 - Field name mismatch in history: group vs groups
                     conf_field[change.field_name.replace(/s$/, '')] ||
                     // If the Bugzilla config is outdated, the field name can be null
                     change.field_name,
            $cell_what = $row.insertCell(-1),
            $cell_removed = $row.insertCell(-1),
            $cell_added = $row.insertCell(-1);

        $cell_what.textContent = _field.description;
        $cell_what.dataset.item = 'what';

        $cell_removed.innerHTML = change_cell_content(change.field_name, change.removed);
        $cell_removed.dataset.item = 'removed';

        $cell_added.innerHTML = change_cell_content(change.field_name, change.added);
        $cell_added.dataset.item = 'added';
      }
    }
  }

  // TODO: Show Project Flags and Tracking Flags

  // Timeline: comments & history
  let entries = {},
      $timeline = $content.querySelector('.bug-timeline'),
      $entry_tmpl = document.querySelector('template#timeline-comment').content,
      parse = BzDeck.global.parse_comment,
      sanitize = FlareTail.util.string.sanitize;

  // Comments
  for (let comment of bug.comments) {
    let $entry = $entry_tmpl.cloneNode(true).firstElementChild,
        $author = $entry.querySelector('[itemprop="author"]'),
        author = comment.creator,
        time = comment.creation_time,
        text = comment.raw_text ||
               (comment.text || '').replace(/^Created\ attachment\ \d+\n.+(?:\n\n)?/m, '');

    $entry.id = $content.id + '-comment-' + comment.id;
    $entry.dataset.id = comment.id;
    $entry.dataset.time = (new Date(time)).getTime();
    $entry.querySelector('[itemprop="text"]').innerHTML = text ? parse(sanitize(text)) : '';

    $author.title = $author.querySelector('[itemprop="name"]').itemValue
                  = author.real_name || author.name;

    // Set the user's avatar if author.real_name is the email address
    if (author.real_name.contains('@')) {
      $author.querySelector('[itemprop="email"]').content = author.real_name;

      let ($avatar = new Image()) {
        $avatar.addEventListener('load', event => {
          $author.querySelector('[itemprop="image"]').src = $avatar.src;
        });
        $avatar.src = 'https://www.gravatar.com/avatar/' + md5(author.real_name) + '?d=404';
      }
    }

    datetime.fill_element($entry.querySelector('[itemprop="datePublished"]'), time);

    entries[time] = $entry;
  }

  // Attachments
  for (let att of bug.attachments || []) {
    // TODO: load the attachment data via API
    let url = 'https://bug' + bug.id + '.bugzilla.mozilla.org/' + 'attachment.cgi?id=' + att.id,
        $content = FlareTail.util.template.fill('#timeline-attachment', {
          'attachment-id': att.id,
          'url': '/attachment/' + att.id,
          'description': att.description,
          'name': att.file_name,
          'contentSize': att.size,
          'contentUrl': url,
          'encodingFormat': att.is_patch ? '' : att.content_type
        }),
        $outer = $content.querySelector('div'),
        $media,
        load_event = 'load';

    $content.firstElementChild.title = [
      att.description,
      att.file_name,
      att.is_patch ? 'Patch' : att.content_type, // l10n
      (att.size / 1024).toFixed(2) + ' KB' // l10n
    ].join('\n');

    if (att.content_type.startsWith('image/')) {
      $media = document.createElement('img');
      $media.alt = att.description;
    }

    if (att.content_type.match(/^(audio|video)\//)) {
      $media = document.createElement(RegExp.$1);
      $media.controls = true;
      load_event = 'loadedmetadata';

      if ($media.canPlayType(att.content_type) === '') {
        $media = null; // Cannot play the media
      }
    }

    if ($media) {
      $outer.appendChild($media);
      $media.addEventListener(load_event, event => {
        $outer.removeAttribute('aria-busy');
      });

      if (prefs['ui.timeline.display_attachments_inline'] !== false) {
        $outer.setAttribute('aria-busy', 'true');
        $media.src = url;
      }
    } else {
      // TODO: support other attachment types
      $outer.remove();
    }

    entries[att.creation_time].appendChild($content);
  }

  // Changes
  for (let history of (bug.history || [])) {
    let $entry,
        $author,
        author = history.changer,
        time = history.change_time;

    if (time in entries) {
      // Combine a comment + change(s)
      $entry = entries[time];
      $author = $entry.querySelector('[itemprop="author"]');

      if ($author.title !== author.name) {
        $author.title += '\n' + author.name;
      }
    } else {
      $entry = $entry_tmpl.cloneNode(true).firstElementChild;
      $entry.dataset.time = (new Date(time)).getTime();
      $entry.dataset.nocomment = true;
      $entry.querySelector('[itemprop="text"]').remove();

      $author = $entry.querySelector('[itemprop="author"]');
      $author.title = $author.querySelector('[itemprop="name"]').itemValue = author.name;

      datetime.fill_element($entry.querySelector('[itemprop="datePublished"]'), time);

      entries[time] = $entry;
    }

    $author.querySelector('[itemprop="email"]').content = author.name;

    // Set the user's avatar assuming author.name is the email address
    let ($avatar = new Image()) {
      $avatar.addEventListener('load', event => {
        $author.querySelector('[itemprop="image"]').src = $avatar.src;
      });
      $avatar.src = 'https://www.gravatar.com/avatar/' + md5(author.name) + '?d=404';
    }

    let $changes = $entry.appendChild(document.createElement('ul'));
    $changes.className = 'changes';

    let generate_element = (change, how) => {
      let $elm = document.createElement(how === 'removed' ? 'del' : 'ins');

      if (['blocks', 'depends_on'].indexOf(change.field_name) > -1) {
        $elm.innerHTML = change[how].replace(
          /(\d+)/g,
          '<a href="/bug/$1" data-bug-id="$1">$1</a>'
        );
      } else {
        $elm.textContent = change[how];
      }

      return $elm;
    };

    $entry.dataset.changes = [change.field_name for (change of history.changes)].join(' ');

    for (let change of history.changes) {
      let $change = $changes.appendChild(document.createElement('li')),
          _field = conf_field[change.field_name] ||
                   // Bug 909055 - Field name mismatch in history: group vs groups
                   conf_field[change.field_name.replace(/s$/, '')] ||
                   // If the Bugzilla config is outdated, the field name can be null
                   change.field_name;

      $change.textContent = _field.description + ': ';
      $change.setAttribute('data-change-field', change.field_name);

      if (change.removed) {
        $change.appendChild(generate_element(change, 'removed'));
      }

      if (change.removed && change.added) {
        $change.appendChild(document.createTextNode(' → '));
      }

      if (change.added) {
        $change.appendChild(generate_element(change, 'added'));
      }
    }
  }

  let sort_order = prefs['ui.timeline.sort.order'] || 'ascending',
      $parent = $timeline.querySelector('section, .scrollable-area-content');

  // Sort by time
  entries = [{ time: key, $element: value } for ([key, value] of [...Iterator(entries)])]
    .sort((a, b) => sort_order === 'descending' ? a.time < b.time : a.time > b.time);

  // Append to the timeline
  for (let entry of entries) {
    let $entry = $parent.appendChild(entry.$element);

    // Click to collapse/expand comments
    // TODO: Save the state in DB
    $entry.setAttribute('aria-expanded', 'true');
    $entry.querySelector('header').addEventListener('click', event => {
      $entry.setAttribute('aria-expanded', $entry.getAttribute('aria-expanded') === 'false');
    });
  }

  $timeline.scrollTop = 0;
  $timeline.removeAttribute('aria-busy', 'false');
  BzDeck.global.show_status('');

  // Add tooltips to the related bugs
  let (related_bug_ids = new Set([Number.parseInt($element.getAttribute('data-bug-id'))
                                  for ($element of $content.querySelectorAll('[data-bug-id]'))])) {
    let add_tooltops = bugs => {
      for (let bug of bugs) {
        if (bug.summary) {
          let title = bug.status + ' ' + bug.resolution + ' – ' + bug.summary;

          for (let $element of $content.querySelectorAll('[data-bug-id="' + bug.id + '"]')) {
            $element.title = title;
            $element.dataset.status = bug.status;
            $element.dataset.resolution = bug.resolution;
          }
        }
      }
    };

    if (related_bug_ids.size) {
      BzDeck.model.get_bugs_by_ids(related_bug_ids, bugs => {
        add_tooltops(bugs);

        let found_bug_ids = new Set([bug.id for (bug of bugs)]),
            lookup_bug_ids = new Set([id for (id of related_bug_ids) if (!found_bug_ids.has(id))]);

        if (lookup_bug_ids.size) {
          BzDeck.model.fetch_bugs_by_ids(lookup_bug_ids, bugs => add_tooltops(bugs));
        }
      });
    }
  }
};

BzDeck.global.update_grid_data = function (grid, bugs) {
  grid.build_body(bugs.map(bug => {
    let row = {
      id: grid.view.$container.id + '-row-' + bug.id,
      data: {},
      dataset: {
        unread: bug._unread === true,
        severity: bug.severity
      }
    };

    for (let column of grid.data.columns) {
      let field = column.id,
          value = bug[field];

      if (Array.isArray(value)) { // Keywords
        value = value.join(', ');
      }

      if (typeof value === 'object') { // Person
        value = value.real_name || value.name || '';
      }

      if (field === '_starred' || field === '_unread') {
        value = value === true;
      }

      if (!value) {
        value = '';
      }

      row.data[field] = value;
    }

    row.data = new Proxy(row.data, {
      set: (obj, prop, value) => {
        if (prop === '_starred') {
          BzDeck.core.toggle_star(obj.id, value);
        }

        if (prop === '_unread') {
          BzDeck.core.toggle_unread(obj.id, value);

          let row = [row for (row of grid.data.rows) if (row.data.id === obj.id)][0];

          if (row && row.$element) {
            row.$element.dataset.unread = value;
          }
        }

        obj[prop] = value;
      }
    });

    return row;
  }));
}

BzDeck.global.handle_timeline_keydown = function (event) {
  // this = a binded Scrollbar widget
  let key = event.keyCode,
      modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;

  // [Tab] move focus
  if (key === event.DOM_VK_TAB) {
    return true;
  }

  // [B] previous bug or [F] next bug
  if (document.documentElement.getAttribute('data-current-tab') === 'home' &&
      !modifiers && [event.DOM_VK_B, event.DOM_VK_F].indexOf(key) > -1) {
    let (_event = document.createEvent("KeyboardEvent")) {
      _event.initKeyEvent('keydown', true, true, null, false, false, false, false, key, 0);
      document.querySelector('#home-list').dispatchEvent(_event);
      this.view.$owner.focus();
    }

    return FlareTail.util.event.ignore(event);
  }

  // [M] toggle read or [S] toggle star
  if (!modifiers && [event.DOM_VK_M, event.DOM_VK_S].indexOf(key) > -1) {
    let $parent = this.view.$owner.parentElement,
        bug_id = Number.parseInt($parent.dataset.id || $parent.id.match(/^bug-(\d+)/)[1]);

    BzDeck.model.get_bug_by_id(bug_id, bug => {
      if (key === event.DOM_VK_M) {
        BzDeck.core.toggle_unread(bug_id, !bug._unread);
      }

      if (key === event.DOM_VK_S) {
        BzDeck.core.toggle_star(bug_id, !bug._starred);
      }
    });

    return FlareTail.util.event.ignore(event);
  }

  if (event.currentTarget !== this.view.$owner ||
      [event.DOM_VK_SPACE, event.DOM_VK_PAGE_UP, event.DOM_VK_PAGE_DOWN].indexOf(key) === -1) {
    this.scroll_with_keyboard(event); // Use default handler
    return FlareTail.util.event.ignore(event);
  }

  let shift = key === event.DOM_VK_PAGE_UP || key === event.DOM_VK_SPACE && event.shiftKey,
      $timeline = event.currentTarget,
      comments = [...$timeline.querySelectorAll('[itemprop="comment"]')],
      timeline_top = Math.round($timeline.getBoundingClientRect().top);

  for (let $comment of shift ? comments.reverse() : comments) {
    if ($comment.clientHeight === 0) {
      continue; // The comment is collapsed
    }

    let top = Math.round($comment.getBoundingClientRect().top) - timeline_top;

    if (shift && top < 0 || !shift && top > 0) {
      $timeline.scrollTop += top;
      break;
    }
  }

  return FlareTail.util.event.ignore(event);
};

BzDeck.global.parse_comment = function (str) {
  let blockquote = p => {
    let regex = /^&gt;\s?/gm;

    if (!p.match(regex)) {
      return p;
    }

    let lines = p.split(/\n/),
        quote = [];

    for (let [i, line] of Iterator(lines)) {
      if (line.match(regex)) {
        // A quote start
        quote.push(line);
      }

      if ((!line.match(regex) || !lines[i + 1]) && quote.length) {
        // A quote end, the next line is not a part of the quote, or no more lines
        let quote_str = quote.join('\n'),
            quote_repl = quote_str.replace(regex, '');

        if (quote_repl.match(regex)) {
          // Nested quote(s) found, do recursive processing
          quote_repl = blockquote(quote_repl);
        }

        for (let p of quote_repl.split(/\n{2,}/)) {
          quote_repl = quote_repl.replace(p, '<p>' + p + '</p>');
        }

        p = p.replace(quote_str, '<blockquote>' + quote_repl + '</blockquote>');
        quote = [];
      }
    }

    return p;
  };

  // Quotes
  for (let p of str.split(/\n{2,}/)) {
    str = str.replace(p, '<p>' + blockquote(p) + '</p>');
  }

  str = str.replace(/\n{2,}/gm, '').replace(/\n/gm, '<br>');

  // General links
  str = str.replace(
    /((https?|ftp|news):\/\/[\w-]+(\.[\w-]+)+((&amp;|[\w.,@?^=%$:\/~+#-])*(&amp;|[\w@?^=%$\/~+#-]))?)/gm,
    '<a href="$1">$1</a>'
  );

  // Bugs
  str = str.replace(
    /Bug\s#?(\d+)/igm,
    '<a href="/bug/$1" data-bug-id="$1">Bug $1</a>' // l10n
  );

  // Attachments
  str = str.replace(
    /Attachment\s#?(\d+)/igm,
    '<a href="/attachment/$1" data-attachment-id="$1">Attachment $1</a>' // l10n
  );

  return str;
};

/* ----------------------------------------------------------------------------------------------
 * Toolbar
 * ---------------------------------------------------------------------------------------------- */

BzDeck.toolbar = {};

BzDeck.toolbar.setup = function () {
  let FTw = FlareTail.widget,
      FTu = FlareTail.util,
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      phone = FlareTail.util.device.type === 'mobile-phone',
      tablist = this.tablist = new FTw.TabList(document.querySelector('#main-tablist')),
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  // Change the window title when a new tab is selected
  tablist.bind('Selected', event => {
    let $tab = event.detail.items[0],
        sidebar = BzDeck.sidebar.data,
        path = $tab.id.replace(/^tab-(.+)/, '$1'),
        title = $tab.title.replace('\n', ' – ');

    if (path === 'home') {
      if (!sidebar.folder_id) {
        sidebar.folder_id = 'inbox';
      }

      path = 'home/' + sidebar.folder_id;
    } else {
      path = path.replace(/^details-/, 'bug/').replace(/^(search)-/, '$1/');
    }

    $root.setAttribute('data-current-tab', path.split('/')[0]);
    path = '/' + path;

    if (location.pathname !== path) {
      history.pushState({}, title, path);
    }

    document.title = title;
    document.querySelector('[role="banner"] h1').textContent = $tab.textContent;
  });

  new FTw.MenuBar(document.querySelector('#main-menu'));

  let $app_menu = document.querySelector('#main-menu--app-menu');

  $app_menu.addEventListener('MenuItemSelected', event => {
    switch (event.detail.command) {
      case 'show-settings': {
        new BzDeck.SettingsPage();
        break;
      }

      case 'toggle-fullscreen': {
        // Fullscreen requests from custom events are denied due to Bug 779324. A workaround below
        // FTu.app.toggle_fullscreen();
        break;
      }

      case 'install-app': {
        BzDeck.global.install_app();
        break;
      }

      case 'logout': {
        BzDeck.session.logout();
        break;
      }

      case 'quit': {
        window.close();
        break;
      }
    }
  });

  $app_menu.addEventListener('MenuClosed', event => {
    if (mobile) {
      // Keep the menu open
      $app_menu.removeAttribute('aria-expanded');
      // Hide the sidebar
      $root.setAttribute('data-sidebar-hidden', 'true');
      $sidebar.setAttribute('aria-hidden', 'true');
    }
  });

  $app_menu.setAttribute('aria-expanded', mobile);

  if (FTu.app.fullscreen_enabled) {
    let ($menuitem = document.querySelector('#main-menu--app--fullscreen')) {
      $menuitem.removeAttribute('aria-hidden');

      // A workaround for Bug 779324
      $menuitem.addEventListener('click', event => FTu.app.toggle_fullscreen());
      $menuitem.addEventListener('keydown', event => {
        if (event.keyCode === event.DOM_VK_RETURN) {
          FTu.app.toggle_fullscreen();
        }
      });
    }
  }

  // Show the Quit menu item if the app runs on WebAppRT
  if (!window.locationbar.visible) {
    document.querySelector('#main-menu--app--quit').removeAttribute('aria-hidden');
  }

  let tabs = BzDeck.toolbar.tablist.view,
      $tab_home = document.querySelector('#tab-home');

  document.querySelector('[role="banner"] h1').addEventListener('click', event => {
    if (mobile) {
      if (phone && tabs.selected[0] === $tab_home) {
        document.querySelector('#sidebar > div').scrollTop = 0;

        let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';
        $root.setAttribute('data-sidebar-hidden', hidden);
        $sidebar.setAttribute('aria-hidden', hidden);
      } else {
        tabs.selected = $tab_home;
      }
    }
  });

  $root.setAttribute('data-current-tab', 'home');

  // Account label & avatar
  let account = BzDeck.data.account,
      account_label = (account.real_name ? '<strong>' + account.real_name + '</strong>' : '&nbsp;')
                    + '<br>' + account.name,
      $account_label = document.querySelector('#main-menu--app--account label'),
      $account_img = new Image();

  $account_label.innerHTML = account_label;
  $account_img.addEventListener('load', event => {
    $account_label.style.backgroundImage = 'url(' + event.target.src + ')';
  });
  $account_img.src = 'https://www.gravatar.com/avatar/' + md5(account.name) + '?d=404';

  FTu.app.can_install(BzDeck.options.app.manifest, result => {
    if (result) {
      document.querySelector('#main-menu--app--install').removeAttribute('aria-hidden');
    }
  });

  let $banner = document.querySelector('[role="banner"]'),
      $search_box = document.querySelector('[role="banner"] [role="search"] input'),
      $search_button = document.querySelector('[role="banner"] [role="search"] [role="button"]'),
      $search_dropdown = document.querySelector('#quicksearch-dropdown');

  this.search_dropdown = new FlareTail.widget.Menu($search_dropdown);

  let cleanup = () => {
    this.search_dropdown.close();
    $banner.classList.remove('search');
    $search_box.value = '';
    $search_button.focus();
  };

  let exec_search = () => {
    let page = new BzDeck.SearchPage(),
        terms = $search_box.value;

    if (terms) {
      page.view.panes['basic-search'].querySelector('.text-box [role="textbox"]').value = terms;
      page.exec_search({
        'summary': terms,
        'summary_type': 'contains_all',
        'resolution': '---' // Search only open bugs
      });
    }

    cleanup();
  };

  window.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_K && (event.metaKey || event.ctrlKey)) {
      $search_box.focus();
      event.preventDefault();
    }
  });

  window.addEventListener('mousedown', event => cleanup());
  window.addEventListener('popstate', event => cleanup());

  $search_box.addEventListener('input', event => {
    if (event.target.value.trim()) {
      this.quicksearch(event);
    } else {
      this.search_dropdown.close();
    }
  });

  $search_box.addEventListener('keydown', event => {
    if ((event.keyCode === event.DOM_VK_UP || event.keyCode === event.DOM_VK_DOWN) &&
        event.target.value.trim() && this.search_dropdown.closed) {
      this.quicksearch(event);
    }

    if (event.keyCode === event.DOM_VK_RETURN) {
      this.search_dropdown.close();
      exec_search();
    }
  });

  $search_box.addEventListener('mousedown', event => {
    event.stopPropagation();
  });

  $search_button.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_RETURN || event.keyCode === event.DOM_VK_SPACE) {
      exec_search();
    }
  });

  $search_button.addEventListener('mousedown', event => {
    event.stopPropagation();

    if (mobile) {
      if (!$banner.classList.contains('search')) {
        $banner.classList.add('search');
        // Somehow moving focus doesn't work, so use the async function here
        FlareTail.util.event.async(() => $search_box.focus());
      } else if ($search_box.value) {
        exec_search();
      }
    } else {
      exec_search();
    }
  });

  $search_dropdown.addEventListener('MenuItemSelected', event => {
    // Show the bug or search results
    let $target = event.detail.target,
        id = $target.dataset.id;

    if (id) {
      BzDeck.detailspage = new BzDeck.DetailsPage(Number.parseInt(id));
      cleanup();
    }

    if ($target.mozMatchesSelector('#quicksearch-dropdown-more')) {
      exec_search();
    }
  });

  // Suppress context menu
  $search_box.addEventListener('contextmenu', event => {
    return FTu.event.ignore(event);
  }, true); // use capture
};

BzDeck.toolbar.quicksearch = function (event) {
  let words = [word.toLowerCase() for (word of event.target.value.trim().split(/\s+/))];

  BzDeck.model.get_all_bugs(bugs => {
    let results = bugs.filter(bug => {
      return (words.every(word => bug.summary.toLowerCase().contains(word)) ||
              words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).contains(words[0])) &&
              BzDeck.data.bugzilla_config.field.status.open.indexOf(bug.status) > -1;
    });

    results.reverse();

    let data = [{
      id: 'quicksearch-dropdown-header',
      label: results.length ? 'Local Search' : 'Local Search: No Results', // l10n
      disabled: true
    }];

    for (let [i, bug] of Iterator(results)) {
      data.push({
        id: 'quicksearch-dropdown-' + bug.id,
        label: bug.id + ' - ' + bug.summary,
        data: { id: bug.id }
      });

      if (i === 20) {
        break;
      }
    }

    data.push({ type: 'separator' });
    data.push({ id: 'quicksearch-dropdown-more', label: 'Search All Bugs...' }); // l10n

    let dropdown = this.search_dropdown;
    dropdown.build(data);
    dropdown.view.$container.scrollTop = 0;
    dropdown.open();
  });
};

/* ----------------------------------------------------------------------------------------------
 * Sidebar
 * ---------------------------------------------------------------------------------------------- */

BzDeck.sidebar = {};

BzDeck.sidebar.setup = function () {
  let FTw = FlareTail.widget,
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      phone = FlareTail.util.device.type === 'mobile-phone',
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  if (mobile) {
    document.querySelector('#sidebar-account')
            .appendChild(document.querySelector('#main-menu--app--account'));
    document.querySelector('#sidebar-menu')
            .appendChild(document.querySelector('#main-menu--app-menu'));
  }

  $root.setAttribute('data-sidebar-hidden', phone);
  $sidebar.setAttribute('aria-hidden', phone);

  new FTw.ScrollBar($sidebar.querySelector('div'));

  $sidebar.addEventListener('click', event => {
    if (phone) {
      let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';
      $root.setAttribute('data-sidebar-hidden', hidden);
      $sidebar.setAttribute('aria-hidden', hidden);
    }
  });

  this.folder_data = [
    {
      'id': 'sidebar-folders--inbox',
      'label': 'Inbox',
      'selected': true,
      'data': { 'id': 'inbox' }
    },
    {
      'id': 'sidebar-folders--starred',
      'label': 'Starred',
      'data': { 'id': 'starred' }
    },
    {
      'id': 'sidebar-folders--unread',
      'label': 'Unread',
      'data': { 'id': 'unread' }
    },
    {
      'id': 'sidebar-folders--needinfo',
      'label': 'Need Info',
      'data': { 'id': 'needinfo' }
    },
    {
      'id': 'sidebar-folders--cc',
      'label': 'CCed',
      'data': { 'id': 'cc' }
    },
    {
      'id': 'sidebar-folders--reported',
      'label': 'Reported',
      'data': { 'id': 'reported' }
    },
    {
      'id': 'sidebar-folders--assigned',
      'label': 'Assigned',
      'data': { 'id': 'assigned' }
    },
    {
      'id': 'sidebar-folders--qa',
      'label': 'QA Contact',
      'data': { 'id': 'qa' }
    },
    {
      'id': 'sidebar-folders--important',
      'label': 'Important',
      'data': { 'id': 'important' }
    },
    {
      'id': 'sidebar-folders--all',
      'label': 'All Bugs',
      'data': { 'id': 'all' }
    }
  ];

  let folders = this.folders
              = new FTw.ListBox(document.querySelector('#sidebar-folder-list'), this.folder_data);

  folders.bind('Selected', event => {
    this.data.folder_id = event.detail.ids[0];
  });

  this.data = new Proxy({
    folder_id: null,
  },
  {
    set: (obj, prop, newval) => {
      let oldval = obj[prop];

      // On mobile, the same folder can be selected
      if (!mobile && oldval === newval) {
        return;
      }

      if (prop === 'folder_id') {
        this.open_folder(newval);
      }

      obj[prop] = newval;
    }
  });

  window.addEventListener('UI:toggle_unread', event => {
    // Update the sidebar Unread folder
    this.toggle_unread_ui(event.detail.bugs.length);
  });
};

BzDeck.sidebar.open_folder = function (folder_id) {
  let home = BzDeck.homepage,
      grid = home.view.grid;

  home.data.preview_id = null;

  let update_list = bugs => {
    home.data.bug_list = bugs;
    FlareTail.util.event.async(() => {
      BzDeck.global.update_grid_data(grid, bugs);
      document.querySelector('#home-list > footer').setAttribute('aria-hidden', bugs.length ? 'true' : 'false');
    });
  };

  let get_subscribed_bugs = callback => {
    BzDeck.model.get_all_subscriptions(subscriptions => {
      let ids = [];

      for (let sub of subscriptions) {
        // Remove duplicates
        ids.push(...[id for ({ id } of sub.bugs) if (ids.indexOf(id) === -1)]);
      }

      BzDeck.model.get_bugs_by_ids(ids, bugs => {
        callback(bugs);
      });
    });
  };

  // Mobile compact layout
  if (FlareTail.util.device.type.startsWith('mobile') &&
      BzDeck.toolbar.tablist.view.selected[0].id !== 'tab-home') {
    // Select the home tab
    BzDeck.toolbar.tablist.view.selected = BzDeck.toolbar.tablist.view.members[0];
  }

  // Change the window title and the tab label
  let folder_label = [f for (f of this.folder_data) if (f.data.id === folder_id)][0].label;

  document.title = folder_label;
  document.querySelector('[role="banner"] h1').textContent
    = document.querySelector('#tab-home').title
    = document.querySelector('#tab-home label').textContent
    = document.querySelector('#tabpanel-home h2').textContent = folder_label;

  let path = '/home/' + folder_id;

  // Save history
  if (location.pathname !== path) {
    history.pushState({}, folder_label, path);
  }

  if (folder_id === 'inbox') {
    get_subscribed_bugs(bugs => {
      bugs.sort((a, b) => new Date(b.last_change_time) - new Date(a.last_change_time));
      update_list(bugs.slice(0, 50)); // Recent 50 bugs
    });
  }

  if (folder_id.match(/^(cc|reported|assigned|qa|needinfo)/)) {
    BzDeck.model.get_subscription_by_id(RegExp.$1, sub => {
      BzDeck.model.get_bugs_by_ids([id for ({ id } of sub.bugs)], bugs => {
        update_list(bugs);
      });
    });
  }

  if (folder_id === 'all') {
    get_subscribed_bugs(bugs => {
      update_list(bugs);
    });
  }

  if (folder_id === 'starred') {
    // Starred bugs may include non-subscribed bugs, so get ALL bugs
    BzDeck.model.get_all_bugs(bugs => {
      update_list([bug for (bug of bugs) if (bug._starred)]);
    });
  }

  if (folder_id === 'unread') {
    // Unread bugs may include non-subscribed bugs, so get ALL bugs
    BzDeck.model.get_all_bugs(bugs => {
      update_list([bug for (bug of bugs) if (bug._unread)]);
    });
  }

  if (folder_id === 'important') {
    get_subscribed_bugs(bugs => {
      let severities = ['blocker', 'critical', 'major'];
      update_list([bug for (bug of bugs) if (severities.indexOf(bug.severity) > -1)]);
    });
  }
};

BzDeck.sidebar.toggle_unread_ui = function (num) {
  let $label = document.querySelector('#sidebar-folders--unread label');

  if ($label) {
    $label.textContent = num ? 'Unread (%d)'.replace('%d', num) : 'Unread'; // l10n
  }
};

/* ----------------------------------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded', event => {
  BzDeck.bootstrap.processing = true;

  if (BzDeck.bootstrap.check_requirements()) {
    BzDeck.bootstrap.start();
  }
});

window.addEventListener('contextmenu', event => {
  event.preventDefault();
});

window.addEventListener('dragover', event => {
  event.preventDefault();
});

window.addEventListener('drop', event => {
  event.preventDefault();
});

window.addEventListener('wheel', event => {
  event.preventDefault();
});

window.addEventListener('click', event => {
  let $target = event.target;

  // Discard clicks on the fullscreen dialog
  if ($target === document) {
    return true;
  }

  if ($target.mozMatchesSelector(':link')) {
    // Bug link: open in a new app tab
    if ($target.hasAttribute('data-bug-id')) {
      BzDeck.detailspage = new BzDeck.DetailsPage(
        Number.parseInt($target.getAttribute('data-bug-id'))
      );

      event.preventDefault();

      return false;
    }

    // Attachment link: open in a new browser tab (TEMP)
    if ($target.hasAttribute('data-attachment-id')) {
      window.open('https://bugzilla.mozilla.org/attachment.cgi?id='
                   + $target.getAttribute('data-attachment-id'), '_blank');

      event.preventDefault();

      return false;
    }

    // Normal link: open in a new browser tab
    $target.target = '_blank';

    return false;
  }

  return true;
});

window.addEventListener('keydown', event => {
  let $target = event.target;

  if ($target.mozMatchesSelector('input, [role="textbox"]')) {
    if (event.metaKey || event.ctrlKey) {
      switch (event.keyCode) {
        case event.DOM_VK_A: // Select
        case event.DOM_VK_C: // Copy
        case event.DOM_VK_V: // Paste
        case event.DOM_VK_X: // Cut
        case event.DOM_VK_Z: { // Undo/Redo
          return true;
        }

        default: {
          event.preventDefault();

          return false;
        }
      }
    }
  }

  if (event.metaKey || event.ctrlKey) {
    switch (event.keyCode) {
      // Disable some keyboard shortcuts
      case event.DOM_VK_A: // Select All
      case event.DOM_VK_B: // Bookmark Sidebar
      case event.DOM_VK_F: // Find
      case event.DOM_VK_G: // Find Again
      case event.DOM_VK_H: // History Sidebar
      case event.DOM_VK_O: // Open File
      case event.DOM_VK_Q: // Quit
      case event.DOM_VK_R: // Reload
      case event.DOM_VK_S: // Save
      case event.DOM_VK_W: // Close Tab/Window
      case event.DOM_VK_ADD: // Zoom In
      case event.DOM_VK_SUBTRACT: { // Zoom Out
        event.preventDefault();

        return false;
      }
    }
  }

  return true;
});

window.addEventListener('popstate', event => {
  let path = location.pathname.substr(1).replace('/', '-'),
      tabs = BzDeck.toolbar.tablist.view,
      folders = BzDeck.sidebar.folders.view,
      $tab,
      $folder,
      $root = document.documentElement; // <html>

  // Hide sidebar
  if (FlareTail.util.device.type.startsWith('mobile')) {
    $root.setAttribute('data-sidebar-hidden', 'true');
    document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
  }

  if (path.match(/^bug-(\d+)$/)) {
    let bug_id = Number.parseInt(RegExp.$1),
        bug_list = [];

    $root.setAttribute('data-current-tab', 'bug');
    $tab = document.querySelector('#tab-details-' + bug_id);

    if ($tab) {
      tabs.selected = $tab;

      return;
    }

    if (BzDeck.detailspage) {
      bug_list = BzDeck.detailspage.data.bug_list;

      if (bug_list.length) {
        let bugs = [id for ({ id } of bug_list)],
            index = bugs.indexOf(BzDeck.detailspage.data.id);

        if (bugs[index - 1] === bug_id || bugs[index + 1] === bug_id) {
          // Back or Forward navigation
          BzDeck.toolbar.tablist.close_tab(BzDeck.detailspage.view.$tab);
        }
      }
    }

    BzDeck.detailspage = new BzDeck.DetailsPage(bug_id, bug_list);

    return;
  }

  if (path.match(/^home-(\w+)/)) {
    $folder = document.querySelector('#sidebar-folders--' + RegExp.$1);

    if ($folder) {
      $root.setAttribute('data-current-tab', 'home');
      tabs.selected = document.querySelector('#tab-home');
      folders.selected = $folder;

      return;
    }
  }

  $tab = document.querySelector('#tab-' + path);

  if ($tab) {
    $root.setAttribute('data-current-tab', path);
    tabs.selected = $tab;

    return;
  }

  // Fallback
  $root.setAttribute('data-current-tab', 'home');
  tabs.selected = document.querySelector('#tab-home');
  folders.selected = document.querySelector('#sidebar-folders--inbox');
});
