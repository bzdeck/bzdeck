/**
 * BzDeck Home Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.HomePage = function HomePageController (folder_id) {
  let prefs = BzDeck.models.data.prefs;

  if (!BzDeck.controllers.homepage) {
    BzDeck.controllers.homepage = this;
  }

  if (!this.view) {
    this.view = BzDeck.views.pages.home = new BzDeck.views.HomePage(prefs, this);
  }

  this.view.connect(folder_id);

  this.data = new Proxy({
    'bugs': [],
    'preview_id': null
  },
  {
    'get': (obj, prop) => {
      if (prop === 'bugs') {
        // Return a sorted bug list
        return this.view.get_shown_bugs(new Map([for (bug of obj.bugs) [bug.id, bug]]), prefs);
      }

      return obj[prop];
    },
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      if (prop === 'preview_id') {
        // Show the bug preview only when the preview pane is visible (on desktop and tablet)
        if (this.view.preview_is_hidden) {
          BzDeck.router.navigate('/bug/' + newval, { 'ids': [for (bug of this.data.bugs) bug.id] });

          return; // Do not save the value
        }

        if (oldval !== newval) {
          this.prep_preview(oldval, newval);
          BzDeck.controllers.bugzfeed._subscribe([newval]);
        }
      }

      obj[prop] = newval;
    }
  });

  this.subscribe('V:OpeningTabRequested', data => {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { 'ids': [for (bug of this.data.bugs) bug.id] });
  });
};

BzDeck.controllers.HomePage.route = '/home/(\\w+)';

BzDeck.controllers.HomePage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.HomePage.prototype.constructor = BzDeck.controllers.HomePage;

BzDeck.controllers.HomePage.prototype.prep_preview = function (oldval, newval) {
  if (!newval) {
    this.publish(':BugDataUnavailable');

    return;
  }

  BzDeck.models.bugs.get_bug_by_id(newval).then(bug => {
    if (bug) {
      BzDeck.controllers.bugs.toggle_unread(bug.id, false);
      this.publish(':BugDataAvailable', { bug });
    } else {
      this.publish(':BugDataUnavailable');
    }
  });
};
