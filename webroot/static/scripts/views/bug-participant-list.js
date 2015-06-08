/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the BugParticipantListView that represents the editable participant list on each bug details page, like
 * Assignee, Mentors or Cc.
 *
 * [argument] view_id (String) instance ID. It should be the same as the BugController instance, otherwise the related
 *                            notification events won't work
 * [argument] bug (Object) BugModel instance
 * [return] $section (Element) outer <section> element of the field
 */
BzDeck.views.BugParticipantList = function BugParticipantListView (view_id, bug, $section) {
  this.id = view_id;
  this.bug = bug;
  this.field = $section.dataset.field;

  this.editing = false;
  this.multiple = ['mentor', 'cc'].includes(this.field);
  this.can_take = ['assigned_to', 'qa_contact', 'mentor'].includes(this.field);
  this.values = new Set(this.multiple ? this.bug[this.field] : this.bug[this.field] ? [this.bug[this.field]] : []);
  this.my_email = BzDeck.models.account.data.name;

  this.$section = $section;
  this.$header = this.$section.querySelector('header');
  this.$list = this.$section.querySelector('.list')

  this.remove_empty_person();
  this.add_header_buttons();
  this.add_person_finder();

  this.on('BugController:ParticipantAdded', data => this.on_participant_added(data.field, data.email));
  this.on('BugController:ParticipantRemoved', data => this.on_participant_removed(data.field, data.email));
};

BzDeck.views.BugParticipantList.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugParticipantList.prototype.constructor = BzDeck.views.BugParticipantList;

/*
 * Remove an empty person node on the list. This should be handled by the template engine.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugParticipantList.prototype.remove_empty_person = function () {
  let $person = this.$list.querySelector('[itemscope]');

  if ($person && !$person.properties.email[0].itemValue) {
    $person.remove();
  }
};

/*
 * Add the Edit and Take buttons to the <header> in the <section>.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugParticipantList.prototype.add_header_buttons = function () {
  this.$take_button = this.create_button('take', this.can_take ? 'Take' : 'Add me', {
    assigned_to: 'Assign myself to this bug',
    qa_contact: 'Take myself the QA Contact of this bug',
    mentor: 'Take myself the mentor of this bug',
    cc: 'Add myself to the Cc list of this bug',
  }[this.field]);

  this.$take_button.setAttribute('aria-hidden', 'true');
  this.$take_button.setAttribute('aria-disabled', this.values.has(this.my_email));

  this.$take_button.addEventListener('click', event => {
    this.trigger('BugView:AddParticipant', { field: this.field, email: this.my_email });
  });

  this.$edit_button = this.create_button('edit', 'Edit', {
    assigned_to: 'Edit the Assignee',
    qa_contact: 'Edit the QA Contact',
    mentor: 'Edit the Mentor list',
    cc: 'Edit the Cc list',
  }[this.field]);

  this.$edit_button.setAttribute('aria-pressed', 'false');

  this.$edit_button.addEventListener('click', event => {
    this.editing = !this.editing;

    this.$edit_button.setAttribute('aria-pressed', this.editing);
    this.$take_button.setAttribute('aria-hidden', !this.editing);
    this.$finder.setAttribute('aria-hidden', !this.editing);

    for (let $person of this.$list.querySelectorAll('[itemscope]')) {
      if (this.editing) {
        this.add_remove_button_to_person($person);
        $person.tabIndex = -1;
        $person.setAttribute('role', 'none');
      } else {
        $person.querySelector('[role="button"]').remove();
        $person.tabIndex = 0;
        $person.setAttribute('role', 'link');
      }
    }
  });

  this.$header.appendChild(this.$take_button);
  this.$header.appendChild(this.$edit_button);
};

/*
 * Add a Person Finder under the <header>.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugParticipantList.prototype.add_person_finder = function () {
  this.$$finder = new BzDeck.views.PersonFinder(`${this.id}-${this.field}-person-finder`, this.bug, this.values);
  this.$finder = this.$$finder.$combobox;
  this.$finder.setAttribute('aria-hidden', 'true');

  this.$finder.addEventListener('Change', event => {
    this.$$finder.clear();
    this.trigger('BugView:AddParticipant', { field: this.field, email: event.detail.$target.dataset.value });
  });

  this.$section.insertBefore(this.$$finder.$combobox, this.$header.nextElementSibling);
};

/*
 * Called by BugController whenever a new participant is added by the user. Add the person to the list.
 *
 * [argument] field (String) relevant bug field, like assigned_to or cc
 * [argument] email (String) email of the added person
 * [return] none
 */
