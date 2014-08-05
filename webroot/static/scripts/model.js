/**
 * BzDeck Model
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

/* ----------------------------------------------------------------------------------------------
 * Config
 * ---------------------------------------------------------------------------------------------- */

BzDeck.config = {
  'servers': [
    {
      'name': 'mozilla',
      'label': 'Mozilla',
      'url': 'https://bugzilla.mozilla.org',
      'endpoints': {
        'bzapi': '/bzapi/',
        'rest': '/rest/',
        'websocket': 'ws://bugzfeed.mozilla.org/'
      }
    }
  ],
  'app': {
    'manifest': `${location.origin}/manifest.webapp`
  },
  'grid': {
    'default_columns': [
      // Custom
      { 'id': '_starred', 'label': 'Starred', 'type': 'boolean' },
      { 'id': '_unread', 'label': 'Unread', 'type': 'boolean', 'hidden': true },
      // Name
      { 'id': 'id', 'label': 'ID' /* instead of Bug ID */, 'type': 'integer' },
      { 'id': 'alias', 'hidden': true },
      { 'id': 'summary' },
      // Status
      { 'id': 'status', 'hidden': true },
      { 'id': 'resolution', 'hidden': true },
      { 'id': 'target_milestone', 'hidden': true },
      // Affected
      { 'id': 'classification', 'hidden': true },
      { 'id': 'product' },
      { 'id': 'component' },
      { 'id': 'version', 'hidden': true },
      { 'id': 'platform', 'hidden': true },
      { 'id': 'op_sys', 'hidden': true },
      // Importance
      { 'id': 'severity', 'hidden': true },
      { 'id': 'priority', 'hidden': true },
      // Notes
      { 'id': 'whiteboard', 'hidden': true },
      { 'id': 'keywords', 'hidden': true },
      { 'id': 'url', 'hidden': true },
      // People
      { 'id': 'creator', 'type': 'person', 'hidden': true },
      { 'id': 'assigned_to', 'type': 'person', 'hidden': true },
      { 'id': 'qa_contact', 'type': 'person', 'hidden': true },
      { 'id': 'mentors', 'label': 'Mentors' /* Not found in the config */, 'type': 'people', 'hidden': true },
      // Dates
      { 'id': 'creation_time', 'type': 'time', 'hidden': true },
      { 'id': 'last_change_time', 'type': 'time' },
    ]
  }
};

/* ----------------------------------------------------------------------------------------------
 * Model
 * ---------------------------------------------------------------------------------------------- */

BzDeck.model = {
 'databases': {},
 'data': {}
};

BzDeck.model.request = function (method, path, params, data = null, listeners = {}, options = {}) {
  let server = this.data.server,
      account = this.data.account,
      xhr = new XMLHttpRequest(),
      url = new URL(server.url + server.endpoints.rest);

  params = params || new URLSearchParams();

  if (options.auth) {
    params.append('token', `${account.id} - ${account.token}`);
  }

  url.pathname += path;
  url.searchParams = params;
  xhr.open(method, url.toString(), true);
  xhr.setRequestHeader('Accept', 'application/json');

  if (listeners.upload && typeof listeners.upload.onprogress === 'function') {
    xhr.upload.addEventListener('progress', event => listeners.upload.onprogress(event));
  }

  xhr.addEventListener('progress', event => {
    if (typeof listeners.onprogress === 'function') {
      listeners.onprogress(event);
    }
  });

  return new Promise((resolve, reject) => {
    xhr.addEventListener('load', event => {
      let text = event.target.responseText;

      text ? resolve(JSON.parse(text)) : reject(new Error('Data not found or not valid in the response.'));
    });

    xhr.addEventListener('error', event => reject(new Error('Connection error.')));
    xhr.addEventListener('abort', event => reject(new Error('Connection aborted.')));

    if (navigator.onLine) {
      xhr.send(data);
    } else {
      reject(new Error('You have to go online to load data.')); // l10n
    }
  });
};

