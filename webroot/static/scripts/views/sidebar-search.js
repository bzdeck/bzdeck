/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the SidebarSearch View that contains the quick search panel.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarSearchView = class SidebarSearchView extends BzDeck.BaseView {
  /**
   * Get a SidebarSearchView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @returns {SidebarSearchView} New SidebarSearchView instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    this.$container = document.querySelector('#sidebar-search-panel');

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.sidebar_search = this.presenter = new BzDeck.SidebarSearchPresenter(this.id);
    BzDeck.presenters.quick_search = new BzDeck.QuickSearchPresenter(this.id);

    this.init_searchbar();
    this.init_results();
  }

  /**
   * Initialize the searchbar available in the vertical layout.
   * @listens QuickSearchPresenter#ResultsAvailable
   * @fires AnyView#QuickSearchRequested
   */
  init_searchbar () {
    const $searchbar = document.querySelector('#sidebar-search-container');
    const $searchbox = $searchbar.querySelector('[role="searchbox"]');

    $searchbox.addEventListener('input', event => {
      if ($searchbox.value.trim()) {
        this.trigger('AnyView#QuickSearchRequested', { input: $searchbox.value });
      }
    });

    this.on('QuickSearchPresenter#ResultsAvailable', async ({ category, input, results } = {}) => {
      // Check if the search terms have not changed since the search is triggered
      if (category !== 'bugs' || input !== $searchbox.value) {
        return;
      }

      // Render the results
      this.thread.update(await BzDeck.collections.bugs.get_some(results.map(result => result.id)));
    }, true);
  }

  /**
   * Initialize the search results thread.
   */
  init_results () {
    const $listbox = document.querySelector('#sidebar-search-results [role="listbox"]');

    // Star button
    $listbox.addEventListener('mousedown', async event => {
      if (event.target.matches('[itemprop="starred"]')) {
        const bug = await BzDeck.collections.bugs.get(Number(event.target.parentElement.dataset.id));

        bug.starred = event.target.matches('[aria-checked="false"]');
        event.stopPropagation();
      }
    });

    this.thread = new BzDeck.VerticalThreadView(this, 'search', document.querySelector('#sidebar-search-results'), {
      sort_conditions: { key: 'last_change_time', type: 'time', order: 'descending' }
    });
  }
}
