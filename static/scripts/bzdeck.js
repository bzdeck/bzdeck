/**
 * BzDeck Application Logic
 * Copyright © 2012 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 18
 */

'use strict';

let BzDeck = {};

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
      { id: '_starred', type: 'boolean', label: 'Starred' },
      { id: '_unread', type: 'boolean', label: 'Unread', hidden: true },
      // Name
      { id: 'id', type: 'integer', label: 'ID' },
      { id: 'alias', label: 'Alias', hidden: true },
      { id: 'summary', label: 'Summary' },
      // Status
      { id: 'status', label: 'Status', hidden: true },
      { id: 'resolution', label: 'Resolution', hidden: true },
      { id: 'target_milestone', label: 'Target Milestone', hidden: true },
      // Affected
      { id: 'classification', label: 'Classification', hidden: true },
      { id: 'product', label: 'Product' },
      { id: 'component', label: 'Component' },
      { id: 'version', label: 'Version', hidden: true },
      { id: 'platform', label: 'Hardware', hidden: true },
      { id: 'op_sys', label: 'OS', hidden: true },
      // Importance
      { id: 'severity', label: 'Severity', hidden: true },
      { id: 'priority', label: 'Priority', hidden: true },
      // Notes
      { id: 'whiteboard', label: 'Whiteboard', hidden: true },
      { id: 'keywords', label: 'Keywords', hidden: true },
      { id: 'url', label: 'url', hidden: true },
      // People
      { id: 'creator', label: 'Reporter', hidden: true },
      { id: 'assigned_to', label: 'Assignee', hidden: true },
      { id: 'qa_contact', label: 'QA Contact', hidden: true },
      // Dates
      { id: 'creation_time', type: 'time', label: 'Filed', hidden: true },
      { id: 'last_change_time', type: 'time', label: 'Last Modified' },
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

BzDeck.bootstrap.show_login_form = function () {
  let $form = this.form,
      $input = this.input,
      $button = this.button;

  $form.setAttribute('aria-hidden', 'false');
  $form.addEventListener('submit', event => {
    if (navigator.onLine) {
      this.validate_account();
    } else {
      BzDeck.global.show_status('You have to go online to sign in.'); // l10n
    }
    event.preventDefault();
    return false;
  });

  $input.disabled = $button.disabled = false;
  $input.focus();

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
  BzDeck.global.show_status('Loading UI...'); // l10n

  // Activate widgets
  BzDeck.toolbar.setup();
  new BzDeck.HomePage();

  // Preload images from CSS
  BriteGrid.util.theme.preload_images(() => {});
};

BzDeck.bootstrap.finish = function () {
  // Timers
  BzDeck.core.load_bug_details_at_intervals();
  window.setInterval(() => {
    BzDeck.core.load_subscriptions();
  }, 600000) // 10 minutes

  BzDeck.global.show_status('Loading complete.'); // l10n
  BzDeck.session.login();
  this.processing = false;
};

/* --------------------------------------------------------------------------
 * Core
 * -------------------------------------------------------------------------- */

BzDeck.core = {};

BzDeck.core.load_subscriptions = function () {
  this.firstrun = false;

  BzDeck.global.show_status('Checking for new bugs...'); // l10n

  BzDeck.model.get_all_subscriptions(subscriptions => {
    if (subscriptions.length) {
      // List all cached bugs to check the last modified dates
      BzDeck.model.get_all_bugs(bugs => {
        let ids = bugs.map(bug => bug.id);
        for (let i = 0, len = ids.length; i < len; i += 100) {
          subscriptions.push({
            query: { id: ids.slice(i, i + 100).join(',') }
          });
        };
        _retrieve(subscriptions);
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
    _retrieve(subscriptions);
  });  

  let _retrieve = subscriptions => {
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
      let index = i;
      sub.query['include_fields'] = 'id,last_change_time';
      this.request('GET', 'bug?' + build_query(sub.query), event => {
        let response = event.target.responseText,
            data = response ? JSON.parse(response) : null;
        if (!data || !Array.isArray(data.bugs)) {
          // Give up
          BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
          return;
        }
        // One subscription data loaded; update database with the bug list
        let sub = subscriptions[index];
        sub.bugs = data.bugs;
        if (sub.id) {
          BzDeck.model.db.transaction('subscriptions', 'readwrite')
                         .objectStore('subscriptions').put(sub);
        }
        loaded++;
        if (loaded === len) {
          // All subscription data loaded
          this.load_bugs(subscriptions);
        }
      });
    }
  };
};

BzDeck.core.load_bugs = function (subscriptions) {
  let boot = BzDeck.bootstrap.processing,
      cached_time = {},
      requesting_bugs = [];

  BzDeck.global.show_status('Loading bugs...'); // l10n

  // Step 1: look for bugs in the local storage
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
    }
  };

  let default_fields = this.default_fields = [];
  for (let column of BzDeck.options.grid.default_columns) if (!column.id.startsWith('_')) {
    default_fields.push(column.id);
  }

  // Step 3: load the listed bugs from Bugzilla
  let _retrieve = () => {
    let loaded = 0;
    // Load 10 bugs each request
    for (let i = 0, len = requesting_bugs.length; i < len; i += 100) {
      let query = BriteGrid.util.request.build_query({
        include_fields: '_default',
        id: requesting_bugs.slice(i, i + 100).join(',')
      });
      this.request('GET', 'bug?' + query, event => {
        let response = event.target.responseText,
            data = response ? JSON.parse(response) : null;
        if (!data || !Array.isArray(data.bugs)) {
          // Give up
          BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
          return;
        }
        // Store bugs in the database
        let store = BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs');
        for (let bug of data.bugs) {
          bug._update_needed = true; // Flag to update details
          store.put(bug);
          // If the session is firstrun, mark all bugs read
          this.toggle_unread(bug.id, !this.firstrun);
          loaded++;
        }
        // Finally load the UI modules
        if (boot && loaded === len) {
          BzDeck.bootstrap.setup_ui();
        }
      });
    }
  };
};