BzDeck.model.get_store = function (name) {
  let type = name.match(/^accounts|bugzilla$/) ? 'global' : 'account',
      store = this.databases[type].transaction(name, 'readwrite').objectStore(name),
      send = request => new Promise((resolve, reject) => {
        request.addEventListener('success', event => resolve(event.target.result));
        request.addEventListener('error', event => reject(new Error(event)));
      });

  return {
    'save': obj => send(store.put(obj)),
    'get': key => send(store.get(key)),
    'get_all': () => send(store.mozGetAll()),
    'delete': key => send(store.delete(key))
  };
};

BzDeck.model.open_global_database = function () {
  let req = indexedDB.open('global');

  // The database is created or upgraded
  req.addEventListener('upgradeneeded', event => {
    let db = event.target.result,
        store;

    store = db.createObjectStore('bugzilla', { 'keyPath': 'host' });

    store = db.createObjectStore('accounts', { 'keyPath': 'loaded' });
    store.createIndex('host', 'host', { 'unique': false });
    store.createIndex('id', 'id', { 'unique': false });
    store.createIndex('name', 'name', { 'unique': false });
  });

  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Cannot open the database.'))); // l10n
  });
};

BzDeck.model.get_all_accounts = function () {
  return new Promise((resolve, reject) => {
    this.get_store('accounts').get_all().then(accounts => {
      resolve(accounts);
    }).catch(error => {
      reject(new Error('Failed to load accounts.')); // l10n
    });
  });  
};

BzDeck.model.get_active_account = function () {
  return new Promise((resolve, reject) => {
    this.get_all_accounts().then(accounts => {
      let account = [for (account of accounts) if (account.active) account][0];

      account ? resolve(account) : reject(new Error('Account Not Found'));
    });
  });
};

BzDeck.model.save_account = function (account) {
  return new Promise((resolve, reject) => {
    this.get_store('accounts').save(account).then(result => {
      resolve(result);
    }).catch(error => {
      reject(new Error('Failed to save the account.')); // l10n
    });
  });
};

BzDeck.model.open_account_database = function () {
  let req = indexedDB.open(`${this.data.server.name}::${this.data.account.name}`);

  req.addEventListener('upgradeneeded', event => {
    let db = this.databases.account = event.target.result,
        store;

    store = db.createObjectStore('bugs', { 'keyPath': 'id' });
    store.createIndex('alias', 'alias', { 'unique': true });

    store = db.createObjectStore('users', { 'keyPath': 'name' });
    store.createIndex('id', 'id', { 'unique': true });

    store = db.createObjectStore('prefs', { 'keyPath': 'name' });
  });

  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Cannot open the database.'))); // l10n
  });
};

BzDeck.model.get_server = function (name) {
  let server = [for (server of BzDeck.config.servers) if (server.name === name) server][0];

  return new Promise((resolve, reject) => {
    server ? resolve(server) : reject(new Error('Server Not Found'));
  });
};

BzDeck.model.load_prefs = function () {
  let prefs = {};

  return new Promise((resolve, reject) => {
    this.get_store('prefs').get_all().then(result => {
      for (let pref of result) {
        prefs[pref.name] = pref.value;
      }

      this.data.prefs = new Proxy(prefs, {
        'set': (obj, key, value) => {
          obj[key] = value;
          this.get_store('prefs').save({ 'name': key, value });
        }
      });

      resolve();
    });
  });
};

BzDeck.model.load_config = function () {
  let server_name = this.data.server.name;

  return new Promise((resolve, reject) => {
    this.get_store('bugzilla').get(server_name).then(server => {
      if (server) {
        // Cache found
        resolve(server.config);

        return;
      }

      if (!navigator.onLine) {
        // Offline; give up
        reject(new Error('You have to go online to load data.')); // l10n

        return;
      }

      // Load the Bugzilla config in background
      let server = this.data.server,
          xhr = new XMLHttpRequest();

      // The config is not available from the REST endpoint so use the BzAPI compat layer instead
      xhr.open('GET', `${server.url}${server.endpoints.bzapi}configuration?cached_ok=1`, true);
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.addEventListener('load', event => {
        let data = JSON.parse(event.target.responseText);

        if (!data || !data.version) {
          // Give up
          reject(new Error('Bugzilla configuration could not be loaded. The instance might be offline.')); // l10n

          return;
        }

        // The config is loaded successfully
        this.get_store('bugzilla').save({ 'host': server_name, 'config': data });
        resolve(data);
      });

      xhr.send(null);
    });
  });
};

