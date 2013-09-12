/**
 * BzDeck Application Logic
 * Copyright © 2012 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 23
 */

'use strict';

let BzDeck = BzDeck || {};

/* --------------------------------------------------------------------------
 * Data
 * -------------------------------------------------------------------------- */

BzDeck.data = {};

/* --------------------------------------------------------------------------
 * Options
 * -------------------------------------------------------------------------- */

BzDeck.options = {
  api: {
    vertion: 1.3,
    // Cross-origin XHR fails if instantiated from Offline Cache (Bug 687758)
    // Use local proxy temporarily to workaround the issue:
    endpoint: '/api/', // https://api-dev.bugzilla.mozilla.org/
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

/* --------------------------------------------------------------------------
 * Bootstrap
 * -------------------------------------------------------------------------- */

BzDeck.bootstrap = {};

BzDeck.bootstrap.check_requirements = function () {
  let features = [
    'explicitOriginalTarget' in Event.prototype, // Gecko specific
    'toLocaleFormat' in Date.prototype, // Gecko specific
    'mozMatchesSelector' in Element.prototype, // Gecko specific; prefixed
    'Proxy' in window, // Firefox 4
    'IDBObjectStore' in window, // Firefox 4
    'mozGetAll' in IDBObjectStore.prototype, // Gecko specific; prefixed
    'WeakMap' in window, // Firefox 6
    'Set' in window, // Firefox 13
    'MutationObserver' in window, // Firefox 14
    'buttons' in MouseEvent.prototype, // Firefox 15
    'scrollTopMax' in Element.prototype, // Firefox 16
    'isInteger' in Number, // Firefox 16
    'indexedDB' in window, // unprefixed in Firefox 16
    'onwheel' in window, // Firefox 17
    'origin' in location, // Firefox 21
    'Notification' in window, // Firefox 22
    'HTMLTemplateElement' in window, // Firefox 22
    'is' in Object, // Firefox 22
    'remove' in Element.prototype // Firefox 23
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
  } catch (ex) {
    return false;
  }

  return true;
};

BzDeck.bootstrap.start = function () {
  let $form = this.form = document.querySelector('#app-login form');
  this.input = $form.querySelector('input');
  this.button = $form.querySelector('button');
  BzDeck.global.statusbar = document.querySelector('#app-login [role="status"]');

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
  let store = BzDeck.model.db.transaction('bugzilla').objectStore('bugzilla');

  store.get('config').addEventListener('success', event => {
    let result = event.target.result;
    if (result) {
      // Cache found
      BzDeck.data.bugzilla_config = result.value;
    } else if (navigator.onLine) {
      // Load the Bugzilla config in background
      BzDeck.core.request('GET', 'configuration?cached_ok=1', event => {
        let response = event.target.responseText,
            data = response ? JSON.parse(response) : null;
        if (event.type === 'error' || !data || !data.version) {
          // Give up
          BzDeck.global.show_status('ERROR: Bugzilla configuration could not be loaded. \
            The instance might be offline.'); // l10n
          this.input.disabled = this.button.disabled = true;
        } else {
          // The config is loaded successfully
          BzDeck.data.bugzilla_config = data;
          BzDeck.model.db.transaction('bugzilla', 'readwrite')
                         .objectStore('bugzilla').add({ key: 'config', value: data });
        }
      });
    } else {
      // Offline; give up
      BzDeck.global.show_status('You have to go online to load data.'); // l10n
    }
  });
};

BzDeck.bootstrap.load_account = function () {
  let store = BzDeck.model.db.transaction('accounts').objectStore('accounts');

  store.openCursor().addEventListener('success', event => {
    let cursor = event.target.result;
    if (cursor) {
      // Cache found (the first entry)
      BzDeck.data.account = cursor.value;
      BzDeck.core.load_subscriptions();
    } else {
      this.show_login_form();
    }
  });
};

BzDeck.bootstrap.load_prefs = function () {
  let db = BzDeck.model.db;
  db.transaction('prefs').objectStore('prefs').mozGetAll().addEventListener('success', event => {
    let prefs = {};
    for (let { key, value } of event.target.result) {
      prefs[key] = value;
    }

    BzDeck.data.prefs = new Proxy(prefs, {
      set: (obj, key, value) => {
        obj[key] = value;
        // Save the pref to DB
        db.transaction('prefs', 'readwrite').objectStore('prefs').put({ key: key, value: value });
      }
    });
  });
};

BzDeck.bootstrap.show_login_form = function (firstrun = true) {
  let $form = this.form,
      $input = this.input,
      $button = this.button;

  $form.setAttribute('aria-hidden', 'false');
  $input.disabled = $button.disabled = false;
  $input.focus();

  if (!firstrun) {
    return;
  }

  $form.addEventListener('submit', event => {
    event.preventDefault();

    if (!this.processing) {
      // User is trying to re-login
      this.relogin = true;
      this.processing = true;
    }

    if (navigator.onLine) {
      this.validate_account();
    } else {
      BzDeck.global.show_status('You have to go online to sign in.'); // l10n
    }

    return false;
  });

  BzDeck.global.show_status('');
};

BzDeck.bootstrap.validate_account = function () {
  let $input = this.input,
      $button = this.button;

  BzDeck.global.show_status('Confirming account...'); // l10n
  $input.disabled = $button.disabled = true;

  BzDeck.core.request('GET', 'user/' + encodeURIComponent($input.value), event => {
    let response = event.target.responseText,
        data = response ? JSON.parse(response) : null;

    if (event.type === 'error' || !data) { 
      // Network error?
      BzDeck.global.show_status('ERROR: Failed to sign in.'); // l10n
      $input.disabled = $button.disabled = false;
    } else if (data.error || !data.name) {
      // User not found
      BzDeck.global.show_status('ERROR: ' + data.message || 'The user could not be found. \
        Please check your email adress and try again.'); // l10n
      $input.disabled = $button.disabled = false;
    } else {
      // User found, now load his/her data
      BzDeck.data.account = data;
      BzDeck.model.db.transaction('accounts', 'readwrite')
                     .objectStore('accounts').add(data);
      BzDeck.core.load_subscriptions();
    }
  });
};

BzDeck.bootstrap.setup_ui = function () {
  if (this.relogin) {
    // UI has already been set up, skip this process
    this.finish();
    return;
  }

  BzDeck.global.show_status('Loading UI...'); // l10n

  let date = BriteGrid.util.i18n.options.date,
      prefs = BzDeck.data.prefs,
      theme = prefs['ui.theme.selected'],
      BGut = BriteGrid.util.theme;

  // Date options
  date.timezone = prefs['ui.date.timezone'] || 'local';
  date.format = prefs['ui.date.format'] || 'relative';

  // Activate widgets
  BzDeck.toolbar.setup();
  new BzDeck.HomePage();

  // Change the theme
  if (theme && BGut.list.contains(theme)) {
    BGut.selected = theme;
  }

  // Preload images from CSS
  BGut.preload_images(() => {});

  this.finish();
};

BzDeck.bootstrap.finish = function () {
  // Timer to load bug details
  // BzDeck.core.load_bug_details_at_intervals();

  // Timer to check for updates
  BzDeck.core.timers.load_subscriptions = window.setInterval(() => {
    BzDeck.core.load_subscriptions();
  }, 600000); // Call every 10 minutes

  BzDeck.global.show_status('Loading complete.'); // l10n
  BzDeck.session.login();
  this.processing = false;
};

/* --------------------------------------------------------------------------
 * Core
 * -------------------------------------------------------------------------- */

BzDeck.core = {};
BzDeck.core.timers = {};

BzDeck.core.load_subscriptions = function () {
  this.firstrun = false;

  BzDeck.global.show_status('Checking for new bugs...'); // l10n

  BzDeck.model.get_all_subscriptions(subscriptions => {
    if (subscriptions.length) {
      BzDeck.model.get_all_bugs(bugs => {
        // List all starred bugs to check the last modified dates
        let ids = bugs.filter(bug => bug._starred).map(bug => bug.id);
        if (ids.length) {
          subscriptions.push({ query: { id: ids.join(',') } });
        }
        this.fetch_subscriptions(subscriptions);
      });
      return;
    }

    this.firstrun = true;

    // No cache available; try to create the default store
    if (!navigator.onLine) {
      // Offline; give up
      BzDeck.global.show_status('You have to go online to load data.'); // l10n
      return;
    }

    let email = BzDeck.data.account.name;
    let fields = {
      cc: 'cc',
      reported: 'creator',
      assigned: 'assigned_to',
      qa: 'qa_contact'
    };

    for (let [name, field] of Iterator(fields)) {
      let query = {
        email1: email,
        email1_type: 'equals_any',
        resolution: '---'
      };
      query['email1_' + field] = 1;
      subscriptions.push({ id: name, query: query });
    }

    this.fetch_subscriptions(subscriptions);
  });  
};

BzDeck.core.fetch_subscriptions = function (subscriptions) {
  if (!navigator.onLine) {
    // Skip loading the latest subscription data
    this.load_bugs(subscriptions);
    return;
  }

  let build_query = BriteGrid.util.request.build_query,
      loaded = 0,
      len = Object.keys(subscriptions).length,
      last_change_time = {};

  // Load bug list from Bugzilla
  for (let [i, sub] of Iterator(subscriptions)) {
    let index = i; // Redefine the variable to make it available in the following event
    sub.query['include_fields'] = 'id,last_change_time';
    this.request('GET', 'bug' + build_query(sub.query), event => {
      let response = event.target.responseText,
          data = response ? JSON.parse(response) : null;
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
      BzDeck.global.show_status('No bugs to download'); // l10n
    }
  };

  let default_fields = this.default_fields = [];
  for (let column of BzDeck.options.grid.default_columns) if (!column.id.startsWith('_')) {
    default_fields.push(column.id);
  }

  // Step 3: load the listed bugs from Bugzilla
  let _retrieve = () => {
    let loaded_bugs = [];
    // Load 10 bugs each request
    for (let i = 0, len = requesting_bugs.length; i < len; i += 100) {
      let query = BriteGrid.util.request.build_query({
        include_fields: '_default',
        id: requesting_bugs.slice(i, i + 100).join(',')
      });
      this.request('GET', 'bug' + query, event => {
        let response = event.target.responseText,
            data = response ? JSON.parse(response) : null;
        if (!data || !Array.isArray(data.bugs)) {
          // Give up
          BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
          return;
        }
        for (let bug of data.bugs) {
          bug._update_needed = true; // Flag to update details
          // If the session is firstrun, mark all bugs read
          bug._unread = !this.firstrun;
        }
        loaded_bugs = loaded_bugs.concat(data.bugs);
        // Finally load the UI modules
        if (boot && loaded_bugs.length === len) {
          BzDeck.model.save_bugs(loaded_bugs);
          BzDeck.bootstrap.setup_ui();
          BzDeck.core.toggle_unread_ui();
        }
      });
    }
  };

  // Start processing
  _get();
};

BzDeck.core.load_bug_details = function (bug_ids, callback = null) {
  let query = BriteGrid.util.request.build_query({
    id: bug_ids.join(','),
    include_fields: 'id,' + BzDeck.options.api.extra_fields.join(','),
    exclude_fields: 'attachments.data'
  });
  this.request('GET', 'bug' + query, event => {
    let response = event.target.responseText,
        data = response ? JSON.parse(response) : null;
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
        // Save the filled bug data
        BzDeck.model.save_bug(bug);
        if (callback) {
          callback(bug);
        }
      });
    }
  });
};

