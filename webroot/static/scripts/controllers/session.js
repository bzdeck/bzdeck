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

  BzDeck.datasources.global = new BzDeck.datasources.Global();
  BzDeck.datasources.account = new BzDeck.datasources.Account();
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
  BzDeck.datasources.global.load().then(database => {
    BzDeck.collections.accounts = new BzDeck.collections.Accounts();
    BzDeck.collections.servers = new BzDeck.collections.Servers();
  }, error => {
    this.trigger(':Error', { 'message': error.message });
  }).then(() => Promise.all([
    BzDeck.collections.accounts.load(),
    BzDeck.collections.servers.load(),
  ])).then(() => {
    BzDeck.models.account = BzDeck.collections.accounts.get_current();
    BzDeck.models.server = BzDeck.collections.servers.get(BzDeck.models.account.data.host);
  }).then(() => {
    this.load_data();
  }).catch(error => {
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

    let server = BzDeck.models.server = BzDeck.collections.servers.get(data.host, { 'host': data.host }),
        params = new URLSearchParams();

    params.append('names', data.email);

    return this.request('user', params, { 'api_key': data.api_key }).then(result => {
      return result.users ? Promise.resolve(result.users[0])
                          : Promise.reject(new Error(result.message || 'User Not Found'));
    }, error => {
      return Promise.reject(error);
    }).then(user => {
      return user.error ? Promise.reject(new Error(user.error)) : Promise.resolve(user);
    }).then(user => {
      let account = BzDeck.models.account = new BzDeck.models.Account({
        'host': BzDeck.models.server.name,
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
  }, true);
};

// Bootstrap Step 3. Load data from local database once the user account is set
BzDeck.controllers.Session.prototype.load_data = function () {
  BzDeck.datasources.account.load().then(database => {
    BzDeck.collections.bugs = new BzDeck.collections.Bugs();
    BzDeck.collections.subscriptions = new BzDeck.collections.Subscriptions();
    BzDeck.prefs = new BzDeck.collections.Prefs();
    BzDeck.collections.users = new BzDeck.collections.Users();
  }, error => {
    this.trigger(':Error', { 'message': error.message });
  }).then(() => Promise.all([
    BzDeck.collections.bugs.load(),
    BzDeck.prefs.load(),
    BzDeck.collections.users.load(),
  ])).then(() => {
    this.firstrun = !BzDeck.collections.bugs.get_all().size;
  }).then(() => {
    // Fetch data for new users before showing the main app window, or defer fetching for returning users
    return this.firstrun ? this.fetch_data() : Promise.resolve();
  }).then(() => {
    this.init_components();
  }).catch(error => {
    this.trigger(':Error', { 'message': error.message });
  });
};

// Bootstrap Step 4. Retrieve data from remote Bugzilla instance
BzDeck.controllers.Session.prototype.fetch_data = function () {
  this.trigger(':StatusUpdate', { 'status': 'LoadingData', 'message': 'Loading Bugzilla config and your bugs...' });

  return Promise.all([
    BzDeck.collections.subscriptions.fetch(),
    BzDeck.models.server.get_config(),
  ]);
};

// Bootstrap Step 5. Setup everything including UI components
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
  }).then(() => {
    // Fetch data for returning users
    return this.firstrun ? Promise.resolve() : this.fetch_data();
  }).catch(error => {
    this.trigger(':Error', { 'message': error.message });
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
  BzDeck.controllers.global.show_notification(title, body).then(event => BzDeck.router.navigate('/home/requests'));
};

BzDeck.controllers.Session.prototype.login = function () {
  this.trigger(':Login');
};

BzDeck.controllers.Session.prototype.logout = function () {
  this.trigger(':Logout');
  this.clean();

  // Delete the account data and refresh the page to ensure the app works properly
  // TODO: Support multiple account by removing only the current account
  BzDeck.collections.accounts.delete(BzDeck.models.account.data.loaded)
    .then(() => location.replace(BzDeck.config.app.root));
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

window.addEventListener('DOMContentLoaded', event => {
  if (FlareTail.compatible) {
    BzDeck.controllers.session = new BzDeck.controllers.Session();
  }
});

window.addEventListener('beforeunload', event => {
  BzDeck.controllers.session.clean();
});