BzDeck.model.fetch_user = function (email) {
  let params = new URLSearchParams();

  params.append('names', email);

  return new Promise((resolve, reject) => {
    this.request('GET', 'user', params).then(result => {
      result.error ? reject(new Error(result.message || 'User Not Found')) : resolve(result.users[0]);
    }).catch(event => {
      reject(new Error('Network Error')); // l10n
    });
  });
};

BzDeck.model.fetch_subscriptions = function () {
  let prefs = this.data.prefs,
      last_loaded = prefs['subscriptions.last_loaded'],
      ignore_cc = prefs['notifications.ignore_cc_changes'] !== false,
      firstrun = !last_loaded,
      params = new URLSearchParams(),
      fields = ['cc', 'reporter', 'assigned_to', 'qa_contact', 'bug_mentor', 'requestees.login_name'];

  params.append('resolution', '---');
  params.append('j_top', 'OR');

  if (last_loaded) {
    params.append('chfieldfrom', (new Date(last_loaded)).toLocaleFormat('%Y-%m-%d %T'));
  }

  for (let [i, name] of fields.entries()) {
    params.append('f' + i, name);
    params.append('o' + i, 'equals');
    params.append('v' + i, this.data.account.name);
  }

  return new Promise((resolve, reject) => {
    this.get_all_bugs().then(cached_bugs => {
      // Append starred bugs to the query
      params.append('f9', 'bug_id');
      params.append('o9', 'anywords');
      params.append('v9', [for (_bug of cached_bugs) if (BzDeck.model.bug_is_starred(_bug)) _bug.id].join());

      this.request('GET', 'bug', params).then(result => {
        last_loaded = prefs['subscriptions.last_loaded'] = Date.now();

        for (let bug of result.bugs) {
          if (firstrun) {
            bug._unread = false; // Mark all bugs read if the session is firstrun
            bug._update_needed = true; // Flag to fetch details

            continue;
          }

          this.fetch_bug(bug, false).then(bug => {
            let cache = [for (_bug of cached_bugs) if (_bug.id === bug.id) _bug][0];

            if (cache) {
              // Copy annotations
              for (let [key, value] of Iterator(cache)) if (key.startsWith('_')) {
                bug[key] = value;
              }
            }

            bug._update_needed = false;

            // Mark the bug unread if the user subscribes CC changes or the bug is already unread
            if (!ignore_cc || !cache || cache._unread || !cache._last_viewed ||
                // or there are unread comments
                [for (c of bug.comments) if (c.creation_time > cache.last_change_time) c].length ||
                // or there are unread attachments
                [for (a of bug.attachments) if (a.creation_time > cache.last_change_time) a].length ||
                // or there are unread non-CC changes
                [for (h of bug.history) if (history.when > cache.last_change_time &&
                  [for (c of history.changes) if (c.field_name !== 'cc') c].length) h].length) {
              bug._unread = true;
            } else {
              // Looks like there are only CC changes, so mark the bug read
              bug._unread = false;
            }

            this.save_bug(bug);
          });
        }

        firstrun ? this.save_bugs(result.bugs).then(bugs => resolve()) : resolve();
      }).catch(event => {
        reject(new Error('Failed to load data.')); // l10n
      });
    });
  });
};

BzDeck.model.fetch_bug = function (bug, include_metadata = true, include_details = true) {
  let fetch = (method, params) => new Promise((resolve, reject) => {
    this.request('GET', `bug/${bug.id}${method ? '/' + method : ''}`,
                 params ? new URLSearchParams(params) : null).then(result => {
      resolve(result.bugs);
    }).catch(event => {
      reject(new Error());
    });
  });

  let fetchers = [include_metadata ? fetch() : Promise.resolve()];

  if (include_details) {
    fetchers.push(fetch('comment'), fetch('history'), fetch('attachment', 'exclude_fields=data'));
  }

  return Promise.all(fetchers).then(values => {
    bug = include_metadata ? values[0][0] : bug;

    if (include_details) {
      bug.comments = values[1][bug.id].comments;
      bug.history = values[2][0].history || [];
      bug.attachments = values[3][bug.id] || [];
      bug._update_needed = false;
    }

    return bug;
  }).catch(error => {
    return bug;
  });
};

