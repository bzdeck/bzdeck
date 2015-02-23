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
  this.bootstrapping = true;

  // Define all models
  BzDeck.models.account = new BzDeck.models.Account();
  BzDeck.models.bug = new BzDeck.models.Bug();
  BzDeck.models.pref = new BzDeck.models.Pref();
  BzDeck.models.server = new BzDeck.models.Server();

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
  BzDeck.models.account.open_global_db().then(database => {
  }, error => {
    this.trigger(':Error', { 'message': error.message });
  }).then(() => {
    return BzDeck.models.account.get_active_account();
  }).then(account => {
    return BzDeck.models.server.get(BzDeck.models.account.data.host);
  }).then(server => {
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

    BzDeck.models.server.get(data.host).then(server => {
      return BzDeck.controllers.users.fetch_user(data.email, data.api_key);
    }).then(account => {
      account.active = true;
      account.loaded = Date.now(); // key
      account.host = BzDeck.models.server.data.name;
      account.api_key = data.api_key || undefined;
      BzDeck.models.account.save(account);

      this.trigger(':UserFound');
      this.load_data();
    }).catch(error => {
      this.trigger(':Error', { 'message': error.message || 'Failed to find your account.' }); // l10n
    });
  });
};

// Bootstrap Step 3. Load data from Bugzilla once the user account is set
BzDeck.controllers.Session.prototype.load_data = function () {
  BzDeck.models.account.open_account_db().then(database => {
  }, error => {
    this.trigger(':Error', { 'message': error.message });
  }).then(() => {
    return BzDeck.models.pref.load();
  }).then(() => {
    this.trigger(':StatusUpdate', { 'status': 'LoadingData', 'message': 'Loading Bugzilla config...' }); // l10n

    return Promise.all([
      BzDeck.controllers.bugs.fetch_subscriptions(),
      new Promise((resolve, reject) => BzDeck.models.server.get_config().then(config => {
        resolve(config);
      }, error => {
        BzDeck.controllers.config.fetch().then(config => {
          BzDeck.models.server.save_config(config);
          resolve(config);
        }, error => {
          reject(error);
        });
      })).then(config => {
        // fetch_subscriptions may be still working
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

  // Finally load the UI modules
  if (!this.relogin) {
    BzDeck.controllers.global.init();
    BzDeck.controllers.toolbar = new BzDeck.controllers.Toolbar();
    BzDeck.controllers.sidebar = new BzDeck.controllers.Sidebar();
    BzDeck.controllers.statusbar = new BzDeck.controllers.Statusbar();
  }

  // Connect to the push notification server
  BzDeck.controllers.bugzfeed.connect();

  // Activate the router
  BzDeck.router.locate();

  // Timer to check for updates, call every 10 minutes
  BzDeck.controllers.global.timers.set('fetch_subscriptions',
      window.setInterval(() => BzDeck.controllers.bugs.fetch_subscriptions(), 600000));

  // Register the app for an activity on Firefox OS
  BzDeck.controllers.app.register_activity_handler();

  this.trigger(':StatusUpdate', { 'message': 'Loading complete.' }); // l10n
  this.show_first_notification();
  this.login();
  this.bootstrapping = false;
};

BzDeck.controllers.Session.prototype.show_first_notification = function () {
  // Authorize a notification
  FlareTail.util.app.auth_notification();

  // Update UI & Show a notification
  BzDeck.controllers.global.toggle_unread(true);

  // Notify requests
  BzDeck.models.bug.get_subscription('requests').then(bugs => {
    let len = bugs.size;

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
  });
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