BzDeck.core.load_bug_details = function (bug_id, callback) {
  let query = BriteGrid.util.request.build_query({
    include_fields: BzDeck.options.api.extra_fields.join(','),
    exclude_fields: 'attachments.data'
  });
  this.request('GET', 'bug/' + bug_id + '?' + query, event => {
    let response = event.target.responseText,
        bug = response ? JSON.parse(response) : null;
    if (!bug) {
      // Give up
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
      return;
    }
    // Store bugs in the database
    let store = BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs');
    store.get(bug_id).addEventListener('success', event => {
      // Save the filled bug data
      let _bug = event.target.result;
      for (let [field, value] of Iterator(bug)) {
        _bug[field] = value;
      }
      _bug._update_needed = false;
      store.put(_bug);
      // Do callback
      if (callback) {
        callback(_bug);
      }
    });
  });
};

BzDeck.core.load_bug_details_at_intervals = function () {
  BzDeck.model.get_all_bugs(bugs => {
    // Load comments, history, flags and attachments' metadata
    let queue = bugs.filter(bug => bug._update_needed).map(bug => bug.id);
    let timer = window.setInterval(() => {
      if (!queue.length) {
        // All bugs loaded
        window.clearInterval(timer);
        return;
      }
      this.load_bug_details(queue[0], bug => {
        queue.splice(queue.indexOf(bug.id), 1);
      });
    }, 2000); // Call every 2 seconds
  });
};

BzDeck.core.toggle_star = function (bug_id, value) {
  // Save in DB
  let store = BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs');
  store.get(bug_id).addEventListener('success', event => {
    let bug = event.target.result;
    if (bug) {
      bug._starred = value;
      store.put(bug);
    }
  });

  // TODO: Update UI if needed
};

BzDeck.core.toggle_unread = function (bug_id, value) {
  // Save in DB
  let store = BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs');
  store.get(bug_id).addEventListener('success', event => {
    let bug = event.target.result;
    if (bug) {
      bug._unread = value;
      store.put(bug);
    }
  });

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

BzDeck.model.get_bug_by_id = function (id, callback, record_time = true) {
  let store = this.db.transaction('bugs', 'readwrite').objectStore('bugs');

  store.get(id).addEventListener('success', event => {
    let bug = event.target.result;
    if (bug && record_time) {
      bug._last_viewed = Date.now();
      store.put(bug); // Save
    }
    callback(bug);
  });
};

BzDeck.model.get_bugs_by_ids = function (ids, callback) {
  let store = this.db.transaction('bugs').objectStore('bugs');

  store.mozGetAll().addEventListener('success', event => {
    let bugs = event.target.result; // array of Bug
    if (bugs.length) {
      bugs = bugs.filter(bug => ids.indexOf(bug.id) > -1)
    }
    callback(bugs);
  });
};

BzDeck.model.get_all_bugs = function (callback) {
  let store = this.db.transaction('bugs').objectStore('bugs');

  store.mozGetAll().addEventListener('success', event => {
    callback(event.target.result); // array of Bug
  });
};

BzDeck.model.get_subscription_by_id = function (id, callback) {
  let store = this.db.transaction('subscriptions').objectStore('subscriptions');

  store.get(id).addEventListener('success', event => {
    callback(event.target.result);
  });
};

BzDeck.model.get_all_subscriptions = function (callback) {
  let store = this.db.transaction('subscriptions').objectStore('subscriptions');

  store.mozGetAll().addEventListener('success', event => {
    callback(event.target.result);
  });
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

  BzDeck.bootstrap.form.setAttribute('aria-hidden', 'false');

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
    icon: "/static/images/logo-512.png"
  });
};