BzDeck.core.load_bug_details_at_intervals = function () {
  BzDeck.model.get_all_bugs(bugs => {
    // Load comments, history, flags and attachments' metadata
    let queue = bugs.filter(bug => bug._update_needed).map(bug => bug.id);
    let timer = this.timers.load_bug_details_at_intervals = window.setInterval(() => {
      if (queue.length) {
        // Load 20 bugs each
        this.load_bug_details(queue.splice(0, 20));
      } else {
        // All bugs loaded
        window.clearInterval(timer);
      }
    }, 5000); // Call every 5 seconds
  });
};

BzDeck.core.toggle_star = function (bug_id, value) {
  // Save in DB
  BzDeck.model.get_bug_by_id(bug_id, bug => {
    if (bug) {
      bug._starred = value;
      BzDeck.model.save_bug(bug);
    }
  });

  // TODO: Update UI if needed
};

BzDeck.core.toggle_unread = function (bug_id, value) {
  // Save in DB
  BzDeck.model.get_bug_by_id(bug_id, bug => {
    if (bug && bug._unread !== value) {
      bug._unread = value;
      BzDeck.model.save_bug(bug);
      this.toggle_unread_ui();
    }
  });
};

BzDeck.core.toggle_unread_ui = function () {
  // Update UI: the Unread folder on the home page
  BzDeck.model.get_all_bugs(bugs => {
    let count = bugs.filter(bug => bug._unread === true).length,
        $label = document.querySelector('[id="home-folders--unread"] label');
    if ($label) {
      $label.textContent = count ? 'Unread (%d)'.replace('%d', count) : 'Unread'; // l10n
    }
  });

  // Update UI: other widgets, FIXME
};

