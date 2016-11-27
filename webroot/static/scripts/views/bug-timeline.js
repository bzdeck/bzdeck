/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Timeline View that represents the timeline area of each bug, containing comments and changes.
 * @extends BzDeck.BaseView
 */
BzDeck.BugTimelineView = class BugTimelineView extends BzDeck.BaseView {
  /**
   * Get a BugTimelineView instance.
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Proxy} bug - Proxified BugModel instance.
   * @param {HTMLElement} $bug - Outer element to display the content.
   * @param {Boolean} delayed - Whether the bug details including comments and attachments will be rendered later.
   * @returns {BugTimelineView} New BugTimelineView instance.
   */
  constructor (id, bug, $bug, delayed) {
    super(id); // Assign this.id

    this.bug = bug;
    this.$bug = $bug;

    const get_time = str => (new Date(str)).getTime();
    const entries = new Map([...this.bug.comments.entries()]
            .map(([index, comment]) => [get_time(comment.creation_time), new Map([['comment', comment]])]));
    const click_event_type = FlareTail.env.device.mobile ? 'touchstart' : 'mousedown';
    const data_arr = [];
    const $timeline = this.$timeline = this.$bug.querySelector('.bug-timeline');
    const timeline_id = $timeline.id = `bug-${this.bug.id}-${this.id}-timeline`;
    let read_comments_num = 0;
    let last_comment_time;

    for (const attachment of this.bug.attachments) {
      entries.get(get_time(attachment.creation_time)).set('attachment', attachment);
    }

    for (const _history of this.bug.history) if (entries.has(get_time(_history.when))) {
      entries.get(get_time(_history.when)).set('history', _history);
    } else {
      entries.set(get_time(_history.when), new Map([['history', _history]]));
    }

    // Sort by time
    this.entries = new Map([...entries].sort((a, b) => a[0] > b[0]));

    // Collapse read comments
    // If the fill_bug_details function is called after the bug details are fetched,
    // the _last_visit annotation is already true, so check the delayed argument here
    for (const [time, data] of this.entries) {
      // Append the time in data for later use
      data.set('time', time);

      if (!delayed && this.bug._last_visit && time < get_time(this.bug._last_visit)) {
        if (data.has('comment')) {
          read_comments_num++;
          last_comment_time = time;
        }
      } else {
        data.set('rendering', true);
      }
    }

    for (const [time, data] of this.entries) if (data.has('rendering') || time >= last_comment_time) {
      data_arr.push(data);
    }

    // Append entries to the timeline
    this.$comments_wrapper = this.$timeline.querySelector('[role="feed"]');
    (async () => this.$comments_wrapper.appendChild(await this.generate_entries(data_arr)))();

    // Show an expander if there are read comments
    if (read_comments_num > 1) {
      // The last comment is rendered, so decrease the number
      read_comments_num--;

      const $expander = this.$expander = document.createElement('div');

      $expander.textContent = read_comments_num === 1 ? '1 older comment'
                                                      : `${read_comments_num} older comments`; // l10n
      $expander.className = 'read-comments-expander';
      $expander.tabIndex = 0;
      $expander.setAttribute('role', 'button');
      $expander.addEventListener(click_event_type, event => {
        const $fragment = new DocumentFragment();
        const data_arr = [];

        $expander.textContent = 'Loading...'; // l10n

        for (const [time, data] of this.entries) if (!data.get('rendered')) {
          data_arr.push(data);
        }

        (async () => {
          $fragment.appendChild(await this.generate_entries(data_arr));

          // Collapse comments by default
          for (const $comment of $fragment.querySelectorAll('[itemprop="comment"]')) {
            $comment.setAttribute('aria-expanded', 'false');
          }

          $timeline.focus();
          this.$comments_wrapper.replaceChild($fragment, $expander);

          delete this.$expander;
        })();

        return FlareTail.util.Events.ignore(event);
      });

      this.$comments_wrapper.insertAdjacentElement('afterbegin', $expander);
    }

    $timeline.scrollTop = 0;
    $timeline.removeAttribute('aria-busy', 'false');

    // Subscribe to events
    this.on('BugModel#Updated', data => this.on_bug_updated(data), true);
    this.subscribe('BugPresenter#HistoryUpdated');
  }

  /**
   * Generate timeline entries.
   * @param {Array.<Map>} data_arr - List of entry data.
   * @returns {Promise.<HTMLElement>} Fragment containing entry nodes.
   */
  async generate_entries (data_arr) {
    const $fragment = new DocumentFragment();
    const _entries = await Promise.all(data_arr.map(data => {
      return (new BzDeck.BugTimelineEntryView(this.id, this.bug, data)).create();
    }));

    for (const entry of _entries) {
      $fragment.appendChild(entry.$outer);
      this.entries.get(entry.time).delete('rendering');
      this.entries.get(entry.time).set('rendered', true);
    }

    return $fragment;
  }

  /**
   * Expand all comments on the timeline.
   */
  expand_comments () {
    if (this.$expander) {
      this.$expander.dispatchEvent(new CustomEvent(FlareTail.env.device.mobile ? 'touchstart' : 'mousedown'));
    }

    for (const $comment of this.$timeline.querySelectorAll('[itemprop="comment"][aria-expanded="false"]')) {
      $comment.dispatchEvent(new CustomEvent('ToggleExpanded', { detail: { expanded: true }}));
    }
  }

  /**
   * Collapse all comments on the timeline.
   */
  collapse_comments () {
    for (const $comment of this.$timeline.querySelectorAll('[itemprop="comment"][aria-expanded="true"]')) {
      $comment.dispatchEvent(new CustomEvent('ToggleExpanded', { detail: { expanded: false }}));
    }
  }

  /**
   * Called whenever any field of a bug is updated. Update the view if the bug ID matches.
   * @listens BugModel#Updated
   * @param {Number} bug_id - Changed bug ID.
   * @param {Map} changes - Change details.
   */
  async on_bug_updated ({ bug_id, changes } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    const entry = await (new BzDeck.BugTimelineEntryView(this.id, this.bug, changes)).create();

    this.$comments_wrapper.appendChild(entry.$outer);
    this.$comments_wrapper.querySelector('article:last-of-type').scrollIntoView({ block: 'start', behavior: 'smooth' });

    // Update the aria-setsize attribute on each comment entry
    if (changes.has('comment')) {
      const size = this.bug.comments.length;

      for (const $comment of this.$comments_wrapper.querySelectorAll('[itemprop="comment"]')) {
        $comment.setAttribute('aria-setsize', size);
      }
    }
  }

  /**
   * Called whenever the navigation history state is updated. If the URL fragment has a valid comment number, scroll the
   * comment into view.
   * @listens BugPresenter#HistoryUpdated
   * @param {String} hash - location.hash.
   */
  on_history_updated ({ hash } = {}) {
    const match = hash.match(/^#c(\d+)$/);

    if (match) {
      const click_event_type = FlareTail.env.device.mobile ? 'touchstart' : 'mousedown';
      const count = Number.parseInt(match[1]);
      const $comment = this.$timeline.querySelector(`[data-comment-count="${count}"]`);

      if ($comment) {
        if (this.$expander) {
          // Expand all comments
          this.$expander.dispatchEvent(new CustomEvent(click_event_type));
        }

        $comment.scrollIntoView({ block: 'start', behavior: 'smooth' });
        $comment.focus();
      }
    }
  }
}
