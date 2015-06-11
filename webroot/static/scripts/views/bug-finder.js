/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.BugFinder = function BugFinderView (combobox_id, bug = undefined, exclude = new Set()) {
  this.bug = bug;
  // this.participants = bug ? bug.participants : new Map();
  this.exclude = exclude;
  this.results = new Map();

  this.$combobox = this.get_template('bug-finder');
  this.$input = this.$combobox.querySelector('[role="searchbox"]');
  this.$option = this.get_template('bug-finder-item');

  this.$$combobox = new this.widgets.ComboBox(this.$combobox);
  this.$$combobox.$container.id = this.combobox_id = combobox_id;
  this.$$combobox.on('Input', event => this.oninput(event));
};

BzDeck.views.BugFinder.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugFinder.prototype.constructor = BzDeck.views.BugFinder;

BzDeck.views.BugFinder.prototype.oninput = function (event) {
};

BzDeck.views.BugFinder.prototype.search_bug = function () {
};

BzDeck.views.BugFinder.prototype.search_local = function () {
};

BzDeck.views.BugFinder.prototype.search_remote = function () {
};

BzDeck.views.BugFinder.prototype.search = function (users) {
};

BzDeck.views.BugFinder.prototype.clear = function () {
};
