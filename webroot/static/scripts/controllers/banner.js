/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Banner Controller that controls everything on the global application header.
 * @extends BzDeck.BaseController
 */
BzDeck.BannerController = class BannerController extends BzDeck.BaseController {
  /**
   * Get a BannerController instance.
   * @constructor
   * @argument {Object} user - UserModel instance.
   * @return {Object} controller - New BannerController instance.
   */
  constructor (user) {
    super(); // This does nothing but is required before using `this`

    this.user = user;
    BzDeck.views.banner = new BzDeck.BannerView(this.user);

    this.user.get_gravatar_profile().then(profile => {
      this.trigger(':GravatarProfileFound', {
        style: { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
      });
    });

    // Subcontrollers
    BzDeck.controllers.quick_search = new BzDeck.QuickSearchController();

    this.on('V:LogoClicked', data => BzDeck.router.navigate('/home/inbox'));
    this.on('V:ReloadButtonPressed', () => BzDeck.collections.subscriptions.reload());
    this.subscribe('V:BackButtonClicked');
    this.subscribe('V:TabSelected');
    this.subscribe('V:AppMenuItemSelected');
  }

  /**
   * Called by BannerView whenever the Back button is clicked on the mobile view. Navigate backward when possible or
   * just show Inbox.
   * @argument {undefined}
   * @return {undefined}
   */
  on_back_button_clicked () {
    if (history.state && history.state.previous) {
      history.back();
    } else {
      BzDeck.router.navigate('/home/inbox');
    }
  }

  /**
   * Called by BannerView whenever a tab in the global tablist is selected. Navigate to the specified location.
   * @argument {Object} data - Passed data.
   * @argument {String} data.path - Location pathname that corresponds to the tab.
   * @return {undefined}
   */
  on_tab_selected (data) {
    if (location.pathname + location.search !== data.path) {
      BzDeck.router.navigate(data.path);
    }
  }

  /**
   * Called by BannerView whenever an Application menu item is selected.
   * @argument {Object} data - Passed data.
   * @argument {String} data.command - Command name of the menu itme.
   * @return {undefined}
   */
  on_app_menu_item_selected (data) {
    let func = {
      'show-profile': () => BzDeck.router.navigate('/profile/' + this.user.email),
      'show-settings': () => BzDeck.router.navigate('/settings'),
      logout: () => BzDeck.controllers.session.logout(),
    }[data.command];

    if (func) {
      func();
    }
  }
}
