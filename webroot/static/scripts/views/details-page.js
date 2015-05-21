/**
 * BzDeck Details Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.DetailsPage = function DetailsPageView (page_id, bug_id, bug_ids = []) {
  this.id = page_id;
  this.bug_id = bug_id;
  this.bug_ids = bug_ids;

  this.$tab = document.querySelector(`#tab-details-${this.id}`);
  this.$tabpanel = document.querySelector(`#tabpanel-details-${this.id}`);
  this.$tabpanel.setAttribute('aria-busy', 'true');

  this.on('C:BugDataAvailable', data => {
    // Prepare the newly opened tabpanel
    if (!this.$bug) {
      this.$bug = this.$tabpanel.appendChild(this.get_fragment('bug-details-template', data.bug.id).firstElementChild);
      this.$$bug = new BzDeck.views.BugDetails(this.$bug, data.bug);
      this.$tab.querySelector('label').textContent = this.bug_id;
      this.$tab.title = this.get_tab_title(data.bug);
      this.update_window_title(this.$tab);

      // Set Back & Forward navigation
      if (this.bug_ids.length) {
        this.setup_navigation();
      }

      if (data.bug.summary) {
        this.$bug.removeAttribute('aria-hidden');
        this.$tabpanel.removeAttribute('aria-busy');
      }
    }
  });

  this.on('C:Offline', data => {
    BzDeck.views.statusbar.show('You have to go online to load the bug.'); // l10n
  });

  this.on('C:LoadingStarted', data => {
    BzDeck.views.statusbar.show('Loading...'); // l10n
  });

  this.on('C:LoadingComplete', data => {
    // Check if the tabpanel still exists
    if (this.$tabpanel && data.bug.summary) {
      BzDeck.views.statusbar.show('');
      // Update UI
      this.$$bug.bug = data.bug;
      this.$$bug.render();
      this.$tab.title = this.get_tab_title(data.bug);

      this.$bug.removeAttribute('aria-hidden');
      this.$tabpanel.removeAttribute('aria-busy');
    }
  });

  this.on('C:LoadingError', data => {
    BzDeck.views.statusbar.show('ERROR: Failed to load data.'); // l10n
  });
};

BzDeck.views.DetailsPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.DetailsPage.prototype.constructor = BzDeck.views.DetailsPage;

BzDeck.views.DetailsPage.prototype.get_tab_title = function (bug) {
  return `Bug ${bug.id}\n${bug.summary || 'Loading...'}`; // l10n
};

BzDeck.views.DetailsPage.prototype.setup_navigation = function () {
  let Button = this.widget.Button,
      $toolbar = this.$bug.querySelector('header [role="toolbar"]'),
      $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
      $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
      index = this.bug_ids.indexOf(this.bug_id),
      prev = this.bug_ids[index - 1],
      next = this.bug_ids[index + 1],
      assign_key_binding = (key, command) => FlareTail.util.kbd.assign(this.$bug, { key: command });

  let set_button_tooltip = (id, $$button) => {
    let bug = BzDeck.collections.bugs.get(id);

    $$button.view.$button.title = bug && bug.summary ? `Bug ${id}\n${bug.summary}` : `Bug ${id}`; // l10n
  };

  if (prev) {
    set_button_tooltip(prev, $$btn_back);
    $$btn_back.data.disabled = false;
    $$btn_back.bind('Pressed', event => this.navigate(prev));
    assign_key_binding('B', event => this.navigate(prev));
  } else {
    $$btn_back.data.disabled = true;
  }

  if (next) {
    set_button_tooltip(next, $$btn_forward);
    $$btn_forward.data.disabled = false;
    $$btn_forward.bind('Pressed', event => this.navigate(next));
    assign_key_binding('F', event => this.navigate(next));
  } else {
    $$btn_forward.data.disabled = true;
  }

  // Prepare the Back button on the mobile banner
  BzDeck.views.toolbar.add_back_button(this.$bug);
};

BzDeck.views.DetailsPage.prototype.navigate = function (new_id) {
  let old_id = this.bug_id,
      old_path = `/bug/${old_id}`,
      new_path = `/bug/${new_id}`,
      $existing_bug = document.querySelector(`#bug-${new_id}`);

  this.$tabpanel.setAttribute('aria-busy', 'true');

  // Copy the content from another tabpanel if available, or destroy the current content
  if ($existing_bug) {
    this.$tabpanel.replaceChild($existing_bug, this.$bug);
    this.$tabpanel.removeAttribute('aria-busy');
    this.$bug = $existing_bug;
    BzDeck.views.toolbar.$$tablist.close_tab($existing_bug.parentElement);
  } else {
    this.$bug.remove();
    this.$bug = undefined;
  }

  // Update relevant data
  this.bug_id = new_id;
  BzDeck.views.toolbar.tab_path_map.set(`tab-details-${this.id}`, new_path);
  window.history.replaceState({ 'ids': this.bug_ids, 'previous': old_path }, '', new_path);

  // Notify the Controller
  this.trigger(':NavigationRequested', { new_id, 'reinit': !$existing_bug });
};
