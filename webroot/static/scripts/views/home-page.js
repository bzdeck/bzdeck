/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Home Page View that represents the Home Page tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.HomePageView = class HomePageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Home Page View. Select the specified Navigator folder.
   * @constructor
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @returns {HomePageView} New HomePageView instance.
   */
  constructor (folder_id) {
    super(); // Assign this.id

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.homepage = this.presenter = new BzDeck.HomePagePresenter(this.id);

    BzDeck.views.pages.home = this;
    this.connect(folder_id);
  }

  /**
   * Called by the app router to reuse the view.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   */
  reactivate (folder_id) {
    this.connect(folder_id);
  }

  /**
   * Select the Home tab and open the specified Navigator folder.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @fires HomePageView#UnknownFolderSelected
   */
  connect (folder_id) {
    const $folder = document.querySelector(`#navigator-folder-${folder_id}`);
    const $tab = document.querySelector('#tab-home');
    const $$tablist = BzDeck.views.main.$$tablist;

    if (!$folder) {
      // Unknown folder; ignore
      this.trigger('#UnknownFolderSelected');

      return;
    }

    if (document.documentElement.getAttribute('data-current-tab') !== 'home') {
      $$tablist.view.selected = $$tablist.view.$focused = $tab;
    }

    if (BzDeck.presenters.navigator.data.folder_id !== folder_id) {
      BzDeck.views.navigator.$$folders.view.selected = $folder;
      BzDeck.presenters.navigator.open_folder(folder_id);
    }

    BzDeck.views.main.tab_path_map.set('tab-home', location.pathname);
    BzDeck.views.global.update_window_title($tab);
  }
}
