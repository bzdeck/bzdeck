/**
 * BzDeck Global Toolbar Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.Toolbar = function ToolbarController () {
  BzDeck.views.toolbar = new BzDeck.views.Toolbar(BzDeck.models.data.account);

  this.subscribe('V:AppMenuItemSelected', data => {
    let func = {
      'show-profile': () => BzDeck.router.navigate('/profile/' + BzDeck.models.data.account.name),
      'show-settings': () => BzDeck.router.navigate('/settings'),
      'install-app': () => FlareTail.util.app.install(),
      'logout': () => BzDeck.controllers.session.logout(),
      'quit': () => BzDeck.controllers.session.close(),
    }[data.command];

    if (func) {
      func();
    }
  });

  this.subscribe('V:AdvancedSearchRequested', data => this.exec_advanced_search(data.terms));
  this.subscribe('V:QuickSearchRequested', data => this.exec_quick_search(data.terms));
};

BzDeck.controllers.Toolbar.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
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
  let words = [for (word of terms.trim().split(/\s+/)) word.toLowerCase()];

  BzDeck.models.bugs.get_all().then(bugs => {
    let results = bugs.filter(bug => {
      return words.every(word => bug.summary.toLowerCase().includes(word)) ||
             words.every(word => get_aliases(bug).join().toLowerCase().includes(word)) ||
             words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).includes(words[0]);
    });

    this.publish(':QuickSearchResultsAvailable', { results });
  });
};