BzDeck.model.fetch_bugs_by_ids = function (ids) {
  let params = new URLSearchParams();

  params.append('bug_id', ids.join());

  return new Promise((resolve, reject) => {
    this.request('GET', 'bug', params).then(result => {
      resolve(result.bugs);
    }).catch(event => {
      reject(new Error());
    });
  });
};

BzDeck.model.get_bug_by_id = function (id, record_time = true) {
  let cache = this.data.bugs,
      store = this.get_store('bugs');

  return new Promise((resolve, reject) => {
    if (cache) {
      let bug = cache.get(id);

      if (bug) {
        resolve(bug);

        if (record_time) {
          bug._last_viewed = Date.now();
          cache.set(id, bug);
          store.save(bug);
        }

        return;
      }
    }

    store.get(id).then(bug => {
      resolve(bug);

      if (bug && record_time) {
        bug._last_viewed = Date.now();

        if (cache) {
          cache.set(id, bug);
        }

        store.save(bug);
      }
    });
  });
};

BzDeck.model.get_bugs_by_ids = function (ids) {
  let cache = this.data.bugs,
      ids = [...ids]; // Accept both an Array and a Set as the first argument

  return new Promise((resolve, reject) => {
    if (cache) {
      resolve([for (c of [...cache]) if (ids.indexOf(c[0]) > -1) c[1]]);

      return;
    }

    this.get_store('bugs').get_all().then(bugs => {
      resolve([for (bug of bugs) if (ids.indexOf(bug.id) > -1) bug]);
    });
  });
};

BzDeck.model.get_all_bugs = function () {
  let cache = this.data.bugs;

  return new Promise((resolve, reject) => {
    if (cache) {
      resolve([for (c of [...cache]) c[1]]); // Convert Map to Array

      return;
    }

    this.get_store('bugs').get_all().then(bugs => {
      resolve(bugs || []);

      if (bugs && !cache) {
        this.data.bugs = new Map([for (bug of bugs) [bug.id, bug]]);
      }
    });
  });
};

BzDeck.model.save_bug = function (bug) {
  return new Promise((resolve, reject) => this.save_bugs([bug]).then(resolve(bug)));
};

BzDeck.model.save_bugs = function (bugs) {
  let cache = this.data.bugs,
      transaction = this.databases.account.transaction('bugs', 'readwrite'),
      store = transaction.objectStore('bugs');

  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', event => resolve(bugs));

    if (!cache) {
      cache = this.data.bugs = new Map();
    }

    for (let bug of bugs) if (bug.id) {
      cache.set(bug.id, bug);
      store.put(bug);
    }
  });
};

BzDeck.model.bug_is_starred = function (bug) {
  return !!bug._starred_comments && !!bug._starred_comments.size;
};

BzDeck.model.get_subscription_by_id = function (id) {
  return new Promise((resolve, reject) => {
    this.get_all_subscriptions().then(subscriptions => resolve(subscriptions.get(id)));
  });
};

BzDeck.model.get_all_subscriptions = function () {
  let email = this.data.account.name;

  return new Promise((resolve, reject) => {
    this.get_all_bugs().then(bugs => {
      resolve(new Map([
        ['cc', [for (bug of bugs) if (bug.cc.indexOf(email) > -1) bug]],
        ['reported', [for (bug of bugs) if (bug.creator === email) bug]],
        ['assigned', [for (bug of bugs) if (bug.assigned_to === email) bug]],
        ['mentor', [for (bug of bugs) if (bug.mentors.indexOf(email) > -1) bug]],
        ['qa', [for (bug of bugs) if (bug.qa_contact === email) bug]],
        ['requests', [for (bug of bugs) if (bug.flags) for (flag of bug.flags) if (flag.requestee === email) bug]]
      ]));
    });
  });
};