BzDeck.core.request = function (method, query, callback) {
  if (!navigator.onLine) {
    BzDeck.global.show_status('You have to go online to load data.'); // l10n
    return;
  }

  let xhr = new XMLHttpRequest(),
      api = BzDeck.options.api,
      url = api.endpoint + api.vertion + '/';
  xhr.open(method, url + query, true);
  // The following headers abort request. Commented out on 2013-07-20
  // xhr.setRequestHeader('Accept', 'application/json');
  // xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.addEventListener('load', event => callback(event));
  xhr.addEventListener('error', event => callback(event));
  xhr.send(null);
};

/* --------------------------------------------------------------------------
 * Model
 * -------------------------------------------------------------------------- */

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
  let cache = this.cache.bugs;

  if (cache) {
    callback([...cache].map(item => item[1]).filter(bug => ids.indexOf(bug.id) > -1));
    return;
  }

  this.db.transaction('bugs').objectStore('bugs')
         .mozGetAll().addEventListener('success', event => {
    callback(event.target.result.filter(bug => ids.indexOf(bug.id) > -1));
  });
};

BzDeck.model.get_all_bugs = function (callback) {
  let cache = this.cache.bugs;

  if (cache) {
    callback([...cache].map(item => item[1])); // Convert Map to Array
    return;
  }

  this.db.transaction('bugs').objectStore('bugs')
         .mozGetAll().addEventListener('success', event => {
    let bugs = event.target.result; // array of Bug
    callback(bugs);
    if (bugs && !cache) {
      this.cache.bugs = new Map(bugs.map(bug => [bug.id, bug]));
    }
  });
};