BzDeck.global.fill_template = function ($template, bug, clone = false) {
  if (!$template) {
    return null;
  }

  if (clone) {
    $template = $template.cloneNode();
    $template.id = $template.id.replace(/TEMPLATE/, bug.id);
    $template.removeAttribute('aria-hidden');
    // Scrollbar
    let ScrollBar = BriteGrid.widget.ScrollBar;
    for (let suffix of ['info', 'timeline']) {
      let $area = $template.querySelector('[id$="-bug-' + suffix + '"]');
      if ($area) {
        $area.id = $template.id + '-bug-' + suffix;
        new ScrollBar($area);
      }
    }
  }

  $template.dataset.id = bug.id;
  $template.setAttribute('aria-busy', 'true');

  if (!bug.summary) {
    // The bug is being loaded
    return $template;
  }

  for (let $element of $template.querySelectorAll('[data-field]')) {
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
      $element.textContent = (new Date(value)).toLocaleFormat('%Y-%m-%d %H:%M');
      $element.setAttribute('datetime', value);
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

  $template.removeAttribute('aria-busy');

  let $timeline = $template.querySelector('[id$="-bug-timeline"]');
  if (!$timeline) {
    return $template;
  }

  $timeline.setAttribute('aria-busy', 'true');
  BzDeck.global.show_status('Loading...'); // l10n

  // Empty timeline while keeping the template and scrollbar
  for (let $comment of $timeline.querySelectorAll('[itemprop="comment"][data-time]')) {
    $comment.remove();
  }

  if (bug.comments && !bug._update_needed) {
    this.fill_template_details($template, bug);
  } else {
    // Load comments, history, flags and attachments' metadata
    BzDeck.core.load_bug_details(bug.id, bug => {
      this.fill_template_details($template, bug);
    });
  }

  return $template;
};

BzDeck.global.fill_template_details = function ($template, bug) {
  // When the comments and history are loaded async, the template can be removed
  // or replaced at the time of call, if other bug is selected by user
  if (!$template || Number.toInteger($template.dataset.id) !== bug.id) {
    return;
  }

  let $placeholder;

  // dupe_of
  $placeholder = $template.querySelector('[data-field="resolution"]');
  if ($placeholder && bug.resolution === 'DUPLICATE' && bug.dupe_of) {
    $placeholder.textContent = 'DUPLICATE of ' + bug.dupe_of;
  }

  // CC
  $placeholder = $template.querySelector('[data-field="cc"]');
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
    $placeholder = $template.querySelector('[data-field="' + field + '"]');
    if ($placeholder) {
      let $ul = $placeholder.appendChild(document.createElement('ul'));
      if (Array.isArray(bug[field])) {
        for (let value of bug[field]) {
          let $li = $ul.appendChild(document.createElement('li'));
          $li.textContent = value;
          $li.setAttribute('role', 'button');
          $li.addEventListener('Pressed', event => {
            new BzDeck.DetailsPage(event.explicitOriginalTarget.textContent);
          });
          new BriteGrid.widget.Button($li);
        }
      } else {
        $placeholder.innerHTML = '&nbsp;';
      }
    }
  }

  // See Also
  $placeholder = $template.querySelector('[data-field="see_also"]');
  if ($placeholder) {
    if (Array.isArray(bug.see_also)) {
      let $ul = $placeholder.querySelector('ul');
      for (let value of bug.see_also) {
        let $li = $ul.appendChild(document.createElement('li')),
            $link = $li.appendChild(document.createElement('a'));
        $link.href = $link.text = _value;
        $link.setAttribute('role', 'link');
      }
    } else {
      $placeholder.innerHTML = '&nbsp;';
    }
  }

  // Attachments
  $placeholder = $template.querySelector('[data-field="attachments"]');
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
        $time.textContent = (new Date(att.creation_time)).toLocaleFormat('%Y-%m-%d %H:%M');
        $time.setAttribute('datetime', att.creation_time);
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
  $placeholder = $template.querySelector('[data-field="flags"]');
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
      $timeline = $template.querySelector('[id$="-bug-timeline"]'),
      $entry_tmpl = $template.querySelector('[itemprop="comment"]'),
      field = BzDeck.data.bugzilla_config.field,
      parse = BzDeck.global.parse_comment,
      sanitize = BriteGrid.util.string.sanitize;
  // Comments
  for (let comment of bug.comments) {
    let $entry = $entry_tmpl.cloneNode(),
        time = comment.creation_time;
    $entry.id = $template.id + '-comment-' + comment.id;
    $entry.dataset.id = comment.id;
    $entry.dataset.time = (new Date(time)).getTime();
    $entry.setAttribute('aria-hidden', 'false');
    let $name = $entry.querySelector('[itemprop="author"] [itemprop="name"]');
    $name.textContent = comment.creator.real_name || comment.creator.name;
    let $time = $entry.querySelector('[itemprop="datePublished"]');
    $time.textContent = (new Date(time)).toLocaleFormat('%Y-%m-%d %H:%M');
    $time.setAttribute('datetime', time);
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
      $time.textContent = (new Date(time)).toLocaleFormat('%Y-%m-%d %H:%M');
      $time.setAttribute('datetime', time);
      entries[time] = $entry;
    }
    let $changes = $entry.appendChild(document.createElement('ul'));
    $changes.className = 'changes';
    for (let change of history.changes) {
      let $change = $changes.appendChild(document.createElement('li'));
      $change.textContent = field[change.field_name].description + ': ';
      if (change.removed) {
        let $del = $change.appendChild(document.createElement('del'));
        $del.textContent = change.removed;
      }
      if (change.removed && change.added) {
        $change.appendChild(document.createTextNode(' → '));
      }
      if (change.added) {
        let $ins = $change.appendChild(document.createElement('ins'));
        $ins.textContent = change.added;
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
  // Normal link
  str = str.replace(
    /((https?|ftp|news):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%$&amp;:\/~+#-]*[\w@?^=%$&amp;\/~+#-])?)/g,
    '<a href="$1" role="link">$1</a>'
  );
  // Bug
  str = str.replace(
    /Bug\s?(\d+)/ig,
    '<a href="#bug/$1" role="link" data-bug-id="$1">Bug $1</a>'
  );
  // Attachment
  str = str.replace(
    /Attachment\s?(\d+)/ig,
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
      tablist = this.tablist = new BGw.TabList(document.getElementById("main-tablist"));

  let $main_menu = document.getElementById("main-menu");
  new BGw.MenuBar($main_menu);
  $main_menu.addEventListener('MenuItemSelected', event => {
    switch (event.detail.command) {
      case 'change-theme': {
        BGu.theme.selected = event.explicitOriginalTarget.textContent;
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

  if (BzDeck.data.account) { // For testing
    let $account_label = document.querySelector('#main-menu--app--account label'),
        label = BzDeck.data.account.real_name ? BzDeck.data.account.real_name + '<br>' : '';
    label += BzDeck.data.account.name;
    $account_label.innerHTML = label;
  }

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
      new BzDeck.DetailsPage(id);
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
 * Home Page
 * -------------------------------------------------------------------------- */

BzDeck.HomePage = function () {
  let BGw = BriteGrid.widget;

  let folder_data = [
    {
      'id': '-subscriptions',
      'label': 'My Bugs',
      'selected': true,
      'data': { 'id': 'subscriptions' },
      'sub': [
        {
          'id': '-subscriptions--cc',
          'label': 'CCed',
          'data': { 'id': 'subscriptions/cc' }
        },
        {
          'id': '-subscription--reported',
          'label': 'Reported',
          'data': { 'id': 'subscriptions/reported' }
        },
        {
          'id': '-subscription--assigned',
          'label': 'Assigned',
          'data': { 'id': 'subscriptions/assigned' }
        },
        {
          'id': '-subscription--qa',
          'label': 'QA Contact',
          'data': { 'id': 'subscriptions/qa' }
        }
      ]
    },
    {
      'id': '-recent',
      'label': 'Recent',
      'data': { 'id': 'recent' }
    },
    {
      'id': '-starred',
      'label': 'Starred',
      'data': { 'id': 'starred' }
    },
    {
      'id': '-unread',
      'label': 'Unread',
      'data': { 'id': 'unread' }
    }
  ];

  let folders = new BGw.Tree(document.getElementById("home-folders"), folder_data);
  folders.view = new Proxy(folders.view, {
    set: (obj, prop, value) => {
      if (prop === 'selected') {
        let $folder = Array.isArray(value) ? value[0] : value;
        this.data.folder_id = $folder.dataset.id;
      }
      obj[prop] = value;
    }
  });

  new BGw.ScrollBar(document.getElementById('home-folders-outer'));
  new BGw.ScrollBar(document.getElementById('home-preview-bug-info'));
  new BGw.ScrollBar(document.getElementById('home-preview-bug-timeline'));

  this.view = {};

  let $grid = document.getElementById('home-list');
  this.view.grid = new BriteGrid.widget.Grid($grid, {
    rows: [],
    columns: BzDeck.options.grid.default_columns
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: { key:'id', order:'ascending' }
  });

  $grid.addEventListener('Selected', event => {
    let ids = event.detail.ids;
    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = Number.toInteger(ids[ids.length - 1]);
      // Mark as Read
      let data = this.view.grid.data;
      for (let $item of event.detail.items) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = false;
      }
    }
  });

  $grid.addEventListener('dblclick', event => {
    // Open Bug in New Tab
    new BzDeck.DetailsPage(event.originalTarget.dataset.id);
  });

  $grid.addEventListener('keydown', event => {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.focused);
    // [B] Select previous bug
    if (!modifiers && event.keyCode === event.DOM_VK_B && index > 0) {
      view.selected = view.focused = members[index - 1];
    }
    // [F] Select next bug
    if (!modifiers && event.keyCode === event.DOM_VK_F && index < members.length - 1) {
      view.selected = view.focused = members[index + 1];
    }
    // [M] toggle read
    if (!modifiers && event.keyCode === event.DOM_VK_M) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = _data._unread !== true;
      }
    }
    // [S] toggle star
    if (!modifiers && event.keyCode === event.DOM_VK_S) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._starred = _data._starred !== true;
      }
    }
  }, true); // use capture

  // Show Details button
  let $button = document.getElementById('home-button-show-details'),
      button = this.view.details_button = new BriteGrid.widget.Button($button);

  $button.addEventListener('Pressed', event => {
    new BzDeck.DetailsPage(this.data.preview_id);
  });

  this.data = new Proxy({
    folder_id: null,
    preview_id: null
  },
  {
    set: (obj, prop, newval) => {
      let oldval = obj[prop];
      if (oldval === newval) {
        return;
      }
      if (prop === 'folder_id') {
        this.open_folder(newval);
      }
      if (prop === 'preview_id') {
        this.show_preview(oldval, newval);
      }
      obj[prop] = newval;
    }
  });

  $grid.addEventListener('Rebuilt', event => {
    if (BzDeck.bootstrap.processing) {
      BzDeck.bootstrap.finish();
    }
  });

  // Select the 'My Bugs' folder
  this.data.folder_id = 'subscriptions';

  // Authorize notification
  BriteGrid.util.app.auth_notification();

  // Update UI: the Unread folder on the home page
  BzDeck.model.get_all_bugs(bugs => {
    let bugs = bugs.filter(bug => bug._unread),
        num = bugs.length,
        $label = document.querySelector('[id="home-folders--unread"] label');
    if (!num) {
      $label.textContent = 'Unread'; // l10n
      return;
    }    
    // Statusbar
    $label.textContent = 'Unread (%d)'.replace('%d', num); // l10n
    let status = (num > 1) ? 'You have %d unread bugs'.replace('%d', num)
                           : 'You have 1 unread bug'; // l10n
    BzDeck.global.show_status(status);
    // Notification
    let list = [];
    for (let bug of bugs) {
      list.push(bug.id + ' - ' + bug.summary);
    }
    BzDeck.global.show_notification(status, list.join('\n'));
  });
};

BzDeck.HomePage.prototype.show_preview = function (oldval, newval) {
  let $pane = document.getElementById('home-preview-pane'),
      $template = document.getElementById('home-preview-bug'),
      button = this.view.details_button;

  // Remove the current preview if exists

  if (!newval) {
    $template.setAttribute('aria-hidden', 'true');
    button.data.disabled = true;
    return;
  }

  BzDeck.model.get_bug_by_id(newval, bug => {
    if (!bug) {
      $template.setAttribute('aria-hidden', 'true');
      button.data.disabled = true;
      return;
    }
    // Fill the content
    BzDeck.global.fill_template($template, bug);
    $template.setAttribute('aria-hidden', 'false');
    button.data.disabled = false;
  });
};

BzDeck.HomePage.prototype.open_folder = function (folder_id) {
  let ids = [],
      bugs = [],
      grid = this.view.grid;

  this.data.preview_id = null;

  let update_list = () => {
    if (bugs.length) {
      // If bugs provided, just update view
      BzDeck.global.update_grid_data(grid, bugs);
    } else {
      BzDeck.model.get_bugs_by_ids(ids, bugs => {
        BzDeck.global.update_grid_data(grid, bugs);
      });
    }
  };

  if (folder_id.match(/^subscriptions\/(.*)/)) {
    BzDeck.model.get_subscription_by_id(RegExp.$1, sub => {
      ids = sub.bugs.map(bug => bug.id);
      update_list();
    });
  }

  if (folder_id === 'subscriptions') {
    BzDeck.model.get_all_subscriptions(subscriptions => {
      for (let sub of subscriptions) {
        ids = ids.concat(sub.bugs.map(bug => bug.id).filter(id => ids.indexOf(id) === -1));
      }
      update_list();
    });
  }

  if (folder_id === 'starred') {
    BzDeck.model.get_all_bugs(_bugs => {
      bugs = _bugs.filter(bug => bug._starred === true);
      update_list();
    });
  }

  if (folder_id === 'unread') {
    BzDeck.model.get_all_bugs(_bugs => {
      bugs = _bugs.filter(bug => bug._unread === true);
      update_list();
    });
  }

  if (folder_id === 'recent') {
    BzDeck.model.get_all_bugs(_bugs => {
      bugs = _bugs.filter(bug => bug._last_viewed);
      bugs.sort((a, b) => a._last_viewed > b._last_viewed);
      bugs = bugs.slice(0, 100); // Recent 100 bugs
      update_list();
    });
  }
};

/* --------------------------------------------------------------------------
 * Search Page
 * -------------------------------------------------------------------------- */

BzDeck.SearchPage = function () {
  let tablist = BzDeck.toolbar.tablist,
      $tabpanel = document.getElementById('tabpanel-search-TEMPLATE').cloneNode(),
      id_suffix = this.id = (new Date()).getTime();

  // Assign unique ID
  $tabpanel.id = $tabpanel.id.replace(/TEMPLATE/, id_suffix);
  for (let $element of $tabpanel.querySelectorAll('[id]')) {
    $element.id = $element.id.replace(/TEMPLATE/, id_suffix);
  }

  this.view = {
    tabpanel: $tabpanel,
    buttons: {},
    panes: {}
  };

  this.data = new Proxy({
    preview_id: null
  },
  {
    set: (obj, prop, newval) => {
      let oldval = obj[prop];
      if (oldval === newval) {
        return;
      }
      if (prop === 'preview_id') {
        this.show_preview(oldval, newval);
      }
      obj[prop] = newval;
    }
  });

  this.setup_basic_search_pane();
  this.setup_result_pane();
  this.setup_preview_pane();
  this.setup_toolbar();

  // Add tab
  tablist.view.selected = tablist.view.focused = tablist.add_tab(
    'search-' + id_suffix,
    'Search', // l10n
    'Search & Browse Bugs', // l10n
    $tabpanel
  );
};

BzDeck.SearchPage.prototype.setup_toolbar = function () {
  let buttons = this.view.buttons,
      panes = this.view.panes;

  let handler = event => {
    switch (event.target.dataset.command) {
      case 'show-details': {
        new BzDeck.DetailsPage(this.data.preview_id);
        break;
      }
      case 'show-basic-search-pane': {
        panes['basic-search'].setAttribute('aria-hidden', 'false');
        panes['preview'].setAttribute('aria-hidden', 'true');
        buttons['show-details'].data.disabled = true;
        buttons['show-basic-search-pane'].data.disabled = true;
        break;
      }
    }
  };

  for (let $button of this.view.tabpanel.querySelectorAll('footer [role="button"]')) {
    buttons[$button.dataset.command] = new BriteGrid.widget.Button($button);
    $button.addEventListener('Pressed', handler.bind(this));
  }
};

BzDeck.SearchPage.prototype.setup_basic_search_pane = function () {
  let $pane = this.view.panes['basic-search'] 
            = this.view.tabpanel.querySelector('[id$="-basic-search-pane"]'),
      ScrollBar = BriteGrid.widget.ScrollBar,
      config = BzDeck.data.bugzilla_config;

  for (let $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
    new ScrollBar($outer/* , true */); // FIXME
  }

  let $classification_list = $pane.querySelector('[id$="-browse-classification-list"]'),
      $product_list = $pane.querySelector('[id$="-browse-product-list"]'),
      $component_list = $pane.querySelector('[id$="-browse-component-list"]'),
      $status_list = $pane.querySelector('[id$="-browse-status-list"]'),
      $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

  $classification_list.addEventListener('Selected', event => {
    let products = [],
        components = [];
    for (let $option of $classification_list.querySelectorAll('[aria-selected="true"]')) {
      products = products.concat(config.classification[$option.textContent].products);
    }
    for (let product of products) {
      components = components.concat(Object.keys(config.product[product].component));
    }
    // Narrow down the product list
    for (let $option of $product_list.querySelectorAll('[role="option"]')) {
      let state = products.length && products.indexOf($option.textContent) === -1;
      $option.setAttribute('aria-disabled', state);
      $option.setAttribute('aria-selected', 'false');
    }
    // Narrow down the component list
    for (let $option of $component_list.querySelectorAll('[role="option"]')) {
      let state = components.length && components.indexOf($option.textContent) === -1;
      $option.setAttribute('aria-disabled', state);
      $option.setAttribute('aria-selected', 'false');
    }
  });

  $product_list.addEventListener('Selected', event => {
    let components = [];
    for (let $option of $product_list.querySelectorAll('[aria-selected="true"]')) {
      components = components.concat(Object.keys(config.product[$option.textContent].component));
    }
    // Narrow down the component list
    for (let $option of $component_list.querySelectorAll('[role="option"]')) {
      let state = components.length && components.indexOf($option.textContent) === -1;
      $option.setAttribute('aria-disabled', state);
      $option.setAttribute('aria-selected', 'false');
    }
  });

  let classifications = Object.keys(config.classification),
      classification_list_id_prefix = $classification_list.id + 'item-';
  classifications.sort();
  for (let [index, value] of Iterator(classifications)) {
    classifications[index] = {
      id: classification_list_id_prefix + index,
      label: value
    };
  }

  let products = [],
      product_list_id_prefix = $product_list.id + 'item-',
      components = [],
      component_list_id_prefix = $component_list.id + 'item-';
  for (let [key, value] of Iterator(config.product)) {
    products.push(key);
    for (let [key, value] of Iterator(value.component)) {
      if (components.indexOf(key) === -1) {
        components.push(key);
      }
    }
  }
  products.sort();
  for (let [index, value] of Iterator(products)) {
    products[index] = {
      id: product_list_id_prefix + index,
      label: value
    };
  }
  components.sort();
  for (let [index, value] of Iterator(components)) {
    components[index] = {
      id: component_list_id_prefix + index,
      label: value
    };
  }

  let statuses = [],
      status_list_id_prefix = $status_list.id + 'item-';
  for (let [index, value] of Iterator(config.field.status.values)) {
    statuses.push({
      id: status_list_id_prefix + index,
      label: value
    });
  };

  let resolutions = [],
      resolution_list_id_prefix = $resolution_list.id + 'item-';
  for (let [key, value] of Iterator(config.field.resolution.values)) {
    resolutions.push({
      id: resolution_list_id_prefix + key,
      label: value || '---',
      selected: !value // Select '---' to search open bugs
    });
  };

  let ListBox = BriteGrid.widget.ListBox;
  new ListBox($classification_list, classifications);
  new ListBox($product_list, products);
  new ListBox($component_list, components);
  new ListBox($status_list, statuses);
  new ListBox($resolution_list, resolutions);

  let $textbox = $pane.querySelector('.text-box [role="textbox"]'),
      $button = $pane.querySelector('.text-box [role="button"]');

  $button.addEventListener('Pressed', event => {
    let query = {};

    let map = {
      classification: $classification_list,
      product: $product_list,
      component: $component_list,
      status: $status_list,
      resolution: $resolution_list
    };

    for (let [name, list] of Iterator(map)) {
      let values = [];
      for (let $option of list.querySelectorAll('[aria-selected="true"]')) {
        values.push($option.textContent);
      }
      if (values.length) {
        query[name] = values;
      }
    }

    if ($textbox.value) {
      query['summary'] = $textbox.value;
      query['summary_type'] = 'contains_all';
    }

    this.exec_search(query);
  });

  new BriteGrid.widget.Button($button);
};

BzDeck.SearchPage.prototype.setup_result_pane = function () {
  let $pane = this.view.panes['result'] 
            = this.view.tabpanel.querySelector('[id$="-result-pane"]'),
      $grid = $pane.querySelector('[role="grid"]');

  this.view.grid = new BriteGrid.widget.Grid($grid, {
    rows: [],
    columns: BzDeck.options.grid.default_columns
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: { key:'id', order:'ascending' }
  });

  $grid.addEventListener('Selected', event => {
    // Show Bug in Preview Pane
    let ids = event.detail.ids;
    if (ids.length) {
      this.data.preview_id = Number.toInteger(ids[ids.length - 1]);
    }
  });

  $grid.addEventListener('dblclick', event => {
    // Open Bug in New Tab
    new BzDeck.DetailsPage(event.originalTarget.dataset.id);
  });

  $grid.addEventListener('keydown', event => {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.focused);
    // [B] Select previous bug
    if (!modifiers && event.keyCode === event.DOM_VK_B && index > 0) {
      view.selected = view.focused = members[index - 1];
    }
    // [F] Select next bug
    if (!modifiers && event.keyCode === event.DOM_VK_F && index < members.length - 1) {
      view.selected = view.focused = members[index + 1];
    }
    // [M] toggle read
    if (!modifiers && event.keyCode === event.DOM_VK_M) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = _data._unread !== true;
      }
    }
    // [S] toggle star
    if (!modifiers && event.keyCode === event.DOM_VK_S) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._starred = _data._starred !== true;
      }
    }
  }, true); // use capture
};

