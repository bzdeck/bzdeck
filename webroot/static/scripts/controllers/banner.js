/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Banner Controller that controls everything on the global application header.
 *
 * @constructor
 * @extends BaseController
 * @argument {undefined}
 * @return {Object} controller - New BannerController instance.
 */
BzDeck.controllers.Banner = function BannerController () {
  let name = BzDeck.account.data.name;

  BzDeck.collections.users.get(name, { name }).then(user => {
    this.user = user;
    BzDeck.views.banner = new BzDeck.views.Banner(this.user);

    this.user.get_gravatar_profile().then(profile => {
      this.trigger(':GravatarProfileFound', {
        style: { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
      });
    });
  });

  // Subcontrollers
  BzDeck.controllers.quick_search = new BzDeck.controllers.QuickSearch();

  this.on('V:LogoClicked', data => BzDeck.router.navigate('/home/inbox'));
  this.subscribe('V:BackButtonClicked');
  this.subscribe('V:ReloadButtonPressed');
  this.subscribe('V:TabSelected');
  this.subscribe('V:AppMenuItemSelected');
};

BzDeck.controllers.Banner.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Banner.prototype.constructor = BzDeck.controllers.Banner;

/**
 * Called by BannerView whenever the Back button is clicked on the mobile view. Navigate backward when possible or just
 * show Inbox.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.Banner.prototype.on_back_button_clicked = function () {
  if (history.state && history.state.previous) {
    history.back();
  } else {
    BzDeck.router.navigate('/home/inbox');
  }
};

/**
 * Called by BannerView whenever the Reload button is clicked on the mobile view. Fetch the latest data from Bugzilla
 * instance.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.Banner.prototype.on_reload_button_pressed = function () {
  // Reset the timer
  window.clearInterval(BzDeck.controllers.global.timers.get('fetch_subscriptions'));
  BzDeck.controllers.global.timers.set('fetch_subscriptions', window.setInterval(() =>
      BzDeck.collections.subscriptions.fetch(), 1000 * 60 * (BzDeck.config.debug ? 1 : 5)));

  BzDeck.collections.subscriptions.fetch();
};

/**
 * Called by BannerView whenever a tab in the global tablist is selected. Navigate to the specified location.
 *
 * @argument {Object} data - Passed data.
 * @argument {String} data.path - Location pathname that corresponds to the tab.
 * @return {undefined}
 */
BzDeck.controllers.Banner.prototype.on_tab_selected = function (data) {
  if (location.pathname + location.search !== data.path) {
    BzDeck.router.navigate(data.path);
  }
};

/**
 * Called by BannerView whenever an Application menu item is selected.
 *
 * @argument {Object} data - Passed data.
 * @argument {String} data.command - Command name of the menu itme.
 * @return {undefined}
 */
BzDeck.controllers.Banner.prototype.on_app_menu_item_selected = function (data) {
  let func = {
    'show-profile': () => BzDeck.router.navigate('/profile/' + this.user.email),
    'show-settings': () => BzDeck.router.navigate('/settings'),
    logout: () => BzDeck.controllers.session.logout(),
  }[data.command];

  if (func) {
    func();
  }
};
