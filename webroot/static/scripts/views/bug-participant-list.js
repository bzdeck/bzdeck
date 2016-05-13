/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the BugParticipantListView that represents an editable participant list on each Bug Details page, like
 * Assignee, Mentors or Cc.
 * @extends BzDeck.BaseView
 */
BzDeck.BugParticipantListView = class BugParticipantListView extends BzDeck.BaseView {
  /**
   * Get a BugParticipantListView instance.
   * @constructor
   * @argument {String} view_id - Instance identifier. It should be the same as the BugController instance, otherwise
   *  the relevant notification events won't work.
   * @argument {Proxy} bug - BugModel instance.
   * @argument {HTMLElement} $section - Outer <section> element of the field.
   * @return {Object} view - New BugParticipantListView instance.
   */
  constructor (view_id, bug, $section) {
    super(); // This does nothing but is required before using `this`

    this.id = view_id;
    this.bug = bug;
    this.field = $section.dataset.field;

    this.editing = false;
    this.multiple = ['mentor', 'cc'].includes(this.field);
    this.can_take = ['assigned_to', 'qa_contact', 'mentor'].includes(this.field);
    this.values = new Set(this.multiple ? this.bug[this.field] : this.bug[this.field] ? [this.bug[this.field]] : []);
    this.my_email = BzDeck.account.data.name;

    this.$section = $section;
    this.$header = this.$section.querySelector('header');
    this.$list = this.$section.querySelector('.list')

    this.remove_empty_person();
    this.add_person_finder();

    if (this.can_take) {
      this.add_take_button();
    } else {
      this.add_subscribe_button();
    }

    this.subscribe('BugView:EditModeChanged');
    this.subscribe('BugController:ParticipantAdded');
    this.subscribe('BugController:ParticipantRemoved');
  }

  /**
   * Remove an empty person node on the list. FIXME: This should be handled by the template engine.
   * @argument {undefined}
   * @return {undefined}
   */
  remove_empty_person () {
    let $person = this.$list.querySelector('[itemscope]');

    if ($person && !$person.querySelector('[itemprop="email"]').content) {
      $person.remove();
    }
  }

  /**
   * Called by BugView whenever the participant list's edit mode is changed. Toggle the Take button and Person Finder.
   * @argument {Object} data - Passed data.
   * @argument {Boolean} data.enabled - Whether the edit mode is enabled.
   * @return {undefined}
   */
  on_edit_mode_changed (data) {
    this.editing = data.enabled;

    this.$button.setAttribute('aria-hidden', this.can_take && !this.editing);
    this.$finder.setAttribute('aria-hidden', !this.editing);

    for (let $person of this.$list.querySelectorAll('[itemscope]')) {
      if (this.editing) {
        this.add_remove_button_to_person($person);
      } else {
        $person.querySelector('[role="button"]').remove();
        $person.tabIndex = 0;
        $person.setAttribute('role', 'link');
      }
    }
  }

  /**
   * Add the Take button to the <header> in the <section>.
   * @argument {undefined}
   * @return {undefined}
   */
  add_take_button () {
    this.$button = this.create_button('take', 'Take', {
      assigned_to: 'Assign myself to this bug',
      qa_contact: 'Take myself the QA Contact of this bug',
      mentor: 'Take myself the mentor of this bug',
    }[this.field]);

    this.$button.setAttribute('aria-hidden', 'true');
    this.$button.setAttribute('aria-disabled', this.values.has(this.my_email));

    this.$button.addEventListener('click', event => {
      this.trigger('BugView:AddParticipant', { field: this.field, email: this.my_email });
    });

    this.$header.appendChild(this.$button);
  }

  /**
   * Add the Subscribe button to the <header> in the <section>.
   * @argument {undefined}
   * @return {undefined}
   */
  add_subscribe_button () {
    let listed = this.values.has(this.my_email);
    let label = listed ? 'Unsubscribe' : 'Subscribe';
    let aria_label = listed ? 'Remove myself from the Cc list' : 'Add myself to the Cc list';

    this.$button = this.create_button('subscribe', label, aria_label);

    this.$button.addEventListener('click', event => {
      this.trigger(this.values.has(this.my_email) ? 'BugView:Unsubscribe' : 'BugView:Subscribe');
    });

    this.$header.appendChild(this.$button);
  }

  /**
   * Add a Person Finder under the <header>.
   * @argument {undefined}
   * @return {undefined}
   */
  add_person_finder () {
    this.$$finder = new BzDeck.PersonFinderView(`${this.id}-${this.field}-person-finder`, this.bug, this.values);
    this.$finder = this.$$finder.$combobox;
    this.$finder.setAttribute('aria-hidden', 'true');

    this.$finder.addEventListener('Change', event => {
      this.$$finder.clear();
      this.trigger('BugView:AddParticipant', { field: this.field, email: event.detail.$target.dataset.value });
    });

    this.$section.insertBefore(this.$$finder.$combobox, this.$header.nextElementSibling);
  }

  /**
   * Called by BugController whenever a new participant is added by the user. Add the person to the list.
   * @argument {Object} data - Passed data.
   * @argument {String} data.field - Relevant bug field, like assigned_to or cc.
   * @argument {String} data.email - Email of the added person.
   * @return {undefined}
   */
  on_participant_added (data) {
    if (data.field !== this.field) {
      return;
    }

    let $person = this.$list.querySelector('[itemscope]');
    let self = data.email === this.my_email;

    if (!this.multiple && $person) {
      let email = $person.querySelector('[itemprop="email"]').content;

      this.values.delete(email);
      this.$$finder.exclude.delete(email);

      $person.remove();
    }

    this.values.add(data.email);
    this.$$finder.exclude.add(data.email);

    if (this.can_take) {
      this.$button.setAttribute('aria-disabled', this.values.has(this.my_email));
    } else if (self) {
      this.$button.label = this.$button.textContent = 'Unsubscribe';
      this.$button.setAttribute('aria-label', 'Remove myself from the Cc list');
    }

    BzDeck.collections.users.get(data.email, { name: data.email }).then(participant => {
      $person = this.fill(this.get_template('bug-participant'), participant.properties);
      $person.setAttribute('itemprop', this.field);
      this.$list.insertBefore($person, this.$list.firstElementChild);

      if (this.editing) {
        this.add_remove_button_to_person($person);
      }
    });
  }

  /**
   * Called by BugController whenever a new participant is removed by the user. Remove the person from the list.
   * @argument {Object} data - Passed data.
   * @argument {String} data.field - Relevant bug field, like assigned_to or cc.
   * @argument {String} data.email - Email of the removed person.
   * @return {undefined}
   */
  on_participant_removed (data) {
    if (data.field !== this.field) {
      return;
    }

    let $email = this.$list.querySelector(`[itemprop="email"][content="${data.email}"]`);
    let $person = $email ? $email.closest('[itemscope]') : undefined;
    let self = data.email === this.my_email;

    if (!$person) {
      return;
    }

    this.values.delete(data.email);
    this.$$finder.exclude.delete(data.email);

    // Add a simple animation effect on removing participants
    $person.classList.add('removing');
    $person.addEventListener('transitionend', event => {
      $person.remove();

      if (this.can_take) {
        this.$button.setAttribute('aria-disabled', this.values.has(this.my_email));
      } else if (self) {
        this.$button.label = this.$button.textContent = 'Subscribe';
        this.$button.setAttribute('aria-label', 'Add myself to the Cc list');
      }
    });
  }

  /**
   * Create a new button widget.
   * @argument {String} command - Description of the button's action.
   * @argument {String} text - Text used for the label and tooltip on the button.
   * @argument {String} label - Text used for the aria-label attribute.
   * @return {HTMLElement} $button
   */
  create_button (command, text, label) {
    let $button = document.createElement('span');

    $button.tabIndex = 0;
    $button.textContent = text;
    $button.title = text;
    $button.dataset.command = command;
    $button.setAttribute('role', 'button');
    $button.setAttribute('aria-label', label);

    return $button;
  }

  /**
   * Add the Remove button to each person.
   * @argument {HTMLElement} $person - Person on the list.
   * @return {HTMLElement} $button
   */
  add_remove_button_to_person ($person) {
    let email = $person.querySelector('[itemprop="email"]').content;
    let name = $person.querySelector('[itemprop="name"]').textContent;
    let $button = $person.querySelector('[role="button"]');

    if ($button) {
      $button.remove();
    }

    $button = this.create_button('remove', 'Remove', {
      assigned_to: `Unassign ${name} (${email}) from this bug`,
      qa_contact: `Take ${name} (${email}) off from the QA Contact of this bug`,
      mentor: `Take ${name} (${email}) off from the Mentor of this bug`,
      cc: `Remove ${name} (${email}) from the Cc list of this bug`,
    }[this.field]);

    $button.classList.add('iconic');

    $button.addEventListener('click', event => {
      event.stopPropagation();
      this.trigger('BugView:RemoveParticipant', { field: this.field, email });
    });

    $person.appendChild($button);
    $person.tabIndex = -1;
    $person.setAttribute('role', 'none');

    return $button;
  }
}