BzDeck.SearchPage.prototype.setup_preview_pane = function () {
  let $pane = this.view.panes['preview'] 
            = this.view.tabpanel.querySelector('[id$="-preview-pane"]');

  let ScrollBar = BriteGrid.widget.ScrollBar;
  new ScrollBar($pane.querySelector('[id$="-bug-info"]'));
  new ScrollBar($pane.querySelector('[id$="-bug-timeline"]'));
};

BzDeck.SearchPage.prototype.show_preview = function (oldval, newval) {
  let $pane = this.view.panes['preview'],
      $template = $pane.querySelector('[id$="-preview-bug"]');

  if (!newval) {
    $template.setAttribute('aria-hidden', 'true');
    return;
  }

  BzDeck.model.get_bug_by_id(newval, bug => {
    if (!bug) {
      // Unknown bug
      $template.setAttribute('aria-hidden', 'true');
      return;
    }
    // Show the preview pane
    if ($pane.mozMatchesSelector('[aria-hidden="true"]')) {
      BzDeck.global.show_status('');
      this.view.panes['basic-search'].setAttribute('aria-hidden', 'true');
      $pane.setAttribute('aria-hidden', 'false');
      this.view.buttons['show-details'].data.disabled = false;
      this.view.buttons['show-basic-search-pane'].data.disabled = false;
    }
    // Fill the content
    BzDeck.global.fill_template($template, bug);
    $template.setAttribute('aria-hidden', 'false');
  });
};