BzDeck.model.save_bug = function (bug) {
  this.save_bugs([bug]);
};

BzDeck.model.save_bugs = function (bugs) {
  let cache = this.cache.bugs,
      store = this.db.transaction('bugs', 'readwrite').objectStore('bugs');

  if (!cache) {
    cache = this.cache.bugs = new Map();
  }

  for (let bug of bugs) {
    if (bug.id) {
      cache.set(bug.id, bug);
      store.put(bug);
    }
  }
};

BzDeck.model.get_subscription_by_id = function (id, callback) {
  let cache = this.cache.subscriptions;

  if (cache) {
    callback(cache.get(id));
    return;
  }

  let store = this.db.transaction('subscriptions').objectStore('subscriptions');

  store.get(id).addEventListener('success', event => {
    callback(event.target.result);
  });
};

BzDeck.model.get_all_subscriptions = function (callback) {
  let cache = this.cache.subscriptions;

  if (cache) {
    callback([...cache].map(item => item[1])); // Convert Map to Array
    return;
  }

  let store = this.db.transaction('subscriptions').objectStore('subscriptions');

  store.mozGetAll().addEventListener('success', event => {
    callback(event.target.result);
  });
};

BzDeck.model.save_subscriptions = function (subscriptions) {
  let store = this.db.transaction('subscriptions', 'readwrite').objectStore('subscriptions'),
      cache = this.cache.subscriptions;

  if (!cache) {
    cache = this.cache.subscriptions = new Map();
  }

  for (let sub of subscriptions) {
    if (sub.id) {
      store.put(sub);
      cache.set(sub.id, sub);
    }
  }
};

/* --------------------------------------------------------------------------
 * Session
 * -------------------------------------------------------------------------- */

BzDeck.session = {};

BzDeck.session.login = function () {
  let $app_login = document.getElementById('app-login'),
      $app_body = document.getElementById('app-body');

  BzDeck.global.statusbar = document.getElementById('statusbar');

  $app_login.hidden = true;
  $app_login.setAttribute('aria-hidden', 'true');
  $app_body.hidden = false;
  $app_body.removeAttribute('aria-hidden');

  // TODO: focus handling

  // GA
  if (_gaq) {
    _gaq.push(['_trackEvent', 'Session', 'Login']);
    _gaq.push(['_setCustomVar', 1, 'Login', 'true', 2]);
  }
};

