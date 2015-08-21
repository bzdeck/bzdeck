/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers.Banner = function BannerController () {
  let name = BzDeck.models.account.data.name;

  this.user = BzDeck.collections.users.get(name, { name });
  BzDeck.views.banner = new BzDeck.views.Banner(this.user);

  this.user.get_gravatar_profile().then(profile => {
    this.trigger(':GravatarProfileFound', {
      style: { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
    });
  });

  this.on('V:AppMenuItemSelected', data => {
    let func = {
      'show-profile': () => BzDeck.router.navigate('/profile/' + this.user.email),
      'show-settings': () => BzDeck.router.navigate('/settings'),
      'install-app': () => this.helpers.app.install(),
      logout: () => BzDeck.controllers.session.logout(),
      quit: () => BzDeck.controllers.session.close(),
    }[data.command];

    if (func) {
      func();
    }
  });

  this.on('V:AdvancedSearchRequested', data => this.exec_advanced_search(data.terms));
  this.on('V:QuickSearchRequested', data => this.exec_quick_search(data.terms));
};

BzDeck.controllers.Banner.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Banner.prototype.constructor = BzDeck.controllers.Banner;

BzDeck.controllers.Banner.prototype.exec_advanced_search = function (terms) {
  let params = new URLSearchParams();

  if (terms) {
    params.append('short_desc', terms);
    params.append('short_desc_type', 'allwordssubstr');
    params.append('resolution', '---'); // Search only open bugs
  }

  BzDeck.router.navigate('/search/' + Date.now(), { 'params' : params.toString() });
};

BzDeck.controllers.Banner.prototype.exec_quick_search = function (terms) {
  let words = [for (word of terms.trim().split(/\s+/)) word.toLowerCase()],
      match = (str, word) => !!str.match(new RegExp(`\\b${this.helpers.regexp.escape(word)}`, 'i')),
      bugs = BzDeck.collections.bugs.get_all();

  let results = [...bugs.values()].filter(bug => {
    return words.every(word => bug.summary && match(bug.summary, word)) ||
           words.every(word => match(bug.aliases.join(), word)) ||
           words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).startsWith(words[0]);
  });

  this.trigger(':QuickSearchResultsAvailable', { results });
};
