/**
 * BzDeck Global Toolbar Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.Toolbar = function ToolbarController () {
  this.user = BzDeck.controllers.users.get(BzDeck.models.account.data.name);

  BzDeck.views.toolbar = new BzDeck.views.Toolbar(this.user);

  this.user.get_gravatar_profile().then(profile => {
    this.trigger(':GravatarProfileFound', {
      'style': { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
    });
  });

  this.on('V:AppMenuItemSelected', data => {
    let func = {
      'show-profile': () => BzDeck.router.navigate('/profile/' + this.user.email),
      'show-settings': () => BzDeck.router.navigate('/settings'),
      'install-app': () => FlareTail.util.app.install(),
      'logout': () => BzDeck.controllers.session.logout(),
      'quit': () => BzDeck.controllers.session.close(),
    }[data.command];

    if (func) {
      func();
    }
  });

  this.on('V:AdvancedSearchRequested', data => this.exec_advanced_search(data.terms));
  this.on('V:QuickSearchRequested', data => this.exec_quick_search(data.terms));
};

BzDeck.controllers.Toolbar.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Toolbar.prototype.constructor = BzDeck.controllers.Toolbar;

BzDeck.controllers.Toolbar.prototype.exec_advanced_search = function (terms) {
  let params = new URLSearchParams();

  if (terms) {
    params.append('short_desc', terms);
    params.append('short_desc_type', 'allwordssubstr');
    params.append('resolution', '---'); // Search only open bugs
  }

  BzDeck.router.navigate('/search/' + Date.now(), { 'params' : params.toString() });
};

BzDeck.controllers.Toolbar.prototype.exec_quick_search = function (terms) {
  let words = [for (word of terms.trim().split(/\s+/)) word.toLowerCase()],
      get_aliases = bug => bug.alias ? (Array.isArray(bug.alias) ? bug.alias : [bug.alias]) : [];

  BzDeck.models.bugs.get_all().then(bugs => {
    let results = bugs.filter(bug => {
      return words.every(word => bug.summary.toLowerCase().includes(word)) ||
             words.every(word => get_aliases(bug).join().toLowerCase().includes(word)) ||
             words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).includes(words[0]);
    });

    this.trigger(':QuickSearchResultsAvailable', { results });
  });
};
