/**
 * BzDeck Session Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Bootstrapper
BzDeck.controllers.Session = function SessionController () {
  let params = new URLSearchParams(location.search.substr(1));

  BzDeck.config.debug = params.get('debug') === 'true';

  this.bootstrapping = true;

  BzDeck.models.global = new BzDeck.models.Global();
  BzDeck.controllers.global = new BzDeck.controllers.Global();
  BzDeck.controllers.bugzfeed = new BzDeck.controllers.BugzfeedClient();

  new BzDeck.views.Session();
  new BzDeck.views.LoginForm();

  this.find_account();
};

BzDeck.controllers.Session.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Session.prototype.constructor = BzDeck.controllers.Session;

// Bootstrap Step 1. Find a user account from the local database
BzDeck.controllers.Session.prototype.find_account = function () {
  BzDeck.models.global.get_database().then(database => {
    return BzDeck.models.global.get_active_account();
  }, error => {
    this.trigger(':Error', { 'message': error.message });
  }).then(account => {
    BzDeck.models.account = account; // Model

    return BzDeck.models.global.get_server(account.data.host);
  }).then(server => {
    BzDeck.models.server = server; // Model
    this.load_data();
  }).catch(() => {
    this.force_login();
  });
};

// Bootstrap Step 2. Let the user sign in if an active account is not found
BzDeck.controllers.Session.prototype.force_login = function () {
  this.trigger(':StatusUpdate', { 'status': 'ForcingLogin', 'message': '' });

  this.on('LoginFormView:Submit', data => {
    if (!navigator.onLine) {
      this.trigger(':Error', { 'message': 'You have to go online to sign in.' }); // l10n

      return;
    }

    if (!this.bootstrapping) {
      // User is trying to re-login
      this.relogin = true;
      this.bootstrapping = true;
    }

    this.trigger(':StatusUpdate', { 'message': 'Verifying your account...' }); // l10n

    BzDeck.models.global.get_server(data.host).then(server => {
      BzDeck.models.server = server; // Model

      let params = new URLSearchParams(),
          options = { 'api_key': data.api_key };

      params.append('names', data.email);

      return new Promise((resolve, reject) => this.request('user', params, options).then(result => {
        result.users ? resolve(result.users[0]) : reject(new Error(result.message || 'User Not Found'));
      }).catch(error => reject(error)));
    }).then(user => {
      return user.error ? Promise.reject(new Error(user.error)) : Promise.resolve(user);
    }).then(user => {
      let account = BzDeck.models.account = new BzDeck.models.Account({
        'host': BzDeck.models.server.data.name,
        'name': data.email,
        'api_key': data.api_key || undefined,
        'loaded': Date.now(), // key
        'active': true,
        'bugzilla': user,
      });

      account.save();
      this.trigger(':UserFound');
      this.load_data();
    }).catch(error => {
      this.trigger(':Error', { 'message': error.message || 'Failed to find your account.' }); // l10n
    });
  });
};

// Bootstrap Step 3. Load data from Bugzilla once the user account is set
BzDeck.controllers.Session.prototype.load_data = function () {
  BzDeck.models.account.get_database().then(database => {
    BzDeck.collections.bugs = new BzDeck.collections.Bugs();
    BzDeck.collections.subscriptions = new BzDeck.collections.Subscriptions();
    BzDeck.models.prefs = new BzDeck.models.Prefs();
    BzDeck.collections.users = new BzDeck.collections.Users();
  }, error => {
    this.trigger(':Error', { 'message': error.message });
  }).then(() => Promise.all([
    BzDeck.collections.bugs.load(),
    BzDeck.models.prefs.load(),
    BzDeck.collections.users.load(),
  ])).then(() => {
    this.trigger(':StatusUpdate', { 'status': 'LoadingData', 'message': 'Loading Bugzilla config...' }); // l10n

    return Promise.all([
      BzDeck.collections.subscriptions.fetch(),
      new Promise((resolve, reject) => BzDeck.models.server.get_config().then(config => {
        resolve(config);
      }, error => {
        BzDeck.models.server.fetch_config().then(config => {
          BzDeck.models.server.save_config(config);
          resolve(config);
        }, error => {
          reject(error);
        });
      })).then(config => {
        // subscriptions.fetch() may be still working
        this.trigger(':StatusUpdate', { 'message': 'Loading your bugs...' }); // l10n
      }, error => {
        this.trigger(':Error', { 'message': error.message });
      })
    ]);
  }).then(() => {
    this.init_components();
  }).catch(error => {
    this.trigger(':Error', { 'message': error.message });
  });
};

// Bootstrap Step 4. Setup everything including UI components
BzDeck.controllers.Session.prototype.init_components = function () {
  this.trigger(':StatusUpdate', { 'message': 'Initializing UI...' }); // l10n

  new Promise((resolve, reject) => {
    this.relogin ? resolve() : reject();
  }).catch(error => Promise.all([
    // Finally load the UI modules
    BzDeck.controllers.global.init(),
    BzDeck.controllers.toolbar = new BzDeck.controllers.Toolbar(),
    BzDeck.controllers.sidebar = new BzDeck.controllers.Sidebar(),
    BzDeck.controllers.statusbar = new BzDeck.controllers.Statusbar(),
  ])).then(() => {
    // Connect to the push notification server
    BzDeck.controllers.bugzfeed.connect();
  }).then(() => {
    // Activate the router
    BzDeck.router.locate();
  }).then(() => {
    // Timer to check for updates, call every 5 minutes
    BzDeck.controllers.global.timers.set('fetch_subscriptions',
        window.setInterval(() => BzDeck.collections.subscriptions.fetch(), 1000 * 60 * 5));
  }).then(() => {
    // Register the app for an activity on Firefox OS
    // Comment out this since it's not working and even causes an error on the Android WebAppRT (#194)
    // BzDeck.controllers.global.register_activity_handler();
  }).then(() => {
    this.trigger(':StatusUpdate', { 'message': 'Loading complete.' }); // l10n
    this.show_first_notification();
    this.login();
    this.bootstrapping = false;
  });
};

BzDeck.controllers.Session.prototype.show_first_notification = function () {
  // Authorize a notification
  FlareTail.util.app.auth_notification();

  // Update UI & Show a notification
  BzDeck.controllers.global.toggle_unread(true);

  // Notify requests
  let bugs = BzDeck.collections.subscriptions.get('requests'),
      len = bugs.size;

  if (!len) {
    return;
  }

  let title = len > 1 ? `You have ${len} requests`
                      : 'You have 1 request'; // l10n
  let body = len > 1 ? 'Select the Requests folder to browse those bugs.'
                     : 'Select the Requests folder to browse the bug.'; // l10n

  // TODO: Improve the notification body to describe more about the requests,
  // e.g. There are 2 bugs awaiting your information, 3 patches awaiting your review.

  // Select the Requests folder when the notification is clicked
  BzDeck.views.global.show_notification(title, body).then(event => BzDeck.router.navigate('/home/requests'));
};

BzDeck.controllers.Session.prototype.login = function () {
  this.trigger(':Login');
};

BzDeck.controllers.Session.prototype.logout = function () {
  this.trigger(':Logout');
  this.clean();

  // Delete the account data and refresh the page to ensure the app works properly
  // TODO: Support multiple account by removing only the current account
  BzDeck.models.account.clear().then(() => location.replace(BzDeck.config.app.root));
};

BzDeck.controllers.Session.prototype.close = function () {
  window.close();
};

BzDeck.controllers.Session.prototype.clean = function () {
  // Terminate timers
  for (let timer of BzDeck.controllers.global.timers.values()) {
    window.clearInterval(timer);
  }

  BzDeck.controllers.global.timers.clear();

  // Destroy all notifications
  for (let notification of BzDeck.controllers.global.notifications) {
    notification.close();
  }

  BzDeck.controllers.global.notifications.clear();

  // Disconnect from the Bugzfeed server
  BzDeck.controllers.bugzfeed.disconnect();
};
