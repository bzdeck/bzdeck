/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar View.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarView = class SidebarView extends BzDeck.BaseView {
  /**
   * Get a SidebarView instance.
   * @returns {SidebarView} New SidebarView instance.
   */
  constructor () {
    super(); // Assign this.id

    this.panels = {};

    // Subscribe to events
    this.subscribe('NavigatorView#FolderSelected', true);

    // Initiate the corresponding presenter and sub-view
    this.panels.list = BzDeck.views.sidebar_list = new BzDeck.SidebarListView(this.id);
    this.panels.search = BzDeck.views.sidebar_search = new BzDeck.SidebarSearchView(this.id);
  }

  /**
   * Called whenever a navigator folder is selected. Select a different panel if needed.
   * @listens NavigatorView#FolderSelected
   * @param {String} id - Folder id.
   * @fires SidebarView#PanelChanged
   */
  on_folder_selected ({ id } = {}) {
    id = ['search'].includes(id) ? id : 'list';
    this.trigger('#PanelChanged', { id });

    for (const [_id, panel] of Object.entries(this.panels)) {
      panel.$container.setAttribute('aria-hidden', _id !== id);
    }
  }
}
