/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Sidebar View that represents the global application sidebar.
 *
 * @constructor
 * @extends BaseView
 * @argument {undefined}
 * @return {Object} view - New SidebarView instance.
 */
BzDeck.views.Sidebar = function SidebarView () {
  let mobile = this.helpers.env.device.mobile,
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  $root.setAttribute('data-sidebar-hidden', mobile);
  $sidebar.setAttribute('aria-hidden', mobile);

  $sidebar.addEventListener('click', event => {
    if (mobile) {
      let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

      $root.setAttribute('data-sidebar-hidden', hidden);
      $sidebar.setAttribute('aria-hidden', hidden);
    }
  });

  new this.widgets.ScrollBar($sidebar.querySelector('div'));

  this.$$folders = new this.widgets.ListBox(document.querySelector('#sidebar-folder-list'), BzDeck.config.folders);
  this.$$folders.bind('Selected', event => this.trigger(':FolderSelected', { id: event.detail.ids[0] }));

  this.on('C:FolderOpened', data => this.open_folder(data.folder_id, data.bugs));
  this.on('C:UnreadToggled', data => this.toggle_unread(data.number));
};

BzDeck.views.Sidebar.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Sidebar.prototype.constructor = BzDeck.views.Sidebar;

/**
 * Open a specified folder by updating the document title and rendering the home page thread.
 *
 * @argument {String} folder_id - One of the folder identifiers defined in the app config.
 * @argument {Map.<Number, Proxy>} bugs - List of bugs to render.
 * @return {undefined}
 */
BzDeck.views.Sidebar.prototype.open_folder = function (folder_id, bugs) {
  let home = BzDeck.views.pages.home,
      toolbar = BzDeck.views.banner,
      folder_label = BzDeck.config.folders.find(f => f.data.id === folder_id).label,
      unread = [...bugs.values()].filter(bug => bug.unread).length;

  home.update_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
  home.thread.filter ? home.thread.filter(bugs) : home.thread.update(bugs);
  document.querySelector('#home-list-pane > footer').setAttribute('aria-hidden', !!bugs.size);

  // Mobile compact layout
  if (this.helpers.env.device.mobile &&
      toolbar.$$tablist.view.selected[0].id !== 'tab-home') {
    // Select the home tab
    toolbar.$$tablist.view.selected = toolbar.$$tablist.view.members[0];
  }
};

/**
 * Show the number of unread bugs on the Inbox option.
 *
 * @argument {Number} num - Number of unread bugs.
 * @return {undefined}
 */
BzDeck.views.Sidebar.prototype.toggle_unread = function (num) {
  let $label = document.querySelector('#sidebar-folders--inbox label'),
      $num = $label.querySelector('span');

  if (num) {
    $num = $num || $label.appendChild(document.createElement('span'));
    $num.textContent = num;
  } else if ($num) {
    $num.remove();
  }
};