BzDeck.session.logout = function () {
  let $app_login = document.getElementById('app-login'),
      $app_body = document.getElementById('app-body');

  BzDeck.global.statusbar = $app_login.querySelector('[role="status"]');
  BzDeck.global.show_status('You have logged out.'); // l10n

  $app_login.hidden = false;
  $app_login.removeAttribute('aria-hidden');
  $app_body.hidden = true;
  $app_body.setAttribute('aria-hidden', 'true');

  BzDeck.bootstrap.show_login_form(false);

  // Terminate timers
  for (let [key, timer] of Iterator(BzDeck.core.timers)) {
    window.clearInterval(timer);
  }

  // Delete the account data
  BzDeck.model.db.transaction('accounts', 'readwrite')
                 .objectStore('accounts').delete(BzDeck.data.account.id);
  delete BzDeck.data.account;

  // GA
  if (_gaq) {
    _gaq.push(['_setCustomVar', 1, 'Login', 'false', 2]);
    _gaq.push(['_trackEvent', 'Session', 'Logout']);
  }
};

/* --------------------------------------------------------------------------
 * Global
 * -------------------------------------------------------------------------- */

BzDeck.global = {};

BzDeck.global.install_app = function () {
  BriteGrid.util.app.install(BzDeck.options.app.manifest, event => {
    if (event.type === 'success') {
      document.getElementById('main-menu--app--install').setAttribute('aria-disabled', 'true');
    }
    if (event.type === 'error') {
    }
  });
};

BzDeck.global.show_status = function (message) {
  this.statusbar.textContent = message;
};

BzDeck.global.show_notification = function (title, body) {
  BriteGrid.util.app.show_notification(title, {
    body: body,
    icon: '/static/images/logo-512.png'
  });
};