BzDeck.SearchPage.prototype.exec_search = function (query) {
  if (!navigator.onLine) {
    BzDeck.global.show_status('You have to go online to search bugs.'); // l10n
    return;
  }

  // Specify fields
  query['include_fields'] = '_default';
  query = BriteGrid.util.request.build_query(query);

  BzDeck.global.show_status('Loading...'); // l10n
  BzDeck.global.update_grid_data(this.view.grid, []); // Clear grid body

  let $grid_body = this.view.panes['result'].querySelector('[class="grid-body"]')
  $grid_body.setAttribute('aria-busy', 'true');

  BzDeck.core.request('GET', 'bug?' + query, event => {
    let response = event.target.responseText,
        data = response ? JSON.parse(response) : null;
    if (!data || !Array.isArray(data.bugs)) {
      $grid_body.removeAttribute('aria-busy');
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
      return;
    }
    let num = data.bugs.length,
        status = '';
    if (num > 0) {
      // Save data
      let store = BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs');
      for (let bug of data.bugs) {
        let _bug = bug;
        store.get(bug.id).addEventListener('success', event => {
          if (!event.target.result) {
            store.put(_bug);
          }
        });
      }
      // Show results
      BzDeck.global.update_grid_data(this.view.grid, data.bugs);
      if (num > 1) {
        status = '%d bugs found.'.replace('%d', num); // l10n
      } else {
        status = '1 bug found.'; // l10n
      }
    } else {
      status = 'Zarro Boogs found.'; // l10n
    }
    $grid_body.removeAttribute('aria-busy');
    BzDeck.global.show_status(status);
  });
};

