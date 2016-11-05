/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug History View that represents the History tabpanel content in the Bug Details page.
 * @extends BzDeck.BaseView
 */
BzDeck.BugHistoryView = class BugHistoryView extends BzDeck.BaseView {
  /**
   * Get a BugHistoryView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {HTMLElement} $container - Outer element to display the content.
   * @returns {Object} view - New BugHistoryView instance.
   */
  constructor (id, $container) {
    super(id); // Assign this.id

    this.history = [];

    this.$container = $container;
    this.$tbody = this.$container.querySelector('tbody');

    // Remove the table rows
    this.$tbody.innerHTML = '';
  }

  /**
   * Render the history on the view.
   * @param {Array} history - Bug's history property.
   * @returns {undefined}
   */
  render (history) {
    const conf_field = BzDeck.host.data.config.field;
    const $row = this.get_template('details-change');

    for (const hist of history) {
      this.history.push(hist);

      for (const [i, change] of hist.changes.entries()) {
        const { field_name, added, removed } = change;
        const $_row = $row.cloneNode(true);
        const $cell = field => $_row.querySelector(`[itemprop="${field}"]`);

        if (i === 0) {
          $cell('who').innerHTML = hist.who.replace('@', '&#8203;@');
          $cell('who').rowSpan = $cell('when').rowSpan = hist.changes.length;
          FlareTail.helpers.datetime.fill_element($cell('when').appendChild(document.createElement('time')),
                                             hist.when, { relative: false });
        } else {
          $cell('when').remove();
          $cell('who').remove();
        }

        const _field = conf_field[field_name] ||
                       // Bug 909055 - Field name mismatch in history: group vs groups
                       conf_field[field_name.replace(/s$/, '')] ||
                       // Bug 1078009 - Changes/history now include some wrong field names
                       conf_field[{
                         'flagtypes.name': 'flag',
                         'attachments.description': 'attachment.description',
                         'attachments.filename': 'attachment.file_name',
                         'attachments.ispatch': 'attachment.is_patch',
                         'attachments.isobsolete': 'attachment.is_obsolete',
                         'attachments.isprivate': 'attachment.is_private',
                         'attachments.mimetype': 'attachment.content_type',
                       }[field_name]] ||
                       // If the Bugzilla config is outdated, the field name can be null
                       change;

        $cell('what').textContent = _field.description || _field.field_name;
        $cell('removed').innerHTML = this.get_cell_content(field_name, removed);
        $cell('added').innerHTML = this.get_cell_content(field_name, added);

        this.$tbody.appendChild($_row);
      }
    }
  }

  /**
   * Generate the content for a table cell. Bug ID will be converted to a link.
   * @param {String} field - Changed bug field name, like 'summary' or 'blocks'.
   * @param {String} content - Old or new value for the field.
   * @returns {String} content - Formatted cell content.
   */
  get_cell_content (field, content) {
    if (['blocks', 'depends_on'].includes(field)) {
      return content.replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>');
    }

    return FlareTail.helpers.string.sanitize(content).replace('@', '&#8203;@'); // ZERO WIDTH SPACE
  }
}