BzDeck.global.fill_template = function ($template, bug, clone = false) {
  if (!$template) {
    return null;
  }

  let $content;

  if (!clone) {
    $content = $template;
  } else {
    // DocumentFragment.firstElementChild returns undefined (Bug 895974)
    // This issue will be resolved in Firefox 25. Here's a workaround:
    $content = $template.cloneNode().firstElementChild ||
               $template.cloneNode().querySelector('[id]');

    // Assign unique IDs
    $content.id = $content.id.replace(/TID/, bug.id);
    for (let $element of $content.querySelectorAll('[id]')) {
      $element.id = $element.id.replace(/TID/, bug.id);
    }

    // Scrollbar
    let ScrollBar = BriteGrid.widget.ScrollBar;
    for (let suffix of ['info', 'timeline']) {
      let $area = $content.querySelector('[id$="-bug-' + suffix + '"]');
      if ($area) {
        new ScrollBar($area);
      }
    }
  }

  $content.dataset.id = bug.id;
  $content.setAttribute('aria-busy', 'true');

  if (!bug.summary) {
    // The bug is being loaded
    return $content;
  }

  for (let $element of $content.querySelectorAll('[data-field]')) {
    let key = $element.getAttribute('data-field'),
        value = bug[key];

    if (BzDeck.options.api.extra_fields.indexOf(key) > -1) {
      continue; // BzDeck.global.fill_template_details
    }    

    if (key === 'summary') {
      $element.textContent = 'Bug ' + bug.id + ' - ' + bug.summary;
      continue;
    }    

    if (key.endsWith('_time')) {
      $element.textContent = BriteGrid.util.i18n.format_date(value);
      $element.dateTime = value;
      if (key === 'creation_time') {
        $element.itemProp.value = 'datePublished';
      }
      if (key === 'last_change_time') {
        $element.itemProp.value = 'dateModified';
      }
      continue;
    }

    if (key === 'keywords' && Array.isArray(value)) {
      let $ul = $element.appendChild(document.createElement('ul'));
      for (let _value of value) {
        let $li = $ul.appendChild(document.createElement('li'));
        $li.textContent = _value;
        $li.setAttribute('role', 'button');
        $li.itemProp.value = 'keywords';
        new BriteGrid.widget.Button($li);
      }
      continue;
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

    if (value) {
      $element.textContent = value;
    } else {
      $element.innerHTML = '&nbsp;';
    }
  }

  $content.removeAttribute('aria-busy');

  let $timeline = $content.querySelector('[id$="-bug-timeline"]');
  if (!$timeline) {
    return $content;
  }

  $timeline.setAttribute('aria-busy', 'true');
  BzDeck.global.show_status('Loading...'); // l10n

  // Empty timeline while keeping the template and scrollbar
  for (let $comment of $timeline.querySelectorAll('[itemprop="comment"][data-time]')) {
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
  if (!$content || Number.toInteger($content.dataset.id) !== bug.id) {
    return;
  }

  let $placeholder,
      i18n = BriteGrid.util.i18n;

  // dupe_of
  $placeholder = $content.querySelector('[data-field="resolution"]');
  if ($placeholder && bug.resolution === 'DUPLICATE' && bug.dupe_of) {
    $placeholder.textContent = 'DUPLICATE of ' + bug.dupe_of;
  }

  // CC
  $placeholder = $content.querySelector('[data-field="cc"]');
  if ($placeholder) {
    if (Array.isArray(bug.cc)) {
      let $ul = $placeholder.querySelector('ul'),
          $_li = $ul.removeChild($ul.firstElementChild);
      for (let value of bug.cc) {
        let $li = $ul.appendChild($_li.cloneNode());
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
          $li.addEventListener('Pressed', event => {
            new BzDeck.DetailsPage(Number.toInteger(event.explicitOriginalTarget.textContent));
          });
          new BriteGrid.widget.Button($li);
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
  if ($placeholder) {
    let $dl = $placeholder.querySelector('dl');
    if ($dl) {
      $dl.remove();
    }
    if (!bug.attachments) {
      $placeholder.setAttribute('aria-hidden', 'true');
    } else {
      $dl = document.createElement('dl');
      for (let att of bug.attachments) {
        let $dt = $dl.appendChild(document.createElement('dt')),
            $link;
        if (att.is_obsolete) {
          let $del = $dt.appendChild(document.createElement('del'));
          $link = $del.appendChild(document.createElement('a'));
        } else {
          $link = $dt.appendChild(document.createElement('a'));
        }
        $link.href = '#attachment/' + att.id;
        $link.setAttribute('role', 'link');
        $link.setAttribute('data-attachment-id', att.id);
        $link.textContent = att.description;
        let $dd = $dl.appendChild(document.createElement('dd')),
            $ul = $dd.appendChild(document.createElement('ul')),
            $li;
        // Size
        $li = $ul.appendChild(document.createElement('li'));
        $li.textContent = (att.size / 1024).toFixed(2) + ' KB'; // l10n
        // Type
        $li = $ul.appendChild(document.createElement('li'));
        $li.textContent = att.is_patch ? 'patch' : att.content_type; // l10n
        // Time
        $li = $ul.appendChild(document.createElement('li'));
        let $time = $li.appendChild(document.createElement('time'));
        $time.textContent = i18n.format_date(att.creation_time);
        $time.dateTime = att.creation_time;
        // Person
        $li = $ul.appendChild(document.createElement('li'));
        $li.itemScope = true;
        $li.itemType.value = 'http://schema.org/Person';
        let $span = $li.appendChild(document.createElement('span'));
        $span.itemProp.value = 'name';
        $span.itemValue = att.attacher.name;
        // Flags
        if (!att.flags) {
          $li = $ul.appendChild(document.createElement('li'));
          $li.textContent = 'No Flags'; // l10n
          continue;
        }
        for (let flag of att.flags) {
          $li = $ul.appendChild(document.createElement('li'));
          $li.textContent = flag.setter.name + ': ' + flag.name + flag.status;
        }
      }
      $placeholder.appendChild($dl);
      $placeholder.removeAttribute('aria-hidden');
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
      $ul = document.createElement('ul');
      for (let flag of bug.flags) {
        let $dd = $ul.appendChild(document.createElement('li'));
        $dd.textContent = flag.setter.name + ': ' + flag.name + flag.status;
      }
      $placeholder.appendChild($ul);
      $placeholder.removeAttribute('aria-hidden');
    }
  }

  // TODO: Show Project Flags and Tracking Flags

  // Timeline: comments & history
  let entries = {},
      $timeline = $content.querySelector('[id$="-bug-timeline"]'),
      $entry_tmpl = $content.querySelector('[itemprop="comment"]'),
      field = BzDeck.data.bugzilla_config.field,
      parse = BzDeck.global.parse_comment,
      sanitize = BriteGrid.util.string.sanitize;
  // Comments
  for (let comment of bug.comments) {
    let $entry = $entry_tmpl.cloneNode(),
        time = comment.creation_time;
    $entry.id = $content.id + '-comment-' + comment.id;
    $entry.dataset.id = comment.id;
    $entry.dataset.time = (new Date(time)).getTime();
    $entry.setAttribute('aria-hidden', 'false');
    let $name = $entry.querySelector('[itemprop="author"] [itemprop="name"]');
    $name.textContent = comment.creator.real_name || comment.creator.name;
    let $time = $entry.querySelector('[itemprop="datePublished"]');
    $time.textContent = i18n.format_date(time);
    $time.dateTime = time;
    let $text = $entry.querySelector('[itemprop="text"]');
    $text.innerHTML = comment.text ? parse(sanitize(comment.text)) : '&nbsp;';
    entries[time] = $entry;
  }
  // Changes
  for (let history of bug.history) {
    let $entry,
        time = history.change_time;
    if (time in entries) {
      // Combine a comment + change(s)
      $entry = entries[time];
    } else {
      $entry = $entry_tmpl.cloneNode();
      $entry.dataset.time = (new Date(time)).getTime();
      $entry.setAttribute('aria-hidden', 'false');
      $entry.querySelector('[itemprop="text"]').remove();
      let $name = $entry.querySelector('[itemprop="author"] [itemprop="name"]');
      $name.textContent = history.changer.name;
      let $time = $entry.querySelector('[itemprop="datePublished"]');
      $time.textContent = i18n.format_date(time);
      $time.dateTime = time;
      entries[time] = $entry;
    }
    let $changes = $entry.appendChild(document.createElement('ul'));
    $changes.className = 'changes';
    let generate_element = (change, how) => {
      let $elm = document.createElement((how === 'removed') ? 'del' : 'ins');
      if (['blocks', 'depends_on'].indexOf(change.field_name) > -1) {
        $elm.innerHTML = change[how].replace(
          /(\d+)/g, 
          '<a href="#bug/$1" role="link" data-bug-id="$1">$1</a>'
        );
      } else {
        $elm.textContent = change[how];
      }
      return $elm;
    };
    for (let change of history.changes) {
      let $change = $changes.appendChild(document.createElement('li'));
      // Bug 909055 - Field name mismatch in history: group vs groups
      let _field = (change.field_name === 'groups') ? field['group'] : field[change.field_name];
      $change.textContent = _field.description + ': ';
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
  // Sort by time
  let _entries = [];
  for (let [time, template] of Iterator(entries)) {
    _entries.push({ time: time, element: template });
  }
  _entries.sort((a, b) => a.time > b.time);
  // Append to the timeline
  for (let entry of _entries) {
    $timeline.appendChild(entry.element);
  }

  $timeline.scrollTop = 0;
  $timeline.removeAttribute('aria-busy', 'false');
  BzDeck.global.show_status('');
};

BzDeck.global.update_grid_data = function (grid, bugs) {
  let rows = [],
      row_id_prefix = grid.view.container.id + '-row-';

  // build table
  for (let bug of bugs) {
    let row = {
      id: row_id_prefix + bug.id,
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
          let row = grid.data.rows.filter(row => row.data.id === obj.id)[0];
          if (row && row.element) {
            row.element.dataset.unread = value;
          }
        }
        obj[prop] = value;
      }
    });
    rows.push(row);
  }

  grid.build_body(rows);
}

BzDeck.global.parse_comment = function (str) {
  let blockquote = function (p) {
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
      if ((!line.match(regex) || !lines[i+1]) && quote.length) {
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

  str = str.replace(/\n{2,}/gm, '');
  str = str.replace(/\n/gm, '<br>');

  // General links
  str = str.replace(
    /((https?|ftp|news):\/\/[\w-]+(\.[\w-]+)+((&amp;|[\w.,@?^=%$:\/~+#-])*(&amp;|[\w@?^=%$\/~+#-]))?)/gm,
    '<a href="$1" role="link">$1</a>'
  );

  // Bugs
  str = str.replace(
    /Bug\s?#?(\d+)/igm,
    '<a href="#bug/$1" role="link" data-bug-id="$1">Bug $1</a>'
  );

  // Attachments
  str = str.replace(
    /Attachment\s?#?(\d+)/igm,
    '<a href="#attachment/$1" role="link" data-attachment-id="$1">Attachment $1</a>'
  );

  return str;
};

/* --------------------------------------------------------------------------
 * Toolbar
 * -------------------------------------------------------------------------- */

BzDeck.toolbar = {};

BzDeck.toolbar.setup = function () {
  let BGw = BriteGrid.widget,
      BGu = BriteGrid.util,
      tablist = this.tablist = new BGw.TabList(document.getElementById('main-tablist'));

  let $main_menu = document.getElementById('main-menu');
  new BGw.MenuBar($main_menu);
  $main_menu.addEventListener('MenuItemSelected', event => {
    switch (event.detail.command) {
      case 'show-settings': {
        new BzDeck.SettingsPage();
        break;
      }
      case 'toggle-fullscreen': {
        BGu.app.toggle_fullscreen();
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
    }
  });

  // Do something when the app menu is opened
  document.getElementById('main-menu--app-menu').addEventListener('MenuOpened', event => {
  });

  // Account label & avatar
  let account = BzDeck.data.account,
      account_label = (account.real_name ? '<strong>' + account.real_name + '</strong>' : '&nbsp;')
                    + '<br>' + account.name,
      account_img = new Image();
  document.querySelector('#main-menu--app--account label').innerHTML = account_label;
  account_img.addEventListener('load', event => {
    document.styleSheets[1].insertRule('#main-menu--app--account label:before '
      + '{ background-image: url(' + event.target.src + ') !important }', 0);
  });
  account_img.src = 'https://www.gravatar.com/avatar/' + md5(account.name) + '?d=404';

  if (BGu.app.fullscreen_enabled) {
    document.getElementById('main-menu--app--fullscreen').removeAttribute('aria-disabled');
  }

  BGu.app.can_install(BzDeck.options.app.manifest, result => {
    if (result) {
      document.getElementById('main-menu--app--install').removeAttribute('aria-disabled');
    }
  });

  let $search_box = document.querySelector('[role="banner"] [role="search"] input'),
      $search_button = document.querySelector('[role="banner"] [role="search"] [role="button"]'),
      $search_dropdown = document.getElementById('quicksearch-dropdown');

  this.search_dropdown = new BriteGrid.widget.Menu($search_dropdown);

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
  };

  window.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_K && (event.metaKey || event.ctrlKey)) {
      $search_box.focus();
      event.preventDefault();
    }
  });

  $search_box.addEventListener('input', event => {
    this.quicksearch(event);
  });

  $search_box.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_RETURN) {
      this.search_dropdown.close();
      exec_search();
    }
  });

  $search_button.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_RETURN ||
        event.keyCode === event.DOM_VK_SPACE) {
      exec_search();
    }
  });

  $search_button.addEventListener('mousedown', event => {
    exec_search();
  });

  $search_dropdown.addEventListener('MenuItemSelected', event => {
    // Show the bug or search results
    let $target = event.explicitOriginalTarget,
        id = $target.dataset.id;
    if (id) {
      new BzDeck.DetailsPage(Number.toInteger(id));
    }
    if ($target.mozMatchesSelector('#quicksearch-dropdown-more')) {
      exec_search();
    }
  });

  // Suppress context menu
  $search_box.addEventListener('contextmenu', event => {
    return BGu.event.ignore(event);
  }, true); // use capture
};

BzDeck.toolbar.quicksearch = function (event) {
  let words = event.target.value.replace(/\s{2,}/, ' ').split(' ')
                                .map(word => word.toLowerCase());

  BzDeck.model.get_all_bugs(bugs => {
    let results = bugs.filter(bug => {
      return (words.every(word => bug.summary.toLowerCase().contains(word)) ||
              words.length === 1 && !isNaN(words[0]) && String(bug.id).contains(words[0])) && 
              BzDeck.data.bugzilla_config.field.status.open.indexOf(bug.status) > -1;
    });

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
    dropdown.open();
  });
};

/* --------------------------------------------------------------------------
 * Events
 * -------------------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded', event => {
  let test = false;
  if (test) {
    BzDeck.global.statusbar = document.querySelector('#app-login [role="status"]');
    BzDeck.bootstrap.setup_ui();
    return;
  }

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

window.addEventListener('click', event => {
  let $target = event.target;

  // Discard clicks on the fullscreen dialog
  if ($target === document) {
    return true;
  }

  if ($target.mozMatchesSelector('[role="link"]')) {
    // Bug link: open in a new app tab
    if ($target.hasAttribute('data-bug-id')) {
      new BzDeck.DetailsPage(Number.toInteger($target.getAttribute('data-bug-id')));
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