/* --------------------------------------------------------------------------
 * Details Page
 * -------------------------------------------------------------------------- */

BzDeck.DetailsPage = function (bug_id) {
  bug_id = Number.toInteger(bug_id);

  BzDeck.model.get_bug_by_id(bug_id, bug => {
    let tablist = BzDeck.toolbar.tablist;
  
    // Find an existing tab
    for (let tab of tablist.view.members) if (tab.id === 'tab-bug-' + bug_id) {
      tablist.view.selected = tablist.view.focused = tab;
      return;
    }
  
    // Prepare the tabpanel content
    let $template = document.getElementById('tabpanel-details-TEMPLATE'),
        $tabpanel = BzDeck.global.fill_template($template, bug || { id: bug_id }, true);
    document.getElementById('main-tabpanels').appendChild($tabpanel);
  
    // Open the new tab
    tablist.view.selected = tablist.view.focused = tablist.add_tab(
      'bug-' + bug_id,
      'Bug %d'.replace('%d', bug_id), // l10n
      'Bug %d\n%s'.replace('%d', bug_id).replace('%s', bug ? bug.summary : 'Loading...'), // l10n
      $tabpanel,
      'next'
    );

    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      if (!navigator.onLine) {
        BzDeck.global.show_status('You have to go online to load a bug.'); // l10n
        return;
      }

      BzDeck.global.show_status('Loading...'); // l10n
      let query = BriteGrid.util.request.build_query({
        include_fields: '_default,' + BzDeck.options.api.extra_fields.join(','),
        exclude_fields: 'attachments.data'
      });
      BzDeck.core.request('GET', 'bug/' + bug_id + '?' + query, event => {
        let response = event.target.responseText,
            bug = response ? JSON.parse(response) : null;
        if (!bug || !bug.id) {
          BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
          return;
        }
        // Save in DB
        BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs').put(bug);
        // Update UI
        BzDeck.global.show_status('');
        BzDeck.global.fill_template($tabpanel, bug);
        let $tab = document.getElementById('tab-bug-' + bug.id);
        if ($tab) {
          $tab.title = 'Bug %d\n%s'.replace('%d', bug.id).replace('%s', bug.summary); // l10n
        }
      });
    }
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

window.addEventListener('click', event => {
  let $target = event.target;

  // Discard clicks on the fullscreen dialog
  if ($target === document) {
    return true;
  }

  if ($target.mozMatchesSelector('[role="link"]')) {
    // Bug link: open in a new app tab
    if ($target.hasAttribute('data-bug-id')) {
      new BzDeck.DetailsPage($target.getAttribute('data-bug-id'));
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
});

window.addEventListener('keydown', event => {
  let $target = event.target;

  if ($target.mozMatchesSelector('input, [role="textbox"]')) {
    /*
    if (event.metaKey || event.ctrlKey) {
      switch (event.keyCode) {
        case event.DOM_VK_A: // Select
        case event.DOM_VK_C: // Copy
        case event.DOM_VK_V: // Paste
        case event.DOM_VK_X: // Cut
        case event.DOM_VK_Z: { // Undo/Redo
          break;
        }
        default: {
          event.preventDefault();
        }
      }
    }
    */
    return true;
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
        break;
      }
    }
    return;
  }
});