BzDeck.views.BugParticipantList.prototype.on_participant_added = function (field, email) {
  if (field !== this.field) {
    return;
  }

  let $person = this.$list.querySelector('[itemscope]');

  if (!this.multiple && $person) {
    let email = $person.properties.email[0].itemValue;

    this.values.delete(email);
    this.$$finder.exclude.delete(email);

    $person.remove();
  }

  $person = this.fill(this.get_template('bug-participant'),
                      BzDeck.collections.users.get(email, { name: email }).properties);

  this.values.add(email);
  this.$$finder.exclude.add(email);

  $person.itemProp.add(this.field);
  this.$list.insertBefore($person, this.$list.firstElementChild);
  this.$take_button.setAttribute('aria-disabled', this.values.has(this.my_email));

  if (this.$edit_button.matches('[aria-pressed="true"]')) {
    this.add_remove_button_to_person($person);
  }
};

/*
 * Called by BugController whenever a new participant is removed by the user. Remove the person from the list.
 *
 * [argument] field (String) relevant bug field, like assigned_to or cc
 * [argument] email (String) email of the removed person
 * [return] none
 */
BzDeck.views.BugParticipantList.prototype.on_participant_removed = function (field, email) {
  if (field !== this.field) {
    return;
  }

  let $email = this.$list.querySelector(`[itemprop="email"][content="${email}"]`),
      $person = $email ? $email.closest('[itemscope]') : undefined;

  if (!$person) {
    return;
  }

  this.values.delete(email);
  this.$$finder.exclude.delete(email);

  $person.remove();
  this.$take_button.setAttribute('aria-disabled', this.values.has(this.my_email));
};

/*
 * Create a new button widget.
 *
 * [argument] command (String) description of the button's action
 * [argument] text (String) label on the button
 * [argument] label (String) text used for the tooltip and aria-label
 * [return] $button (Element) button
 */
BzDeck.views.BugParticipantList.prototype.create_button = function (command, text, label) {
  let $button = document.createElement('span');

  $button.tabIndex = 0;
  $button.textContent = text;
  $button.title = label;
  $button.dataset.command = command;
  $button.setAttribute('role', 'button');
  $button.setAttribute('aria-label', label);

  return $button;
};

/*
 * Add the Remove button to each person.
 *
 * [argument] $person (Element) person on the list
 * [return] $button (Element) button
 */
BzDeck.views.BugParticipantList.prototype.add_remove_button_to_person = function ($person) {
  let email = $person.properties.email[0].itemValue,
      name = $person.properties.name[0].itemValue,
      $button = $person.querySelector('[role="button"]');

  if ($button) {
    $button.remove();
  }

  $button = this.create_button('remove', 'Remove', {
    assigned_to: `Unassign ${name} (${email}) from this bug`,
    qa_contact: `Take ${name} (${email}) off from the QA Contact of this bug`,
    mentor: `Take ${name} (${email}) off from the Mentor of this bug`,
    cc: `Remove ${name} (${email}) from the Cc list of this bug`,
  }[this.field]);

  $button.addEventListener('click', event => {
    event.stopPropagation();
    this.trigger('BugView:RemoveParticipant', { field: this.field, email });
  });

  $person.appendChild($button);

  return $button;
};
