/**
 * BzDeck Details Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 23
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.DetailsPage = function (bug_id) {
  bug_id = Number.toInteger(bug_id);

  BzDeck.model.get_bug_by_id(bug_id, bug => {
    let tablist = BzDeck.toolbar.tablist;
  
    // Find an existing tab
    for (let tab of tablist.view.members) if (tab.id === 'tab-bug-' + bug_id) {
      tablist.view.selected = tablist.view.focused = tab;
      return;
    }
  
    // Prepare the tabpanel content
    let $content = document.querySelector('template#tabpanel-details').content,
        $tabpanel = BzDeck.global.fill_template($content, bug || { id: bug_id }, true);
    document.getElementById('main-tabpanels').appendChild($tabpanel);
  
    // Open the new tab
    tablist.view.selected = tablist.view.focused = tablist.add_tab(
      'bug-' + bug_id,
      'Bug %d'.replace('%d', bug_id), // l10n
      'Bug %d\n%s'.replace('%d', bug_id).replace('%s', bug ? bug.summary : 'Loading...'), // l10n
      $tabpanel,
      'next'
    );

    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      if (!navigator.onLine) {
        BzDeck.global.show_status('You have to go online to load a bug.'); // l10n
        return;
      }

      BzDeck.global.show_status('Loading...'); // l10n
      let query = BriteGrid.util.request.build_query({
        include_fields: '_default,' + BzDeck.options.api.extra_fields.join(','),
        exclude_fields: 'attachments.data'
      });
      BzDeck.core.request('GET', 'bug/' + bug_id + '?' + query, event => {
        let response = event.target.responseText,
            bug = response ? JSON.parse(response) : null;
        if (!bug || !bug.id) {
          BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
          return;
        }
        // Save in DB
        BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs').put(bug);
        // Update UI
        BzDeck.global.show_status('');
        BzDeck.global.fill_template($tabpanel, bug);
        let $tab = document.getElementById('tab-bug-' + bug.id);
        if ($tab) {
          $tab.title = 'Bug %d\n%s'.replace('%d', bug.id).replace('%s', bug.summary); // l10n
        }
      });
    }
  });
};
