/**
 * BzDeck Bootstrapper
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.controllers = BzDeck.controllers || {};

BzDeck.controllers.bootstrap = {};

BzDeck.controllers.bootstrap.init = function () {
  let form = new BzDeck.views.LoginForm(),
      status = message => form.show_status(message);

  // Delete the old DB
  indexedDB.deleteDatabase('BzDeck');

  BzDeck.models.open_global_db().then(database => {
    BzDeck.models.databases.global = database;
  }, error => {
    status('Failed to open the database. Make sure you’re not using private browsing mode or IndexedDB doesn’t work.');
  }).then(() => {
    return BzDeck.models.accounts.get_active_account();
  }).then(account => {
    BzDeck.models.data.account = account;
  }).then(() => {
    return BzDeck.models.servers.get_server(BzDeck.models.data.account.host);
  }).then(server => {
    BzDeck.models.data.server = server;
  }).catch(() => {
    status('');

    return new Promise(resolve => {
      let user;

      form.show().then(email => {
        user = email;

        // TODO: Users will be able to choose an instance on the sign-in form
        return BzDeck.models.servers.get_server('mozilla');
      }).then(server => {
        BzDeck.models.data.server = server;
      }).then(() => {
        status('Verifying your account...'); // l10n

        return BzDeck.controllers.users.fetch_user(user);
      }).then(account => {
        account.active = true;
        account.loaded = Date.now(); // key
        account.host = BzDeck.models.data.server.name;
        BzDeck.models.data.account = account;
        BzDeck.models.accounts.save_account(account);
        resolve();
      }).catch(error => {
        if (error.message === 'Network Error') {
          status('Failed to sign in. Network error?'); // l10n
        } else if (error.message === 'User Not Found') {
          status('Your account could not be found. Please check your email adress and try again.'); // l10n
        } else {
          status(error.message);
        }

        form.enable_input();
      });
    });
  }).then(() => {
    return BzDeck.models.open_account_db();
  }).then(database => {
    BzDeck.models.databases.account = database;
  }, error => {
    status('Failed to open the database. Make sure you’re not using private browsing mode or IndexedDB doesn’t work.');
  }).then(() => {
    return BzDeck.models.prefs.load();
  }).then(() => {
    status('Loading bugs...'); // l10n
    document.querySelector('#app-intro').style.display = 'none';
    form.hide();

    return Promise.all([
      BzDeck.controllers.bugs.fetch_subscriptions(),
      BzDeck.models.config.load().then(config => {
        BzDeck.models.data.server.config = config
      }, error => {
        form.disable_input();
        status(error.message);
      })
    ]);
  }).then(() => {
    if (!this.relogin) {
      // Finally load the UI modules
      BzDeck.views.core.init();
    }
  }, error => {
    status(error.message);
  }).then(() => {
    // Connect to the push notification server
    BzDeck.controllers.bugzfeed = new BzDeck.controllers.BugzfeedClient();
    BzDeck.controllers.bugzfeed.connect();

    // Activate the router
    BzDeck.router = new FlareTail.app.Router(BzDeck);
    BzDeck.router.locate();

    // Timer to check for updates, call every 10 minutes
    BzDeck.controllers.core.timers.set('fetch_subscriptions',
        window.setInterval(() => BzDeck.controllers.bugs.fetch_subscriptions(), 600000));

    // Register the app for an activity on Firefox OS
    BzDeck.controllers.app.register_activity_handler();

    BzDeck.views.core.show_status('Loading complete.'); // l10n
    BzDeck.controllers.session.show_first_notification();
    BzDeck.controllers.session.login();

    this.processing = false;
  });
};

window.addEventListener('DOMContentLoaded', event => {
  BzDeck.controllers.bootstrap.processing = true;

  if (FlareTail.util.compatible) {
    BzDeck.controllers.bootstrap.init();
  }
});
